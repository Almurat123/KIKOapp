import { Tool } from '../../../tooling/registry.js';
import * as tokenAnalysis from '../../../services/tokenAnalysis.js';
import * as creatorAnalysis from '../../../services/creatorAnalysis.js';
import { resolveChainInput } from '../../../utils/chainParam.js';

function escapeMarkdownCell(value: unknown): string {
    return String(value ?? '')
        .replace(/\|/g, '\\|')
        .replace(/\r?\n/g, ' ')
        .trim();
}

function formatUsd(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

function formatPct(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '';
    return `${value.toFixed(2)}%`;
}

function resolveEarlyBuyerExpansionMode(args: {
    include_trade_progression?: boolean;
    include_token_pnl?: boolean;
}) {
    const includeTradeProgression = args.include_trade_progression === true;
    const includeTokenPnl = args.include_token_pnl === true;
    return {
        includeTradeProgression,
        includeTokenPnl,
        mode: includeTradeProgression || includeTokenPnl ? 'expanded' : 'fast_path' as 'expanded' | 'fast_path',
    };
}

function resolveEarlyBuyerFollowUpCapabilities(args: {
    chain: string;
    includeTokenPnl: boolean;
    tokenPnlPopulatedCount: number;
}) {
    const directProfitRanking =
        args.includeTokenPnl && args.tokenPnlPopulatedCount > 0
            ? 'ready_from_current_rows'
            : 'not_available_from_current_rows';
    const batchWalletPnlFollowup = args.chain === 'solana'
        ? 'unsupported'
        : 'requires_separate_batch_query';

    return {
        directProfitRanking,
        batchWalletPnlFollowup,
    } as const;
}

function buildEarlyBuyersMarkdownTable(rows: Array<{
    rank: number;
    address: string;
    timestamp?: string;
    amount?: string;
    txHash?: string;
    transferCount?: number | null;
    tokenPnl?: {
        source?: string | null;
        totalBuyUsd?: number | null;
        totalSellUsd?: number | null;
        realizedPnlUsd?: number | null;
        profitPct?: number | null;
    } | null;
    tradeProgression?: unknown;
}>): string {
    const header = [
        '| Rank | Wallet Address | First Buy Time (UTC) | Buy Amount | TX Hash | Transfer Count | Buy USD | Sell USD | Realized PnL | Profit % | PnL Source |',
        '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ];

    const body = rows.map((row) => [
        row.rank,
        escapeMarkdownCell(row.address),
        escapeMarkdownCell(row.timestamp || ''),
        escapeMarkdownCell(row.amount || ''),
        escapeMarkdownCell(row.txHash || ''),
        escapeMarkdownCell(row.transferCount ?? ''),
        escapeMarkdownCell(formatUsd(row.tokenPnl?.totalBuyUsd)),
        escapeMarkdownCell(formatUsd(row.tokenPnl?.totalSellUsd)),
        escapeMarkdownCell(formatUsd(row.tokenPnl?.realizedPnlUsd)),
        escapeMarkdownCell(formatPct(row.tokenPnl?.profitPct)),
        escapeMarkdownCell(row.tokenPnl?.source || ''),
    ].join(' | ')).map((line) => `| ${line} |`);

    return [...header, ...body].join('\n');
}

/**
 * Tool to get early buyers of a token
 */
export const GetEarlyBuyersTool: Tool = {
    definition: {
        name: 'get_early_buyers',
        description: 'Get the earliest buyers of a token, optionally within a precise time window. Default behavior is a fast path: return the early-buyer rows without wallet trade progression or token PnL enrichment. Only enable trade progression or token PnL when the user explicitly asks for wallet progression, profit ranking, or token-specific PnL. Use this after you know the token contract and, if relevant, the event/post time window you want to analyze. If you choose this tool, emit a real structured tool call immediately. Do not narrate "Calling get_early_buyers" in plain text. Use address plus optional start_time/end_time; do not invent timestamp_range or other unofficial fields. Early-buyer queries should default to full-list output for the returned rows, not a compressed summary. Use the returned rows or markdownTable to format the answer directly.',
        parameters: {
            type: 'object',
            properties: {
                address: {
                    type: 'string',
                    description: 'The token contract address.'
                },
                chain: {
                    type: 'string',
                    description: 'The blockchain (eth, base, bsc, solana, arbitrum, polygon, optimism).',
                    enum: ['eth', 'base', 'bsc', 'solana', 'arbitrum', 'polygon', 'optimism']
                },
                chain_id: {
                    type: 'number',
                    description: 'Numeric chain ID (preferred when available), e.g. 1, 8453, 56, 900.'
                },
                limit: {
                    type: 'number',
                    description: 'Number of early buyers to return (default 10, max 50).',
                    default: 10
                },
                start_time: {
                    type: 'string',
                    description: 'Optional inclusive start time. Use ISO datetime or unix seconds. Example: 2026-03-10T12:00:00Z.'
                },
                end_time: {
                    type: 'string',
                    description: 'Optional inclusive end time. Use ISO datetime or unix seconds. Example: 2026-03-10T13:00:00Z.'
                },
                include_trade_progression: {
                    type: 'boolean',
                    description: 'When true, attach first-buy / first-sell progression for each wallet by loading wallet trade history. Default false for fast-path early-buyer lookups.'
                },
                include_token_pnl: {
                    type: 'boolean',
                    description: 'When true on EVM chains, attempt token-specific wallet PnL for the same token. Use this for explicit profit-ranking / PnL follow-ups. Default false for fast-path early-buyer lookups.'
                },
                trade_history_limit: {
                    type: 'number',
                    description: 'How many wallet trade records to scan per wallet when include_trade_progression is enabled. Default 25, max 100.'
                },
                token_pnl_days: {
                    type: 'number',
                    description: 'Recent lookback window in days for token-specific wallet PnL on EVM chains. This is a recent-window metric, not since-first-buy or all-time. Default 30, max 365.'
                },
                min_token_amount: {
                    type: 'number',
                    description: 'Optional dust floor for token amount received during the early window.'
                }
            },
            required: ['address']
        }
    },
    handler: async ({ address, chain, chain_id, limit = 10, start_time, end_time, include_trade_progression, include_token_pnl, trade_history_limit, token_pnl_days, min_token_amount }, context) => {
        try {
            const resolved = resolveChainInput({ chain, chain_id }, {
                contextChainId: context?.chainId,
                defaultChain: 'eth',
            });
            if (resolved.invalidChainId) {
                return { success: false, error: `Unsupported chain_id: ${String(chain_id)}` };
            }

            const parseTime = (value?: string) => {
                if (!value) return undefined;
                const num = Number(value);
                if (!Number.isNaN(num)) {
                    return num < 1e12 ? num * 1000 : num;
                }
                const parsed = Date.parse(value);
                return Number.isNaN(parsed) ? undefined : parsed;
            };

            const startTimeMs = parseTime(start_time);
            const endTimeMs = parseTime(end_time);
            const boundedLimit = Math.max(1, Math.min(Number(limit) || 10, 50));
            const effectiveMinTokenAmount = (typeof min_token_amount === 'number' && Number.isFinite(min_token_amount))
                ? Number(min_token_amount)
                : 0;
            const expansionMode = resolveEarlyBuyerExpansionMode({
                include_trade_progression,
                include_token_pnl,
            });
            const includeTradeProgression = expansionMode.includeTradeProgression;
            const includeTokenPnl = expansionMode.includeTokenPnl && resolved.chain !== 'solana';
            const tradeHistoryLimit = Math.max(10, Math.min(100, Number(trade_history_limit) || 25));
            const tokenPnlDays = Math.max(1, Math.min(365, Number(token_pnl_days) || 30));

            let buyers = await tokenAnalysis.getEarlyBuyers(address, resolved.chain, boundedLimit, {
                includeTradeProgression,
                includeTokenPnl,
                tokenPnlDays,
                tradeHistoryLimit,
                startTimeMs,
                endTimeMs,
                minTokenAmount: effectiveMinTokenAmount > 0 ? effectiveMinTokenAmount : undefined,
            });

            if (!buyers || buyers.length === 0) {
                return {
                    success: false,
                    message: `No early buyers found for ${address} on ${resolved.chain}. Token may be too new or not have trading activity yet.`
                };
            }

            const tableRows = buyers.map((b, i) => ({
                rank: i + 1,
                address: b.address,
                timestamp: b.timestamp?.toISOString(),
                amount: b.amount,
                txHash: b.txHash,
                isSmart: b.isSmart,
                transferCount: b.transferCount ?? null,
                tokenPnl: b.tokenPnl ?? null,
                tradeProgression: b.tradeProgression ?? null
            }));
            const tokenPnlPopulatedCount = tableRows.filter((row) =>
                row.tokenPnl
                && (
                    row.tokenPnl.totalBuyUsd !== null
                    || row.tokenPnl.totalSellUsd !== null
                    || row.tokenPnl.realizedPnlUsd !== null
                    || row.tokenPnl.profitPct !== null
                )
            ).length;
            const tradeProgressionPopulatedCount = tableRows.filter((row) => row.tradeProgression).length;
            const followUpCapabilities = resolveEarlyBuyerFollowUpCapabilities({
                chain: resolved.chain,
                includeTokenPnl,
                tokenPnlPopulatedCount,
            });

            return {
                success: true,
                token: address,
                chain: resolved.chain,
                buyerCount: buyers.length,
                analysisMode: expansionMode.mode,
                presentation: {
                    outputMode: 'full_table',
                    includeTradeProgression,
                    includeTokenPnl,
                    tradeHistoryLimit: includeTradeProgression ? tradeHistoryLimit : null,
                    tokenPnlDays: includeTokenPnl ? tokenPnlDays : null,
                    tokenPnlScope: includeTokenPnl ? 'recent_window_only' : null,
                },
                notes: [
                    expansionMode.mode === 'fast_path'
                        ? 'Fast-path mode returns the earliest buyer rows first. Request trade progression or token PnL explicitly when you need deeper wallet analysis.'
                        : 'Expanded mode was requested for wallet-level enrichment on top of the early-buyer rows.',
                    'Early-buyer ranking still comes from first transfer timing, not profitability.',
                    includeTokenPnl
                        ? `Token PnL fields are token-specific wallet metrics for the same token over the recent ${tokenPnlDays}-day window, not since first buy or all-time.`
                        : 'Token PnL enrichment was not requested for this call.',
                    includeTokenPnl
                        ? (
                            tokenPnlPopulatedCount === 0
                                ? 'Token PnL enrichment was requested, but provider coverage returned no wallet-level token PnL rows for this result set.'
                                : 'PnL values may still be null for individual wallets when a provider cannot resolve token-level history.'
                        )
                        : null,
                    includeTradeProgression
                        ? (
                            tradeProgressionPopulatedCount === 0
                                ? 'Trade progression enrichment was requested, but no wallet trade history rows were resolved for these returned buyers.'
                                : 'Trade progression fields remain null for individual wallets when wallet trade history is unavailable.'
                        )
                        : null,
                    followUpCapabilities.directProfitRanking === 'ready_from_current_rows'
                        ? 'The current row set includes enough token PnL coverage to rank these wallets by recent-window profit directly.'
                        : 'Do not rank these wallets by profit from the current early-buyer rows alone. Use a separate batch wallet PnL query first if profit ranking is needed.',
                    followUpCapabilities.batchWalletPnlFollowup === 'unsupported'
                        ? 'Recent-window batch wallet PnL follow-up is not supported for this chain in the current toolset.'
                        : 'If the user asks for wallet profit/PnL next, use a separate recent-window batch wallet PnL query rather than inferring from blanks.',
                ].filter((note): note is string => Boolean(note)),
                filters: {
                    minTokenAmount: effectiveMinTokenAmount > 0 ? effectiveMinTokenAmount : null,
                },
                enrichment: {
                    tokenPnlRequested: includeTokenPnl,
                    tokenPnlPopulatedCount,
                    tokenPnlScope: includeTokenPnl ? 'recent_window_only' : null,
                    tokenPnlWindowDays: includeTokenPnl ? tokenPnlDays : null,
                    tradeProgressionRequested: includeTradeProgression,
                    tradeProgressionPopulatedCount,
                },
                followUpCapabilities,
                markdownTable: buildEarlyBuyersMarkdownTable(tableRows),
                earlyBuyers: tableRows
            };
        } catch (error: any) {
            console.error('[GetEarlyBuyers] Error:', error);
            return { success: false, error: error.message || 'Failed to fetch early buyers' };
        }
    }
};

/**
 * Tool to analyze the creator/deployer of a token
 */
export const AnalyzeCreatorTool: Tool = {
    definition: {
        name: 'analyze_creator',
        description: 'Analyze the creator/deployer of a token for risk signals. Checks wallet age, transaction history, mixer funding, and generates a risk profile.',
        parameters: {
            type: 'object',
            properties: {
                creatorAddress: {
                    type: 'string',
                    description: 'The wallet address of the token creator/deployer'
                },
                chain: {
                    type: 'string',
                    description: 'The blockchain (eth, base, bsc, arbitrum, polygon, optimism)',
                    enum: ['eth', 'base', 'bsc', 'arbitrum', 'polygon', 'optimism']
                },
                chain_id: {
                    type: 'number',
                    description: 'Numeric chain ID (preferred when available), e.g. 1, 8453, 56'
                }
            },
            required: ['creatorAddress']
        }
    },
    handler: async ({ creatorAddress, chain, chain_id }, context) => {
        try {
            const resolved = resolveChainInput({ chain, chain_id }, {
                contextChainId: context?.chainId,
                defaultChain: 'eth',
            });
            if (resolved.invalidChainId) {
                return { success: false, error: `Unsupported chain_id: ${String(chain_id)}` };
            }

            const profile = await creatorAnalysis.analyzeDeployer(creatorAddress, resolved.chain);

            if (!profile) {
                return {
                    success: false,
                    message: 'Could not analyze creator address. May be invalid or null address.'
                };
            }

            return {
                success: true,
                creatorAddress: profile.address,
                chain: resolved.chain,
                riskLevel: profile.riskLevel,
                riskScore: profile.riskScore,
                tags: profile.tags,
                details: {
                    transactionCount: profile.details.txCount,
                    firstTransactionDate: profile.details.firstTxDate,
                    isMixerFunded: profile.details.isMixerFunded,
                    balance: profile.details.deployerBalance
                }
            };
        } catch (error: any) {
            console.error('[AnalyzeCreator] Error:', error);
            return { success: false, error: error.message || 'Failed to analyze creator' };
        }
    }
};

export const __testOnly = {
    buildEarlyBuyersMarkdownTable,
    resolveEarlyBuyerExpansionMode,
    resolveEarlyBuyerFollowUpCapabilities,
};
