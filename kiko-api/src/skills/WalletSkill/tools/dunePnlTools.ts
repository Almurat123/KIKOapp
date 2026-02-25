import { Tool } from '../../../tooling/registry.js';
import * as dunePnlService from '../../../services/dunePnlService.js';
import * as zerionPnlService from '../../../services/zerionPnlService.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import { resolveChainInput } from '../../../utils/chainParam.js';

function normalizePnlChain(chain: string): string {
    const lower = chain.toLowerCase();
    if (lower === 'ethereum' || lower === 'eth') return 'eth';
    if (lower === 'base') return 'base';
    if (lower === 'bnb' || lower === 'bsc') return 'bsc';
    if (lower === 'polygon' || lower === 'matic') return 'polygon';
    if (lower === 'arbitrum' || lower === 'arb') return 'arbitrum';
    if (lower === 'optimism' || lower === 'op') return 'optimism';
    return lower;
}

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

/**
 * Wallet PNL Tool
 * Provider order: Zerion (primary) -> Dune (fallback for EVM) -> Manual (final fallback for EVM)
 */
export const AnalyzeWalletPnlTool: Tool = {
    definition: {
        name: 'analyze_wallet_pnl',
        description: 'Analyze wallet PNL with provider fallback. Uses Zerion first (fast wallet-level PNL), falls back to Dune for EVM detailed metrics, then manual calculation if needed.',
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
            const fallbackTrace: string[] = [];

            logger.info(LogCode.AI_TOOL_USED, 'Analyzing wallet PNL with provider fallback strategy', { address, chain, days });

            if (chain === 'solana' && !isValidSolanaAddress(address)) {
                return {
                    error: `Invalid Solana wallet address: ${address}`
                };
            }

            if (isEvmChain(chain) && !isValidEvmAddress(address)) {
                return {
                    error: `Invalid EVM wallet address: ${address}`
                };
            }

            if (![1, 7, 30].includes(Number(days))) {
                return {
                    error: `Unsupported time range: ${days} days. Supported: 24H(1), 7D(7), 30D(30).`
                };
            }

            const chainSupport = {
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

            // 1) Primary provider: Zerion
            let zerionResult: Awaited<ReturnType<typeof zerionPnlService.getWalletPnlFromZerion>> | null = null;
            let zerionAttempted = false;
            if (chainSupport.zerion.configured && chainSupport.zerion.supported) {
                zerionAttempted = true;
                zerionResult = await zerionPnlService.getWalletPnlFromZerion(address, chain, days);
            } else {
                fallbackTrace.push('zerion_not_configured_or_chain_unsupported');
            }

            if (zerionResult) {
                return {
                    address: zerionResult.walletAddress,
                    chain: zerionResult.chain,
                    timeRange: formatTimeRange(days),
                    meta: {
                        source: 'zerion',
                        fallbackUsed: fallbackTrace.length > 0,
                        fallbackTrace,
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
            }

            if (zerionAttempted) {
                fallbackTrace.push('zerion_request_failed_or_empty');
            }

            // 2) Fallback provider: Dune (EVM only)
            let duneResult: Awaited<ReturnType<typeof dunePnlService.getWalletPnlFromDune>> | null = null;
            if (isEvmChain(chain)) {
                try {
                    duneResult = await dunePnlService.getWalletPnlFromDune(address, chain, days);
                } catch (e: any) {
                    logger.warn(LogCode.API_FETCH_FAILED, 'Dune fetch failed, trying manual PNL fallback', {
                        error: e?.message || e,
                        chain,
                    });
                }
            } else {
                fallbackTrace.push('dune_not_supported_for_non_evm');
            }

            if (duneResult) {
                return {
                    address: duneResult.walletAddress,
                    chain: duneResult.chain,
                    timeRange: formatTimeRange(days),
                    meta: {
                        source: 'dune',
                        fallbackUsed: true,
                        fallbackTrace,
                        requestedDays: days,
                        period: {
                            requestedDays: days,
                            providerPeriod: `${days}d`,
                            exactDays: true,
                        },
                        chainSupport,
                        providerLatencyMs: duneResult.queryExecutionTimeMs,
                    },
                    summary: {
                        totalRealizedPnlUsd: duneResult.totalRealizedPnlUsd,
                        totalRealizedProfitUsd: duneResult.totalRealizedProfitUsd,
                        totalRealizedLossUsd: duneResult.totalRealizedLossUsd,
                        tradingPnlUsd: duneResult.tradingPnlUsd,

                        totalBoughtUsd: duneResult.totalBoughtUsd,
                        totalSoldUsd: duneResult.totalSoldUsd,
                        winRate: duneResult.winRate,
                        tradingWinRate: duneResult.tradingWinRate,
                        totalTrades: duneResult.totalTrades,
                        profitableTrades: duneResult.profitableTrades
                    },
                    topTokens: duneResult.tokens.map(t => ({
                        token: t.tokenSymbol || t.tokenAddress,
                        address: t.tokenAddress,
                        pnlUsd: t.pnlUsd,
                        profitPercentage: t.profitPct !== null ? `${t.profitPct.toFixed(2)}%` : 'N/A',
                        boughtUsd: t.boughtUsd,
                        soldUsd: t.soldUsd
                    }))
                };
            }

            fallbackTrace.push('dune_request_failed_or_empty');

            // 3) Final fallback: manual calculation (EVM only)
            if (!isEvmChain(chain)) {
                return {
                    error: `No fallback provider available for chain ${chain}. Zerion request failed.`,
                    meta: {
                        source: 'none',
                        fallbackUsed: true,
                        fallbackTrace,
                        requestedDays: days,
                        period: {
                            requestedDays: days,
                            providerPeriod: 'n/a',
                            exactDays: false,
                        },
                        chainSupport
                    }
                };
            }

            try {
                const alchemyChain = normalizePnlChain(chain);
                const { calculateWalletPnlManual } = await import('../../../services/pnlCalculationService.js');
                const manual = await calculateWalletPnlManual(address, alchemyChain, days);

                const topTokens = Object.values(manual.tokenBreakdown)
                    .sort((a, b) => Math.abs(b.realizedPnlUsd) - Math.abs(a.realizedPnlUsd))
                    .slice(0, 20)
                    .map(t => ({
                        token: t.symbol || t.address,
                        address: t.address,
                        pnlUsd: t.realizedPnlUsd,
                        profitPercentage: 'N/A',
                        boughtUsd: t.totalBuyUsd,
                        soldUsd: t.totalSellUsd
                    }));

                return {
                    address,
                    chain,
                    timeRange: formatTimeRange(days),
                    meta: {
                        source: 'manual',
                        fallbackUsed: true,
                        fallbackTrace,
                        requestedDays: days,
                        period: {
                            requestedDays: days,
                            providerPeriod: `${days}d`,
                            exactDays: true,
                        },
                        chainSupport
                    },
                    summary: {
                        totalRealizedPnlUsd: manual.totalRealizedPnlUsd,
                        totalRealizedProfitUsd: manual.totalRealizedProfitUsd,
                        totalRealizedLossUsd: manual.totalRealizedLossUsd,
                        tradingPnlUsd: manual.totalRealizedPnlUsd,

                        totalBoughtUsd: manual.totalBoughtUsd,
                        totalSoldUsd: manual.totalSoldUsd,
                        winRate: manual.winRate,
                        tradingWinRate: manual.winRate,
                        totalTrades: manual.totalTrades,
                        profitableTrades: manual.profitableTrades
                    },
                    topTokens
                };
            } catch (manualErr: any) {
                logger.error(LogCode.API_FETCH_FAILED, 'Manual PNL fallback failed', {
                    chain,
                    error: manualErr?.message || String(manualErr),
                });
                return {
                    error: 'All PNL providers failed for this request.',
                    meta: {
                        source: 'none',
                        fallbackUsed: true,
                        fallbackTrace: [...fallbackTrace, 'manual_request_failed'],
                        requestedDays: days,
                        period: {
                            requestedDays: days,
                            providerPeriod: `${days}d`,
                            exactDays: true,
                        },
                        chainSupport
                    }
                };
            }

        } catch (error: any) {
            logger.error(LogCode.SYS_ERROR, 'PnL Tool Error', { error: error.message });
            return { error: `Failed to analyze wallet PNL: ${error.message}` };
        }
    }
};
