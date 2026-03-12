/**
 * Execute Swap Tool (Single Shot)
 * ONE tool call = ONE complete swap execution
 * No more AI iterations needed!
 */

import { Tool, ToolContext } from '../../../tooling/registry.js';
import { SwapStateManager } from '../../../services/SwapStateManager.js';
import { getTradeContext } from '../../../services/TradeContext.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import { fetchJson } from '../../../config/unifiedApiService.js';
import { buildSignedHeaders } from '../../../utils/requestSigningClient.js';

export const executeSwapTool: Tool = {
    definition: {
        name: 'execute_swap',
        description: `Execute a complete token swap in ONE atomic operation.
        
This tool handles the ENTIRE swap process internally:
1. Validates inputs and safety
2. Gets best quote
3. Handles approval if needed (waits for confirmation)
4. Executes swap transaction
5. Waits for confirmation
6. Returns final result

YOU (AI) only need to call this ONCE. Do NOT retry or iterate.
The tool will handle all retries, approvals, and confirmations internally.

CRITICAL: After calling this tool, STOP iterating. Wait for the result.
The result will be either:
- SUCCESS: Transaction confirmed (show transaction card)
- FAILED: Clear error message (show error to user)
- PENDING: Still processing (rare, tell user to wait)`,
        parameters: {
            type: 'object',
            properties: {
                token_in: {
                    type: 'string',
                    description: 'Token to sell (symbol or address)'
                },
                token_out: {
                    type: 'string',
                    description: 'Token to buy (symbol or address)'
                },
                amount_in: {
                    type: 'string',
                    description: 'Amount to swap (human readable, e.g. "0.1")'
                },
                chain_id: {
                    type: 'number',
                    description: 'Chain ID (e.g. 8453 for Base)'
                },
                slippage: {
                    type: 'number',
                    description: 'Slippage tolerance in percentage (default: 0.5%)',
                    default: 0.5
                }
            },
            required: ['token_in', 'token_out', 'amount_in', 'chain_id']
        }
    },
    handler: async (args, context) => {
        const taskId = context?.taskId || `task-${Date.now()}`;

        console.log(`[ExecuteSwap] Starting atomic swap execution for task ${taskId}`);

        // ⚡ Get TradeContext for cached data access
        const tradeCtx = getTradeContext(context);
        console.log(`[ExecuteSwap] Using TradeContext: ${tradeCtx.id} (${tradeCtx.toSummary()})`);

        // Initialize state
        SwapStateManager.initSwap({
            userId: context?.userId || '',
            sessionId: context?.sessionId || '',
            taskId,
            tokenIn: args.token_in,
            tokenOut: args.token_out,
            amountIn: args.amount_in,
            chainId: args.chain_id
        });

        try {
            // Step 1: Call backend API to execute the ENTIRE swap
            const API_BASE = process.env.API_BASE_URL ||
                (process.env.PORT ? `http://127.0.0.1:${process.env.PORT}` : 'http://localhost:3001');
            const appKey = process.env.KIKO_WEB_APP_KEY || process.env.KIKO_MOBILE_APP_KEY || '';
            const requestBody = {
                tokenIn: args.token_in,
                tokenOut: args.token_out,
                amountIn: args.amount_in,
                chainId: args.chain_id,
                slippageBps: Math.round((args.slippage || 10) * 100),
                executionSource: 'chat',
                routePolicy: 'external_only',
                transactionMessageId: context?.messageId || context?.toolContext?.messageId || undefined,
            };

            console.log('[ExecuteSwap] Calling unified swap API...');
            SwapStateManager.updateState(taskId, 'QUOTE_PENDING');

            const result = await fetchJson({
                url: `${API_BASE}/api/swap/execute-instant`,
                method: 'POST',
                timeout: 150000,
                endpointName: 'swap-api',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${context?.accessToken}`,
                    ...(appKey ? { 'X-App-Key': appKey } : {}),
                    ...buildSignedHeaders('POST', '/api/swap/execute-instant', JSON.stringify(requestBody))
                },
                body: JSON.stringify(requestBody)
            });

            if (!result.success) {
                // Handle failure
                const errorMsg = result.error || result.message || 'Swap execution failed';
                SwapStateManager.markFailed(taskId, errorMsg);

                logger.error(LogCode.EXE_TX_REVERTED, 'Swap execution failed', {
                    taskId,
                    error: errorMsg
                });

                return {
                    success: false,
                    error: errorMsg,
                    message: `❌ Swap failed: ${errorMsg}`,
                    _final: true // Tell AI to STOP iterating
                };
            }

            // Success!
            const txHash = result.data?.txHash;
            SwapStateManager.markCompleted(taskId, txHash);

            logger.info(LogCode.EXE_TX_BROADCAST, 'Swap execution completed', {
                taskId,
                txHash,
                duration: Date.now() - (SwapStateManager.getState(taskId)?.startedAt || 0)
            });

            return {
                success: true,
                txHash,
                status: 'COMPLETED',
                message: `✅ Swap completed successfully!\nTransaction: ${txHash}`,
                data: result.data,
                _final: true, // Tell AI to STOP iterating
                __transaction_card: { // Trigger transaction card display
                    txHash,
                    chainId: args.chain_id,
                    type: 'swap',
                    tokenIn: args.token_in,
                    tokenOut: args.token_out,
                    amountIn: args.amount_in
                }
            };

        } catch (error: any) {
            // Network or timeout error
            SwapStateManager.markFailed(taskId, error.message);

            logger.error(LogCode.SYS_ERROR, 'Swap execution error', {
                taskId,
                error: error.message
            });

            return {
                success: false,
                error: error.message,
                message: `❌ Swap execution error: ${error.message}`,
                _final: true // Tell AI to STOP iterating
            };
        }
    }
};
