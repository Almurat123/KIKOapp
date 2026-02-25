import pLimit from 'p-limit';
import { Tool } from '../../../tooling/registry.js';
import { resolveChainInput } from '../../../utils/chainParam.js';
import * as zerionPnlService from '../../../services/zerionPnlService.js';
import * as dunePnlService from '../../../services/dunePnlService.js';
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

type BatchWalletPnlResult = {
    address: string;
    source: 'zerion' | 'dune';
    realizedPnlUsd: number;
    totalGainUsd: number;
    winRate: number | null;
    totalTrades: number | null;
    coverage: 'wallet_level_summary_only' | 'token_level_breakdown';
    providerLatencyMs: number;
    fallbackTrace: string[];
};

async function fetchWalletPnlWithFallback(
    address: string,
    chain: string,
    days: number
): Promise<BatchWalletPnlResult | null> {
    const fallbackTrace: string[] = [];

    // Strict fallback strategy per wallet: Zerion first, Dune only if Zerion fails.
    if (zerionPnlService.isZerionConfigured() && zerionPnlService.canUseZerionForChain(chain)) {
        const zerion = await zerionPnlService.getWalletPnlFromZerion(address, chain, days);
        if (zerion) {
            return {
                address,
                source: 'zerion',
                realizedPnlUsd: zerion.realizedGainUsd,
                totalGainUsd: zerion.totalGainUsd,
                winRate: null,
                totalTrades: null,
                coverage: 'wallet_level_summary_only',
                providerLatencyMs: zerion.queryExecutionTimeMs,
                fallbackTrace,
            };
        }
        fallbackTrace.push('zerion_request_failed_or_empty');
    } else {
        fallbackTrace.push('zerion_not_configured_or_chain_unsupported');
    }

    if (!isEvmChain(chain)) {
        return null;
    }

    const dune = await dunePnlService.getWalletPnlFromDune(address, chain, days);
    if (!dune) {
        return null;
    }

    return {
        address,
        source: 'dune',
        realizedPnlUsd: dune.totalRealizedPnlUsd,
        totalGainUsd: dune.totalRealizedPnlUsd,
        winRate: dune.winRate,
        totalTrades: dune.totalTrades,
        coverage: 'token_level_breakdown',
        providerLatencyMs: dune.queryExecutionTimeMs,
        fallbackTrace,
    };
}

export const AnalyzeWalletPnlBatchTool: Tool = {
    definition: {
        name: 'analyze_wallet_pnl_batch',
        description: 'Batch-analyze PNL for multiple wallets (ideal after early-buyer discovery). Per wallet uses strict fallback: Zerion first, Dune only on Zerion failure.',
        parameters: {
            type: 'object',
            properties: {
                addresses: {
                    type: 'array',
                    description: 'Wallet addresses to analyze (EVM or Solana). Recommended 5-20 addresses per call.',
                    items: { type: 'string' }
                },
                chain: {
                    type: 'string',
                    description: 'Blockchain network (ethereum, base, bnb, polygon, arbitrum, optimism, avalanche, fantom, solana).',
                },
                chain_id: {
                    type: 'number',
                    description: 'Numeric chain ID (preferred), e.g. 1, 8453, 56, 900.',
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
                min_realized_pnl_usd: {
                    type: 'number',
                    description: 'Optional filter to keep only wallets with realized PNL >= this value.'
                },
                sort_by: {
                    type: 'string',
                    description: 'Ranking sort key.',
                    enum: ['realized_pnl_desc', 'total_gain_desc'],
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
            const sortBy = (args.sort_by === 'total_gain_desc' ? 'total_gain_desc' : 'realized_pnl_desc') as 'realized_pnl_desc' | 'total_gain_desc';

            logger.info(LogCode.AI_TOOL_USED, 'Analyzing wallet PNL batch', {
                chain,
                days,
                requestedCount,
                analyzing: validAddresses.length
            });

            // Keep concurrency conservative to reduce provider 429 on free-tier API keys.
            const limitRun = pLimit(2);
            const start = Date.now();
            const settled = await Promise.all(
                validAddresses.map(address =>
                    limitRun(async () => {
                        const result = await fetchWalletPnlWithFallback(address, chain, days);
                        return { address, result };
                    })
                )
            );
            const elapsedMs = Date.now() - start;

            let wallets = settled
                .filter(item => !!item.result)
                .map(item => item.result as BatchWalletPnlResult);

            if (typeof minRealized === 'number') {
                wallets = wallets.filter(w => w.realizedPnlUsd >= minRealized);
            }

            wallets.sort((a, b) => {
                if (sortBy === 'total_gain_desc') return b.totalGainUsd - a.totalGainUsd;
                return b.realizedPnlUsd - a.realizedPnlUsd;
            });

            const sourceBreakdown = wallets.reduce((acc, w) => {
                acc[w.source] = (acc[w.source] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            const failedCount = validAddresses.length - wallets.length;
            if (failedCount > 0) {
                sourceBreakdown.failed = failedCount;
            }

            return {
                success: true,
                chain,
                days,
                timeRange: days === 1 ? '24H' : `${days}D`,
                requestedCount,
                analyzedCount: validAddresses.length,
                returnedCount: wallets.length,
                invalidAddresses,
                sourceBreakdown,
                meta: {
                    strictFallbackPerWallet: true,
                    sortBy,
                    minRealizedPnlUsd: typeof minRealized === 'number' ? minRealized : null,
                    batchElapsedMs: elapsedMs
                },
                wallets: wallets.map((w, i) => ({
                    rank: i + 1,
                    address: w.address,
                    source: w.source,
                    realizedPnlUsd: w.realizedPnlUsd,
                    totalGainUsd: w.totalGainUsd,
                    winRate: w.winRate,
                    totalTrades: w.totalTrades,
                    coverage: w.coverage,
                    providerLatencyMs: w.providerLatencyMs,
                    fallbackTrace: w.fallbackTrace
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
