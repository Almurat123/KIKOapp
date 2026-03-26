import { getWalletPnlFromDune, type DunePnlResult, type DuneWalletPnlSummary } from './dunePnlService.js';

export type WalletTokenPnlAnalysis = {
    walletAddress: string;
    chain: string;
    tokenAddress: string;
    tokenSymbol: string | null;
    days: number;
    totalBuyUsd: number;
    totalSellUsd: number;
    realizedPnlUsd: number;
    profitPct: number | null;
    currentTokenBalance: null;
    unrealizedPnlUsd: null;
    coverage: 'existing_wallet_breakdown_query';
};

export type WalletPortfolioTokenBreakdownAnalysis = {
    walletAddress: string;
    chain: string;
    days: number;
    totalTokens: number;
    tokens: Array<{
        tokenAddress: string;
        tokenSymbol: string | null;
        totalBuyUsd: number;
        totalSellUsd: number;
        realizedPnlUsd: number;
        profitPct: number | null;
    }>;
    coverage: 'existing_wallet_breakdown_query';
};

type AnalysisDeps = {
    getWalletPnlFromDune: (walletAddress: string, chain: string, days: number) => Promise<DuneWalletPnlSummary | null>;
};

function normalizeTokenAddress(address: string): string {
    return String(address || '').trim().toLowerCase();
}

function mapTokenRow(token: DunePnlResult) {
    return {
        tokenAddress: normalizeTokenAddress(token.tokenAddress),
        tokenSymbol: token.tokenSymbol || null,
        totalBuyUsd: token.boughtUsd,
        totalSellUsd: token.soldUsd,
        realizedPnlUsd: token.pnlUsd,
        profitPct: token.profitPct,
    };
}

async function resolveDuneSummary(
    walletAddress: string,
    chain: string,
    days: number,
    deps?: AnalysisDeps
): Promise<DuneWalletPnlSummary | null> {
    const activeDeps = deps || { getWalletPnlFromDune };
    return activeDeps.getWalletPnlFromDune(walletAddress, chain, days);
}

export async function analyzeWalletPortfolioTokenBreakdown(
    walletAddress: string,
    chain: string,
    days: number,
    limit = 50,
    deps?: AnalysisDeps
): Promise<WalletPortfolioTokenBreakdownAnalysis | null> {
    const summary = await resolveDuneSummary(walletAddress, chain, days, deps);
    if (!summary) return null;

    const tokens = (summary.tokens || [])
        .map(mapTokenRow)
        .sort((a, b) => Math.abs(b.realizedPnlUsd) - Math.abs(a.realizedPnlUsd))
        .slice(0, Math.max(1, limit));

    return {
        walletAddress: summary.walletAddress,
        chain: summary.chain,
        days,
        totalTokens: summary.tokens.length,
        tokens,
        coverage: 'existing_wallet_breakdown_query',
    };
}

export async function analyzeWalletTokenPnl(
    walletAddress: string,
    chain: string,
    days: number,
    tokenAddress: string,
    deps?: AnalysisDeps
): Promise<WalletTokenPnlAnalysis | null> {
    const normalizedToken = normalizeTokenAddress(tokenAddress);
    if (!normalizedToken) return null;

    const summary = await resolveDuneSummary(walletAddress, chain, days, deps);
    if (!summary) return null;

    const token = (summary.tokens || []).find((item) => normalizeTokenAddress(item.tokenAddress) === normalizedToken);
    if (!token) return null;

    return {
        walletAddress: summary.walletAddress,
        chain: summary.chain,
        tokenAddress: normalizedToken,
        tokenSymbol: token.tokenSymbol || null,
        days,
        totalBuyUsd: token.boughtUsd,
        totalSellUsd: token.soldUsd,
        realizedPnlUsd: token.pnlUsd,
        profitPct: token.profitPct,
        currentTokenBalance: null,
        unrealizedPnlUsd: null,
        coverage: 'existing_wallet_breakdown_query',
    };
}

export const __testOnly = {
    normalizeTokenAddress,
};
