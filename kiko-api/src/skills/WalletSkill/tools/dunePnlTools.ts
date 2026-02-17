import { Tool } from '../../../tooling/registry.js';
import * as dunePnlService from '../../../services/dunePnlService.js';
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

/**
 * Dune PNL Tool
 * Allows the AI to analyze wallet trading profitability using Dune Analytics data.
 */
export const AnalyzeWalletPnlTool: Tool = {
    definition: {
        name: 'analyze_wallet_pnl',
        description: 'Analyze wallet trading performance (PNL, win rate, top tokens) using Dune Analytics. Provides real-time realized PNL data for EVM chains.',
        parameters: {
            type: 'object',
            properties: {
                address: {
                    type: 'string',
                    description: 'The wallet address to analyze (EVM only).',
                },
                chain: {
                    type: 'string',
                    description: 'Blockchain network (ethereum, base, bnb, polygon, arbitrum, optimism). If not provided, will check Ethereum or the current context chain.',
                },
                chain_id: {
                    type: 'number',
                    description: 'Numeric chain ID (preferred when available), e.g. 1, 8453, 56.',
                },
                days: {
                    type: 'number',
                    description: 'Time range for analysis in days: 1 (=24H), 7 (=7D), 30 (=30D). Default is 30.',
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

            logger.info(LogCode.AI_TOOL_USED, `Analyzing PNL via Dune`, { address, chain, days });

            if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
                return {
                    error: `Invalid EVM wallet address: ${address}`
                };
            }

            if (![1, 7, 30].includes(Number(days))) {
                return {
                    error: `Unsupported time range: ${days} days. Supported: 24H(1), 7D(7), 30D(30).`
                };
            }

            const duneChain = chain;
            let result: Awaited<ReturnType<typeof dunePnlService.getWalletPnlFromDune>> | null = null;
            try {
                result = await dunePnlService.getWalletPnlFromDune(address, duneChain, days);
            } catch (e: any) {
                logger.warn(LogCode.API_FETCH_FAILED, 'Dune fetch failed, falling back to manual PNL', { error: e?.message || e });
            }

            if (!result) {
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
            }

            return {
                address: result.walletAddress,
                chain: result.chain,
                timeRange: formatTimeRange(days),
                summary: {
                    totalRealizedPnlUsd: result.totalRealizedPnlUsd,
                    totalRealizedProfitUsd: result.totalRealizedProfitUsd,
                    totalRealizedLossUsd: result.totalRealizedLossUsd,
                    tradingPnlUsd: result.tradingPnlUsd,

                    totalBoughtUsd: result.totalBoughtUsd,
                    totalSoldUsd: result.totalSoldUsd,
                    winRate: result.winRate,
                    tradingWinRate: result.tradingWinRate,
                    totalTrades: result.totalTrades,
                    profitableTrades: result.profitableTrades
                },
                topTokens: result.tokens.map(t => ({
                    token: t.tokenSymbol || t.tokenAddress,
                    address: t.tokenAddress,
                    pnlUsd: t.pnlUsd,
                    profitPercentage: t.profitPct !== null ? `${t.profitPct.toFixed(2)}%` : 'N/A',
                    boughtUsd: t.boughtUsd,
                    soldUsd: t.soldUsd
                }))
            };

        } catch (error: any) {
            logger.error(LogCode.SYS_ERROR, 'PnL Tool Error', { error: error.message });
            return { error: `Failed to analyze wallet PNL: ${error.message}` };
        }
    }
};
