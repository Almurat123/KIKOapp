import { Tool } from '../../../tooling/registry.js';
import { resolveChainInput } from '../../../utils/chainParam.js';
import * as duneBatchPnlService from '../../../services/duneBatchPnlService.js';
import { getAssetTransfers } from '../../../services/alchemy.js';
import { getTokenDetails } from '../../../services/dexscreener.js';
import { getNativeTokenPriceUsd } from '../../../services/onChainPriceService.js';
import { CHAINS } from '../../../config/chainConfig.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import pLimit from 'p-limit';

function isValidEvmAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function isValidSolanaAddress(address: string): boolean {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

function isEvmChain(chain: string): boolean {
    return chain !== 'solana';
}

type BatchQueryProfile = 'wallet_token_pnl_analysis' | 'wallet_portfolio_token_breakdown';

type BatchWalletPnlResult = {
    address: string;
    source: 'dune_analysis' | 'hybrid_analysis';
    profile: BatchQueryProfile;
    realizedPnlUsd: number | null;
    totalBuyUsd: number | null;
    totalSellUsd: number | null;
    profitPct: number | null;
    totalTrades: number | null;
    tokenAddress: string | null;
    tokenSymbol: string | null;
    buyTradeCount: number | null;
    sellTradeCount: number | null;
    coverage:
        | 'batch_wallet_list_sql'
        | 'batch_wallet_list_sql_no_coverage'
        | 'batch_wallet_list_sql_partial_cost_basis'
        | 'batch_wallet_manual_transfer_cost_basis';
};

type AnalysisDeps = {
    getBatchWalletTokenPnlFromDune: typeof duneBatchPnlService.getBatchWalletTokenPnlFromDune;
    getBatchWalletPortfolioPnlFromDune: typeof duneBatchPnlService.getBatchWalletPortfolioPnlFromDune;
    estimateSingleTokenPnlFromTransfers: typeof estimateSingleTokenPnlFromTransfers;
};

type ManualTokenBreakdownEntry = {
    address?: string;
    symbol?: string;
    totalBuyUsd?: number;
    totalSellUsd?: number;
    realizedPnlUsd?: number;
    buyCount?: number;
    sellCount?: number;
};

const MANUAL_FALLBACK_CONCURRENCY = 2;
const MANUAL_FALLBACK_MAX_TRANSFERS = 2_000;
const STABLE_SYMBOLS = new Set(['USDC', 'USDT', 'DAI', 'BUSD', 'USDC.E', 'USDT.E']);
const NATIVE_SYMBOLS = new Set(['ETH', 'WETH', 'BNB', 'WBNB', 'MATIC', 'WMATIC', 'SOL', 'WSOL']);
const CHAIN_ID_BY_SLUG: Record<string, number> = {
    eth: 1,
    ethereum: 1,
    base: 8453,
    bsc: 56,
    bnb: 56,
    polygon: 137,
    matic: 137,
    arbitrum: 42161,
    optimism: 10,
    op: 10,
};

function formatTimeRange(days: number): string {
    return days === 1 ? '24H' : `${days}D`;
}

function buildBatchPnlScope(chain: string, days: number, profile: BatchQueryProfile, tokenAddress: string | null) {
    return {
        chain,
        period: formatTimeRange(days),
        providerPeriod: formatTimeRange(days),
        exactDays: true,
        assetCoverage: tokenAddress ? 'single_token_dex_trades_only' : 'dex_trades_only',
        pnlType: 'recent_window_realized_trading_pnl_ranking',
        costBasisMethod: profile === 'wallet_token_pnl_analysis'
            ? 'dune_sql_or_manual_transfer_cost_basis'
            : 'dune_sql_token_breakdown_aggregate',
        includesUnrealized: false,
        includesNativeBalance: false,
        includesTransfers: profile === 'wallet_token_pnl_analysis',
        includesDeFi: false,
        includesDexTrades: true,
        queryProfile: profile,
        tokenAddress,
    };
}

function buildBatchPnlAnswerPolicy(extraLimitations: string[] = []) {
    return {
        canAnswerWalletTotalPnl: false,
        canAnswerWalletRealizedPnl: false,
        canAnswerWalletUnrealizedPnl: false,
        canAnswerRealizedTradingPnl: true,
        canRankWalletsByTradingPnl: true,
        mustMentionScope: true,
        mustMentionProvider: true,
        mustMentionLimitations: [
            'Batch PNL is recent-window realized trading PNL only, not full wallet PNL.',
            'Unrealized PNL, current balances, bridges, DeFi positions, NFT activity, and native balance changes are not included.',
            'Wallets marked no_coverage or partial_cost_basis must not be treated as proven profitable or unprofitable.',
            ...extraLimitations,
        ],
    };
}

function buildBatchPnlWarnings(wallets: BatchWalletPnlResult[]) {
    const noCoverage = wallets.filter((wallet) => wallet.coverage === 'batch_wallet_list_sql_no_coverage').length;
    const partial = wallets.filter((wallet) => wallet.coverage === 'batch_wallet_list_sql_partial_cost_basis').length;
    const warnings: string[] = [];
    if (noCoverage > 0) warnings.push(`${noCoverage} wallet(s) had no matching DEX PNL coverage in the requested window.`);
    if (partial > 0) warnings.push(`${partial} wallet(s) had partial cost basis and must not be ranked as proven profit/loss.`);
    return warnings;
}

function normalizeNullableFiniteNumber(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function canUseManualTokenBreakdown(entry: ManualTokenBreakdownEntry | null): boolean {
    if (!entry) return false;

    const buyCount = Number(entry.buyCount || 0);
    const sellCount = Number(entry.sellCount || 0);
    const totalBuyUsd = Number(entry.totalBuyUsd || 0);
    const totalSellUsd = Number(entry.totalSellUsd || 0);
    const realizedPnlUsd = Number(entry.realizedPnlUsd || 0);

    return buyCount > 0
        || sellCount > 0
        || totalBuyUsd > 0
        || totalSellUsd > 0
        || realizedPnlUsd !== 0;
}

function getChainConfigForFallback(chain: string) {
    const chainId = CHAIN_ID_BY_SLUG[String(chain || '').toLowerCase()];
    return chainId ? CHAINS[chainId] : null;
}

function isQuoteTransferForFallback(chain: string, transfer: any): boolean {
    const symbol = String(transfer?.asset || '').toUpperCase();
    if (symbol && (STABLE_SYMBOLS.has(symbol) || NATIVE_SYMBOLS.has(symbol))) {
        return true;
    }

    const tokenAddress = String(transfer?.rawContract?.address || '').toLowerCase();
    if (!tokenAddress) return false;

    const chainConfig = getChainConfigForFallback(chain);
    if (!chainConfig) return false;

    const quoteAddresses = new Set([
        String(chainConfig.wrappedNativeAddress || '').toLowerCase(),
        ...(chainConfig.stablecoins || []).map((address) => String(address).toLowerCase()),
    ].filter(Boolean));

    return quoteAddresses.has(tokenAddress);
}

async function estimateSingleTokenPnlFromTransfers(
    walletAddress: string,
    chain: string,
    days: number,
    tokenAddress: string
): Promise<ManualTokenBreakdownEntry | null> {
    const normalizedWallet = String(walletAddress || '').toLowerCase();
    const normalizedToken = String(tokenAddress || '').toLowerCase();
    if (!normalizedWallet || !normalizedToken) return null;

    const transfers = await getAssetTransfers(normalizedWallet, chain, {
        maxCount: MANUAL_FALLBACK_MAX_TRANSFERS,
        category: ['erc20', 'external'],
        order: 'desc',
    });

    if (!Array.isArray(transfers) || transfers.length === 0) {
        return null;
    }

    const startMs = Date.now() - days * 24 * 60 * 60 * 1000;
    const filteredTransfers = transfers.filter((transfer) => {
        const rawTimestamp = transfer?.metadata?.blockTimestamp;
        if (!rawTimestamp) return true;
        const parsed = Date.parse(rawTimestamp);
        return Number.isFinite(parsed) ? parsed >= startMs : true;
    });

    const groups = new Map<string, any[]>();
    for (const transfer of filteredTransfers) {
        const hash = String(transfer?.hash || '');
        if (!hash) continue;
        if (!groups.has(hash)) groups.set(hash, []);
        groups.get(hash)!.push(transfer);
    }

    const chainId = getChainConfigForFallback(chain)?.id;
    const nativeUsd = chainId ? await getNativeTokenPriceUsd(chainId).catch(() => 0) : 0;
    const tokenDetails = await getTokenDetails(chain, normalizedToken).catch(() => null);
    const currentTokenPrice = Number(tokenDetails?.price || 0);
    const position = {
        totalAmount: 0,
        totalCostUsd: 0,
        totalBuyUsd: 0,
        totalSellUsd: 0,
        realizedPnlUsd: 0,
        buyCount: 0,
        sellCount: 0,
        symbol: tokenDetails?.symbol || null,
    };

    const sortedGroups = Array.from(groups.entries()).sort((a, b) => {
        const aRaw = a[1][0]?.metadata?.blockTimestamp;
        const bRaw = b[1][0]?.metadata?.blockTimestamp;
        const aTs = aRaw ? Date.parse(aRaw) : 0;
        const bTs = bRaw ? Date.parse(bRaw) : 0;
        return aTs - bTs;
    });

    for (const [, group] of sortedGroups) {
        const baseTransfers = group.filter((transfer) => isQuoteTransferForFallback(chain, transfer));
        const targetTransfers = group.filter((transfer) =>
            String(transfer?.rawContract?.address || '').toLowerCase() === normalizedToken
        );
        if (targetTransfers.length === 0) continue;

        let quoteUsdIn = 0;
        let quoteUsdOut = 0;
        for (const transfer of baseTransfers) {
            const amount = Number(transfer?.value || 0);
            if (!(amount > 0)) continue;

            const symbol = String(transfer?.asset || '').toUpperCase();
            let usdValue = 0;
            if (STABLE_SYMBOLS.has(symbol)) usdValue = amount;
            else if (NATIVE_SYMBOLS.has(symbol)) usdValue = amount * nativeUsd;
            if (!(usdValue > 0)) continue;

            const from = String(transfer?.from || '').toLowerCase();
            const to = String(transfer?.to || '').toLowerCase();
            if (to === normalizedWallet) quoteUsdIn += usdValue;
            if (from === normalizedWallet) quoteUsdOut += usdValue;
        }

        for (const transfer of targetTransfers) {
            const amount = Number(transfer?.value || 0);
            if (!(amount > 0)) continue;

            const isIncoming = String(transfer?.to || '').toLowerCase() === normalizedWallet;
            const cashflowUsd = isIncoming ? quoteUsdOut : quoteUsdIn;
            const unitPrice = cashflowUsd > 0 ? cashflowUsd / amount : currentTokenPrice;
            const totalValueUsd = amount * unitPrice;
            if (!(totalValueUsd > 0)) continue;

            if (isIncoming) {
                position.totalAmount += amount;
                position.totalCostUsd += totalValueUsd;
                position.totalBuyUsd += totalValueUsd;
                position.buyCount += 1;
            } else if (position.totalAmount > 0) {
                const avgCostUsd = position.totalCostUsd / position.totalAmount;
                const costOfSoldUsd = amount * avgCostUsd;
                const realizedPnlUsd = totalValueUsd - costOfSoldUsd;

                position.realizedPnlUsd += realizedPnlUsd;
                position.totalSellUsd += totalValueUsd;
                position.totalAmount -= amount;
                position.totalCostUsd -= costOfSoldUsd;
                position.sellCount += 1;
            }
        }
    }

    if (
        position.buyCount === 0
        && position.sellCount === 0
        && !(position.totalBuyUsd > 0)
        && !(position.totalSellUsd > 0)
    ) {
        return null;
    }

    return {
        address: normalizedToken,
        symbol: position.symbol || undefined,
        totalBuyUsd: position.totalBuyUsd,
        totalSellUsd: position.totalSellUsd,
        realizedPnlUsd: position.realizedPnlUsd,
        buyCount: position.buyCount,
        sellCount: position.sellCount,
    };
}

async function applyManualTokenPnlFallback(
    wallets: BatchWalletPnlResult[],
    chain: string,
    days: number,
    tokenAddress: string,
    deps: AnalysisDeps
): Promise<BatchWalletPnlResult[]> {
    const fallbackCandidates = wallets.filter((wallet) =>
        wallet.coverage === 'batch_wallet_list_sql_no_coverage'
        || wallet.coverage === 'batch_wallet_list_sql_partial_cost_basis'
    );

    if (fallbackCandidates.length === 0) {
        return wallets;
    }

    const limiter = pLimit(MANUAL_FALLBACK_CONCURRENCY);
    const patched = new Map<string, BatchWalletPnlResult>();

    await Promise.all(
        fallbackCandidates.map((wallet) =>
            limiter(async () => {
                try {
                    let tokenEntry = await deps.estimateSingleTokenPnlFromTransfers(wallet.address, chain, days, tokenAddress);
                    if (!canUseManualTokenBreakdown(tokenEntry)) return;

                    const totalBuyUsd = normalizeNullableFiniteNumber(tokenEntry?.totalBuyUsd);
                    const totalSellUsd = normalizeNullableFiniteNumber(tokenEntry?.totalSellUsd);
                    const realizedPnlUsd = normalizeNullableFiniteNumber(tokenEntry?.realizedPnlUsd);
                    const buyTradeCount = Math.max(0, Math.trunc(Number(tokenEntry?.buyCount || 0)));
                    const sellTradeCount = Math.max(0, Math.trunc(Number(tokenEntry?.sellCount || 0)));
                    const profitPct = totalBuyUsd && realizedPnlUsd !== null
                        ? (realizedPnlUsd / totalBuyUsd) * 100
                        : null;

                    patched.set(wallet.address.toLowerCase(), {
                        ...wallet,
                        source: 'hybrid_analysis',
                        tokenSymbol: wallet.tokenSymbol || tokenEntry?.symbol || null,
                        totalBuyUsd,
                        totalSellUsd,
                        realizedPnlUsd,
                        profitPct,
                        buyTradeCount,
                        sellTradeCount,
                        coverage: 'batch_wallet_manual_transfer_cost_basis',
                    });
                } catch (error: any) {
                    logger.warn(LogCode.API_FETCH_FAILED, 'Manual token PNL fallback failed for wallet', {
                        wallet: wallet.address,
                        chain,
                        tokenAddress,
                        error: error?.message || String(error),
                    });
                }
            })
        )
    );

    return wallets.map((wallet) => patched.get(wallet.address.toLowerCase()) || wallet);
}

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
    addresses: string[],
    chain: string,
    days: number,
    profile: BatchQueryProfile,
    tokenAddress: string | null,
    deps: AnalysisDeps = {
        getBatchWalletTokenPnlFromDune: duneBatchPnlService.getBatchWalletTokenPnlFromDune,
        getBatchWalletPortfolioPnlFromDune: duneBatchPnlService.getBatchWalletPortfolioPnlFromDune,
        estimateSingleTokenPnlFromTransfers,
    }
): Promise<BatchWalletPnlResult[]> {
    if (profile === 'wallet_token_pnl_analysis') {
        if (!tokenAddress) return [];
        const tokens = await deps.getBatchWalletTokenPnlFromDune(addresses, chain, days, tokenAddress);
        const wallets: BatchWalletPnlResult[] = tokens.map((token) => ({
            address: token.walletAddress,
            source: 'dune_analysis',
            profile,
            realizedPnlUsd: token.realizedPnlUsd,
            totalBuyUsd: token.totalBuyUsd,
            totalSellUsd: token.totalSellUsd,
            profitPct: token.profitPct,
            totalTrades: null,
            tokenAddress: token.tokenAddress,
            tokenSymbol: token.tokenSymbol,
            buyTradeCount: token.buyTradeCount,
            sellTradeCount: token.sellTradeCount,
            coverage: token.coverage,
        }));
        return applyManualTokenPnlFallback(wallets, chain, days, tokenAddress, deps);
    }

    const portfolios = await deps.getBatchWalletPortfolioPnlFromDune(addresses, chain, days);
    return portfolios.map((portfolio) => ({
        address: portfolio.walletAddress,
        source: 'dune_analysis',
        profile,
        realizedPnlUsd: portfolio.realizedPnlUsd,
        totalBuyUsd: portfolio.totalBuyUsd,
        totalSellUsd: portfolio.totalSellUsd,
        profitPct: portfolio.profitPct,
        totalTrades: portfolio.totalTrades,
        tokenAddress: null,
        tokenSymbol: null,
        buyTradeCount: null,
        sellTradeCount: null,
        coverage: portfolio.coverage,
    }));
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
                    description: 'Wallet addresses to analyze in one Dune batch query.',
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
                    description: 'Maximum number of wallets to process from input list. Default 50.',
                    default: 50
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

            const requestedLimit = Number(args.limit) || 50;
            const cap = Math.max(1, requestedLimit);
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
                analyzing: validAddresses.length,
                executionMode: 'single_batch_query',
            });

            const start = Date.now();
            let wallets = await fetchWalletAnalysisResult(validAddresses, chain, days, profile, tokenAddress);
            const elapsedMs = Date.now() - start;

            if (typeof minRealized === 'number') {
                wallets = wallets.filter(w => typeof w.realizedPnlUsd === 'number' && w.realizedPnlUsd >= minRealized);
            }

            wallets.sort((a, b) => {
                if (sortBy === 'total_buy_desc') return (b.totalBuyUsd || 0) - (a.totalBuyUsd || 0);
                if (sortBy === 'profit_pct_desc') return (b.profitPct ?? Number.NEGATIVE_INFINITY) - (a.profitPct ?? Number.NEGATIVE_INFINITY);
                return (b.realizedPnlUsd ?? Number.NEGATIVE_INFINITY) - (a.realizedPnlUsd ?? Number.NEGATIVE_INFINITY);
            });

            return {
                success: true,
                chain,
                days,
                timeRange: formatTimeRange(days),
                profile,
                requestedTokenAddress: tokenAddress,
                requestedCount,
                analyzedCount: validAddresses.length,
                returnedCount: wallets.length,
                invalidAddresses,
                scope: buildBatchPnlScope(chain, days, profile, tokenAddress),
                coverage: {
                    provider: 'dune',
                    coverage: 'batch_wallet_list_sql',
                    supportedAnswer: profile === 'wallet_token_pnl_analysis'
                        ? 'single_token_recent_window_realized_trading_pnl_ranking'
                        : 'portfolio_recent_window_realized_dex_trading_pnl_ranking',
                    unsupportedAnswers: ['wallet_total_pnl', 'unrealized_pnl', 'native_balance_pnl', 'bridge_or_defi_pnl'],
                },
                warnings: buildBatchPnlWarnings(wallets),
                answerPolicy: buildBatchPnlAnswerPolicy(buildBatchPnlWarnings(wallets)),
                meta: {
                    source: 'dune_analysis',
                    sortBy,
                    minRealizedPnlUsd: typeof minRealized === 'number' ? minRealized : null,
                    batchElapsedMs: elapsedMs,
                    coverage: 'batch_wallet_list_sql',
                    executionMode: 'single_batch_query',
                    failedCount: 0,
                    failedAddresses: [],
                    note: profile === 'wallet_token_pnl_analysis'
                        ? 'Batch token analysis now runs one Dune SQL execution for the full wallet list. Wallets without matching DEX trades are marked as no_coverage, sell-only windows are marked as partial_cost_basis, and incomplete wallets may be upgraded by transfer-based manual cost reconstruction.'
                        : 'Batch portfolio analysis now runs one Dune SQL execution for the full wallet list, then applies the same quote-token exclusion semantics before aggregating per wallet.',
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
                    buyTradeCount: w.buyTradeCount,
                    sellTradeCount: w.sellTradeCount,
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
