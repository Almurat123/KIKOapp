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
import { computeUsdCost, getBillingCategory, getUtcDateString } from '../services/billing/billingService.js';
import { insertUsageRecord } from '../repositories/billingRepository.js';

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
};

const THINKING_TOOL_ALLOWLIST = new Set<string>([
    'get_token_info',
    'get_token_price',
    'get_historical_price',
    'get_trending_tokens',
    'get_market_overview',
    'get_economic_calendar',
    'get_wallet_info',
    'analyze_wallet_pnl',
    'get_user_favorites',
    'check_token_risk',
    'get_trending_casts',
    'search_farcaster_casts',
    'get_farcaster_user',
    'get_zora_trending',
    'get_zora_profile',
    'get_early_buyers',
    'analyze_creator',
    'get_polymarket_trending',
    'get_polymarket_trending_markets',
    'get_polymarket_event',
    'search_polymarket',
    'get_new_markets',
    'get_market_activity',
    'get_whale_watch',
    'get_polymarket_trader_stats',
    'external_web_search'
]);

// In thinking mode, we restrict skills to a small "clean" subset to prevent
// execution-oriented prompts/tools from affecting analysis quality.
const THINKING_SKILL_ID_ALLOWLIST = new Set<string>([
    'wallet_portfolio',
    'polymarket_prediction',
    'welcome_onboarding',
    'token_analysis',
]);

// System Prompts (Unified Orchestrator)
import { promptOrchestrator } from '../services/ai/PromptOrchestrator.js';
import type { IntentType, UserContext } from '../services/ai/types.js';
import { parseIntent } from '../services/ai/intentParser.js';
import { getFilteredTools } from '../services/ai/toolPreRouter.js';
import { findTokenOnAnyChain, getTokenInfo } from '../services/ai/tokenDetector.js';
import { getTokenDetails as getDexTokenDetails } from '../services/dexscreener.js';
import { ragClient } from '../services/ragClient.js';
import { skillRegistryClean, skillRegistryExec } from '../skills/registry.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

type ToolTraceEntry = {
    tool: string;
    argsKey: string;
    status: 'success' | 'cached' | 'blocked' | 'error';
    error?: string;
};

type ToolTraceState = {
    mode: 'thinking' | 'execution';
    skillVersion: 'clean' | 'exec';
    toolCalls: ToolTraceEntry[];
    toolCallCounts: Record<string, number>;
    toolArgsCounts: Record<string, number>;
    shouldExitImmediately?: boolean;
    toolFailures: Record<string, number>;
    toolRepeats: Record<string, number>;
    stopReasons: string[];
    blockedKeys: Set<string>;
    lastResultByKey: Map<string, string>;

};

export class ChatWorker {
    private isRunning = false;
    private pollInterval: NodeJS.Timeout | null = null;
    private repo = chatRepo;
    private ws = chatWS;
    private grokResponseIdBySession = new Map<string, string>();
    private readonly maxConcurrentTasks = Math.max(1, parseInt(process.env.CHAT_WORKER_MAX_CONCURRENCY || '40', 10) || 40);
    private readonly maxToolCallsPerTask = Math.max(1, parseInt(process.env.CHAT_WORKER_MAX_TOOL_CALLS || '12', 10) || 12);
    private readonly maxToolCallsPerTool = Math.max(1, parseInt(process.env.CHAT_WORKER_MAX_TOOL_CALLS_PER_TOOL || '3', 10) || 3);
    private runningTasks = new Set<string>();

    private buildToolKey(name: string, args: any): string {
        return `${name}:${this.stableStringify(args)}`;
    }

    private stableStringify(value: any): string {
        const seen = new WeakSet<object>();
        const normalize = (v: any): any => {
            if (v === null || v === undefined) return v;
            if (typeof v !== 'object') return v;
            if (seen.has(v)) return '[Circular]';
            seen.add(v);
            if (Array.isArray(v)) return v.map(normalize);
            const keys = Object.keys(v).sort();
            const out: any = {};
            for (const k of keys) out[k] = normalize(v[k]);
            return out;
        };
        try {
            return JSON.stringify(normalize(value));
        } catch {
            return String(value);
        }
    }

    private buildIntentHints(decision: any): UserContext['intentHints'] | undefined {
        if (!decision) return undefined;
        const labels = Array.isArray(decision.labels) ? decision.labels.map((l: any) => l.label) : [];
        const conflict = decision.conflict
            ? `${decision.conflict.type} (${(decision.conflict.labels || []).join(' vs ')})`
            : undefined;
        return {
            labels,
            conflict,
            question: decision.conflict?.question,
        };
    }

    private resolveChainNameForContext(chainId?: number): string | undefined {
        if (!chainId) return undefined;
        return CHAIN_ID_MAP[chainId] || 'Unknown Chain';
    }

    private buildUserContext(task: AITask, opts: { chainId?: number; chainName?: string }, parsedIntent: any): UserContext {
        const normalizedBalance = this.normalizeBalanceSnapshot(task.toolContext?.balance);
        return {
            userAddress: task.toolContext?.walletAddress,
            chainId: opts.chainId ?? task.toolContext?.chainId,
            chainName: opts.chainName,
            isWalletConnected: !!task.toolContext?.walletAddress,
            toolConfig: task.toolContext?.toolConfig,
            balance: normalizedBalance,
            nativeBalance: task.toolContext?.nativeBalance,
            currentPage: task.toolContext?.currentPage,
            pageContext: task.toolContext?.pageContext,
            intentHints: this.buildIntentHints(parsedIntent?.decision),
        };
    }

    private formatTokenAmount(raw: string, decimals: number): string {
        if (decimals <= 0) return raw;
        let value: string;
        try {
            value = BigInt(raw).toString();
        } catch {
            return raw;
        }
        if (value.length <= decimals) {
            const padded = value.padStart(decimals + 1, '0');
            const whole = padded.slice(0, -decimals);
            const frac = padded.slice(-decimals);
            return `${whole}.${frac}`.replace(/\.?0+$/, '');
        }
        const whole = value.slice(0, -decimals);
        const frac = value.slice(-decimals);
        return `${whole}.${frac}`.replace(/\.?0+$/, '');
    }

    private normalizeDecimalString(value: string, decimals: number): string {
        if (decimals <= 0) return value.split('.')[0] || '0';
        const [whole, frac = ''] = value.split('.');
        const trimmed = frac.slice(0, decimals);
        const combined = trimmed ? `${whole}.${trimmed}` : whole;
        const normalized = combined.replace(/\.?0+$/, '');
        return normalized.length > 0 ? normalized : '0';
    }

    private parseBalanceEntries(balance: any): Array<{ symbol: string; balance: string; decimals?: number; contractAddress?: string }> | undefined {
        if (!balance) return undefined;
        const entries: Array<{ symbol: string; balance: string; decimals?: number; contractAddress?: string }> = [];

        if (Array.isArray(balance)) {
            for (const entry of balance) {
                const symbol = entry?.symbol
                    ?? entry?.tokenSymbol
                    ?? entry?.ticker
                    ?? entry?.name
                    ?? entry?.token?.symbol
                    ?? entry?.token?.name
                    ?? entry?.contractAddress
                    ?? entry?.contract
                    ?? entry?.address;
                if (!symbol) continue;
                const decimals = Number.isFinite(entry?.decimals) ? Number(entry.decimals) : undefined;
                const raw = entry?.raw ?? entry?.amount ?? entry?.tokenBalance ?? entry?.balance ?? entry?.value;
                if (raw === undefined || raw === null) continue;
                const rawStr = String(raw);
                const formatted = decimals !== undefined
                    ? (rawStr.includes('.')
                        ? this.normalizeDecimalString(rawStr, decimals)
                        : this.formatTokenAmount(rawStr, decimals))
                    : rawStr;
                entries.push({
                    symbol: String(symbol),
                    balance: formatted,
                    decimals,
                    contractAddress: entry?.contractAddress || entry?.contract,
                });
            }
            return entries.length > 0 ? entries : undefined;
        }

        if (typeof balance === 'object') {
            for (const [symbol, value] of Object.entries(balance)) {
                if (value === undefined || value === null) continue;
                if (typeof value === 'object') {
                    const decimals = Number.isFinite((value as any)?.decimals) ? Number((value as any).decimals) : undefined;
                    const raw = (value as any)?.raw ?? (value as any)?.amount ?? (value as any)?.tokenBalance ?? (value as any)?.balance ?? (value as any)?.value;
                    if (raw === undefined || raw === null) continue;
                    const rawStr = String(raw);
                    const formatted = decimals !== undefined
                        ? (rawStr.includes('.')
                            ? this.normalizeDecimalString(rawStr, decimals)
                            : this.formatTokenAmount(rawStr, decimals))
                        : rawStr;
                    entries.push({
                        symbol: String(symbol),
                        balance: formatted,
                        decimals,
                        contractAddress: (value as any)?.contractAddress || (value as any)?.contract,
                    });
                } else {
                    entries.push({ symbol: String(symbol), balance: String(value) });
                }
            }
            return entries.length > 0 ? entries : undefined;
        }

        return undefined;
    }

    private normalizeBalanceSnapshot(balance: any): Record<string, string> | undefined {
        const entries = this.parseBalanceEntries(balance);
        if (!entries || entries.length === 0) return undefined;
        const map: Record<string, string> = {};
        for (const entry of entries) {
            map[entry.symbol] = entry.balance;
        }
        return map;
    }

    private buildWalletInfoFromContext(task: AITask): any | null {
        const ctx = task.toolContext;
        if (!ctx) return null;

        const walletAddress = ctx.walletAddress || ctx.userAddress;
        const chainId = ctx.chainId;
        if (!walletAddress || !chainId) return null;

        const normalizedBalance = this.normalizeBalanceSnapshot(ctx.balance);
        const nativeBalance = ctx.nativeBalance;
        if (!normalizedBalance && !nativeBalance) return null;

        const chainName = this.resolveChainNameForContext(chainId) || String(chainId);
        const tokens = this.parseBalanceEntries(ctx.balance) || [];

        return {
            address: walletAddress,
            chain: chainName,
            ethBalance: nativeBalance ? String(nativeBalance) : undefined,
            tokens,
        };
    }

    private buildSystemContextMessage(task: AITask): string | null {
        const ctx = task.toolContext;
        if (!ctx) return null;

        const payload = {
            walletAddress: ctx.walletAddress || ctx.userAddress,
            chainId: ctx.chainId,
            currentPage: ctx.currentPage,
            pageContext: ctx.pageContext,
            nativeBalance: ctx.nativeBalance,
            balance: ctx.balance,
            tokenSnapshot: (ctx as any).tokenSnapshot || (ctx as any).tokenContext || (ctx as any).tokenInfo,
            launchpad: (ctx as any).launchpad || (ctx as any).launchpadInfo,
            toolConfig: ctx.toolConfig,
        };

        const hasAny = Object.values(payload).some(v => v !== undefined);
        if (!hasAny) return null;

        let serialized = JSON.stringify(payload, null, 2);
        const maxLen = 4000;
        if (serialized.length > maxLen) {
            serialized = `${serialized.slice(0, maxLen)}...`;
        }

        logger.info(LogCode.AI_API_CALL, 'ChatWorker: client context injected', {
            hasBalance: !!payload.balance,
            hasNativeBalance: !!payload.nativeBalance,
            hasPageContext: !!payload.pageContext,
            hasToolConfig: !!payload.toolConfig,
            contextBytes: serialized.length,
        });
        if (payload.balance) {
            const entries = this.parseBalanceEntries(payload.balance);
            const spotlightSymbols = new Set(['USDC', 'ETH']);
            const spotlight = entries
                ? entries.filter((token) => spotlightSymbols.has(String(token.symbol).toUpperCase()))
                : [];
            logger.info(LogCode.AI_API_CALL, 'ChatWorker: client balance snapshot summary', {
                tokenCount: entries ? entries.length : 0,
                sample: entries
                    ? entries.slice(0, 5).map((token) => ({
                        symbol: token.symbol,
                        balance: token.balance,
                        decimals: token.decimals,
                        contractAddress: token.contractAddress,
                    }))
                    : [],
                spotlight: spotlight.map((token) => ({
                    symbol: token.symbol,
                    balance: token.balance,
                    decimals: token.decimals,
                    contractAddress: token.contractAddress,
                })),
            });
        }

        const cacheInfo = [];
        if (payload.balance) {
            const entries = this.parseBalanceEntries(payload.balance);
            cacheInfo.push(`✅ Wallet Balance: ${entries?.length || 0} tokens cached`);
        }
        if (payload.nativeBalance) {
            cacheInfo.push(`✅ Native Balance: ${payload.nativeBalance}`);
        }
        if (payload.toolConfig) {
            cacheInfo.push(`✅ User Settings: Available`);
        }
        const cacheStatus = cacheInfo.length > 0 ? `\n\n═══════════════════════════════════════\n🗄️ CACHED DATA AVAILABLE - DO NOT RE-FETCH\n═══════════════════════════════════════\n${cacheInfo.join('\n')}\n═══════════════════════════════════════\n` : '';

        return `[CLIENT_CONTEXT]\n${serialized}${cacheStatus}\n\n⚡ CRITICAL OPTIMIZATION RULES:\n1. The above context contains CACHED DATA that is already available\n2. DO NOT call get_wallet_info - balance data is present above\n3. DO NOT call get_token_info if token data appears in conversation\n4. Use cached data directly and proceed immediately with user's request\n5. Only call tools when you need NEW information not available in cache\n6. When you see [TOKEN_CONTEXT ✅ FROM CACHE] or [USER_BALANCE_CONTEXT ✅ CACHED], that data is ready to use`;
    }

    private seedToolCacheFromContext(cache: Map<string, any>, task: AITask) {
        const ctx = task.toolContext;
        if (!ctx || !cache) return;

        const walletAddress = ctx.walletAddress || ctx.userAddress;
        const chainId = ctx.chainId;
        if (!walletAddress || !chainId) return;

        const normalizedBalance = this.normalizeBalanceSnapshot(ctx.balance);
        const nativeBalance = ctx.nativeBalance;
        const hasWalletSnapshot = !!normalizedBalance || !!nativeBalance;

        const chainName = this.resolveChainNameForContext(chainId);
        const cacheKey = `get_wallet_info:${this.stableStringify({
            address: walletAddress,
            chainId,
        })}`;

        if (!cache.has(cacheKey) && hasWalletSnapshot) {
            const tokens = this.parseBalanceEntries(ctx.balance) || [];
            cache.set(cacheKey, {
                address: walletAddress,
                chain: chainName || String(chainId),
                ethBalance: nativeBalance ? String(nativeBalance) : undefined,
                tokens: tokens || [],
            });
            logger.info(LogCode.AI_API_CALL, 'ChatWorker: seeded get_wallet_info from client context', {
                chainId,
                tokenCount: tokens ? tokens.length : 0,
                hasNativeBalance: !!nativeBalance,
            });
        }

        // Seed token snapshot if upstream context already provided token info
        const tokenSnapshot = (ctx as any).tokenSnapshot || (ctx as any).tokenContext || (ctx as any).tokenInfo;
        if (tokenSnapshot && tokenSnapshot.address) {
            const tokenKey = `get_token_info:${this.stableStringify({
                address: tokenSnapshot.address,
                chainId: tokenSnapshot.chainId || chainId,
            })}`;
            if (!cache.has(tokenKey)) {
                cache.set(tokenKey, {
                    ...tokenSnapshot,
                    chainId: tokenSnapshot.chainId || chainId,
                    chainName: tokenSnapshot.chainName || chainName,
                });
                logger.info(LogCode.AI_API_CALL, 'ChatWorker: seeded get_token_info from client context', {
                    address: tokenSnapshot.address,
                    chainId: tokenSnapshot.chainId || chainId,
                });
            }
        }

        // Seed launchpad info if upstream context already provided it
        const launchpadSnapshot = (ctx as any).launchpad || (ctx as any).launchpadInfo;
        if (launchpadSnapshot && (launchpadSnapshot.address || (tokenSnapshot && tokenSnapshot.address))) {
            const address = launchpadSnapshot.address || tokenSnapshot.address;
            const lpKey = `launchpad_info:${this.stableStringify({
                address,
                chainId: launchpadSnapshot.chainId || chainId,
                provider: launchpadSnapshot.provider,
            })}`;
            if (!cache.has(lpKey)) {
                cache.set(lpKey, {
                    ...launchpadSnapshot,
                    address,
                    chainId: launchpadSnapshot.chainId || chainId,
                });
                logger.info(LogCode.AI_API_CALL, 'ChatWorker: seeded launchpad info from client context', {
                    address,
                    chainId: launchpadSnapshot.chainId || chainId,
                    provider: launchpadSnapshot.provider,
                });
            }
        }
    }

    private buildEnrichedUserContent(params: {
        userQuery: string;
        userContext: UserContext;
        intent: IntentType;
        extraBlocks?: string[];
    }): string {
        const extra = (params.extraBlocks || []).filter(b => b && b.trim().length > 0).join('\n');
        const ctx: UserContext = extra
            ? { ...params.userContext, pageContext: [params.userContext.pageContext, extra].filter(Boolean).join('\n') }
            : params.userContext;
        return promptOrchestrator.buildPrompt(params.userQuery, ctx, params.intent);
    }

    private injectEnrichedUserContent(history: any[], lastUserIndex: number, enrichedContent: string): any[] {
        const next = [...history];
        if (lastUserIndex === -1) return next;
        const lastMsg = next[lastUserIndex];
        next[lastUserIndex] = { ...lastMsg, content: enrichedContent };
        return next;
    }

    private persistStreamingMessageThrottled(
        assistantMessageId: string,
        content: string,
        reasoningContent: string,
        lastDbSaveMs: number,
        intervalMs = 1000
    ): number {
        const now = Date.now();
        if (now - lastDbSaveMs < intervalMs) return lastDbSaveMs;
        this.repo.updateMessage(assistantMessageId, {
            content,
            reasoning_content: reasoningContent,
            status: 'streaming'
        }).catch(e => console.warn('[ChatWorker] Intermediate DB save failed (ignoring):', e.message));
        return now;
    }

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

    private redactToolNames(text: string): string {
        if (!text) return text;
        const toolNames = toolRegistry.getAllDefinitions().map(def => def.name);
        let redacted = text;
        for (const name of toolNames) {
            const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const pattern = new RegExp(`\\b${escaped}\\b`, 'gi');
            redacted = redacted.replace(pattern, 'internal tool');
        }
        return redacted;
    }

    private isFreeIntent(intent: IntentType): boolean {
        return new Set<IntentType>([
            'MARKET_ANALYSIS',
            'SOCIAL_SENSING',
            'GENERAL_CHAT',
            'PREDICTION_MARKETS',
            'RISK_SCAN',
        ]).has(intent);
    }

    private resolveRoutingMode(
        intent: IntentType,
        decision?: Awaited<ReturnType<typeof parseIntent>>['decision']
    ): 'thinking' | 'execution' {
        const slotsComplete = decision?.slots?.complete === true;
        const hasQuestion = decision?.signals?.hasQuestion === true;
        const hasConflict = Boolean(decision?.conflict);

        if (hasQuestion || hasConflict) return 'thinking';
        if (intent === 'TRADING' && !slotsComplete) return 'thinking';
        return this.isFreeIntent(intent) ? 'thinking' : 'execution';
    }

    private getExplorerUrl(chainId: number, txHash: string): string {
        const explorers: Record<number, string> = {
            1: 'https://etherscan.io/tx/',
            8453: 'https://basescan.org/tx/',
            56: 'https://bscscan.com/tx/',
            137: 'https://polygonscan.com/tx/',
            42161: 'https://arbiscan.io/tx/',
            10: 'https://optimistic.etherscan.io/tx/',
            900: 'https://solscan.io/tx/',
        };
        return (explorers[chainId] || 'https://basescan.org/tx/') + txHash;
    }

    private async resolveTokenSymbol(token: string, chainId: number): Promise<string> {
        // If not address-like, assume it's already a symbol
        const isEvmAddress = token.startsWith('0x') && token.length > 20;
        const isSolanaAddress = token.length >= 32 && token.length <= 44 && !token.startsWith('0x');

        if (!isEvmAddress && !isSolanaAddress) {
            // Already a symbol or short name
            return token.toUpperCase();
        }

        try {
            // Use findTokenOnAnyChain which is the most robust method (handles global search and launchpads)
            const info = await findTokenOnAnyChain(token);
            if (info && info.symbol && info.symbol !== 'UNKNOWN') {
                return info.symbol.toUpperCase();
            }

            // Fallback to chain-specific getTokenInfo (internal detector fallback)
            const specificInfo = await getTokenInfo(token, chainId);
            if (specificInfo && specificInfo.symbol && specificInfo.symbol !== 'UNKNOWN') {
                return specificInfo.symbol.toUpperCase();
            }
        } catch (e) {
            console.warn(`[ChatWorker] Failed to resolve symbol for ${token}:`, e);
        }

        // Fallback: shorten address if resolution fails
        return token.slice(0, 6) + '...' + token.slice(-4);
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
                if (this.runningTasks.has(task.id)) continue;
                if (this.runningTasks.size >= this.maxConcurrentTasks) {
                    logger.debug(LogCode.SYS_INFO, 'ChatWorker: concurrency limit reached', {
                        maxConcurrentTasks: this.maxConcurrentTasks,
                        running: this.runningTasks.size,
                    });
                    break;
                }

                this.runningTasks.add(task.id);
                // Process each task asynchronously
                // We do NOT await this to allow parallel processing of tasks, 
                // BUT this means the next poll might occur while tasks are running.
                // This is acceptable as long as we don't fetch the SAME tasks again (getQueuedTasks should handle that via status updates).
                this.runTask(task).catch((err: any) => {
                    console.error(`[ChatWorker] Fatal error in task ${task.id}:`, err);
                }).finally(() => {
                    this.runningTasks.delete(task.id);
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
        logger.debug(LogCode.AI_API_CALL, 'ChatWorker: running task', { taskId: task.id, sessionId: task.sessionId });
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
                data: { taskId: task.id, status: 'running', message: 'Analyzing query', taskType: 'text' }
            });

            // 2. Load context
            this.ws.broadcastToUser(userId!, {
                type: 'task_status',
                sessionId: task.sessionId,
                data: { taskId: task.id, status: 'running', message: 'Loading history', taskType: 'text' }
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
                    data: { taskId: task.id, status: 'running', message: 'Verifying safety', taskType: 'text' }
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
            logger.debug(LogCode.AI_API_CALL, 'ChatWorker: task completed successfully', { taskId: task.id });

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
        let fastSwapAttempted = false; // Circuit breaker for Fast Swap
        let launchpadCardShown = false; // Circuit breaker for Launchpad Card
        let detectedLaunchpadInfo: { chainId: number; provider: string; data: any; address: string } | null = null; // Store launchpad info when detected
        const maxIterations = 10;
        const assistantMessageId = task.assistantMessageId!;
        let totalContent = '';  // Accumulated across all iterations
        let totalReasoning = ''; // Accumulated across all iterations
        let chunkIndex = 0;
        let lastUsage: any = null;  // Track usage for DB persistence
        let allCitations: any[] = [];  // Track citations for DB persistence
        const citationUrlSet = new Set<string>();

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
        this.seedToolCacheFromContext(toolResultsCache, task);
        let earlyPreFetchPromise: Promise<void> | null = null;
        let streamPreFetchPromise: Promise<Map<string, any>> | null = null;
        const toolTrace: ToolTraceState = {
            mode: 'thinking',
            skillVersion: 'clean',
            toolCalls: [],
            toolCallCounts: {},
            toolArgsCounts: {},
            toolFailures: {},
            toolRepeats: {},
            stopReasons: [],
            blockedKeys: new Set(),
            lastResultByKey: new Map(),
        };

        // Base tool filtering (keyword/category based).
        // We will further narrow this set once we know the user's high-level intent (skills gating).
        const lastUserMessage = history.filter(m => m.role === 'user').pop()?.content || '';
        const baseToolDefs = getFilteredTools(lastUserMessage);
        let toolDefinitions = baseToolDefs.map(def => ({ type: 'function', function: def }));
        console.log(`[ChatWorker] Base filtered to ${toolDefinitions.length} tools for message: "${lastUserMessage.slice(0, 50)}..."`);
        const balanceContextAvailable = !!this.buildWalletInfoFromContext(task);
        const balanceRefreshRequested = /\b(refresh|update|check balance|balance check|查询余额|查看余额|刷新余额)\b/i.test(lastUserMessage);

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

        // Declare toolCalls outside main loop so it can be accessed in finally/cleanup
        let toolCalls: any[] = [];

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
            const routingMode = this.resolveRoutingMode(intent, parsedIntent.decision);
            const isFreeIntent = routingMode === 'thinking';
            if (iteration === 1) {
                const decisionMeta = parsedIntent.decision as any;
                toolTrace.mode = routingMode;
                toolTrace.skillVersion = routingMode === 'thinking' ? 'clean' : 'exec';
                logger.info(LogCode.AI_MODE_ROUTED, 'DeepSeek: routed to mode', {
                    taskId: task.id,
                    sessionId: task.sessionId,
                    model: task.model,
                    intent,
                    routingMode,
                    routingStage: decisionMeta?.routingStage,
                    hardRule: decisionMeta?.hardRule,
                    slotsComplete: decisionMeta?.slotsComplete,
                    confidence: parsedIntent.highLevel?.confidence,
                });
            }

            // Skills-level tool gating (single source of truth: `skill.json` -> metadata.tools).
            // Apply once (intent is stable for this task) to prevent tool drift and wrong-tool selection.
            if (iteration === 1) {
                const intentStr = String(intent).toUpperCase();
                const registry = isFreeIntent ? skillRegistryClean : skillRegistryExec;
                const matchedSkills = isFreeIntent
                    ? registry.getAllSkills().filter(s => THINKING_SKILL_ID_ALLOWLIST.has(s.metadata.id))
                    : registry.getSkillsByIntent(intentStr);
                const allowedToolNames = new Set<string>();
                for (const skill of matchedSkills) {
                    for (const name of skill.metadata.tools || []) {
                        allowedToolNames.add(name);
                    }
                }
                // Always keep `external_web_search` as a safe fallback (consistent with ToolPreRouter).
                allowedToolNames.add('external_web_search');

                if (matchedSkills.length > 0 && allowedToolNames.size > 0) {
                    const gated = baseToolDefs.filter(def => allowedToolNames.has(def.name));
                    if (gated.length > 0) {
                        toolDefinitions = gated.map(def => ({ type: 'function', function: def }));
                        console.log(`[ChatWorker] Skill-gated to ${toolDefinitions.length} tools for intent=${intentStr} skills=${matchedSkills.map(s => s.metadata.id).join(', ')}`);
                        logger.info(LogCode.AI_SKILLS_ATTACHED, 'DeepSeek: skills attached', {
                            taskId: task.id,
                            sessionId: task.sessionId,
                            model: task.model,
                            intent: intentStr,
                            routingMode,
                            skillVersion: isFreeIntent ? 'clean' : 'exec',
                            skills: matchedSkills.map(s => s.metadata.id),
                            toolCount: toolDefinitions.length,
                        });
                    } else {
                        console.warn(`[ChatWorker] Skill gating produced 0 tools for intent=${intentStr}; falling back to base tool set`);
                    }
                } else if (isFreeIntent) {
                    const allToolDefs = toolRegistry.getAllDefinitions();
                    const filtered = allToolDefs.filter(def => THINKING_TOOL_ALLOWLIST.has(def.name));
                    toolDefinitions = filtered.map(def => ({ type: 'function', function: def }));
                    console.log(`[ChatWorker] Free intent mode: using ${toolDefinitions.length} thinking tools`);
                    logger.info(LogCode.AI_SKILLS_ATTACHED, 'DeepSeek: thinking mode without skills injection', {
                        taskId: task.id,
                        sessionId: task.sessionId,
                        model: task.model,
                        intent: intentStr,
                        routingMode,
                        skillVersion: 'clean',
                        toolCount: toolDefinitions.length,
                    });
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
                swapMethod: 'allowance_trade', // FORCED: Always allowance_trade
                toolConfig: task.toolContext?.toolConfig ? Object.keys(task.toolContext.toolConfig) : 'none',
                walletConnected: !!task.toolContext?.walletAddress,
                chainId: task.toolContext?.chainId,
            });

            // ⚡ FAST SWAP BYPASS: Skip LLM if swap conditions met
            // FORCED: All users use allowance_trade mode (swap_card removed from UI)
            const fastSwapModeEnabled = task.toolContext?.toolConfig?.fastSwapMode === true;
            const swapMethod = 'allowance_trade'; // FORCED: Always use allowance_trade, ignore database
            const isAllowanceTradeMode = true; // FORCED: Always true

            // Fast swap triggers if: explicit fastSwapMode OR allowance_trade mode (always true now)
            const fastSwapMode = fastSwapModeEnabled || isAllowanceTradeMode;

            const isSwapIntent = parsedIntent.detailed.action === 'swap';
            const hasSwapTarget = !!parsedIntent.swapIntent?.tokenOut || !!parsedIntent.contractAddress;
            const hasExplicitSwapVerb = /\b(swap|buy|sell|trade|exchange|convert|purchase|ape|买|卖|兑换|换)\b/i.test(lastUserMessage);

            // Log fast swap decision
            if (isSwapIntent && hasSwapTarget && hasExplicitSwapVerb) {
                console.log('[ChatWorker] 🚀 Fast Swap Decision:', {
                    fastSwapModeEnabled,
                    isAllowanceTradeMode,
                    willFastSwap: fastSwapMode,
                    reason: fastSwapModeEnabled ? 'fastSwapMode=true' : (isAllowanceTradeMode ? 'swapMethod=allowance_trade' : 'conditions not met')
                });
            }

            if (!fastSwapAttempted && fastSwapMode && isSwapIntent && hasSwapTarget && hasExplicitSwapVerb) {
                fastSwapAttempted = true; // Mark as attempted to prevent loops
                const assistantMessageId = task.assistantMessageId!;

                // ⚡ PERFORMANCE OPTIMIZATION: Combine all WebSocket broadcasts
                // CRITICAL: Send message_start so frontend creates the message container BEFORE the transaction card
                if (task.sessionId) {
                    this.ws.broadcastToUser(userId!, {
                        type: 'message_start',
                        sessionId: task.sessionId,
                        data: {
                            messageId: assistantMessageId,
                            role: 'assistant',
                            model: task.model
                        }
                    });
                    console.log(`[ChatWorker] 🚀 Fast swap: Sent message_start for ${assistantMessageId}`);
                }

                // ⚡ SKIP initial task_status - directly to swap execution
                // Remove unnecessary "Analyzing swap request" broadcast

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
                    const isSolana = chainId === 900;
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
                    // ⚡ SKIP status broadcast - directly fetch balance
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

                        // OPTIMIZED: Use smart balance cache instead of fetching full portfolio every time
                        const { getBalanceOptimized } = await import('../services/balanceCache.js');

                        if (isNative) {
                            // Fetch native balance only (fast, cached)
                            balance = await getBalanceOptimized(
                                userId!,
                                walletAddress,
                                actualChainName
                            );

                            // If swapping "all" native token (Buy/Wrap), leave 5% for gas
                            if (amountIn === 'all') {
                                balance = balance * 0.95;
                            }
                        } else {
                            // Fetch specific token balance (smart cache - only fetches if needed)
                            balance = await getBalanceOptimized(
                                userId!,
                                walletAddress,
                                actualChainName,
                                tokenIn // Specific token address
                            );
                        }

                        // Calculate amount
                        if (amountIn === 'all') {
                            // Use full balance - CRITICAL: Use original precision to avoid any rounding
                            // Don't truncate or round - use the exact balance from the blockchain
                            // This prevents ERC20InsufficientBalance errors
                            amountIn = balance.toString();
                            console.log(`[ChatWorker] SELL all: using exact balance ${amountIn}`);
                        } else {
                            // Percentage sell - we need to be careful not to exceed balance
                            const percent = parseFloat(amountIn) || 0;
                            const rawAmount = balance * (percent / 100);

                            // CRITICAL: Don't hardcode decimals! Use 99.99% of calculated amount
                            // This prevents rounding errors from exceeding balance while maintaining precision
                            // The 0.01% buffer is negligible but prevents ERC20InsufficientBalance errors
                            const safeAmount = rawAmount * 0.9999;
                            amountIn = safeAmount.toString();
                        }

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
                    (task as any).systemInjection = `⚠️ BALANCE AUTO-RESOLUTION ISSUE:\nToken: ${tokenIn}\nChain: ${actualChainName}\nStatus: Not found in cached portfolio snapshot\n\nNEXT STEPS:\n1. Check if token balance appears in [USER_BALANCE_CONTEXT] or [REQUESTED_TOKEN_BALANCE] sections\n2. If balance shows as "not present" but user owns it, the swap can still proceed (they'll confirm amount)\n3. If balance is truly 0, inform user they don't hold this token\n4. DO NOT hallucinate or guess the balance - use only data from context blocks above`;
                    // Do not execute fast swap, fall through to LLM
                } else {
                    // ⚡ PERFORMANCE: Execute swap directly via MainSwapService - NO status broadcast
                    // Import MainSwapService for unified swap execution
                    const { MainSwapService } = await import('../services/MainSwapService.js');

                    // ⚡ Create transaction card message BEFORE executing swap
                    const { createMessage, updateMessage } = await import('../repositories/chatRepository.js');
                    const { chatWS } = await import('../services/chatWebSocket.js');

                    // Resolve token symbols for display
                    const tokenInSymbol = await this.resolveTokenSymbol(tokenIn, chainId);
                    const tokenOutSymbol = await this.resolveTokenSymbol(tokenOut, chainId);

                    const transactionMessage = await createMessage(
                        task.sessionId,
                        'assistant',
                        '',
                        {
                            type: 'transaction-status-card',
                            data: {
                                status: 'pending',
                                swapType: 'buy',
                                tokenIn,
                                tokenOut,
                                tokenInSymbol,
                                tokenOutSymbol,
                                amountIn,
                                chainId,
                                startedAt: Date.now(),
                                message: '⏳ Initiating fast swap...',
                                isLoading: true
                            },
                            status: 'streaming'
                        }
                    );

                    logger.info(LogCode.AI_ORCHESTRATOR, 'Created transaction card for fast swap', {
                        messageId: transactionMessage.id,
                        taskId: task.id
                    });

                    // Broadcast pending card to frontend via WebSocket
                    const taskUserId = task.toolContext?.userId || '';
                    if (taskUserId) {
                        chatWS.broadcast(taskUserId, {
                            type: 'client_action',
                            sessionId: task.sessionId,
                            data: {
                                targetMessageId: transactionMessage.id,
                                action: {
                                    type: 'show_transaction_status_card',
                                    data: {
                                        status: 'pending',
                                        tokenIn,
                                        tokenOut,
                                        tokenInSymbol,
                                        tokenOutSymbol,
                                        amountIn,
                                        chainId,
                                        isLoading: true
                                    }
                                }
                            }
                        });
                    }

                    const swapResult = await MainSwapService.executeSwap({
                        userId: task.toolContext?.userId || '',
                        walletAddress: task.toolContext?.walletAddress || '',
                        tokenIn,
                        tokenOut,
                        amountIn,
                        chainId,
                        slippageBps: 300, // 3% for chat fast swaps
                        mode: 'fast-swap', // Indicates AI-driven instant swap with bypass logic
                        messageId: transactionMessage.id, // Pass messageId for retry updates
                        userSettings: {
                            swapMethod: 'allowance_trade', // CRITICAL: Fast swap = allowance trade mode
                            fastSwapMode: true,
                            mevProtection: false
                        }
                    });

                    // ⚡ Update transaction message with final result
                    const finalStatus = swapResult.success ? 'success' : 'failed';
                    const messageData = transactionMessage.data ? JSON.parse(transactionMessage.data) : {};
                    const formattedAmountOut = swapResult.amountOut
                        ? parseFloat(swapResult.amountOut).toLocaleString('en-US', { maximumFractionDigits: 6 })
                        : undefined;

                    await updateMessage(transactionMessage.id, {
                        data: {
                            ...messageData,
                            status: finalStatus,
                            txHash: swapResult.txHash,
                            amountOut: formattedAmountOut,
                            error: swapResult.error,
                            errorMessage: swapResult.error,
                            completedAt: Date.now(),
                            duration: Date.now() - (messageData.startedAt || Date.now()),
                            message: finalStatus === 'success'
                                ? `✅ Fast swap completed! ${swapResult.txHash?.slice(0, 10)}...`
                                : `❌ Swap failed: ${swapResult.error}`,
                            isLoading: false
                        },
                        status: 'complete'
                    });

                    // Broadcast final status via WebSocket
                    if (taskUserId) {
                        chatWS.broadcast(taskUserId, {
                            type: 'client_action',
                            sessionId: task.sessionId,
                            data: {
                                targetMessageId: transactionMessage.id,
                                action: {
                                    type: 'show_transaction_status_card',
                                    data: {
                                        status: finalStatus,
                                        txHash: swapResult.txHash,
                                        amountOut: formattedAmountOut,
                                        error: swapResult.error,
                                        errorMessage: swapResult.error,
                                        tokenIn,
                                        tokenOut,
                                        tokenInSymbol,
                                        tokenOutSymbol,
                                        amountIn,
                                        chainId,
                                        isLoading: false
                                    }
                                }
                            }
                        });
                    }

                    // Broadcast result to frontend (legacy)
                    if (swapResult.success) {
                        const txHash = swapResult.txHash;
                        if (!txHash) {
                            logger.warn(LogCode.SYS_INFO, 'ChatWorker: swap succeeded without txHash', { taskId: task.id, chainId });
                        }

                        // Resolve symbols and format amount for display
                        const tokenInSymbol = await this.resolveTokenSymbol(tokenIn, chainId);
                        const tokenOutSymbol = await this.resolveTokenSymbol(tokenOut, chainId);
                        const formattedAmount = parseFloat(amountIn).toLocaleString('en-US', { maximumFractionDigits: 6 });
                        const formattedAmountOut = swapResult.amountOut
                            ? parseFloat(swapResult.amountOut).toLocaleString('en-US', { maximumFractionDigits: 6 })
                            : '0.00';

                        // CRITICAL FIX: Create a SEPARATE message for transaction status card
                        // Never reuse assistantMessageId as it may be a launchpad card
                        // Generate unique ID for transaction card
                        const txCardMessageId = `tx-${task.id}-${Date.now()}`;

                        const txCardMsg = await this.repo.createMessage(
                            task.sessionId,
                            'assistant',
                            '',
                            {
                                type: 'transaction-status-card',
                                data: {
                                    status: 'success',
                                    txHash: txHash || '',
                                    tokenInSymbol,
                                    tokenOutSymbol,
                                    amountIn: formattedAmount,
                                    amountOut: formattedAmountOut,
                                    chainId: chainId,
                                },
                                status: 'complete'
                            }
                        );

                        console.log(`[ChatWorker] ✅ Created transaction card message: ${txCardMsg.id}`);

                        // Send client_action to show transaction status card
                        this.ws.broadcastToUser(userId!, {
                            type: 'client_action',
                            sessionId: task.sessionId,
                            data: {
                                message_id: txCardMsg.id,
                                targetMessageId: txCardMsg.id, // CRITICAL: Use NEW message ID, not assistantMessageId
                                action: {
                                    type: 'show_transaction_status_card',
                                    data: {
                                        status: 'success',
                                        txHash: txHash || '',
                                        tokenInSymbol,
                                        tokenOutSymbol,
                                        amountIn: formattedAmount,
                                        amountOut: formattedAmountOut,
                                        chainId: chainId,
                                    }
                                }
                            },
                        });

                        // Send message_complete to stop the streaming indicator
                        this.ws.broadcastToUser(userId!, {
                            type: 'message_complete',
                            sessionId: task.sessionId,
                            data: {
                                message_id: assistantMessageId,
                            },
                        });
                    } else {
                        // Resolve symbols and format amount for display even on failure
                        const tokenInSymbol = await this.resolveTokenSymbol(tokenIn, chainId);
                        const tokenOutSymbol = await this.resolveTokenSymbol(tokenOut, chainId);
                        const formattedAmount = parseFloat(amountIn).toLocaleString('en-US', { maximumFractionDigits: 6 });

                        console.log('[ChatWorker] Fast swap failed, showing failure card');

                        // CRITICAL FIX: Create SEPARATE message for failed transaction card
                        const txCardMessageId = `tx-fail-${task.id}-${Date.now()}`;

                        const txCardMsg = await this.repo.createMessage(
                            task.sessionId,
                            'assistant',
                            '',
                            {
                                type: 'transaction-status-card',
                                data: {
                                    status: 'failed',
                                    error: swapResult.error || 'Swap failed',
                                    tokenInSymbol,
                                    tokenOutSymbol,
                                    amountIn: formattedAmount,
                                    chainId: chainId,
                                },
                                status: 'complete'
                            }
                        );

                        console.log(`[ChatWorker] ✅ Created failed transaction card message: ${txCardMsg.id}`);

                        // Send client_action to show transaction status card with failure
                        this.ws.broadcastToUser(userId!, {
                            type: 'client_action',
                            sessionId: task.sessionId,
                            data: {
                                message_id: txCardMsg.id,
                                targetMessageId: txCardMsg.id,
                                action: {
                                    type: 'show_transaction_status_card',
                                    data: {
                                        status: 'failed',
                                        error: swapResult.error || 'Swap failed',
                                        tokenInSymbol,
                                        tokenOutSymbol,
                                        amountIn: formattedAmount,
                                        chainId: chainId,
                                    }
                                }
                            },
                        });

                        // Send message_complete to stop the streaming indicator
                        this.ws.broadcastToUser(userId!, {
                            type: 'message_complete',
                            sessionId: task.sessionId,
                            data: {
                                message_id: txCardMsg.id,
                            },
                        });

                        // Mark task as done since we've shown the failure card
                        await this.repo.updateTaskStatus(task.id, 'done');
                        return;
                    }

                    // If swap was successful, complete the task and return
                    if (swapResult.success) {
                        await this.repo.updateTaskStatus(task.id, 'done');
                        return;
                    }
                    // Otherwise, continue to normal LLM processing as fallback

                } // end else (amountIn is valid)

            } // end if (fastSwapMode && isSwapIntent && hasSwapTarget && hasExplicitSwapVerb)

            // SAFE MODE: If user sends token address without explicit buy/sell intent, ask for confirmation
            // This applies when fast swap is enabled (either via fastSwapMode or allowance_trade)
            if (fastSwapMode && hasSwapTarget && !hasExplicitSwapVerb) {
                console.log('[ChatWorker] 🛡️ Fast Swap Safe Mode: Token address detected without explicit trade intent');
                (task as any).systemInjection = 'FAST SWAP SAFE MODE: User shared a token address without explicit trade intent. Ask a short confirmation question: trade now or analyze? Do not execute any trade without a clear buy/sell instruction.';
            } // end if (fastSwapMode && hasSwapTarget && !hasExplicitSwapVerb)

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
                const tokenKey = `get_token_info:${this.stableStringify({
                    address: parsedIntent.contractAddress,
                    chainId: detectedChainId || task.toolContext?.chainId
                })}`;

                if (toolResultsCache.has(tokenKey)) {
                    tokenInfo = toolResultsCache.get(tokenKey);
                    console.log(`[ChatWorker] ⚡ [CACHE HIT]: get_token_info for ${parsedIntent.contractAddress}`);
                    // CRITICAL FIX: Ensure address is always set
                    if (!tokenInfo.address && parsedIntent.contractAddress) {
                        tokenInfo.address = parsedIntent.contractAddress;
                        // Update cache with fixed data
                        toolResultsCache.set(tokenKey, tokenInfo);
                        console.log(`[ChatWorker] ⚡ Fixed and updated cached tokenInfo with address`);
                    }
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

                // Seed launchpad info from cache if available (upstream context)
                const launchpadCacheKey = `launchpad_info:${this.stableStringify({
                    address: parsedIntent.contractAddress,
                    chainId: detectedChainId || task.toolContext?.chainId
                })}`;
                if (!detectedLaunchpadInfo && toolResultsCache.has(launchpadCacheKey)) {
                    detectedLaunchpadInfo = toolResultsCache.get(launchpadCacheKey);
                    console.log(`[ChatWorker] 📦 Launchpad info from cache for ${parsedIntent.contractAddress}`);
                }


                // Store launchpad info when first detected (so it persists across iterations)
                if (tokenInfo && tokenInfo.launchpad && !detectedLaunchpadInfo) {
                    detectedLaunchpadInfo = {
                        chainId: tokenInfo.chainId,
                        provider: tokenInfo.launchpad.provider,
                        data: tokenInfo.launchpad.data,
                        address: tokenInfo.address
                    };
                    console.log(`[ChatWorker] 📦 Stored launchpad info: ${detectedLaunchpadInfo.provider} for ${detectedLaunchpadInfo.address}`);
                }

                // Show launchpad card if detected (only once per task)
                // BUT: Skip if user has explicit swap/trade intent (they want to execute, not view info)
                const hasExplicitTradeIntent = parsedIntent.detailed.action === 'swap' &&
                    (parsedIntent.swapIntent?.amount || /\b(swap|buy|sell|trade)\b/i.test(lastUserMessage));

                if (detectedLaunchpadInfo && !launchpadCardShown && !hasExplicitTradeIntent) {
                    launchpadCardShown = true; // Mark as shown to prevent duplicates
                    console.log(`[ChatWorker] Token is from launchpad: ${detectedLaunchpadInfo.provider}`);

                    // Create a separate message for the launchpad card so it doesn't get overwritten
                    // by the transaction status card
                    const launchpadMsg = await this.repo.createMessage(
                        task.sessionId,
                        'assistant',
                        '',
                        {
                            type: 'launchpad-card',
                            data: {
                                chainId: detectedLaunchpadInfo.chainId,
                                provider: detectedLaunchpadInfo.provider,
                                data: {
                                    ...detectedLaunchpadInfo.data,
                                    address: detectedLaunchpadInfo.address
                                }
                            },
                            status: 'complete'
                        }
                    );

                    console.log(`[ChatWorker] ✅ Created launchpad card message: ${launchpadMsg.id}`);

                    this.ws.broadcastToUser(userId!, {
                        type: 'client_action',
                        sessionId: task.sessionId,
                        data: {
                            message_id: launchpadMsg.id,
                            targetMessageId: launchpadMsg.id,
                            action: {
                                type: 'show_launchpad_card',
                                data: {
                                    chainId: detectedLaunchpadInfo.chainId,
                                    provider: detectedLaunchpadInfo.provider,
                                    data: {
                                        ...detectedLaunchpadInfo.data,
                                        address: detectedLaunchpadInfo.address
                                    }
                                }
                            }
                        }
                    });

                    // CRITICAL FIX: Immediately send a small content chunk to hide "Thinking" indicator
                    // This ensures the frontend knows we're actively responding
                    const initialChunk = {
                        index: chunkIndex++,
                        type: 'content' as const,
                        content: '', // Empty content just to signal response started
                        delta: '',
                        messageId: assistantMessageId
                    };
                    this.ws.broadcastToUser(userId!, {
                        type: 'chunk',
                        sessionId: task.sessionId,
                        data: initialChunk
                    });
                } else if (detectedLaunchpadInfo && hasExplicitTradeIntent) {
                    console.log(`[ChatWorker] 🚫 Skipping launchpad card: User has explicit trade intent`);
                }
            }

            // Use high-level intent for system prompt selection

            // Get System Prompt from Orchestrator
            const systemPrompt = promptOrchestrator.getSystemPrompt('deepseek', intent, { routingMode });

            // Prepare User Context with detected information

            // Fallback: If chain name not detected from token, try to resolve from chainId
            if (!detectedChainName && (detectedChainId || task.toolContext?.chainId)) {
                const chainIdToResolve = detectedChainId || task.toolContext?.chainId;
                detectedChainName = this.resolveChainNameForContext(chainIdToResolve!) || 'Unknown Chain';
            }

            const userContext = this.buildUserContext(
                task,
                { chainId: detectedChainId || task.toolContext?.chainId, chainName: detectedChainName },
                parsedIntent
            );

            // Inject Context into the LATEST User Message
            // We find the last message from 'user' in the history and wrap it
            let finalMessages = [...transformedHistory];
            const lastUserIndex = finalMessages.map(m => m.role).lastIndexOf('user');

            let balanceSystemRule: string | null = null;
            let balanceContextBlock = '';
            let tokenContextAvailable = false;
            let launchpadContextAvailable = false;
            if (lastUserIndex !== -1) {
                const lastMsg = finalMessages[lastUserIndex];

                // Add token info to context if detected
                let tokenContextBlock = '';
                let launchpadContextBlock = '';
                if (tokenInfo) {
                    const cacheStatus = toolResultsCache.has(`get_token_info:${this.stableStringify({ address: parsedIntent.contractAddress, chainId: detectedChainId || task.toolContext?.chainId })}`) ? '✅ FROM CACHE' : '🔄 FRESHLY FETCHED';
                    tokenContextBlock = `\n\n[TOKEN_CONTEXT] ${cacheStatus}
Detected Token: ${tokenInfo.symbol} (${tokenInfo.name})
Address: ${tokenInfo.address}
Chain: ${tokenInfo.chainName} (${tokenInfo.chainId})
${tokenInfo.price ? `Current Price: $${tokenInfo.price.toFixed(6)}` : ''}
${tokenInfo.priceChange24h !== undefined ? `24h Change: ${tokenInfo.priceChange24h > 0 ? '+' : ''}${tokenInfo.priceChange24h.toFixed(2)}%` : ''}
${tokenInfo.volume24h ? `24h Volume: $${tokenInfo.volume24h.toLocaleString()}` : ''}
${tokenInfo.marketCap ? `Market Cap: $${tokenInfo.marketCap.toLocaleString()}` : ''}
${tokenInfo.launchpad ? `🚀 Launchpad: ${tokenInfo.launchpad.provider.toUpperCase()} (DO NOT run active security scan on launchpad tokens).` : ''}

⚡ IMPORTANT: This token data is ALREADY AVAILABLE. DO NOT call get_token_info again for ${tokenInfo.symbol || tokenInfo.address}.
`;
                    tokenContextAvailable = true;
                }
                if (tokenInfo?.launchpad || detectedLaunchpadInfo) {
                    const launchpad = tokenInfo?.launchpad || detectedLaunchpadInfo;
                    launchpadContextBlock = `\n\n[LAUNCHPAD_CONTEXT]
Token is a launchpad token.
Provider: ${launchpad.provider?.toUpperCase?.() || launchpad.provider}
Chain: ${launchpad.chainId || tokenInfo?.chainId}
Address: ${launchpad.address || tokenInfo?.address}
Rule: Skip check_token_risk for launchpad tokens. Do NOT run active security scans.`;
                    launchpadContextAvailable = true;
                }

                if (parsedIntent?.contractAddress) {
                    tokenContextBlock += `\n\n[USER_INPUT_CONTEXT]
Detected Contract Address: ${parsedIntent.contractAddress}
`;
                }

                // Add balance info if pre-fetched
                const balanceKey = `get_wallet_info:${this.stableStringify({
                    address: task.toolContext?.walletAddress,
                    chainId: task.toolContext?.chainId
                })}`;
                let tokensInPortfolio: string[] = [];
                if (toolResultsCache.has(balanceKey)) {
                    const balanceData = toolResultsCache.get(balanceKey);
                    const tokenCount = balanceData?.tokens?.length || 0;
                    console.log(`[ChatWorker] ⚡ [CACHE HIT]: get_wallet_info (${tokenCount} tokens cached)`);

                    // CRITICAL FIX: Show symbol, balance AND contract address so LLM knows both
                    const portfolioLines = balanceData.tokens ? balanceData.tokens.map((t: any) => {
                        const symbol = t.symbol || 'Unknown';
                        const balance = t.balance || '0';
                        const contract = t.contractAddress || t.contract;
                        // Show contract address for tokens (not for native ETH)
                        const contractInfo = contract && !contract.startsWith('0x0000000000000000000000000000000000000000')
                            ? ` (${contract})`
                            : '';
                        return `- ${symbol}: ${balance}${contractInfo}`;
                    }).join('\n') : '';

                    const userBalanceBlock = `\n\n[USER_BALANCE_CONTEXT] ✅ CACHED DATA AVAILABLE
User Wallet: ${task.toolContext?.walletAddress}
Chain ID: ${task.toolContext?.chainId}
Total Assets: ${tokenCount} tokens
${balanceData.tokens ? `Portfolio Assets:\n${balanceData.tokens.map((t: any) => `- ${t.symbol}: ${t.balance}`).join('\n')}` : ''}

IMPORTANT: This balance data is ALREADY AVAILABLE from cache. DO NOT call get_wallet_info again.
`;
                    tokensInPortfolio = balanceData.tokens?.map((t: any) => (t.contractAddress || t.contract)?.toLowerCase()) || [];

                    const requestedTokens = new Set<string>();
                    const tokenIn = parsedIntent?.detailed?.token_in;
                    const tokenOut = parsedIntent?.detailed?.token_out;
                    if (tokenIn) requestedTokens.add(String(tokenIn));
                    if (tokenOut) requestedTokens.add(String(tokenOut));
                    if (tokenInfo?.address) requestedTokens.add(String(tokenInfo.address));

                    if (requestedTokens.size > 0 && Array.isArray(balanceData.tokens)) {
                        const requestedLines: string[] = [];
                        const matched: string[] = [];
                        const missing: string[] = [];
                        const resolvedBalances: Record<string, string> = {};
                        for (const request of requestedTokens) {
                            const requestLower = request.toLowerCase();
                            const match = balanceData.tokens.find((t: any) => {
                                const symbol = t.symbol ? String(t.symbol).toLowerCase() : '';
                                const contract = (t.contractAddress || t.contract) ? String(t.contractAddress || t.contract).toLowerCase() : '';
                                return symbol === requestLower || contract === requestLower;
                            });
                            if (match) {
                                const matchBalance = match.balance ?? match.tokenBalance ?? '0';
                                requestedLines.push(`- ${match.symbol || request}: ${matchBalance}${match.decimals !== undefined ? ` (decimals: ${match.decimals})` : ''}`);
                                matched.push(match.symbol || request);
                                resolvedBalances[match.symbol || request] = String(matchBalance);
                            } else {
                                requestedLines.push(`- ${request}: not present in provided balance snapshot`);
                                missing.push(request);
                            }
                        }
                        const requestedBalanceBlock = `\n\n[REQUESTED_TOKEN_BALANCE]
${requestedLines.join('\n')}
Rule: If a token is marked "not present", you must say the balance is unknown or zero and MUST NOT infer or guess.`;
                        tokenContextBlock += requestedBalanceBlock;
                        balanceContextBlock += requestedBalanceBlock;
                        logger.info(LogCode.AI_API_CALL, 'ChatWorker: requested token balance resolved', {
                            walletAddress: task.toolContext?.walletAddress,
                            chainId: task.toolContext?.chainId,
                            requested: Array.from(requestedTokens),
                            matched,
                            missing,
                            resolvedBalances,
                        });
                        balanceSystemRule = `BALANCE_CONTEXT_RULE: Balance context is already provided for this request. Do NOT call get_wallet_info unless the user explicitly asks for a refresh. Do NOT ask to check balances or say you will check them. Use [REQUESTED_TOKEN_BALANCE] or [USER_BALANCE_CONTEXT] as authoritative and proceed.`;
                    }
                } else if (task.toolContext?.walletAddress) {
                    const unavailableBlock = `\n\n[USER_BALANCE_CONTEXT]
User Wallet: ${task.toolContext?.walletAddress}
Status: unavailable (balance data not available from cache).`;
                    tokenContextBlock += unavailableBlock;
                    balanceContextBlock += unavailableBlock;
                }

                // Check if detected token is missing from portfolio and add it directly
                // This runs regardless of cache state to ensure we always check for new tokens
                if (tokenInfo && tokenInfo.address && task.toolContext?.walletAddress) {
                    if (!tokensInPortfolio.includes(tokenInfo.address.toLowerCase())) {
                        try {
                            console.log(`[ChatWorker] 🔍 Token not in portfolio, querying direct balance...`, {
                                symbol: tokenInfo.symbol,
                                address: tokenInfo.address,
                                chainId: task.toolContext?.chainId,
                                chainName: tokenInfo.chainName
                            });

                            // Map chainId to Alchemy chain name
                            const chainIdToName: Record<number, string> = {
                                1: 'eth', 8453: 'base', 56: 'bsc', 42161: 'arbitrum',
                                10: 'optimism', 137: 'polygon', 43114: 'avalanche'
                            };
                            const chainName = tokenInfo.chainName ||
                                chainIdToName[task.toolContext?.chainId || 0] ||
                                'base';

                            console.log(`[ChatWorker] Querying balance on chain: ${chainName}`);
                            const directBalance = await alchemy.getSpecificTokenBalance(
                                task.toolContext.walletAddress,
                                chainName,
                                tokenInfo.address
                            );

                            console.log(`[ChatWorker] Direct balance result:`, {
                                raw: directBalance?.raw,
                                decimals: directBalance?.decimals,
                                formatted: directBalance?.formatted
                            });

                            // CRITICAL FIX: directBalance returns {raw, decimals, formatted}, not a number
                            const balanceNum = parseFloat(directBalance?.formatted || '0');
                            console.log(`[ChatWorker] Parsed balance: ${balanceNum}`);

                            if (balanceNum > 0) {
                                // Initialize context block if not already present
                                if (!tokenContextBlock.includes('[USER_BALANCE_CONTEXT]')) {
                                    tokenContextBlock += `\n\n[USER_BALANCE_CONTEXT]
User Wallet: ${task.toolContext?.walletAddress}
Chain: ${task.toolContext?.chainId || chainName}
`;
                                }
                                tokenContextBlock += `\n⚠️ DETECTED TOKEN BALANCE (Direct Query):
- ${tokenInfo.symbol} (${tokenInfo.address}): ${directBalance.formatted}${directBalance.decimals ? ` (decimals: ${directBalance.decimals})` : ''}
`;
                                console.log(`[ChatWorker] ✅ Added direct balance for ${tokenInfo.symbol}: ${directBalance.formatted}`);
                            } else {
                                console.log(`[ChatWorker] ⚠️ Direct balance for ${tokenInfo.symbol} is 0 or unavailable`);
                            }
                        } catch (e: any) {
                            console.error(`[ChatWorker] ❌ Failed to add direct token balance:`, {
                                error: e.message,
                                stack: e.stack?.split('\n').slice(0, 3).join('\n')
                            });
                        }
                    } else {
                        console.log(`[ChatWorker] Token already in portfolio: ${tokenInfo.symbol}`);
                    }
                } else {
                    if (!tokenInfo) {
                        console.log(`[ChatWorker] No tokenInfo available`);
                    } else {
                        console.log(`[ChatWorker] Missing wallet address or token address`);
                    }
                }

                // Add social info if pre-fetched
                const socialKey = `get_trending_casts:${this.stableStringify({})}`;
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
                const extraBlocks: string[] = [];
                if (tokenContextBlock) extraBlocks.push(tokenContextBlock);
                if (launchpadContextBlock) extraBlocks.push(launchpadContextBlock);
                if (ragContext) {
                    extraBlocks.push(`\n\n[RELEVANT DOCUMENTATION CONTEXT]:\n${ragContext}\n\n(Use the above context to answer if relevant)`);
                    console.log(`[ChatWorker] 🧠 RAG: Injected ${ragContext.length} chars of local knowledge into prompt`);
                }

                const enrichedContent = this.buildEnrichedUserContent({
                    userQuery: lastMsg.content,
                    userContext,
                    intent,
                    extraBlocks,
                });

                // Create a shallow copy of the message with new content to send to LLM
                // (We don't update DB history to keep it clean, only what the LLM sees)
                finalMessages = this.injectEnrichedUserContent(finalMessages, lastUserIndex, enrichedContent);
                if (ragContext) {
                    console.log(`[ChatWorker] 🚀 DeepSeek request will include local knowledge context.`);
                }
                console.log(`[ChatWorker] Enriched user prompt with context for ${userContext.userAddress || 'guest'}`);
            }

            // Start building messages
            const messages: any[] = [{ role: 'system', content: systemPrompt }];
            const systemContext = this.buildSystemContextMessage(task);
            if (systemContext) {
                messages.push({ role: 'system', content: systemContext });
                console.log('[ChatWorker] Added client context to system prompt');
            }
            if (balanceContextBlock) {
                messages.push({ role: 'system', content: balanceContextBlock.trim() });
                logger.info(LogCode.AI_API_CALL, 'ChatWorker: balance context attached to system prompt', {
                    bytes: balanceContextBlock.length,
                });
            }
            if (balanceSystemRule) {
                messages.push({ role: 'system', content: balanceSystemRule });
                logger.info(LogCode.AI_API_CALL, 'ChatWorker: balance system rule injected');
            }

            // If we have a system injection (e.g. fallback guidance), add it as a system message
            if ((task as any).systemInjection) {
                messages.push({ role: 'system', content: (task as any).systemInjection });
                console.log(`[ChatWorker] Applied system injection: ${(task as any).systemInjection}`);
            }

            if (balanceContextAvailable && !balanceRefreshRequested) {
                const beforeCount = toolDefinitions.length;
                toolDefinitions = toolDefinitions.filter(def => def.function?.name !== 'get_wallet_info');
                if (toolDefinitions.length !== beforeCount) {
                    logger.info(LogCode.AI_API_CALL, 'ChatWorker: removed get_wallet_info tool (balance context present)', {
                        before: beforeCount,
                        after: toolDefinitions.length,
                    });
                }
            }
            if (tokenContextAvailable) {
                const beforeCount = toolDefinitions.length;
                toolDefinitions = toolDefinitions.filter(def => def.function?.name !== 'get_token_info');
                if (toolDefinitions.length !== beforeCount) {
                    logger.info(LogCode.AI_API_CALL, 'ChatWorker: removed get_token_info tool (token context present)', {
                        before: beforeCount,
                        after: toolDefinitions.length,
                    });
                }
            }
            if (launchpadContextAvailable) {
                const beforeCount = toolDefinitions.length;
                toolDefinitions = toolDefinitions.filter(def => def.function?.name !== 'check_token_risk');
                if (toolDefinitions.length !== beforeCount) {
                    logger.info(LogCode.AI_API_CALL, 'ChatWorker: removed check_token_risk tool (launchpad context present)', {
                        before: beforeCount,
                        after: toolDefinitions.length,
                    });
                }
            }

            const requestBody: any = {
                model: mapDeepSeekModel(task.model),
                messages: [...messages, ...finalMessages],
                stream: true,
                tools: toolDefinitions,
                tool_choice: 'auto'
            };

            // Broadcast Thinking state before API call
            // IMPORTANT: Message order should be:
            // 1. message_start (already sent at line ~598)
            // 2. launchpad_card (sent above if detected)
            // 3. task_status: Thinking (this message)
            // 4. content chunks (sent during streaming)
            console.log(`[ChatWorker] Broadcasting Thinking status for ${assistantMessageId}. Message order: message_start → launchpad_card → Thinking → content_chunks`);

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
            // toolCalls now declared above, before while loop
            toolCalls = []; // Reset for this iteration
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
                                // CRITICAL: Always broadcast content chunks, even if we're in first iteration
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
                                lastDbSave = this.persistStreamingMessageThrottled(
                                    assistantMessageId,
                                    totalContent,
                                    totalReasoning,
                                    lastDbSave,
                                    1000
                                );
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
                                lastDbSave = this.persistStreamingMessageThrottled(
                                    assistantMessageId,
                                    totalContent,
                                    totalReasoning,
                                    lastDbSave,
                                    1000
                                );
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
                                    streamPreFetchPromise = this.preFetchFromStream(
                                        toolCalls,
                                        task.toolContext,
                                        task.sessionId,
                                        userId || undefined,
                                        assistantMessageId
                                    );
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

                // Prepare execution state
                let shouldContinue = true;
                const execState = { chunkIndex, totalContent, shouldContinue, task };

                const { results: toolResults, citations: toolCitations } = await this.executeTools(
                    task.sessionId,
                    assistantMessageId,
                    toolCalls,
                    task.toolContext,
                    userId, // Add userId
                    toolResultsCache,
                    toolTrace,
                    execState
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

                const loopStopReasons = toolTrace.stopReasons.filter(r =>
                    r.startsWith('tool_call_limit') || r.startsWith('tool_repeat_limit') || r.startsWith('tool_failure_limit')
                );
                if (loopStopReasons.length > 0) {
                    const notice = `\n\n⚠️ *Tool usage limit reached. Please refine your request or provide more specific inputs.*`;
                    totalContent = (totalContent || '') + notice;
                    iterContent += notice;
                    this.ws.broadcastToUser(userId!, {
                        type: 'chunk',
                        sessionId: task.sessionId,
                        data: {
                            index: chunkIndex++,
                            type: 'content' as const,
                            content: notice,
                            messageId: assistantMessageId
                        }
                    });
                    break;
                }

                // CRITICAL: Check for _final tool execution - should break out of entire loop
                const hasFinalTool = toolTrace.stopReasons.some(r => r.startsWith('tool_final:'));
                const shouldExitImmediately = toolTrace.shouldExitImmediately === true;

                if (hasFinalTool || shouldExitImmediately) {
                    logger.info(LogCode.AI_ORCHESTRATOR, 'Tool final flag detected - completing task immediately', {
                        stopReasons: toolTrace.stopReasons,
                        immediateExit: shouldExitImmediately
                    });
                    break; // Exit while loop immediately, don't continue to next iteration
                }

                continue; // Next iteration with tool results
            } else {
                // Final result reached - moderate output
                if (totalContent && totalContent.trim().length > 0) {
                    const modResult = await moderationClient.moderateOutput(totalContent, userId, task.sessionId, task.model);
                    if (!modResult.safe) {
                        totalContent = modResult.filtered_text || '[Content removed for safety]';
                    }
                    totalContent = this.redactToolNames(totalContent);
                }

                // CRITICAL FIX: Ensure final content is broadcasted to frontend
                // If no chunks were sent during streaming, send the entire content now
                if (totalContent && totalContent.trim().length > 0) {
                    // Check if we have sent any content chunks
                    if (chunkIndex === 1) {
                        // Only the initial empty chunk was sent, send the actual content now
                        const finalChunk = {
                            index: chunkIndex++,
                            type: 'content' as const,
                            content: totalContent,
                            delta: totalContent,
                            messageId: assistantMessageId
                        };
                        this.ws.broadcastToUser(userId!, {
                            type: 'chunk',
                            sessionId: task.sessionId,
                            data: finalChunk
                        });
                    }
                }

                break; // Final response reached
            }
        }

        // Check if we hit max iterations
        try {
            const existing = await this.repo.getMessage(assistantMessageId);
            const existingData = existing?.data || {};
            const toolTracePayload = {
                mode: toolTrace.mode,
                skillVersion: toolTrace.skillVersion,
                toolCalls: toolTrace.toolCalls,
                toolCallCounts: toolTrace.toolCallCounts,
                toolFailures: toolTrace.toolFailures,
                toolRepeats: toolTrace.toolRepeats,
                stopReasons: Array.from(new Set(toolTrace.stopReasons)),
            };
            await this.repo.updateMessage(assistantMessageId, {
                data: {
                    ...existingData,
                    toolTrace: toolTracePayload,
                }
            });
        } catch (traceErr: any) {
            logger.warn(LogCode.DB_TRANSACTION_FAILED, 'ChatWorker: failed to persist tool trace', { error: traceErr?.message || traceErr });
        }

        // CRITICAL FIX: Persist final message state for successful completion
        // Without this, status remains 'streaming' and data is lost on refresh
        if (iteration < maxIterations) {
            try {
                await this.repo.updateMessage(assistantMessageId, {
                    content: totalContent,
                    reasoning_content: totalReasoning,
                    usage: lastUsage || undefined,
                    citations: allCitations.length > 0 ? allCitations : undefined,
                    status: 'complete'
                });
                logger.debug(LogCode.AI_API_CALL, 'ChatWorker: DeepSeek final message persisted', { assistantMessageId });
                await this.persistBillingUsage({
                    assistantMessageId,
                    userId,
                    model: task.model,
                    usage: lastUsage,
                    toolContext: task.toolContext,
                    toolCallsCount: toolCalls.length
                });
            } catch (dbErr) {
                console.error(`[ChatWorker] Failed to save final message ${assistantMessageId} to DB:`, dbErr);
            }

            // CRITICAL: Broadcast message_complete to frontend so it stops showing "Thinking"
            console.log(`[ChatWorker] Broadcasting message_complete for ${assistantMessageId}`);
            this.ws.broadcastToUser(userId!, {
                type: 'message_complete',
                sessionId: task.sessionId,
                data: {
                    messageId: assistantMessageId,
                    status: 'success',
                    totalIterations: iteration
                }
            });
        }

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
                await this.persistBillingUsage({
                    assistantMessageId,
                    userId,
                    model: task.model,
                    usage: lastUsage,
                    toolContext: task.toolContext,
                    toolCallsCount: toolCalls.length
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

            // CRITICAL: Still broadcast message_complete so frontend stops showing "Thinking"
            console.log(`[ChatWorker] Broadcasting message_complete (max iterations) for ${assistantMessageId}`);
            this.ws.broadcastToUser(userId!, {
                type: 'message_complete',
                sessionId: task.sessionId,
                data: {
                    messageId: assistantMessageId,
                    status: 'max_iterations',
                    totalIterations: iteration
                }
            });
        }
    } // end processDeepSeekTask

    /**
     * Tool name to user-friendly status message mapping
     */
    private getToolStatusMessage(toolName: string): string {
        const toolMessages: Record<string, string> = {
            'external_web_search': 'Searching the web',
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
            'get_wallet_info': 'Fetching wallet data',
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
            'wallet_balance': 'get_wallet_info',
            'wallet_info': 'get_wallet_info',
            'market_overview': 'get_market_overview',
            'token_trending': 'get_trending_tokens',
            'social_trending': 'get_trending_casts'
        };

        const action = parsedIntent.detailed.action;
        const toolName = triggers[action as keyof typeof triggers];

        if (toolName) {
            logger.debug(LogCode.AI_API_CALL, 'ChatWorker: early pre-fetch start', { tool: toolName, action });

            // Construct arguments based on intent
            let args: any = {};
            if (toolName === 'get_token_info' || toolName === 'get_token_chart') {
                args = {
                    address: parsedIntent.contractAddress || parsedIntent.detailed.token_address,
                    chainId: parsedIntent.chainId || task.toolContext?.chainId
                };
            } else if (toolName === 'get_wallet_info') {
                args = {
                    address: task.toolContext?.walletAddress,
                    chainId: task.toolContext?.chainId
                };
            }

            try {
                if (toolName === 'get_wallet_info') {
                    const contextResult = this.buildWalletInfoFromContext(task);
                    if (contextResult) {
                        const cacheKey = `${toolName}:${this.stableStringify(args)}`;
                        resultsMap.set(cacheKey, contextResult);
                        logger.info(LogCode.AI_API_CALL, 'ChatWorker: early pre-fetch used client context', { tool: toolName });
                        return;
                    }
                }
                const result = await toolRegistry.execute(toolName, args, task.toolContext);
                const cacheKey = `${toolName}:${this.stableStringify(args)}`;
                resultsMap.set(cacheKey, result);
                logger.debug(LogCode.AI_API_CALL, 'ChatWorker: early pre-fetch stored', { tool: toolName });
            } catch (err) {
                console.warn(`[ChatWorker] Early pre-fetch failed for ${toolName}:`, err);
            }
        }

        // TRADING intent: prefetch wallet portfolio + token info for stability
        const isTrading = parsedIntent?.highLevel?.type === 'TRADING';
        if (isTrading && task.toolContext?.walletAddress) {
            const balanceKey = `get_wallet_info:${this.stableStringify({
                address: task.toolContext?.walletAddress,
                chainId: task.toolContext?.chainId
            })}`;
            if (!resultsMap.has(balanceKey)) {
                logger.debug(LogCode.AI_API_CALL, 'ChatWorker: TRADING pre-fetch get_wallet_info');
                const contextResult = this.buildWalletInfoFromContext(task);
                if (contextResult) {
                    resultsMap.set(balanceKey, contextResult);
                    logger.info(LogCode.AI_API_CALL, 'ChatWorker: TRADING pre-fetch used client context');
                } else {
                    toolRegistry.execute('get_wallet_info', {
                        address: task.toolContext?.walletAddress,
                        chainId: task.toolContext?.chainId
                    }, task.toolContext).then(res => {
                        resultsMap.set(balanceKey, res);
                        logger.debug(LogCode.AI_API_CALL, 'ChatWorker: TRADING get_wallet_info stored');
                    }).catch(err => console.warn('[ChatWorker] TRADING get_wallet_info pre-fetch failed:', err));
                }
            }
        }
        if (isTrading && parsedIntent?.contractAddress) {
            const tokenKey = `get_token_info:${this.stableStringify({
                address: parsedIntent.contractAddress,
                chainId: parsedIntent.chainId || task.toolContext?.chainId
            })}`;
            if (!resultsMap.has(tokenKey)) {
                logger.debug(LogCode.AI_API_CALL, 'ChatWorker: TRADING pre-fetch token_info');
                toolRegistry.execute('get_token_info', {
                    address: parsedIntent.contractAddress,
                    chainId: parsedIntent.chainId || task.toolContext?.chainId
                }, task.toolContext).then(res => {
                    resultsMap.set(tokenKey, res);
                    logger.debug(LogCode.AI_API_CALL, 'ChatWorker: TRADING token_info stored');
                }).catch(err => console.warn('[ChatWorker] TRADING token_info pre-fetch failed:', err));
            }
        }

        // 🚀 PROACTIVE MULTI-INTENT PRE-FETCH (Keyword based)
        // If main action didn't match balance/social, but keywords are present, pre-fetch anyway
        const lastUserMessage = parsedIntent.detailed.query || ''; // Get message from intent
        const lowerMsg = lastUserMessage.toLowerCase();

        // Proactive Balance
        if (action !== 'wallet_balance' && action !== 'wallet_info' && /\b(balance|portfolio|余额|钱包|资|持有)\b/i.test(lowerMsg)) {
            const balanceKey = `get_wallet_info:${this.stableStringify({
                address: task.toolContext?.walletAddress,
                chainId: task.toolContext?.chainId
            })}`;

            if (!resultsMap.has(balanceKey)) {
                logger.debug(LogCode.AI_API_CALL, 'ChatWorker: proactive pre-fetch get_wallet_info');
                const contextResult = this.buildWalletInfoFromContext(task);
                if (contextResult) {
                    resultsMap.set(balanceKey, contextResult);
                    logger.info(LogCode.AI_API_CALL, 'ChatWorker: proactive pre-fetch used client context');
                } else {
                    toolRegistry.execute('get_wallet_info', {
                        address: task.toolContext?.walletAddress,
                        chainId: task.toolContext?.chainId
                    }, task.toolContext).then(res => {
                        resultsMap.set(balanceKey, res);
                        logger.debug(LogCode.AI_API_CALL, 'ChatWorker: proactive get_wallet_info pre-fetch stored');
                    }).catch(err => console.warn('[ChatWorker] Proactive get_wallet_info pre-fetch failed:', err));
                }
            }
        }

        // 🚀 CRITICAL: ALWAYS pre-fetch balance for TRADING intent
        // AI needs balance to process "sell all", "buy with all ETH", etc.
        const highLevelIntent = parsedIntent.detailed.highLevelIntent || parsedIntent.intent;
        if (highLevelIntent === 'TRADING') {
            const balanceKey = `get_wallet_info:${this.stableStringify({
                address: task.toolContext?.walletAddress,
                chainId: task.toolContext?.chainId
            })}`;

            if (!resultsMap.has(balanceKey) && task.toolContext?.walletAddress) {
                logger.debug(LogCode.AI_API_CALL, 'ChatWorker: TRADING intent - auto pre-fetch get_wallet_info');
                const contextResult = this.buildWalletInfoFromContext(task);
                if (contextResult) {
                    resultsMap.set(balanceKey, contextResult);
                    logger.info(LogCode.AI_API_CALL, 'ChatWorker: TRADING auto pre-fetch used client context');
                } else {
                    toolRegistry.execute('get_wallet_info', {
                        address: task.toolContext?.walletAddress,
                        chainId: task.toolContext?.chainId
                    }, task.toolContext).then(res => {
                        resultsMap.set(balanceKey, res);
                        logger.debug(LogCode.AI_API_CALL, 'ChatWorker: TRADING get_wallet_info pre-fetch stored');
                    }).catch(err => console.warn('[ChatWorker] TRADING get_wallet_info pre-fetch failed:', err));
                }
            }
        }

        // Proactive Social
        if (action !== 'social_trending' && /\b(trending|social|farcaster|twitter|hot|sentiment|what.*people|大家|在聊|热门)\b/i.test(lowerMsg)) {
            const socialKey = `get_trending_casts:${this.stableStringify({})}`;
            if (!resultsMap.has(socialKey)) {
                logger.debug(LogCode.AI_API_CALL, 'ChatWorker: proactive pre-fetch trending_casts');

                toolRegistry.execute('get_trending_casts', {}, task.toolContext).then(res => {
                    resultsMap.set(socialKey, res);
                    logger.debug(LogCode.AI_API_CALL, 'ChatWorker: proactive social pre-fetch stored');
                }).catch(err => console.warn('[ChatWorker] Proactive social pre-fetch failed:', err));
            }
        }
    }

    private async persistBillingUsage(params: {
        assistantMessageId: string;
        userId?: string | null;
        model: string;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
        toolContext?: any;
        toolCallsCount?: number;
    }): Promise<void> {
        if (!params.userId || !params.usage) return;

        const billingContext = params.toolContext?.billing || {};
        const modelCategory = billingContext.modelCategory || getBillingCategory(params.model);
        const isFree = typeof billingContext.isFree === 'boolean' ? billingContext.isFree : false;
        const usdCost = computeUsdCost(params.usage, params.model, params.toolCallsCount || 0);
        const promptTokens = Number(params.usage.prompt_tokens || 0);
        const completionTokens = Number(params.usage.completion_tokens || 0);
        const totalTokens = Number(params.usage.total_tokens || promptTokens + completionTokens);

        try {
            await insertUsageRecord({
                assistantMessageId: params.assistantMessageId,
                userId: params.userId,
                model: params.model,
                modelCategory,
                promptTokens,
                completionTokens,
                totalTokens,
                toolCallsCount: params.toolCallsCount || 0,
                usdCost,
                dateUtc: getUtcDateString(),
                isFree
            });
        } catch (error: any) {
            logger.warn(LogCode.DB_TRANSACTION_FAILED, 'Billing usage insert failed', {
                error: error?.message || error
            });
        }
    }

    /**
     * Pre-fetches results for tool calls in parallel (Phase 5: Streaming).
     * This runs in the background while the LLM is still streaming.
     */
    private async preFetchFromStream(toolCalls: any[], context?: any, sessionId?: string, userId?: string, messageId?: string): Promise<Map<string, any>> {
        const cache = new Map<string, any>();
        const promises = toolCalls.map(async (tc) => {
            try {
                const args = JSON.parse(tc.function.arguments);
                const result = await toolRegistry.execute(tc.function.name, args, context);
                const cacheKey = `${tc.function.name}:${this.stableStringify(args)}`;
                cache.set(cacheKey, result);
                logger.debug(LogCode.AI_API_CALL, 'ChatWorker: stream pre-fetch stored', { tool: tc.function.name });
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
    private async executeTools(sessionId: string, messageId: string, toolCalls: any[], context: any = {}, userId: string | null = null, cache?: Map<string, any>, trace?: ToolTraceState, execState?: { chunkIndex: number; totalContent: string; shouldContinue: boolean; task: any }): Promise<{ results: any[], citations: any[] }> {
        const results: any[] = [];
        const allCitations: any[] = [];

        for (const tc of toolCalls) {
            let args: any = {};
            try {
                args = JSON.parse(tc.function.arguments);
            } catch (err: any) {
                const toolName = tc.function?.name || 'unknown_tool';
                const failCount = (trace?.toolFailures[toolName] || 0) + 1;
                if (trace) {
                    trace.toolFailures[toolName] = failCount;
                    trace.toolCalls.push({ tool: toolName, argsKey: 'invalid_json', status: 'error', error: err?.message || 'Invalid JSON arguments' });
                    if (failCount >= 2) {
                        trace.stopReasons.push(`tool_failure_limit:${toolName}`);
                    }
                }
                results.push({
                    role: 'tool',
                    tool_call_id: tc.id,
                    content: `Error: ${err.message || 'Invalid tool arguments'}`
                });
                continue;
            }

            const toolName = tc.function.name;
            if (toolName === 'get_wallet_info') {
                const walletAddress = context?.walletAddress || context?.userAddress;
                if (walletAddress && !args.address) {
                    args.address = walletAddress;
                }
                if (context?.chainId && !args.chainId) {
                    args.chainId = context.chainId;
                }
            }
            const argsKey = this.buildToolKey(toolName, args);
            if (trace) {
                const argsCount = (trace.toolArgsCounts[argsKey] || 0) + 1;
                trace.toolArgsCounts[argsKey] = argsCount;
                if (argsCount > 1) {
                    trace.blockedKeys.add(argsKey);
                    trace.stopReasons.push(`tool_args_repeat:${toolName}`);
                }
                trace.toolCallCounts[toolName] = (trace.toolCallCounts[toolName] || 0) + 1;
                const totalCalls = Object.values(trace.toolCallCounts).reduce((sum, count) => sum + (count || 0), 0);
                if (totalCalls > this.maxToolCallsPerTask) {
                    trace.stopReasons.push(`tool_call_limit:total`);
                    trace.toolCalls.push({ tool: toolName, argsKey, status: 'blocked', error: 'Tool call limit reached' });
                    results.push({
                        role: 'tool',
                        tool_call_id: tc.id,
                        content: 'Tool call limit reached. Respond to the user without further tool calls.'
                    });
                    break;
                }
                if (trace.toolCallCounts[toolName] > this.maxToolCallsPerTool) {
                    trace.stopReasons.push(`tool_call_limit:${toolName}`);
                    trace.toolCalls.push({ tool: toolName, argsKey, status: 'blocked', error: 'Per-tool call limit reached' });
                    results.push({
                        role: 'tool',
                        tool_call_id: tc.id,
                        content: `Tool call limit reached for ${toolName}. Respond to the user without further tool calls.`
                    });
                    continue;
                }
            }

            if (trace?.blockedKeys.has(argsKey)) {
                trace.toolCalls.push({ tool: toolName, argsKey, status: 'blocked' });
                results.push({
                    role: 'tool',
                    tool_call_id: tc.id,
                    content: 'No further tool calls (duplicate tool+args)'
                });
                continue;
            }

            try {
                // Check cache first (Phase 5)
                const cacheKey = `${tc.function.name}:${this.stableStringify(args)}`;
                if (cache && cache.has(cacheKey)) {
                    logger.debug(LogCode.CACHE_HIT, 'ChatWorker: cache hit tool prefetch', { tool: tc.function.name });
                    const cachedResult = cache.get(cacheKey);
                    trace?.toolCalls.push({ tool: toolName, argsKey, status: 'cached' });
                    results.push({
                        role: 'tool',
                        tool_call_id: tc.id,
                        content: typeof cachedResult === 'string' ? cachedResult : JSON.stringify(cachedResult)
                    });
                    continue;
                }
                if (toolName === 'get_wallet_info' && cache) {
                    const fallbackKey = `get_wallet_info:${this.stableStringify({
                        address: context?.walletAddress || context?.userAddress,
                        chainId: context?.chainId,
                    })}`;
                    if (cache.has(fallbackKey)) {
                        logger.info(LogCode.AI_API_CALL, 'ChatWorker: get_wallet_info short-circuited to client context', {
                            chainId: context?.chainId,
                        });
                        const cachedResult = cache.get(fallbackKey);
                        trace?.toolCalls.push({ tool: toolName, argsKey, status: 'cached' });
                        results.push({
                            role: 'tool',
                            tool_call_id: tc.id,
                            content: typeof cachedResult === 'string' ? cachedResult : JSON.stringify(cachedResult),
                        });
                        continue;
                    }
                }
                if (toolName === 'get_wallet_info') {
                    const contextResult = this.buildWalletInfoFromContext({ toolContext: context } as AITask);
                    if (contextResult) {
                        logger.info(LogCode.AI_API_CALL, 'ChatWorker: get_wallet_info forced from client context', {
                            chainId: context?.chainId,
                            tokenCount: Array.isArray(contextResult.tokens) ? contextResult.tokens.length : 0,
                            hasNativeBalance: !!contextResult.ethBalance,
                        });
                        trace?.toolCalls.push({ tool: toolName, argsKey, status: 'cached' });
                        results.push({
                            role: 'tool',
                            tool_call_id: tc.id,
                            content: JSON.stringify(contextResult),
                        });
                        continue;
                    }
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


                const result = await toolRegistry.execute(tc.function.name, args, context);

                // CRITICAL: Check for _final flag - tool completed, AI should stop iterating
                if (result && typeof result === 'object' && result._final) {
                    logger.info(LogCode.AI_ORCHESTRATOR, 'Tool returned _final flag - swap execution complete', {
                        tool: tc.function.name,
                        success: result.success,
                        message: result.message
                    });

                    // 🚀 PERFORMANCE FIX: Immediately broadcast final result and card
                    const finalMessage = result.message || 'Transaction completed successfully';

                    // Broadcast final message FIRST
                    this.ws.broadcastToUser(userId!, {
                        type: 'chunk',
                        sessionId: sessionId,
                        data: {
                            index: execState ? execState.chunkIndex++ : 0,
                            type: 'content' as const,
                            content: finalMessage,
                            messageId: messageId
                        }
                    });

                    // Broadcast transaction card IMMEDIATELY if available
                    if (result.__transaction_card) {
                        this.ws.broadcastToUser(userId!, {
                            type: 'client_action',
                            sessionId: sessionId,
                            data: {
                                action: 'show_transaction_card',
                                payload: result.__transaction_card
                            }
                        });
                    }

                    // Add the result to tool results
                    results.push({
                        role: 'tool',
                        tool_call_id: tc.id,
                        content: finalMessage
                    });

                    // Mark in trace to stop iteration
                    if (trace) {
                        trace.stopReasons.push(`tool_final:${tc.function.name}`);
                        trace.toolCalls.push({
                            tool: toolName,
                            argsKey,
                            status: result.success ? 'success' : 'error'
                        });
                    }

                    if (execState) {
                        execState.totalContent = finalMessage;
                        execState.shouldContinue = false;
                    }

                    // CRITICAL PERFORMANCE FIX: Break immediately after processing all tools
                    // Mark that we need to exit after this tool batch completes
                    if (trace) {
                        trace.shouldExitImmediately = true;
                    }
                }

                // CRITICAL: Check for _must_stop flag - forces AI to respond immediately with error
                if (result && typeof result === 'object' && result._must_stop) {
                    logger.warn(LogCode.SYS_ERROR, 'Tool returned _must_stop flag - forcing immediate AI response', {
                        tool: tc.function.name,
                        error: result.error,
                        userMessage: result._user_message
                    });

                    // Add the error to tool results
                    results.push({
                        role: 'tool',
                        tool_call_id: tc.id,
                        content: result._user_message || result.error || JSON.stringify(result)
                    });

                    // Mark in trace to stop iteration
                    if (trace) {
                        trace.stopReasons.push(`tool_must_stop:${tc.function.name}`);
                        trace.toolCalls.push({ tool: toolName, argsKey, status: 'error' });
                    }

                    // Skip remaining tools in this batch
                    break;
                }

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
                }
                // NOTE: Do NOT create launchpad card from tool results
                // Token detector in preetch phase already handles launchpad card creation
                // This prevents duplicate cards

                if (clientAction) {
                    // Broadcast action to frontend IMMEDIATELY
                    if (sessionId && messageId) {
                        this.ws.broadcastToUser(userId!, {
                            type: 'client_action',
                            sessionId: sessionId,
                            data: {
                                message_id: messageId,
                                targetMessageId: messageId, // CRITICAL: Frontend reads this field
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

                } else if (tc.function.name === 'external_web_search' && result && typeof result === 'object' && result.citations) {
                    // Special handling for external web search - extract citations
                    allCitations.push(...result.citations);
                    // Only send the results text to the LLM, not the full object
                    const contentForLLM = typeof result.results === 'string' ? result.results : JSON.stringify(result.results);
                    results.push({
                        role: 'tool',
                        tool_call_id: tc.id,
                        content: contentForLLM
                    });
                } else {
                    const contentForLLM = typeof result === 'string' ? result : JSON.stringify(result);
                    results.push({
                        role: 'tool',
                        tool_call_id: tc.id,
                        content: contentForLLM
                    });
                }

                if (trace) {
                    const last = trace.lastResultByKey.get(argsKey);
                    const current = results[results.length - 1]?.content || '';
                    if (last === current) {
                        const repeats = (trace.toolRepeats[argsKey] || 0) + 1;
                        trace.toolRepeats[argsKey] = repeats;
                        if (repeats >= 2) {
                            trace.blockedKeys.add(argsKey);
                            trace.stopReasons.push(`tool_repeat_limit:${toolName}`);
                        }
                    } else {
                        trace.toolRepeats[argsKey] = 0;
                    }
                    trace.lastResultByKey.set(argsKey, current);
                    trace.toolCalls.push({ tool: toolName, argsKey, status: 'success' });
                }
            } catch (err: any) {
                const failCount = (trace?.toolFailures[toolName] || 0) + 1;
                if (trace) {
                    trace.toolFailures[toolName] = failCount;
                    trace.toolCalls.push({ tool: toolName, argsKey, status: 'error', error: err?.message || 'Tool execution failed' });
                    if (failCount >= 2) {
                        trace.blockedKeys.add(argsKey);
                        trace.stopReasons.push(`tool_failure_limit:${toolName}`);
                    }
                }
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
        let chunkIndex = 0;
        let launchpadCardShown = false; // Circuit breaker for duplicate launchpad cards
        let lastUsage: any = null;  // Track usage for DB persistence
        let allCitations: any[] = [];  // Track citations for DB persistence
        const citationUrlSet = new Set<string>();
        let lastDbSave = 0; // Periodic DB sync to prevent data loss on refresh
        const toolTrace: ToolTraceState = {
            mode: 'thinking',
            skillVersion: 'clean',
            toolCalls: [],
            toolCallCounts: {},
            toolArgsCounts: {},
            toolFailures: {},
            toolRepeats: {},
            stopReasons: [],
            blockedKeys: new Set(),
            lastResultByKey: new Map(),
        };

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
        logger.info(LogCode.AI_API_CALL, 'Grok: message_start sent', { assistantMessageId, taskId: task.id });

        // Parse intent from user message
        this.ws.broadcastToUser(userId!, {
            type: 'task_status',
            sessionId: task.sessionId,
            data: { status: 'running', message: 'Checking wallet' }
        });
        const lastUserMessage = history.filter(m => m.role === 'user').pop()?.content || '';
        const baseToolDefs = getFilteredTools(lastUserMessage);
        let toolDefinitions = baseToolDefs.map(def => ({ type: 'function', function: def }));
        logger.debug(LogCode.AI_TOOL_FILTERED, 'Grok: base tool list prepared', { count: toolDefinitions.length });
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
        const routingMode = this.resolveRoutingMode(intent, parsedIntent.decision);
        const isFreeIntent = routingMode === 'thinking';
        toolTrace.mode = routingMode;
        toolTrace.skillVersion = routingMode === 'thinking' ? 'clean' : 'exec';
        const decisionMeta = parsedIntent.decision as any;
        logger.info(LogCode.AI_MODE_ROUTED, 'Grok: routed to mode', {
            taskId: task.id,
            sessionId: task.sessionId,
            model: task.model,
            intent,
            routingMode,
            routingStage: decisionMeta?.routingStage,
            hardRule: decisionMeta?.hardRule,
            slotsComplete: decisionMeta?.slotsComplete,
            confidence: parsedIntent.highLevel?.confidence,
        });

        // Skills-level tool gating (single source of truth: `skill.json` -> metadata.tools).
        const intentStr = String(intent).toUpperCase();
        const registry = isFreeIntent ? skillRegistryClean : skillRegistryExec;
        const matchedSkills = isFreeIntent
            ? registry.getAllSkills().filter(s => THINKING_SKILL_ID_ALLOWLIST.has(s.metadata.id))
            : registry.getSkillsByIntent(intentStr);
        const allowedToolNames = new Set<string>();
        for (const skill of matchedSkills) {
            for (const name of skill.metadata.tools || []) {
                allowedToolNames.add(name);
            }
        }
        // Always keep `external_web_search` as a safe fallback (consistent with ToolPreRouter).
        allowedToolNames.add('external_web_search');

        if (matchedSkills.length > 0 && allowedToolNames.size > 0) {
            const gated = baseToolDefs.filter(def => allowedToolNames.has(def.name));
            if (gated.length > 0) {
                toolDefinitions = gated.map(def => ({ type: 'function', function: def }));
                logger.throttled(LogCode.AI_TOOL_FILTERED, 'Grok: tool list gated by skills', {
                    count: toolDefinitions.length,
                    intent: intentStr,
                    skills: matchedSkills.map(s => s.metadata.id),
                    routingMode,
                    skillVersion: isFreeIntent ? 'clean' : 'exec',
                });
                logger.info(LogCode.AI_SKILLS_ATTACHED, 'Grok: skills attached', {
                    taskId: task.id,
                    sessionId: task.sessionId,
                    model: task.model,
                    intent: intentStr,
                    routingMode,
                    skillVersion: isFreeIntent ? 'clean' : 'exec',
                    skills: matchedSkills.map(s => s.metadata.id),
                    toolCount: toolDefinitions.length,
                });
            } else {
                logger.warn(LogCode.AI_TOOL_FILTERED, 'Grok: skill gating produced 0 tools; fallback to base', { intent: intentStr });
            }
        } else if (isFreeIntent) {
            const allToolDefs = toolRegistry.getAllDefinitions();
            const filtered = allToolDefs.filter(def => THINKING_TOOL_ALLOWLIST.has(def.name));
            toolDefinitions = filtered.map(def => ({ type: 'function', function: def }));
            logger.debug(LogCode.AI_TOOL_FILTERED, 'Grok: free intent mode uses thinking tools', {
                count: toolDefinitions.length,
                routingMode,
                skillVersion: 'clean',
            });
            logger.info(LogCode.AI_SKILLS_ATTACHED, 'Grok: thinking mode without skills injection', {
                taskId: task.id,
                sessionId: task.sessionId,
                model: task.model,
                intent: intentStr,
                routingMode,
                skillVersion: 'clean',
                toolCount: toolDefinitions.length,
            });
        }
        if (!isFreeIntent) {
            toolDefinitions = toolDefinitions.filter(def => def.function?.name !== 'external_web_search');
        }

        // Log detailed intent for debugging

        // Phase 5 Cache: Shared across this task
        const toolResultsCache = new Map<string, any>();
        this.seedToolCacheFromContext(toolResultsCache, task);
        let earlyPreFetchPromise: Promise<void> | null = null;

        // 🚀 PRE-EMPTIVE TOOL EXECUTION (Phase 5: Intent-based)
        earlyPreFetchPromise = this.preFetchByIntent(task, parsedIntent, toolResultsCache).catch(err => {
            logger.warn(LogCode.AI_API_CALL, 'Grok: early pre-fetch failed', { error: err?.message || err });
        });

        const systemPrompt = promptOrchestrator.getSystemPrompt('grok', intent, { routingMode });

        // Detect and resolve contract address if present (same as DeepSeek)
        let detectedChainId = task.toolContext?.chainId;
        let detectedChainName: string | undefined = this.resolveChainNameForContext(detectedChainId);
        let tokenInfo: any = null;
        let xSeedHandles: string[] = [];
        let officialSites: string[] = [];

        if (parsedIntent.contractAddress) {
            this.ws.broadcastToUser(userId!, {
                type: 'task_status',
                sessionId: task.sessionId,
                data: { status: 'running', message: 'Scanning tokens' }
            });

            logger.info(LogCode.AI_TOKEN_DETECTED, 'Grok: contract address detected', { contractAddress: parsedIntent.contractAddress });
            const globalTokenInfo = await findTokenOnAnyChain(parsedIntent.contractAddress);
            if (globalTokenInfo) {
                detectedChainId = globalTokenInfo.chainId;
                detectedChainName = globalTokenInfo.chainName;
                tokenInfo = globalTokenInfo;

                // Log launchpad info if detected
                if (globalTokenInfo.launchpad && !launchpadCardShown) {
                    launchpadCardShown = true; // Mark as shown to prevent duplicates
                    logger.info(LogCode.AI_LAUNCHPAD_DETECTED, 'Grok: launchpad token detected', { provider: globalTokenInfo.launchpad.provider });

                    // AUTO-TRIGGER CARD: If it's a launchpad token, show card immediately
                    this.ws.broadcastToUser(userId!, {
                        type: 'client_action',
                        sessionId: task.sessionId,
                        data: {
                            message_id: assistantMessageId,
                            targetMessageId: assistantMessageId,
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

            // Extract official socials/websites for execution mode only.
            if (!isFreeIntent) {
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
        }

        // Fallback: resolve chain name if token detection didn't provide a human name
        if (!detectedChainName && detectedChainId) {
            detectedChainName = this.resolveChainNameForContext(detectedChainId) || 'Unknown Chain';
        }

        const userContext = this.buildUserContext(
            task,
            { chainId: detectedChainId || task.toolContext?.chainId, chainName: detectedChainName },
            parsedIntent
        );

        // Wait for early pre-fetch to complete before building enrichment
        if (earlyPreFetchPromise) {
            logger.debug(LogCode.AI_API_CALL, 'Grok: waiting for early pre-fetch');
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
        let tokenContextAvailable = false;
        let launchpadContextAvailable = false;

        if (lastUserIndex !== -1) {
            const lastMsg = enrichedHistory[lastUserIndex];

            // Add token info to context if detected
            let tokenContextBlock = '';

            // Check cache for token info if not already detected
            if (!tokenInfo) {
                const tokenKey = `get_token_info:${this.stableStringify({
                    address: parsedIntent.contractAddress || parsedIntent.detailed.token_address,
                    chainId: parsedIntent.chainId || task.toolContext?.chainId
                })}`;
                if (toolResultsCache.has(tokenKey)) {
                    tokenInfo = toolResultsCache.get(tokenKey);
                    logger.throttled(LogCode.CACHE_HIT, 'Grok: cache hit token_info');
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
                tokenContextAvailable = true;
            } else if (parsedIntent?.contractAddress) {
                tokenContextBlock = `\n\n[TOKEN_CONTEXT]
Token metadata unavailable for ${parsedIntent.contractAddress}.
Rule: Do not repeatedly query metadata in this turn; proceed with best-effort info.`;
            }
            let launchpadContextBlock = '';
            if (!tokenInfo) {
                const launchpadCacheKey = `launchpad_info:${this.stableStringify({
                    address: parsedIntent.contractAddress || parsedIntent.detailed.token_address,
                    chainId: parsedIntent.chainId || task.toolContext?.chainId
                })}`;
                if (toolResultsCache.has(launchpadCacheKey)) {
                    const cachedLaunchpad = toolResultsCache.get(launchpadCacheKey);
                    launchpadContextBlock = `\n\n[LAUNCHPAD_CONTEXT]
Token is a launchpad token.
Provider: ${cachedLaunchpad.provider?.toUpperCase?.() || cachedLaunchpad.provider}
Chain: ${cachedLaunchpad.chainId || task.toolContext?.chainId}
Address: ${cachedLaunchpad.address || parsedIntent.contractAddress}
Rule: Skip check_token_risk for launchpad tokens. Do NOT run active security scans.`;
                    launchpadContextAvailable = true;
                }
            }
            if (tokenInfo?.launchpad) {
                launchpadContextBlock = `\n\n[LAUNCHPAD_CONTEXT]
Token is a launchpad token.
Provider: ${tokenInfo.launchpad.provider?.toUpperCase?.() || tokenInfo.launchpad.provider}
Chain: ${tokenInfo.chainId}
Address: ${tokenInfo.address}
Rule: Skip check_token_risk for launchpad tokens. Do NOT run active security scans.`;
                launchpadContextAvailable = true;
            }

            if (task.toolContext?.walletAddress) {
                const chainId = task.toolContext?.chainId;
                const chainName = chainId ? (CHAIN_ID_MAP[chainId] || 'Unknown Chain') : 'Unknown Chain';
                tokenContextBlock += `\n\n[USER_WALLET_CONTEXT]
Wallet Address: ${task.toolContext.walletAddress}
Chain: ${chainName}${chainId ? ` (${chainId})` : ''}
`;
            }

            // Add balance info if pre-fetched (TRADING intent stability)
            const balanceKey = `get_wallet_info:${this.stableStringify({
                address: task.toolContext?.walletAddress,
                chainId: task.toolContext?.chainId
            })}`;
            if (toolResultsCache.has(balanceKey)) {
                const balanceData = toolResultsCache.get(balanceKey);
                if (balanceData) {
                    // CRITICAL FIX: Show symbol, balance AND contract address
                    const portfolioLines = balanceData.tokens ? balanceData.tokens.map((t: any) => {
                        const symbol = t.symbol || 'Unknown';
                        const balance = t.balance || '0';
                        const contract = t.contractAddress || t.contract;
                        const contractInfo = contract && !contract.startsWith('0x0000000000000000000000000000000000000000')
                            ? ` (${contract})`
                            : '';
                        return `- ${symbol}: ${balance}${contractInfo}`;
                    }).join('\n') : '';

                    tokenContextBlock += `\n\n[USER_BALANCE_CONTEXT]
User Wallet: ${task.toolContext?.walletAddress}
Chain: ${task.toolContext?.chainId || 'Unknown'}
Native Balance: ${balanceData.ethBalance || 'Unknown'}
${portfolioLines ? `\nToken Holdings:\n${portfolioLines}` : '\nNo tokens found.'}

CRITICAL: When user says "sell all 0xABC..." or "sell SYMBOL", extract the balance from above and use it as amount_in (NOT "all").
`;
                }
            } else if (task.toolContext?.walletAddress) {
                tokenContextBlock += `\n\n[USER_BALANCE_CONTEXT]
User Wallet: ${task.toolContext?.walletAddress}
Status: unavailable (balance data not available from cache).`;
            }


            // Do not inject balance context; let the model request wallet data via tools.
            const enrichedContent = this.buildEnrichedUserContent({
                userQuery: lastMsg.content,
                userContext,
                intent,
                extraBlocks: [tokenContextBlock, launchpadContextBlock].filter(Boolean),
            });
            enrichedHistory = this.injectEnrichedUserContent(enrichedHistory, lastUserIndex, enrichedContent);
        }

        if (tokenContextAvailable) {
            const beforeCount = toolDefinitions.length;
            toolDefinitions = toolDefinitions.filter(def => def.function?.name !== 'get_token_info');
            if (toolDefinitions.length !== beforeCount) {
                logger.info(LogCode.AI_API_CALL, 'Grok: removed get_token_info tool (token context present)', {
                    before: beforeCount,
                    after: toolDefinitions.length,
                });
            }
        }
        if (launchpadContextAvailable) {
            const beforeCount = toolDefinitions.length;
            toolDefinitions = toolDefinitions.filter(def => def.function?.name !== 'check_token_risk');
            if (toolDefinitions.length !== beforeCount) {
                logger.info(LogCode.AI_API_CALL, 'Grok: removed check_token_risk tool (launchpad context present)', {
                    before: beforeCount,
                    after: toolDefinitions.length,
                });
            }
        }

        const grokMessages = [
            { role: 'system', content: systemPrompt },
        ];
        const grokSystemContext = this.buildSystemContextMessage(task);
        if (grokSystemContext) {
            grokMessages.push({ role: 'system', content: grokSystemContext });
            console.log('[ChatWorker] Added client context to Grok system prompt');
        }
        grokMessages.push(...enrichedHistory);

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
        const previousResponseId = this.grokResponseIdBySession.get(task.sessionId);
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
                ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
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
        let newResponseId: string | null = null;

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
                if (!line.startsWith('data: ') || line.trim() === 'data: [DONE]') continue;

                try {
                    const data = JSON.parse(line.slice(6));
                    const delta = data.choices?.[0]?.delta;
                    if (data.response_id && typeof data.response_id === 'string') {
                        newResponseId = data.response_id;
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

                    // Collect citations (from grok-service web_search results)
                    const choice = data.choices?.[0];
                    if (choice?.message?.citations && Array.isArray(choice.message.citations)) {
                        const newCitations: any[] = [];
                        for (const cite of choice.message.citations) {
                            const url = typeof cite === 'string'
                                ? cite
                                : (cite && typeof cite === 'object' && 'url' in cite ? String((cite as any).url) : '');
                            const key = url || JSON.stringify(cite);
                            // Skip duplicates
                            if (key && !citationUrlSet.has(key)) {
                                citationUrlSet.add(key);
                                allCitations.push(cite);
                                newCitations.push(cite);
                            }
                        }
                        // Broadcast new citations immediately to frontend (like DeepSeek)
                        if (newCitations.length > 0) {
                            logger.info(LogCode.SYS_INFO, `[chatWorker] Broadcasting citations: msgId=${assistantMessageId}, count=${newCitations.length}, sample=${JSON.stringify(newCitations[0])}`);
                            this.ws.broadcastToUser(userId!, {
                                type: 'citations',
                                sessionId: task.sessionId,
                                data: {
                                    message_id: assistantMessageId,
                                    citations: newCitations
                                }
                            });
                        }
                    }


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
                        lastDbSave = this.persistStreamingMessageThrottled(
                            assistantMessageId,
                            fullContent,
                            '',
                            lastDbSave,
                            1000
                        );
                    }

                    // Handle client_actions from grok-service (swap actions, UI triggers)
                    if (delta && delta.client_actions && Array.isArray(delta.client_actions)) {
                        for (const action of delta.client_actions) {
                            logger.info(LogCode.WS_MESSAGE_SENT, 'Grok: broadcast client_action', { action: action.type });
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

                } catch (e) { }
            }
        }

        // Broadcast citations once at the end to avoid flooding the stream
        if (allCitations.length > 0) {
            this.ws.broadcastToUser(userId!, {
                type: 'citations',
                sessionId: task.sessionId,
                data: {
                    message_id: assistantMessageId,
                    citations: allCitations
                }
            });
        }

        // Final output moderation
        const modResult = await moderationClient.moderateOutput(fullContent, userId, task.sessionId, task.model);
        if (!modResult.safe) {
            fullContent = modResult.filtered_text || '[Content removed for safety]';
        }
        fullContent = this.redactToolNames(fullContent);

        // Final message update with safeguard
        try {
            await this.repo.updateMessage(assistantMessageId, {
                content: fullContent,
                usage: lastUsage || undefined,
                citations: allCitations.length > 0 ? allCitations : undefined,
                status: 'complete'
            });
        } catch (dbErr) {
            logger.error(LogCode.DB_TRANSACTION_FAILED, 'Grok: failed to save final message', { assistantMessageId, error: (dbErr as any)?.message || dbErr });
        }

        try {
            const existing = await this.repo.getMessage(assistantMessageId);
            const existingData = existing?.data || {};
            const toolTracePayload = {
                mode: toolTrace.mode,
                skillVersion: toolTrace.skillVersion,
                toolCalls: toolTrace.toolCalls,
                toolCallCounts: toolTrace.toolCallCounts,
                toolFailures: toolTrace.toolFailures,
                toolRepeats: toolTrace.toolRepeats,
                stopReasons: Array.from(new Set(toolTrace.stopReasons)),
            };
            await this.repo.updateMessage(assistantMessageId, {
                data: {
                    ...existingData,
                    toolTrace: toolTracePayload,
                }
            });
        } catch (traceErr: any) {
            logger.warn(LogCode.DB_TRANSACTION_FAILED, 'Grok: failed to persist tool trace', { error: traceErr?.message || traceErr });
        }

        if (newResponseId) {
            this.grokResponseIdBySession.set(task.sessionId, newResponseId);
        }

        logger.throttled(LogCode.AI_API_CALL, 'Grok: task completed', { taskId: task.id, chunks: chunkIndex });
    }
}

export const chatWorker = new ChatWorker();
