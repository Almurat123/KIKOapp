import { Tool } from '../../../tooling/registry.js';
import * as tokenAnalysis from '../../../services/tokenAnalysis.js';
import * as creatorAnalysis from '../../../services/creatorAnalysis.js';
import { resolveChainInput } from '../../../utils/chainParam.js';

/**
 * Tool to get early buyers of a token
 */
export const GetEarlyBuyersTool: Tool = {
    definition: {
        name: 'get_early_buyers',
        description: 'Get the earliest buyers of a token, optionally within a precise time window. Use this after you know the token contract and, if relevant, the event/post time window you want to analyze. If you choose this tool, emit a real structured tool call immediately. Do not narrate "Calling get_early_buyers" in plain text. Use address plus optional start_time/end_time; do not invent timestamp_range or other unofficial fields.',
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
                quality_mode: {
                    type: 'boolean',
                    description: 'When true, apply quality filtering to suppress tiny "ant" wallets. Ignored when output_mode=full_table.'
                },
                output_mode: {
                    type: 'string',
                    description: 'Use full_table for complete export-style output (all rows, full addresses, trade progression if requested). Use smart_shortlist for a quality-ranked shortlist.',
                    enum: ['full_table', 'smart_shortlist']
                },
                include_trade_progression: {
                    type: 'boolean',
                    description: 'When true, attach first-buy / first-sell progression for each wallet by loading wallet trade history.'
                },
                trade_history_limit: {
                    type: 'number',
                    description: 'How many wallet trade records to scan per wallet when include_trade_progression is enabled. Default 25, max 100.'
                },
                min_buy_usd: {
                    type: 'number',
                    description: 'Minimum estimated buy size in USD for quality filtering. Default is 100 when quality_mode=true.'
                },
                min_token_amount: {
                    type: 'number',
                    description: 'Minimum total token amount received by a wallet during early window.'
                },
                min_wallet_tx_count: {
                    type: 'number',
                    description: 'Minimum wallet transaction count (via free RPC nonce). Filters out low-activity wallets.'
                },
                sort_by: {
                    type: 'string',
                    description: 'Ranking mode: first_seen, buy_usd_desc, quality_desc. Default quality_desc when quality_mode=true; ignored for full_table.',
                    enum: ['first_seen', 'buy_usd_desc', 'quality_desc']
                }
            },
            required: ['address']
        }
    },
    handler: async ({ address, chain, chain_id, limit = 10, start_time, end_time, quality_mode = false, output_mode, include_trade_progression, trade_history_limit, min_buy_usd, min_token_amount, min_wallet_tx_count, sort_by }, context) => {
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
            const isFullTable = output_mode === 'full_table';
            const qualityModeEnabled = isFullTable ? false : quality_mode !== false;
            const effectiveMinBuyUsd = (typeof min_buy_usd === 'number' && Number.isFinite(min_buy_usd))
                ? Number(min_buy_usd)
                : 0;
            const effectiveMinTokenAmount = (typeof min_token_amount === 'number' && Number.isFinite(min_token_amount))
                ? Number(min_token_amount)
                : 0;
            const effectiveMinWalletTxCount = (typeof min_wallet_tx_count === 'number' && Number.isFinite(min_wallet_tx_count))
                ? Math.max(0, Math.floor(Number(min_wallet_tx_count)))
                : 0;
            const effectiveSort = isFullTable
                ? 'first_seen'
                : (sort_by as 'first_seen' | 'buy_usd_desc' | 'quality_desc' | undefined)
                    || (qualityModeEnabled ? 'quality_desc' : 'first_seen');
            const includeTradeProgression = Boolean(include_trade_progression || isFullTable);
            const tradeHistoryLimit = Math.max(10, Math.min(100, Number(trade_history_limit) || 25));

            let buyers = await tokenAnalysis.getEarlyBuyers(address, resolved.chain, boundedLimit, {
                outputMode: isFullTable ? 'full_table' : 'smart_shortlist',
                includeTradeProgression,
                tradeHistoryLimit,
                startTimeMs,
                endTimeMs,
                minBuyUsd: !isFullTable && effectiveMinBuyUsd > 0 ? effectiveMinBuyUsd : undefined,
                minTokenAmount: effectiveMinTokenAmount > 0 ? effectiveMinTokenAmount : undefined,
                minWalletTxCount: !isFullTable && effectiveMinWalletTxCount > 0 ? effectiveMinWalletTxCount : undefined,
                qualitySort: effectiveSort
            });

            let usedFilterFallback = false;
            if (
                (!buyers || buyers.length === 0)
                && qualityModeEnabled
                && (effectiveMinBuyUsd > 0 || effectiveMinWalletTxCount > 0)
            ) {
                buyers = await tokenAnalysis.getEarlyBuyers(address, resolved.chain, boundedLimit, {
                    outputMode: 'smart_shortlist',
                    includeTradeProgression: includeTradeProgression && !isFullTable,
                    tradeHistoryLimit,
                    startTimeMs,
                    endTimeMs,
                    minTokenAmount: effectiveMinTokenAmount > 0 ? effectiveMinTokenAmount : undefined,
                    qualitySort: effectiveSort
                });
                usedFilterFallback = true;
            }

            if (!buyers || buyers.length === 0) {
                return {
                    success: false,
                    message: `No early buyers found for ${address} on ${resolved.chain}. Token may be too new or not have trading activity yet.`
                };
            }

            return {
                success: true,
                token: address,
                chain: resolved.chain,
                buyerCount: buyers.length,
                presentation: {
                    outputMode: isFullTable ? 'full_table' : (qualityModeEnabled ? 'smart_shortlist' : 'raw'),
                    includeTradeProgression,
                    tradeHistoryLimit,
                },
                filters: {
                    qualityMode: qualityModeEnabled,
                    minBuyUsd: effectiveMinBuyUsd > 0 ? effectiveMinBuyUsd : null,
                    minTokenAmount: effectiveMinTokenAmount > 0 ? effectiveMinTokenAmount : null,
                    minWalletTxCount: effectiveMinWalletTxCount > 0 ? effectiveMinWalletTxCount : null,
                    sortBy: effectiveSort,
                    filterFallbackUsed: usedFilterFallback
                },
                earlyBuyers: buyers.map((b, i) => ({
                    rank: i + 1,
                    address: b.address,
                    timestamp: b.timestamp?.toISOString(),
                    amount: b.amount,
                    txHash: b.txHash,
                    isSmart: b.isSmart,
                    transferCount: b.transferCount ?? null,
                    estimatedBuyUsd: b.estimatedBuyUsd ?? null,
                    walletTxCount: b.walletTxCount ?? null,
                    qualityScore: b.qualityScore ?? null,
                    qualityTier: b.qualityTier ?? null,
                    tradeProgression: b.tradeProgression ?? null
                }))
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
