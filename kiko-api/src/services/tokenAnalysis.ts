/**
 * Token Analysis Service
 * Handles complex token-level analytics like early buyers and top traders
 */

import * as scanApi from './scanApi.js';
import * as helius from './helius.js';
import * as alchemy from './alchemy.js';
import * as rpcManager from './rpcManager.js';
import * as dexscreener from './dexscreener.js';
import * as geckoTerminal from './geckoTerminal.js';
import { WalletTransaction } from './alchemy.js';

// Known contract patterns to filter out
const KNOWN_CONTRACTS = new Set([
    '0x0000000000000000000000000000000000000000',
    '0x000000000000000000000000000000000000dead',
]);

/**
 * Check if an address is a contract (has code) or EOA (person wallet)
 */
async function isContract(address: string, chain: string): Promise<boolean> {
    if (!address) return false;
    if (KNOWN_CONTRACTS.has(address.toLowerCase())) return true;
    try {
        const code = await rpcManager.callRpc<string>(chain, 'eth_getCode', [address, 'latest']);
        // EOA wallets have no code, so eth_getCode returns '0x'
        return code !== '0x' && code !== '0x0' && code.length > 2;
    } catch (e) {
        return false; // If we can't check, assume it's not a contract
    }
}

export interface EarlyBuyer {
    address: string;
    timestamp: Date;
    amount: string;
    txHash: string;
    pnlUsd: number; // Profit/Loss for this wallet on this token
    isSmart: boolean; // True if wallet is profitable
}

/**
 * Get the earliest buyers of a token
 */
export async function getEarlyBuyers(
    tokenAddress: string,
    chain: string,
    limit: number = 10
): Promise<EarlyBuyer[]> {
    const chainLower = chain.toLowerCase();
    const isSolana = chainLower === 'solana' || chainLower === 'sol';

    if (isSolana) {
        console.log(`[TokenAnalysis] Fetching early buyers for Solana mint: ${tokenAddress}`);
        try {
            // Import solscan dynamically
            const solscan = await import('./solscan.js');

            // 1. Get Current Price and Pool Address
            let poolAddress = '';
            let currentPrice = 0;
            try {
                const details = await dexscreener.getTokenDetails('solana', tokenAddress);
                currentPrice = details?.price || 0;
                poolAddress = details?.poolAddress || '';
            } catch (e) {
                console.warn('[TokenAnalysis] Error fetching Solana token details:', e);
            }

            // Use Solscan Pro API with sort_order=asc to get EARLIEST transactions directly
            const result = await solscan.getTokenTransfers(tokenAddress, 100, 'asc');

            let buyers: EarlyBuyer[] = [];
            const seen = new Set<string>();

            if (!result.success || !result.data || result.data.length === 0) {
                console.log('[TokenAnalysis] Solscan returned no token transfers, falling back to Helius...');
                try {
                    // Fallback to Helius - get transaction signatures then batch parse
                    const earliestTxs = await helius.getEarliestTransactionsForAddress(tokenAddress, 100);

                    if (earliestTxs && earliestTxs.length > 0) {
                        // Batch parse all transactions in a single API call
                        const signatures = earliestTxs.map(tx => tx.signature);
                        const parsedTxs = await helius.getTransactionsBatch(signatures);

                        for (const parsedTx of parsedTxs) {
                            if (parsedTx && parsedTx.tokenTransfers && parsedTx.tokenTransfers.length > 0) {
                                for (const transfer of parsedTx.tokenTransfers) {
                                    if (transfer.mint === tokenAddress && !seen.has(transfer.toUserAccount)) {
                                        buyers.push({
                                            address: transfer.toUserAccount,
                                            timestamp: new Date(parsedTx.timestamp * 1000),
                                            amount: transfer.tokenAmount.toString(),
                                            txHash: parsedTx.signature,
                                            pnlUsd: 0,
                                            isSmart: false
                                        });
                                        seen.add(transfer.toUserAccount);
                                        if (buyers.length >= limit) break;
                                    }
                                }
                            }
                            if (buyers.length >= limit) break;
                        }
                        console.log(`[TokenAnalysis] Found ${buyers.length} early buyers via Helius transactions`);
                    }
                } catch (heliusErr) {
                    console.warn('[TokenAnalysis] Helius transaction fallback failed:', heliusErr);
                }

                // If still no buyers, fall back to largest holders
                if (buyers.length === 0) {
                    console.log('[TokenAnalysis] No transactions found, falling back to largest holders...');
                    try {
                        const largestAccounts = await helius.getTokenLargestAccounts(tokenAddress);
                        if (largestAccounts.length > 0) {
                            const accountAddresses = largestAccounts.map(acc => acc.address);
                            const owners = await helius.getAccountOwnersBatch(accountAddresses);

                            const processedHolders = new Set<string>();
                            for (const acc of largestAccounts) {
                                const owner = owners[acc.address];
                                if (owner && !processedHolders.has(owner) && owner !== tokenAddress) {
                                    buyers.push({
                                        address: owner,
                                        timestamp: new Date(), // Holder fallback doesn't have exact buy time
                                        amount: acc.uiAmountString,
                                        txHash: 'holder-fallback',
                                        pnlUsd: 0,
                                        isSmart: false
                                    });
                                    processedHolders.add(owner);
                                    if (buyers.length >= limit) break;
                                }
                            }
                        }
                        console.log(`[TokenAnalysis] Found ${buyers.length} buyers via largest holders`);
                    } catch (holderErr) {
                        console.warn('[TokenAnalysis] Holder fallback failed:', holderErr);
                    }
                }
            } else {
                // Process Solscan transfers (already sorted oldest-first!)
                for (const transfer of result.data) {
                    const buyerAddr = transfer.to_address;
                    if (!buyerAddr || buyerAddr === tokenAddress) continue;
                    if (seen.has(buyerAddr)) continue;

                    buyers.push({
                        address: buyerAddr,
                        timestamp: new Date(transfer.block_time * 1000),
                        amount: (transfer.amount / Math.pow(10, transfer.token_decimals || 9)).toString(),
                        tx_hash: transfer.tx_hash,
                        pnlUsd: 0,
                        isSmart: false
                    } as any); // Type hack because tx_hash vs txHash
                    seen.add(buyerAddr);
                    if (buyers.length >= limit) break;
                }
                console.log(`[TokenAnalysis] Found ${buyers.length} early buyers for Solana token via Solscan`);
            }

            // 3. Calculate PnL for the identified buyers
            if (buyers.length > 0 && currentPrice > 0 && poolAddress) {
                try {
                    // Fetch historical prices to calculate PnL
                    const timestamps = buyers.map(b => Math.floor(b.timestamp.getTime() / 1000));
                    const minTime = Math.min(...timestamps);

                    const priceHistory = new Map<number, number>();
                    const candles = await geckoTerminal.getCandlestickData('solana', poolAddress, 'minute', 1000);

                    if (candles && candles.length > 0) {
                        for (const candle of candles) {
                            const minuteTs = Math.floor(candle.time / 60) * 60;
                            priceHistory.set(minuteTs, candle.close);
                        }
                    }

                    for (const buyer of buyers) {
                        const ts = Math.floor(buyer.timestamp.getTime() / 1000);
                        const minuteTs = Math.floor(ts / 60) * 60;
                        const buyPrice = priceHistory.get(minuteTs) || currentPrice; // Fallback to current if missing

                        const amount = parseFloat(buyer.amount);
                        const costBasis = amount * buyPrice;
                        const currentValue = amount * currentPrice;

                        buyer.pnlUsd = currentValue - costBasis;
                        buyer.isSmart = buyer.pnlUsd > 0;

                        // Fix property name if needed (Solscan block used tx_hash)
                        if ((buyer as any).tx_hash) {
                            buyer.txHash = (buyer as any).tx_hash;
                            delete (buyer as any).tx_hash;
                        }
                    }
                } catch (pnlError) {
                    console.warn('[TokenAnalysis] Error calculating PnL for Solana buyers:', pnlError);
                }
            }

            return buyers;
        } catch (error) {
            console.error('[TokenAnalysis] Error fetching early buyers on Solana:', error);
            return [];
        }
    }
    else {
        console.log(`[TokenAnalysis] Fetching early buyers for EVM token: ${tokenAddress} on ${chainLower}`);
        try {
            // Limit to 500 transactions to ensure we catch enough early buyers
            const analysisLimit = 500;

            // Fetch more transfers for PnL calculation purposes
            // Sort ASC to get earliest txs first
            const allTransfers = await scanApi.getEvmTokenTransfers(tokenAddress, chainLower, 1, analysisLimit, { sort: 'asc' });

            console.log(`[TokenAnalysis] Found ${allTransfers.length} transfers for analysis via ScanAPI`);

            // 1. Get Pool Address and Historical Data logic
            let poolAddress = '';
            let currentPrice = 0;
            const priceHistory = new Map<number, number>(); // timestamp (seconds) -> price

            try {
                const details = await dexscreener.getTokenDetails(chainLower, tokenAddress);
                currentPrice = details?.price || 0;
                // DexScreenerToken uses poolAddress (which maps to pairAddress API field)
                if (details?.poolAddress) poolAddress = details.poolAddress;

                // Fallback to GeckoTerminal if pool address missing
                if (!poolAddress) {
                    const geckoDetails = await geckoTerminal.getTokenDetails(chainLower, tokenAddress);
                    currentPrice = currentPrice || geckoDetails?.price || 0;
                    if (geckoDetails?.poolAddress) poolAddress = geckoDetails.poolAddress;
                }

                if (poolAddress) {
                    // Find time range required
                    const timestamps = allTransfers.map(t => Math.floor(new Date(t.blockTimestamp).getTime() / 1000));
                    const minTime = Math.min(...timestamps);
                    const maxTime = Math.max(...timestamps);

                    console.log(`[TokenAnalysis] Fetching historical prices for PnL. Range: ${new Date(minTime * 1000).toISOString()} - ${new Date(maxTime * 1000).toISOString()}`);

                    // Fetch candles iteratively backwards
                    // Start from "now" (or maxTime if it's long ago) and go back to minTime
                    // Use 'minute' candles for precision
                    let targetTime = Math.floor(Date.now() / 1000);

                    // Safety break to prevent infinite loop
                    let fetchCount = 0;
                    const MAX_FETCHES = 10;

                    while (targetTime > minTime && fetchCount < MAX_FETCHES) {
                        const candles = await geckoTerminal.getCandlestickData(chainLower, poolAddress, 'minute', 1000);
                        if (!candles || candles.length === 0) break;

                        let oldestCandleTime = targetTime;

                        for (const candle of candles) {
                            // Map minute timestamp to price
                            // Normalize to minute: floor(time / 60) * 60
                            const candleTime = Math.floor(candle.time / 60) * 60;
                            priceHistory.set(candleTime, candle.close);
                            if (candle.time < oldestCandleTime) oldestCandleTime = candle.time;
                        }

                        // Next batch should be before the oldest candle we just got
                        if (oldestCandleTime >= targetTime) break; // No progress
                        targetTime = oldestCandleTime;
                        fetchCount++;

                        // Optimization: if we already covered minTime, stop
                        if (targetTime < minTime) break;
                    }
                    console.log(`[TokenAnalysis] Fetched ${priceHistory.size} historical price points`);
                }

            } catch (e) {
                console.warn('[TokenAnalysis] Error fetching historical prices:', e);
            }

            // 2. Calculate PnL for ALL wallets in the batch
            const walletStats: Record<string, {
                costBasis: number, // USD spent
                revenue: number,   // USD realized from sells
                buyAmount: number,
                sellAmount: number
            }> = {};

            const updateStats = (addr: string, type: 'buy' | 'sell', val: number, amt: number, timestamp: Date) => {
                if (!addr) return;
                const ts = Math.floor(timestamp.getTime() / 1000);
                const minuteTs = Math.floor(ts / 60) * 60;
                // Find price: precise -> closest -> current
                let price = priceHistory.get(minuteTs);
                if (!price) {
                    // Try finding any price adjacent if precise missing, else current
                    price = currentPrice;
                }

                // Calculate Value of this transaction at that time
                const txValueUsd = amt * price;

                if (!walletStats[addr]) walletStats[addr] = { costBasis: 0, revenue: 0, buyAmount: 0, sellAmount: 0 };

                if (type === 'buy') {
                    walletStats[addr].costBasis += txValueUsd;
                    walletStats[addr].buyAmount += amt;
                } else {
                    walletStats[addr].revenue += txValueUsd;
                    walletStats[addr].sellAmount += amt;
                }
            };

            for (const tx of allTransfers) {
                const fromAddr = tx.fromAddress?.toLowerCase() || '';
                const toAddr = tx.toAddress?.toLowerCase() || '';
                const amount = parseFloat(tx.amount) || 0;

                // Skip zero/burn addresses
                if (fromAddr !== '0x0000000000000000000000000000000000000000') updateStats(fromAddr, 'sell', 0, amount, new Date(tx.blockTimestamp));
                if (toAddr !== '0x0000000000000000000000000000000000000000') updateStats(toAddr, 'buy', 0, amount, new Date(tx.blockTimestamp));
            }

            // 3. Identify Early Buyers (first N unique EOA wallets)
            const earlyBuyersList: EarlyBuyer[] = [];
            const earlySeen = new Set<string>();

            for (const tx of allTransfers) {
                const buyerAddr = tx.toAddress;
                // Basic filters
                if (!buyerAddr) continue;
                if (buyerAddr.toLowerCase() === tokenAddress.toLowerCase()) continue;
                if (earlySeen.has(buyerAddr.toLowerCase())) continue;

                // Contract check
                const isContractAddr = await isContract(buyerAddr, chainLower);
                if (isContractAddr) continue;

                // Calculate PnL for this buyer
                const stats = walletStats[buyerAddr.toLowerCase()] || { costBasis: 0, revenue: 0, buyAmount: 0, sellAmount: 0 };
                const holdingBalance = stats.buyAmount - stats.sellAmount;
                const holdingValue = holdingBalance * currentPrice;

                // Precise PnL Logic:
                // Realized PnL = Revenue - Cost of Goods Sold (using Average Cost Basis)
                // Unrealized PnL = Holding Value - Cost of Holdings

                let totalPnl = 0;
                if (stats.buyAmount > 0) {
                    const avgBuyPrice = stats.costBasis / stats.buyAmount;
                    const realizedPnl = stats.revenue - (stats.sellAmount * avgBuyPrice);
                    const unrealizedPnl = (holdingBalance * currentPrice) - (holdingBalance * avgBuyPrice);
                    totalPnl = realizedPnl + unrealizedPnl;
                }

                earlyBuyersList.push({
                    address: buyerAddr,
                    timestamp: tx.blockTimestamp,
                    amount: tx.amount,
                    txHash: tx.txHash,
                    pnlUsd: totalPnl,
                    isSmart: totalPnl > 0 // Smart if profitable
                });
                earlySeen.add(buyerAddr.toLowerCase());
                if (earlyBuyersList.length >= limit) break;
            }
            console.log(`[TokenAnalysis] Identified ${earlyBuyersList.length} unique early buyers (EOA only) on EVM via ScanAPI`);

            // Fallback to Alchemy if ScanAPI returns no valid early buyers (likely missing data)
            if (earlyBuyersList.length === 0) {
                console.log(`[TokenAnalysis] ScanAPI returned NO valid early buyers (likely missing data), trying Alchemy fallback...`);
                // Fallback to Alchemy logic
                const alchemyTransfers = await alchemy.getAssetTransfers(null, chainLower, {
                    contractAddresses: [tokenAddress],
                    category: ['erc20'],
                    order: 'asc',
                    maxCount: limit * 20 // Fetch more from Alchemy to be safe
                });

                if (alchemyTransfers && alchemyTransfers.length > 0) {
                    const alchemySeen = new Set<string>();

                    for (const tx of alchemyTransfers) {
                        const buyerAddr = tx.to;
                        if (!buyerAddr) continue;
                        if (buyerAddr.toLowerCase() === tokenAddress.toLowerCase()) continue;
                        if (alchemySeen.has(buyerAddr.toLowerCase())) continue;

                        // Contract check
                        const isContractAddr = await isContract(buyerAddr, chainLower);
                        if (isContractAddr) continue;

                        // Calculate PnL (if price history available)
                        let pnlUsd = 0;
                        let isSmart = false;
                        if (priceHistory.size > 0 && tx.metadata?.blockTimestamp) {
                            const ts = Math.floor(new Date(tx.metadata.blockTimestamp).getTime() / 1000);
                            const minuteTs = Math.floor(ts / 60) * 60;
                            // Approximated Buy Price
                            const buyPrice = priceHistory.get(minuteTs) || priceHistory.get(minuteTs - 60) || priceHistory.get(minuteTs + 60) || currentPrice;
                            const amount = parseFloat(tx.value?.toString() || '0');
                            const costBasis = amount * buyPrice;
                            const currentValue = amount * currentPrice;

                            // Simple PnL for single Buy event (since Alchemy fallback doesn't track sells here yet)
                            // PnL = Current Value - Cost Basis
                            pnlUsd = currentValue - costBasis;
                            isSmart = pnlUsd > 0;
                        }

                        // Identify as early buyer
                        earlyBuyersList.push({
                            address: buyerAddr,
                            timestamp: tx.metadata?.blockTimestamp ? new Date(tx.metadata.blockTimestamp) : new Date(),
                            amount: tx.value?.toString() || '0',
                            txHash: tx.hash,
                            pnlUsd: pnlUsd,
                            isSmart: isSmart
                        });
                        alchemySeen.add(buyerAddr.toLowerCase());
                        if (earlyBuyersList.length >= limit) break;
                    }
                    console.log(`[TokenAnalysis] Identified ${earlyBuyersList.length} unique early buyers via Alchemy`);
                }
            }

            return earlyBuyersList;

        } catch (error) {
            console.error('[TokenAnalysis] Error fetching early buyers on EVM:', error);
            return [];
        }
    }
}

/**
 * Get top traders for a token based on their realized/unrealized PnL
 */
export async function getTopTraders(
    tokenAddress: string,
    chain: string,
    limit: number = 20
): Promise<any[]> {
    try {
        console.log(`[TokenAnalysis] Fetching top traders for ${tokenAddress} on ${chain}`);

        // 1. Fetch early buyers first (they are often top traders)
        const earlyBuyers = await getEarlyBuyers(tokenAddress, chain, limit * 2);

        // 2. Sort by PnL
        const sortedTraders = earlyBuyers
            .filter(b => b.pnlUsd > 0)
            .sort((a, b) => b.pnlUsd - a.pnlUsd)
            .slice(0, limit);

        return sortedTraders;
    } catch (error) {
        console.error('[TokenAnalysis] Error getting top traders:', error);
        return [];
    }
}
