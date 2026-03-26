import { Tool } from '../../../tooling/registry.js';
import { getTradesByAssetId } from '../../../services/polymarketTradeService.js';
import { getExecutablePrice } from '../../../services/polymarketDataService.js';
import { checkTradingReadiness } from '../../../services/polymarketApprovalService.js';
import { buildPolymarketFundingPlan } from '../../../services/polymarketFundingPlan.js';
import { getEventDetails, resolveAuthoritativePolymarketSelection, verifyPolymarketSelection } from '../../../services/polymarket.js';
import { resolvePolymarketSelectionMatch } from '../../../jobs/chat/polymarketSelectionState.js';
import { computeConfirmationToken } from '../../../jobs/chat/executionGate.js';

/**
 * Get Market Activity Tool
 * Fetches recent trades for a specific market (question) to analyze buy/sell pressure.
 */
export const GetMarketActivityTool: Tool = {
    definition: {
        name: 'get_market_activity',
        description: 'Get recent trading activity (buys/sells, volume, whale moves) for a specific prediction market outcome. Use this when user asks "who is buying?", "is there a sell-off?", or "check market flow". Requires a market/outcome token ID (usually from get_polymarket_event or get_polymarket_trending_markets).',
        parameters: {
            type: 'object',
            properties: {
                token_id: {
                    type: 'string',
                    description: 'The Asset/Token ID of the specific outcome (e.g., the ID for "Yes" or "No" token).'
                },
                limit: {
                    type: 'number',
                    description: 'Number of recent trades to fetch (default 20, max 100).'
                }
            },
            required: ['token_id']
        }
    },
    handler: async (args: { token_id: string; limit?: number }) => {
        if (!args.token_id) {
            throw new Error('token_id is required. Please find it from market details first.');
        }

        const limit = Math.min(args.limit || 20, 100);
        const trades = await getTradesByAssetId(args.token_id, limit);

        if (trades.length === 0) {
            return {
                message: 'No recent trades found for this token ID within the limit.'
            };
        }

        // Calculate basic stats
        const vol24h = trades.reduce((sum, t) => sum + t.volumeUSDC, 0);
        const buyVolume = trades.filter(t => t.type === 'BUY').reduce((sum, t) => sum + t.volumeUSDC, 0);
        const sellVolume = trades.filter(t => t.type === 'SELL').reduce((sum, t) => sum + t.volumeUSDC, 0);
        const buyPressure = vol24h > 0 ? (buyVolume / vol24h) * 100 : 0;

        // Identify "Whale" trades (arbitrary threshold, e.g., > $1000)
        const whaleTrades = trades.filter(t => t.volumeUSDC > 1000).map(t => ({
            type: t.type,
            amount_usdc: `$${Math.floor(t.volumeUSDC)}`,
            price: t.price.toFixed(3),
            time: t.date
        }));

        return {
            source: 'Polymarket Goldsky Node',
            token_id: args.token_id,
            count: trades.length,
            stats: {
                total_volume_in_result: `$${Math.floor(vol24h)}`,
                buy_pressure: `${buyPressure.toFixed(1)}%`,
                latest_price: trades[0].price.toFixed(3)
            },
            recent_trades: trades.slice(0, 5).map(t => ({
                type: t.type,
                shares: Math.floor(t.amount),
                usdc: `$${Math.floor(t.volumeUSDC)}`,
                price: t.price.toFixed(3),
                time: t.date
            })),
            whale_activity: whaleTrades.length > 0 ? whaleTrades : 'No recent large trades (> $1000)',
            note: 'Price is derived from the trade ratio (USDC/Shares).'
        };
    },
    permissions: 'public'
};

/**
 * Get Whale Watch Tool
 * Scans for globally large trades (abnormal activity).
 */
export const GetWhaleWatchTool: Tool = {
    definition: {
        name: 'get_whale_watch',
        description: 'Scan for recent large/abnormal trades globally across all Polymarket events. Detects "Whale" activity where single trades exceed $1000 (or specified amount). Use this when user asks for "abnormal activity", "whale watching", or "large bets".',
        parameters: {
            type: 'object',
            properties: {
                min_amount: {
                    type: 'number',
                    description: 'Minimum amount in USDC to consider a whale trade. Default is 1000.'
                },
                limit: {
                    type: 'number',
                    description: 'Number of trades to return (1-20). Default is 10.'
                }
            },
            required: []
        }
    },
    handler: async (args: { min_amount?: number; limit?: number }) => {
        const minAmount = args.min_amount || 1000;
        const limit = Math.min(args.limit || 10, 20);

        const trades = await import('../../../services/polymarketTradeService.js').then(m => m.getWhaleTrades(minAmount, limit));

        return {
            source: 'Polymarket/Goldsky',
            type: 'Abnormal/Whale Activity',
            min_threshold: `$${minAmount}`,
            count: trades.length,
            trades: trades.map(t => ({
                type: t.type,
                usdc_volume: `$${Math.floor(t.volumeUSDC).toLocaleString()}`,
                price: t.price.toFixed(3),
                time: t.date,
                market_maker: t.maker.slice(0, 6) + '...',
                tx: t.transactionHash
            })),
            note: 'These are individual trades exceeding the threshold.'
        };
    },
    permissions: 'public'
};

export const GetPolymarketQuoteTool: Tool = {
    definition: {
        name: 'get_polymarket_quote',
        description: 'Get the live executable BUY and SELL prices for a specific Polymarket outcome token. Use this to prepare a bet before placing a Polymarket order, especially for short-window markets.',
        parameters: {
            type: 'object',
            properties: {
                token_id: {
                    type: 'string',
                    description: 'Exact outcome token ID returned by get_polymarket_event, get_polymarket_trending_markets, or get_new_markets.'
                },
                amount_usd: {
                    type: 'number',
                    description: 'Optional USD amount to estimate shares for a BUY.'
                },
                shares: {
                    type: 'number',
                    description: 'Optional share amount to estimate exit value for a SELL.'
                }
            },
            required: ['token_id']
        }
    },
    handler: async (args: { token_id: string; amount_usd?: number; shares?: number }) => {
        const tokenId = String(args.token_id || '').trim();
        if (!tokenId) {
            throw new Error('token_id is required. Resolve the exact outcome first.');
        }

        const [buyPrice, sellPrice] = await Promise.all([
            getExecutablePrice(tokenId, 'BUY'),
            getExecutablePrice(tokenId, 'SELL'),
        ]);

        const spread = buyPrice != null && sellPrice != null
            ? Number((sellPrice - buyPrice).toFixed(4))
            : null;

        return {
            source: 'Polymarket CLOB',
            token_id: tokenId,
            buy_price: buyPrice,
            sell_price: sellPrice,
            spread,
            estimated_buy_shares: args.amount_usd && buyPrice
                ? Number((args.amount_usd / buyPrice).toFixed(4))
                : null,
            estimated_sell_value: args.shares && sellPrice != null
                ? Number((args.shares * sellPrice).toFixed(4))
                : null,
            note: 'Use buy_price for BUY orders and sell_price for SELL/close orders. These come from the live CLOB price endpoint, not from the raw order book top row.',
        };
    },
    permissions: 'public'
};

export const PreparePolymarketBetTool: Tool = {
    definition: {
        name: 'prepare_polymarket_bet',
        description: 'Prepare an execution-ready Polymarket bet bundle for a selected outcome. Use this when the user has already picked a market or says "I want this", "buy this", or "take this one". It returns live executable prices, estimated shares, and, when user auth context is available, trading readiness and concrete next steps. Prefer this over repeating discovery tools once a specific token_id is known.',
        parameters: {
            type: 'object',
            properties: {
                token_id: {
                    type: 'string',
                    description: 'Exact selected outcome token ID.'
                },
                question: {
                    type: 'string',
                    description: 'Selected market question.'
                },
                outcome: {
                    type: 'string',
                    description: 'Selected outcome name, such as Yes, No, Up, or Down.'
                },
                amount_usd: {
                    type: 'number',
                    description: 'Optional intended buy amount in USD for share estimation.'
                },
                event_id: {
                    type: 'string',
                    description: 'Optional Polymarket event ID to enrich the response with sibling markets and metadata.'
                },
                market_id: {
                    type: 'string',
                    description: 'Optional exact Polymarket market ID from discovery. Prefer passing this for short-window markets.'
                },
                market_slug: {
                    type: 'string',
                    description: 'Optional exact Polymarket market slug from discovery. Prefer passing this for short-window markets.'
                }
            },
            required: ['token_id', 'question', 'outcome']
        }
    },
    handler: async (args: {
        token_id: string;
        question: string;
        outcome: string;
        amount_usd?: number;
        event_id?: string;
        market_id?: string;
        market_slug?: string;
    }, context) => {
        const tokenId = String(args.token_id || '').trim();
        if (!tokenId) {
            throw new Error('token_id is required');
        }

        const snapshotSelection = context?.__snapshot?.polymarketSelection || null;
        const selectionMatch = resolvePolymarketSelectionMatch(snapshotSelection, {
            question: args.question,
            outcome: args.outcome,
            tokenId,
            marketId: args.market_id,
            marketSlug: args.market_slug,
        });
        const effectiveQuestion = selectionMatch?.question || args.question;
        const effectiveOutcome = selectionMatch?.outcome || args.outcome;
        const effectiveMarketId = selectionMatch?.marketId || args.market_id;
        const effectiveMarketSlug = selectionMatch?.marketSlug || args.market_slug;
        const seedTokenId = selectionMatch?.tokenId || tokenId;

        const [event, selectionValidation] = await Promise.all([
            args.event_id
                ? getEventDetails(String(args.event_id)).catch(() => null)
                : Promise.resolve(null),
            verifyPolymarketSelection({
                question: effectiveQuestion,
                outcome: effectiveOutcome,
                tokenId: seedTokenId,
                eventId: args.event_id,
            }).catch(() => ({
                matched: false,
                source: 'none' as const,
                eventId: args.event_id ?? null,
                eventTitle: null,
                marketId: null,
                marketSlug: null,
                conditionId: null,
                resolvedTokenId: null,
                resolvedOutcome: null,
                questionMatched: false,
                outcomeMatched: false,
                tokenMatched: false,
                acceptingOrders: null,
                reason: 'question_not_found' as const,
            })),
        ]);

        const authoritativeSelection = selectionValidation.matched
            ? await resolveAuthoritativePolymarketSelection({
                question: effectiveQuestion,
                outcome: effectiveOutcome,
                tokenId: seedTokenId,
                marketId: effectiveMarketId ?? selectionValidation.marketId,
                marketSlug: effectiveMarketSlug ?? selectionValidation.marketSlug,
            }).catch(() => ({
                matched: false,
                source: 'none' as const,
                eventId: null,
                eventTitle: null,
                marketId: effectiveMarketId ?? selectionValidation.marketId ?? null,
                marketSlug: effectiveMarketSlug ?? selectionValidation.marketSlug ?? null,
                conditionId: null,
                resolvedTokenId: null,
                resolvedOutcome: null,
                questionMatched: false,
                outcomeMatched: false,
                tokenMatched: false,
                acceptingOrders: null,
                reason: 'event_lookup_failed' as const,
            }))
            : null;

        const resolvedTokenId = String(
            authoritativeSelection?.resolvedTokenId
            || selectionValidation.resolvedTokenId
            || tokenId,
        ).trim();
        const effectiveTokenId = resolvedTokenId || tokenId;
        const [buyPrice, sellPrice] = await Promise.all([
            getExecutablePrice(effectiveTokenId, 'BUY'),
            getExecutablePrice(effectiveTokenId, 'SELL'),
        ]);

        let readiness: Awaited<ReturnType<typeof checkTradingReadiness>> | null = null;
        const userId = String(context?.userId || '').trim();
        if (userId) {
            try {
                readiness = await checkTradingReadiness(userId);
            } catch {
                readiness = null;
            }
        }

        const fundingPlan = readiness
            ? buildPolymarketFundingPlan({
                readiness,
                context,
                amountUsd: args.amount_usd ?? null,
            })
            : null;

        const estimatedBuyShares = args.amount_usd && buyPrice
            ? Number((args.amount_usd / buyPrice).toFixed(4))
            : null;

        const siblingMarkets = event?.markets
            ?.filter((market) => market.question !== args.question)
            .slice(0, 3)
            .map((market) => ({
                id: market.id,
                question: market.question,
                accepting_orders: market.acceptingOrders,
                best_bid: market.bestBid,
                best_ask: market.bestAsk,
            })) || [];

        const orderArgs = args.amount_usd && fundingPlan?.ready_for_requested_order
            ? {
                token_id: effectiveTokenId,
                side: 'BUY',
                amount_usd: args.amount_usd,
                question: effectiveQuestion,
                outcome: effectiveOutcome,
            }
            : null;

        const selectionCanBeRecovered = Boolean(
            authoritativeSelection?.questionMatched
            && authoritativeSelection?.outcomeMatched
            && authoritativeSelection?.resolvedTokenId,
        );
        const selectionIsValid = Boolean(
            (selectionValidation?.matched && authoritativeSelection?.matched)
            || selectionCanBeRecovered,
        );
        const safeOrderArgs = selectionIsValid ? orderArgs : null;
        const swapFundingConfirmation = selectionIsValid && fundingPlan?.preferred_action?.tool_name === 'prepare_swap_transaction'
            ? {
                tool_name: 'prepare_swap_transaction',
                args: fundingPlan.preferred_action.args,
                confirmation_token: computeConfirmationToken('prepare_swap_transaction', fundingPlan.preferred_action.args),
                action_class: 'TRADE_MUTATION' as const,
            }
            : null;
        const nextStep = !selectionIsValid
            ? 'Refresh the exact selected market and outcome first. The selection did not re-resolve cleanly against the authoritative Polymarket market record.'
            : readiness == null
                ? 'If you want to place this bet next, check readiness or place the order directly if the account is already prepared.'
                : fundingPlan?.ready_for_requested_order
                    ? 'Account looks ready. Reply "confirm" to place the prepared order, or change the amount/outcome first.'
                    : fundingPlan?.preferred_action?.reason
                        || readiness.missingSteps[0]
                        || 'Complete readiness setup before placing the order.';

        console.info('[PolymarketBetPrep]', {
            question: args.question,
            outcome: args.outcome,
            token_id: tokenId,
            selection_reason_code: selectionValidation.reason,
            authoritative_reason_code: authoritativeSelection?.reason || 'event_lookup_failed',
            selection_valid: selectionIsValid,
            market_id: effectiveMarketId ?? selectionValidation.marketId ?? null,
            market_slug: effectiveMarketSlug ?? selectionValidation.marketSlug ?? null,
            recovered_from_selection_state: Boolean(selectionMatch),
        });

        return {
            source: 'Polymarket Bet Prep',
            selection: {
                question: effectiveQuestion,
                outcome: effectiveOutcome,
                token_id: tokenId,
                resolved_token_id: effectiveTokenId !== tokenId ? effectiveTokenId : null,
                amount_usd: args.amount_usd ?? null,
            },
            selection_validation: {
                valid: selectionIsValid,
                reason: selectionValidation.reason,
                source: selectionValidation.source,
                event_id: selectionValidation.eventId,
                market_id: selectionValidation.marketId,
                market_slug: selectionValidation.marketSlug,
                condition_id: selectionValidation.conditionId,
                resolved_token_id: selectionValidation.resolvedTokenId,
                resolved_outcome: selectionValidation.resolvedOutcome,
                question_matched: selectionValidation.questionMatched,
                outcome_matched: selectionValidation.outcomeMatched,
                token_matched: selectionValidation.tokenMatched,
                accepting_orders: selectionValidation.acceptingOrders,
            },
            authoritative_resolution: authoritativeSelection
                ? {
                    valid: authoritativeSelection.matched,
                    reason: authoritativeSelection.reason,
                    market_id: authoritativeSelection.marketId,
                    market_slug: authoritativeSelection.marketSlug,
                    condition_id: authoritativeSelection.conditionId,
                    resolved_token_id: authoritativeSelection.resolvedTokenId,
                    resolved_outcome: authoritativeSelection.resolvedOutcome,
                    question_matched: authoritativeSelection.questionMatched,
                    outcome_matched: authoritativeSelection.outcomeMatched,
                    token_matched: authoritativeSelection.tokenMatched,
                    accepting_orders: authoritativeSelection.acceptingOrders,
                }
                : {
                    valid: false,
                    reason: 'event_lookup_failed',
                    market_id: args.market_id ?? selectionValidation.marketId ?? null,
                    market_slug: args.market_slug ?? selectionValidation.marketSlug ?? null,
                    condition_id: null,
                    resolved_token_id: null,
                    resolved_outcome: null,
                    question_matched: false,
                    outcome_matched: false,
                    token_matched: false,
                    accepting_orders: null,
                },
            live_quote: {
                buy_price: buyPrice,
                sell_price: sellPrice,
                estimated_buy_shares: estimatedBuyShares,
            },
            readiness: readiness
                ? {
                    ready: readiness.isReady,
                    ready_for_requested_order: fundingPlan?.ready_for_requested_order ?? readiness.isReady,
                    wallet_address: readiness.walletAddress,
                    usdc_balance: readiness.usdcBalance,
                    native_usdc_balance: readiness.nativeUsdcBalance,
                    conversion_required: readiness.conversionRequired,
                    missing_steps: readiness.missingSteps,
                }
                : null,
            funding_plan: fundingPlan,
            sibling_markets: siblingMarkets,
            next_step: nextStep,
            enrichment: {
                event_id_used: args.event_id ?? null,
                event_lookup_ok: Boolean(event),
                market_id_used: effectiveMarketId ?? selectionValidation.marketId ?? null,
                market_slug_used: effectiveMarketSlug ?? selectionValidation.marketSlug ?? null,
                selection_state_match: selectionMatch,
            },
            requires_confirmation: Boolean(safeOrderArgs || swapFundingConfirmation),
            confirmation_payload: safeOrderArgs
                ? {
                    tool_name: 'place_polymarket_order',
                    args: safeOrderArgs,
                    confirmation_token: computeConfirmationToken('place_polymarket_order', safeOrderArgs),
                    action_class: 'ORDER_MUTATION',
                }
                : swapFundingConfirmation,
            note: 'Use this tool after market selection to move from discovery into a concrete bet-preparation bundle. Do not stop at only listing markets if the user has already chosen one.',
        };
    },
    permissions: 'public'
};
