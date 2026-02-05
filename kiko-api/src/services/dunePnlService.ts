/**
 * Dune PNL Service
 * Uses Dune Analytics API to calculate wallet trading PNL (EVM chains only)
 */

import { DuneClient, QueryParameter } from '@duneanalytics/client-sdk';
import * as dotenv from 'dotenv';
import { env } from '../config/env.js';
import { CHAINS } from '../config/chainConfig.js';

dotenv.config();

const DUNE_API_KEY = env.duneQueries?.apiKey || env.apiKeys.dune || process.env.DUNE_API_KEY || '';

// Saved Query ID in Dune (EVM only)
const EVM_PNL_QUERY_ID = 6506445;

// Chain name mapping for Dune query
const CHAIN_MAP: Record<string, string> = {
    'eth': 'ethereum',
    'ethereum': 'ethereum',
    '1': 'ethereum',
    'base': 'base',
    '8453': 'base',
    'bsc': 'bnb',
    'bnb': 'bnb',
    '56': 'bnb',
    'polygon': 'polygon',
    '137': 'polygon',
    'arbitrum': 'arbitrum',
    '42161': 'arbitrum',
    'optimism': 'optimism',
    '10': 'optimism',
    'avalanche': 'avalanche_c',
    '43114': 'avalanche_c'
};

const CHAIN_ID_MAP: Record<string, number> = {
    'ethereum': 1,
    'eth': 1,
    '1': 1,
    'base': 8453,
    '8453': 8453,
    'bnb': 56,
    'bsc': 56,
    '56': 56,
    'polygon': 137,
    'matic': 137,
    '137': 137,
    'arbitrum': 42161,
    '42161': 42161,
    'optimism': 10,
    'op': 10,
    '10': 10,
    'avalanche_c': 43114,
    'avalanche': 43114,
    '43114': 43114
};

export interface DunePnlResult {
    tokenAddress: string;
    tokenSymbol?: string;
    boughtUsd: number;
    soldUsd: number;
    pnlUsd: number;
    profitPct: number | null;
}

// Tokens to exclude from PNL calculation (Quote/Gas/Stable tokens)
const QUOTE_TOKENS = new Set([
    'WBNB', 'BNB', 'ETH', 'WETH', 'USDT', 'USDC', 'DAI', 'FDUSD', 'BUSD', 'USDE',
    'wBNB', 'bnb', 'eth', 'weth', 'usdt', 'usdc', 'dai', 'fdusd', 'busd', 'usde',
    'SOL', 'WSOL', 'USDC.e', 'USDT.e', 'sol', 'wsol'
]);

function getExcludedTokenAddresses(chain: string): Set<string> {
    const key = chain.toLowerCase();
    const chainId = CHAIN_ID_MAP[key];
    if (!chainId || !CHAINS[chainId]) return new Set();
    const config = CHAINS[chainId];
    const addresses = [config.wrappedNativeAddress, ...(config.stablecoins || [])]
        .filter(Boolean)
        .map(addr => addr.toLowerCase());
    return new Set(addresses);
}

function isQuoteToken(tokenSymbol?: string, tokenAddress?: string, chain?: string): boolean {
    if (tokenSymbol && QUOTE_TOKENS.has(tokenSymbol)) return true;
    if (!tokenAddress || !chain) return false;
    const excluded = getExcludedTokenAddresses(chain);
    return excluded.has(tokenAddress.toLowerCase());
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
    }) as Promise<T>;
}

export interface DuneWalletPnlSummary {
    walletAddress: string;
    chain: string;
    totalRealizedPnlUsd: number;      // Net PNL (All tokens)
    totalRealizedProfitUsd: number;   // Sum of positive PNL
    totalRealizedLossUsd: number;     // Sum of negative PNL

    // New Metrics for "Skill" Analysis
    tradingPnlUsd: number;            // PNL excluding Quote Tokens
    tradingWinRate: number;           // Win Rate excluding Quote Tokens

    totalBoughtUsd: number;
    totalSoldUsd: number;
    totalTrades: number;
    profitableTrades: number;
    winRate: number;
    tokens: DunePnlResult[];
    queryExecutionTimeMs: number;
}

/**
 * Get wallet PNL from Dune (EVM chains only)
 * Always executes fresh query for real-time data
 */
export async function getWalletPnlFromDune(
    walletAddress: string,
    chain: string = 'ethereum',
    days: number = 30
): Promise<DuneWalletPnlSummary | null> {
    if (!DUNE_API_KEY) {
        console.error('[Dune PNL] API key not configured');
        return null;
    }

    const duneChain = CHAIN_MAP[chain.toLowerCase()] || chain.toLowerCase();

    console.log(`[Dune PNL] Fetching PNL for ${walletAddress.slice(0, 10)}... on ${duneChain} (${days} days)`);
    const startTime = Date.now();

    try {
        const client = new DuneClient(DUNE_API_KEY);

        // Build query parameters
        const params: QueryParameter[] = [
            QueryParameter.text('wallet_addr', walletAddress),
            QueryParameter.number('days', days),
            QueryParameter.text('blockchain', duneChain)
        ];

        // Execute fresh query (no caching)
        const response = await withTimeout(
            client.runQuery({
                queryId: EVM_PNL_QUERY_ID,
                query_parameters: params
            }),
            20_000,
            'Dune PNL query'
        );

        const executionTime = Date.now() - startTime;
        console.log(`[Dune PNL] Query ${EVM_PNL_QUERY_ID} completed in ${executionTime}ms`);

        if (!response?.result?.rows || response.result.rows.length === 0) {
            console.log('[Dune PNL] No trades found for this wallet');
            return {
                walletAddress,
                chain: duneChain,
                totalRealizedPnlUsd: 0,
                totalRealizedProfitUsd: 0,
                totalRealizedLossUsd: 0,
                tradingPnlUsd: 0,      // New Field
                tradingWinRate: 0,     // New Field
                totalBoughtUsd: 0,
                totalSoldUsd: 0,
                totalTrades: 0,
                profitableTrades: 0,
                winRate: 0,
                tokens: [],
                queryExecutionTimeMs: executionTime
            };
        }

        const rows = response.result.rows as any[];

        // Parse results
        const tokens: DunePnlResult[] = rows.map(row => {
            const bought = Number(row.bought_usd) || 0;
            const sold = Number(row.sold_usd) || 0;
            const pnl = Number(row.pnl_usd);

            return {
                tokenAddress: row.address || row.token_address || '',
                tokenSymbol: row.token || row.token_symbol || undefined,
                boughtUsd: bought,
                soldUsd: sold,
                pnlUsd: isNaN(pnl) ? (sold - bought) : pnl,
                profitPct: row.profit_pct !== null ? Number(row.profit_pct) : null
            };
        });

        const filteredTokens = tokens.filter(t => !isQuoteToken(t.tokenSymbol, t.tokenAddress, duneChain));

        // Calculate summary stats
        // LOGIC CHANGE: Asymmetric PNL
        // 1. ALL Losses are real (whether USDT or Meme).
        // 2. Quote Token Profits are FAKE (just selling principal).
        // 3. Meme Profits are REAL.

        let totalBought = 0;
        let totalSold = 0;
        let totalPnl = 0; // This will now reflect "Trader PNL"
        let totalProfit = 0;
        let totalLoss = 0;
        let profitableCount = 0;

        for (const t of filteredTokens) {
            totalBought += t.boughtUsd;
            totalSold += t.soldUsd;

            if (t.pnlUsd < 0) {
                // LOSSES: Always count them. 
                // If you lost USDT, you lost money. If you lost Meme, you lost money.
                totalPnl += t.pnlUsd;
                totalLoss += t.pnlUsd;
            } else if (t.pnlUsd > 0) {
                totalPnl += t.pnlUsd;
                totalProfit += t.pnlUsd;
                if (t.pnlUsd > 0.01) profitableCount++;
            }
        }

        const tradesCount = filteredTokens.filter(t => t.soldUsd > 0).length;
        const finalWinRate = tradesCount > 0 ? (profitableCount / tradesCount) * 100 : 0;

        // Sort: Absolute PNL descending
        filteredTokens.sort((a, b) => Math.abs(b.pnlUsd) - Math.abs(a.pnlUsd));

        console.log(`[Dune PNL] ✅ Processed. Net Trader PNL: $${totalPnl.toFixed(2)} (Reflects User Reality)`);

        return {
            walletAddress,
            chain: duneChain,
            totalRealizedPnlUsd: totalPnl, // Now clearly -104
            totalRealizedProfitUsd: totalProfit,
            totalRealizedLossUsd: totalLoss,

            // Legacy/Dual compatibility
            tradingPnlUsd: totalPnl,
            tradingWinRate: finalWinRate,

            totalBoughtUsd: totalBought,
            totalSoldUsd: totalSold,
            totalTrades: tradesCount,
            profitableTrades: profitableCount,
            winRate: finalWinRate,
            tokens: filteredTokens.slice(0, 50),
            queryExecutionTimeMs: executionTime
        };

    } catch (error: any) {
        console.error('[Dune PNL] Query failed:', error.message);
        return null;
    }
}

/**
 * Get wallet PNL across multiple EVM chains
 */
export async function getWalletPnlMultiChain(
    walletAddress: string,
    chains: string[] = ['ethereum', 'base', 'arbitrum', 'polygon'],
    days: number = 30
): Promise<Map<string, DuneWalletPnlSummary>> {
    const results = new Map<string, DuneWalletPnlSummary>();

    // Execute queries in parallel for speed
    const promises = chains.map(async (chain) => {
        const summary = await getWalletPnlFromDune(walletAddress, chain, days);
        if (summary) {
            results.set(chain, summary);
        }
    });

    await Promise.all(promises);
    return results;
}

/**
 * Get combined PNL summary for a wallet across all EVM chains
 */
export async function getWalletPnlCombined(
    walletAddress: string,
    days: number = 30
): Promise<{
    totalPnlUsd: number;
    totalBoughtUsd: number;
    totalSoldUsd: number;
    overallWinRate: number;
    chains: Map<string, DuneWalletPnlSummary>;
}> {
    const chains = ['ethereum', 'base', 'bnb', 'arbitrum', 'polygon'];
    const chainResults = await getWalletPnlMultiChain(walletAddress, chains, days);

    let totalPnlUsd = 0;
    let totalBoughtUsd = 0;
    let totalSoldUsd = 0;
    let totalProfitable = 0;
    let totalTrades = 0;

    chainResults.forEach(summary => {
        totalPnlUsd += summary.totalRealizedPnlUsd;
        totalBoughtUsd += summary.totalBoughtUsd;
        totalSoldUsd += summary.totalSoldUsd;
        totalProfitable += summary.profitableTrades;
        totalTrades += summary.totalTrades;
    });

    return {
        totalPnlUsd,
        totalBoughtUsd,
        totalSoldUsd,
        overallWinRate: totalTrades > 0 ? (totalProfitable / totalTrades) * 100 : 0,
        chains: chainResults
    };
}
