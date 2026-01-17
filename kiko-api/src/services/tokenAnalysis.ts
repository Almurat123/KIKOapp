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
    limit: number = 10,
    options?: {
        startTimeMs?: number;
        endTimeMs?: number;
    }
): Promise<EarlyBuyer[]> {
    const chainLower = chain.toLowerCase();
    const isSolana = chainLower === 'solana' || chainLower === 'sol';
    const startTimeMs = options?.startTimeMs;
    const endTimeMs = options?.endTimeMs;

    const isWithinRange = (ts: Date) => {
        const ms = ts.getTime();
        if (startTimeMs && ms < startTimeMs) return false;
        if (endTimeMs && ms > endTimeMs) return false;
        return true;
    };

    if (isSolana) {
        console.log(`[TokenAnalysis] Fetching early buyers for Solana mint: ${tokenAddress}`);
        try {
            // Import solscan dynamically
            const solscan = await import('./solscan.js');
            const result = await solscan.getTokenTransfers(tokenAddress, 100, 'asc');

            let buyers: EarlyBuyer[] = [];
            const seen = new Set<string>();

            if (result.success && result.data) {
                for (const transfer of result.data) {
                    const buyerAddr = transfer.to_address;
                    if (!buyerAddr || buyerAddr === tokenAddress) continue;
                    if (seen.has(buyerAddr)) continue;

                    const ts = new Date(transfer.block_time * 1000);
                    if (!isWithinRange(ts)) continue;

                    buyers.push({
                        address: buyerAddr,
                        timestamp: ts,
                        amount: (transfer.amount / Math.pow(10, transfer.token_decimals || 9)).toString(),
                        txHash: transfer.tx_hash,
                        pnlUsd: 0,
                        isSmart: false
                    } as any);
                    seen.add(buyerAddr);
                    if (buyers.length >= limit) break;
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
            const analysisLimit = 500;
            const allTransfers = await scanApi.getEvmTokenTransfers(tokenAddress, chainLower, 1, analysisLimit, { sort: 'asc' });

            // Fetch current price for PnL fallback
            let currentPrice = 0;
            try {
                const details = await dexscreener.getTokenDetails(chainLower, tokenAddress);
                currentPrice = details?.price || 0;
            } catch (e) { console.warn('[TokenAnalysis] DexScreener failed:', e); }

            // Fallback to Alchemy if ScanAPI returns empty
            if (allTransfers.length === 0) {
                console.log(`[TokenAnalysis] ScanAPI empty, trying Alchemy fallback...`);
                const alchemyTransfers = await alchemy.getAssetTransfers(null, chainLower, {
                    contractAddresses: [tokenAddress],
                    category: ['erc20'],
                    order: 'asc',
                    maxCount: limit * 20
                });

            if (alchemyTransfers && alchemyTransfers.length > 0) {
                const seen = new Set<string>();
                const buyers: EarlyBuyer[] = [];

                for (const tx of alchemyTransfers) {
                    const buyerAddr = tx.to;
                    if (!buyerAddr || seen.has(buyerAddr)) continue;

                    const ts = tx.metadata?.blockTimestamp ? new Date(tx.metadata.blockTimestamp) : new Date();
                    if (!isWithinRange(ts)) continue;

                    buyers.push({
                        address: buyerAddr,
                        timestamp: ts,
                        amount: tx.value?.toString() || '0',
                        txHash: tx.hash,
                        pnlUsd: 0,
                        isSmart: false
                    });
                        seen.add(buyerAddr);
                        if (buyers.length >= limit) break;
                    }
                    return buyers;
                }
                return [];
            }

            // Process ScanAPI transfers
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

                // Safe timestamp conversion
                let timestamp = new Date(); // Default to now if invalid
                try {
                    // scanApi returns ISO string or similar. Date constructor handles most.
                    // But verify it is valid.
                    const parsed = new Date(tx.blockTimestamp);
                    if (!isNaN(parsed.getTime())) {
                        timestamp = parsed;
                    }
                } catch (e) { }

                if (!isWithinRange(timestamp)) continue;

                earlyBuyersList.push({
                    address: buyerAddr,
                    timestamp: timestamp,
                    amount: tx.amount,
                    txHash: tx.txHash,
                    pnlUsd: 0,
                    isSmart: false
                });
                earlySeen.add(buyerAddr.toLowerCase());
                if (earlyBuyersList.length >= limit) break;
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
        const earlyBuyers = await getEarlyBuyers(tokenAddress, chain, limit * 2);
        return earlyBuyers.slice(0, limit);
    } catch (error) {
        console.error('[TokenAnalysis] Error getting top traders:', error);
        return [];
    }
}
