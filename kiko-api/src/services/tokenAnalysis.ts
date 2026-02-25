/**
 * Token Analysis Service
 * Handles complex token-level analytics like early buyers and top traders
 */

import * as scanApi from './scanApi.js';
import * as helius from './helius.js';
import * as alchemy from './alchemy.js';
import * as rpcManager from './rpcManager.js';
import * as dexscreener from './dexscreener.js';
import { getSolanaTokenMetadata } from '../utils/solanaToken.js';
import * as geckoTerminal from './geckoTerminal.js';
import { WalletTransaction } from './alchemy.js';
import pLimit from 'p-limit';

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
    transferCount?: number;
    estimatedBuyUsd?: number | null;
    walletTxCount?: number | null;
    qualityScore?: number;
    qualityTier?: 'whale' | 'high' | 'mid' | 'small';
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
        minTokenAmount?: number;
        minBuyUsd?: number;
        minWalletTxCount?: number;
        minTransferCount?: number;
        scanLimit?: number;
        qualitySort?: 'first_seen' | 'buy_usd_desc' | 'quality_desc';
    }
): Promise<EarlyBuyer[]> {
    const chainLower = chain.toLowerCase();
    const isSolana = chainLower === 'solana' || chainLower === 'sol';
    const startTimeMs = options?.startTimeMs;
    const endTimeMs = options?.endTimeMs;
    const minTokenAmount = Number(options?.minTokenAmount || 0);
    const minBuyUsd = Number.isFinite(Number(options?.minBuyUsd)) ? Number(options?.minBuyUsd) : undefined;
    const minWalletTxCount = Number.isFinite(Number(options?.minWalletTxCount)) ? Number(options?.minWalletTxCount) : undefined;
    const minTransferCount = Math.max(1, Number(options?.minTransferCount || 1));
    const qualitySort = options?.qualitySort || 'first_seen';
    const walletTxCountCache = new Map<string, number | null>();

    type BuyerAggregate = {
        address: string;
        timestamp: Date;
        txHash: string;
        totalAmount: number;
        transferCount: number;
    };

    const computeQualityScore = (estimatedBuyUsd: number | null, totalAmount: number, transferCount: number): number => {
        const usdSignal = estimatedBuyUsd !== null && estimatedBuyUsd > 0 ? Math.log10(estimatedBuyUsd + 1) * 40 : 0;
        const amountSignal = totalAmount > 0 ? Math.log10(totalAmount + 1) * 20 : 0;
        const transferSignal = Math.min(transferCount, 8) * 5;
        return Number((usdSignal + amountSignal + transferSignal).toFixed(2));
    };

    const qualityTier = (estimatedBuyUsd: number | null, totalAmount: number): 'whale' | 'high' | 'mid' | 'small' => {
        if (estimatedBuyUsd !== null) {
            if (estimatedBuyUsd >= 50_000) return 'whale';
            if (estimatedBuyUsd >= 10_000) return 'high';
            if (estimatedBuyUsd >= 1_000) return 'mid';
            return 'small';
        }
        if (totalAmount >= 1_000_000) return 'whale';
        if (totalAmount >= 100_000) return 'high';
        if (totalAmount >= 10_000) return 'mid';
        return 'small';
    };

    const fetchWalletTxCount = async (address: string): Promise<number | null> => {
        const key = address.toLowerCase();
        if (walletTxCountCache.has(key)) {
            return walletTxCountCache.get(key) ?? null;
        }
        try {
            const nonceHex = await rpcManager.callRpc<string>(chainLower, 'eth_getTransactionCount', [address, 'latest'], {
                strategy: 'cheap',
            });
            const txCount = Number(BigInt(String(nonceHex || '0x0')));
            const normalized = Number.isFinite(txCount) ? txCount : null;
            walletTxCountCache.set(key, normalized);
            return normalized;
        } catch {
            walletTxCountCache.set(key, null);
            return null;
        }
    };

    const normalizeCandidates = async (
        candidates: BuyerAggregate[],
        currentPriceUsd: number | null
    ): Promise<EarlyBuyer[]> => {
        let filtered = candidates.filter(c =>
            Number.isFinite(c.totalAmount) &&
            c.totalAmount >= minTokenAmount &&
            c.transferCount >= minTransferCount
        );

        if (typeof minBuyUsd === 'number' && minBuyUsd > 0) {
            filtered = filtered.filter(c => {
                if (currentPriceUsd === null || currentPriceUsd <= 0) return true;
                return c.totalAmount * currentPriceUsd >= minBuyUsd;
            });
        }

        const mapped = filtered.map(c => {
            const estimatedBuyUsd = currentPriceUsd !== null && currentPriceUsd > 0
                ? c.totalAmount * currentPriceUsd
                : null;
            const score = computeQualityScore(estimatedBuyUsd, c.totalAmount, c.transferCount);

            return {
                address: c.address,
                timestamp: c.timestamp,
                amount: c.totalAmount.toString(),
                txHash: c.txHash,
                pnlUsd: 0,
                isSmart: false,
                transferCount: c.transferCount,
                estimatedBuyUsd,
                walletTxCount: null,
                qualityScore: score,
                qualityTier: qualityTier(estimatedBuyUsd, c.totalAmount),
            } as EarlyBuyer;
        });

        if (!isSolana && typeof minWalletTxCount === 'number' && minWalletTxCount > 0 && mapped.length > 0) {
            const limiter = pLimit(4);
            await Promise.all(
                mapped.map(item =>
                    limiter(async () => {
                        item.walletTxCount = await fetchWalletTxCount(item.address);
                    })
                )
            );
        }

        const mappedFiltered = (!isSolana && typeof minWalletTxCount === 'number' && minWalletTxCount > 0)
            ? mapped.filter(item => (item.walletTxCount ?? Number.MAX_SAFE_INTEGER) >= minWalletTxCount)
            : mapped;

        if (qualitySort === 'buy_usd_desc') {
            mappedFiltered.sort((a, b) => {
                const aUsd = a.estimatedBuyUsd || 0;
                const bUsd = b.estimatedBuyUsd || 0;
                if (bUsd !== aUsd) return bUsd - aUsd;
                return a.timestamp.getTime() - b.timestamp.getTime();
            });
        } else if (qualitySort === 'quality_desc') {
            mappedFiltered.sort((a, b) => {
                const aScore = a.qualityScore || 0;
                const bScore = b.qualityScore || 0;
                if (bScore !== aScore) return bScore - aScore;
                return a.timestamp.getTime() - b.timestamp.getTime();
            });
        } else {
            mappedFiltered.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        }

        return mappedFiltered.slice(0, Math.max(1, limit));
    };

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

            const aggregates = new Map<string, BuyerAggregate>();

            let currentPriceUsd: number | null = null;
            try {
                const details = await dexscreener.getTokenDetails('solana', tokenAddress);
                if (details && Number.isFinite(details.price) && details.price > 0) {
                    currentPriceUsd = details.price;
                }
            } catch { }

            let fallbackDecimals: number | null = null;
            if (result.success && result.data && result.data.length > 0) {
                if (result.data[0].token_decimals === undefined || result.data[0].token_decimals === null) {
                    const meta = await getSolanaTokenMetadata(tokenAddress);
                    fallbackDecimals = meta?.decimals ?? 9;
                }
            }

            if (result.success && result.data) {
                for (const transfer of result.data) {
                    const buyerAddr = String(transfer.to_address || '').trim();
                    if (!buyerAddr || buyerAddr === tokenAddress) continue;

                    const ts = new Date(transfer.block_time * 1000);
                    if (!isWithinRange(ts)) continue;

                    const decimals = transfer.token_decimals ?? fallbackDecimals ?? 9;
                    const tokenAmount = Number(transfer.amount) / Math.pow(10, decimals);
                    if (!Number.isFinite(tokenAmount) || tokenAmount <= 0) continue;

                    const key = buyerAddr;
                    const existing = aggregates.get(key);
                    if (!existing) {
                        aggregates.set(key, {
                            address: buyerAddr,
                            timestamp: ts,
                            txHash: transfer.tx_hash,
                            totalAmount: tokenAmount,
                            transferCount: 1,
                        });
                    } else {
                        existing.totalAmount += tokenAmount;
                        existing.transferCount += 1;
                        if (ts.getTime() < existing.timestamp.getTime()) {
                            existing.timestamp = ts;
                            existing.txHash = transfer.tx_hash;
                        }
                    }
                }
            }
            return await normalizeCandidates(Array.from(aggregates.values()), currentPriceUsd);
        } catch (error) {
            console.error('[TokenAnalysis] Error fetching early buyers on Solana:', error);
            return [];
        }
    }
    else {
        console.log(`[TokenAnalysis] Fetching early buyers for EVM token: ${tokenAddress} on ${chainLower}`);
        try {
            const analysisLimit = Math.max(
                200,
                Math.min(3000, Number(options?.scanLimit || Math.max(limit * 25, 500)))
            );
            const allTransfers = await scanApi.getEvmTokenTransfers(tokenAddress, chainLower, 1, analysisLimit, { sort: 'asc' });

            // Fetch current token price for rough wallet quality filtering.
            let currentPriceUsd: number | null = null;
            try {
                const details = await dexscreener.getTokenDetails(chainLower, tokenAddress);
                if (details && Number.isFinite(details.price) && details.price > 0) {
                    currentPriceUsd = details.price;
                }
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
                    const aggregates = new Map<string, BuyerAggregate>();

                    for (const tx of alchemyTransfers) {
                        const buyerAddr = String(tx.to || '').trim();
                        if (!buyerAddr) continue;

                        const ts = tx.metadata?.blockTimestamp ? new Date(tx.metadata.blockTimestamp) : new Date();
                        if (!isWithinRange(ts)) continue;

                        const amount = Number(tx.value || 0);
                        if (!Number.isFinite(amount) || amount <= 0) continue;

                        const key = buyerAddr.toLowerCase();
                        const existing = aggregates.get(key);
                        if (!existing) {
                            aggregates.set(key, {
                                address: buyerAddr,
                                timestamp: ts,
                                txHash: tx.hash,
                                totalAmount: amount,
                                transferCount: 1,
                            });
                        } else {
                            existing.totalAmount += amount;
                            existing.transferCount += 1;
                            if (ts.getTime() < existing.timestamp.getTime()) {
                                existing.timestamp = ts;
                                existing.txHash = tx.hash;
                            }
                        }
                    }
                    return await normalizeCandidates(Array.from(aggregates.values()), currentPriceUsd);
                }
                return [];
            }

            // Process ScanAPI transfers
            const contractCache = new Map<string, boolean>();
            const aggregates = new Map<string, BuyerAggregate>();
            const sortedTransfers = [...allTransfers].sort((a: any, b: any) => {
                const aTs = new Date((a as any).blockTimestamp).getTime();
                const bTs = new Date((b as any).blockTimestamp).getTime();
                return aTs - bTs;
            });

            for (const tx of sortedTransfers) {
                const buyerAddr = tx.toAddress;
                // Basic filters
                if (!buyerAddr) continue;
                if (buyerAddr.toLowerCase() === tokenAddress.toLowerCase()) continue;

                // Contract check
                const buyerKey = buyerAddr.toLowerCase();
                let isContractAddr = contractCache.get(buyerKey);
                if (typeof isContractAddr !== 'boolean') {
                    isContractAddr = await isContract(buyerAddr, chainLower);
                    contractCache.set(buyerKey, isContractAddr);
                }
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

                const amount = Number(tx.amount || 0);
                if (!Number.isFinite(amount) || amount <= 0) continue;

                const existing = aggregates.get(buyerKey);
                if (!existing) {
                    aggregates.set(buyerKey, {
                        address: buyerAddr,
                        timestamp,
                        txHash: tx.txHash,
                        totalAmount: amount,
                        transferCount: 1,
                    });
                } else {
                    existing.totalAmount += amount;
                    existing.transferCount += 1;
                    if (timestamp.getTime() < existing.timestamp.getTime()) {
                        existing.timestamp = timestamp;
                        existing.txHash = tx.txHash;
                    }
                }
            }

            return await normalizeCandidates(Array.from(aggregates.values()), currentPriceUsd);

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
