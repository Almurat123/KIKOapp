/**
 * Chat Worker
 * Background job to process AI tasks independently of the frontend lifecycle.
 * Writes chunks to database for persistence and recovery.
 */

import * as chatRepo from '../repositories/chatRepository.js';
import { AITask } from '../repositories/chatRepository.js';
import { toolRegistry } from '../tools/index.js';
import { moderationClient } from '../services/moderationClient.js';
import { searchWeb } from '../services/searchService.js';
import { chatWS } from '../services/chatWebSocket.js';
import { getTrendingCasts } from '../repositories/socialRepository.js';
import * as alchemy from '../services/alchemy.js';
import * as privyWallet from '../services/privyWallet.js';
import { scrub } from '../utils/scrubber.js';

// Constants
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const GROK_SERVICE_URL = process.env.GROK_SERVICE_URL || 'http://localhost:8001';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// DeepSeek model name mapping
// Frontend sends: deepseek-v3-fast, deepseek-v3-thinking
// API expects: deepseek-chat, deepseek-reasoner
function mapDeepSeekModel(model: string): string {
    const modelMap: Record<string, string> = {
        'deepseek-v3-fast': 'deepseek-chat',
        'deepseek-v3-thinking': 'deepseek-reasoner',
        'deepseek-chat': 'deepseek-chat',
        'deepseek-reasoner': 'deepseek-reasoner',
    };
    const mapped = modelMap[model] || model;
    console.log(`[ChatWorker] DeepSeek model: ${model} -> ${mapped}`);
    return mapped;
}

// Chain ID to Alchemy/Service chain name map
const CHAIN_ID_MAP: Record<number, string> = {
    1: 'eth',
    8453: 'base',
    56: 'bsc',
    42161: 'arbitrum',
    10: 'optimism',
    137: 'polygon',
    900: 'solana',
    101: 'solana',
};

// System Prompts (Unified Orchestrator)
import { promptOrchestrator } from '../services/ai/PromptOrchestrator.js';
import type { IntentType, UserContext } from '../services/ai/types.js';
import { parseIntent } from '../services/ai/intentParser.js';
import { getFilteredTools } from '../services/ai/toolPreRouter.js';
import { findTokenOnAnyChain, getTokenInfo } from '../services/ai/tokenDetector.js';
import { getTokenDetails as getDexTokenDetails } from '../services/dexscreener.js';
import { executeDirectSwap } from '../services/directSwapExecutor.js';
import { ragClient } from '../services/ragClient.js';
import { skillRegistry } from '../skills/registry.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

export class ChatWorker {
    private isRunning = false;
    private pollInterval: NodeJS.Timeout | null = null;
    private repo = chatRepo;
    private ws = chatWS;

    constructor(mocks?: { repo?: any; ws?: any }) {
        if (mocks?.repo) this.repo = mocks.repo;
        if (mocks?.ws) this.ws = mocks.ws;
    }

    /**
     * Sanitize conversation history to remove orphaned tool_calls.
     * DeepSeek API requires every assistant message with tool_calls to be
     * immediately followed by tool result messages for each tool_call_id.
     * If this sequence is broken (e.g., due to errors or incomplete saves),
     * we strip the tool_calls to prevent API errors.
     */
    private sanitizeToolCallHistory(history: any[]): any[] {
        const sanitized: any[] = [];

        for (let i = 0; i < history.length; i++) {
            const msg = history[i];

            // If this is an assistant message with tool_calls
            if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
                // Check if the next messages are tool results for these calls
                const expectedToolCallIds = new Set(msg.tool_calls.map((tc: any) => tc.id));
                let foundAllToolResults = true;
                let checkIndex = i + 1;

                while (checkIndex < history.length && expectedToolCallIds.size > 0) {
                    const nextMsg = history[checkIndex];
                    if (nextMsg.role === 'tool' && nextMsg.tool_call_id) {
                        expectedToolCallIds.delete(nextMsg.tool_call_id);
                        checkIndex++;
                    } else {
                        break; // Non-tool message encountered
                    }
                }

                if (expectedToolCallIds.size > 0) {
                    // Missing tool results - strip tool_calls from this message
                    console.warn(`[ChatWorker] Sanitizing orphaned tool_calls from message ${i} (missing ${expectedToolCallIds.size} tool results)`);
                    sanitized.push({
                        role: msg.role,
                        content: msg.content || '(Tool call was interrupted)',
                    });
                } else {
                    // All tool results present - keep as is
                    sanitized.push(msg);
                }
            } else {
                sanitized.push(msg);
            }
        }

        return sanitized;
    }

    private async recordIntentTrace(
        task: AITask,
        sessionMessages: any[],
        parsedIntent: Awaited<ReturnType<typeof parseIntent>>,
        lastUserMessage: string
    ) {
        if (!task.userMessageId) return;

        const messageRecord = sessionMessages.find(m => m.id === task.userMessageId);
        const existingData = messageRecord?.data || {};
        const intentTrace = {
            parsedAt: new Date().toISOString(),
            input: lastUserMessage,
            decision: parsedIntent.decision,
            highLevel: parsedIntent.highLevel,
            detailed: {
                action: parsedIntent.detailed.action,
                token_in: parsedIntent.detailed.token_in,
                token_out: parsedIntent.detailed.token_out,
                amount: parsedIntent.detailed.amount,
                chain_id: parsedIntent.detailed.chain_id,
            },
        };

        await this.repo.updateMessage(task.userMessageId, {
            data: {
                ...existingData,
                intentTrace,
            }
        });

        // Link follow-up behavior to previous user intent trace if available.
        const sorted = [...sessionMessages].sort((a, b) => (a.message_index || a.messageIndex || 0) - (b.message_index || b.messageIndex || 0));
        const currentIndex = sorted.findIndex(m => m.id === task.userMessageId);
        if (currentIndex > 0) {
            for (let i = currentIndex - 1; i >= 0; i -= 1) {
                const prev = sorted[i];
                if (prev.role === 'user' && prev.data?.intentTrace) {
                    const prevData = prev.data || {};
                    await this.repo.updateMessage(prev.id, {
                        data: {
                            ...prevData,
                            followUp: {
                                nextUserMessageId: task.userMessageId,
                                nextIntent: parsedIntent.highLevel.type,
                                at: new Date().toISOString(),
                            },
                        }
                    });
                    logger.info(LogCode.AI_INTENT_PARSED, 'Intent follow-up recorded', {
                        previousIntent: prev.data?.intentTrace?.highLevel?.type,
                        nextIntent: parsedIntent.highLevel.type,
                        sessionId: task.sessionId,
                    });
                    break;
                }
            }
        }
    }


    /**
     * Start the worker polling loop
     */
    start(intervalMs = 3000) {
        if (this.isRunning) return;
        this.isRunning = true;

        // Store interval for potential dynamic adjustment
        const pollConfig = { interval: intervalMs };
        console.log(`[ChatWorker] Started polling for AI tasks (interval: ${pollConfig.interval}ms)`);

        const runLoop = async () => {
            if (!this.isRunning) return;

            await this.processQueuedTasks();

            if (this.isRunning) {
                this.pollInterval = setTimeout(runLoop, pollConfig.interval);
            }
        };

        runLoop();
    }

    /**
     * Stop the worker
     */
    stop() {
        this.isRunning = false;
        if (this.pollInterval) {
            clearTimeout(this.pollInterval);
            this.pollInterval = null;
        }
        console.log('[ChatWorker] Stopped');
    }

    /**
     * Poll and process queued tasks
     */
    private async processQueuedTasks() {
        try {
            const queuedTasks = await this.repo.getQueuedTasks(5);

            for (const task of queuedTasks) {
                // Process each task asynchronously
                // We do NOT await this to allow parallel processing of tasks, 
                // BUT this means the next poll might occur while tasks are running.
                // This is acceptable as long as we don't fetch the SAME tasks again (getQueuedTasks should handle that via status updates).
                this.runTask(task).catch((err: any) => {
                    console.error(`[ChatWorker] Fatal error in task ${task.id}:`, err);
                });
            }
        } catch (error) {
            console.error('[ChatWorker] Error polling tasks:', error); // Simple log to avoid spamming
        }
    }

    /**
     * Execute a single AI task
     */
    private async runTask(task: AITask) {
        console.log(`[ChatWorker] Running task ${task.id} for session ${task.sessionId}`);
        let userId: string | null = null;

        try {
            // 1. Mark as running
            await this.repo.updateTaskStatus(task.id, 'running');

            // 1.5 Fetch Session for User context
            const session = await this.repo.getSession(task.sessionId);
            userId = session?.userId || null;

            this.ws.broadcastToUser(userId!, {
                type: 'task_status',
                sessionId: task.sessionId,
                data: { taskId: task.id, status: 'running', message: 'Analyzing query' }
            });

            // 2. Load context
            this.ws.broadcastToUser(userId!, {
                type: 'task_status',
                sessionId: task.sessionId,
                data: { taskId: task.id, status: 'running', message: 'Loading history' }
            });
            const messages = await this.repo.getSessionMessages(task.sessionId);
            let conversationHistory = messages.map(msg => ({
                role: msg.role,
                content: msg.content,
                reasoning_content: msg.reasoning_content,
                ...(msg.tool_calls ? { tool_calls: msg.tool_calls } : {}),
                ...(msg.tool_call_id ? { tool_call_id: msg.tool_call_id } : {}),
            }));

            // CRITICAL: Sanitize orphaned tool_calls from history
            // DeepSeek requires every tool_call to be followed by a tool result message
            // If an assistant message has tool_calls but the next message is not a tool result,
            // we must strip the tool_calls to avoid API errors
            conversationHistory = this.sanitizeToolCallHistory(conversationHistory);

            // 2.5 Backend Moderation Check
            const lastUserMsg = conversationHistory.filter(m => m.role === 'user').pop();
            if (lastUserMsg && lastUserMsg.content) {
                this.ws.broadcastToUser(userId!, {
                    type: 'task_status',
                    sessionId: task.sessionId,
                    data: { taskId: task.id, status: 'running', message: 'Verifying safety' }
                });
                const modResult = await moderationClient.moderateInput(lastUserMsg.content, {}, userId, task.sessionId, task.model);
                if (!modResult.safe) {
                    throw new Error(modResult.checks?.intent?.reason || 'Message blocked by security policy');
                }
            }


            // 3. Process based on model
            if (task.model.includes('deepseek')) {
                await this.processDeepSeekTask(task, conversationHistory, userId, messages);
            } else if (task.model.includes('grok')) {
                await this.processGrokTask(task, conversationHistory, userId, messages);
            } else {
                throw new Error(`Unsupported model: ${task.model}`);
            }

            // 4. Mark as done
            try {
                await this.repo.updateTaskStatus(task.id, 'done');
            } catch (dbErr) {
                console.error(`[ChatWorker] Failed to update task status for ${task.id}:`, dbErr);
            }

            // Always broadcast success/completion to UI even if DB was flaky
            this.ws.broadcastToUser(userId!, { type: 'task_status', sessionId: task.sessionId, data: { taskId: task.id, status: 'done' } });
            this.ws.broadcastToUser(userId!, { type: 'message_complete', sessionId: task.sessionId, data: { messageId: task.assistantMessageId } });
            console.log(`[ChatWorker] Task ${task.id} completed successfully`);

        } catch (error: any) {
            console.error(`[ChatWorker] Task ${task.id} failed:`, error);

            // 1. Always notify frontend of error so it can stop spinners
            try {
                this.ws.broadcastToUser(userId!, {
                    type: 'task_status',
                    sessionId: task.sessionId,
                    data: { taskId: task.id, status: 'error', error: error.message }
                });
            } catch (wsErr) {
                console.warn('[ChatWorker] Failed to broadcast error status', wsErr);
            }

            // 2. Try to update DB status (might fail if DB is down)
            try {
                await this.repo.updateTaskStatus(task.id, 'error', error.message);
                if (task.assistantMessageId) {
                    await this.repo.updateMessage(task.assistantMessageId, { status: 'error' });
                }
            } catch (dbErr) {
                console.error(`[ChatWorker] Failed to record task error in DB for ${task.id}:`, dbErr);
            }
        }
    }

    /**
     * DeepSeek processing with multi-turn tool support
     */
    private async processDeepSeekTask(task: AITask, history: any[], userId: string | null = null, sessionMessages: any[] = []) {
        let iteration = 0;
        const maxIterations = 10;
        const assistantMessageId = task.assistantMessageId!;
        let totalContent = '';  // Accumulated across all iterations
        let totalReasoning = ''; // Accumulated across all iterations
        let chunkIndex = 0;
        let lastUsage: any = null;  // Track usage for DB persistence
        let allCitations: any[] = [];  // Track citations for DB persistence

        // CRITICAL: Broadcast message_start so frontend creates the message BEFORE chunks arrive
        // This fixes the race condition where chunks are dropped because frontend message doesn't exist yet
        this.ws.broadcastToUser(userId!, {
            type: 'message_start',
            sessionId: task.sessionId,
            data: {
                messageId: assistantMessageId,
                role: 'assistant',
                model: task.model
            }
        });
        console.log(`[ChatWorker] Sent message_start for ${assistantMessageId}`);

        // Phase 5 Cache: Shared across all iterations of this task
        const toolResultsCache = new Map<string, any>();
        let earlyPreFetchPromise: Promise<void> | null = null;
        let streamPreFetchPromise: Promise<Map<string, any>> | null = null;

        // Base tool filtering (keyword/category based).
        // We will further narrow this set once we know the user's high-level intent (skills gating).
        const lastUserMessage = history.filter(m => m.role === 'user').pop()?.content || '';
        const baseToolDefs = getFilteredTools(lastUserMessage);
        let toolDefinitions = baseToolDefs.map(def => ({ type: 'function', function: def }));
        console.log(`[ChatWorker] Base filtered to ${toolDefinitions.length} tools for message: "${lastUserMessage.slice(0, 50)}..."`);

        // RAG INTEGRATION: Fetch context for general queries
        // If query looks like "how to", "what is", "explain", etc.
        let ragContext = '';
        const informationalRegex = /(how|what|why|explain|tell me|介绍|是什么|怎么|如何|原理)/i;
        console.log(`[ChatWorker] 🔍 RAG check for: "${lastUserMessage.slice(0, 50)}..."`);

        if (informationalRegex.test(lastUserMessage)) {
            console.log(`[ChatWorker] 🎯 RAG: Match found! Query looks informational.`);
            try {
                this.ws.broadcastToUser(userId!, {
                    type: 'task_status',
                    sessionId: task.sessionId,
                    data: { taskId: task.id, status: 'running', message: 'Searching knowledge base' }
                });
                ragContext = await ragClient.query(lastUserMessage);
                if (ragContext) {
                    console.log(`[ChatWorker] ✅ RAG: Context found (${ragContext.length} chars)`);
                } else {
                    console.log(`[ChatWorker] ℹ️ RAG: No relevant knowledge found in local base.`);
                }
            } catch (err) {
                console.warn('[ChatWorker] ❌ RAG: Fetch error:', err);
            }
        } else {
            console.log(`[ChatWorker] ⏭️ RAG: Skipped (Query doesn't match informational patterns).`);
        }

        while (iteration < maxIterations) {
            iteration++;
            console.log(`[ChatWorker] DeepSeek iteration ${iteration}/${maxIterations} for task ${task.id}`);

            // Broadcast iteration status to frontend
            this.ws.broadcastToUser(userId!, {
                type: 'task_status',
                sessionId: task.sessionId,
                data: {
                    status: 'running',
                    iteration,
                    maxIterations,
                    message: iteration > 1 ? `Processing tool results (${iteration}/${maxIterations})` : 'Thinking'
                }
            });

            // Check if task was cancelled
            const currentTask = await this.repo.getTask(task.id);
            if (currentTask?.status === 'cancelled') {
                console.log(`[ChatWorker] Task ${task.id} was cancelled by user`);
                return;
            }

            // DeepSeek Reasoner (thinking mode) requires reasoning_content in assistant messages
            const isReasonerModel = mapDeepSeekModel(task.model) === 'deepseek-reasoner';

            // Transform history for reasoner model - add reasoning_content to assistant messages
            // CRITICAL: DeepSeek strict API requirement
            // 1. If deepseek-reasoner: MUST include reasoning_content (even if empty) for assistant messages
            // 2. If deepseek-chat: MUST NOT include reasoning_content (strict validation error if present)
            const transformedHistory = history.map(msg => {
                if (msg.role === 'assistant') {
                    const { reasoning_content, tool_calls, ...rest } = msg;
                    const apiMsg = { ...rest };

                    if (isReasonerModel) {
                        apiMsg.reasoning_content = reasoning_content || '';
                    } else if (reasoning_content) {
                        // Non-reasoner shouldn't have reasoning_content, but if present, strip it.
                    }

                    if (tool_calls && tool_calls.length > 0) {
                        apiMsg.tool_calls = tool_calls;
                        // DeepSeek API Requirement: content cannot be empty if tool_calls is missing.
                        // Conversely, if tool_calls is present, content CAN be null/empty.
                        if (!apiMsg.content) apiMsg.content = null;
                    }
                    return apiMsg;
                }
                return msg;
            });

            // Parse intent from user message
            if (task.sessionId) {
                this.ws.broadcastToUser(userId!, {
                    type: 'task_status',
                    sessionId: task.sessionId,
                    data: { status: 'running', message: 'Checking wallet' }
                });
            }
            const parsedIntent = await parseIntent(lastUserMessage, {
                userAddress: task.toolContext?.walletAddress,
                chainId: task.toolContext?.chainId,
                isWalletConnected: !!task.toolContext?.walletAddress,
            });
            if (iteration === 1) {
                await this.recordIntentTrace(task, sessionMessages, parsedIntent, lastUserMessage);
            }

            if (task.sessionId) {
                this.ws.broadcastToUser(userId!, {
                    type: 'task_status',
                    sessionId: task.sessionId,
                    data: { status: 'running', message: 'Identifying intent' }
                });
            }

            // Use high-level intent for system prompt selection
            const intent: IntentType = parsedIntent.highLevel.type;

            // Skills-level tool gating (single source of truth: `skill.json` -> metadata.tools).
            // Apply once (intent is stable for this task) to prevent tool drift and wrong-tool selection.
            if (iteration === 1) {
                const intentStr = String(intent).toUpperCase();
                const matchedSkills = skillRegistry.getSkillsByIntent(intentStr);
                const allowedToolNames = new Set<string>();
                for (const skill of matchedSkills) {
                    for (const name of skill.metadata.tools || []) {
                        allowedToolNames.add(name);
                    }
                }
                // Always keep `web_search` as a safe fallback (consistent with ToolPreRouter).
                allowedToolNames.add('web_search');

                if (matchedSkills.length > 0 && allowedToolNames.size > 0) {
                    const gated = baseToolDefs.filter(def => allowedToolNames.has(def.name));
                    if (gated.length > 0) {
                        toolDefinitions = gated.map(def => ({ type: 'function', function: def }));
                        console.log(`[ChatWorker] Skill-gated to ${toolDefinitions.length} tools for intent=${intentStr} skills=${matchedSkills.map(s => s.metadata.id).join(', ')}`);
                    } else {
                        console.warn(`[ChatWorker] Skill gating produced 0 tools for intent=${intentStr}; falling back to base tool set`);
                    }
                }
            }

            // Log detailed intent for debugging

            // 🚀 PRE-EMPTIVE TOOL EXECUTION (Phase 5: Intent-based)
            // Start pre-fetching high-confidence tool results in parallel with the first LLM request
            if (iteration === 1) {
                earlyPreFetchPromise = this.preFetchByIntent(task, parsedIntent, toolResultsCache).catch(err => {
                    console.error('[ChatWorker] Early pre-fetch failed (safe to ignore):', err);
                });
            }

            // 🔧 DEBUG: Log user settings for diagnostics
            console.log('[ChatWorker] User Settings:', {
                fastSwapMode: task.toolContext?.toolConfig?.fastSwapMode,
                swapMethod: task.toolContext?.toolConfig?.swapMethod,
                toolConfig: task.toolContext?.toolConfig ? Object.keys(task.toolContext.toolConfig) : 'none',
                walletConnected: !!task.toolContext?.walletAddress,
                chainId: task.toolContext?.chainId,
            });

            // ⚡ FAST SWAP BYPASS: Skip LLM if fastSwapMode enabled + swap intent detected
            const fastSwapMode = task.toolContext?.toolConfig?.fastSwapMode === true;
            const isSwapIntent = parsedIntent.detailed.action === 'swap';
            const hasSwapTarget = !!parsedIntent.swapIntent?.tokenOut || !!parsedIntent.contractAddress;
            const hasExplicitSwapVerb = /\b(swap|buy|sell|trade|exchange|convert|purchase|ape|买|卖|兑换|换)\b/i.test(lastUserMessage);

            if (fastSwapMode && isSwapIntent && hasSwapTarget && hasExplicitSwapVerb) {
                if (task.sessionId) {
                    this.ws.broadcastToUser(userId!, {
                        type: 'task_status',
                        sessionId: task.sessionId,
                        data: { status: 'running', message: 'Analyzing swap request' }
                    });
                }

                // Use parsed intent values which already handle buy/sell correctly
                // intentParser.ts line 527-537 already detects sell operation:
                // - SELL: tokenIn = contractAddress, tokenOut = ETH/SOL
                // - BUY: tokenIn = ETH/SOL, tokenOut = contractAddress
                let tokenIn = parsedIntent.swapIntent?.tokenIn || 'ETH';
                let tokenOut = parsedIntent.swapIntent?.tokenOut || parsedIntent.contractAddress || '';
                let amountIn = parsedIntent.swapIntent?.amount || '0.001';
                const chainId = parsedIntent.chainId || task.toolContext?.chainId || 8453;

                // CRITICAL FIX: Ensure tokenIn and tokenOut are different
                // If they're the same (both are contract address), check user message to determine buy/sell
                const tokenInLower = tokenIn.toLowerCase();
                const tokenOutLower = tokenOut.toLowerCase();
                if (tokenInLower === tokenOutLower || (tokenIn.startsWith('0x') && tokenOut.startsWith('0x') && tokenInLower === tokenOutLower)) {
                    // Detect if this is a SELL or BUY operation from user message
                    const isSellOperation = /\b(sell|卖)\b/i.test(lastUserMessage);
                    const isBuyOperation = /\b(buy|买|purchase|get)\b/i.test(lastUserMessage);
                    const isSolana = chainId === 900 || chainId === 101;
                    const isBsc = chainId === 56 || /\bBNB\b/i.test(lastUserMessage);
                    const nativeToken = isSolana ? 'SOL' : (isBsc ? 'BNB' : 'ETH');

                    if (isSellOperation && !isBuyOperation) {
                        console.log('[ChatWorker] Detected tokenIn === tokenOut, fixing for SELL operation...');
                        // SELL: contract address is tokenIn, native is tokenOut
                        tokenIn = parsedIntent.contractAddress || tokenIn;
                        tokenOut = nativeToken;
                    } else {
                        console.log('[ChatWorker] Detected tokenIn === tokenOut, fixing for BUY operation...');
                        // BUY: native is tokenIn, contract address is tokenOut
                        tokenIn = nativeToken;
                        tokenOut = parsedIntent.contractAddress || tokenOut;
                    }
                }

                console.log('[ChatWorker] Fast swap parameters:', {
                    tokenIn: tokenIn.slice(0, 10) + (tokenIn.length > 10 ? '...' : ''),
                    tokenOut: tokenOut.slice(0, 10) + (tokenOut.length > 10 ? '...' : ''),
                    amountIn,
                    chainId,
                    swapIntent: parsedIntent.swapIntent
                });

                // CRITICAL: Detect actual token chain from address format, NOT user's selected chain
                // 0x... = EVM token, Base58 (no 0x, 32-44 chars) = Solana token
                const isEvmToken = tokenIn.startsWith('0x');
                const isSolanaToken = !isEvmToken && tokenIn.length >= 32 && tokenIn.length <= 44;

                // Determine the ACTUAL chain for the token
                let actualChainName: string;
                if (isSolanaToken) {
                    actualChainName = 'solana';
                } else if (isEvmToken) {
                    // For EVM tokens, use user's selected chain or try to detect from tokenOut
                    const userChainName = CHAIN_ID_MAP[chainId] || 'base';
                    if (userChainName === 'solana') {
                        // User selected Solana but token is EVM - detect from tokenOut
                        if (tokenOut === 'BNB') {
                            actualChainName = 'bsc';
                        } else if (tokenOut === 'ETH') {
                            actualChainName = 'base'; // Default to Base for ETH
                        } else {
                            actualChainName = 'base'; // Fallback
                        }
                        console.log(`[ChatWorker] 🔄 Token is EVM but user on Solana, detected chain: ${actualChainName}`);
                    } else {
                        actualChainName = userChainName;
                    }
                } else {
                    // Native token like ETH, BNB, SOL
                    actualChainName = CHAIN_ID_MAP[chainId] || 'base';
                }

                console.log(`[ChatWorker] Chain detection: tokenIn=${tokenIn.slice(0, 10)}..., actualChain=${actualChainName}`);

                // Handle percentage/all amounts
                const amountInStr = String(amountIn);
                if (amountInStr === 'all' || amountInStr.endsWith('%')) {
                    console.log(`[ChatWorker] 🧮 Calculating ${amountIn} amount for ${tokenIn}`);
                    if (task.sessionId) {
                        this.ws.broadcastToUser(userId!, {
                            type: 'task_status',
                            sessionId: task.sessionId,
                            data: { status: 'running', message: 'Checking balance' }
                        });
                    }
                    try {
                        let walletAddress = task.toolContext?.walletAddress;
                        const userId = task.toolContext?.userId;

                        // Use appropriate wallet for the detected chain
                        if (actualChainName === 'solana' && userId) {
                            try {
                                const solAddress = await privyWallet.getSolanaEmbeddedWalletAddress(userId);
                                if (solAddress) {
                                    console.log(`[ChatWorker] 🌞 Switched to Solana wallet for balance check: ${solAddress}`);
                                    walletAddress = solAddress;
                                }
                            } catch (e) {
                                console.warn('[ChatWorker] Failed to fetch Solana wallet, using provided address:', e);
                            }
                        } else if (actualChainName !== 'solana' && userId) {
                            // If we need an EVM balance but the current wallet is Solana, fetch the EVM wallet
                            if (walletAddress && !walletAddress.startsWith('0x')) {
                                try {
                                    const evmAddress = await privyWallet.getEmbeddedWalletAddress(userId);
                                    if (evmAddress) {
                                        console.log(`[ChatWorker] 🔷 Switched to EVM wallet for balance check: ${evmAddress}`);
                                        walletAddress = evmAddress;
                                    }
                                } catch (e) {
                                    console.warn('[ChatWorker] Failed to fetch EVM wallet:', e);
                                }
                            }
                            console.log(`[ChatWorker] 🔷 Using EVM wallet for balance check: ${walletAddress?.slice(0, 10)}...`);
                        }

                        if (!walletAddress) throw new Error('No wallet address available');

                        const isNative = ['ETH', 'BNB', 'SOL'].includes(tokenIn.toUpperCase()) && !tokenIn.startsWith('0x');

                        let balance = 0;
                        if (isNative) {
                            const rawBalance = await alchemy.getEthBalance(walletAddress, actualChainName);
                            // Solana uses 9 decimals, EVM uses 18
                            const decimals = (actualChainName === 'solana') ? 9 : 18;
                            balance = Number(rawBalance) / (10 ** decimals);

                            // If swapping "all" native token (Buy/Wrap), leave 5% for gas
                            if (amountIn === 'all') {
                                balance = balance * 0.95;
                            }
                        } else {
                            // Token balance
                            const balances = await alchemy.getTokenBalances(walletAddress, actualChainName);

                            console.log(`[ChatWorker] Balance list has ${balances.length} tokens for ${actualChainName}`);

                            // Match by address or symbol
                            // IMPORTANT: Solana uses Base58 which is CASE-SENSITIVE, EVM uses hex (case-insensitive)
                            const isSolanaChain = actualChainName === 'solana';
                            const token = balances.find(t => {
                                if (isSolanaChain) {
                                    // Solana: case-sensitive match
                                    return t.contractAddress === tokenIn ||
                                        (t.symbol && t.symbol.toLowerCase() === tokenIn.toLowerCase());
                                } else {
                                    // EVM: case-insensitive match
                                    return t.contractAddress.toLowerCase() === tokenIn.toLowerCase() ||
                                        (t.symbol && t.symbol.toLowerCase() === tokenIn.toLowerCase());
                                }
                            });

                            if (token) {
                                // getTokenBalances returns formatted string
                                balance = parseFloat(token.tokenBalance);
                                console.log(`[ChatWorker] Found token balance: ${balance}`);
                            } else {
                                console.warn(`[ChatWorker] Token ${tokenIn} not found in ${balances.length} tokens. Addresses: ${balances.slice(0, 5).map(t => t.contractAddress.slice(0, 10) + '...').join(', ')}`);

                                // Fallback for Solana: Try direct SPL token account query
                                if (isSolanaChain) {
                                    try {
                                        console.log(`[ChatWorker] Trying direct Solana SPL balance for ${tokenIn}`);
                                        const directBalance = await alchemy.getSolanaTokenBalance(walletAddress, tokenIn);
                                        if (directBalance > 0) {
                                            balance = directBalance;
                                            console.log(`[ChatWorker] ✅ Direct SPL balance found: ${balance}`);
                                        }
                                    } catch (e) {
                                        console.warn('[ChatWorker] Direct SPL balance query failed:', e);
                                    }
                                }
                            }
                        }

                        // Calculate amount
                        if (amountIn === 'all') {
                            amountIn = balance > 0 ? balance.toFixed(6) : '0';
                        } else {
                            const percent = parseFloat(amountIn) || 0;
                            amountIn = (balance * (percent / 100)).toFixed(6);
                        }

                        // Remove trailing zeros and ensure string
                        amountIn = parseFloat(amountIn).toString();

                        console.log(`[ChatWorker] Resolved amount: ${amountIn} ${tokenIn} (Balance: ${balance})`);
                    } catch (err) {
                        console.error('[ChatWorker] Failed to calculate balance:', err);
                        amountIn = '0'; // Force fallback
                    }
                }

                // Check if we have a valid amount to proceed
                if (amountIn === 'all' || amountIn === '0' || parseFloat(amountIn) <= 0) {
                    console.log('[ChatWorker] Could not resolve valid amount, using LLM fallback');
                    // Inject context about why it failed to help LLM guide the user
                    (task as any).systemInjection = `BALANCE RESOLUTION FAILED: Could not find balance for ${tokenIn} on ${actualChainName}. If the user clearly has the token, please use the swapTransaction tool to allow them to manually confirm. If balance is truly 0, inform the user.`;
                    // Do not execute fast swap, fall through to LLM
                } else {
                    // Execute swap directly via backend executor
                    if (task.sessionId) {
                        this.ws.broadcastToUser(userId!, {
                            type: 'task_status',
                            sessionId: task.sessionId,
                            data: { status: 'running', message: 'Executing trade' }
                        });
                    }
                    const swapResult = await executeDirectSwap({
                        sessionId: task.sessionId,
                        userId: task.toolContext?.userId || '',
                        accessToken: task.toolContext?.accessToken || '',
                        walletAddress: task.toolContext?.walletAddress || '',
                        tokenIn,
                        tokenOut,
                        amountIn,
                        chainId,
                        slippage: 3, // Default 3%
                    });

                    // Broadcast result to frontend
                    if (swapResult.success) {
                        const successMessage = `⚡ **Fast Swap Executed!**\n\n` +
                            `✅ Swapped ${amountIn} ${tokenIn} → ${tokenOut.slice(0, 10)}...\n\n` +
                            `🔗 [View on Explorer](https://basescan.org/tx/${swapResult.txHash})\n\n` +
                            `_Method: ${swapResult.method === 'zora_sdk' ? 'Zora SDK' : 'Aggregator'}_`;

                        // Save success message
                        await this.repo.updateMessage(assistantMessageId, { content: successMessage, status: 'complete' });

                        // First: Send the content as a chunk so frontend displays it
                        this.ws.broadcastToUser(userId!, {
                            type: 'chunk',
                            sessionId: task.sessionId,
                            data: {
                                message_id: assistantMessageId,
                                delta: successMessage,
                            },
                        });

                        // Then: Send message_complete to stop the streaming indicator
                        this.ws.broadcastToUser(userId!, {
                            type: 'message_complete',
                            sessionId: task.sessionId,
                            data: {
                                message_id: assistantMessageId,
                            },
                        });
                    } else {
                        const errorMessage = `❌ **Fast Swap Failed**\n\n${swapResult.error || 'Unknown error'}\n\n_Retrying with standard swap interface..._`;

                        console.log('[ChatWorker] Fast swap failed, guiding LLM to use swap tool');

                        // Inject a hint for the LLM to use the tool
                        (task as any).systemInjection = `DIRECT SWAP FAILED: ${swapResult.error || 'Unknown error'}. Please use the swapTransaction tool to help the user complete this swap manually with a confirmation card.`;

                        // Broadcast partial failure
                        this.ws.broadcastToUser(userId!, {
                            type: 'chunk',
                            sessionId: task.sessionId,
                            data: {
                                messageId: assistantMessageId,
                                status: 'streaming',
                                delta: errorMessage + '\n\n',
                            },
                        });
                    }

                    // If swap was successful, complete the task and return
                    if (swapResult.success) {
                        await this.repo.updateTaskStatus(task.id, 'done');
                        return;
                    }
                    // Otherwise, continue to normal LLM processing as fallback
                } // end else (amountIn !== 'all')
            } else if (fastSwapMode && hasSwapTarget && !hasExplicitSwapVerb) {
                (task as any).systemInjection = 'FAST SWAP SAFE MODE: User shared a token address without explicit trade intent. Ask a short confirmation question: trade now or analyze? Do not execute any trade without a clear buy/sell instruction.';
            } // end if (fastSwapMode && isSwapIntent && hasSwapTarget)

            // Wait for early pre-fetch to complete before building enrichment
            if (earlyPreFetchPromise) {
                console.log('[ChatWorker] Waiting for early pre-fetch to complete');
                await earlyPreFetchPromise;
                earlyPreFetchPromise = null;
            }

            // Detect and resolve contract address if present
            let detectedChainId = task.toolContext?.chainId;
            let detectedChainName: string | undefined;
            let tokenInfo: any = null;

            if (parsedIntent.contractAddress) {
                console.log(`[ChatWorker] Detected contract address: ${parsedIntent.contractAddress}`);

                // Check cache first for token info
                const tokenKey = `get_token_info:${JSON.stringify({
                    address: parsedIntent.contractAddress,
                    chainId: detectedChainId || task.toolContext?.chainId
                })}`;

                if (toolResultsCache.has(tokenKey)) {
                    tokenInfo = toolResultsCache.get(tokenKey);
                    console.log(`[ChatWorker] ⚡ [CACHE HIT]: get_token_info for ${parsedIntent.contractAddress}`);
                }

                if (!tokenInfo) {
                    // Try to find token on any chain
                    if (task.sessionId) {
                        this.ws.broadcastToUser(userId!, {
                            type: 'task_status',
                            sessionId: task.sessionId,
                            data: { status: 'running', message: 'Scanning tokens' }
                        });
                    }
                    const globalTokenInfo = await findTokenOnAnyChain(parsedIntent.contractAddress);
                    if (globalTokenInfo) {
                        detectedChainId = globalTokenInfo.chainId;
                        detectedChainName = globalTokenInfo.chainName;
                        tokenInfo = globalTokenInfo;
                        console.log(`[ChatWorker] Found token ${globalTokenInfo.symbol} on ${globalTokenInfo.chainName} (${globalTokenInfo.chainId})`);
                    } else if (detectedChainId) {
                        // Fallback: try specific chain
                        const specificTokenInfo = await getTokenInfo(parsedIntent.contractAddress, detectedChainId);
                        if (specificTokenInfo) {
                            tokenInfo = specificTokenInfo;
                            detectedChainName = specificTokenInfo.chainName;
                        }
                    }
                }

                // Show launchpad card if detected
                if (tokenInfo && tokenInfo.launchpad) {
                    console.log(`[ChatWorker] Token is from launchpad: ${tokenInfo.launchpad.provider}`);
                    this.ws.broadcastToUser(userId!, {
                        type: 'client_action',
                        sessionId: task.sessionId,
                        data: {
                            message_id: assistantMessageId,
                            action: {
                                type: 'show_launchpad_card',
                                data: {
                                    chainId: tokenInfo.chainId,
                                    provider: tokenInfo.launchpad.provider,
                                    data: {
                                        ...tokenInfo.launchpad.data,
                                        address: tokenInfo.address
                                    }
                                }
                            }
                        }
                    });

                    // Persist: Save launchpad card meta to DB
                    await this.repo.updateMessage(assistantMessageId, {
                        type: 'launchpad-card',
                        data: {
                            chainId: tokenInfo.chainId,
                            provider: tokenInfo.launchpad.provider,
                            data: {
                                ...tokenInfo.launchpad.data,
                                address: tokenInfo.address
                            }
                        }
                    });
                }
            }

            // Use high-level intent for system prompt selection

            // Get System Prompt from Orchestrator
            const systemPrompt = promptOrchestrator.getSystemPrompt('deepseek', intent);

            // Prepare User Context with detected information

            // Fallback: If chain name not detected from token, try to resolve from chainId
            if (!detectedChainName && (detectedChainId || task.toolContext?.chainId)) {
                const chainIdToResolve = detectedChainId || task.toolContext?.chainId;
                detectedChainName = CHAIN_ID_MAP[chainIdToResolve!] || 'Unknown Chain';
            }

            const userContext: UserContext = {
                userAddress: task.toolContext?.walletAddress,
                chainId: detectedChainId || task.toolContext?.chainId,
                chainName: detectedChainName,
                isWalletConnected: !!task.toolContext?.walletAddress,
                toolConfig: task.toolContext?.toolConfig,
                balance: task.toolContext?.balance,
                intentHints: parsedIntent.decision ? {
                    labels: parsedIntent.decision.labels.map(label => label.label),
                    conflict: parsedIntent.decision.conflict
                        ? `${parsedIntent.decision.conflict.type} (${parsedIntent.decision.conflict.labels.join(' vs ')})`
                        : undefined,
                    question: parsedIntent.decision.conflict?.question,
                } : undefined,
            };

            // Inject Context into the LATEST User Message
            // We find the last message from 'user' in the history and wrap it
            let finalMessages = [...transformedHistory];
            const lastUserIndex = finalMessages.map(m => m.role).lastIndexOf('user');

            if (lastUserIndex !== -1) {
                const lastMsg = finalMessages[lastUserIndex];

                // Add token info to context if detected
                let tokenContextBlock = '';
                if (tokenInfo) {
                    tokenContextBlock = `\n\n[TOKEN_CONTEXT]
Detected Token: ${tokenInfo.symbol} (${tokenInfo.name})
Address: ${tokenInfo.address}
Chain: ${tokenInfo.chainName} (${tokenInfo.chainId})
${tokenInfo.price ? `Current Price: $${tokenInfo.price.toFixed(6)}` : ''}
${tokenInfo.priceChange24h !== undefined ? `24h Change: ${tokenInfo.priceChange24h > 0 ? '+' : ''}${tokenInfo.priceChange24h.toFixed(2)}%` : ''}
${tokenInfo.volume24h ? `24h Volume: $${tokenInfo.volume24h.toLocaleString()}` : ''}
${tokenInfo.marketCap ? `Market Cap: $${tokenInfo.marketCap.toLocaleString()}` : ''}
${tokenInfo.launchpad ? `🚀 Launchpad: ${tokenInfo.launchpad.provider.toUpperCase()} - This token was launched on a launchpad platform.` : ''}
`;
                }

                // Add balance info if pre-fetched
                const balanceKey = `get_wallet_portfolio:${JSON.stringify({
                    address: task.toolContext?.walletAddress,
                    chainId: task.toolContext?.chainId
                })}`;
                if (toolResultsCache.has(balanceKey)) {
                    console.log(`[ChatWorker] ⚡ [CACHE HIT]: get_wallet_portfolio`);
                    const balanceData = toolResultsCache.get(balanceKey);
                    tokenContextBlock += `\n\n[USER_BALANCE_CONTEXT]
User Wallet: ${task.toolContext?.walletAddress}
${balanceData.tokens ? `Portfolio Assets:\n${balanceData.tokens.map((t: any) => `- ${t.symbol}: ${t.balance}`).join('\n')}` : ''}
`;
                }

                // Add social info if pre-fetched
                const socialKey = `get_trending_casts:${JSON.stringify({})}`;
                if (toolResultsCache.has(socialKey)) {
                    console.log(`[ChatWorker] ⚡ [CACHE HIT]: get_trending_casts`);
                    const socialData = toolResultsCache.get(socialKey);
                    if (socialData && Array.isArray(socialData)) {
                        tokenContextBlock += `\n\n[FARCASTER_TRENDING_CONTEXT]
Recent Hot Casts:
${socialData.slice(0, 5).map((c: any) => `- @${c.author?.username}: ${c.text.slice(0, 100)}...`).join('\n')}
`;
                    }
                }

                // Use Orchestrator to build the full prompt with context and anti-override
                if (task.sessionId) {
                    this.ws.broadcastToUser(userId!, {
                        type: 'task_status',
                        sessionId: task.sessionId,
                        data: { status: 'running', message: 'Building context' }
                    });
                }
                let enrichedContent = promptOrchestrator.buildPrompt(
                    lastMsg.content,
                    userContext,
                    intent
                );

                // Append token context if available
                if (tokenContextBlock) {
                    enrichedContent += tokenContextBlock;
                }

                if (ragContext) {
                    enrichedContent += `\n\n[RELEVANT DOCUMENTATION CONTEXT]:\n${ragContext}\n\n(Use the above context to answer if relevant)`;
                    console.log(`[ChatWorker] 🧠 RAG: Injected ${ragContext.length} chars of local knowledge into prompt`);
                }

                // Create a shallow copy of the message with new content to send to LLM
                // (We don't update DB history to keep it clean, only what the LLM sees)
                finalMessages[lastUserIndex] = {
                    ...lastMsg,
                    content: enrichedContent
                };
                if (ragContext) {
                    console.log(`[ChatWorker] 🚀 DeepSeek request will include local knowledge context.`);
                }
                console.log(`[ChatWorker] Enriched user prompt with context for ${userContext.userAddress || 'guest'}`);
            }

            // Start building messages
            const messages: any[] = [{ role: 'system', content: systemPrompt }];

            // If we have a system injection (e.g. fallback guidance), add it as a system message
            if ((task as any).systemInjection) {
                messages.push({ role: 'system', content: (task as any).systemInjection });
                console.log(`[ChatWorker] Applied system injection: ${(task as any).systemInjection}`);
            }

            const requestBody: any = {
                model: mapDeepSeekModel(task.model),
                messages: [...messages, ...finalMessages],
                stream: true,
                tools: toolDefinitions,
                tool_choice: 'auto'
            };

            // Broadcast Thinking state before API call
            this.ws.broadcastToUser(userId!, {
                type: 'task_status',
                sessionId: task.sessionId,
                data: { status: 'running', message: 'Thinking' }
            });

            let response: Response | undefined;
            let retryCount = 0;
            const maxRetries = 3;

            // Start retry loop
            while (retryCount < maxRetries) {
                try {
                    response = await fetch(DEEPSEEK_API_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                        },
                        body: JSON.stringify(requestBody),
                    });

                    if (response.ok) break;

                    // If not ok, throw to trigger retry unless it's a 4xx error (client error)
                    if (response.status >= 400 && response.status < 500) {
                        const err: any = await response.json().catch(() => ({ error: { message: response?.statusText } }));
                        throw new Error(`DeepSeek API error: ${err.error?.message || response?.statusText}`);
                    }
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                } catch (error: any) {
                    retryCount++;
                    console.warn(`[ChatWorker] DeepSeek API attempt ${retryCount} failed:`, error.message);
                    if (retryCount === maxRetries) throw error;
                    // Exponential backoff: 1s, 2s, 4s
                    await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
                }
            }

            if (!response || !response.ok) {
                // Try to get error details if response exists
                let errorMessage = `DeepSeek API failed after ${maxRetries} attempts`;
                if (response) {
                    try {
                        const err: any = await response.json();
                        errorMessage = `DeepSeek API error: ${err.error?.message || response.statusText}`;
                    } catch (e) {
                        errorMessage = `DeepSeek API error: ${response.statusText}`;
                    }
                }
                throw new Error(errorMessage);
            }

            const reader = response.body!.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let toolCalls: any[] = [];
            let hasToolCalls = false;
            let iterContent = '';   // Reset per iteration
            let iterReasoning = ''; // Reset per iteration

            // Process stream with graceful error handling
            let streamError: Error | null = null;
            const STREAM_TIMEOUT_MS = 60000; // 60 seconds per chunk - generous for thinking/reasoning

            // Initialize chunk counter for periodic cancellation checks
            let chunkCounter = 0;
            const CHECK_CANCEL_INTERVAL = 30; // Check DB every 30 chunks
            let lastDbSave = 0; // Throttle DB saves

            // Helper to add timeout to stream reads
            const readWithTimeout = async () => {
                const timeoutPromise = new Promise<never>((_, reject) => {
                    setTimeout(() => reject(new Error('Stream read timeout - DeepSeek API stalled')), STREAM_TIMEOUT_MS);
                });
                return Promise.race([reader.read(), timeoutPromise]);
            };

            // Reset stream-specific pre-fetch for this LLM call
            streamPreFetchPromise = null;

            try {
                while (true) {
                    const { done, value } = await readWithTimeout();
                    if (done) break;

                    // Periodic cancellation check (DB query is expensive/unstable, so handle gracefully)
                    chunkCounter++;
                    if (chunkCounter % CHECK_CANCEL_INTERVAL === 0) {
                        try {
                            const currentTask = await this.repo.getTaskStatus(task.id);
                            if (currentTask && currentTask.status === 'cancelled') {
                                console.log(`[ChatWorker] Task ${task.id} was cancelled by user - aborting generation.`);
                                throw new Error('Task cancelled by user');
                            }
                        } catch (chkErr: any) {
                            // If the check itself fails (e.g. DB error), treat it as a cancellation ONLY if it was the explicit cancellation error
                            if (chkErr.message === 'Task cancelled by user') {
                                throw chkErr;
                            }
                            // Otherwise, just log internal weakness and keep streaming.
                            // Do NOT abort the stream just because we couldn't check if we should abort.
                            console.warn(`[ChatWorker] Cancellation check failed (non-critical): ${chkErr.message}`);
                        }
                    }

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (!line.startsWith('data: ') || line.trim() === 'data: [DONE]') continue;

                        try {
                            const data = JSON.parse(line.slice(6));
                            const delta = data.choices?.[0]?.delta;

                            // Handle usage data (sent in final chunks)
                            if (data.usage) {
                                lastUsage = data.usage;  // Store for DB persistence
                                // Broadcast usage to frontend
                                this.ws.broadcastToUser(userId!, {
                                    type: 'usage',
                                    sessionId: task.sessionId,
                                    data: {
                                        message_id: assistantMessageId,
                                        usage: data.usage
                                    }
                                });
                            }

                            // Handle citations (from web search tool results)
                            const choice = data.choices?.[0];
                            if (choice?.message?.citations) {
                                // Accumulate for DB persistence
                                allCitations.push(...choice.message.citations);
                                this.ws.broadcastToUser(userId!, {
                                    type: 'citations',
                                    sessionId: task.sessionId,
                                    data: {
                                        message_id: assistantMessageId,
                                        citations: choice.message.citations
                                    }
                                });
                            }

                            if (!delta) continue;

                            // Handle content chunks - HOT PATH: WebSocket only, no DB writes (conceptually)
                            // UPDATE: We MUST write to DB periodically, otherwise user loses data on refresh/switch
                            if (delta.content) {
                                iterContent += delta.content;
                                totalContent += delta.content;
                                // Broadcast immediately to frontend (zero latency)
                                // Include both content and delta for compatibility
                                const scrubbedDelta = scrub(delta.content);
                                const chunkData = {
                                    index: chunkIndex++,
                                    type: 'content' as const,
                                    content: scrubbedDelta,
                                    delta: scrubbedDelta, // Add delta for frontend compatibility
                                    messageId: assistantMessageId
                                };
                                this.ws.broadcastToUser(userId!, { type: 'chunk', sessionId: task.sessionId, data: chunkData });

                                // PERIODIC DB SYNC (Throttled to 1s)
                                // Fixes "response disappear" on navigation
                                const now = Date.now();
                                if (now - lastDbSave > 1000) {
                                    lastDbSave = now;
                                    // Fire-and-forget update to keep stream fast, but catch errors
                                    this.repo.updateMessage(assistantMessageId, {
                                        content: totalContent,
                                        reasoning_content: totalReasoning,
                                        status: 'streaming'
                                    }).catch(e => console.warn('[ChatWorker] Intermediate DB save failed (ignoring):', e.message));
                                }
                            }

                            // Handle reasoning chunks - HOT PATH: WebSocket only
                            if (delta.reasoning_content) {
                                iterReasoning += delta.reasoning_content;
                                totalReasoning += delta.reasoning_content;
                                // Broadcast immediately to frontend (zero latency)
                                const scrubbedDelta = scrub(delta.reasoning_content);
                                const chunkData = {
                                    index: chunkIndex++,
                                    type: 'reasoning' as const,
                                    reasoning_content: scrubbedDelta,
                                    messageId: assistantMessageId
                                };
                                this.ws.broadcastToUser(userId!, { type: 'chunk', sessionId: task.sessionId, data: chunkData });

                                // Sync reasoning too (throttled)
                                const now = Date.now();
                                if (now - lastDbSave > 1000) {
                                    lastDbSave = now;
                                    this.repo.updateMessage(assistantMessageId, {
                                        content: totalContent,
                                        reasoning_content: totalReasoning,
                                        status: 'streaming'
                                    }).catch(e => console.warn('[ChatWorker] Intermediate DB save failed (ignoring):', e.message));
                                }
                            }

                            // Handle tool calls
                            if (delta.tool_calls) {
                                hasToolCalls = true;
                                for (const tc of delta.tool_calls) {
                                    const idx = tc.index || 0;
                                    if (!toolCalls[idx]) {
                                        toolCalls[idx] = { id: '', type: 'function', function: { name: '', arguments: '' } };
                                    }
                                    if (tc.id) toolCalls[idx].id = tc.id;
                                    if (tc.function?.name) toolCalls[idx].function.name += tc.function.name;
                                    if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
                                }

                                // If tool calls are detected, start pre-fetching in parallel (Phase 5: Stream-based)
                                if (!streamPreFetchPromise && toolCalls.length > 0) {
                                    console.log('[ChatWorker] Detected tool calls in stream, starting pre-fetch...');
                                    streamPreFetchPromise = this.preFetchFromStream(toolCalls, task.toolContext);
                                }
                            }
                        } catch (e) { }
                    }
                }
            } catch (err: any) {
                // Socket closed or stream interrupted
                streamError = err;

                if (err.message === 'Task cancelled by user') {
                    // If strictly cancelled, we can silently return or just break.
                    // But typically we want to update the DB message to cancelled or partial.
                    // For now, allow it to fall through to the final DB update so we save what we generated so far.
                    console.warn(`[ChatWorker] Aborting stream for task ${task.id} due to cancellation.`);
                } else {
                    console.warn(`[ChatWorker] Stream interrupted for task ${task.id}: ${err.message}`);
                    // For meaningful interruptions (timeouts, network), show a message
                    if (!totalContent && !hasToolCalls && !iterContent) {
                        const fallbackMessage = '\n\n⚠️ *Generation interrupted. Please try again.*';
                        totalContent += fallbackMessage;
                        iterContent += fallbackMessage;
                    }
                }
            }

            // CRITICAL: Detect empty output from DeepSeek
            // This occurs when the model fails to generate any content or tool calls
            // Common causes: ambiguous prompts, context too long, or model confusion
            if (!iterContent && !hasToolCalls && !totalContent && !streamError) {
                console.warn(`[ChatWorker] DeepSeek returned empty output for task ${task.id}`);
                const fallbackMessage = `I apologize, but I wasn't able to process that request. This can happen when:
- The request is too complex or ambiguous
- The AI is uncertain how to help

**Please try:**
1. Rephrasing your request more specifically
2. Breaking it into smaller steps
3. Including a contract address if asking about a specific token

For example: "Create a copy trade for wallet 0x..." or "What's the price of ETH?"`;

                totalContent = fallbackMessage;
                iterContent = fallbackMessage;

                // Broadcast the fallback message
                this.ws.broadcastToUser(userId!, {
                    type: 'chunk',
                    sessionId: task.sessionId,
                    data: {
                        index: chunkIndex++,
                        type: 'content' as const,
                        content: fallbackMessage,
                        messageId: assistantMessageId
                    }
                });
            }

            // Final message update with safeguard
            try {
                await this.repo.updateMessage(assistantMessageId, {
                    content: totalContent,
                    reasoning_content: totalReasoning,
                    tool_calls: hasToolCalls ? toolCalls.filter(Boolean) : undefined,
                    usage: lastUsage || undefined,
                    citations: allCitations.length > 0 ? allCitations : undefined,
                    status: hasToolCalls ? 'streaming' : 'complete'
                });
            } catch (dbErr) {
                console.error(`[ChatWorker] Failed to save final message ${assistantMessageId} to DB (Iteration):`, dbErr);
                // Continue anyway - chunks were already broadcasted
            }

            // Process tool results
            if (hasToolCalls) {
                // CRITICAL FIX: Add the assistant message to in-memory history 
                // so the following tool messages have a valid predecessor for the LLM API.
                history.push({
                    role: 'assistant',
                    content: iterContent,
                    reasoning_content: iterReasoning,
                    tool_calls: toolCalls.filter(Boolean)
                });

                // Wait for all pre-fetches to complete
                if (earlyPreFetchPromise) {
                    await earlyPreFetchPromise;
                    earlyPreFetchPromise = null;
                }
                if (streamPreFetchPromise) {
                    const streamResults = await streamPreFetchPromise;
                    for (const [key, val] of streamResults.entries()) {
                        toolResultsCache.set(key, val);
                    }
                    streamPreFetchPromise = null;
                }

                const { results: toolResults, citations: toolCitations } = await this.executeTools(
                    task.sessionId,
                    assistantMessageId,
                    toolCalls,
                    task.toolContext,
                    userId, // Add userId
                    toolResultsCache // Pass cumulative cache
                );
                allCitations.push(...toolCitations);  // Merge into tracking array
                for (const res of toolResults) {
                    history.push(res);
                    // Persist tool result as a chunk (so frontend knows what happened)
                    const chunk = await this.repo.createChunk(assistantMessageId, chunkIndex++, 'tool_result', undefined, undefined, {
                        tool_call_id: res.tool_call_id,
                        result: res.content
                    });
                    this.ws.broadcastToUser(userId!, { type: 'chunk', sessionId: task.sessionId, data: chunk });
                }

                continue; // Next iteration with tool results
            } else {
                // Final result reached - moderate output
                if (totalContent && totalContent.trim().length > 0) {
                    const modResult = await moderationClient.moderateOutput(totalContent, userId, task.sessionId, task.model);
                    if (!modResult.safe) {
                        totalContent = modResult.filtered_text || '[Content removed for safety]';
                    }
                }
                break; // Final response reached
            }
        }

        // Check if we hit max iterations
        if (iteration >= maxIterations) {
            console.log(`[ChatWorker] Max iterations (${maxIterations}) reached for task ${task.id}`);

            // Append a notice to the content
            const maxIterError = '\n\n⚠️ *Note: Maximum tool iterations reached. Some operations may be incomplete.*';
            totalContent += maxIterError;

            try {
                await this.repo.updateMessage(assistantMessageId, {
                    content: totalContent,
                    reasoning_content: totalReasoning,
                    usage: lastUsage || undefined,
                    citations: allCitations.length > 0 ? allCitations : undefined,
                    status: 'complete'
                });
            } catch (dbErr) {
                console.error(`[ChatWorker] Failed to save final message ${assistantMessageId} to DB (MaxIter):`, dbErr);
            }

            // Broadcast error to frontend
            this.ws.broadcastToUser(userId!, {
                type: 'error',
                sessionId: task.sessionId,
                data: {
                    error: 'Maximum tool iterations reached. Some operations may be incomplete.',
                    recoverable: true
                }
            });
        }
    }

    /**
     * Tool name to user-friendly status message mapping
     */
    private getToolStatusMessage(toolName: string): string {
        const toolMessages: Record<string, string> = {
            'web_search': 'Searching the web',
            'get_trending_tokens': 'Fetching trending tokens',
            'get_token_info': 'Analyzing token data',
            'get_token_chart': 'Generating chart',
            'swapTransaction': 'Preparing swap transaction',
            'create_copy_trade_task': 'Setting up copy trade',
            'list_copy_trade_configs': 'Checking copy trade setups',
            'delete_copy_trade_config': 'Removing copy trade setup',
            'pause_copy_trade_config': 'Updating copy trade status',
            'get_launchpad_stats': 'Fetching launchpad data',
            'search_launchpad': 'Searching launchpads',
            'get_wallet_portfolio': 'Fetching wallet data',
            'get_farcaster_profile': 'Analyzing social profile',
            'get_trending_casts': 'Listening to social trends',
            'get_token_mentions': 'Analyzing social sentiment',
            'get_gas_price': 'Checking gas prices',
            'get_token_price': 'Fetching token price',
            'get_historical_price': 'Analyzing historical data',
            'check_token_risk': 'Evaluating token risk',
            'search_farcaster_casts': 'Searching social feed',
            'get_user_favorites': 'Loading favorites',
            'get_market_overview': 'Analyzing market overview',
            'get_polymarket_trending': 'Fetching prediction trends',
            'get_polymarket_event': 'Analyzing prediction event',
            'search_polymarket': 'Searching prediction markets',
        };
        // Use proper capitalization and mapping, or fallback to generic "Executing [tool_name]"
        if (toolMessages[toolName]) return toolMessages[toolName];

        // Convert snake_case to Space Case for fallback
        const fallback = toolName.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        return `Executing ${fallback}`;
    }

    /**
     * Pre-fetch tools based on high-confidence intent (Phase 5: Early)
     */
    private async preFetchByIntent(task: AITask, parsedIntent: any, resultsMap: Map<string, any>) {
        const triggers = {
            'token_info': 'get_token_info',
            'token_detail': 'get_token_info',
            'token_chart': 'get_token_chart',
            'wallet_balance': 'get_wallet_portfolio',
            'wallet_info': 'get_wallet_portfolio',
            'market_overview': 'get_market_overview',
            'token_trending': 'get_trending_tokens',
            'social_trending': 'get_trending_casts'
        };

        const action = parsedIntent.detailed.action;
        const toolName = triggers[action as keyof typeof triggers];

        if (toolName) {
            console.log(`[ChatWorker] 🚀 Phase 5: Early pre-fetching ${toolName} for action ${action}`);

            // Construct arguments based on intent
            let args: any = {};
            if (toolName === 'get_token_info' || toolName === 'get_token_chart') {
                args = {
                    address: parsedIntent.contractAddress || parsedIntent.detailed.token_address,
                    chainId: parsedIntent.chainId || task.toolContext?.chainId
                };
            } else if (toolName === 'get_wallet_portfolio') {
                args = {
                    address: task.toolContext?.walletAddress,
                    chainId: task.toolContext?.chainId
                };
            }

            try {
                const result = await toolRegistry.execute(toolName, args, task.toolContext);
                const cacheKey = `${toolName}:${JSON.stringify(args)}`;
                resultsMap.set(cacheKey, result);
                console.log(`[ChatWorker] ✅ Early pre-fetch stored for ${toolName}`);
            } catch (err) {
                console.warn(`[ChatWorker] Early pre-fetch failed for ${toolName}:`, err);
            }
        }

        // 🚀 PROACTIVE MULTI-INTENT PRE-FETCH (Keyword based)
        // If main action didn't match balance/social, but keywords are present, pre-fetch anyway
        const lastUserMessage = parsedIntent.detailed.query || ''; // Get message from intent
        const lowerMsg = lastUserMessage.toLowerCase();

        // Proactive Balance
        if (action !== 'wallet_balance' && action !== 'wallet_info' && /\b(balance|portfolio|余额|钱包|资|持有)\b/i.test(lowerMsg)) {
            const balanceKey = `get_wallet_portfolio:${JSON.stringify({
                address: task.toolContext?.walletAddress,
                chainId: task.toolContext?.chainId
            })}`;

            if (!resultsMap.has(balanceKey)) {
                console.log(`[ChatWorker] 🚀 Proactive pre-fetching get_wallet_portfolio based on keywords`);
                toolRegistry.execute('get_wallet_portfolio', {
                    address: task.toolContext?.walletAddress,
                    chainId: task.toolContext?.chainId
                }, task.toolContext).then(res => {
                    resultsMap.set(balanceKey, res);
                    console.log(`[ChatWorker] ✅ Proactive balance pre-fetch stored`);
                }).catch(err => console.warn('[ChatWorker] Proactive balance pre-fetch failed:', err));
            }
        }

        // Proactive Social
        if (action !== 'social_trending' && /\b(trending|social|farcaster|twitter|hot|sentiment|what.*people|大家|在聊|热门)\b/i.test(lowerMsg)) {
            const socialKey = `get_trending_casts:${JSON.stringify({})}`;
            if (!resultsMap.has(socialKey)) {
                console.log(`[ChatWorker] 🚀 Proactive pre-fetching get_trending_casts based on keywords`);
                toolRegistry.execute('get_trending_casts', {}, task.toolContext).then(res => {
                    resultsMap.set(socialKey, res);
                    console.log(`[ChatWorker] ✅ Proactive social pre-fetch stored`);
                }).catch(err => console.warn('[ChatWorker] Proactive social pre-fetch failed:', err));
            }
        }
    }

    /**
     * Pre-fetches results for tool calls in parallel (Phase 5: Streaming).
     * This runs in the background while the LLM is still streaming.
     */
    private async preFetchFromStream(toolCalls: any[], context?: any): Promise<Map<string, any>> {
        const cache = new Map<string, any>();
        const promises = toolCalls.map(async (tc) => {
            try {
                const args = JSON.parse(tc.function.arguments);
                const result = await toolRegistry.execute(tc.function.name, args, context);
                const cacheKey = `${tc.function.name}:${tc.function.arguments}`;
                cache.set(cacheKey, result);
                console.log(`[ChatWorker] Stream pre-fetched ${tc.function.name}`);
            } catch (err: any) { }
        });
        await Promise.allSettled(promises);
        return cache;
    }

    /**
     * Execute tool calls
     * @param sessionId The current session ID for broadcasting status
     * @param messageId The assistant message ID for broadcasting client actions/citations
     * @param toolCalls Array of tool calls to execute
     * @param context Optional context for tool execution
     * @param userId User ID for broadcasting status
     * @param cache Optional cache of pre-fetched results
     */
    private async executeTools(sessionId: string, messageId: string, toolCalls: any[], context: any = {}, userId: string | null = null, cache?: Map<string, any>): Promise<{ results: any[], citations: any[] }> {
        const results: any[] = [];
        const allCitations: any[] = [];

        for (const tc of toolCalls) {
            try {
                // Check cache first (Phase 5)
                const cacheKey = `${tc.function.name}:${tc.function.arguments}`;
                if (cache && cache.has(cacheKey)) {
                    console.log(`[ChatWorker] ⚡ [CACHE HIT]: Using pre-fetched result for ${tc.function.name}`);
                    const cachedResult = cache.get(cacheKey);
                    results.push({
                        role: 'tool',
                        tool_call_id: tc.id,
                        content: typeof cachedResult === 'string' ? cachedResult : JSON.stringify(cachedResult)
                    });
                    continue;
                }

                // Broadcast tool execution status
                if (sessionId) {
                    this.ws.broadcastToUser(userId!, {
                        type: 'task_status',
                        sessionId: sessionId,
                        data: {
                            status: 'running',
                            message: this.getToolStatusMessage(tc.function.name)
                        }
                    });
                }

                const args = JSON.parse(tc.function.arguments);
                const result = await toolRegistry.execute(tc.function.name, args, context);

                // Handle Client Actions (e.g. Swap Modal, Strategy Cards)
                let clientAction = null;
                if (result && typeof result === 'object' && result.__client_action) {
                    clientAction = result.__client_action;
                } else if (tc.function.name === 'create_copy_trade_config' && result) {
                    // Check if it already has __client_action from the tool itself (preferred)
                    if (result.__client_action) {
                        clientAction = result.__client_action;
                    } else {
                        clientAction = { type: 'show_strategy_card', data: result };
                    }
                } else if (tc.function.name === 'get_token_chart' && result) {
                    clientAction = { type: 'show_chart_card', data: result };
                } else if ((tc.function.name === 'get_launchpad_stats' || tc.function.name === 'search_launchpad' || tc.function.name === 'get_token_info') && result && result.launchpad) {
                    // Map chainId to number if it's a string slug
                    let numericChainId = result.chainId;
                    if (typeof numericChainId === 'string') {
                        const slugToId: Record<string, number> = {
                            'ethereum': 1, 'eth': 1,
                            'base': 8453,
                            'bsc': 56,
                            'arbitrum': 42161,
                            'polygon': 137,
                            'optimism': 10,
                            'avalanche': 43114, 'avax': 43114,
                            'solana': 900
                        };
                        numericChainId = slugToId[numericChainId.toLowerCase()] || 8453;
                    }

                    clientAction = {
                        type: 'show_launchpad_card',
                        data: {
                            chainId: numericChainId,
                            provider: result.launchpad.provider,
                            data: {
                                ...result.launchpad.data,
                                address: result.address // Ensure address is present
                            }
                        }
                    };
                }

                if (clientAction) {
                    // Broadcast action to frontend IMMEDIATELY
                    if (sessionId && messageId) {
                        this.ws.broadcastToUser(userId!, {
                            type: 'client_action',
                            sessionId: sessionId,
                            data: {
                                message_id: messageId,
                                action: clientAction
                            }
                        });
                        console.log(`[ChatWorker] Broadcasted client action for tool ${tc.function.name}`);
                    }

                    // PERSIST: Map client action type to DB message type
                    let dbMessageType = 'text';
                    if (clientAction.type === 'show_swap_card') dbMessageType = 'swap-card';
                    else if (clientAction.type === 'show_launchpad_card') dbMessageType = 'launchpad-card';
                    else if (clientAction.type === 'show_chart_card') dbMessageType = 'chart-card';
                    else if (clientAction.type === 'show_strategy_card') dbMessageType = 'strategy-card';
                    else if (clientAction.type === 'show_token_card') dbMessageType = 'token-card';

                    // Save card metadata to DB
                    await this.repo.updateMessage(messageId, {
                        type: dbMessageType,
                        data: clientAction.data || clientAction.payload
                    });

                    // Use summary for LLM context if available, otherwise strip the action
                    const contentForLLM = (result && result.summary)
                        ? result.summary
                        : (result && result.__client_action
                            ? JSON.stringify({ ...result, __client_action: undefined })
                            : JSON.stringify(result));

                    results.push({
                        role: 'tool',
                        tool_call_id: tc.id,
                        content: contentForLLM
                    });

                } else if (tc.function.name === 'web_search' && result && typeof result === 'object' && result.citations) {
                    // Special handling for web_search - extract citations
                    allCitations.push(...result.citations);
                    // Only send the results text to the LLM, not the full object
                    results.push({
                        role: 'tool',
                        tool_call_id: tc.id,
                        content: typeof result.results === 'string' ? result.results : JSON.stringify(result.results)
                    });
                } else {
                    results.push({
                        role: 'tool',
                        tool_call_id: tc.id,
                        content: typeof result === 'string' ? result : JSON.stringify(result)
                    });
                }
            } catch (err: any) {
                results.push({
                    role: 'tool',
                    tool_call_id: tc.id,
                    content: `Error: ${err.message}`
                });
            }
        }

        // Broadcast citations if we have any and sessionId is provided
        if (allCitations.length > 0 && sessionId && messageId) {
            this.ws.broadcastToUser(userId!, {
                type: 'citations',
                sessionId: sessionId,
                data: {
                    message_id: messageId,
                    citations: allCitations
                }
            });
        }

        return { results, citations: allCitations };
    }

    /**
     * Grok processing via grok-service (Python FastAPI)
     * Uses OpenAI-compatible streaming format
     */
    private async processGrokTask(task: AITask, history: any[], userId: string | null = null, sessionMessages: any[] = []) {
        const GROK_SERVICE_URL = process.env.GROK_SERVICE_URL || 'http://localhost:8001';
        const assistantMessageId = task.assistantMessageId!;
        let fullContent = '';
        let fullReasoning = '';
        let chunkIndex = 0;
        let lastUsage: any = null;  // Track usage for DB persistence
        let allCitations: any[] = [];  // Track citations for DB persistence

        // CRITICAL: Broadcast message_start so frontend creates the message BEFORE chunks arrive
        this.ws.broadcastToUser(userId!, {
            type: 'message_start',
            sessionId: task.sessionId,
            data: {
                messageId: assistantMessageId,
                role: 'assistant',
                model: task.model
            }
        });
        console.log(`[ChatWorker] Grok: Sent message_start for ${assistantMessageId}`);

        // Parse intent from user message
        this.ws.broadcastToUser(userId!, {
            type: 'task_status',
            sessionId: task.sessionId,
            data: { status: 'running', message: 'Checking wallet' }
        });
        const lastUserMessage = history.filter(m => m.role === 'user').pop()?.content || '';
        const baseToolDefs = getFilteredTools(lastUserMessage);
        let toolDefinitions = baseToolDefs.map(def => ({ type: 'function', function: def }));
        console.log(`[ChatWorker] Grok base filtered to ${toolDefinitions.length} tools for message: "${lastUserMessage.slice(0, 50)}..."`);
        const parsedIntent = await parseIntent(lastUserMessage, {
            userAddress: task.toolContext?.walletAddress,
            chainId: task.toolContext?.chainId,
            isWalletConnected: !!task.toolContext?.walletAddress,
        });
        await this.recordIntentTrace(task, sessionMessages, parsedIntent, lastUserMessage);

        this.ws.broadcastToUser(userId!, {
            type: 'task_status',
            sessionId: task.sessionId,
            data: { status: 'running', message: 'Identifying intent' }
        });

        // Use high-level intent for system prompt selection
        const intent: IntentType = parsedIntent.highLevel.type;

        // Skills-level tool gating (single source of truth: `skill.json` -> metadata.tools).
        const intentStr = String(intent).toUpperCase();
        const matchedSkills = skillRegistry.getSkillsByIntent(intentStr);
        const allowedToolNames = new Set<string>();
        for (const skill of matchedSkills) {
            for (const name of skill.metadata.tools || []) {
                allowedToolNames.add(name);
            }
        }
        // Always keep `web_search` as a safe fallback (consistent with ToolPreRouter).
        allowedToolNames.add('web_search');

        if (matchedSkills.length > 0 && allowedToolNames.size > 0) {
            const gated = baseToolDefs.filter(def => allowedToolNames.has(def.name));
            if (gated.length > 0) {
                toolDefinitions = gated.map(def => ({ type: 'function', function: def }));
                console.log(`[ChatWorker] Grok skill-gated to ${toolDefinitions.length} tools for intent=${intentStr} skills=${matchedSkills.map(s => s.metadata.id).join(', ')}`);
            } else {
                console.warn(`[ChatWorker] Grok skill gating produced 0 tools for intent=${intentStr}; falling back to base tool set`);
            }
        }

        // Log detailed intent for debugging

        // Phase 5 Cache: Shared across this task
        const toolResultsCache = new Map<string, any>();
        let earlyPreFetchPromise: Promise<void> | null = null;

        // 🚀 PRE-EMPTIVE TOOL EXECUTION (Phase 5: Intent-based)
        earlyPreFetchPromise = this.preFetchByIntent(task, parsedIntent, toolResultsCache).catch(err => {
            console.error('[ChatWorker] Grok Early pre-fetch failed:', err);
        });

        const systemPrompt = promptOrchestrator.getSystemPrompt('grok', intent);

        // Prepare User Context
        let userContext: UserContext = {
            userAddress: task.toolContext?.walletAddress,
            chainId: task.toolContext?.chainId,
            isWalletConnected: !!task.toolContext?.walletAddress,
            toolConfig: task.toolContext?.toolConfig,
            balance: task.toolContext?.balance,
            intentHints: parsedIntent.decision ? {
                labels: parsedIntent.decision.labels.map(label => label.label),
                conflict: parsedIntent.decision.conflict
                    ? `${parsedIntent.decision.conflict.type} (${parsedIntent.decision.conflict.labels.join(' vs ')})`
                    : undefined,
                question: parsedIntent.decision.conflict?.question,
            } : undefined,
        };

        // Detect and resolve contract address if present (same as DeepSeek)
        let detectedChainId = task.toolContext?.chainId;
        let detectedChainName: string | undefined;
        let tokenInfo: any = null;
        let xSeedHandles: string[] = [];
        let officialSites: string[] = [];

        if (parsedIntent.contractAddress) {
            this.ws.broadcastToUser(userId!, {
                type: 'task_status',
                sessionId: task.sessionId,
                data: { status: 'running', message: 'Scanning tokens' }
            });
            console.log(`[ChatWorker] Grok: Detected contract address: ${parsedIntent.contractAddress}`);
            const globalTokenInfo = await findTokenOnAnyChain(parsedIntent.contractAddress);
            if (globalTokenInfo) {
                detectedChainId = globalTokenInfo.chainId;
                detectedChainName = globalTokenInfo.chainName;
                tokenInfo = globalTokenInfo;

                // Log launchpad info if detected
                if (globalTokenInfo.launchpad) {
                    console.log(`[ChatWorker] Grok: Token is from launchpad: ${globalTokenInfo.launchpad.provider}`);

                    // AUTO-TRIGGER CARD: If it's a launchpad token, show card immediately
                    this.ws.broadcastToUser(userId!, {
                        type: 'client_action',
                        sessionId: task.sessionId,
                        data: {
                            message_id: assistantMessageId,
                            action: {
                                type: 'show_launchpad_card',
                                data: {
                                    chainId: globalTokenInfo.chainId,
                                    provider: globalTokenInfo.launchpad.provider,
                                    data: {
                                        ...globalTokenInfo.launchpad.data,
                                        address: globalTokenInfo.address // Ensure address is present
                                    }
                                }
                            }
                        }
                    });
                }
            }

            // Extract official socials/websites (DexScreener token profile is the most reliable source we have)
            try {
                const chainForDex: string = (() => {
                    const chainIdToDex: Record<number, string> = {
                        1: 'ethereum',
                        8453: 'base',
                        56: 'bsc',
                        42161: 'arbitrum',
                        10: 'optimism',
                        137: 'polygon',
                        900: 'solana',
                        101: 'solana',
                    };
                    return chainIdToDex[detectedChainId || task.toolContext?.chainId || 8453] || 'base';
                })();

                const dexDetails = await getDexTokenDetails(chainForDex, parsedIntent.contractAddress);
                const socials = (dexDetails as any)?.socials || [];
                const websites = (dexDetails as any)?.websites || [];

                const handleSet = new Set<string>();
                for (const s of socials) {
                    const url = String((s as any)?.url || '');
                    if (!url) continue;
                    if (/x\.com|twitter\.com/i.test(url)) {
                        const m = url.match(/(?:x\.com|twitter\.com)\/([A-Za-z0-9_]{1,30})/i);
                        if (m?.[1]) handleSet.add(`@${m[1]}`);
                    }
                }
                xSeedHandles = Array.from(handleSet).slice(0, 5);

                const siteSet = new Set<string>();
                for (const w of websites) {
                    const url = String((w as any)?.url || '');
                    if (!url) continue;
                    siteSet.add(url);
                }
                officialSites = Array.from(siteSet).slice(0, 5);
            } catch (e) {
                // Best-effort; do not block generation if socials fetch fails
            }
        }

        // Update context with detected chain info
        if (detectedChainId) userContext.chainId = detectedChainId;
        if (detectedChainName) userContext.chainName = detectedChainName;

        // Wait for early pre-fetch to complete before building enrichment
        if (earlyPreFetchPromise) {
            console.log('[ChatWorker] Grok: Waiting for early pre-fetch to complete');
            await earlyPreFetchPromise;
            earlyPreFetchPromise = null;
        }

        // Build enriched user message with context (similar to DeepSeek)
        this.ws.broadcastToUser(userId!, {
            type: 'task_status',
            sessionId: task.sessionId,
            data: { status: 'running', message: 'Building context' }
        });
        let enrichedHistory = [...history];
        const lastUserIndex = enrichedHistory.map(m => m.role).lastIndexOf('user');

        if (lastUserIndex !== -1) {
            const lastMsg = enrichedHistory[lastUserIndex];

            // Add token info to context if detected
            let tokenContextBlock = '';

            // Check cache for token info if not already detected
            if (!tokenInfo) {
                const tokenKey = `get_token_info:${JSON.stringify({
                    address: parsedIntent.contractAddress || parsedIntent.detailed.token_address,
                    chainId: parsedIntent.chainId || task.toolContext?.chainId
                })}`;
                if (toolResultsCache.has(tokenKey)) {
                    tokenInfo = toolResultsCache.get(tokenKey);
                    console.log('[ChatWorker] ⚡ [CACHE HIT]: Grok get_token_info');
                }
            }

            if (tokenInfo) {
                tokenContextBlock = `\n\n[TOKEN_CONTEXT]
Detected Token: ${tokenInfo.symbol} (${tokenInfo.name})
Address: ${tokenInfo.address}
Chain: ${tokenInfo.chainName} (${tokenInfo.chainId})
${tokenInfo.price ? `Current Price: $${tokenInfo.price.toFixed(6)}` : ''}
${tokenInfo.priceChange24h !== undefined ? `24h Change: ${tokenInfo.priceChange24h > 0 ? '+' : ''}${tokenInfo.priceChange24h.toFixed(2)}%` : ''}
${tokenInfo.volume24h ? `24h Volume: $${tokenInfo.volume24h.toLocaleString()}` : ''}
${tokenInfo.marketCap ? `Market Cap: $${tokenInfo.marketCap.toLocaleString()}` : ''}
${tokenInfo.launchpad ? `🚀 Launchpad: ${tokenInfo.launchpad.provider.toUpperCase()} - This token was launched on a launchpad platform.` : ''}
${xSeedHandles.length > 0 ? `Official X (seed): ${xSeedHandles.join(', ')}` : ''}
${officialSites.length > 0 ? `Official Sites (seed): ${officialSites.join(', ')}` : ''}
`;
            }

            const xSeedBlock = (() => {
                if (!parsedIntent.contractAddress) return '';
                const lines: string[] = [];
                if (xSeedHandles.length > 0) lines.push(`- Seed handles: ${xSeedHandles.join(', ')}`);
                if (officialSites.length > 0) lines.push(`- Seed sites: ${officialSites.join(', ')}`);
                if (tokenInfo?.symbol || tokenInfo?.name) lines.push(`- Token keywords: ${tokenInfo.symbol || ''} ${tokenInfo.name || ''}`.trim());
                lines.push(`- Suggested X queries (don’t overfit): "${tokenInfo?.symbol || ''} ${tokenInfo?.name || ''} ${parsedIntent.contractAddress}"`.trim());
                return `\n\n[X_SEARCH_SEEDS]\n${lines.join('\n')}\n`;
            })();

            // Build enriched content with context
            let enrichedContent = promptOrchestrator.buildPrompt(
                lastMsg.content,
                userContext,
                intent
            );

            // Add balance info if pre-fetched (Grok)
            const balanceKey = `get_wallet_portfolio:${JSON.stringify({
                address: task.toolContext?.walletAddress,
                chainId: task.toolContext?.chainId
            })}`;
            if (toolResultsCache.has(balanceKey)) {
                console.log(`[ChatWorker] ⚡ [CACHE HIT]: Grok get_wallet_portfolio`);
                const balanceData = toolResultsCache.get(balanceKey);
                enrichedContent += `\n\n[USER_BALANCE_CONTEXT]
User Wallet: ${task.toolContext?.walletAddress}
${balanceData.tokens ? `Portfolio Assets:\n${balanceData.tokens.map((t: any) => `- ${t.symbol}: ${t.balance}`).join('\n')}` : ''}
`;
            }

            if (xSeedBlock) {
                enrichedContent += xSeedBlock;
            }

            if (tokenContextBlock) {
                enrichedContent += tokenContextBlock;
            }

            // CRITICAL: Pre-fetch Farcaster data when intent is social_trending
            // This injects REAL data into the context so Grok doesn't hallucinate
            if (parsedIntent.detailed.action === 'social_trending') {
                try {
                    console.log('[ChatWorker] Farcaster: Pre-fetching trending casts for social_trending intent');
                    const trendingCasts = await getTrendingCasts(20, '24h');
                    if (trendingCasts && trendingCasts.length > 0) {
                        const farcasterDataBlock = `\n\n[FARCASTER TRENDING DATA - REAL-TIME]
📊 Top ${trendingCasts.length} trending casts from the last 24 hours (DO NOT fabricate - use ONLY this data):
${trendingCasts.slice(0, 15).map((cast: any, i: number) =>
                            `${i + 1}. @${cast.author?.username || 'unknown'} (FID: ${cast.author?.fid || '?'})
   "${(cast.text || '').slice(0, 120)}${(cast.text?.length || 0) > 120 ? '...' : ''}"
   ❤️ ${cast.stats?.likes || 0} likes | 🔁 ${cast.stats?.recasts || 0} recasts | 💬 ${cast.stats?.replies || 0} replies`
                        ).join('\n\n')}

⚠️ IMPORTANT: Present this data in a clean table format. DO NOT invent additional casts.`;
                        enrichedContent += farcasterDataBlock;
                        console.log(`[ChatWorker] ⚡ [CACHE HIT]: Grok get_trending_casts`);
                    }
                } catch (farcasterError) {
                    console.error('[ChatWorker] Farcaster: Failed to pre-fetch trending casts:', farcasterError);
                }
            }

            enrichedHistory[lastUserIndex] = {
                ...lastMsg,
                content: enrichedContent
            };
        }

        const grokMessages = [
            { role: 'system', content: systemPrompt },
            ...enrichedHistory
        ];

        const isLikelyCaAnalysis = (() => {
            const lastUser = lastUserMessage?.content || '';
            return /0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44}/.test(lastUser)
                && parsedIntent?.highLevel?.type === 'MARKET_ANALYSIS';
        })();

        const now = Date.now();
        const last7dIso = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

        // Broadcast Thinking state before API call
        this.ws.broadcastToUser(userId!, {
            type: 'task_status',
            sessionId: task.sessionId,
            data: { status: 'running', message: 'Thinking' }
        });

        // Call grok-service
        const accessToken = task.toolContext?.accessToken;
        const response = await fetch(`${GROK_SERVICE_URL}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
            },
            body: JSON.stringify({
                model: task.model,
                messages: grokMessages,
                stream: true,
                enable_search: true,
                // Built-in search tool config (xAI SDK)
                // Keep defaults lightweight; for CA analysis, prefer recent window (1–7d) to match short-term trading style.
                tool_config: {
                    web_search: {
                        enable_image_understanding: false,
                    },
                    x_search: {
                        enable_image_understanding: false,
                        enable_video_understanding: false,
                        ...(isLikelyCaAnalysis ? { from_date: last7dIso } : {}),
                    },
                },
                tools: toolDefinitions,
                tool_context: task.toolContext,
                // Pass user settings for trading preferences
                user_settings: {
                    allowance_mode: task.toolContext?.allowanceMode || 'confirm', // default: require confirmation
                },
            }),
        });

        if (!response.ok) {
            const err: any = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(`Grok API error: ${err.error || err.detail || response.statusText}`);
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            // Check if task was cancelled
            const currentTask = await this.repo.getTask(task.id);
            if (currentTask?.status === 'cancelled') {
                console.log(`[ChatWorker] Task ${task.id} was cancelled by user`);
                return;
            }

            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                // console.log('[ChatWorker] Raw stream line:', line.substring(0, 1000)); // DEBUG ENABLED
                if (line.includes('citations') || line.includes('usage')) {
                    console.log('[ChatWorker DEBUG] Stream line with valid data:', line);
                }
                if (!line.startsWith('data: ') || line.trim() === 'data: [DONE]') continue;

                try {
                    const data = JSON.parse(line.slice(6));
                    const delta = data.choices?.[0]?.delta;

                    if (!delta && !data.custom_event) continue; // Skip if no delta AND no custom_event

                    // Handle content chunks - HOT PATH: WebSocket only, no DB writes
                    if (delta && delta.content) {
                        fullContent += delta.content;
                        // Broadcast immediately to frontend (zero latency)
                        // Include both content and delta for compatibility
                        const scrubbedDelta = scrub(delta.content);
                        const chunkData = {
                            index: chunkIndex++,
                            type: 'content' as const,
                            content: scrubbedDelta,
                            delta: scrubbedDelta, // Add delta for compatibility
                            messageId: assistantMessageId
                        };
                        this.ws.broadcastToUser(userId!, { type: 'chunk', sessionId: task.sessionId, data: chunkData });
                        // No DB write here - will batch save at the end (cold path)
                    }

                    // Handle reasoning chunks (thinking mode) - HOT PATH: WebSocket only, no DB writes
                    if (delta && delta.reasoning_content) {
                        // Broadcast immediately to frontend (zero latency)
                        const scrubbedDelta = scrub(delta.reasoning_content);
                        const chunkData = {
                            index: chunkIndex++,
                            type: 'reasoning' as const,
                            reasoning_content: scrubbedDelta,
                            messageId: assistantMessageId
                        };
                        this.ws.broadcastToUser(userId!, { type: 'chunk', sessionId: task.sessionId, data: chunkData });
                        // No DB write here - will batch save at the end (cold path)
                    }

                    // Handle client_actions from grok-service (swap actions, UI triggers)
                    if (delta && delta.client_actions && Array.isArray(delta.client_actions)) {
                        for (const action of delta.client_actions) {
                            console.log('[ChatWorker] Broadcasting Grok client_action:', action.type);
                            this.ws.broadcastToUser(userId!, {
                                type: 'client_action',
                                sessionId: task.sessionId,
                                data: {
                                    message_id: assistantMessageId,
                                    action: action
                                }
                            });
                        }
                    }

                    // Grok-service handles tool calls internally, so we just stream the results
                    // If there are swap/UI action events, handle them
                    if (data.custom_event) {
                        const eventChunk = await this.repo.createChunk(assistantMessageId, chunkIndex++, 'custom_event' as any, undefined, undefined, data.custom_event);
                        this.ws.broadcastToUser(userId!, { type: 'chunk', sessionId: task.sessionId, data: eventChunk });
                    }

                    // Handle usage data (sent in final chunks from grok-service)
                    if (data.usage) {
                        lastUsage = data.usage;
                        this.ws.broadcastToUser(userId!, {
                            type: 'usage',
                            sessionId: task.sessionId,
                            data: {
                                message_id: assistantMessageId,
                                usage: data.usage
                            }
                        });
                    }

                    // Handle citations (from grok-service web_search results)
                    const choice = data.choices?.[0];
                    if (choice?.message?.citations && Array.isArray(choice.message.citations)) {
                        allCitations.push(...choice.message.citations);
                        this.ws.broadcastToUser(userId!, {
                            type: 'citations',
                            sessionId: task.sessionId,
                            data: {
                                message_id: assistantMessageId,
                                citations: choice.message.citations
                            }
                        });
                    }

                } catch (e) { }
            }
        }

        // Final output moderation
        const modResult = await moderationClient.moderateOutput(fullContent, userId, task.sessionId, task.model);
        if (!modResult.safe) {
            fullContent = modResult.filtered_text || '[Content removed for safety]';
        }

        // Final message update with safeguard
        try {
            await this.repo.updateMessage(assistantMessageId, {
                content: fullContent,
                reasoning_content: fullReasoning,
                usage: lastUsage || undefined,
                citations: allCitations.length > 0 ? allCitations : undefined,
                status: 'complete'
            });
        } catch (dbErr) {
            console.error(`[ChatWorker] Failed to save final Grok message ${assistantMessageId} to DB:`, dbErr);
        }

        console.log(`[ChatWorker] Grok task ${task.id} completed, ${chunkIndex} chunks`);
    }
}

export const chatWorker = new ChatWorker();
