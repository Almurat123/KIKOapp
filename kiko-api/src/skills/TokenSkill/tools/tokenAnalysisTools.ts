import { Tool } from '../../../tooling/registry.js';
import * as tokenAnalysis from '../../../services/tokenAnalysis.js';
import * as creatorAnalysis from '../../../services/creatorAnalysis.js';
import { resolveChainInput } from '../../../utils/chainParam.js';
import type { RenderContract } from '../../../jobs/chat/contracts.js';

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

function buildEarlyBuyerRenderContract(rows: Array<{
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
}>): RenderContract {
    return {
        id: 'early_buyers_table',
        renderMode: 'table',
        title: 'Early buyers',
        rowCount: rows.length,
        columns: [
            { key: 'rank', label: 'Rank', valueType: 'number' },
            { key: 'address', label: 'Wallet Address', valueType: 'wallet_address' },
            { key: 'timestamp', label: 'First Buy Time (UTC)', valueType: 'datetime' },
            { key: 'amount', label: 'Buy Amount', valueType: 'text' },
            { key: 'txHash', label: 'TX Hash', valueType: 'tx_hash' },
            { key: 'transferCount', label: 'Transfer Count', valueType: 'number' },
            { key: 'tokenBuyUsd', label: 'Buy USD', valueType: 'number' },
            { key: 'tokenSellUsd', label: 'Sell USD', valueType: 'number' },
            { key: 'tokenRealizedPnlUsd', label: 'Realized PnL', valueType: 'number' },
            { key: 'tokenProfitPct', label: 'Profit %', valueType: 'number' },
            { key: 'tokenPnlSource', label: 'PnL Source', valueType: 'text' },
        ],
        rows: rows.map((row) => ({
            rank: row.rank,
            address: row.address,
            timestamp: row.timestamp || '',
            amount: row.amount || '',
            txHash: row.txHash || '',
            transferCount: row.transferCount ?? '',
            tokenBuyUsd: row.tokenPnl?.totalBuyUsd ?? '',
            tokenSellUsd: row.tokenPnl?.totalSellUsd ?? '',
            tokenRealizedPnlUsd: row.tokenPnl?.realizedPnlUsd ?? '',
            tokenProfitPct: row.tokenPnl?.profitPct ?? '',
            tokenPnlSource: row.tokenPnl?.source || '',
        })),
        markdownFallback: buildEarlyBuyersMarkdownTable(rows),
    };
}

/**
 * Tool to get early buyers of a token
 */
export const GetEarlyBuyersTool: Tool = {
    definition: {
        name: 'get_early_buyers',
        description: 'Get the earliest buyers of a token, optionally within a precise time window. For EVM chains, this tool also attempts token-specific wallet PnL for the same token: total buy USD, total sell USD, realized PnL, and profit percent when provider data is available. Use this after you know the token contract and, if relevant, the event/post time window you want to analyze. If you choose this tool, emit a real structured tool call immediately. Do not narrate "Calling get_early_buyers" in plain text. Use address plus optional start_time/end_time; do not invent timestamp_range or other unofficial fields. Early-buyer queries should default to full-list output for the returned rows, not a compressed summary. When the tool result includes a renderContract, preserve the full returned row set.',
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
                    description: 'When true, attach first-buy / first-sell progression for each wallet by loading wallet trade history.'
                },
                trade_history_limit: {
                    type: 'number',
                    description: 'How many wallet trade records to scan per wallet when include_trade_progression is enabled. Default 25, max 100.'
                },
                token_pnl_days: {
                    type: 'number',
                    description: 'Lookback window in days for token-specific wallet PnL on EVM chains. Default 30, max 365.'
                },
                min_token_amount: {
                    type: 'number',
                    description: 'Optional dust floor for token amount received during the early window.'
                }
            },
            required: ['address']
        }
    },
    handler: async ({ address, chain, chain_id, limit = 10, start_time, end_time, include_trade_progression, trade_history_limit, token_pnl_days, min_token_amount }, context) => {
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
            const includeTradeProgression = include_trade_progression !== false;
            const tradeHistoryLimit = Math.max(10, Math.min(100, Number(trade_history_limit) || 25));
            const tokenPnlDays = Math.max(1, Math.min(365, Number(token_pnl_days) || 30));

            let buyers = await tokenAnalysis.getEarlyBuyers(address, resolved.chain, boundedLimit, {
                includeTradeProgression,
                includeTokenPnl: true,
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

            return {
                success: true,
                token: address,
                chain: resolved.chain,
                buyerCount: buyers.length,
                presentation: {
                    outputMode: 'full_table',
                    includeTradeProgression,
                    tradeHistoryLimit,
                    tokenPnlDays: resolved.chain === 'solana' ? null : tokenPnlDays,
                },
                notes: [
                    'Early-buyer ranking still comes from first transfer timing, not profitability.',
                    'Token PnL fields are token-specific wallet metrics for the same token when provider coverage exists.',
                    'PnL values may be null when a provider cannot resolve token-level history for that wallet.',
                ],
                filters: {
                    minTokenAmount: effectiveMinTokenAmount > 0 ? effectiveMinTokenAmount : null,
                },
                markdownTable: buildEarlyBuyersMarkdownTable(tableRows),
                renderContract: buildEarlyBuyerRenderContract(tableRows),
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
    buildEarlyBuyerRenderContract,
};
