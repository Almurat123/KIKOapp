import { Tool } from '../../../tooling/registry.js';
import * as zerionPnlService from '../../../services/zerionPnlService.js';
import * as duneWalletAnalysisService from '../../../services/duneWalletAnalysisService.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import { resolveChainInput } from '../../../utils/chainParam.js';

function formatTimeRange(days: number): string {
    if (days === 1) return '24H';
    return `${days}D`;
}

const DUNE_SUPPORTED_EVM_CHAINS = ['eth', 'base', 'bsc', 'polygon', 'arbitrum', 'optimism', 'avalanche'] as const;

function isEvmChain(chain: string): boolean {
    return chain !== 'solana';
}

function isValidEvmAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function isValidSolanaAddress(address: string): boolean {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

function buildChainSupport(chain: string) {
    return {
        requestedChain: chain,
        zerion: {
            configured: zerionPnlService.isZerionConfigured(),
            supported: zerionPnlService.canUseZerionForChain(chain),
            toolSupportedChains: zerionPnlService.getZerionToolSupportedChains(),
        },
        dune: {
            supported: isEvmChain(chain),
            toolSupportedChains: [...DUNE_SUPPORTED_EVM_CHAINS],
        },
    };
}

async function validateWalletPnlArgs(args: any, context?: any): Promise<{
    address: string;
    chain: string;
    days: number;
    chainSupport: ReturnType<typeof buildChainSupport>;
} | { error: string }> {
    const address = args.address;
    const resolved = resolveChainInput(args, {
        contextChainId: context?.chainId,
        defaultChain: 'eth',
    });
    if (resolved.invalidChainId) {
        return { error: `Unsupported chain_id: ${String(args.chain_id)}` };
    }
    const chain = resolved.chain;
    const days = args.days ?? 30;

    if (chain === 'solana' && !isValidSolanaAddress(address)) {
        return { error: `Invalid Solana wallet address: ${address}` };
    }

    if (isEvmChain(chain) && !isValidEvmAddress(address)) {
        return { error: `Invalid EVM wallet address: ${address}` };
    }

    if (![1, 7, 30].includes(Number(days))) {
        return {
            error: `Unsupported time range: ${days} days. Supported: 24H(1), 7D(7), 30D(30).`
        };
    }

    return {
        address,
        chain,
        days,
        chainSupport: buildChainSupport(chain),
    };
}

/**
 * Wallet PNL Summary Tool
 * Zerion-only wallet-level summary. No Dune/manual fallback mixed into the same response.
 */
export const AnalyzeWalletPnlTool: Tool = {
    definition: {
        name: 'analyze_wallet_pnl',
        description: 'Analyze wallet-level PNL summary using Zerion only. This is a fast portfolio summary tool, not a custom token-level analysis tool. It returns wallet-level realized/unrealized gain and invested capital using Zerion period buckets.',
        parameters: {
            type: 'object',
            properties: {
                address: {
                    type: 'string',
                    description: 'Wallet address to analyze (EVM or Solana).',
                },
                chain: {
                    type: 'string',
                    description: 'Blockchain network (ethereum, base, bnb, polygon, arbitrum, optimism, avalanche, fantom, solana). If not provided, defaults from context then ethereum.',
                },
                chain_id: {
                    type: 'number',
                    description: 'Numeric chain ID (preferred when available), e.g. 1, 8453, 56, 900.',
                },
                days: {
                    type: 'number',
                    description: 'Requested time range in days: 1 (=24H), 7 (=7D), 30 (=30D). Default is 30.',
                    enum: [1, 7, 30],
                    default: 30
                }
            },
            required: ['address']
        }
    },
    handler: async (args, context) => {
        try {
            const validated = await validateWalletPnlArgs(args, context);
            if ('error' in validated) {
                return { error: validated.error };
            }
            const { address, chain, days, chainSupport } = validated;

            logger.info(LogCode.AI_TOOL_USED, 'Analyzing wallet PNL summary with Zerion', { address, chain, days });
            if (!chainSupport.zerion.configured) {
                return {
                    meta: {
                        source: 'zerion_summary',
                        requestedDays: days,
                        chainSupport,
                    },
                    error: 'Zerion API key is not configured for wallet summary PnL.',
                    recommendation: 'Use this tool only for fast wallet-level summary after Zerion is configured.',
                };
            }

            if (!chainSupport.zerion.supported) {
                return {
                    meta: {
                        source: 'zerion_summary',
                        requestedDays: days,
                        chainSupport,
                    },
                    error: `Zerion wallet summary is not supported for chain ${chain}.`,
                    recommendation: 'Use the future analysis tool once a custom Dune query is configured for this workflow.',
                };
            }

            const zerionResult = await zerionPnlService.getWalletPnlFromZerion(address, chain, days);
            if (!zerionResult) {
                return {
                    meta: {
                        source: 'zerion_summary',
                        requestedDays: days,
                        chainSupport
                    },
                    error: 'Zerion wallet summary request failed or returned empty.',
                    recommendation: 'Use the future analysis tool for custom Dune analysis; this summary tool does not fall back to Dune by design.',
                };
            }

            return {
                address: zerionResult.walletAddress,
                chain: zerionResult.chain,
                timeRange: formatTimeRange(days),
                meta: {
                    source: 'zerion_summary',
                    requestedDays: days,
                    period: {
                        requestedDays: days,
                        providerPeriod: zerionResult.appliedPeriod,
                        exactDays: zerionResult.periodIsExactDays,
                    },
                    chainSupport,
                    providerLatencyMs: zerionResult.queryExecutionTimeMs,
                },
                summary: {
                    totalRealizedPnlUsd: zerionResult.realizedGainUsd,
                    totalRealizedProfitUsd: zerionResult.realizedGainUsd > 0 ? zerionResult.realizedGainUsd : 0,
                    totalRealizedLossUsd: zerionResult.realizedGainUsd < 0 ? zerionResult.realizedGainUsd : 0,
                    tradingPnlUsd: zerionResult.realizedGainUsd,
                    totalBoughtUsd: zerionResult.totalInvestedUsd,
                    totalSoldUsd: zerionResult.realizedCostBasisUsd + zerionResult.realizedGainUsd,
                    winRate: null,
                    tradingWinRate: null,
                    totalTrades: null,
                    profitableTrades: null,
                    totalGainUsd: zerionResult.totalGainUsd,
                    unrealizedGainUsd: zerionResult.unrealizedGainUsd,
                    totalFeeUsd: zerionResult.totalFeeUsd,
                    relativeRealizedGainPercentage: zerionResult.relativeRealizedGainPct,
                    relativeTotalGainPercentage: zerionResult.relativeTotalGainPct,
                    netInvestedUsd: zerionResult.netInvestedUsd,
                    coverage: 'wallet_level_summary_only'
                },
                topTokens: []
            };
        } catch (error: any) {
            logger.error(LogCode.SYS_ERROR, 'PnL Tool Error', { error: error.message });
            return { error: `Failed to analyze wallet PNL: ${error.message}` };
        }
    }
};

/**
 * Wallet PNL Analysis Tool
 * Reserved for custom Dune analysis query workflows.
 */
export const AnalyzeWalletPnlAnalysisTool: Tool = {
    definition: {
        name: 'analyze_wallet_pnl_analysis',
        description: 'Run custom wallet PNL analysis using a dedicated Dune query profile. This tool is intended for token-level or strategy-level analysis and requires a configured saved query. Use analyze_wallet_pnl for fast Zerion summary.',
        parameters: {
            type: 'object',
            properties: {
                address: {
                    type: 'string',
                    description: 'Wallet address to analyze (EVM only).',
                },
                chain: {
                    type: 'string',
                    description: 'Blockchain network (ethereum, base, bnb, polygon, arbitrum, optimism, avalanche).',
                },
                chain_id: {
                    type: 'number',
                    description: 'Numeric chain ID (preferred when available), e.g. 1, 8453, 56.',
                },
                days: {
                    type: 'number',
                    description: 'Requested time range in days. Default is 30.',
                    enum: [1, 7, 30],
                    default: 30
                },
                token_address: {
                    type: 'string',
                    description: 'Optional token contract to scope analysis to a single token.'
                },
                query_profile: {
                    type: 'string',
                    description: 'Custom Dune query profile identifier to use once configured.'
                }
            },
            required: ['address']
        }
    },
    handler: async (args, context) => {
        const validated = await validateWalletPnlArgs(args, context);
        if ('error' in validated) {
            return { error: validated.error };
        }
        const { address, chain, days, chainSupport } = validated;
        if (!isEvmChain(chain)) {
            return {
                error: `Custom Dune wallet PNL analysis is only supported for EVM chains. Received ${chain}.`,
                meta: {
                    source: 'dune_analysis',
                    requestedDays: days,
                    chainSupport,
                    expectedProvider: 'dune',
                },
            };
        }

        const tokenAddress = typeof args.token_address === 'string' ? args.token_address.trim() : '';
        const queryProfile = typeof args.query_profile === 'string' && args.query_profile.trim()
            ? args.query_profile.trim()
            : (tokenAddress ? 'wallet_token_pnl_analysis' : 'wallet_portfolio_token_breakdown');

        if (queryProfile === 'wallet_token_pnl_analysis') {
            if (!tokenAddress) {
                return {
                    error: 'token_address is required for wallet_token_pnl_analysis.',
                    meta: {
                        source: 'dune_analysis',
                        requestedDays: days,
                        chainSupport,
                        expectedProvider: 'dune',
                    },
                };
            }

            const tokenResult = await duneWalletAnalysisService.analyzeWalletTokenPnl(address, chain, days, tokenAddress);
            if (!tokenResult) {
                return {
                    status: 'no_data',
                    error: 'No token-level Dune row was found for this wallet/token/time range.',
                    address,
                    chain,
                    timeRange: formatTimeRange(days),
                    requested: {
                        tokenAddress,
                        queryProfile,
                    },
                    meta: {
                        source: 'dune_analysis',
                        requestedDays: days,
                        chainSupport,
                        expectedProvider: 'dune',
                        coverage: 'existing_wallet_breakdown_query',
                    },
                };
            }

            return {
                status: 'ok',
                address,
                chain,
                timeRange: formatTimeRange(days),
                requested: {
                    tokenAddress,
                    queryProfile,
                },
                meta: {
                    source: 'dune_analysis',
                    requestedDays: days,
                    chainSupport,
                    expectedProvider: 'dune',
                    coverage: tokenResult.coverage,
                    note: 'Current execution uses the existing wallet breakdown Dune query and filters the target token locally. Dedicated custom query is still recommended for efficiency.',
                },
                tokenAnalysis: tokenResult,
            };
        }

        if (queryProfile === 'wallet_portfolio_token_breakdown') {
            const limit = Math.max(1, Math.min(Number(args.limit) || 20, 100));
            const portfolio = await duneWalletAnalysisService.analyzeWalletPortfolioTokenBreakdown(address, chain, days, limit);
            if (!portfolio) {
                return {
                    status: 'no_data',
                    error: 'No Dune portfolio token breakdown was found for this wallet/time range.',
                    address,
                    chain,
                    timeRange: formatTimeRange(days),
                    requested: {
                        tokenAddress: tokenAddress || null,
                        queryProfile,
                    },
                    meta: {
                        source: 'dune_analysis',
                        requestedDays: days,
                        chainSupport,
                        expectedProvider: 'dune',
                    },
                };
            }

            return {
                status: 'ok',
                address,
                chain,
                timeRange: formatTimeRange(days),
                requested: {
                    tokenAddress: tokenAddress || null,
                    queryProfile,
                },
                meta: {
                    source: 'dune_analysis',
                    requestedDays: days,
                    chainSupport,
                    expectedProvider: 'dune',
                    coverage: portfolio.coverage,
                    note: 'Current execution uses the existing wallet breakdown Dune query. Dedicated custom query ids can later replace this path for better efficiency and richer fields.',
                },
                portfolioAnalysis: portfolio,
            };
        }

        return {
            status: 'unsupported_query_profile',
            error: `Unsupported query_profile: ${queryProfile}`,
            address,
            chain,
            timeRange: formatTimeRange(days),
            requested: {
                tokenAddress: tokenAddress || null,
                queryProfile,
            },
            meta: {
                source: 'dune_analysis',
                requestedDays: days,
                chainSupport,
                expectedProvider: 'dune',
            },
            requirements: {
                supportedProfiles: ['wallet_token_pnl_analysis', 'wallet_portfolio_token_breakdown'],
                optionalParameters: ['token_address', 'query_profile', 'limit'],
            },
            recommendation: 'Use wallet_token_pnl_analysis for single-token analysis or wallet_portfolio_token_breakdown for portfolio token analysis.'
        };
    }
};
