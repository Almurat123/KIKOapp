/**
 * Polymarket Direct Trading AI Tools
 * Tools for AI to help users place direct orders on Polymarket
 */

import { Tool } from '../../../tooling/registry.js';
import prisma from '../../../db/prisma.js';
import { createOrDeriveCredentials, getPolymarketWallet } from '../../../services/polymarketCredService.js';
import { checkTradingReadiness, getRequiredApprovals } from '../../../services/polymarketApprovalService.js';
import { placeBuyOrder } from '../../../services/polymarketExecutor.js';
import { getExecutablePrice } from '../../../services/polymarketDataService.js';

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

            return {
                ready: readiness.isReady,
                chain_policy: 'polygon_only',
                credentials: readiness.hasCredentials,
                delegation: readiness.hasDelegatedEvm,
                approvals: {
                    usdc: readiness.hasUsdcApproval ? '✅' : '❌',
                    ctf: readiness.hasCtfApproval ? '✅' : '❌'
                },
                wallet_address: readiness.walletAddress,
                usdc_balance: readiness.usdcBalance,
                native_usdc_balance: readiness.nativeUsdcBalance,
                conversion_required: readiness.conversionRequired,
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
                    : readiness.conversionRequired
                        ? 'Convert Polygon native USDC (0x3c499c542cef5e3811e1192ce70d8cc03d5c3359) to Polymarket USDC.e (0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174) using prepare_swap_transaction, then check readiness again. No wallet chain switch is required.'
                        : readiness.missingSteps[0]
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
    }, context) => {
        const userId = context?.userId;
        if (!userId) {
            throw new Error('User authentication required');
        }

        const side = args.side || 'BUY';

        try {
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
                        shares: args.shares.toFixed(2),
                        message: `✅ SELL order placed! Sold ${args.shares.toFixed(2)} shares of "${args.outcome}" at $${resolvedPrice.toFixed(3)}.`,
                        details: {
                            market: args.question.slice(0, 60),
                            outcome: args.outcome,
                            price: resolvedPrice,
                            shares: args.shares
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
                marketSlug: 'direct-trade',
                conditionId: ''
            });

            if (result.success) {
                const shares = (args.amount_usd / resolvedPrice).toFixed(2);
                return {
                    success: true,
                    order_id: result.orderId,
                    amount: `$${args.amount_usd.toFixed(2)}`,
                    shares: shares,
                    message: `✅ BUY order placed! Bought ${shares} shares of "${args.outcome}" at $${resolvedPrice.toFixed(3)} for $${args.amount_usd.toFixed(2)}.`,
                    details: {
                        market: args.question.slice(0, 60),
                        outcome: args.outcome,
                        price: resolvedPrice,
                        amount: args.amount_usd
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
                }
            },
            required: ['position_id']
        }
    },
    handler: async (args: {
        position_id: string;
        current_price?: number;
    }, context) => {
        const userId = context?.userId;
        if (!userId) {
            throw new Error('User authentication required');
        }

        try {
            const { closePosition } = await import('../../../services/polymarketExecutor.js');

            const result = await closePosition({
                userId,
                positionId: args.position_id,
                currentPrice: args.current_price
            });

            if (result.success) {
                return {
                    success: true,
                    order_id: result.orderId,
                    message: '✅ Position closed successfully! All shares have been sold.',
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
                }
            },
            required: ['order_id']
        }
    },
    handler: async (args: {
        order_id: string;
    }, context) => {
        const userId = context?.userId;
        if (!userId) {
            throw new Error('User authentication required');
        }

        try {
            const { cancelOrder } = await import('../../../services/polymarketExecutor.js');

            const result = await cancelOrder({
                userId,
                orderId: args.order_id
            });

            if (result.success) {
                return {
                    success: true,
                    message: '✅ Order cancelled successfully!',
                    order_id: args.order_id
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
    }, context) => {
        const userId = context?.userId;
        if (!userId) {
            throw new Error('User authentication required');
        }

        try {
            const { modifyOrder } = await import('../../../services/polymarketExecutor.js');
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
            });

            if (result.success) {
                return {
                    success: true,
                    order_id: result.newOrderId,
                    replaced_order_id: args.order_id,
                    message: `✅ Order replaced successfully at $${args.new_price.toFixed(3)}.`
                };
            }

            return {
                success: false,
                replaced_order_id: args.order_id,
                cancelled_original: result.cancelledOriginal || false,
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
