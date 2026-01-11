/**
 * Moralis API Service
 * Provides wallet PNL analysis using Moralis Web3 Data API
 * 
 * API Reference: 
 * - https://docs.moralis.com/web3-data-api/evm/reference/wallet-api/get-wallet-profitability
 * - https://docs.moralis.com/web3-data-api/evm/reference/wallet-api/get-wallet-profitability-summary
 */

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
        console.error('[Moralis] API key not configured');
        return null;
    }

    const chain = CHAIN_MAPPING[chainId];
    if (!chain) {
        console.warn(`[Moralis] Unsupported chain: ${chainId}`);
        return null;
    }

    try {
        const url = `${MORALIS_BASE_URL}/wallets/${walletAddress}/profitability?chain=${chain}&days=${days}`;

        console.log(`[Moralis] Fetching profitability for ${walletAddress.slice(0, 10)}... on ${chain} (${days} days)`);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'X-API-Key': MORALIS_API_KEY,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Moralis] API error ${response.status}: ${errorText}`);
            return null;
        }

        const data: WalletProfitabilityResponse = await response.json();

        if (!data.result || data.result.length === 0) {
            console.log(`[Moralis] No profitability data for ${walletAddress.slice(0, 10)}...`);
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

        console.log(`[Moralis] ✅ PNL Summary: $${totalRealizedPnl.toFixed(2)}, ${totalTrades} trades, ${winRate.toFixed(1)}% win rate`);

        return summary;

    } catch (error: any) {
        console.error(`[Moralis] Error fetching profitability, falling back to manual calculation:`, error.message);

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
        console.warn(`[Moralis] Moralis Profitability unavailable (Key missing or chain unsupported for PNL API), falling back to manual summary`);
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

        console.log(`[Moralis] Fetching profitability summary for ${walletAddress.slice(0, 10)}... on ${chain} (${days} days)`);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'X-API-Key': MORALIS_API_KEY,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Moralis] Summary API error ${response.status}: ${errorText}`);
            return null;
        }

        const data = await response.json();

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

        console.log(`[Moralis] ✅ Summary: PNL $${summary.totalRealizedProfitUsd.toFixed(2)}, ${summary.totalCountOfTrades} trades, ${summary.totalRealizedProfitPercentage.toFixed(1)}%`);

        return summary;

    } catch (error: any) {
        console.error(`[Moralis] Error fetching profitability summary:`, error.message);
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
    getWalletProfitability,
    getWalletProfitabilitySummary,
    getWalletProfitabilityMultiChain,
    getWalletAggregatedPnl,
    isWalletProfitable,
    CHAIN_MAPPING,
};

export default moralisService;
