import { Tool, ToolContext } from '../../../tools/registry.js';
import { TradeContext, getTradeContext } from '../../../services/TradeContext.js';
import { getTokenData } from '../../../services/UnifiedDataLayer.js';
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

CRITICAL ERROR HANDLING:
- If this tool returns an "error" field, YOU MUST STOP IMMEDIATELY and respond to the user with the error message.
- DO NOT retry or call other tools after receiving an error.
- DO NOT continue iterating - respond directly to the user explaining what went wrong.
- Errors indicate unrecoverable failures (insufficient liquidity, transaction reverted, etc.)

BALANCE CONTEXT USAGE:
- If [USER_BALANCE_CONTEXT] is provided, it shows tokens with their contract addresses in format: "SYMBOL: balance (0x...)"
- When user says "swap ETH to USDC", look up USDC's contract address from the balance context
- Use the contract address (from parentheses) as token_out parameter
- For native tokens (ETH, SOL, etc.), use the symbol directly

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
                    description: 'The source token symbol (e.g. ETH, USDC) or contract address (0x...). Use contract address from [USER_BALANCE_CONTEXT] if available.'
                },
                token_out: {
                    type: 'string',
                    description: 'The destination token symbol or contract address (0x...). IMPORTANT: Use contract address from [USER_BALANCE_CONTEXT] if token is in user portfolio.'
                },
                amount_in: {
                    type: 'string',
                    description: 'NUMERIC amount to swap (e.g. "0.1"). Must be a number, not "all" or "max". Get actual balance from get_wallet_info or [USER_BALANCE_CONTEXT] first.'
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

            // ========== ⚡ TRADE CONTEXT OPTIMIZATION ⚡ ==========
            // Get or create TradeContext for caching token data across the swap flow
            const tradeCtx = getTradeContext(context);
            console.log(`[PrepareSwapTransaction] Using TradeContext: ${tradeCtx.id}`);

            // ========== ⚡ INSTANT PRE-WARMING OPTIMIZATION ⚡ ==========
            // Start quote fetch IMMEDIATELY before any checks
            // This overlaps network I/O with validation logic
            const API_BASE = process.env.API_BASE_URL ||
                (process.env.PORT ? `http://127.0.0.1:${process.env.PORT}` : 'http://localhost:3001');
            const accessToken = context?.accessToken;

            // Get user's wallet address for quote (required by 0x API)
            let userWalletAddress: string | undefined;
            try {
                const userId = context?.userId;
                if (userId && accessToken) {
                    const { getEmbeddedWalletAddress } = await import('../../../services/privyWallet.js');
                    userWalletAddress = await getEmbeddedWalletAddress(userId) || undefined;
                    console.log('[PrepareSwapTransaction] User wallet address:', userWalletAddress?.slice(0, 10) + '...');
                }
            } catch (err) {
                console.debug('[PrepareSwapTransaction] Could not get wallet address, proceeding without it');
            }

            // Launch quote fetch in background (don't await yet)
            const preWarmQuotePromise = (async () => {
                try {
                    console.log('[PrepareSwapTransaction] ⚡ PRE-WARMING: Quote fetch started (performance optimization, non-critical)');
                    const startTime = Date.now();

                    const response = await fetch(`${API_BASE}/api/swap/quote`, {
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
                            slippageBps: Math.round((args.slippage || 0.5) * 100),
                            userAddress: userWalletAddress // CRITICAL: Include user address for 0x API taker parameter
                        })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        const duration = Date.now() - startTime;
                        console.log(`[PrepareSwapTransaction] ⚡ PRE-WARMED quote ready (${duration}ms):`, {
                            dex: data.quote?.dexName,
                            priceImpact: data.quote?.priceImpact
                        });
                        return data;
                    }
                    return null;
                } catch (err: any) {
                    console.debug('[PrepareSwapTransaction] Pre-warm failed (expected for new/illiquid tokens, will retry):', err.message);
                    return null;
                }
            })();
            // ========== END PRE-WARMING ==========

            // 1. Validate inputs (basic)
            if (isNaN(parseFloat(args.amount_in)) || parseFloat(args.amount_in) <= 0) {
                return { error: 'Invalid amount. Please provide a positive number.', mode: 'error' };
            }

            // 2. CODE-LEVEL SAFETY GATE (MANDATORY - Cannot be bypassed by LLM)
            // Check if token_out is a known safe token (whitelist)
            const SAFE_TOKENS = [
                'eth', 'weth', 'usdc', 'usdt', 'dai', 'sol', 'btc', 'wbtc',
                '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
                '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
                '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
            ];

            const tokenOutLower = args.token_out.toLowerCase();
            const isSafeToken = SAFE_TOKENS.some(safe => tokenOutLower.includes(safe.toLowerCase()));

            if (!isSafeToken) {
                console.log('[PrepareSwapTransaction] Non-safe token detected, running MANDATORY Market Structure check...');

                try {
                    // 1. FAST MARKET STRUCTURE CHECK (Liquidity / FDV)
                    // ⚡ Use TradeContext-aware data fetching (auto-caches)
                    const tokenData = await getTokenData(args.token_out, args.chain_id, tradeCtx);

                    if (tokenData) {
                        const liquidity = tokenData.liquidity || 0;
                        const fdv = tokenData.marketCap || 0;

                        // Rule: Block if Liquidity is extremely low compared to trade size or absolute minimum
                        if (liquidity < 1000) {
                            return {
                                error: `🚨 SECURITY BLOCK: Extremely low liquidity ($${liquidity.toFixed(0)}). Buying this token would likely result in 100% loss.`,
                                riskDetails: { liquidity, fdv, status: 'Extremely Illiquid' }
                            };
                        }
                    }

                    // 2. SIMULATION CHECK (Price Impact)
                    // OPTIMIZATION: Use pre-warmed quote if available
                    const preWarmedQuote = await preWarmQuotePromise;

                    if (preWarmedQuote && preWarmedQuote.quote) {
                        console.log('[PrepareSwapTransaction] ✅ Using pre-warmed quote for safety check');
                        const impact = parseFloat(preWarmedQuote.quote.priceImpact || '0');

                        if (impact > 20) {
                            return {
                                error: `🚨 SECURITY BLOCK: Price Impact is too high (${impact}%). You would lose significantly on this trade.`,
                                riskDetails: { priceImpact: impact, status: 'High Slippage' }
                            };
                        }
                    } else {
                        // Fallback: fetch quote if pre-warm failed
                        console.log('[PrepareSwapTransaction] Pre-warm unavailable (trying fresh quote for safety check)');
                        const quoteResponse = await fetch(`${API_BASE}/api/swap/quote`, {
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
                                slippageBps: 100 // 1% for simulation
                            })
                        });

                        if (quoteResponse.ok) {
                            const quoteData = await quoteResponse.json() as any;
                            const impact = parseFloat(quoteData.quote?.priceImpact || '0');

                            if (impact > 20) {
                                return {
                                    error: `🚨 SECURITY BLOCK: Price Impact is too high (${impact}%). You would lose significantly on this trade.`,
                                    riskDetails: { priceImpact: impact, status: 'High Slippage' }
                                };
                            }
                        }
                    }
                } catch (safetyError: any) {
                    console.error('[PrepareSwapTransaction] Safety check error:', safetyError.message);
                    // Fallback to allowing preparation if safety check fails (avoid blocking valid trades due to API issues)
                }
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
                const sessionId = context?.sessionId;

                if (!userId || !accessToken || !sessionId) {
                    console.warn('[PrepareSwapTransaction] Missing userId/accessToken/sessionId, falling back to client action');
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
                        mode: 'execute_client',
                        requires_user_confirmation: false,
                        summary: `Executing instant swap: ${args.amount_in} ${args.token_in} → ${args.token_out} on chain ${args.chain_id}. Transaction will be submitted automatically.`
                    };
                }

                // ⚡ STEP 1: Create persistent transaction card message IMMEDIATELY
                const { createMessage, updateMessage } = await import('../../../repositories/chatRepository.js');
                const { chatWS } = await import('../../../services/chatWebSocket.js');

                const transactionMessage = await createMessage(
                    sessionId,
                    'assistant',
                    JSON.stringify({
                        type: 'transaction_card',
                        status: 'pending',
                        swapType: 'buy',
                        tokenIn: args.token_in,
                        tokenOut: args.token_out,
                        amountIn: args.amount_in,
                        chainId: args.chain_id,
                        slippage: args.slippage || 0.5,
                        startedAt: Date.now(),
                        message: '⏳ Initiating swap transaction...'
                    }),
                    { type: 'transaction_card' }
                );

                console.log(`[PrepareSwapTransaction] Created transaction message: ${transactionMessage.id}`);

                // Push pending card to frontend via WebSocket
                chatWS.broadcast(userId, {
                    type: 'transaction_update',
                    messageId: transactionMessage.id,
                    status: 'pending',
                    data: {
                        tokenIn: args.token_in,
                        tokenOut: args.token_out,
                        amountIn: args.amount_in
                    }
                });

                // ⚡ STEP 2: Execute swap (blocking - wait for result)
                const API_BASE = process.env.API_BASE_URL ||
                    (process.env.PORT ? `http://127.0.0.1:${process.env.PORT}` : 'http://localhost:3001');

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 150000);

                try {
                    const response = await fetch(`${API_BASE}/api/swap/execute-instant`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${accessToken}`,
                            'X-Transaction-Message-Id': transactionMessage.id // Pass message ID for updates
                        },
                        body: JSON.stringify({
                            tokenIn: args.token_in,
                            tokenOut: args.token_out,
                            amountIn: args.amount_in,
                            chainId: args.chain_id,
                            slippageBps: Math.round((args.slippage || 0.5) * 100),
                            messageId: transactionMessage.id // For backend to update progress
                        }),
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);
                    const result = await response.json() as { success?: boolean; error?: string; message?: string; data?: { txHash?: string } };

                    // ⚡ STEP 3: Update transaction message with final result
                    const finalStatus = response.ok && result.success ? 'success' : 'failed';
                    const messageContent = JSON.parse(transactionMessage.content as string);

                    await updateMessage(transactionMessage.id, {
                        content: JSON.stringify({
                            ...messageContent,
                            status: finalStatus,
                            txHash: result.data?.txHash,
                            error: result.error,
                            completedAt: Date.now(),
                            duration: Date.now() - messageContent.startedAt,
                            message: finalStatus === 'success'
                                ? `✅ Swap completed! Transaction: ${result.data?.txHash?.slice(0, 10)}...`
                                : `❌ Swap failed: ${result.error || 'Unknown error'}`
                        })
                    });

                    // Push final status to frontend
                    chatWS.broadcast(userId, {
                        type: 'transaction_complete',
                        messageId: transactionMessage.id,
                        status: finalStatus,
                        txHash: result.data?.txHash,
                        error: result.error,
                        data: {}
                    });

                    if (!response.ok || !result.success) {
                        const errorMsg = result.error || result.message || 'Swap execution failed';
                        console.error('[PrepareSwapTransaction] Backend swap failed:', errorMsg);

                        return {
                            error: `Swap failed: ${errorMsg}`,
                            mode: 'error',
                            messageId: transactionMessage.id,
                            details: result,
                            _final: true,
                            _user_message: `❌ Transaction failed: ${errorMsg}\n\nThis token may have restrictions or insufficient liquidity. Please try a different token or smaller amount.`
                        };
                    }

                    console.log('[PrepareSwapTransaction] Backend swap successful:', result);

                    // ⚡ Return success with messageId (card already saved and displayed)
                    return {
                        success: true,
                        mode: 'executed',
                        txHash: result.data?.txHash,
                        messageId: transactionMessage.id,
                        summary: `✅ Swap executed successfully! ${args.amount_in} ${args.token_in} → ${args.token_out}. Transaction: ${result.data?.txHash?.slice(0, 10)}...`,
                        data: result.data,
                        _final: true // Force AI to stop iterating
                    };

                } catch (innerError: any) {
                    clearTimeout(timeoutId);

                    // Check if it's a timeout error
                    if (innerError.name === 'AbortError') {
                        console.error('[PrepareSwapTransaction] Request timeout after 150s');

                        // Update message to timeout status
                        const messageContent = JSON.parse(transactionMessage.content as string);
                        await updateMessage(transactionMessage.id, {
                            content: JSON.stringify({
                                ...messageContent,
                                status: 'failed',
                                error: 'Transaction timeout',
                                completedAt: Date.now()
                            })
                        });

                        return {
                            error: 'Swap request timed out after 150 seconds. Please try again.',
                            mode: 'error',
                            messageId: transactionMessage.id,
                            timeout: true,
                            _final: true,
                            _user_message: `⏱️ Transaction timed out after 150 seconds.\n\nThe network may be congested. Please try again in a moment.`
                        };
                    }

                    // Handle socket/network errors
                    const errorCode = innerError.code || innerError.cause?.code || '';
                    const isSocketError = errorCode === 'UND_ERR_SOCKET' || innerError.message?.includes('other side closed');

                    if (isSocketError) {
                        // CRITICAL FIX: Socket error means connection lost DURING transaction
                        // The backend may still be processing (approval + swap + retry)
                        // OPTIMIZED: Faster polling with exponential backoff
                        console.warn('[PrepareSwapTransaction] Socket error - waiting for backend to complete transaction...');

                        try {
                            const { prisma } = await import('../../../db/prisma.js');

                            // Optimized polling: Start fast, slow down if no result
                            const maxWaitTime = 60000; // 60 seconds total (reduced from 90s)
                            const startTime = Date.now();
                            let pollInterval = 500; // Start with 500ms (reduced from 1s)
                            const maxPollInterval = 3000; // Max 3s (reduced from 5s)

                            let recentSwap = null;
                            let pollCount = 0;

                            while (Date.now() - startTime < maxWaitTime) {
                                pollCount++;

                                // Query most recent swap for this user
                                recentSwap = await prisma.swapHistory.findFirst({
                                    where: {
                                        userId: context?.userId,
                                        createdAt: {
                                            gte: new Date(startTime - 5000) // Include 5s buffer before socket error
                                        },
                                        tokenInAddress: {
                                            contains: args.token_in,
                                            mode: 'insensitive'
                                        }
                                    },
                                    orderBy: {
                                        createdAt: 'desc'
                                    }
                                });

                                if (recentSwap && recentSwap.txHash) {
                                    // Transaction was recorded! Return success
                                    console.log(`[PrepareSwapTransaction] ✅ Found transaction after ${Math.round((Date.now() - startTime) / 1000)}s (${pollCount} polls):`, recentSwap.txHash);
                                    return {
                                        success: true,
                                        mode: 'executed',
                                        txHash: recentSwap.txHash,
                                        summary: `✅ Swap executed successfully! ${args.amount_in} ${args.token_in} → ${args.token_out}. Transaction: ${recentSwap.txHash.slice(0, 10)}...`,
                                        data: {
                                            txHash: recentSwap.txHash,
                                            status: recentSwap.status,
                                            tradeId: recentSwap.id
                                        },
                                        _final: true,
                                        recovered_from_socket_error: true
                                    };
                                }

                                // Log only every 5 polls to reduce noise
                                if (pollCount % 5 === 0) {
                                    console.log(`[PrepareSwapTransaction] Polling... ${Math.round((Date.now() - startTime) / 1000)}s elapsed (${pollCount} attempts)`);
                                }

                                // Wait before next poll (exponential backoff)
                                await new Promise(resolve => setTimeout(resolve, pollInterval));
                                pollInterval = Math.min(pollInterval * 1.2, maxPollInterval);
                            }

                            // Timeout - no transaction found
                            console.warn(`[PrepareSwapTransaction] Timeout after ${Math.round((Date.now() - startTime) / 1000)}s (${pollCount} polls) - no transaction found`);
                        } catch (dbError: any) {
                            console.error('[PrepareSwapTransaction] Database query failed:', dbError.message);
                        }

                        // If no transaction found in DB, ask user to verify manually
                        await updateMessage(transactionMessage.id, {
                            content: JSON.stringify({
                                ...JSON.parse(transactionMessage.content as string),
                                status: 'pending_verification',
                                error: 'Connection lost during transaction',
                                completedAt: Date.now()
                            })
                        });

                        return {
                            error: 'Connection lost - transaction status unclear',
                            mode: 'pending_verification',
                            messageId: transactionMessage.id,
                            _final: true,
                            _user_message: `⚠️ Connection lost while submitting transaction.\n\n**Please check your wallet:**\n- Look for pending/recent transactions\n- The swap may have been submitted to the blockchain\n- Do NOT retry if transaction is already pending\n\nIf you see the transaction, it will be confirmed shortly. Otherwise, you can try again.`
                        };
                    }

                    // Other network error
                    console.error('[PrepareSwapTransaction] Network error:', innerError.message);

                    await updateMessage(transactionMessage.id, {
                        content: JSON.stringify({
                            ...JSON.parse(transactionMessage.content as string),
                            status: 'failed',
                            error: innerError.message,
                            completedAt: Date.now()
                        })
                    });

                    return {
                        error: `Network error: ${innerError.message}`,
                        mode: 'error',
                        messageId: transactionMessage.id,
                        _final: true,
                        _user_message: `❌ Network error occurred: ${innerError.message}\n\nPlease try again.`
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
                mode: 'prepared',
                requires_user_confirmation: true,
                summary: `Prepared swap for ${args.amount_in} ${args.token_in} to ${args.token_out} on chain ${args.chain_id}. Please confirm the transaction details in the card.`
            };

        } catch (error: any) {
            console.error('[PrepareSwapTransaction] Error:', error);
            return { error: `Failed to prepare swap: ${error.message}`, mode: 'error' };
        }
    }
};
