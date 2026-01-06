/**
 * Wallet PnL Analysis Service
 * 
 * Calculates Profit and Loss (PnL) for wallets on EVM and Solana chains.
 * Uses ScanAPI/Infura for EVM and Helius for Solana.
 */

import * as scanApi from './scanApi.js';
import * as helius from './helius.js';
import * as dexscreener from './dexscreener.js';
import * as geckoTerminal from './geckoTerminal.js';
import { WalletTransaction } from './alchemy.js';
import { env } from '../config/env.js';

export interface TokenPnL {
    symbol: string;
    address: string;
    amountBought: number;
    amountSold: number;
    costBasis: number; // Total spent in USD
    realizedPnl: number;
    unrealizedPnl: number;
    currentValue: number;
    win: boolean;
    holdingBalance: number;
}

export interface WalletPnLReport {
    address: string;
    chain: string;
    tokens: TokenPnL[];
    summary: {
        totalRealizedPnl: number;
        totalUnrealizedPnl: number;
        winRate: number;
        tradesCount: number;
    }
}

/**
 * Get recent token transfers for a wallet
 */
export async function getWalletTransfers(address: string, chain: string = 'eth'): Promise<WalletTransaction[]> {
    const isSolana = chain.toLowerCase() === 'solana' || chain.toLowerCase() === 'sol';

    if (isSolana) {
        const response = await helius.getAddressTransactions(address, 100);
        const transactions: WalletTransaction[] = [];

        for (const tx of response.transactions || []) {
            if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
                for (const transfer of tx.tokenTransfers) {
                    const isIncoming = transfer.toUserAccount.toLowerCase() === address.toLowerCase();
                    transactions.push({
                        txHash: tx.signature,
                        txType: isIncoming ? 'BUY' : 'SELL',
                        fromAddress: transfer.fromUserAccount,
                        toAddress: transfer.toUserAccount,
                        tokenSymbol: 'SPL', // Placeholder
                        tokenAddress: transfer.mint,
                        amount: transfer.tokenAmount.toString(),
                        valueUsd: null,
                        blockNumber: tx.slot,
                        blockTimestamp: new Date(tx.timestamp * 1000),
                        chain: 'solana'
                    });
                }
            }
        }
        return transactions;
    } else {
        // EVM: Use ScanApi primarily
        try {
            const transfers = await scanApi.getEvmTokenTransfers(address, chain, 1, 100);
            return transfers;
        } catch (error) {
            console.error(`[WalletPnL] ScanAPI failed:`, error);
            return [];
        }
    }
}

async function getHistoricalPrice(chain: string, tokenAddress: string, timestamp: Date): Promise<number | null> {
    try {
        // Use GeckoTerminal for historical OHLCV
        const details = await geckoTerminal.getTokenDetails(chain, tokenAddress);
        if (!details || !details.poolAddress) return null;

        // Fetch hourly candles (last 100 hours is usually enough for recent trading)
        const candles = await geckoTerminal.getCandlestickData(chain, details.poolAddress, 'h1', 100);
        if (!candles || candles.length === 0) return null;

        const txTime = Math.floor(timestamp.getTime() / 1000);
        let closestCandle = candles[0];
        let minDiff = Math.abs(candles[0].time - txTime);

        for (const candle of candles) {
            const diff = Math.abs(candle.time - txTime);
            if (diff < minDiff) {
                minDiff = diff;
                closestCandle = candle;
            }
        }

        // If the diff is more than 4 hours (14400s), the price might be too old/irrelevant
        // This threshold matches the logic in tokenAnalysis.ts
        if (minDiff > 14400) return null;

        return closestCandle.close;
    } catch (e) {
        return null;
    }
}

/**
 * Calculate PnL for a wallet based on transaction history
 */
export async function analyzeWalletPnL(address: string, chain: string = 'eth'): Promise<WalletPnLReport> {
    console.log(`[WalletPnL] Analyzing PnL for ${address} on ${chain}...`);

    const transfers = await getWalletTransfers(address, chain);

    // Group by token
    const tokenGroups: Record<string, WalletTransaction[]> = {};
    for (const tx of transfers) {
        const tokenKey = tx.tokenAddress || 'NATIVE';
        if (!tokenGroups[tokenKey]) tokenGroups[tokenKey] = [];
        tokenGroups[tokenKey].push(tx);
    }

    const tokenPnLs: TokenPnL[] = [];

    // Process each token
    for (const [tokenAddr, txs] of Object.entries(tokenGroups)) {
        if (tokenAddr === 'NATIVE') continue; // Skip native for now or handle separately

        let amountBought = 0;
        let amountSold = 0;
        let costBasis = 0;
        let realizedPnl = 0;

        const symbol = txs[0].tokenSymbol || 'UNK';

        // Calculate realized PnL and cost basis
        for (const tx of txs) {
            const amount = parseFloat(tx.amount);
            if (tx.txType === 'TRANSFER_IN' || tx.txType === 'BUY') {
                amountBought += amount;

                // Try to get price at time of tx
                let price = tx.valueUsd ? tx.valueUsd / amount : await getHistoricalPrice(chain, tokenAddr, tx.blockTimestamp);
                if (price) {
                    costBasis += amount * price;
                }
            } else if (tx.txType === 'TRANSFER_OUT' || tx.txType === 'SELL') {
                amountSold += amount;

                let price = tx.valueUsd ? tx.valueUsd / amount : await getHistoricalPrice(chain, tokenAddr, tx.blockTimestamp);
                if (price) {
                    realizedPnl += amount * (price - (costBasis / amountBought || 0));
                }
            }
        }

        const holdingBalance = Math.max(0, amountBought - amountSold);

        // Get current price
        let currentPrice = 0;
        try {
            const details = await dexscreener.getTokenDetails(chain, tokenAddr);
            currentPrice = details?.price || 0;
        } catch (e) {
            console.warn(`[WalletPnL] Could not fetch price for ${tokenAddr}`);
        }

        const currentValue = holdingBalance * currentPrice;
        const unrealizedPnl = holdingBalance > 0 ? currentValue - (costBasis * (holdingBalance / amountBought || 0)) : 0;

        tokenPnLs.push({
            symbol,
            address: tokenAddr,
            amountBought,
            amountSold,
            costBasis,
            realizedPnl,
            unrealizedPnl,
            currentValue,
            win: realizedPnl > 0 || unrealizedPnl > 0,
            holdingBalance
        });
    }

    const totalRealized = tokenPnLs.reduce((sum, t) => sum + t.realizedPnl, 0);
    const totalUnrealized = tokenPnLs.reduce((sum, t) => sum + t.unrealizedPnl, 0);
    const wins = tokenPnLs.filter(t => t.win).length;

    return {
        address,
        chain,
        tokens: tokenPnLs,
        summary: {
            totalRealizedPnl: totalRealized,
            totalUnrealizedPnl: totalUnrealized,
            winRate: tokenPnLs.length > 0 ? (wins / tokenPnLs.length) * 100 : 0,
            tradesCount: transfers.length
        }
    };
}
