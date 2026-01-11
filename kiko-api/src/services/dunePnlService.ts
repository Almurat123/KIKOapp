/**
 * Dune PNL Service
 * Uses Dune Analytics API to calculate wallet trading PNL (EVM chains only)
 */

import { DuneClient, QueryParameter } from '@duneanalytics/client-sdk';
import * as dotenv from 'dotenv';
import { env } from '../config/env.js';

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

export interface DunePnlResult {
    tokenAddress: string;
    tokenSymbol?: string;
    boughtUsd: number;
    soldUsd: number;
    pnlUsd: number;
    profitPct: number | null;
}

export interface DuneWalletPnlSummary {
    walletAddress: string;
    chain: string;
    totalRealizedPnlUsd: number;
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
        const response = await client.runQuery({
            queryId: EVM_PNL_QUERY_ID,
            query_parameters: params
        });

        const executionTime = Date.now() - startTime;
        console.log(`[Dune PNL] Query ${EVM_PNL_QUERY_ID} completed in ${executionTime}ms`);

        if (!response.result?.rows || response.result.rows.length === 0) {
            console.log('[Dune PNL] No trades found for this wallet');
            return {
                walletAddress,
                chain: duneChain,
                totalRealizedPnlUsd: 0,
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
        const tokens: DunePnlResult[] = rows.map(row => ({
            tokenAddress: row.token_address || '',
            tokenSymbol: row.token_symbol || row.token || undefined,
            boughtUsd: Number(row.bought_usd) || 0,
            soldUsd: Number(row.sold_usd) || 0,
            pnlUsd: Number(row.pnl_usd) || 0,
            profitPct: row.profit_pct !== null ? Number(row.profit_pct) : null
        }));

        // Calculate summary stats
        const totalBoughtUsd = tokens.reduce((sum, t) => sum + t.boughtUsd, 0);
        const totalSoldUsd = tokens.reduce((sum, t) => sum + t.soldUsd, 0);
        const totalRealizedPnl = tokens.reduce((sum, t) => sum + t.pnlUsd, 0);
        const profitableTrades = tokens.filter(t => t.pnlUsd > 0).length;
        const totalTrades = tokens.filter(t => t.soldUsd > 0).length;
        const winRate = totalTrades > 0 ? (profitableTrades / totalTrades) * 100 : 0;

        console.log(`[Dune PNL] ✅ ${tokens.length} tokens, PNL: $${totalRealizedPnl.toFixed(2)}, Win Rate: ${winRate.toFixed(1)}%`);

        return {
            walletAddress,
            chain: duneChain,
            totalRealizedPnlUsd: totalRealizedPnl,
            totalBoughtUsd,
            totalSoldUsd,
            totalTrades,
            profitableTrades,
            winRate,
            tokens: tokens.slice(0, 50), // Limit to top 50
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
