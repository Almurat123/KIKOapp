// CONTEXT MEMORY
// Updated: 2026-04-19
// Author: Renata
// Reason: Polymarket order mutation receipts need order ids and market URLs so
//         Agent-mode replies make placed, closed, cancelled, and replaced orders
//         auditable to the user.
// Goal: keep order tools transactional and receipt-rich without weakening
//       readiness checks or exact token-id validation.
// Owns: direct Polymarket trading tool schemas and result shaping.
// Does Not Own: credential derivation, CLOB order signing/posting, or market discovery.
// Design Language:
// - never place orders without exact token ids and readiness gates
// - include order_id/replaced_order_id and market_url when returned or derivable
// - if market_url is unavailable, say so rather than inventing a slug
// Document Provenance:
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-agent-execution-receipt-links.md
// - Kind: repo doc
// - Retrieved: 2026-04-19
// - Applied To: Polymarket order mutation receipt fields
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-agent-execution-receipt-links.md
/**
 * Polymarket Direct Trading AI Tools
 * Tools for AI to help users place direct orders on Polymarket
 */

import { Tool } from '../../../tooling/registry.js';
import prisma from '../../../db/prisma.js';
import { createOrDeriveCredentials, getPolymarketWallet } from '../../../services/polymarketCredService.js';
import { checkTradingReadiness, getRequiredApprovals } from '../../../services/polymarketApprovalService.js';
import { buildPolymarketFundingPlan } from '../../../services/polymarketFundingPlan.js';
import { placeBuyOrder } from '../../../services/polymarketExecutor.js';
import { getExecutablePrice } from '../../../services/polymarketDataService.js';
import { computeConfirmationToken } from '../../../jobs/chat/executionGate.js';
import { buildPolymarketMarketUrl } from '../../../utils/executionLinks.js';

type PolymarketReadiness = Awaited<ReturnType<typeof checkTradingReadiness>>;

function buildPolymarketReadinessGate(readiness: PolymarketReadiness): {
    success: false;
    blocked_by: 'polymarket_readiness';
    error: string;
    readiness: {
        ready: boolean;
        blockchain_status: 'ok' | 'unavailable';
        wallet_address: string | null;
        usdc_balance: string;
        native_usdc_balance: string;
        conversion_required: boolean;
        missing_steps: string[];
    };
    next_step: string;
} | null {
    if (readiness.isReady) return null;

    const nextStep = readiness.conversionRequired
        ? 'Convert Polygon native USDC to Polymarket USDC.e, then check readiness again before placing the order.'
        : readiness.blockchainStatus === 'unavailable'
            ? 'Polymarket readiness could not be verified because Polygon readiness checks are currently unavailable. Retry readiness before placing the order.'
            : readiness.missingSteps[0] || 'Complete Polymarket setup before placing the order.';

    const error = readiness.conversionRequired
        ? 'Polymarket trading is blocked until Polygon native USDC is converted to Polymarket USDC.e.'
        : readiness.blockchainStatus === 'unavailable'
            ? 'Polymarket trading is blocked because readiness could not be verified against Polygon right now.'
            : 'Polymarket trading is blocked until account readiness is complete.';

    return {
        success: false,
        blocked_by: 'polymarket_readiness',
        error,
        readiness: {
            ready: readiness.isReady,
            blockchain_status: readiness.blockchainStatus,
            wallet_address: readiness.walletAddress,
            usdc_balance: readiness.usdcBalance,
            native_usdc_balance: readiness.nativeUsdcBalance,
            conversion_required: readiness.conversionRequired,
            missing_steps: readiness.missingSteps,
        },
        next_step: nextStep,
    };
}

function buildPolymarketBlockedOrderResponse(params: {
    readiness: PolymarketReadiness;
    context?: ToolContextLike;
    amountUsd?: number | null;
}) {
    const readinessBlock = buildPolymarketReadinessGate(params.readiness);
    if (!readinessBlock) return null;

    const fundingPlan = buildPolymarketFundingPlan({
        readiness: params.readiness,
        context: params.context,
        amountUsd: params.amountUsd,
    });

    return {
        ...readinessBlock,
        funding_plan: fundingPlan,
        requires_confirmation: fundingPlan.preferred_action?.tool_name === 'prepare_swap_transaction',
        confirmation_payload: fundingPlan.preferred_action?.tool_name === 'prepare_swap_transaction'
            ? {
                tool_name: 'prepare_swap_transaction',
                args: fundingPlan.preferred_action.args,
                confirmation_token: computeConfirmationToken('prepare_swap_transaction', fundingPlan.preferred_action.args),
                action_class: 'TRADE_MUTATION',
            }
            : null,
        next_step: fundingPlan.preferred_action?.reason || readinessBlock.next_step,
    };
}

type ToolContextLike = {
    [key: string]: any;
} | undefined;

function pickPolymarketMarketSlug(args: Record<string, any>, context?: ToolContextLike): string | null {
    const explicit = String(args.market_slug || '').trim();
    if (explicit) return explicit;

    const selection = context?.__snapshot?.polymarketSelection || null;
    const tokenId = String(args.token_id || args.position_id || '').trim();
    const question = String(args.question || '').trim().toLowerCase();

    const prepared = selection?.preparedSelection;
    if (prepared && (
        (tokenId && [prepared.tokenId, prepared.resolvedTokenId].includes(tokenId))
        || (question && String(prepared.question || '').trim().toLowerCase() === question)
    )) {
        return String(prepared.marketSlug || '').trim() || null;
    }

    const candidates = [
        selection?.executionCandidate,
        selection?.currentCandidate,
        selection?.primaryCandidate,
        ...(Array.isArray(selection?.candidates) ? selection.candidates : []),
    ].filter(Boolean);

    for (const candidate of candidates) {
        const candidateQuestion = String(candidate?.question || '').trim().toLowerCase();
        const tokenMatches = tokenId && Array.isArray(candidate?.outcomes)
            && candidate.outcomes.some((outcome: any) => String(outcome?.tokenId || '').trim() === tokenId);
        if (tokenMatches || (question && candidateQuestion === question)) {
            const slug = String(candidate?.marketSlug || '').trim();
            if (slug) return slug;
        }
    }

    return null;
}

function buildPolymarketReceiptFields(args: Record<string, any>, context?: ToolContextLike) {
    const marketSlug = pickPolymarketMarketSlug(args, context);
    const marketUrl = String(args.market_url || '').trim() || buildPolymarketMarketUrl(marketSlug) || null;
    return {
        market_slug: marketSlug,
        market_url: marketUrl,
    };
}

/**
 * Check Polymarket Trading Readiness Tool
 */
export const CheckPolymarketReadinessTool: Tool = {
    definition: {
        name: 'check_polymarket_readiness',
        description: 'Check if user is ready to trade on Polymarket. Returns status of API credentials, token approvals, and wallet setup. Use this before placing orders.',
        parameters: {
            type: 'object',
            properties: {},
            required: []
        }
    },
    handler: async (args, context) => {
        const userId = context?.userId;
        if (!userId) {
            throw new Error('User authentication required');
        }

        try {
            const readiness = await checkTradingReadiness(userId);
            const fundingPlan = buildPolymarketFundingPlan({
                readiness,
                context,
                amountUsd: null,
            });

            return {
                ready: readiness.isReady,
                chain_policy: 'polygon_only',
                credentials: readiness.hasCredentials,
                delegation: readiness.hasDelegatedEvm,
                approvals: {
                    usdc: readiness.hasUsdcApproval ? '✅' : '❌',
                    ctf: readiness.hasCtfApproval ? '✅' : '❌'
                },
                blockchain_status: readiness.blockchainStatus,
                wallet_address: readiness.walletAddress,
                usdc_balance: readiness.usdcBalance,
                native_usdc_balance: readiness.nativeUsdcBalance,
                conversion_required: readiness.conversionRequired,
                funding_plan: fundingPlan,
                conversion_suggestion: readiness.conversionSuggestion
                    ? {
                        tool: 'prepare_swap_transaction',
                        params: {
                            token_in: readiness.conversionSuggestion.fromToken,
                            token_out: readiness.conversionSuggestion.toToken,
                            amount_in: readiness.conversionSuggestion.amountIn,
                            chain_id: readiness.conversionSuggestion.chainId,
                            execute: true
                        },
                        note: 'Use these exact token addresses for the conversion. On Polygon Polymarket, collateral is USDC.e at 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174, not native Polygon USDC.'
                    }
                    : null,
                message: readiness.isReady
                    ? '✅ Ready to trade on Polymarket!'
                    : readiness.conversionRequired
                        ? '⚠️ You have Polygon native USDC, but Polymarket trading requires USDC.e. Convert 0x3c499c542cef5e3811e1192ce70d8cc03d5c3359 to 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174 first. Do not substitute ETH or another asset.'
                    : '⚠️ Setup needed before trading.',
                missing_steps: readiness.missingSteps,
                next_step: readiness.isReady
                    ? 'You can now place orders using place_polymarket_order.'
                    : fundingPlan.preferred_action?.reason
                        || (readiness.conversionRequired
                            ? 'Convert Polygon native USDC (0x3c499c542cef5e3811e1192ce70d8cc03d5c3359) to Polymarket USDC.e (0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174) using prepare_swap_transaction, then check readiness again. No wallet chain switch is required.'
                            : readiness.missingSteps[0])
            };
        } catch (error: any) {
            return {
                ready: false,
                error: error.message
            };
        }
    },
    permissions: 'authenticated'
};

/**
 * Setup Polymarket Credentials Tool
 */
export const SetupPolymarketCredentialsTool: Tool = {
    definition: {
        name: 'setup_polymarket_credentials',
        description: 'Generate Polymarket API credentials for the user. This creates API keys via L1 authentication using their Privy wallet. Required before trading.',
        parameters: {
            type: 'object',
            properties: {},
            required: []
        }
    },
    handler: async (args, context) => {
        const userId = context?.userId;
        if (!userId) {
            throw new Error('User authentication required');
        }

        try {
            const result = await createOrDeriveCredentials(userId);

            if (!result.success) {
                return {
                    success: false,
                    error: result.error,
                    message: '❌ Failed to generate API credentials.'
                };
            }

            // Get wallet address
            const walletAddress = await getPolymarketWallet(userId);

            return {
                success: true,
                wallet_address: walletAddress,
                message: '✅ API credentials generated successfully!',
                next_step: 'Use check_polymarket_approvals to see if token approvals are needed.'
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message
            };
        }
    },
    permissions: 'authenticated'
};

/**
 * Check Polymarket Approvals Tool
 */
export const CheckPolymarketApprovalsTool: Tool = {
    definition: {
        name: 'check_polymarket_approvals',
        description: 'Check if user has approved USDC and CTF tokens for trading. Returns approval status and transaction data if approvals are needed.',
        parameters: {
            type: 'object',
            properties: {},
            required: []
        }
    },
    handler: async (args, context) => {
        const userId = context?.userId;
        if (!userId) {
            throw new Error('User authentication required');
        }

        try {
            // Get wallet address first
            const walletAddress = await getPolymarketWallet(userId);
            if (!walletAddress) {
                return {
                    approved: false,
                    error: 'No wallet found. Please setup credentials first.'
                };
            }

            const approvals = await getRequiredApprovals(walletAddress);

            if (!approvals.needsUsdcApproval && !approvals.needsCtfApproval) {
                return {
                    approved: true,
                    usdc: '✅ Approved',
                    ctf: '✅ Approved',
                    message: '✅ All tokens are approved! Ready to trade.',
                    next_step: 'You can now place orders using place_polymarket_order.'
                };
            }

            return {
                approved: false,
                usdc: approvals.needsUsdcApproval ? '❌ Needs approval' : '✅ Approved',
                ctf: approvals.needsCtfApproval ? '❌ Needs approval' : '✅ Approved',
                usdc_balance: approvals.usdcBalance,
                transactions: approvals.transactions,
                message: '⚠️ Token approvals needed. User must sign the approval transactions.',
                next_step: 'Sign the approval transactions in your wallet, then check readiness again.'
            };
        } catch (error: any) {
            return {
                approved: false,
                error: error.message
            };
        }
    },
    permissions: 'authenticated'
};

/**
 * Place Polymarket Order Tool
 */
export const PlacePolymarketOrderTool: Tool = {
    definition: {
        name: 'place_polymarket_order',
        description: 'Place a BUY or SELL order on Polymarket. Requires the exact outcome token ID and amount; if price is omitted, the tool fetches the current live executable CLOB price for the selected side. Minimum order size is $1 USD. Do not call this tool unless an upstream market lookup returned a concrete token_id for the selected outcome.',
        parameters: {
            type: 'object',
            properties: {
                token_id: {
                    type: 'string',
                    description: 'Exact outcome token ID returned by get_polymarket_event, get_polymarket_trending_markets, or get_new_markets'
                },
                side: {
                    type: 'string',
                    enum: ['BUY', 'SELL'],
                    description: 'Order side: BUY or SELL. Default is BUY.'
                },
                price: {
                    type: 'number',
                    description: 'Optional limit price between 0.01 and 0.99. If omitted, the tool uses the current live executable CLOB price for the selected side.'
                },
                amount_usd: {
                    type: 'number',
                    description: 'Amount in USD (minimum $1) for BUY. For SELL, this is ignored and shares are calculated from position.'
                },
                question: {
                    type: 'string',
                    description: 'Market question for reference'
                },
                outcome: {
                    type: 'string',
                    description: 'Outcome name (e.g., "Yes", "No")'
                },
                position_id: {
                    type: 'string',
                    description: 'Position ID (required for SELL orders)'
                },
                shares: {
                    type: 'number',
                    description: 'Number of shares to sell (required for SELL orders)'
                },
                market_slug: {
                    type: 'string',
                    description: 'Optional Polymarket market slug from the selected market. Include it when available so the receipt can show a clickable market URL.'
                },
                market_url: {
                    type: 'string',
                    description: 'Optional Polymarket market URL. If omitted, KiKo derives it from market_slug when available.'
                }
            },
            required: ['token_id', 'question', 'outcome']
        }
    },
    handler: async (args: {
        token_id: string;
        side?: 'BUY' | 'SELL';
        price: number;
        amount_usd?: number;
        question: string;
        outcome: string;
        position_id?: string;
        shares?: number;
        market_slug?: string;
        market_url?: string;
    }, context) => {
        const userId = context?.userId;
        if (!userId) {
            throw new Error('User authentication required');
        }

        const side = args.side || 'BUY';
        const receipt = buildPolymarketReceiptFields(args, context);

        try {
            const readiness = await checkTradingReadiness(userId);
            const readinessBlock = buildPolymarketBlockedOrderResponse({
                readiness,
                context,
                amountUsd: side === 'BUY' ? args.amount_usd ?? null : null,
            });
            if (readinessBlock) {
                return readinessBlock;
            }

            let resolvedPrice = typeof args.price === 'number' && Number.isFinite(args.price)
                ? args.price
                : null;

            if (resolvedPrice == null) {
                resolvedPrice = await getExecutablePrice(args.token_id, side);
                if (resolvedPrice == null) {
                    return {
                        success: false,
                        error: `Could not fetch live ${side} price for the selected token_id`
                    };
                }
            }

            // Validate price range
            if (resolvedPrice <= 0 || resolvedPrice >= 1) {
                return {
                    success: false,
                    error: 'Price must be between 0.01 and 0.99'
                };
            }

            // Handle SELL orders
            if (side === 'SELL') {
                if (!args.position_id || !args.shares) {
                    return {
                        success: false,
                        error: 'SELL orders require position_id and shares parameters'
                    };
                }

                const { placeSellOrder } = await import('../../../services/polymarketExecutor.js');

                const result = await placeSellOrder({
                    userId,
                    positionId: args.position_id,
                    shares: args.shares,
                    minPrice: resolvedPrice
                });

                if (result.success) {
                    return {
                        success: true,
                        order_id: result.orderId,
                        market_slug: result.marketSlug || receipt.market_slug,
                        market_url: result.marketUrl || receipt.market_url,
                        shares: args.shares.toFixed(2),
                        message: `✅ SELL order placed! Sold ${args.shares.toFixed(2)} shares of "${args.outcome}" at $${resolvedPrice.toFixed(3)}. Order: ${result.orderId}. Market: ${result.marketUrl || receipt.market_url || 'unavailable'}.`,
                        details: {
                            market: args.question.slice(0, 60),
                            outcome: args.outcome,
                            price: resolvedPrice,
                            shares: args.shares,
                            order_id: result.orderId,
                            market_slug: result.marketSlug || receipt.market_slug,
                            market_url: result.marketUrl || receipt.market_url,
                        }
                    };
                } else {
                    return {
                        success: false,
                        error: result.error || 'SELL order failed'
                    };
                }
            }

            // Handle BUY orders (existing logic)
            if (!args.amount_usd) {
                return {
                    success: false,
                    error: 'BUY orders require amount_usd parameter'
                };
            }

            // Validate minimum order size
            if (args.amount_usd < 1) {
                return {
                    success: false,
                    error: 'Minimum order size is $1 USD'
                };
            }

            // Get or create user
            let user = await prisma.user.findFirst({
                where: { privyDid: userId }
            });

            if (!user) {
                user = await prisma.user.create({
                    data: {
                        privyDid: userId,
                        walletAddress: context?.walletAddress || `temp-${Date.now()}`
                    }
                });
            }

            // Get or create config
            let config = await prisma.polymarketCopyConfig.findFirst({
                where: {
                    userId: user.privyDid,
                    targetWallet: '0x0000000000000000000000000000000000000000'
                }
            });

            if (!config) {
                config = await prisma.polymarketCopyConfig.create({
                    data: {
                        userId: user.privyDid,
                        targetWallet: '0x0000000000000000000000000000000000000000',
                        betSizeUsd: args.amount_usd,
                        maxOpenBets: 10
                    }
                });
            }

            // Place BUY order
            const result = await placeBuyOrder({
                userId: userId,
                configId: config.id,
                tokenId: args.token_id,
                price: resolvedPrice,
                amountUsd: args.amount_usd,
                question: args.question,
                outcome: args.outcome,
                marketSlug: receipt.market_slug || 'direct-trade',
                conditionId: ''
            });

            if (result.success) {
                const shares = (args.amount_usd / resolvedPrice).toFixed(2);
                const marketUrl = result.marketUrl || receipt.market_url;
                return {
                    success: true,
                    order_id: result.orderId,
                    market_slug: result.marketSlug || receipt.market_slug,
                    market_url: marketUrl,
                    amount: `$${args.amount_usd.toFixed(2)}`,
                    shares: shares,
                    message: `✅ BUY order placed! Bought ${shares} shares of "${args.outcome}" at $${resolvedPrice.toFixed(3)} for $${args.amount_usd.toFixed(2)}. Order: ${result.orderId}. Market: ${marketUrl || 'unavailable'}.`,
                    details: {
                        market: args.question.slice(0, 60),
                        outcome: args.outcome,
                        price: resolvedPrice,
                        amount: args.amount_usd,
                        order_id: result.orderId,
                        market_slug: result.marketSlug || receipt.market_slug,
                        market_url: marketUrl,
                    }
                };
            } else {
                return {
                    success: false,
                    error: result.error || 'BUY order failed'
                };
            }
        } catch (error: any) {
            return {
                success: false,
                error: error.message
            };
        }
    },
    permissions: 'authenticated'
};

export const __directTradingTestables = {
    buildPolymarketReadinessGate,
    buildPolymarketBlockedOrderResponse,
};

/**
 * Withdraw/Close Polymarket Position Tool
 */
export const WithdrawPolymarketPositionTool: Tool = {
    definition: {
        name: 'withdraw_polymarket_position',
        description: 'Close/withdraw a Polymarket position by selling all shares. Use when user wants to exit a position completely.',
        parameters: {
            type: 'object',
            properties: {
                position_id: {
                    type: 'string',
                    description: 'Position ID to close'
                },
                current_price: {
                    type: 'number',
                    description: 'Current market price (optional, for calculating exit value)'
                },
                market_slug: {
                    type: 'string',
                    description: 'Optional Polymarket market slug for the position being closed.'
                },
                market_url: {
                    type: 'string',
                    description: 'Optional Polymarket market URL for the position being closed.'
                }
            },
            required: ['position_id']
        }
    },
    handler: async (args: {
        position_id: string;
        current_price?: number;
        market_slug?: string;
        market_url?: string;
    }, context) => {
        const userId = context?.userId;
        if (!userId) {
            throw new Error('User authentication required');
        }

        try {
            const { closePosition } = await import('../../../services/polymarketExecutor.js');
            const receipt = buildPolymarketReceiptFields(args, context);

            const result = await closePosition({
                userId,
                positionId: args.position_id,
                currentPrice: args.current_price
            });

            if (result.success) {
                return {
                    success: true,
                    order_id: result.orderId,
                    market_slug: result.marketSlug || receipt.market_slug,
                    market_url: result.marketUrl || receipt.market_url,
                    message: `✅ Position close order placed. Order: ${result.orderId}. Market: ${result.marketUrl || receipt.market_url || 'unavailable'}.`,
                    position_id: args.position_id
                };
            } else {
                return {
                    success: false,
                    error: result.error || 'Failed to close position'
                };
            }
        } catch (error: any) {
            return {
                success: false,
                error: error.message
            };
        }
    },
    permissions: 'authenticated'
};

/**
 * Cancel Polymarket Order Tool
 */
export const CancelPolymarketOrderTool: Tool = {
    definition: {
        name: 'cancel_polymarket_order',
        description: 'Cancel a pending Polymarket order. Use when user wants to cancel an unfilled order.',
        parameters: {
            type: 'object',
            properties: {
                order_id: {
                    type: 'string',
                    description: 'Order ID to cancel'
                },
                market_slug: {
                    type: 'string',
                    description: 'Optional Polymarket market slug for the cancelled order.'
                },
                market_url: {
                    type: 'string',
                    description: 'Optional Polymarket market URL for the cancelled order.'
                }
            },
            required: ['order_id']
        }
    },
    handler: async (args: {
        order_id: string;
        market_slug?: string;
        market_url?: string;
    }, context) => {
        const userId = context?.userId;
        if (!userId) {
            throw new Error('User authentication required');
        }

        try {
            const { cancelOrder } = await import('../../../services/polymarketExecutor.js');
            const receipt = buildPolymarketReceiptFields(args, context);

            const result = await cancelOrder({
                userId,
                orderId: args.order_id
            });

            if (result.success) {
                return {
                    success: true,
                    message: `✅ Order cancelled successfully. Order: ${args.order_id}. Market: ${receipt.market_url || 'unavailable'}.`,
                    order_id: args.order_id,
                    market_slug: receipt.market_slug,
                    market_url: receipt.market_url,
                };
            } else {
                return {
                    success: false,
                    error: result.error || 'Failed to cancel order'
                };
            }
        } catch (error: any) {
            return {
                success: false,
                error: error.message
            };
        }
    },
    permissions: 'authenticated'
};

/**
 * Modify Polymarket Order Tool
 */
export const ModifyPolymarketOrderTool: Tool = {
    definition: {
        name: 'modify_polymarket_order',
        description: 'Modify an open Polymarket order by cancelling it and replacing it with a new price. Use when the user wants to edit, reprice, or replace an existing order.',
        parameters: {
            type: 'object',
            properties: {
                order_id: {
                    type: 'string',
                    description: 'Existing order ID to modify.'
                },
                new_price: {
                    type: 'number',
                    description: 'Replacement price between 0.01 and 0.99.'
                },
                amount_usd: {
                    type: 'number',
                    description: 'Optional replacement notional for BUY orders. If omitted, the tool reuses the old order notional.'
                },
                shares: {
                    type: 'number',
                    description: 'Optional replacement size for SELL orders. If omitted, the tool reuses the remaining open shares.'
                },
                token_id: {
                    type: 'string',
                    description: 'Optional explicit token ID override. Usually omitted because the tool reuses the existing order asset.'
                },
                question: {
                    type: 'string',
                    description: 'Optional market question override.'
                },
                outcome: {
                    type: 'string',
                    description: 'Optional outcome label override.'
                },
                side: {
                    type: 'string',
                    enum: ['BUY', 'SELL'],
                    description: 'Optional side override. Usually omitted because the tool reuses the existing order side.'
                },
                market_slug: {
                    type: 'string',
                    description: 'Optional Polymarket market slug for the order being replaced.'
                },
                market_url: {
                    type: 'string',
                    description: 'Optional Polymarket market URL for the order being replaced.'
                }
            },
            required: ['order_id', 'new_price']
        }
    },
    handler: async (args: {
        order_id: string;
        new_price: number;
        amount_usd?: number;
        shares?: number;
        token_id?: string;
        question?: string;
        outcome?: string;
        side?: 'BUY' | 'SELL';
        market_slug?: string;
        market_url?: string;
    }, context) => {
        const userId = context?.userId;
        if (!userId) {
            throw new Error('User authentication required');
        }

        try {
            const { modifyOrder } = await import('../../../services/polymarketExecutor.js');
            const receipt = buildPolymarketReceiptFields(args, context);
            const result = await modifyOrder({
                userId,
                orderId: args.order_id,
                newPrice: args.new_price,
                amountUsd: args.amount_usd,
                shares: args.shares,
                tokenId: args.token_id,
                question: args.question,
                outcome: args.outcome,
                side: args.side,
                marketSlug: receipt.market_slug || undefined,
            });

            if (result.success) {
                const marketUrl = result.marketUrl || receipt.market_url;
                return {
                    success: true,
                    order_id: result.newOrderId,
                    replaced_order_id: args.order_id,
                    market_slug: result.marketSlug || receipt.market_slug,
                    market_url: marketUrl,
                    message: `✅ Order replaced successfully at $${args.new_price.toFixed(3)}. Old order: ${args.order_id}. New order: ${result.newOrderId}. Market: ${marketUrl || 'unavailable'}.`
                };
            }

            return {
                success: false,
                replaced_order_id: args.order_id,
                cancelled_original: result.cancelledOriginal || false,
                market_slug: result.marketSlug || receipt.market_slug,
                market_url: result.marketUrl || receipt.market_url,
                error: result.error || 'Failed to modify order'
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message
            };
        }
    },
    permissions: 'authenticated'
};
