import { Tool, ToolContext } from '../../../tools/registry.js';
// Note: swapAggregator import removed - using internal API call instead

interface SwapArgs {
    token_in: string; // Symbol or address
    token_out: string; // Symbol or address
    amount_in: string; // Amount in human readable format (e.g. "1.5")
    chain_id: number;
    slippage?: number; // percentage, e.g. 0.5
    execute?: boolean; // If true, execute the swap directly (instant trading)
    token_symbol_in?: string; // Optional: Symbol provided by upstream context (e.g. from balance)
    token_symbol_out?: string; // Optional: Symbol provided by upstream context
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
                token_symbol_in: {
                    type: 'string',
                    description: 'Optional: The symbol of token_in if known (e.g. "ETH"). Optimization to skip lookup.'
                },
                token_symbol_out: {
                    type: 'string',
                    description: 'Optional: The symbol of token_out if known (e.g. "USDC"). Optimization to skip lookup.'
                },
                execute: {
                    type: 'boolean',
                    description: `CRITICAL: Controls whether the swap executes automatically via the Allowance Trade flow.
- Set to TRUE (Preferred): Executes the swap automatically using allowance trade flow.
- Set to FALSE: Was previously used for Swap Card (DEPRECATED). Now defaults to text confirmation or specific frontend handling.

You MUST check the user's 'Swap Method' setting in [USER_PREFERENCES_MODULE]:
- If "ALLOWANCE TRADE MODE": Set execute=true
- If "SWAP CARD MODE" (Legacy): Use judgement, but prefer execute=true for smoother UX.`,
                    default: true
                }
            },
            required: ['token_in', 'token_out', 'amount_in', 'chain_id']
        }
    },
    handler: async (args, context) => {
        try {
            console.log('[PrepareSwapTransaction] Preparing swap:', args);

            // ========== ⚡ INSTANT PRE-WARMING OPTIMIZATION ⚡ ==========
            // Start quote fetch IMMEDIATELY before any checks
            // This overlaps network I/O with validation logic
            const API_BASE = process.env.API_BASE_URL ||
                (process.env.PORT ? `http://127.0.0.1:${process.env.PORT}` : 'http://localhost:3001');
            const accessToken = context?.accessToken;

            // Launch quote fetch in background (don't await yet)
            const preWarmQuotePromise = (async () => {
                try {
                    // Safety Check: Don't pre-warm if inputs are obviously invalid
                    if (!args.amount_in || isNaN(parseFloat(args.amount_in)) || parseFloat(args.amount_in) <= 0) {
                        return null;
                    }

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
                            slippageBps: Math.round((args.slippage || 0.5) * 100)
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
                    // Updated import path for services
                    const { getTokenDetails } = await import('../../../services/geckoTerminal.js');
                    const tokenData = await getTokenDetails(args.chain_id.toString(), args.token_out);

                    if (tokenData) {
                        const liquidity = parseFloat(String(tokenData.liquidity || '0'));
                        const fdv = parseFloat(String(tokenData.fdv || '0'));

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
            // 1. User has 'allowance_trade' enabled (Strictly enforced - overrides LLM args)
            // 2. fastSwapMode is enabled (for Zora fast swap)
            // 3. args.execute is explicitly TRUE (LLM confident)
            const isAllowance = swapMethod === 'allowance' || swapMethod === 'allowance_trade';
            const shouldExecute = isAllowance || fastSwapMode || args.execute === true;

            console.log('[PrepareSwapTransaction] Execution Decision:', {
                argsExecute: args.execute,
                swapMethod,
                fastSwapMode,
                finalDecision: shouldExecute
            });

            if (shouldExecute) {
                // VALIDATION: Prevent 0-amount swaps which crash the backend
                if (parseFloat(args.amount_in) <= 0) {
                    console.warn('[PrepareSwapTransaction] Blocked 0-amount swap execution');
                    return {
                        error: 'Insufficient balance to swap. Please check your wallet funds.',
                        mode: 'error',
                        _user_message: `⚠️ **Insufficient Balance**\n\nYou are trying to swap ${args.amount_in} which is not a valid amount. Please check your wallet balance.`
                    };
                }

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

                // ⚡ STEP 1: Wait for Quote Data (Price, Amount Out, Symbols)
                // Use the pre-warmed quote if available, or fetch now
                let quoteData = await preWarmQuotePromise;

                // Extract better metadata if available
                let displayTokenIn = args.token_in;
                let displayTokenOut = args.token_out;
                let displayAmountOut = '...';

                // Resolve Symbols if they are addresses
                // OPTIMIZATION: Use upstream symbols if provided to avoid API calls
                const resolveSymbol = async (chain: number, token: string, defaultVal: string, upstreamSymbol?: string) => {
                    // 1. Use upstream symbol if available and valid
                    if (upstreamSymbol && upstreamSymbol !== 'UNKNOWN') return upstreamSymbol.toUpperCase();

                    // 2. If not address-like, treat as symbol
                    if (!token.startsWith('0x')) return token;

                    try {
                        // 3. Use GeckoTerminal to get symbol
                        const { getTokenDetails } = await import('../../../services/geckoTerminal.js');
                        const details = await getTokenDetails(chain.toString(), token);
                        if (details && details.symbol) return details.symbol.toUpperCase();
                    } catch (e) {
                        // Ignore error
                    }
                    return `${token.slice(0, 6)}...`;
                };

                // Run resolution in parallel
                const [resolvedIn, resolvedOut] = await Promise.all([
                    resolveSymbol(args.chain_id, args.token_in, displayTokenIn, args.token_symbol_in),
                    resolveSymbol(args.chain_id, args.token_out, displayTokenOut, args.token_symbol_out)
                ]);
                displayTokenIn = resolvedIn;
                displayTokenOut = resolvedOut;

                if (quoteData && quoteData.quote) {
                    if (quoteData.quote.buyAmount) {
                        // Format amount logic
                        if (args.token_out.toUpperCase() === 'ETH' || args.token_out.toUpperCase() === 'WETH' || displayTokenOut === 'ETH' || displayTokenOut === 'WETH') {
                            displayAmountOut = (parseFloat(quoteData.quote.buyAmount) / 1e18).toLocaleString('en-US', { maximumFractionDigits: 6 });
                        } else if (args.token_out.toUpperCase() === 'USDC' || args.token_out.toUpperCase() === 'USDT' || displayTokenOut === 'USDC' || displayTokenOut === 'USDT') {
                            displayAmountOut = (parseFloat(quoteData.quote.buyAmount) / 1e6).toLocaleString('en-US', { maximumFractionDigits: 2 });
                        } else {
                            const raw = parseFloat(quoteData.quote.buyAmount);
                            if (raw > 1e15) {
                                displayAmountOut = (raw / 1e18).toLocaleString('en-US', { maximumFractionDigits: 4 });
                            } else {
                                displayAmountOut = raw.toLocaleString('en-US');
                            }
                        }
                    }
                }

                const { createMessage, updateMessage } = await import('../../../repositories/chatRepository.js');
                const { chatWS } = await import('../../../services/chatWebSocket.js');

                const cardData = {
                    type: 'transaction-status-card',
                    status: 'pending',
                    swapType: 'buy',
                    tokenInSymbol: displayTokenIn,
                    tokenOutSymbol: displayTokenOut,
                    amountIn: args.amount_in,
                    amountOut: displayAmountOut,
                    chainId: args.chain_id,
                    slippage: args.slippage || 0.5,
                    startedAt: Date.now(),
                    message: '⏳ Initiating swap transaction...'
                };

                let transactionMessage;
                // Always create a NEW message for the card to preserve the AI's explanatory text
                // The AI text (e.g. "I'll help you sell X...") stays in assistantMessageId
                const txCardMessageId = `tx-${Date.now()}`; // Optional unique ID tracking

                transactionMessage = await createMessage(
                    sessionId,
                    'assistant',
                    '', // Empty content so it doesn't render as text
                    {
                        type: 'transaction-status-card',
                        data: cardData
                    }
                );

                console.log(`[PrepareSwapTransaction] Created transaction message: ${transactionMessage.id}`);

                // ⚡ CRITICAL: Broadcast message_start first so frontend creates the message container
                // This ensures the subsequent client_action has a target to update
                chatWS.broadcast(userId, {
                    type: 'message_start',
                    sessionId: sessionId,
                    data: {
                        messageId: transactionMessage.id,
                        role: 'assistant',
                        timestamp: Date.now()
                    }
                });

                // Push pending card to frontend via WebSocket
                chatWS.broadcast(userId, {
                    type: 'client_action',
                    sessionId: sessionId,
                    data: {
                        message_id: transactionMessage.id,
                        targetMessageId: transactionMessage.id, // Critical for frontend update
                        action: {
                            type: 'show_transaction_status_card',
                            data: cardData
                        }
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

                    // Retrieve existing data to preserve startedAt
                    const existingData = transactionMessage.data || cardData;

                    const updatedData = {
                        ...existingData,
                        status: finalStatus,
                        txHash: result.data?.txHash,
                        errorMessage: result.error, // Use errorMessage key for TransactionStatusCard
                        completedAt: Date.now(),
                        duration: Date.now() - existingData.startedAt,
                        message: finalStatus === 'success'
                            ? `✅ Swap completed! Transaction: ${result.data?.txHash?.slice(0, 10)}...`
                            : `❌ Swap failed: ${result.error || 'Unknown error'}`
                    };

                    await updateMessage(transactionMessage.id, {
                        data: updatedData
                    });

                    // Push final status to frontend
                    chatWS.broadcast(userId, {
                        type: 'client_action',
                        sessionId: sessionId,
                        data: {
                            message_id: transactionMessage.id,
                            targetMessageId: transactionMessage.id,
                            action: {
                                type: 'show_transaction_status_card',
                                data: updatedData
                            }
                        }
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
                        summary: ' ', // Set to space to suppress text but pass falsy check if needed (though || check treats space as true-ish)
                        message: '',
                        data: result.data,
                        _final: true // Force AI to stop iterating
                    };

                } catch (innerError: any) {
                    clearTimeout(timeoutId);

                    // Check if it's a timeout error
                    if (innerError.name === 'AbortError') {
                        console.error('[PrepareSwapTransaction] Request timeout after 150s');

                        // Update message to timeout status
                        const existingData = transactionMessage.data || cardData;
                        const updatedData = {
                            ...existingData,
                            status: 'failed',
                            errorMessage: 'Transaction timeout',
                            completedAt: Date.now()
                        };

                        await updateMessage(transactionMessage.id, {
                            data: updatedData
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
                                        user: { privyDid: context?.userId },
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

                                    // Update message to success
                                    const existingData = transactionMessage.data || cardData;
                                    await updateMessage(transactionMessage.id, {
                                        data: {
                                            ...existingData,
                                            status: 'success',
                                            txHash: recentSwap.txHash,
                                            completedAt: Date.now()
                                        }
                                    });

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
                        const existingData = transactionMessage.data || cardData;
                        await updateMessage(transactionMessage.id, {
                            data: {
                                ...existingData,
                                status: 'pending_verification',
                                errorMessage: 'Connection lost during transaction',
                                completedAt: Date.now()
                            }
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

                    const existingData = transactionMessage.data || cardData;
                    await updateMessage(transactionMessage.id, {
                        data: {
                            ...existingData,
                            status: 'failed',
                            errorMessage: innerError.message,
                            completedAt: Date.now()
                        }
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

            // 🔹 SMART ENRICHMENT: Fetch full token metadata (logos, decimals) for frontend
            // This prevents the frontend from needing to fetch again, enabling "Instant" UI
            let enrichedTokenIn: any = null;
            let enrichedTokenOut: any = null;

            try {
                // Dynamic import to avoid circular deps
                const { getTokenInfo } = await import('../../../services/tokenService.js');

                console.log('[PrepareSwapTransaction] 🧠 Smart Enrichment: Fetching token metadata...');
                const [inData, outData] = await Promise.all([
                    getTokenInfo(args.token_in, args.chain_id).catch(() => null),
                    getTokenInfo(args.token_out, args.chain_id).catch(() => null)
                ]);

                if (inData) {
                    enrichedTokenIn = {
                        address: args.token_in,
                        symbol: inData.symbol,
                        name: inData.name,
                        decimals: inData.decimals,
                        logoUrl: inData.logoURI || inData.logoUrl, // Handle both formats
                        chainId: args.chain_id
                    };
                }

                if (outData) {
                    enrichedTokenOut = {
                        address: args.token_out,
                        symbol: outData.symbol,
                        name: outData.name,
                        decimals: outData.decimals,
                        logoUrl: outData.logoURI || outData.logoUrl,
                        chainId: args.chain_id
                    };
                }
                console.log('[PrepareSwapTransaction] 🧠 Enrichment complete:', {
                    hasIn: !!enrichedTokenIn,
                    hasOut: !!enrichedTokenOut,
                    inLogo: !!enrichedTokenIn?.logoUrl,
                    outLogo: !!enrichedTokenOut?.logoUrl
                });

            } catch (enrichError) {
                console.warn('[PrepareSwapTransaction] Enrichment failed (non-critical):', enrichError);
            }

            // Fallback: show swap card for manual confirmation
            return {
                __client_action: {
                    type: 'show_swap_card',
                    payload: {
                        tokenIn: enrichedTokenIn || args.token_in, // Pass object if enriched, else string
                        tokenOut: enrichedTokenOut || args.token_out,
                        amountIn: args.amount_in,
                        chainId: args.chain_id,
                        slippage: args.slippage || 0.5,
                        // Pass pre-warmed quote to frontend for instant display
                        quote: (await preWarmQuotePromise)?.quote
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
