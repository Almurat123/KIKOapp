/**
 * Moralis API Service
 * Provides wallet PNL analysis using Moralis Web3 Data API
 * 
 * API Reference: 
 * - https://docs.moralis.com/web3-data-api/evm/reference/wallet-api/get-wallet-profitability
 * - https://docs.moralis.com/web3-data-api/evm/reference/wallet-api/get-wallet-profitability-summary
 */

import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import * as unifiedApiService from '../config/unifiedApiService.js';

const MORALIS_API_KEY = process.env.MORALIS_API_KEY || '';
const MORALIS_BASE_URL = 'https://deep-index.moralis.io/api/v2.2';

const CHAIN_MAPPING: Record<number, string> = {
    1: 'eth',
    56: 'bsc',
    137: 'polygon',
    42161: 'arbitrum',
    10: 'optimism',
    8453: 'base',
    250: 'fantom',
    43114: 'avalanche',
};

// Chains supported by Moralis's PROFITABILITY API specifically
const MORALIS_PROFITABILITY_SUPPORTED_CHAINS = new Set([1, 137, 8453]);

export interface ProfitabilitySummary {
    totalCountOfTrades: number;
    totalTradeValue: number;
    totalRealizedProfitUsd: number;
    totalRealizedProfitPercentage: number;
    totalBuys: number;
    totalSells: number;
    totalSoldValueUsd: number;
    totalBoughtValueUsd: number;
}

export interface TokenProfitability {
    tokenAddress: string;
    tokenSymbol: string;
    tokenName: string;
    tokenLogo?: string;
    tokenDecimals: number;
    avgCostOfQuantitySold: number;
    avgSellPrice: number;
    countOfTrades: number;
    realizedProfitUsd: number;
    realizedProfitPercentage: number;
    totalTokensBought: string;
    totalTokensSold: string;
    totalBuyValueUsd: number;
    totalSellValueUsd: number;
}

export interface WalletProfitabilityResponse {
    result: TokenProfitability[];
}

export interface WalletPnlSummary {
    address: string;
    chainId: number;
    days: number | 'all';
    totalRealizedPnlUsd: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    avgProfitPerTrade: number;
    tokens: TokenProfitability[];
}

export interface TokenTopGainer {
    address: string;
    avgBuyPriceUsd: number;
    avgSellPriceUsd: number;
    totalTokensBought: string;
    totalUsdInvested: number;
    totalTokensSold: string;
    totalSoldUsd: number;
    avgCostOfQuantitySold: number;
    countOfTrades: number;
    realizedProfitUsd: number;
    realizedProfitPercentage: number;
}

export interface TokenTopGainersOptions {
    days?: number;
    limit?: number;
    fallbackToAllTime?: boolean;
}

export interface TokenTopGainersSummary {
    tokenAddress: string;
    tokenName: string;
    tokenSymbol: string;
    tokenDecimals: number;
    tokenLogo?: string;
    possibleSpam: boolean;
    chain: string;
    chainId: number;
    requestedDays: number | null;
    appliedDays: number | null;
    usedAllTimeFallback: boolean;
    wallets: TokenTopGainer[];
}

interface MoralisTokenTopGainersRow {
    address?: string;
    avg_buy_price_usd?: string | number;
    avg_sell_price_usd?: string | number;
    total_tokens_bought?: string;
    total_usd_invested?: string | number;
    total_tokens_sold?: string;
    total_sold_usd?: string | number;
    avg_cost_of_quantity_sold?: string | number;
    count_of_trades?: number;
    realized_profit_usd?: string | number;
    realized_profit_percentage?: string | number;
}

interface MoralisTokenTopGainersResponse {
    name?: string;
    symbol?: string;
    decimals?: string | number;
    logo?: string;
    possible_spam?: boolean;
    result?: MoralisTokenTopGainersRow[];
}

const CHAIN_SLUG_TO_ID: Record<string, number> = Object.entries(CHAIN_MAPPING)
    .reduce((acc, [chainId, chain]) => {
        acc[chain] = Number(chainId);
        return acc;
    }, {} as Record<string, number>);

function safeParseNumber(value: unknown): number {
    if (value === null || value === undefined) return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDays(days?: number): number | undefined {
    if (days === null || days === undefined) return undefined;
    const value = Math.trunc(Number(days));
    if (!Number.isFinite(value) || value <= 0) return undefined;
    return Math.min(3650, value);
}

function resolveMoralisChain(chainOrId: string | number): { chain: string; chainId: number } | null {
    if (typeof chainOrId === 'number' && Number.isFinite(chainOrId)) {
        const chainId = Math.trunc(chainOrId);
        const chain = CHAIN_MAPPING[chainId];
        if (!chain) return null;
        return { chain, chainId };
    }

    const raw = String(chainOrId || '').trim().toLowerCase();
    if (!raw) return null;

    const aliases: Record<string, string> = {
        ethereum: 'eth',
        bnb: 'bsc',
        matic: 'polygon',
        arb: 'arbitrum',
        op: 'optimism',
        avax: 'avalanche',
    };
    const normalized = aliases[raw] || raw;
    const chainId = CHAIN_SLUG_TO_ID[normalized];
    if (!chainId) return null;
    return { chain: normalized, chainId };
}

function mapTopGainerRow(row: MoralisTokenTopGainersRow): TokenTopGainer {
    return {
        address: String(row.address || '').toLowerCase(),
        avgBuyPriceUsd: safeParseNumber(row.avg_buy_price_usd),
        avgSellPriceUsd: safeParseNumber(row.avg_sell_price_usd),
        totalTokensBought: String(row.total_tokens_bought || '0'),
        totalUsdInvested: safeParseNumber(row.total_usd_invested),
        totalTokensSold: String(row.total_tokens_sold || '0'),
        totalSoldUsd: safeParseNumber(row.total_sold_usd),
        avgCostOfQuantitySold: safeParseNumber(row.avg_cost_of_quantity_sold),
        countOfTrades: Number.isFinite(Number(row.count_of_trades)) ? Number(row.count_of_trades) : 0,
        realizedProfitUsd: safeParseNumber(row.realized_profit_usd),
        realizedProfitPercentage: safeParseNumber(row.realized_profit_percentage),
    };
}

async function fetchTokenTopGainers(
    tokenAddress: string,
    chain: string,
    days?: number
): Promise<MoralisTokenTopGainersResponse> {
    const params = new URLSearchParams({ chain });
    if (days !== undefined) params.set('days', String(days));

    const url = `${MORALIS_BASE_URL}/erc20/${tokenAddress}/top-gainers?${params.toString()}`;
    return unifiedApiService.fetchJson<MoralisTokenTopGainersResponse>({
        url,
        headers: { 'X-API-Key': MORALIS_API_KEY },
        timeout: 30000,
        retry: { retries: 2 },
        endpointName: 'moralis.io'
    });
}

/**
 * Get top profitable wallets for a specific token via Moralis Token API.
 * Docs: https://docs.moralis.com/web3-data-api/evm/reference/token-api/get-top-profitable-wallet-per-token
 */
export async function getTokenTopProfitableWallets(
    tokenAddress: string,
    chainOrId: string | number,
    options: TokenTopGainersOptions = {}
): Promise<TokenTopGainersSummary | null> {
    if (!MORALIS_API_KEY) {
        logger.error(LogCode.SYS_ERROR, 'Moralis API key not configured');
        return null;
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
        logger.warn(LogCode.API_FETCH_FAILED, 'Invalid token address for Moralis top-gainers', { tokenAddress });
        return null;
    }

    const chainResolved = resolveMoralisChain(chainOrId);
    if (!chainResolved) {
        logger.warn(LogCode.API_FETCH_FAILED, 'Unsupported chain for Moralis top-gainers', { chainOrId });
        return null;
    }

    const limit = Math.max(1, Math.min(100, Math.trunc(Number(options.limit ?? 50) || 50)));
    const requestedDays = normalizeDays(options.days);
    const fallbackToAllTime = options.fallbackToAllTime !== false;

    try {
        logger.debug(LogCode.API_FETCH_SUCCESS, 'Fetching token top-gainers', {
            tokenAddress: tokenAddress.slice(0, 10),
            chain: chainResolved.chain,
            requestedDays,
            limit
        });

        let data = await fetchTokenTopGainers(tokenAddress, chainResolved.chain, requestedDays);
        let appliedDays: number | null = requestedDays ?? null;
        let usedAllTimeFallback = false;
        let wallets = (data.result || []).map(mapTopGainerRow);

        if (wallets.length === 0 && requestedDays !== undefined && fallbackToAllTime) {
            data = await fetchTokenTopGainers(tokenAddress, chainResolved.chain);
            wallets = (data.result || []).map(mapTopGainerRow);
            appliedDays = null;
            usedAllTimeFallback = true;
        }

        wallets.sort((a, b) => {
            if (b.realizedProfitUsd !== a.realizedProfitUsd) {
                return b.realizedProfitUsd - a.realizedProfitUsd;
            }
            if (b.countOfTrades !== a.countOfTrades) {
                return b.countOfTrades - a.countOfTrades;
            }
            return b.totalSoldUsd - a.totalSoldUsd;
        });

        return {
            tokenAddress: tokenAddress.toLowerCase(),
            tokenName: String(data.name || ''),
            tokenSymbol: String(data.symbol || ''),
            tokenDecimals: Math.max(0, Math.trunc(safeParseNumber(data.decimals))),
            tokenLogo: data.logo,
            possibleSpam: Boolean(data.possible_spam),
            chain: chainResolved.chain,
            chainId: chainResolved.chainId,
            requestedDays: requestedDays ?? null,
            appliedDays,
            usedAllTimeFallback,
            wallets: wallets.slice(0, limit),
        };
    } catch (error: any) {
        logger.error(LogCode.API_FETCH_FAILED, 'Error fetching Moralis token top-gainers', {
            tokenAddress,
            chain: chainResolved.chain,
            error: error?.message || String(error)
        });
        return null;
    }
}

/**
 * Get wallet profitability from Moralis API
 * Returns PNL breakdown by token
 */
export async function getWalletProfitability(
    walletAddress: string,
    chainId: number,
    days: 7 | 30 | 60 | 90 | 'all' = 'all'
): Promise<WalletPnlSummary | null> {
    if (!MORALIS_API_KEY) {
        logger.error(LogCode.SYS_ERROR, 'Moralis API key not configured');
        return null;
    }

    const chain = CHAIN_MAPPING[chainId];
    if (!chain) {
        logger.warn(LogCode.API_FETCH_FAILED, 'Unsupported chain for Moralis', { chainId });
        return null;
    }

    try {
        const url = `${MORALIS_BASE_URL}/wallets/${walletAddress}/profitability?chain=${chain}&days=${days}`;

        logger.debug(LogCode.API_FETCH_SUCCESS, 'Fetching wallet profitability', {
            wallet: walletAddress.slice(0, 10),
            chain,
            days
        });

        const data = await unifiedApiService.fetchJson<WalletProfitabilityResponse>({
            url,
            headers: { 'X-API-Key': MORALIS_API_KEY },
            timeout: 30000,
            retry: { retries: 2 },
            endpointName: 'moralis.io'
        });



        if (!data.result || data.result.length === 0) {
            logger.info(LogCode.API_FETCH_SUCCESS, 'No profitability data found', {
                wallet: walletAddress.slice(0, 10)
            });
            return {
                address: walletAddress,
                chainId,
                days,
                totalRealizedPnlUsd: 0,
                totalTrades: 0,
                winningTrades: 0,
                losingTrades: 0,
                winRate: 0,
                avgProfitPerTrade: 0,
                tokens: [],
            };
        }

        // Calculate summary statistics
        let totalRealizedPnl = 0;
        let totalTrades = 0;
        let winningTrades = 0;
        let losingTrades = 0;

        for (const token of data.result) {
            totalRealizedPnl += token.realizedProfitUsd || 0;
            totalTrades += token.countOfTrades || 0;

            if (token.realizedProfitUsd > 0) {
                winningTrades++;
            } else if (token.realizedProfitUsd < 0) {
                losingTrades++;
            }
        }

        const winRate = totalTrades > 0 ? (winningTrades / data.result.length) * 100 : 0;
        const avgProfitPerTrade = totalTrades > 0 ? totalRealizedPnl / totalTrades : 0;

        const summary: WalletPnlSummary = {
            address: walletAddress,
            chainId,
            days,
            totalRealizedPnlUsd: totalRealizedPnl,
            totalTrades,
            winningTrades,
            losingTrades,
            winRate,
            avgProfitPerTrade,
            tokens: data.result,
        };

        logger.info(LogCode.API_FETCH_SUCCESS, 'Wallet PNL summary fetched', {
            totalRealizedPnl: totalRealizedPnl.toFixed(2),
            totalTrades,
            winRate: winRate.toFixed(1)
        });

        return summary;

    } catch (error: any) {
        logger.warn(LogCode.API_FETCH_FAILED, 'Error fetching profitability, falling back to manual calculation', {
            error: error.message
        });

        // Fallback to manual calculation
        const { calculateWalletPnlManual } = await import('./pnlCalculationService.js');
        const manualPnl = await calculateWalletPnlManual(walletAddress, CHAIN_MAPPING[chainId] || 'eth', days === 'all' ? 365 : days);

        if (!manualPnl) return null;

        return {
            address: walletAddress,
            chainId,
            days,
            totalRealizedPnlUsd: manualPnl.totalRealizedPnlUsd,
            totalTrades: manualPnl.totalTrades,
            winningTrades: manualPnl.profitableTrades,
            losingTrades: manualPnl.totalTrades - manualPnl.profitableTrades,
            winRate: manualPnl.winRate,
            avgProfitPerTrade: manualPnl.totalTrades > 0 ? manualPnl.totalRealizedPnlUsd / manualPnl.totalTrades : 0,
            tokens: Object.values(manualPnl.tokenBreakdown).map(t => ({
                tokenAddress: t.address,
                tokenSymbol: t.symbol,
                tokenName: t.symbol,
                tokenDecimals: 18,
                countOfTrades: t.buyCount + t.sellCount,
                realizedProfitUsd: t.realizedPnlUsd,
                realizedProfitPercentage: 0,
                totalTokensBought: t.totalAmount.toString(),
                totalTokensSold: '0',
                totalBuyValueUsd: t.totalCostUsd,
                totalSellValueUsd: t.totalCostUsd + t.realizedPnlUsd,
                avgCostOfQuantitySold: 0,
                avgSellPrice: 0,
            })),
        };
    }
}

/**
 * Get wallet profitability SUMMARY from Moralis API
 * Returns aggregated stats directly (simpler endpoint)
 */
export async function getWalletProfitabilitySummary(
    walletAddress: string,
    chainId: number,
    days: 7 | 30 | 60 | 90 | 'all' = 'all'
): Promise<ProfitabilitySummary | null> {
    const chain = CHAIN_MAPPING[chainId];
    if (!MORALIS_API_KEY || !chain || !MORALIS_PROFITABILITY_SUPPORTED_CHAINS.has(chainId)) {
        logger.warn(LogCode.API_FETCH_FAILED, 'Moralis Profitability unavailable, falling back to manual summary', {
            hasKey: !!MORALIS_API_KEY,
            chain,
            isSupported: MORALIS_PROFITABILITY_SUPPORTED_CHAINS.has(chainId)
        });
        const { calculateWalletPnlManual } = await import('./pnlCalculationService.js');
        const manualPnl = await calculateWalletPnlManual(walletAddress, chain || 'eth', days === 'all' ? 365 : days);

        if (!manualPnl) return null;

        const totalBoughtValue = Object.values(manualPnl.tokenBreakdown).reduce((acc, t) => acc + t.totalCostUsd, 0);
        const totalSoldValue = Object.values(manualPnl.tokenBreakdown).reduce((acc, t) => acc + (t.totalCostUsd + t.realizedPnlUsd), 0);
        const profitPercentage = totalBoughtValue > 0 ? (manualPnl.totalRealizedPnlUsd / totalBoughtValue) * 100 : 0;

        return {
            totalCountOfTrades: manualPnl.totalTrades,
            totalTradeValue: totalBoughtValue + totalSoldValue,
            totalRealizedProfitUsd: manualPnl.totalRealizedPnlUsd,
            totalRealizedProfitPercentage: profitPercentage,
            totalBuys: Object.values(manualPnl.tokenBreakdown).reduce((acc, t) => acc + t.buyCount, 0),
            totalSells: Object.values(manualPnl.tokenBreakdown).reduce((acc, t) => acc + t.sellCount, 0),
            totalSoldValueUsd: totalSoldValue,
            totalBoughtValueUsd: totalBoughtValue,
        };
    }

    try {
        const url = `${MORALIS_BASE_URL}/wallets/${walletAddress}/profitability/summary?chain=${chain}&days=${days}`;

        logger.debug(LogCode.API_FETCH_SUCCESS, 'Fetching profitability summary', {
            wallet: walletAddress.slice(0, 10),
            chain,
            days
        });

        const data = await unifiedApiService.fetchJson<any>({
            url,
            headers: { 'X-API-Key': MORALIS_API_KEY },
            timeout: 30000,
            endpointName: 'moralis.io'
        });



        const summary: ProfitabilitySummary = {
            totalCountOfTrades: data.total_count_of_trades || 0,
            totalTradeValue: parseFloat(data.total_trade_value || '0'),
            totalRealizedProfitUsd: parseFloat(data.total_realized_profit_usd || '0'),
            totalRealizedProfitPercentage: parseFloat(data.total_realized_profit_percentage || '0'),
            totalBuys: data.total_buys || 0,
            totalSells: data.total_sells || 0,
            totalSoldValueUsd: parseFloat(data.total_sold_value_usd || '0'),
            totalBoughtValueUsd: parseFloat(data.total_bought_value_usd || '0'),
        };

        logger.info(LogCode.API_FETCH_SUCCESS, 'Moralis profitability summary fetched', {
            pnlUsd: summary.totalRealizedProfitUsd.toFixed(2),
            trades: summary.totalCountOfTrades,
            profitPct: summary.totalRealizedProfitPercentage.toFixed(1)
        });

        return summary;

    } catch (error: any) {
        logger.error(LogCode.API_FETCH_FAILED, 'Error fetching profitability summary', {
            error: error.message
        });
        return null;
    }
}

/**
 * Get wallet profitability for multiple chains
 */
export async function getWalletProfitabilityMultiChain(
    walletAddress: string,
    chainIds: number[] = [1, 56, 137, 8453, 42161],
    days: 7 | 30 | 60 | 90 | 'all' = 30
): Promise<Map<number, WalletPnlSummary>> {
    const results = new Map<number, WalletPnlSummary>();

    const promises = chainIds.map(async (chainId) => {
        const summary = await getWalletProfitability(walletAddress, chainId, days);
        if (summary) {
            results.set(chainId, summary);
        }
    });

    await Promise.all(promises);

    return results;
}

/**
 * Get aggregated PNL summary across all chains
 */
export async function getWalletAggregatedPnl(
    walletAddress: string,
    chainIds: number[] = [1, 56, 137, 8453, 42161],
    days: 7 | 30 | 60 | 90 | 'all' = 30
): Promise<{
    totalPnlUsd: number;
    totalTrades: number;
    winRate: number;
    byChain: Map<number, WalletPnlSummary>;
}> {
    const byChain = await getWalletProfitabilityMultiChain(walletAddress, chainIds, days);

    let totalPnl = 0;
    let totalTrades = 0;
    let totalWinningTokens = 0;
    let totalTokens = 0;

    for (const [_, summary] of byChain) {
        totalPnl += summary.totalRealizedPnlUsd;
        totalTrades += summary.totalTrades;
        totalWinningTokens += summary.winningTrades;
        totalTokens += summary.tokens.length;
    }

    return {
        totalPnlUsd: totalPnl,
        totalTrades,
        winRate: totalTokens > 0 ? (totalWinningTokens / totalTokens) * 100 : 0,
        byChain,
    };
}

/**
 * Quick check: Is this wallet profitable?
 */
export async function isWalletProfitable(
    walletAddress: string,
    chainId: number,
    days: 7 | 30 = 30
): Promise<{ profitable: boolean; pnlUsd: number; winRate: number } | null> {
    const summary = await getWalletProfitability(walletAddress, chainId, days);

    if (!summary) return null;

    return {
        profitable: summary.totalRealizedPnlUsd > 0,
        pnlUsd: summary.totalRealizedPnlUsd,
        winRate: summary.winRate,
    };
}

export const moralisService = {
    getTokenTopProfitableWallets,
    getWalletProfitability,
    getWalletProfitabilitySummary,
    getWalletProfitabilityMultiChain,
    getWalletAggregatedPnl,
    isWalletProfitable,
    CHAIN_MAPPING,
};

export default moralisService;
