import pLimit from 'p-limit';
import { Tool } from '../../../tooling/registry.js';
import { resolveChainInput } from '../../../utils/chainParam.js';
import * as duneWalletAnalysisService from '../../../services/duneWalletAnalysisService.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';

function isValidEvmAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function isValidSolanaAddress(address: string): boolean {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

function isEvmChain(chain: string): boolean {
    return chain !== 'solana';
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

type BatchQueryProfile = 'wallet_token_pnl_analysis' | 'wallet_portfolio_token_breakdown';

type BatchWalletPnlResult = {
    address: string;
    source: 'dune_analysis';
    profile: BatchQueryProfile;
    realizedPnlUsd: number;
    totalBuyUsd: number | null;
    totalSellUsd: number | null;
    profitPct: number | null;
    totalTrades: number | null;
    tokenAddress: string | null;
    tokenSymbol: string | null;
    coverage: 'existing_wallet_breakdown_query';
};

type AnalysisDeps = {
    analyzeWalletTokenPnl: typeof duneWalletAnalysisService.analyzeWalletTokenPnl;
    analyzeWalletPortfolioTokenBreakdown: typeof duneWalletAnalysisService.analyzeWalletPortfolioTokenBreakdown;
};

function resolveBatchProfile(args: any): BatchQueryProfile {
    const explicit = String(args.query_profile || '').trim();
    if (explicit === 'wallet_portfolio_token_breakdown') {
        return 'wallet_portfolio_token_breakdown';
    }
    if (explicit === 'wallet_token_pnl_analysis') {
        return 'wallet_token_pnl_analysis';
    }
    return args.token_address ? 'wallet_token_pnl_analysis' : 'wallet_portfolio_token_breakdown';
}

async function fetchWalletAnalysisResult(
    address: string,
    chain: string,
    days: number,
    profile: BatchQueryProfile,
    tokenAddress: string | null,
    deps: AnalysisDeps = {
        analyzeWalletTokenPnl: duneWalletAnalysisService.analyzeWalletTokenPnl,
        analyzeWalletPortfolioTokenBreakdown: duneWalletAnalysisService.analyzeWalletPortfolioTokenBreakdown,
    }
): Promise<BatchWalletPnlResult | null> {
    if (profile === 'wallet_token_pnl_analysis') {
        if (!tokenAddress) return null;
        const token = await deps.analyzeWalletTokenPnl(address, chain, days, tokenAddress);
        if (!token) return null;
        return {
            address,
            source: 'dune_analysis',
            profile,
            realizedPnlUsd: token.realizedPnlUsd,
            totalBuyUsd: token.totalBuyUsd,
            totalSellUsd: token.totalSellUsd,
            profitPct: token.profitPct,
            totalTrades: null,
            tokenAddress: token.tokenAddress,
            tokenSymbol: token.tokenSymbol,
            coverage: token.coverage,
        };
    }

    const portfolio = await deps.analyzeWalletPortfolioTokenBreakdown(address, chain, days, 50);
    if (!portfolio) return null;
    const aggregate = portfolio.tokens.reduce((acc, token) => {
        acc.realizedPnlUsd += token.realizedPnlUsd;
        acc.totalBuyUsd += token.totalBuyUsd;
        acc.totalSellUsd += token.totalSellUsd;
        acc.totalTrades += 1;
        return acc;
    }, {
        realizedPnlUsd: 0,
        totalBuyUsd: 0,
        totalSellUsd: 0,
        totalTrades: 0,
    });

    return {
        address,
        source: 'dune_analysis',
        profile,
        realizedPnlUsd: aggregate.realizedPnlUsd,
        totalBuyUsd: aggregate.totalBuyUsd,
        totalSellUsd: aggregate.totalSellUsd,
        profitPct: aggregate.totalBuyUsd > 0
            ? (aggregate.realizedPnlUsd / aggregate.totalBuyUsd) * 100
            : null,
        totalTrades: aggregate.totalTrades,
        tokenAddress: null,
        tokenSymbol: null,
        coverage: portfolio.coverage,
    };
}

export const AnalyzeWalletPnlBatchTool: Tool = {
    definition: {
        name: 'analyze_wallet_pnl_batch',
        description: 'Batch-analyze wallet PNL using Dune analysis semantics. With token_address it ranks wallets by single-token realized PnL; without token_address it ranks wallets by portfolio token-breakdown aggregate on EVM chains.',
        parameters: {
            type: 'object',
            properties: {
                addresses: {
                    type: 'array',
                    description: 'Wallet addresses to analyze. Recommended 5-20 addresses per call.',
                    items: { type: 'string' }
                },
                chain: {
                    type: 'string',
                    description: 'Blockchain network (ethereum, base, bnb, polygon, arbitrum, optimism, avalanche, solana).',
                },
                chain_id: {
                    type: 'number',
                    description: 'Numeric chain ID (preferred), e.g. 1, 8453, 56.',
                },
                days: {
                    type: 'number',
                    description: 'Requested time range in days: 1, 7, 30. Default 30.',
                    enum: [1, 7, 30],
                    default: 30
                },
                limit: {
                    type: 'number',
                    description: 'Maximum number of wallets to process from input list. Default 20, max 50.',
                    default: 20
                },
                token_address: {
                    type: 'string',
                    description: 'Optional token contract. When present, batch analysis ranks wallets by this token only.'
                },
                query_profile: {
                    type: 'string',
                    description: 'Analysis profile to use.',
                    enum: ['wallet_token_pnl_analysis', 'wallet_portfolio_token_breakdown']
                },
                min_realized_pnl_usd: {
                    type: 'number',
                    description: 'Optional filter to keep only wallets with realized PNL >= this value.'
                },
                sort_by: {
                    type: 'string',
                    description: 'Ranking sort key.',
                    enum: ['realized_pnl_desc', 'total_buy_desc', 'profit_pct_desc'],
                    default: 'realized_pnl_desc'
                }
            },
            required: ['addresses']
        }
    },
    handler: async (args, context) => {
        try {
            const rawAddresses: any[] = Array.isArray(args.addresses) ? args.addresses : [];
            const uniqueAddresses: string[] = Array.from(
                new Set(rawAddresses.map((a: any) => String(a || '').trim()).filter(Boolean))
            );
            const requestedCount = uniqueAddresses.length;

            if (requestedCount === 0) {
                return { success: false, error: 'addresses is required and cannot be empty.' };
            }

            const resolved = resolveChainInput(args, {
                contextChainId: context?.chainId,
                defaultChain: 'eth',
            });
            if (resolved.invalidChainId) {
                return { success: false, error: `Unsupported chain_id: ${String(args.chain_id)}` };
            }

            const chain = resolved.chain;
            const days = Number(args.days ?? 30);
            if (![1, 7, 30].includes(days)) {
                return { success: false, error: `Unsupported days=${days}. Supported values: 1, 7, 30.` };
            }

            const profile = resolveBatchProfile(args);
            const tokenAddress = typeof args.token_address === 'string' && args.token_address.trim()
                ? args.token_address.trim().toLowerCase()
                : null;

            if (!isEvmChain(chain)) {
                return {
                    success: false,
                    error: `Batch analysis is currently supported for EVM chains only. Received ${chain}.`,
                    profile,
                };
            }

            if (profile === 'wallet_token_pnl_analysis' && !tokenAddress) {
                return {
                    success: false,
                    error: 'token_address is required for wallet_token_pnl_analysis batch mode.',
                    profile,
                };
            }

            const cap = Math.max(1, Math.min(Number(args.limit) || 20, 50));
            const candidates = uniqueAddresses.slice(0, cap);

            const invalidAddresses: string[] = [];
            const validAddresses: string[] = [];
            for (const address of candidates) {
                const valid = chain === 'solana' ? isValidSolanaAddress(address) : isValidEvmAddress(address);
                if (valid) validAddresses.push(address);
                else invalidAddresses.push(address);
            }

            if (validAddresses.length === 0) {
                return {
                    success: false,
                    error: `No valid wallet addresses for chain ${chain}.`,
                    invalidAddresses
                };
            }

            const minRealized = Number.isFinite(Number(args.min_realized_pnl_usd))
                ? Number(args.min_realized_pnl_usd)
                : undefined;
            const sortBy = (args.sort_by === 'total_buy_desc'
                ? 'total_buy_desc'
                : args.sort_by === 'profit_pct_desc'
                    ? 'profit_pct_desc'
                    : 'realized_pnl_desc') as 'realized_pnl_desc' | 'total_buy_desc' | 'profit_pct_desc';

            logger.info(LogCode.AI_TOOL_USED, 'Analyzing wallet PNL batch with Dune analysis semantics', {
                chain,
                days,
                profile,
                requestedCount,
                analyzing: validAddresses.length
            });

            const limitRun = pLimit(1);
            const start = Date.now();
            const settled = await Promise.all(
                validAddresses.map((address, index) =>
                    limitRun(async () => {
                        if (index > 0) {
                            await sleep(400);
                        }
                        const result = await fetchWalletAnalysisResult(address, chain, days, profile, tokenAddress);
                        return { address, result };
                    })
                )
            );
            const elapsedMs = Date.now() - start;

            const failedAddresses = settled.filter((item) => !item.result).map((item) => item.address);
            let wallets = settled
                .filter(item => !!item.result)
                .map(item => item.result as BatchWalletPnlResult);

            if (typeof minRealized === 'number') {
                wallets = wallets.filter(w => w.realizedPnlUsd >= minRealized);
            }

            wallets.sort((a, b) => {
                if (sortBy === 'total_buy_desc') return (b.totalBuyUsd || 0) - (a.totalBuyUsd || 0);
                if (sortBy === 'profit_pct_desc') return (b.profitPct || Number.NEGATIVE_INFINITY) - (a.profitPct || Number.NEGATIVE_INFINITY);
                return b.realizedPnlUsd - a.realizedPnlUsd;
            });

            const failedCount = validAddresses.length - wallets.length;

            return {
                success: true,
                chain,
                days,
                timeRange: days === 1 ? '24H' : `${days}D`,
                profile,
                requestedTokenAddress: tokenAddress,
                requestedCount,
                analyzedCount: validAddresses.length,
                returnedCount: wallets.length,
                invalidAddresses,
                meta: {
                    source: 'dune_analysis',
                    sortBy,
                    minRealizedPnlUsd: typeof minRealized === 'number' ? minRealized : null,
                    batchElapsedMs: elapsedMs,
                    coverage: 'existing_wallet_breakdown_query',
                    failedCount,
                    failedAddresses,
                    note: profile === 'wallet_token_pnl_analysis'
                        ? 'Current batch token analysis runs the existing wallet breakdown Dune query per wallet, filters the target token locally, and uses conservative serial scheduling to reduce Dune rate limits.'
                        : 'Current batch portfolio analysis aggregates the existing wallet breakdown Dune query per wallet and uses conservative serial scheduling to reduce Dune rate limits.',
                },
                wallets: wallets.map((w, i) => ({
                    rank: i + 1,
                    address: w.address,
                    source: w.source,
                    profile: w.profile,
                    tokenAddress: w.tokenAddress,
                    tokenSymbol: w.tokenSymbol,
                    realizedPnlUsd: w.realizedPnlUsd,
                    totalBuyUsd: w.totalBuyUsd,
                    totalSellUsd: w.totalSellUsd,
                    profitPct: w.profitPct,
                    totalTrades: w.totalTrades,
                    coverage: w.coverage,
                }))
            };
        } catch (error: any) {
            logger.error(LogCode.SYS_ERROR, 'PNL batch tool failed', {
                error: error?.message || String(error)
            });
            return { success: false, error: error?.message || 'Failed to analyze wallet batch PNL.' };
        }
    }
};

export const __testOnlyPnlBatch = {
    resolveBatchProfile,
    fetchWalletAnalysisResult,
};
