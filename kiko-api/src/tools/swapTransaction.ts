import { Tool, ToolContext } from './registry.js';
// Note: swapAggregator import removed - using internal API call instead

interface SwapArgs {
    token_in: string; // Symbol or address
    token_out: string; // Symbol or address
    amount_in: string; // Amount in human readable format (e.g. "1.5")
    chain_id: number;
    slippage?: number; // percentage, e.g. 0.5
    execute?: boolean; // If true, execute the swap directly (instant trading)
}

export const PrepareSwapTransactionTool: Tool<SwapArgs> = {
    definition: {
        name: 'prepare_swap_transaction',
        description: `Prepare and optionally execute a token swap transaction. Use this when the user explicitly wants to swap, trade, or buy/sell tokens. Set execute=true for instant trading.

IMPORTANT: If user says 'all', 'max', or 'full balance':
1. First call get_wallet_info to get their current balance for the source token
2. Then use the EXACT balance amount (e.g. '0.622398') as amount_in - NOT 'all'
3. This ensures the swap uses the correct amount

The amount_in parameter MUST be a numeric string like '0.1' or '100'. Never pass 'all' or 'max' as amount_in.`,
        parameters: {
            type: 'object',
            properties: {
                token_in: {
                    type: 'string',
                    description: 'The source token symbol (e.g. ETH, USDC) or address'
                },
                token_out: {
                    type: 'string',
                    description: 'The destination token symbol or address'
                },
                amount_in: {
                    type: 'string',
                    description: 'NUMERIC amount to swap (e.g. "0.1"). Must be a number, not "all" or "max". Get actual balance from get_wallet_info first.'
                },
                chain_id: {
                    type: 'number',
                    description: 'The chain ID (e.g. 1 for ETH, 8453 for Base)'
                },
                slippage: {
                    type: 'number',
                    description: 'Slippage tolerance in percentage. Use value from user settings if available.',
                    default: 0.5
                },
                execute: {
                    type: 'boolean',
                    description: `CRITICAL: Controls whether the swap executes automatically or shows a confirmation card.
- Set to FALSE (default): Shows a swap card for user to review and confirm manually.
- Set to TRUE: Executes the swap automatically without confirmation.

You MUST check the user's 'Swap Method' setting in [USER_PREFERENCES_MODULE]:
- If "SWAP CARD MODE": Always set execute=false
- If "ALLOWANCE TRADE MODE": Set execute=true`,
                    default: false
                }
            },
            required: ['token_in', 'token_out', 'amount_in', 'chain_id']
        }
    },
    handler: async (args, context) => {
        try {
            console.log('[PrepareSwapTransaction] Preparing swap:', args);

            // 1. Validate inputs (basic)
            if (isNaN(parseFloat(args.amount_in)) || parseFloat(args.amount_in) <= 0) {
                return { error: 'Invalid amount. Please provide a positive number.' };
            }

            // Check if instant execution is requested (default: true) AND user approves auto-execution
            // via custom settings "allowance" mode.
            // If settings are missing or not 'allowance', fallback to safe 'show_swap_card' mode.

            // Safely access swapMethod from toolConfig (frontend sends camelCase 'swapMethod')
            const config = context?.toolConfig as any;
            const swapMethod = config?.swapMethod || config?.swap_method || 'confirm';
            const fastSwapMode = config?.fastSwapMode === true;

            // Execute instantly if:
            // 1. args.execute is explicitly true AND swapMethod is 'allowance_trade', OR
            // 2. fastSwapMode is enabled (for Zora fast swap)
            const shouldExecute = (args.execute !== false && (swapMethod === 'allowance' || swapMethod === 'allowance_trade')) || fastSwapMode;

            console.log('[PrepareSwapTransaction] Execution Decision:', {
                argsExecute: args.execute,
                swapMethod,
                fastSwapMode,
                finalDecision: shouldExecute
            });

            if (shouldExecute) {
                console.log('[PrepareSwapTransaction] Executing backend swap via internal API...');

                // Get user ID and access token from context
                const userId = context?.userId;
                const accessToken = context?.accessToken;

                if (!userId || !accessToken) {
                    console.warn('[PrepareSwapTransaction] Missing userId or accessToken, falling back to client action');
                    // Fallback to client action if no auth context
                    return {
                        __client_action: {
                            type: 'execute_swap_instant',
                            payload: {
                                tokenIn: args.token_in,
                                tokenOut: args.token_out,
                                amountIn: args.amount_in,
                                chainId: args.chain_id,
                                slippage: args.slippage || 0.5
                            }
                        },
                        summary: `Executing instant swap: ${args.amount_in} ${args.token_in} → ${args.token_out} on chain ${args.chain_id}. Transaction will be submitted automatically.`
                    };
                }

                try {
                    const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001';

                    // Check if this is a Zora token on Base chain - use Zora SDK for optimal execution
                    // Zora tokens are best swapped via Zora SDK's createTradeCall which uses the bonding curve directly
                    const isBaseChain = args.chain_id === 8453;
                    const isZoraToken = context?.tokenLaunchpad === 'zora' || fastSwapMode; // If fastSwapMode, try Zora first

                    if (isBaseChain && isZoraToken && fastSwapMode) {
                        console.log('[PrepareSwapTransaction] Using Zora SDK for optimized swap...');

                        try {
                            const zoraResponse = await fetch(`${API_BASE}/api/zora/swap`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${accessToken}`
                                },
                                body: JSON.stringify({
                                    tokenAddress: args.token_out, // The token we're buying
                                    buyAmountEth: args.amount_in.toString(),
                                    maxSlippage: args.slippage || 1.5
                                })
                            });

                            const zoraResult = await zoraResponse.json() as { success?: boolean; error?: string; txHash?: string };

                            if (zoraResponse.ok && zoraResult.success && zoraResult.txHash) {
                                console.log('[PrepareSwapTransaction] Zora swap successful:', zoraResult.txHash);
                                return {
                                    success: true,
                                    txHash: zoraResult.txHash,
                                    summary: `✅ Zora Fast Swap executed! ${args.amount_in} ETH → ${args.token_out}. Transaction: ${zoraResult.txHash.slice(0, 10)}...`,
                                    method: 'zora_sdk'
                                };
                            } else {
                                console.warn('[PrepareSwapTransaction] Zora swap failed, falling back to general aggregator:', zoraResult.error);
                                // Fall through to general aggregator
                            }
                        } catch (zoraError: any) {
                            console.warn('[PrepareSwapTransaction] Zora swap error, falling back to general aggregator:', zoraError.message);
                            // Fall through to general aggregator
                        }
                    }

                    // General aggregator swap (0x/KyberSwap)
                    const response = await fetch(`${API_BASE}/api/swap/execute-instant`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${accessToken}`
                        },
                        body: JSON.stringify({
                            tokenIn: args.token_in,
                            tokenOut: args.token_out,
                            amountIn: args.amount_in,
                            chainId: args.chain_id,
                            slippageBps: Math.round((args.slippage || 0.5) * 100) // Convert percentage to basis points
                        })
                    });

                    const result = await response.json() as { success?: boolean; error?: string; message?: string; data?: { txHash?: string } };

                    if (!response.ok || !result.success) {
                        const errorMsg = result.error || result.message || 'Swap execution failed';
                        console.error('[PrepareSwapTransaction] Backend swap failed:', errorMsg);
                        return {
                            error: `Swap failed: ${errorMsg}`,
                            details: result
                        };
                    }

                    console.log('[PrepareSwapTransaction] Backend swap successful:', result);

                    // Return success with transaction hash
                    return {
                        success: true,
                        txHash: result.data?.txHash,
                        summary: `✅ Swap executed successfully! ${args.amount_in} ${args.token_in} → ${args.token_out}. Transaction: ${result.data?.txHash?.slice(0, 10)}...`,
                        data: result.data
                    };
                } catch (fetchError: any) {
                    console.error('[PrepareSwapTransaction] Fetch error:', fetchError);
                    // Fallback to client action on network error
                    return {
                        __client_action: {
                            type: 'execute_swap_instant',
                            payload: {
                                tokenIn: args.token_in,
                                tokenOut: args.token_out,
                                amountIn: args.amount_in,
                                chainId: args.chain_id,
                                slippage: args.slippage || 0.5
                            }
                        },
                        summary: `Executing instant swap: ${args.amount_in} ${args.token_in} → ${args.token_out} on chain ${args.chain_id}. Transaction will be submitted automatically.`,
                        fallbackReason: fetchError.message
                    };
                }
            }

            // Fallback: show swap card for manual confirmation
            return {
                __client_action: {
                    type: 'show_swap_card',
                    payload: {
                        tokenIn: args.token_in,
                        tokenOut: args.token_out,
                        amountIn: args.amount_in,
                        chainId: args.chain_id,
                        slippage: args.slippage || 0.5
                    }
                },
                summary: `Prepared swap for ${args.amount_in} ${args.token_in} to ${args.token_out} on chain ${args.chain_id}. Please confirm the transaction details in the card.`
            };

        } catch (error: any) {
            console.error('[PrepareSwapTransaction] Error:', error);
            return { error: `Failed to prepare swap: ${error.message}` };
        }
    }
};
