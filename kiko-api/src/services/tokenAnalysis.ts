/**
 * Token Analysis Service
 * Handles complex token-level analytics like early buyers and top traders
 */

import * as rpcManager from './rpcManager.js';
import * as dexscreener from './dexscreener.js';
import * as alchemy from './alchemy.js';
import * as scanApi from './scanApi.js';
import { getSolanaTokenMetadata } from '../utils/solanaToken.js';
import pLimit from 'p-limit';
import { getEvmEarlyBuyerTransfers } from './evmEarlyBuyerProvider.js';

// Known contract patterns to filter out
const KNOWN_CONTRACTS = new Set([
    '0x0000000000000000000000000000000000000000',
    '0x000000000000000000000000000000000000dead',
]);

const CONTRACT_CACHE_TTL_MS = 10 * 60 * 1000;
const contractClassificationCache = new Map<string, { isContract: boolean; checkedAt: number }>();

type AssetTransferTimestampInput = {
    metadata?: { blockTimestamp?: string };
    blockNum?: string;
};

export function createAssetTransferTimestampResolver(
    chain: string,
    rpcCall: typeof rpcManager.callRpc = rpcManager.callRpc
): (transfer: AssetTransferTimestampInput) => Promise<Date | null> {
    const blockTimestampCache = new Map<number, Promise<Date | null>>();

    return async (transfer: AssetTransferTimestampInput): Promise<Date | null> => {
        if (transfer.metadata?.blockTimestamp) {
            const parsed = new Date(transfer.metadata.blockTimestamp);
            if (!Number.isNaN(parsed.getTime())) return parsed;
        }

        const rawBlockNum = String(transfer.blockNum || '');
        if (!rawBlockNum) return null;
        const blockNumber = rawBlockNum.startsWith('0x') ? parseInt(rawBlockNum, 16) : parseInt(rawBlockNum, 10);
        if (!Number.isFinite(blockNumber) || blockNumber <= 0) return null;

        let pending = blockTimestampCache.get(blockNumber);
        if (!pending) {
            pending = (async () => {
                try {
                    const blockHex = `0x${blockNumber.toString(16)}`;
                    const block = await rpcCall<any>(chain, 'eth_getBlockByNumber', [blockHex, false], {
                        strategy: 'cheap',
                    });
                    const tsHex = String(block?.timestamp || '0x0');
                    const timestampMs = Number(BigInt(tsHex)) * 1000;
                    return Number.isFinite(timestampMs) && timestampMs > 0 ? new Date(timestampMs) : null;
                } catch {
                    return null;
                }
            })();
            blockTimestampCache.set(blockNumber, pending);
        }

        return pending;
    };
}


/**
 * Check if an address is a contract (has code) or EOA (person wallet)
 */
async function isContract(address: string, chain: string): Promise<boolean> {
    if (!address) return false;
    const normalizedAddress = address.toLowerCase();
    if (KNOWN_CONTRACTS.has(normalizedAddress)) return true;

    const cacheKey = `${chain}:${normalizedAddress}`;
    const cached = contractClassificationCache.get(cacheKey);
    if (cached && Date.now() - cached.checkedAt < CONTRACT_CACHE_TTL_MS) {
        return cached.isContract;
    }

    try {
        const code = await rpcManager.callRpc<string>(chain, 'eth_getCode', [address, 'latest']);
        // EOA wallets have no code, so eth_getCode returns '0x'
        const isDetectedContract = code !== '0x' && code !== '0x0' && code.length > 2;
        contractClassificationCache.set(cacheKey, {
            isContract: isDetectedContract,
            checkedAt: Date.now(),
        });
        return isDetectedContract;
    } catch (e) {
        contractClassificationCache.set(cacheKey, {
            isContract: false,
            checkedAt: Date.now(),
        });
        return false; // If we can't check, assume it's not a contract
    }
}

export interface EarlyBuyer {
    address: string;
    timestamp: Date;
    amount: string;
    txHash: string;
    pnlUsd: number; // Token-level realized Profit/Loss for this wallet when available
    isSmart: boolean; // True if wallet is profitable on this token when available
    transferCount?: number;
    tradeProgression?: TradeProgressionSummary | null;
    tokenPnl?: EarlyBuyerTokenPnl | null;
}

export type EarlyBuyerTokenPnl = {
    source: 'dune' | 'manual';
    coverage: 'token_level_breakdown' | 'approx_manual';
    days: number;
    totalBuyUsd: number | null;
    totalSellUsd: number | null;
    realizedPnlUsd: number | null;
    unrealizedPnlUsd: number | null;
    profitPct: number | null;
    currentTokenAmount: string | null;
};

export type TradeProgressionRow = {
    txHash: string;
    txType: 'BUY' | 'SELL' | 'SWAP' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'APPROVE';
    timestamp: string;
    amount: string;
    tokenAddress: string | null;
    tokenSymbol: string | null;
};

export type TradeProgressionSummary = {
    totalTrades: number;
    buyCount: number;
    sellCount: number;
    firstTrade: TradeProgressionRow | null;
    firstBuy: TradeProgressionRow | null;
    firstSell: TradeProgressionRow | null;
    recentTrades: TradeProgressionRow[];
};

type TokenPnlDeps = {
    getWalletPnlFromDune: (walletAddress: string, chain: string, days: number) => Promise<any>;
    calculateWalletPnlManual: (
        walletAddress: string,
        chain: string,
        days: number | 'all',
        options?: {
            mode?: 'fast' | 'accurate';
            maxTransfers?: number;
            includeUnrealized?: boolean;
        }
    ) => Promise<any>;
};

async function defaultTokenPnlDeps(): Promise<TokenPnlDeps> {
    const dunePnlService = await import('./dunePnlService.js');
    const pnlCalculationService = await import('./pnlCalculationService.js');
    return {
        getWalletPnlFromDune: dunePnlService.getWalletPnlFromDune,
        calculateWalletPnlManual: pnlCalculationService.calculateWalletPnlManual,
    };
}

function toTradeProgressionRow(tx: {
    txHash: string;
    txType: alchemy.WalletTransaction['txType'];
    blockTimestamp: Date;
    amount: string;
    tokenAddress: string | null;
    tokenSymbol: string | null;
}): TradeProgressionRow {
    return {
        txHash: tx.txHash,
        txType: tx.txType,
        timestamp: tx.blockTimestamp.toISOString(),
        amount: tx.amount,
        tokenAddress: tx.tokenAddress,
        tokenSymbol: tx.tokenSymbol,
    };
}

export function summarizeWalletTokenTrades(
    transactions: Array<{
        txHash: string;
        txType: 'BUY' | 'SELL' | 'SWAP' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'APPROVE';
        blockTimestamp: Date;
        amount: string;
        tokenAddress: string | null;
        tokenSymbol: string | null;
    }>,
    tokenAddress: string
): TradeProgressionSummary | null {
    const normalizedToken = String(tokenAddress || '').toLowerCase();
    if (!normalizedToken) return null;

    const relevant = transactions
        .filter((tx) => String(tx.tokenAddress || '').toLowerCase() === normalizedToken)
        .sort((a, b) => a.blockTimestamp.getTime() - b.blockTimestamp.getTime());

    if (relevant.length === 0) return null;

    const firstTrade = relevant[0] || null;
    const firstBuy = relevant.find((tx) => tx.txType === 'BUY') || null;
    const firstSell = relevant.find((tx) => tx.txType === 'SELL') || null;
    const buyCount = relevant.filter((tx) => tx.txType === 'BUY').length;
    const sellCount = relevant.filter((tx) => tx.txType === 'SELL').length;

    return {
        totalTrades: relevant.length,
        buyCount,
        sellCount,
        firstTrade: firstTrade ? toTradeProgressionRow(firstTrade) : null,
        firstBuy: firstBuy ? toTradeProgressionRow(firstBuy) : null,
        firstSell: firstSell ? toTradeProgressionRow(firstSell) : null,
        recentTrades: relevant.slice(0, 10).map(toTradeProgressionRow),
    };
}

export async function resolveEarlyBuyerTokenPnl(
    walletAddress: string,
    tokenAddress: string,
    chain: string,
    days: number = 30,
    depsPromise: Promise<TokenPnlDeps> = defaultTokenPnlDeps()
): Promise<EarlyBuyerTokenPnl | null> {
    const normalizedToken = String(tokenAddress || '').toLowerCase();
    if (!walletAddress || !normalizedToken) return null;

    const deps = await depsPromise;

    try {
        const dune = await deps.getWalletPnlFromDune(walletAddress, chain, days);
        const duneToken = dune?.tokens?.find((token: any) => String(token.tokenAddress || '').toLowerCase() === normalizedToken);
        if (duneToken) {
            return {
                source: 'dune',
                coverage: 'token_level_breakdown',
                days,
                totalBuyUsd: Number.isFinite(Number(duneToken.boughtUsd)) ? Number(duneToken.boughtUsd) : null,
                totalSellUsd: Number.isFinite(Number(duneToken.soldUsd)) ? Number(duneToken.soldUsd) : null,
                realizedPnlUsd: Number.isFinite(Number(duneToken.pnlUsd)) ? Number(duneToken.pnlUsd) : null,
                unrealizedPnlUsd: null,
                profitPct: duneToken.profitPct !== null && Number.isFinite(Number(duneToken.profitPct))
                    ? Number(duneToken.profitPct)
                    : null,
                currentTokenAmount: null,
            };
        }
    } catch {
        // fall through
    }

    try {
        const manual = await deps.calculateWalletPnlManual(walletAddress, chain, days, {
            mode: 'accurate',
            maxTransfers: 5000,
            includeUnrealized: true,
        });
        const tokenBreakdown = manual?.tokenBreakdown || {};
        const tokenEntry = tokenBreakdown[normalizedToken]
            || Object.values(tokenBreakdown).find((entry: any) => String(entry?.address || '').toLowerCase() === normalizedToken);
        if (!tokenEntry) return null;

        const totalBuyUsd = Number.isFinite(Number(tokenEntry.totalBuyUsd)) ? Number(tokenEntry.totalBuyUsd) : null;
        const totalSellUsd = Number.isFinite(Number(tokenEntry.totalSellUsd)) ? Number(tokenEntry.totalSellUsd) : null;
        const realizedPnlUsd = Number.isFinite(Number(tokenEntry.realizedPnlUsd)) ? Number(tokenEntry.realizedPnlUsd) : null;
        const unrealizedPnlUsd = (
            Number.isFinite(Number(tokenEntry.lastPrice))
            && Number.isFinite(Number(tokenEntry.totalAmount))
            && Number.isFinite(Number(tokenEntry.totalCostUsd))
        )
            ? (Number(tokenEntry.totalAmount) * Number(tokenEntry.lastPrice)) - Number(tokenEntry.totalCostUsd)
            : null;
        const profitPct = totalBuyUsd && realizedPnlUsd !== null
            ? (realizedPnlUsd / totalBuyUsd) * 100
            : null;

        return {
            source: 'manual',
            coverage: 'approx_manual',
            days,
            totalBuyUsd,
            totalSellUsd,
            realizedPnlUsd,
            unrealizedPnlUsd,
            profitPct,
            currentTokenAmount: Number.isFinite(Number(tokenEntry.totalAmount))
                ? String(tokenEntry.totalAmount)
                : null,
        };
    } catch {
        return null;
    }
}

async function fetchWalletTokenTrades(
    wallet: string,
    chain: string,
    tokenAddress: string,
    limit: number
): Promise<Array<{
    txHash: string;
    txType: 'BUY' | 'SELL' | 'SWAP' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'APPROVE';
    blockTimestamp: Date;
    amount: string;
    tokenAddress: string | null;
    tokenSymbol: string | null;
}> > {
    const chainLower = chain.toLowerCase();
    if (chainLower === 'solana' || chainLower === 'sol') {
        const transactions = await alchemy.getWalletTransactions(wallet, { chain: 'solana', limit, source: 'early_buyers_trade_progression' });
        return transactions
            .filter((tx) => String(tx.tokenAddress || '').toLowerCase() === String(tokenAddress || '').toLowerCase())
            .map((tx) => ({
                txHash: tx.txHash,
                txType: tx.txType,
                blockTimestamp: tx.blockTimestamp,
                amount: tx.amount,
                tokenAddress: tx.tokenAddress,
                tokenSymbol: tx.tokenSymbol,
            }));
    }

    const txs = await scanApi.getEvmTokenTransfers(wallet, chainLower, 1, limit, {
        sort: 'asc',
        contractAddress: tokenAddress,
    });
    return txs.map((tx) => ({
        txHash: tx.txHash,
        txType: tx.txType,
        blockTimestamp: tx.blockTimestamp,
        amount: tx.amount,
        tokenAddress: tx.tokenAddress,
        tokenSymbol: tx.tokenSymbol,
    }));
}

/**
 * Get the earliest buyers of a token
 */
export async function getEarlyBuyers(
    tokenAddress: string,
    chain: string,
    limit: number = 10,
    options?: {
        includeTradeProgression?: boolean;
        includeTokenPnl?: boolean;
        tokenPnlDays?: number;
        tradeHistoryLimit?: number;
        startTimeMs?: number;
        endTimeMs?: number;
        minTokenAmount?: number;
        minTransferCount?: number;
        scanLimit?: number;
    }
): Promise<EarlyBuyer[]> {
    const chainLower = chain.toLowerCase();
    const isSolana = chainLower === 'solana' || chainLower === 'sol';
    const startTimeMs = options?.startTimeMs;
    const endTimeMs = options?.endTimeMs;
    const minTokenAmount = Number(options?.minTokenAmount || 0);
    const minTransferCount = Math.max(1, Number(options?.minTransferCount || 1));
    const includeTradeProgression = options?.includeTradeProgression !== false;
    const includeTokenPnl = options?.includeTokenPnl !== false && !isSolana;
    const tokenPnlDays = Math.max(1, Math.min(365, Number(options?.tokenPnlDays || 30)));
    const tradeHistoryLimit = Math.max(10, Math.min(100, Number(options?.tradeHistoryLimit || 25)));

    type BuyerAggregate = {
        address: string;
        timestamp: Date | null;
        sortKey: number;
        blockNumber: number | null;
        txHash: string;
        totalAmount: number;
        transferCount: number;
    };

    const normalizeCandidates = async (
        candidates: BuyerAggregate[],
        options?: {
            includeTradeProgression?: boolean;
            includeTokenPnl?: boolean;
            tokenPnlDays?: number;
            tradeHistoryLimit?: number;
        }
    ): Promise<EarlyBuyer[]> => {
        const includeTradeProgression = Boolean(options?.includeTradeProgression);
        const includeTokenPnl = Boolean(options?.includeTokenPnl);
        const tokenPnlDays = Math.max(1, Math.min(365, Number(options?.tokenPnlDays || 30)));
        const tradeHistoryLimit = Math.max(10, Math.min(100, Number(options?.tradeHistoryLimit || 25)));

        const ordered = candidates
            .filter(c =>
            Number.isFinite(c.totalAmount) &&
            c.totalAmount >= minTokenAmount &&
            c.transferCount >= minTransferCount
        )
            .sort((a, b) => a.sortKey - b.sortKey);

        const timestampLimiter = pLimit(8);
        const selected = ordered.slice(0, Math.max(1, limit * 2));
        await Promise.all(
            selected.map((candidate) =>
                timestampLimiter(async () => {
                    if (candidate.timestamp || !candidate.blockNumber) return;
                    const blockHex = `0x${candidate.blockNumber.toString(16)}`;
                    try {
                        const block = await rpcManager.callRpc<any>(chainLower, 'eth_getBlockByNumber', [blockHex, false], {
                            strategy: 'cheap',
                        });
                        const tsHex = String(block?.timestamp || '0x0');
                        const timestampMs = Number(BigInt(tsHex)) * 1000;
                        candidate.timestamp = Number.isFinite(timestampMs) && timestampMs > 0 ? new Date(timestampMs) : null;
                    } catch {
                        candidate.timestamp = null;
                    }
                })
            )
        );

        const mapped = selected
            .filter((candidate) => candidate.timestamp)
            .map((c) => {
            return {
                address: c.address,
                timestamp: c.timestamp!,
                amount: c.totalAmount.toString(),
                txHash: c.txHash,
                pnlUsd: 0,
                isSmart: false,
                transferCount: c.transferCount,
            } as EarlyBuyer;
        });

        const mappedFiltered = mapped;

        if ((includeTradeProgression || includeTokenPnl) && mappedFiltered.length > 0) {
            const limiter = pLimit(includeTokenPnl ? 2 : 3);
            await Promise.all(
                mappedFiltered.map(item =>
                    limiter(async () => {
                        if (includeTradeProgression) {
                            try {
                                const trades = await fetchWalletTokenTrades(item.address, chainLower, tokenAddress, tradeHistoryLimit);
                                const progression = summarizeWalletTokenTrades(trades, tokenAddress);
                                item.tradeProgression = progression;
                            } catch {
                                item.tradeProgression = null;
                            }
                        }
                        if (includeTokenPnl) {
                            item.tokenPnl = await resolveEarlyBuyerTokenPnl(item.address, tokenAddress, chainLower, tokenPnlDays);
                            if (item.tokenPnl?.realizedPnlUsd !== null && item.tokenPnl?.realizedPnlUsd !== undefined) {
                                item.pnlUsd = item.tokenPnl.realizedPnlUsd;
                                item.isSmart = item.tokenPnl.realizedPnlUsd > 0;
                            }
                        }
                    })
                )
            );
        }

        mappedFiltered.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        return mappedFiltered.slice(0, Math.max(1, limit));
    };

    const isWithinRange = (ts: Date) => {
        const ms = ts.getTime();
        if (startTimeMs && ms < startTimeMs) return false;
        if (endTimeMs && ms > endTimeMs) return false;
        return true;
    };

    const resolveTimestampFromAssetTransfer = createAssetTransferTimestampResolver(chainLower);

    if (isSolana) {
        console.log(`[TokenAnalysis] Fetching early buyers for Solana mint: ${tokenAddress}`);
        try {
            // Import solscan dynamically
            const solscan = await import('./solscan.js');
            const result = await solscan.getTokenTransfers(tokenAddress, 100, 'asc');

            const aggregates = new Map<string, BuyerAggregate>();

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
                            sortKey: ts.getTime(),
                            blockNumber: null,
                            txHash: transfer.tx_hash,
                            totalAmount: tokenAmount,
                            transferCount: 1,
                        });
                    } else {
                        existing.totalAmount += tokenAmount;
                        existing.transferCount += 1;
                        if (!existing.timestamp || ts.getTime() < existing.timestamp.getTime()) {
                            existing.timestamp = ts;
                            existing.sortKey = ts.getTime();
                            existing.txHash = transfer.tx_hash;
                        }
                    }
                }
            }
            return await normalizeCandidates(Array.from(aggregates.values()), {
                includeTradeProgression,
                includeTokenPnl,
                tokenPnlDays,
                tradeHistoryLimit,
            });
        } catch (error) {
            console.error('[TokenAnalysis] Error fetching early buyers on Solana:', error);
            return [];
        }
    }
    else {
        console.log(`[TokenAnalysis] Fetching early buyers for EVM token: ${tokenAddress} on ${chainLower}`);
        try {
            const analysisLimit = Math.max(
                50,
                Math.min(250, Number(options?.scanLimit || Math.max(limit * 4, 80)))
            );
            const providerResult = await getEvmEarlyBuyerTransfers(tokenAddress, chainLower, {
                limit: analysisLimit,
                startTimeMs,
                endTimeMs,
            });
            const evmTransfers = providerResult.transfers;
            if (!evmTransfers || evmTransfers.length === 0) {
                return [];
            }

            const aggregates = new Map<string, BuyerAggregate>();
            const sortedTransfers = [...evmTransfers].sort((a, b) => {
                const aBlock = String(a.blockNum || '');
                const bBlock = String(b.blockNum || '');
                const aBlockNum = aBlock ? (aBlock.startsWith('0x') ? parseInt(aBlock, 16) : parseInt(aBlock, 10)) : Number.MAX_SAFE_INTEGER;
                const bBlockNum = bBlock ? (bBlock.startsWith('0x') ? parseInt(bBlock, 16) : parseInt(bBlock, 10)) : Number.MAX_SAFE_INTEGER;
                if (aBlockNum !== bBlockNum) return aBlockNum - bBlockNum;
                const aTs = a.metadata?.blockTimestamp ? new Date(a.metadata.blockTimestamp).getTime() : Number.MAX_SAFE_INTEGER;
                const bTs = b.metadata?.blockTimestamp ? new Date(b.metadata.blockTimestamp).getTime() : Number.MAX_SAFE_INTEGER;
                return aTs - bTs;
            });
            const needsPreciseRangeFilter = Boolean(startTimeMs || endTimeMs);
            const prepared = await Promise.all(sortedTransfers.map(async (tx) => {
                const buyerAddr = String(tx.to || '').trim();
                if (!buyerAddr) return null;
                if (buyerAddr.toLowerCase() === tokenAddress.toLowerCase()) return null;

                const amount = Number(tx.value || 0);
                if (!Number.isFinite(amount) || amount <= 0) return null;

                const rawBlockNum = String(tx.blockNum || '');
                const blockNumber = rawBlockNum
                    ? (rawBlockNum.startsWith('0x') ? parseInt(rawBlockNum, 16) : parseInt(rawBlockNum, 10))
                    : null;
                const timestamp = tx.metadata?.blockTimestamp
                    ? new Date(tx.metadata.blockTimestamp)
                    : null;

                if (needsPreciseRangeFilter) {
                    const resolvedTimestamp = timestamp && !Number.isNaN(timestamp.getTime())
                        ? timestamp
                        : await resolveTimestampFromAssetTransfer(tx);
                    if (!resolvedTimestamp || !isWithinRange(resolvedTimestamp)) return null;
                    return {
                        buyerAddr,
                        buyerKey: buyerAddr.toLowerCase(),
                        timestamp: resolvedTimestamp,
                        sortKey: resolvedTimestamp.getTime(),
                        blockNumber,
                        txHash: String(tx.hash || ''),
                        amount,
                    };
                }

                if (timestamp && !Number.isNaN(timestamp.getTime()) && !isWithinRange(timestamp)) return null;

                return {
                    buyerAddr,
                    buyerKey: buyerAddr.toLowerCase(),
                    timestamp: timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp : null,
                    sortKey: blockNumber ?? Number.MAX_SAFE_INTEGER,
                    blockNumber,
                    txHash: String(tx.hash || ''),
                    amount,
                };
            }));

            for (const item of prepared) {
                if (!item) continue;
                const existing = aggregates.get(item.buyerKey);
                if (!existing) {
                    aggregates.set(item.buyerKey, {
                        address: item.buyerAddr,
                        timestamp: item.timestamp,
                        sortKey: item.sortKey,
                        blockNumber: item.blockNumber,
                        txHash: item.txHash,
                        totalAmount: item.amount,
                        transferCount: 1,
                    });
                } else {
                    existing.totalAmount += item.amount;
                    existing.transferCount += 1;
                    if (item.sortKey < existing.sortKey) {
                        existing.timestamp = item.timestamp;
                        existing.sortKey = item.sortKey;
                        existing.blockNumber = item.blockNumber;
                        existing.txHash = item.txHash;
                    }
                }
            }

            const orderedCandidates = Array.from(aggregates.values()).sort((a, b) => a.sortKey - b.sortKey);
            const contractScanCandidates = orderedCandidates.slice(0, Math.min(orderedCandidates.length, Math.max(limit * 3, 80)));
            const contractLimiter = pLimit(8);
            const contractCache = new Map<string, boolean>();
            await Promise.all(
                contractScanCandidates.map((candidate) =>
                    contractLimiter(async () => {
                        const buyerKey = candidate.address.toLowerCase();
                        const contractState = await isContract(candidate.address, chainLower);
                        contractCache.set(buyerKey, contractState);
                    })
                )
            );

            const filteredCandidates = contractScanCandidates.filter((candidate) => !contractCache.get(candidate.address.toLowerCase()));

            return await normalizeCandidates(filteredCandidates, {
                includeTradeProgression,
                includeTokenPnl,
                tokenPnlDays,
                tradeHistoryLimit,
            });

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

export const __testOnly = {
    createAssetTransferTimestampResolver,
};
