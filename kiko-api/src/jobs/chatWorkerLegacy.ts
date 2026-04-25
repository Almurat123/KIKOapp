/**
 * Chat Worker
 * Background job to process AI tasks independently of the frontend lifecycle.
 * Writes chunks to database for persistence and recovery.
 */

import * as chatRepo from '../repositories/chatRepository.js';
import { AITask } from '../repositories/chatRepository.js';
import { toolRegistry } from '../tooling/index.js';
import { moderationClient } from '../services/moderationClient.js';
import { searchWeb } from '../services/searchService.js';
import { chatWS } from '../services/chatWebSocket.js';
import { getTrendingCasts } from '../repositories/socialRepository.js';
import * as alchemy from '../services/alchemy.js';
import * as privyWallet from '../services/privyWallet.js';
import { scrub } from '../utils/scrubber.js';
import { computeTotalTokens, computeUsdCost, getBillingCategory, getUtcDateString } from '../services/billing/billingService.js';
import { recordUsage } from '../services/usageCounter.js';
import { buildSignedHeaders } from '../utils/requestSigningClient.js';
import { fetchJson } from '../config/unifiedApiService.js';
import { insertUsageRecord } from '../repositories/billingRepository.js';
import { promptOrchestrator } from '../services/ai/PromptOrchestrator.js';
import type { IntentType, UserContext } from '../services/ai/types.js';
import { parseIntent, detectContractAddress } from '../services/ai/intentParser.js';
import { findTokenOnAnyChain, getTokenInfo } from '../services/ai/tokenDetector.js';
import { contextBudgetManager } from '../services/ai/contextBudgetManager.js';
import { modelGateway, type ConversationStateRef, type Provider } from '../services/ai/modelGateway.js';
import { getTokenDetails as getDexTokenDetails } from '../services/dexscreener.js';
import { getCoinbaseSpotPrice } from '../services/coinbase.js';
import { skillRegistryExec } from '../skills/registry.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { getChainConfig } from '../config/chainConfig.js';
import { normalizeTokenAddress, resolveTokenAddress } from '../services/tokens.js';
import { processClaimedTasks } from './chat/taskClaimRunner.js';
import { buildBalanceContextBlock } from './chat/balanceContextBuilder.js';
import { buildLaunchpadContextBlock, buildTokenContextBlock } from './chat/contextBlockBuilder.js';
import { getFastSwapDecision, prepareFastSwapExecution } from './chat/fastSwapExecutor.js';
import { inferSwapCardType } from '../services/swap/swapCardType.js';
import cacheClient from '../cache/cacheClient.js';

// Constants
const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';
const OPENAI_API_URL = process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions';
const GROK_SERVICE_URL = process.env.GROK_SERVICE_URL || 'http://localhost:8001';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GROK_PREFER_SDK_GATEWAY = !['0', 'false', 'no', 'off']
    .includes(String(process.env.GROK_PREFER_SDK_GATEWAY || 'true').toLowerCase());
const GROK_ENABLE_PREVIOUS_RESPONSE = ['1', 'true', 'yes', 'on']
    .includes(String(process.env.GROK_ENABLE_PREVIOUS_RESPONSE || 'false').toLowerCase());
const CHAT_ORCHESTRATOR_MODE = (process.env.CHAT_ORCHESTRATOR_MODE || 'unified').toLowerCase();
const CHAT_CONTEXT_RECENT_WINDOW = Math.max(4, parseInt(process.env.CHAT_CONTEXT_RECENT_WINDOW || '12', 10) || 12);
const CHAT_CONTEXT_MAX_INPUT_TOKENS = Math.max(2048, parseInt(process.env.CHAT_CONTEXT_MAX_INPUT_TOKENS || '16000', 10) || 16000);
const CHAT_CONTEXT_RESERVED_OUTPUT_TOKENS = Math.max(512, parseInt(process.env.CHAT_CONTEXT_RESERVED_OUTPUT_TOKENS || '3500', 10) || 3500);

function normalizeModel(model?: string): string {
    const normalized = (model || '').toLowerCase().trim();
    if (!normalized) return 'deepseek-chat';
    return normalized;
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

// xAI provider-managed built-in search tools (should not be executed via toolRegistry).
const GROK_PROVIDER_MANAGED_SEARCH_TOOL_NAMES = new Set<string>([
    'live_search',
]);

const GROK_ENABLE_PROVIDER_SEARCH_TOOLS = ['1', 'true', 'yes', 'on']
    .includes(String(process.env.GROK_ENABLE_PROVIDER_SEARCH_TOOLS || '').toLowerCase());

const EXECUTION_INTENTS = new Set<IntentType>([
    'TRADING',
    'COPY_TRADING',
]);

// System Prompts (Unified Orchestrator)
type ToolTraceEntry = {
    tool: string;
    argsKey: string;
    status: 'success' | 'cached' | 'blocked' | 'error';
    error?: string;
};

type ToolTraceState = {
    mode: 'execution';
    skillVersion: 'exec';
    toolCalls: ToolTraceEntry[];
    toolCallCounts: Record<string, number>;
    toolArgsCounts: Record<string, number>;
    shouldExitImmediately?: boolean;
    toolFailures: Record<string, number>;
    toolRepeats: Record<string, number>;
    lastToolName?: string;
    consecutiveToolCalls: number;
    polymarketSearchNoMatchStreak: number;
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
    private readonly maxToolCallsPerTask = Math.max(1, parseInt(process.env.CHAT_WORKER_MAX_TOOL_CALLS || '24', 10) || 24);
    private readonly maxToolCallsPerTool = Math.max(1, parseInt(process.env.CHAT_WORKER_MAX_TOOL_CALLS_PER_TOOL || '6', 10) || 6);
    private readonly maxConsecutiveToolCallsPerTool = Math.max(1, parseInt(process.env.CHAT_WORKER_MAX_CONSECUTIVE_TOOL_CALLS_PER_TOOL || '6', 10) || 6);
    private runningTasks = new Set<string>();

    private buildToolKey(name: string, args: any): string {
        return `${name}:${this.stableStringify(args)}`;
    }

    private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string, fallback: T): Promise<T> {
        let timer: NodeJS.Timeout | null = null;
        try {
            const timeoutPromise = new Promise<T>((resolve) => {
                timer = setTimeout(() => {
                    logger.warn(LogCode.AI_API_CALL, 'ChatWorker: timed out non-critical step', { label, timeoutMs });
                    resolve(fallback);
                }, timeoutMs);
            });
            return await Promise.race([promise, timeoutPromise]);
        } catch (err: any) {
            logger.warn(LogCode.AI_API_CALL, 'ChatWorker: non-critical step failed', {
                label,
                error: err?.message || String(err),
            });
            return fallback;
        } finally {
            if (timer) clearTimeout(timer);
        }
    }

    private async resolveTokenContext(params: {
        mode: 'deepseek' | 'grok';
        task: AITask;
        parsedIntent: any;
        toolResultsCache: Map<string, any>;
        userId?: string | null;
        detectedChainId?: number;
        detectedLaunchpadInfo?: { chainId: number; provider: string; data: any; address: string } | null;
        broadcastScanningStatus?: boolean;
    }): Promise<{
        detectedChainId?: number;
        detectedChainName?: string;
        tokenInfo: any;
        detectedLaunchpadInfo: { chainId: number; provider: string; data: any; address: string } | null;
    }> {
        let detectedChainId = params.detectedChainId ?? params.task.toolContext?.chainId;
        let detectedChainName: string | undefined = detectedChainId
            ? this.resolveChainNameForContext(detectedChainId)
            : undefined;
        let tokenInfo: any = null;
        let detectedLaunchpadInfo = params.detectedLaunchpadInfo || null;

        const contractAddress = params.parsedIntent?.contractAddress;
        if (!contractAddress) {
            return { detectedChainId, detectedChainName, tokenInfo, detectedLaunchpadInfo };
        }

        const tokenKey = `get_token_info:${this.stableStringify({
            address: contractAddress,
            chainId: detectedChainId || params.task.toolContext?.chainId
        })}`;

        if (params.toolResultsCache.has(tokenKey)) {
            tokenInfo = params.toolResultsCache.get(tokenKey);
            logger.throttled(LogCode.CACHE_HIT, `${params.mode}: cache hit token_info`);
            if (tokenInfo && !tokenInfo.address) {
                tokenInfo.address = contractAddress;
                params.toolResultsCache.set(tokenKey, tokenInfo);
            }
        }

        if (!tokenInfo) {
            if (params.broadcastScanningStatus && params.task.sessionId) {
                this.broadcastTaskStatus(params.userId || null, params.task, { status: 'running', message: 'Scanning tokens' });
            }
            const globalTokenInfo = await this.withTimeout(
                findTokenOnAnyChain(contractAddress),
                Math.max(250, parseInt(process.env.CHAT_TOKEN_DETECT_TIMEOUT_MS || '700', 10) || 700),
                `${params.mode}_find_token_on_any_chain`,
                null
            );
            if (globalTokenInfo) {
                detectedChainId = globalTokenInfo.chainId;
                detectedChainName = globalTokenInfo.chainName;
                tokenInfo = globalTokenInfo;
            } else if (detectedChainId) {
                const specificTokenInfo = await this.withTimeout(
                    getTokenInfo(contractAddress, detectedChainId),
                    Math.max(250, parseInt(process.env.CHAT_TOKEN_DETECT_TIMEOUT_MS || '700', 10) || 700),
                    `${params.mode}_get_token_info_fallback`,
                    null
                );
                if (specificTokenInfo) {
                    tokenInfo = specificTokenInfo;
                    detectedChainName = specificTokenInfo.chainName;
                }
            }
        }

        const launchpadCacheKey = `launchpad_info:${this.stableStringify({
            address: contractAddress,
            chainId: detectedChainId || params.task.toolContext?.chainId
        })}`;
        if (!detectedLaunchpadInfo && params.toolResultsCache.has(launchpadCacheKey)) {
            detectedLaunchpadInfo = params.toolResultsCache.get(launchpadCacheKey);
        }
        if (tokenInfo?.launchpad && !detectedLaunchpadInfo) {
            detectedLaunchpadInfo = {
                chainId: tokenInfo.chainId,
                provider: tokenInfo.launchpad.provider,
                data: tokenInfo.launchpad.data,
                address: tokenInfo.address
            };
        }

        return { detectedChainId, detectedChainName, tokenInfo, detectedLaunchpadInfo };
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

    private normalizeCitations(raw: any): Array<{ url: string; avatar_url?: string; title?: string; snippet?: string }> {
        if (raw === null || raw === undefined) return [];
        const queue: any[] = Array.isArray(raw) ? [...raw] : [raw];
        const normalized: Array<{ url: string; avatar_url?: string; title?: string; snippet?: string }> = [];

        while (queue.length > 0) {
            const item = queue.shift();
            if (item === null || item === undefined) continue;

            if (Array.isArray(item)) {
                queue.push(...item);
                continue;
            }

            if (typeof item === 'string') {
                const value = item.trim();
                if (!value) continue;
                if ((value.startsWith('[') && value.endsWith(']')) || (value.startsWith('{') && value.endsWith('}'))) {
                    try {
                        const parsed = JSON.parse(value.replace(/'/g, '"'));
                        queue.push(parsed);
                        continue;
                    } catch {
                        // Not JSON, treat as URL string.
                    }
                }
                normalized.push({ url: value });
                continue;
            }

            if (typeof item === 'object') {
                const citationObj = item as Record<string, any>;
                const urlRaw = citationObj.url || citationObj.uri || citationObj.href || citationObj.link;
                if (!urlRaw) {
                    if (Array.isArray(citationObj.urls)) queue.push(...citationObj.urls);
                    continue;
                }
                const url = String(urlRaw).trim();
                if (!url) continue;

                const entry: { url: string; avatar_url?: string; title?: string; snippet?: string } = { url };
                const avatarRaw = citationObj.avatar_url || citationObj.avatarUrl || citationObj.avatar;
                if (avatarRaw) {
                    const avatar = String(avatarRaw).trim();
                    if (avatar) entry.avatar_url = avatar;
                }
                if (citationObj.title) {
                    const title = String(citationObj.title).trim();
                    if (title) entry.title = title;
                }
                const snippetRaw = citationObj.snippet || citationObj.description || citationObj.content;
                if (snippetRaw) {
                    const snippet = String(snippetRaw).trim();
                    if (snippet) entry.snippet = snippet;
                }
                normalized.push(entry);
            }
        }

        return normalized;
    }

    private appendUniqueCitations(
        allCitations: any[],
        citationUrlSet: Set<string>,
        raw: any
    ): any[] {
        const incoming = this.normalizeCitations(raw);
        if (incoming.length === 0) return [];

        const appended: any[] = [];
        for (const citation of incoming) {
            const key = String(citation.url || '').trim();
            if (!key) continue;
            if (citationUrlSet.has(key)) continue;
            citationUrlSet.add(key);
            appended.push(citation);
            allCitations.push(citation);
        }
        return appended;
    }

    private isGrokProviderManagedSearchTool(toolName: unknown): boolean {
        const normalized = String(toolName || '').trim().toLowerCase();
        return normalized.length > 0 && GROK_PROVIDER_MANAGED_SEARCH_TOOL_NAMES.has(normalized);
    }

    private parseCopyTradeRequestFromText(text: string): {
        target_wallet?: string;
        buy_amount_usd?: number;
        chain_id?: number;
        mirror_sell?: boolean;
        take_profit_pct?: number;
        stop_loss_pct?: number;
    } | null {
        const raw = String(text || '');
        if (!raw) return null;
        const lower = raw.toLowerCase();
        const hasCopyTradeSignal =
            /\bcopy[\s-]*trade|copy[\s-]*trading|copytrade|copy trader|follow this trader|copy strategy\b/i.test(lower)
            || /\bcopy\b.*\bwallet\b/i.test(lower);
        if (!hasCopyTradeSignal) return null;

        const walletMatch = raw.match(/0x[a-fA-F0-9]{40}/);
        if (!walletMatch) return null;

        const parsed: {
            target_wallet?: string;
            buy_amount_usd?: number;
            chain_id?: number;
            mirror_sell?: boolean;
            take_profit_pct?: number;
            stop_loss_pct?: number;
        } = {
            target_wallet: walletMatch[0],
        };

        const amountPatterns = [
            /\$\s*([0-9]+(?:\.[0-9]+)?)\s*(?:per\s*trade|each\s*trade)/i,
            /with\s*\$\s*([0-9]+(?:\.[0-9]+)?)/i,
            /\b([0-9]+(?:\.[0-9]+)?)\s*usd\s*(?:per\s*trade|each\s*trade)?/i,
        ];
        for (const pattern of amountPatterns) {
            const m = raw.match(pattern);
            if (m) {
                parsed.buy_amount_usd = Number(m[1]);
                break;
            }
        }

        if (/\bbase\b/i.test(raw)) parsed.chain_id = 8453;
        else if (/\b(bnb|bsc)\b/i.test(raw)) parsed.chain_id = 56;
        else if (/\bsolana\b|\bsol\b/i.test(raw)) parsed.chain_id = 900;

        const autoSell = raw.match(/auto\s*sell\s*[:=]?\s*(yes|no|true|false|on|off)/i);
        if (autoSell) {
            parsed.mirror_sell = ['yes', 'true', 'on'].includes(autoSell[1].toLowerCase());
        }

        const tpMatch = raw.match(/(?:\bTP\b|take\s*profit)\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)\s*%/i);
        if (tpMatch) parsed.take_profit_pct = Number(tpMatch[1]);
        const slMatch = raw.match(/(?:\bSL\b|stop\s*loss)\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)\s*%/i);
        if (slMatch) parsed.stop_loss_pct = Number(slMatch[1]);

        return parsed;
    }

    private findRecentCopyTradeSetup(sessionMessages: any[]): {
        target_wallet?: string;
        buy_amount_usd?: number;
        chain_id?: number;
        mirror_sell?: boolean;
        take_profit_pct?: number;
        stop_loss_pct?: number;
    } | null {
        const sorted = [...(sessionMessages || [])]
            .sort((a, b) => (a.message_index || a.messageIndex || 0) - (b.message_index || b.messageIndex || 0));
        for (let i = sorted.length - 1; i >= 0; i -= 1) {
            const msg = sorted[i];
            if (msg.role !== 'user') continue;
            const parsed = this.parseCopyTradeRequestFromText(String(msg.content || ''));
            if (parsed?.target_wallet && Number.isFinite(parsed.buy_amount_usd || NaN)) {
                return parsed;
            }
        }
        return null;
    }

    private isChainStatusQuery(message: string): boolean {
        const text = String(message || '').trim().toLowerCase();
        if (!text) return false;
        const patterns = [
            /我在什么链/,
            /我在哪条链/,
            /当前.*链/,
            /什么网络/,
            /which\s+chain\s+am\s+i\s+on/,
            /what\s+chain\s+am\s+i\s+on/,
            /current\s+chain/,
            /current\s+network/,
        ];
        return patterns.some((p) => p.test(text));
    }

    private parseArgsFromKey(argsKey: string): { name: string; args: any } | null {
        const idx = argsKey.indexOf(':');
        if (idx <= 0) return null;
        const name = argsKey.slice(0, idx);
        const raw = argsKey.slice(idx + 1);
        try {
            return { name, args: JSON.parse(raw) };
        } catch {
            return null;
        }
    }

    private findRecentSimulateSwap(
        sessionMessages: any[],
        windowMs: number
    ): { token_in: string; token_out: string; amount_in: string; chain_id: number; isCrossChain: boolean; toChain?: number; simulatedAtMs?: number } | null {
        const sorted = [...sessionMessages].sort((a, b) => (a.message_index || a.messageIndex || 0) - (b.message_index || b.messageIndex || 0));
        const now = Date.now();
        for (let i = sorted.length - 1; i >= 0; i -= 1) {
            const msg = sorted[i];
            if (msg.role !== 'assistant') continue;
            const toolCalls = msg.data?.toolTrace?.toolCalls || [];
            const createdAt = msg.created_at || msg.createdAt || msg.created || msg.createdAtMs;
            const createdMs = createdAt ? new Date(createdAt).getTime() : null;
            if (createdMs && now - createdMs > windowMs) continue;
            for (let j = toolCalls.length - 1; j >= 0; j -= 1) {
                const entry = toolCalls[j];
                // CRITICAL FIX: Support both simulate_swap and get_cross_chain_quote
                // This allows "Proceed" to work for both single-chain and cross-chain swaps
                if ((entry.tool !== 'simulate_swap' && entry.tool !== 'get_cross_chain_quote') || entry.status !== 'success') continue;
                const parsed = this.parseArgsFromKey(entry.argsKey || '');
                if (!parsed?.args) continue;

                // Handle different parameter formats:
                // - simulate_swap uses: token_in, token_out, amount_in, chain_id
                // - get_cross_chain_quote uses: fromToken, toToken, fromAmount, fromChain, toChain
                let token_in: string | undefined;
                let token_out: string | undefined;
                let amount_in: string | undefined;
                let chain_id: number | undefined;
                let isCrossChain = false;
                let toChain: number | undefined;

                if (entry.tool === 'simulate_swap') {
                    // Standard single-chain swap format
                    token_in = parsed.args.token_in;
                    token_out = parsed.args.token_out;
                    amount_in = parsed.args.amount_in;
                    chain_id = parsed.args.chain_id;
                    isCrossChain = false;
                } else if (entry.tool === 'get_cross_chain_quote') {
                    // Cross-chain swap format - map to unified format
                    token_in = parsed.args.fromToken;
                    token_out = parsed.args.toToken;
                    amount_in = parsed.args.fromAmount;
                    // For cross-chain, use fromChain as the execution chain (where the swap originates)
                    const fromChain = parsed.args.fromChain;
                    chain_id = typeof fromChain === 'string' ? parseInt(fromChain, 10) : fromChain;
                    const destChain = parsed.args.toChain;
                    toChain = typeof destChain === 'string' ? parseInt(destChain, 10) : destChain;
                    isCrossChain = true;
                }

                if (!token_in || !token_out || !amount_in || !chain_id) continue;
                return { token_in, token_out, amount_in, chain_id, isCrossChain, toChain, simulatedAtMs: createdMs || undefined };
            }
        }
        return null;
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

    private normalizeChainName(input: unknown): string | undefined {
        if (input === null || input === undefined) return undefined;
        const raw = String(input).trim().toLowerCase();
        if (!raw) return undefined;
        const aliases: Record<string, string> = {
            ethereum: 'eth',
            mainnet: 'eth',
            matic: 'polygon',
            polygonpos: 'polygon',
            polygon_pos: 'polygon',
            arb: 'arbitrum',
            op: 'optimism',
            sol: 'solana',
        };
        return aliases[raw] || raw;
    }

    private resolveRequestedWalletChain(args: any): string | undefined {
        const explicitChain = this.normalizeChainName(args?.chain);
        if (explicitChain) return explicitChain;

        const rawChainId = args?.chainId;
        if (rawChainId !== undefined && rawChainId !== null && rawChainId !== '') {
            const chainIdNum = Number(rawChainId);
            if (Number.isFinite(chainIdNum) && CHAIN_ID_MAP[chainIdNum]) {
                return CHAIN_ID_MAP[chainIdNum];
            }
        }
        return undefined;
    }

    private buildUserContext(task: AITask, opts: { chainId?: number; chainName?: string }, parsedIntent: any): UserContext {
        const normalizedBalance = this.normalizeBalanceSnapshot(task.toolContext?.balance);
        return {
            userAddress: task.toolContext?.walletAddress,
            chainId: opts.chainId ?? task.toolContext?.chainId,
            chainName: opts.chainName,
            isWalletConnected: !!task.toolContext?.walletAddress,
            farcaster: task.toolContext?.farcaster,
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

    private cleanNaturalLanguageToken(token: unknown): string {
        return String(token || '')
            .trim()
            .replace(/^[\s"'`]+|[\s"'`,.!?;:]+$/g, '')
            .replace(/^\$/, '');
    }

    private isEvmAddressToken(token: string): boolean {
        return /^0x[0-9a-fA-F]{40}$/.test(token);
    }

    private isLikelySolanaAddress(token: string): boolean {
        return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(token);
    }

    private canonicalizeSwapTokenForCache(token: unknown, chainId: number): string {
        const raw = this.cleanNaturalLanguageToken(token);
        if (!raw) return '';

        // Solana addresses are base58 and case-sensitive; avoid lowercasing.
        if (chainId === 900) {
            if (this.isLikelySolanaAddress(raw)) return raw;
            const upper = raw.toUpperCase();
            if (upper === 'SOL' || upper === 'WSOL') return 'So11111111111111111111111111111111111111112';
            return upper;
        }

        const resolved = resolveTokenAddress(raw, chainId);
        const normalized = normalizeTokenAddress(resolved);
        if (this.isEvmAddressToken(normalized)) return normalized.toLowerCase();
        return this.cleanNaturalLanguageToken(normalized).toUpperCase();
    }

    private canonicalizeSwapAmountForCache(amount: unknown): string {
        let raw = String(amount || '').trim().replace(/[,_\s]/g, '');
        if (!raw) return '';

        if (/^[+-]?\d*\.?\d+$/.test(raw)) {
            const negative = raw.startsWith('-');
            raw = raw.replace(/^[+-]/, '');
            if (raw.startsWith('.')) raw = `0${raw}`;
            const [wholeRaw, fracRaw = ''] = raw.split('.');
            const whole = (wholeRaw || '0').replace(/^0+(?=\d)/, '') || '0';
            const frac = fracRaw.replace(/0+$/, '');
            const normalized = frac ? `${whole}.${frac}` : whole;
            return negative && normalized !== '0' ? `-${normalized}` : normalized;
        }

        return raw.toLowerCase();
    }

    private buildSimulateSwapCanonicalKey(args: any): string | null {
        const chainId = Number(args?.chain_id ?? args?.chainId);
        if (!Number.isFinite(chainId) || chainId <= 0) return null;

        const tokenIn = this.canonicalizeSwapTokenForCache(args?.token_in ?? args?.tokenIn, chainId);
        const tokenOut = this.canonicalizeSwapTokenForCache(args?.token_out ?? args?.tokenOut, chainId);
        const amountIn = this.canonicalizeSwapAmountForCache(args?.amount_in ?? args?.amountIn);
        if (!tokenIn || !tokenOut || !amountIn) return null;

        return `simulate_swap:__canon:${chainId}:${tokenIn}:${tokenOut}:${amountIn}`;
    }

    private buildSimulateSwapLegacyNormKey(args: any): string | null {
        const tokenIn = String(args?.token_in || '').trim().toLowerCase();
        const tokenOut = String(args?.token_out || '').trim().toLowerCase();
        const amountIn = this.canonicalizeSwapAmountForCache(args?.amount_in);
        const chainId = args?.chain_id;
        if (!tokenIn || !tokenOut || !amountIn || chainId === undefined || chainId === null || chainId === '') return null;
        return `simulate_swap:__norm:${tokenIn}:${tokenOut}:${amountIn}:${chainId}`;
    }

    private isSimulateQuoteExpired(simulatedAtMs?: number): boolean {
        if (!simulatedAtMs || !Number.isFinite(simulatedAtMs)) return true;
        const ttlMs = Math.max(5000, parseInt(process.env.CHAT_SIM_QUOTE_TTL_MS || '45000', 10) || 45000);
        return (Date.now() - simulatedAtMs) > ttlMs;
    }

    private async refreshQuoteComparisonForConfirmedSwap(input: {
        task: AITask;
        userId: string | null;
        tokenIn: string;
        tokenOut: string;
        amountIn: string;
        chainId: number;
    }): Promise<{ ok: boolean; bestDex?: string; quoteCount?: number; error?: string }> {
        const API_BASE = process.env.API_BASE_URL || (process.env.PORT ? `http://127.0.0.1:${process.env.PORT}` : 'http://localhost:3001');
        const accessToken = input.task.toolContext?.accessToken;
        const appKey = process.env.KIKO_WEB_APP_KEY || process.env.KIKO_MOBILE_APP_KEY || '';
        const payload = {
            tokenIn: input.tokenIn,
            tokenOut: input.tokenOut,
            amountIn: input.amountIn,
            chainId: input.chainId,
            slippageBps: input.task.toolContext?.toolConfig?.customSlippage
                ? Math.round(Number(input.task.toolContext.toolConfig.customSlippage) * 100)
                : 100,
            userAddress: input.task.toolContext?.walletAddress || input.task.toolContext?.userAddress,
        };

        try {
            const body = JSON.stringify(payload);
            const result = await fetchJson({
                url: `${API_BASE}/api/swap/quote`,
                method: 'POST',
                endpointName: 'swap-api',
                headers: {
                    'Content-Type': 'application/json',
                    ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
                    ...(appKey ? { 'X-App-Key': appKey } : {}),
                    ...buildSignedHeaders('POST', '/api/swap/quote', body),
                },
                body,
            });

            const best = (result as any)?.data;
            const quotes = Array.isArray((result as any)?.quotes) ? (result as any).quotes : [];
            logger.info(LogCode.AI_API_CALL, 'ChatWorker: refreshed quote comparison for expired simulate', {
                taskId: input.task.id,
                chainId: input.chainId,
                tokenIn: input.tokenIn,
                tokenOut: input.tokenOut,
                amountIn: input.amountIn,
                bestDex: best?.dex || best?.dexName || null,
                quoteCount: quotes.length,
            });
            return {
                ok: !!best,
                bestDex: best?.dex || best?.dexName,
                quoteCount: quotes.length,
            };
        } catch (error: any) {
            logger.warn(LogCode.API_FETCH_FAILED, 'ChatWorker: quote refresh failed for expired simulate', {
                taskId: input.task.id,
                error: error?.message || String(error),
            });
            return { ok: false, error: error?.message || String(error) };
        }
    }

    private async executeConfirmedSwapBypass(params: {
        task: AITask;
        assistantMessageId: string;
        sessionMessages: any[];
        userId: string | null;
        providerLabel: 'DeepSeek' | 'Grok';
    }): Promise<boolean> {
        void params;
        return false;
    }

    private getInitialContextStatusMessage(task: AITask): string {
        const toolContext = task?.toolContext || {};
        const hasWalletAddress = !!(toolContext.walletAddress || toolContext.userAddress);
        const hasBalanceSnapshot = !!this.normalizeBalanceSnapshot(toolContext.balance) || !!toolContext.nativeBalance;

        if (hasWalletAddress && !hasBalanceSnapshot) return 'Checking wallet';
        if (hasWalletAddress && hasBalanceSnapshot) return 'Loading wallet context';
        return 'Preparing context';
    }

    private findSnapshotBalanceForToken(task: AITask, tokenIn: string, chainName: string, isNative: boolean): number | null {
        const nativeSymbolsByChain: Record<string, string[]> = {
            eth: ['ETH'],
            base: ['ETH'],
            arbitrum: ['ETH'],
            optimism: ['ETH'],
            polygon: ['POL', 'MATIC'],
            bsc: ['BNB'],
            solana: ['SOL'],
        };
        const nativeSymbols = nativeSymbolsByChain[chainName] || ['ETH'];

        if (isNative) {
            const nativeBalance = Number(task.toolContext?.nativeBalance);
            if (Number.isFinite(nativeBalance) && nativeBalance >= 0) return nativeBalance;
        }

        const entries = this.parseBalanceEntries(task.toolContext?.balance) || [];
        if (entries.length === 0) return null;

        const tokenLower = String(tokenIn || '').toLowerCase();
        const tokenUpper = String(tokenIn || '').toUpperCase();
        const tokenIsAddress = tokenLower.startsWith('0x') || tokenLower.length >= 32;

        const match = entries.find((entry) => {
            const symbolUpper = String(entry.symbol || '').toUpperCase();
            const contractLower = String(entry.contractAddress || '').toLowerCase();
            if (tokenIsAddress) return !!contractLower && contractLower === tokenLower;
            if (isNative && nativeSymbols.includes(symbolUpper)) return true;
            return symbolUpper === tokenUpper;
        });
        if (!match) return null;

        const snapshotBalance = Number(match.balance);
        return Number.isFinite(snapshotBalance) && snapshotBalance >= 0 ? snapshotBalance : null;
    }

    private async fetchOnchainBalanceForToken(
        walletAddress: string,
        chainName: string,
        tokenIn: string,
        isNative: boolean
    ): Promise<number> {
        if (isNative) {
            const wallet = await alchemy.getWalletBalance(walletAddress, chainName);
            const nativeBalance = Number(wallet?.ethBalanceFormatted || 0);
            return Number.isFinite(nativeBalance) && nativeBalance >= 0 ? nativeBalance : 0;
        }

        if (chainName !== 'solana' && tokenIn.startsWith('0x')) {
            const direct = await alchemy.getSpecificTokenBalance(walletAddress, chainName, tokenIn);
            const directBalance = Number(direct?.formatted || 0);
            return Number.isFinite(directBalance) && directBalance >= 0 ? directBalance : 0;
        }

        const balances = await alchemy.getTokenBalances(walletAddress, chainName);
        const tokenLower = tokenIn.toLowerCase();
        const tokenUpper = tokenIn.toUpperCase();
        const found = balances.find((entry: any) => {
            const contract = String(entry?.contractAddress || '').toLowerCase();
            const symbol = String(entry?.symbol || '').toUpperCase();
            return contract === tokenLower || symbol === tokenUpper;
        });
        const listedBalance = Number(found?.tokenBalance || 0);
        return Number.isFinite(listedBalance) && listedBalance >= 0 ? listedBalance : 0;
    }

    private buildToolFallbackMessage(toolResults: any[]): string | null {
        for (const res of toolResults) {
            const content = res?.content;
            if (!content) continue;
            if (typeof content === 'string' && content.startsWith('Error:')) {
                return content;
            }
            try {
                const parsed = typeof content === 'string' ? JSON.parse(content) : content;
                if (!parsed || typeof parsed !== 'object') continue;

                if (parsed.error) {
                    return `⚠️ ${parsed.error}`;
                }

                const expected = parsed.expected_out_human || parsed.expected_out;
                if (expected) {
                    const impact = parsed.price_impact || (parsed.price_impact_pct !== undefined ? `${parsed.price_impact_pct}%` : undefined);
                    const lines = [
                        'Simulation result:',
                        `- Expected receive: ${expected}`,
                        impact ? `- Price impact: ${impact}` : undefined,
                        parsed.warning ? `- Warning: ${parsed.warning}` : undefined,
                        'Review the quote and tell me if you want to execute it.'
                    ].filter(Boolean) as string[];
                    return lines.join('\n');
                }
            } catch {
                continue;
            }
        }

        return null;
    }

    private buildWalletInfoFromContext(task: AITask): any | null {
        const ctx = task.toolContext;
        if (!ctx) return null;

        const walletAddress = ctx.walletAddress || ctx.userAddress;
        const chainId = ctx.chainId;
        if (!walletAddress || !chainId) return null;

        const normalizedBalance = this.normalizeBalanceSnapshot(ctx.balance);
        const nativeBalance = ctx.nativeBalance;
        const tokens = this.parseBalanceEntries(ctx.balance) || [];
        // Important: do NOT short-circuit get_wallet_info from context when we only have native balance.
        // In that case, allow real tool execution to fetch full token balances from providers.
        if (!normalizedBalance && !nativeBalance) return null;
        if (tokens.length === 0) return null;

        const chainName = this.resolveChainNameForContext(chainId) || String(chainId);

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

        const maxBalancePreview = 8;
        const maxPageContextChars = 800;
        const truncateText = (text: string, maxLen: number): string => {
            if (text.length <= maxLen) return text;
            return `${text.slice(0, maxLen)}...`;
        };

        const payload = {
            walletAddress: ctx.walletAddress || ctx.userAddress,
            chainId: ctx.chainId,
            chainName: this.resolveChainNameForContext(ctx.chainId),
            currentPage: ctx.currentPage,
            pageContext: ctx.pageContext ? truncateText(String(ctx.pageContext), maxPageContextChars) : undefined,
            nativeBalance: ctx.nativeBalance,
            balanceSnapshotAt: this.getBalanceSnapshotTimestamp(ctx),
            balance: ctx.balance,
            tokenSnapshot: (ctx as any).tokenSnapshot || (ctx as any).tokenContext || (ctx as any).tokenInfo,
            launchpad: (ctx as any).launchpad || (ctx as any).launchpadInfo,
            toolConfig: ctx.toolConfig,
        };

        const hasAny = Object.values(payload).some(v => v !== undefined);
        if (!hasAny) return null;

        let balanceSummary: any = undefined;
        if (payload.balance) {
            const entries = this.parseBalanceEntries(payload.balance);
            const filteredEntries = this.filterBalanceEntriesForAi(entries, payload.chainId);
            const sample = filteredEntries ? filteredEntries.slice(0, maxBalancePreview) : [];
            balanceSummary = {
                tokenCount: filteredEntries ? filteredEntries.length : 0,
                sample: sample.map((token) => ({
                    symbol: token.symbol,
                    balance: token.balance,
                    decimals: token.decimals,
                    contractAddress: token.contractAddress,
                })),
                truncated: filteredEntries && filteredEntries.length > maxBalancePreview
                    ? filteredEntries.length - maxBalancePreview
                    : 0,
            };
            payload.balance = balanceSummary;
        }

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
        if (balanceSummary) {
            logger.info(LogCode.AI_API_CALL, 'ChatWorker: client balance snapshot summary', {
                tokenCount: balanceSummary.tokenCount,
                sample: balanceSummary.sample,
                truncated: balanceSummary.truncated,
            });
        }

        const chainName = this.resolveChainNameForContext(ctx.chainId);
        const chainGuardrail = ctx.chainId
            ? `\n[CHAIN_GUARDRAIL]\nCurrent/default execution chain is ${chainName || 'Unknown'} (${ctx.chainId}).\nDo NOT infer Ethereum mainnet from EVM address format. Use this chain unless user explicitly requests another chain.\n`
            : '';

        return `[CLIENT_CONTEXT]\n${serialized}${chainGuardrail}`;
    }

    private filterBalanceEntriesForAi(
        entries: Array<{ symbol: string; balance: string; decimals?: number; contractAddress?: string }> | undefined,
        chainId?: number,
        allowContracts: Set<string> = new Set()
    ) {
        if (!entries || entries.length === 0) return entries;
        const nativeSymbols = new Set(['ETH', 'MATIC', 'POL', 'BNB', 'SOL',]);
        const isEvm = chainId !== 900 && chainId !== undefined;
        const wrappedNative = (() => {
            if (!chainId || chainId === 900) return '';
            try {
                return getChainConfig(chainId).wrappedNativeAddress.toLowerCase();
            } catch {
                return '';
            }
        })();
        return entries.filter((token) => {
            const symbol = String(token.symbol || '').toUpperCase();
            const rawSymbol = String(token.symbol || '');
            const addr = token.contractAddress || '';
            if (nativeSymbols.has(symbol)) {
                if (!addr) return true;
                const addrLower = addr.toLowerCase();
                if (addrLower === '0x0000000000000000000000000000000000000000') return true;
                if (addrLower === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') return true;
                if (wrappedNative && addrLower === wrappedNative) return true;
                return false;
            }
            if (this.isStableSymbolForChain(chainId, symbol)) return true;
            // Keep full portfolio coverage for symbol-only entries coming from trusted
            // wallet snapshots (frontend/backend context), so the model can match tokens
            // even when a contract field is absent.
            if (!addr) {
                if (!rawSymbol) return false;
                if (rawSymbol.startsWith('0x')) return false;
                return true;
            }
            if (isEvm) {
                if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) return false;
            } else if (addr.length < 32) {
                return false;
            }
            const addrLower = addr.toLowerCase();
            if (allowContracts.size > 0 && !allowContracts.has(addrLower)) return false;
            if (!rawSymbol || rawSymbol.startsWith('0x')) return false;

            return true;
        });
    }

    private limitLines(lines: string[], limit: number): { lines: string[]; hiddenCount: number } {
        if (lines.length <= limit) {
            return { lines, hiddenCount: 0 };
        }
        return {
            lines: lines.slice(0, limit),
            hiddenCount: lines.length - limit,
        };
    }

    private buildBalanceContext(params: {
        toolContext: any;
        toolResultsCache: Map<string, any>;
        nativeSymbol?: string;
        nativePriceUsd?: number;
        nativePriceSource?: string;
        nativePriceFetchedAt?: string;
        balanceSnapshotAt?: string;
        requestedAddressSet?: Set<string>;
        requestedTokens?: string[];
        includePortfolioBlock?: boolean;
        includeRequestedTokenBlock?: boolean;
        includeExecutionRule?: boolean;
        chainLabel?: string;
        isExecutionIntent?: boolean;
    }): {
        cacheHit: boolean;
        tokenCount: number;
        tokenContextBlock: string;
        requestedTokenBlock: string;
        tokensInPortfolio: string[];
        requestedMatched: string[];
        requestedMissing: string[];
        resolvedBalances: Record<string, string>;
    } {
        return buildBalanceContextBlock({
            ...params,
            stableStringify: this.stableStringify.bind(this),
            filterBalanceEntriesForAi: this.filterBalanceEntriesForAi.bind(this),
            isStableSymbolForChain: this.isStableSymbolForChain.bind(this),
            isNativeSymbol: this.isNativeSymbol.bind(this),
            limitLines: this.limitLines.bind(this),
        });
    }

    private getBalanceSnapshotTimestamp(toolContext: any): string | undefined {
        return toolContext?.balanceSnapshotAt
            || toolContext?.balanceFetchedAt
            || toolContext?.balanceUpdatedAt
            || toolContext?.balanceTimestamp
            || undefined;
    }

    private requiresUsdPriceGuardrail(lastUserMessage: string, parsedIntent: any): boolean {
        const text = String(lastUserMessage || '');
        if (/\$|usd|usdc|价值|美元|美金|worth|about/i.test(text)) return true;
        const tIn = String(parsedIntent?.detailed?.token_in || parsedIntent?.swapIntent?.tokenIn || '').toUpperCase();
        const tOut = String(parsedIntent?.detailed?.token_out || parsedIntent?.swapIntent?.tokenOut || '').toUpperCase();
        if (['USDC', 'USDT', 'DAI'].includes(tIn) || ['USDC', 'USDT', 'DAI'].includes(tOut)) return true;
        return false;
    }

    private ensureToolDefinitionPresent(toolDefinitions: any[], baseToolDefs: any[], toolName: string): any[] {
        if (toolDefinitions.some(def => def?.function?.name === toolName)) return toolDefinitions;
        const found = baseToolDefs.find(def => def?.name === toolName);
        if (!found) return toolDefinitions;
        return [...toolDefinitions, { type: 'function', function: found }];
    }

    private appendPriceGuardrailBlock(baseBlock: string, params: { nativeSymbol: string; hasNativePrice: boolean }): string {
        if (params.hasNativePrice) return baseBlock;
        return `${baseBlock}

[PRICE_GUARDRAIL]
Native price reference is unavailable for ${params.nativeSymbol}.
CRITICAL: Before giving any USD valuation, you MUST fetch a trusted live price via tools (e.g. get_token_price) and cite that result.
Do NOT estimate or guess USD values.`;
    }

    private resolveNativeSymbol(chainId?: number): string {
        if (chainId === 56) return 'BNB';
        if (chainId === 137) return 'POL';
        if (chainId === 900) return 'SOL';
        return 'ETH';
    }

    private async resolveNativePriceSnapshot(
        chainId: number | undefined,
        toolResultsCache: Map<string, any>
    ): Promise<{ nativeSymbol: string; nativePriceUsd?: number; nativePriceSource?: string; nativePriceFetchedAt?: string }> {
        const nativeSymbol = this.resolveNativeSymbol(chainId);
        const cacheKey = `native_price_usd:${nativeSymbol}`;
        const cached = toolResultsCache.get(cacheKey);
        if (cached && Number.isFinite(cached.price) && cached.price > 0) {
            return {
                nativeSymbol,
                nativePriceUsd: Number(cached.price),
                nativePriceSource: cached.source || 'Coinbase',
                nativePriceFetchedAt: cached.fetchedAt,
            };
        }

        const priceData = await this.withTimeout(
            getCoinbaseSpotPrice(nativeSymbol, 'USD'),
            Math.max(200, parseInt(process.env.CHAT_NATIVE_PRICE_TIMEOUT_MS || '800', 10) || 800),
            'native_price_coinbase',
            null as any
        );
        if (priceData && Number.isFinite(priceData.price) && priceData.price > 0) {
            const snapshot = {
                price: Number(priceData.price),
                source: 'Coinbase',
                fetchedAt: new Date().toISOString(),
            };
            toolResultsCache.set(cacheKey, snapshot);
            return {
                nativeSymbol,
                nativePriceUsd: snapshot.price,
                nativePriceSource: snapshot.source,
                nativePriceFetchedAt: snapshot.fetchedAt,
            };
        }

        return { nativeSymbol };
    }

    private pruneToolsWithContextAvailability(
        toolDefinitions: any[],
        opts: { tokenContextAvailable?: boolean; launchpadContextAvailable?: boolean; providerLabel: 'ChatWorker' | 'Grok' }
    ): any[] {
        let next = toolDefinitions;
        if (opts.tokenContextAvailable) {
            const beforeCount = next.length;
            next = next.filter(def => def.function?.name !== 'get_token_info');
            if (next.length !== beforeCount) {
                logger.info(LogCode.AI_API_CALL, `${opts.providerLabel}: removed get_token_info tool (token context present)`, {
                    before: beforeCount,
                    after: next.length,
                });
            }
        }
        if (opts.launchpadContextAvailable) {
            const beforeCount = next.length;
            next = next.filter(def => def.function?.name !== 'check_token_risk');
            if (next.length !== beforeCount) {
                logger.info(LogCode.AI_API_CALL, `${opts.providerLabel}: removed check_token_risk tool (launchpad context present)`, {
                    before: beforeCount,
                    after: next.length,
                });
            }
        }
        return next;
    }

    private isStableSymbolForChain(chainId: number | undefined, symbol: string): boolean {
        const stableSymbols = new Set(['USDC', 'USDT', 'DAI', 'USDBC']);
        if (!stableSymbols.has(symbol)) return false;
        if (!chainId) return true;
        const stableChains = new Set([1, 10, 56, 137, 42161, 8453]);
        return stableChains.has(chainId) || chainId === 900;
    }

    private isNativeSymbol(symbol: string): boolean {
        const nativeSymbols = new Set(['ETH', 'MATIC', 'POL', 'BNB', 'AVAX', 'SOL', 'ARB', 'OP']);
        return nativeSymbols.has(symbol.toUpperCase());
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
        const blocks = (params.extraBlocks || []).filter(b => b && b.trim().length > 0);
        const extra = blocks.join('\n');
        const isExecutionIntent = EXECUTION_INTENTS.has(params.intent);
        const hasWalletBlock = blocks.some(b => b.includes('[USER_WALLET_CONTEXT]'));
        const hasBalanceBlock = blocks.some(b => b.includes('[USER_BALANCE_CONTEXT]') || b.includes('[REQUESTED_TOKEN_BALANCE]'));

        // Avoid sending the same wallet/balance payload via both [CONTEXT] and extra blocks.
        // Keep execution-critical blocks, but de-duplicate equivalent fields.
        let ctx: UserContext = { ...params.userContext };
        if (isExecutionIntent) {
            ctx.pageContext = undefined;
            ctx.currentPage = undefined;
        }
        if (hasWalletBlock) {
            // Keep wallet identity in context so the model never treats wallet as "missing".
            ctx.nativeBalance = undefined;
        }
        if (hasBalanceBlock) {
            ctx.balance = undefined;
            ctx.nativeBalance = undefined;
        }
        if (extra) {
            ctx.pageContext = [ctx.pageContext, extra].filter(Boolean).join('\n');
        }
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
        }).catch(e => logger.warn(LogCode.DB_TRANSACTION_FAILED, 'Intermediate DB save failed (ignored)', { error: e.message }));
        return now;
    }

    private parseCardMessageData(rawData: any, messageId?: string): any {
        if (!rawData) return {};
        if (typeof rawData === 'string') {
            try {
                return JSON.parse(rawData);
            } catch {
                logger.warn(LogCode.SYS_ERROR, 'Failed to parse transaction message JSON', {
                    messageId,
                });
                return {};
            }
        }
        if (typeof rawData === 'object') return rawData;
        return {};
    }

    private async updateAndBroadcastTransactionCard(params: {
        messageId: string;
        sessionId: string;
        userId?: string | null;
        data: any;
        status?: string;
    }): Promise<void> {
        const { updateMessage } = await import('../repositories/chatRepository.js');
        await updateMessage(params.messageId, {
            data: params.data,
            ...(params.status ? { status: params.status as any } : {}),
        });
        if (params.userId) {
            this.ws.broadcastToUser(params.userId, {
                type: 'client_action',
                sessionId: params.sessionId,
                data: {
                    targetMessageId: params.messageId,
                    action: {
                        type: 'show_transaction_status_card',
                        data: params.data,
                    },
                },
            });
        }
    }

    private broadcastAssistantMessageComplete(
        userId: string | null | undefined,
        sessionId: string,
        messageId: string,
        extraData: Record<string, any> = {}
    ) {
        if (!userId) return;
        // Single canonical event: messageId for which message completed, taskId optional for frontend task clearing
        this.ws.broadcastToUser(userId, {
            type: 'message_complete',
            sessionId,
            data: { messageId, message_id: messageId, ...extraData },
        });
    }

    private applyContextBudgetWithMetrics(messages: any[], task: AITask, label: string): {
        messages: any[];
        compactedHistoryMessage?: string;
        metrics: { inputTokensEstimated: number; historyKept: number; historyCompacted: number; compactionHits: number };
    } {
        const budget = contextBudgetManager.applyBudget(messages as any, {
            recentWindow: CHAT_CONTEXT_RECENT_WINDOW,
            maxInputTokens: CHAT_CONTEXT_MAX_INPUT_TOKENS,
            reservedOutputTokens: CHAT_CONTEXT_RESERVED_OUTPUT_TOKENS,
        });
        const metrics = {
            inputTokensEstimated: budget.inputTokensEstimated,
            historyKept: budget.historyKept,
            historyCompacted: budget.historyCompacted,
            compactionHits: budget.compactedSummary ? 1 : 0,
        };
        logger.info(LogCode.AI_API_CALL, `${label}: context budget applied`, {
            taskId: task.id,
            sessionId: task.sessionId,
            inputTokensEstimated: budget.inputTokensEstimated,
            historyKept: budget.historyKept,
            historyCompacted: budget.historyCompacted,
            hasCompaction: !!budget.compactedSummary,
        });
        return {
            messages: budget.messages as any[],
            compactedHistoryMessage: budget.compactedSummary,
            metrics,
        };
    }

    private ensureCriticalContextPinned(compactedMessages: any[], sourceMessages: any[]): any[] {
        const criticalPatterns = ['[USER_BALANCE_CONTEXT]', '[REQUESTED_TOKEN_BALANCE]', '[NATIVE_PRICE_CONTEXT]', '[PRICE_GUARDRAIL]'];
        const hasPattern = (msgs: any[], pattern: string) =>
            msgs.some((m: any) => typeof m?.content === 'string' && m.content.includes(pattern));

        let next = [...compactedMessages];
        for (const pattern of criticalPatterns) {
            if (hasPattern(next, pattern)) continue;
            const source = [...sourceMessages].reverse().find((m: any) => typeof m?.content === 'string' && m.content.includes(pattern));
            if (source) {
                next.push({ role: 'system', content: source.content });
            }
        }
        return next;
    }

    private async checkTaskCancelled(taskId: string, sourceLabel: string): Promise<boolean> {
        try {
            // First check Redis (extremely fast, <1ms)
            const redisCancel = await cacheClient.get(`chat:cancel:${taskId}`);
            if (redisCancel === '1') return true;

            // Fallback to DB check if Redis fails or missed (more stable persistence)
            const currentTask = await this.repo.getTaskStatus(taskId);
            return currentTask?.status === 'cancelled';
        } catch (error: any) {
            logger.warn(LogCode.DB_TRANSACTION_FAILED, `${sourceLabel}: cancellation check failed (non-critical)`, {
                taskId,
                error: error?.message || String(error),
            });
            return false;
        }
    }

    private async persistAssistantMessageSafe(params: {
        assistantMessageId: string;
        patch: any;
        logLabel: string;
    }): Promise<void> {
        try {
            await this.repo.updateMessage(params.assistantMessageId, params.patch);
        } catch (error: any) {
            logger.error(LogCode.DB_TRANSACTION_FAILED, `${params.logLabel}: failed to persist assistant message`, {
                assistantMessageId: params.assistantMessageId,
                error: error?.message || String(error),
            });
        }
    }

    private attachFallbackSystemContext(params: {
        messages: any[];
        task: AITask;
        didInjectUserContext: boolean;
        balanceContextBlock?: string;
        providerLabel: 'ChatWorker' | 'Grok';
    }): any[] {
        const next = [...params.messages];
        const systemInjection = (params.task as any).systemInjection;
        if (systemInjection && String(systemInjection).trim()) {
            next.push({ role: 'system', content: String(systemInjection).trim() });
            logger.info(LogCode.AI_API_CALL, `${params.providerLabel}: system injection attached`, {
                taskId: params.task.id,
            });
        }
        if (params.didInjectUserContext) return next;

        const systemContext = this.buildSystemContextMessage(params.task);
        if (systemContext) {
            next.push({ role: 'system', content: systemContext });
            logger.debug(LogCode.AI_API_CALL, `${params.providerLabel}: client context attached to system prompt`, {
                taskId: params.task.id,
            });
        }

        if (params.balanceContextBlock) {
            next.push({ role: 'system', content: params.balanceContextBlock.trim() });
            logger.info(LogCode.AI_API_CALL, `${params.providerLabel}: balance context attached to system prompt`, {
                bytes: params.balanceContextBlock.length,
            });
        }
        return next;
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
                    logger.warn(LogCode.AI_API_CALL, 'Sanitizing orphaned tool_calls', {
                        messageIndex: i,
                        missingToolResults: expectedToolCallIds.size,
                    });
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

    private sanitizeGrokHistory(history: any[]): any[] {
        const sanitized: any[] = [];
        for (const msg of history || []) {
            if (!msg || !msg.role) continue;
            const role = msg.role;
            let content = typeof msg.content === 'string' ? msg.content : '';

            // xAI/gRPC rejects messages with empty content blocks.
            if (!content.trim()) {
                if (role === 'assistant' && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
                    content = '(assistant tool call)';
                } else if (role === 'tool') {
                    content = '(tool result)';
                } else if (role === 'user') {
                    continue;
                } else {
                    content = '(empty message)';
                }
            }

            sanitized.push({
                role,
                content,
                ...(msg.tool_calls ? { tool_calls: msg.tool_calls } : {}),
                ...(msg.tool_call_id ? { tool_call_id: msg.tool_call_id } : {}),
            });
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

    private resolveRoutingMode(
        intent: IntentType,
        _decision?: Awaited<ReturnType<typeof parseIntent>>['decision']
    ): 'execution' {
        // Unified single-route mode: prompt + tool behavior are mixed in one path.
        return 'execution';
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
            const info = await this.withTimeout(
                findTokenOnAnyChain(token),
                Math.max(250, parseInt(process.env.CHAT_TOKEN_DETECT_TIMEOUT_MS || '700', 10) || 700),
                'resolve_symbol_find_token',
                null
            );
            if (info && info.symbol && info.symbol !== 'UNKNOWN') {
                return info.symbol.toUpperCase();
            }

            // Fallback to chain-specific getTokenInfo (internal detector fallback)
            const specificInfo = await getTokenInfo(token, chainId);
            if (specificInfo && specificInfo.symbol && specificInfo.symbol !== 'UNKNOWN') {
                return specificInfo.symbol.toUpperCase();
            }
        } catch (e) {
            logger.warn(LogCode.API_FETCH_FAILED, 'Failed to resolve token symbol', {
                token,
                error: (e as any)?.message || String(e),
            });
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
    start(intervalMs = Math.max(100, parseInt(process.env.CHAT_WORKER_POLL_MS || '250', 10) || 250)) {
        if (this.isRunning) return;
        this.isRunning = true;

        // Store interval for potential dynamic adjustment
        const pollConfig = { interval: intervalMs };
        logger.info(LogCode.SYS_INFO, 'ChatWorker started polling', {
            intervalMs: pollConfig.interval,
        });

        const runLoop = async () => {
            if (!this.isRunning) return;

            try {
                await this.processQueuedTasks();
            } catch (error) {
                logger.error(LogCode.SYS_ERROR, 'ChatWorker runLoop crash', {
                    error: (error as any)?.message || String(error),
                });
                // In a real app we might use logger.error here, but console.error is safe fallback
                // We swallow the error to ensure the loop continues scheduling
            }

            if (this.isRunning) {
                this.pollInterval = setTimeout(runLoop, pollConfig.interval);
            }
        };

        runLoop();
    }

    /**
     * Wake the worker to process queue immediately (bypass next poll tick)
     */
    async wake() {
        if (!this.isRunning) return;
        await this.processQueuedTasks();
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
        logger.info(LogCode.SYS_INFO, 'ChatWorker stopped');
    }

    /**
     * Poll and process queued tasks
     */
    private async processQueuedTasks() {
        try {
            await processClaimedTasks({
                repo: this.repo,
                runningTasks: this.runningTasks,
                maxConcurrentTasks: this.maxConcurrentTasks,
                claimLimit: 5,
                runTask: async (task) => this.runTask(task as AITask),
            });
        } catch (error) {
            logger.error(LogCode.SYS_ERROR, 'ChatWorker error polling tasks', {
                error: (error as any)?.message || String(error),
            });
        }
    }

    /**
     * Execute a single AI task
     */
    private async runTask(task: AITask) {
        logger.debug(LogCode.AI_API_CALL, 'ChatWorker: running task', { taskId: task.id, sessionId: task.sessionId });
        let userId: string | null = null;

        try {
            // 1. Session context + message history (parallel — independent DB queries)
            const [session, messages] = await Promise.all([
                this.repo.getSession(task.sessionId),
                this.repo.getSessionMessages(task.sessionId),
            ]);
            userId = session?.userId || null;
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

            // 2. IMMEDIATE FEEDBACK: Broadcast message_start early
            this.ws.broadcastToUser(userId!, {
                type: 'message_start',
                sessionId: task.sessionId,
                data: {
                    messageId: task.assistantMessageId,
                    role: 'assistant',
                    model: task.model
                }
            });

            const lastUserMsg = conversationHistory.filter(m => m.role === 'user').pop();
            const lastUserContent = lastUserMsg?.content || '';
            const fastSwapCandidate =
                (task.toolContext?.allowanceMode === 'instant' || task.toolContext?.toolConfig?.fastSwapMode) &&
                /\b(swap|buy|sell|trade|买|卖|兑换)\b/i.test(lastUserContent);
            (task as any).fastSwapCandidate = fastSwapCandidate;
            const taskType = fastSwapCandidate ? 'card' : 'text';

            this.broadcastTaskStatus(userId, task, { taskId: task.id, status: 'running', message: 'Analyzing query', taskType });

            // 3. PARALLEL PRE-PROCESSING: Moderation + Intent + Token Context
            const toolResultsCache = new Map<string, any>();
            this.seedToolCacheFromContext(toolResultsCache, task);

            const [modResult, parsedIntent, resolvedContext] = await Promise.all([
                // Parallel moderation
                lastUserMsg?.content
                    ? moderationClient.moderateInput(lastUserMsg.content, {}, userId, task.sessionId, task.model)
                    : Promise.resolve({ safe: true, action: 'allow', checks: {} } as any),
                // Parallel intent parsing
                parseIntent(lastUserContent || '', {
                    userAddress: task.toolContext?.walletAddress,
                    chainId: task.toolContext?.chainId,
                    isWalletConnected: !!task.toolContext?.walletAddress,
                }),
                // Parallel early token context (if CA detected)
                (async () => {
                    const detectedCA = detectContractAddress(lastUserContent || '');
                    if (detectedCA) {
                        return this.resolveTokenContext({
                            mode: 'deepseek', // use deepseek as default mode for pre-fetch
                            task,
                            parsedIntent: { contractAddress: detectedCA },
                            toolResultsCache,
                            userId,
                            broadcastScanningStatus: true
                        });
                    }
                    return null;
                })()
            ]);

            if (!modResult.safe) {
                throw new Error(modResult.checks?.intent?.reason || 'Message blocked by security policy');
            }

            // 4. Process based on model
            if (task.model.includes('deepseek') || task.model.includes('gpt')) {
                await this.processDeepSeekTask(task, conversationHistory, userId, messages, session, { parsedIntent, resolvedContext, toolResultsCache });
            } else if (task.model.includes('grok')) {
                await this.processGrokTask(task, conversationHistory, userId, messages, session, { parsedIntent, resolvedContext, toolResultsCache });
            } else {
                throw new Error(`Unsupported model: ${task.model}`);
            }

            // 4. Mark as done
            try {
                await this.repo.updateTaskStatus(task.id, 'done');
            } catch (dbErr) {
                logger.error(LogCode.DB_TRANSACTION_FAILED, 'Failed to update task status', {
                    taskId: task.id,
                    error: (dbErr as any)?.message || String(dbErr),
                });
            }

            // Always broadcast success/completion to UI even if DB was flaky.
            // message_complete is already sent once by processDeepSeekTask/processGrokTask (broadcastAssistantMessageComplete).
            // Only broadcast task_status so frontend clears activeTask; avoid duplicate message_complete with same messageId.
            this.broadcastTaskStatus(userId, task, { taskId: task.id, status: 'done' });
            logger.debug(LogCode.AI_API_CALL, 'ChatWorker: task completed successfully', { taskId: task.id });

        } catch (error: any) {
            logger.error(LogCode.SYS_ERROR, 'Task failed', {
                taskId: task.id,
                error: (error as any)?.message || String(error),
            });

            // 1. Always notify frontend of error so it can stop spinners
            try {
                this.broadcastTaskStatus(userId, task, { taskId: task.id, status: 'error', error: error.message });
                if (task.assistantMessageId) {
                    this.ws.broadcastToUser(userId!, {
                        type: 'message_complete',
                        sessionId: task.sessionId,
                        data: { messageId: task.assistantMessageId }
                    });
                }
            } catch (wsErr) {
                logger.warn(LogCode.WS_ERROR, 'Failed to broadcast error status', {
                    taskId: task.id,
                    error: (wsErr as any)?.message || String(wsErr),
                });
            }

            // 2. Try to update DB status (might fail if DB is down)
            try {
                await this.repo.updateTaskStatus(task.id, 'error', error.message);
                if (task.assistantMessageId) {
                    await this.repo.updateMessage(task.assistantMessageId, { status: 'error' });
                }
            } catch (dbErr) {
                logger.error(LogCode.DB_TRANSACTION_FAILED, 'Failed to record task error in DB', {
                    taskId: task.id,
                    error: (dbErr as any)?.message || String(dbErr),
                });
            }
        }
    }

    private broadcastTaskStatus(userId: string | null, task: AITask, data: Record<string, any>) {
        if (!userId || !task.sessionId) return;
        const taskType = (task as any).fastSwapCandidate ? 'card' : 'text';
        const payload = { ...data };
        if (payload.taskType === undefined) {
            payload.taskType = taskType;
        }
        this.ws.broadcastToUser(userId, {
            type: 'task_status',
            sessionId: task.sessionId,
            data: payload,
        });
    }

    private isUnifiedOrchestrator(): boolean {
        return CHAT_ORCHESTRATOR_MODE !== 'legacy';
    }

    private resolveProvider(model: string): Provider {
        const normalized = String(model || '').toLowerCase();
        if (normalized.includes('grok')) return 'grok';
        if (normalized.startsWith('gpt')) return 'openai';
        return 'deepseek';
    }

    private buildConversationRef(session: any): ConversationStateRef {
        return {
            previousResponseId: session?.lastResponseId || undefined,
            compactionCursor: session?.compactionCursor || undefined,
            version: session?.conversationStateVersion || 1,
        };
    }

    private async persistConversationRef(
        task: AITask,
        updates: { previousResponseId?: string; compactionCursor?: string }
    ) {
        if (!task.sessionId) return;
        if (!updates.previousResponseId && !updates.compactionCursor) return;
        try {
            await this.repo.updateSessionConversationState(task.sessionId, {
                ...(updates.previousResponseId ? { lastResponseId: updates.previousResponseId } : {}),
                ...(updates.compactionCursor ? { compactionCursor: updates.compactionCursor } : {}),
            });
        } catch (err: any) {
            logger.warn(LogCode.DB_TRANSACTION_FAILED, 'ChatWorker: failed to persist conversation state', {
                sessionId: task.sessionId,
                error: err?.message || err,
            });
        }
    }

    private broadcastLatencyMetrics(
        userId: string | null,
        task: AITask,
        payload: {
            ttftMs?: number;
            latencyMs?: number;
            contextAssemblyMs?: number;
            inputTokensEstimated?: number;
            promptTokens?: number;
            completionTokens?: number;
            totalTokens?: number;
            cachedTokens?: number;
            toolRounds?: number;
            compactionHits?: number;
            historyKept?: number;
            historyCompacted?: number;
        }
    ) {
        if (!userId || !task.sessionId) return;
        this.ws.broadcastToUser(userId, {
            type: 'latency_metrics',
            sessionId: task.sessionId,
            data: {
                messageId: task.assistantMessageId,
                ...payload,
            },
        });
    }

    /**
     * DeepSeek processing with multi-turn tool support
     */
    private async processDeepSeekTask(
        task: AITask,
        history: any[],
        userId: string | null = null,
        sessionMessages: any[] = [],
        session: any = null,
        preProcessed?: { parsedIntent: any; resolvedContext: any; toolResultsCache: Map<string, any> }
    ) {
        let iteration = 0;
        let fastSwapAttempted = false; // Circuit breaker for Fast Swap
        let detectedLaunchpadInfo: { chainId: number; provider: string; data: any; address: string } | null = null; // Store launchpad info when detected
        const maxIterations = 10;
        const assistantMessageId = task.assistantMessageId!;
        let totalContent = '';  // Accumulated across all iterations
        let totalReasoning = ''; // Accumulated across all iterations
        let chunkIndex = 0;
        let lastUsage: any = null;  // Track usage for DB persistence
        let allCitations: any[] = [];  // Track citations for DB persistence
        let lastToolResults: any[] = [];
        const citationUrlSet = new Set<string>();
        let lastBudgetMetrics: { inputTokensEstimated: number; historyKept: number; historyCompacted: number; compactionHits: number } | null = null;
        const taskProcessStartedAt = Date.now();
        let latestProviderResponseId: string | undefined;

        // Initial status broadcast
        const initialStatus = this.getIntentStatusMessage(preProcessed?.parsedIntent);
        this.broadcastTaskStatus(userId, task, {
            status: 'running',
            iteration: 0,
            maxIterations: maxIterations,
            message: initialStatus
        });

        // Phase 5 Cache: Shared across all iterations of this task
        const toolResultsCache = new Map<string, any>();
        this.seedToolCacheFromContext(toolResultsCache, task);
        let earlyPreFetchPromise: Promise<void> | null = null;
        let streamPreFetchPromise: Promise<Map<string, any>> | null = null;
        const toolTrace: ToolTraceState = {
            mode: 'execution',
            skillVersion: 'exec',
            toolCalls: [],
            toolCallCounts: {},
            toolArgsCounts: {},
            toolFailures: {},
            toolRepeats: {},
            consecutiveToolCalls: 0,
            polymarketSearchNoMatchStreak: 0,
            stopReasons: [],
            blockedKeys: new Set(),
            lastResultByKey: new Map(),
        };

        const bypassed = await this.executeConfirmedSwapBypass({
            task,
            assistantMessageId,
            sessionMessages,
            userId,
            providerLabel: 'DeepSeek',
        });
        if (bypassed) return;

        // Base tool list is the full registry; skills gating will narrow it by intent.
        const lastUserMessage = history.filter(m => m.role === 'user').pop()?.content || '';
        const baseToolDefs = toolRegistry.getAllDefinitions();
        let toolDefinitions = baseToolDefs.map(def => ({ type: 'function', function: def }));
        logger.debug(LogCode.AI_API_CALL, 'Base tools filtered', {
            taskId: task.id,
            toolCount: toolDefinitions.length,
            messagePreview: lastUserMessage.slice(0, 50),
        });

        // Declare toolCalls outside main loop so it can be accessed in finally/cleanup
        let toolCalls: any[] = [];
        let totalToolCallsCount = 0;
        const totalToolCallNames: string[] = [];

        while (iteration < maxIterations) {
            iteration++;
            logger.debug(LogCode.AI_API_CALL, 'DeepSeek iteration', {
                taskId: task.id,
                iteration,
                maxIterations,
            });

            // Broadcast iteration status to frontend
            this.broadcastTaskStatus(userId, task, {
                status: 'running',
                iteration,
                maxIterations,
                message: iteration > 1 ? `Processing tool results (${iteration}/${maxIterations})` : this.getIntentStatusMessage(preProcessed?.parsedIntent)
            });

            // Check if task was cancelled (uses fast Redis signaling)
            const isCancelled = await this.checkTaskCancelled(task.id, 'Orchestrator');
            if (isCancelled) {
                logger.info(LogCode.AI_ORCHESTRATOR, 'Task cancelled by user (orchestrator check)', { taskId: task.id });
                return;
            }

            // Reasoning-capable models may require reasoning_content in assistant messages
            const normalizedModel = (task.model || '').toLowerCase();
            const isDeepSeekReasonerModel = normalizedModel === 'deepseek-reasoner';

            // Transform history for reasoner model - add reasoning_content to assistant messages
            // CRITICAL: DeepSeek strict API requirement
            // 1. If deepseek-reasoner: MUST include reasoning_content (even if empty) for assistant messages
            // 2. If deepseek-chat: MUST NOT include reasoning_content (strict validation error if present)
            const transformedHistory = history.map(msg => {
                if (msg.role === 'assistant') {
                    const { reasoning_content, tool_calls, ...rest } = msg;
                    const apiMsg = { ...rest };

                    if (isDeepSeekReasonerModel) {
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

            // Parse intent from user message (skip if pre-processed)
            const taskType = (task as any).fastSwapCandidate ? 'card' : 'text';
            if (task.sessionId) {
                this.broadcastTaskStatus(userId, task, {
                    status: 'running',
                    message: this.getInitialContextStatusMessage(task),
                    taskType
                });
            }
            const parsedIntent = preProcessed?.parsedIntent && iteration === 1
                ? preProcessed.parsedIntent
                : await parseIntent(lastUserMessage, {
                    userAddress: task.toolContext?.walletAddress,
                    chainId: task.toolContext?.chainId,
                    isWalletConnected: !!task.toolContext?.walletAddress,
                });

            if (iteration === 1) {
                await this.recordIntentTrace(task, sessionMessages, parsedIntent, lastUserMessage);
            }

            if (task.sessionId) {
                this.broadcastTaskStatus(userId, task, { status: 'running', message: 'Identifying intent', taskType });
            }

            // Use high-level intent for system prompt selection
            const intent: IntentType = parsedIntent.highLevel.type;
            const routingMode = this.resolveRoutingMode(intent, parsedIntent.decision);
            if (iteration === 1) {
                const decisionMeta = parsedIntent.decision as any;
                toolTrace.mode = 'execution';
                toolTrace.skillVersion = 'exec';
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
                const registry = skillRegistryExec;
                const matchedSkills = registry.getSkillsByIntent(intentStr);
                const allowedToolNames = new Set<string>();
                for (const skill of matchedSkills) {
                    for (const name of skill.metadata.tools || []) {
                        allowedToolNames.add(name);
                    }
                }
                // Keep explicit tool gating only; do not add broad web fallback here.

                if (matchedSkills.length > 0 && allowedToolNames.size > 0) {
                    const gated = baseToolDefs.filter(def => allowedToolNames.has(def.name));
                    if (gated.length > 0) {
                        toolDefinitions = gated.map(def => ({ type: 'function', function: def }));
                        logger.info(LogCode.AI_ORCHESTRATOR, 'Skill-gated toolset applied', {
                            taskId: task.id,
                            toolCount: toolDefinitions.length,
                            intent: intentStr,
                            skills: matchedSkills.map(s => s.metadata.id),
                        });
                        logger.info(LogCode.AI_SKILLS_ATTACHED, 'DeepSeek: skills attached', {
                            taskId: task.id,
                            sessionId: task.sessionId,
                            model: task.model,
                            intent: intentStr,
                            routingMode,
                            skillVersion: 'exec',
                            skills: matchedSkills.map(s => s.metadata.id),
                            toolCount: toolDefinitions.length,
                        });
                    } else {
                        logger.warn(LogCode.AI_ORCHESTRATOR, 'Skill gating produced empty toolset', {
                            taskId: task.id,
                            intent: intentStr,
                        });
                    }
                }
            }

            // Log detailed intent for debugging

            // 🚀 PRE-EMPTIVE TOOL EXECUTION (Phase 5: Intent-based)
            // Start pre-fetching high-confidence tool results in parallel with the first LLM request
            if (iteration === 1) {
                earlyPreFetchPromise = this.preFetchByIntent(task, parsedIntent, toolResultsCache).catch(err => {
                    logger.warn(LogCode.API_FETCH_FAILED, 'Early pre-fetch failed (non-blocking)', {
                        taskId: task.id,
                        error: err?.message || String(err),
                    });
                });
            }

            // 🔧 DEBUG: Log user settings for diagnostics
            logger.info(LogCode.AI_ORCHESTRATOR, 'ChatWorker user settings snapshot', {
                fastSwapMode: task.toolContext?.toolConfig?.fastSwapMode,
                swapMethod: 'allowance_trade', // FORCED: Always allowance_trade
                toolConfig: task.toolContext?.toolConfig ? Object.keys(task.toolContext.toolConfig) : 'none',
                walletConnected: !!task.toolContext?.walletAddress,
                chainId: task.toolContext?.chainId,
            });

            const fastSwapDecision = getFastSwapDecision({
                parsedIntent,
                lastUserMessage,
                toolContext: task.toolContext,
            });
            const fastSwapMode = fastSwapDecision.fastSwapMode;
            const hasSwapTarget = fastSwapDecision.hasSwapTarget;
            const hasExplicitSwapVerb = fastSwapDecision.hasExplicitSwapVerb;

            if (fastSwapDecision.requiresAddressForFastSwap) {
                logger.info(LogCode.AI_ORCHESTRATOR, 'Fast swap requires explicit contract address', {
                    taskId: task.id,
                    chainId: task.toolContext?.chainId || parsedIntent?.chainId,
                    tokenOut: parsedIntent?.swapIntent?.tokenOut,
                });
                (task as any).systemInjection = 'FAST SWAP ADDRESS REQUIRED: Fast Swap Mode is ON. Native whitelist tokens may proceed without address, but any other token requires the exact contract address from the user before continuing. Do NOT resolve non-whitelisted token names via cache, search, or inference. Ask a short follow-up for the contract address.';
            }

            if (!fastSwapAttempted && fastSwapDecision.shouldAttempt) {
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
                    logger.info(LogCode.AI_ORCHESTRATOR, 'Fast swap message_start broadcasted', {
                        assistantMessageId,
                        taskId: task.id,
                    });
                }

                // ⚡ SKIP initial task_status - directly to swap execution
                // Remove unnecessary "Analyzing swap request" broadcast

                const prepared = await prepareFastSwapExecution({
                    parsedIntent,
                    lastUserMessage,
                    taskToolContext: task.toolContext,
                    chainIdMap: CHAIN_ID_MAP,
                    findSnapshotBalance: (token, chain, isNative) =>
                        this.findSnapshotBalanceForToken(task, token, chain, isNative),
                    fetchOnchainBalance: (walletAddress, chain, token, isNative) =>
                        this.fetchOnchainBalanceForToken(walletAddress, chain, token, isNative),
                    resolveSolWallet: (uid) => privyWallet.getSolanaEmbeddedWalletAddress(uid),
                    resolveEvmWallet: (uid) => privyWallet.getEmbeddedWalletAddress(uid),
                });
                let tokenIn = prepared.tokenIn;
                let tokenOut = prepared.tokenOut;
                let amountIn = prepared.amountIn;
                const chainId = prepared.chainId;
                const actualChainName = prepared.actualChainName;
                const resolvedWalletAddress = prepared.resolvedWalletAddress;

                if (resolvedWalletAddress && task.toolContext?.walletAddress !== resolvedWalletAddress) {
                    task.toolContext = {
                        ...task.toolContext,
                        walletAddress: resolvedWalletAddress,
                    };
                }

                // Check if we have a valid amount to proceed
                if (prepared.shouldFallbackToLlm) {
                    logger.info(LogCode.AI_ORCHESTRATOR, 'Fast swap prepared amount invalid; fallback to LLM', {
                        tokenIn,
                        chain: actualChainName,
                        amountIn,
                    });
                    // Inject context about why it failed to help LLM guide the user
                    (task as any).systemInjection = `⚠️ BALANCE AUTO-RESOLUTION ISSUE:\nToken: ${tokenIn}\nChain: ${actualChainName}\nStatus: Not found in cached portfolio snapshot\n\nNEXT STEPS:\n1. Check if token balance appears in [USER_BALANCE_CONTEXT] or [REQUESTED_TOKEN_BALANCE] sections\n2. If balance shows as "not present" but user owns it, the swap can still proceed (they'll confirm amount)\n3. If balance is truly 0, inform user they don't hold this token\n4. DO NOT hallucinate or guess the balance - use only data from context blocks above`;
                    // Do not execute fast swap, fall through to LLM
                } else {
                    // ⚡ PERFORMANCE: Execute swap directly via MainSwapService - NO status broadcast
                    // Import MainSwapService for unified swap execution
                    const { MainSwapService } = await import('../services/MainSwapService.js');

                    // ⚡ Create transaction card message BEFORE executing swap
                    const { createMessage } = await import('../repositories/chatRepository.js');

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
                                swapType: inferSwapCardType({
                                    tokenIn,
                                    tokenOut,
                                    tokenInSymbol,
                                    tokenOutSymbol,
                                    chainId,
                                }),
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

                    const taskUserId = task.toolContext?.userId || '';
                    const pendingCardData = {
                        status: 'pending',
                        tokenIn,
                        tokenOut,
                        tokenInSymbol,
                        tokenOutSymbol,
                        amountIn,
                        chainId,
                        isLoading: true
                    };
                    if (taskUserId) {
                        this.ws.broadcastToUser(taskUserId, {
                            type: 'client_action',
                            sessionId: task.sessionId,
                            data: {
                                targetMessageId: transactionMessage.id,
                                action: {
                                    type: 'show_transaction_status_card',
                                    data: pendingCardData
                                }
                            }
                        });
                    }
                    let cardData: any = this.parseCardMessageData(transactionMessage.data, transactionMessage.id);
                    cardData = { ...cardData, ...pendingCardData };

                    let fastSwapFinalized = false;

                    // ⚡ Pre-warm quote for better UX (estimated receive)
                    (async () => {
                        try {
                            const API_BASE = process.env.API_BASE_URL ||
                                (process.env.PORT ? `http://127.0.0.1:${process.env.PORT}` : 'http://localhost:3001');
                            const appKey = process.env.KIKO_WEB_APP_KEY || process.env.KIKO_MOBILE_APP_KEY || '';
                            const body = JSON.stringify({
                                tokenIn,
                                tokenOut,
                                amountIn,
                                chainId,
                                slippageBps: 1000,
                                userAddress: task.toolContext?.walletAddress
                            });

                            const response = await fetch(`${API_BASE}/api/swap/quote`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    ...(appKey ? { 'X-App-Key': appKey } : {}),
                                    ...buildSignedHeaders('POST', '/api/swap/quote', body)
                                },
                                body
                            });

                            if (!response.ok) return;
                            const quote = await response.json() as any;
                            const estimatedOut = quote?.data?.amountOut;
                            if (!estimatedOut || fastSwapFinalized) return;

                            cardData = {
                                ...cardData,
                                amountOut: estimatedOut,
                                isLoading: false
                            };
                            await this.updateAndBroadcastTransactionCard({
                                messageId: transactionMessage.id,
                                sessionId: task.sessionId,
                                userId: taskUserId,
                                data: cardData,
                            });
                        } catch (err) {
                            logger.warn(LogCode.API_FETCH_FAILED, 'Fast swap pre-quote failed', {
                                taskId: task.id,
                                error: (err as Error).message,
                            });
                        }
                    })().catch(() => { });

                    let swapResult: any;
                    try {
                        swapResult = await MainSwapService.executeSwap({
                            userId: task.toolContext?.userId || '',
                            walletAddress: task.toolContext?.walletAddress || resolvedWalletAddress || '',
                            tokenIn,
                            tokenOut,
                            amountIn,
                            chainId,
                            slippageBps: 300, // 3% for chat fast swaps
                            mode: 'fast-swap', // Indicates AI-driven instant swap with bypass logic
                            executionSource: 'chat',
                            routePolicy: 'external_only',
                            messageId: transactionMessage.id, // Pass messageId for retry updates
                            userSettings: {
                                swapMethod: 'allowance_trade', // CRITICAL: Fast swap = allowance trade mode
                                fastSwapMode: true,
                                mevProtection: true
                            }
                        });
                    } catch (err: any) {
                        const errMessage = err?.message || 'Swap failed';
                        fastSwapFinalized = true;

                        cardData = {
                            ...cardData,
                            status: 'failed',
                            error: errMessage,
                            errorMessage: errMessage,
                            completedAt: Date.now(),
                            duration: Date.now() - (cardData.startedAt || Date.now()),
                            message: `❌ Swap failed: ${errMessage}`,
                            isLoading: false
                        };

                        await this.updateAndBroadcastTransactionCard({
                            messageId: transactionMessage.id,
                            sessionId: task.sessionId,
                            userId: taskUserId,
                            data: cardData,
                            status: 'complete',
                        });

                        this.broadcastAssistantMessageComplete(taskUserId, task.sessionId, assistantMessageId);

                        await this.repo.updateTaskStatus(task.id, 'done');
                        this.broadcastTaskStatus(taskUserId || userId, task, { taskId: task.id, status: 'done' });
                        return;
                    }

                    // ⚡ Update transaction message with final result
                    const finalStatus = swapResult.success ? 'success' : 'failed';
                    const rawAmountOut = swapResult.amountOut ?? cardData.amountOut;
                    const formattedAmountOut = rawAmountOut
                        ? parseFloat(String(rawAmountOut)).toLocaleString('en-US', { maximumFractionDigits: 6 })
                        : cardData.amountOut;

                    cardData = {
                        ...cardData,
                        status: finalStatus,
                        txHash: swapResult.txHash,
                        amountOut: formattedAmountOut,
                        error: swapResult.error,
                        errorMessage: swapResult.error,
                        completedAt: Date.now(),
                        duration: Date.now() - (cardData.startedAt || Date.now()),
                        message: finalStatus === 'success'
                            ? `✅ Fast swap completed! ${swapResult.txHash?.slice(0, 10)}...`
                            : `❌ Swap failed: ${swapResult.error}`,
                        isLoading: false
                    };
                    await this.updateAndBroadcastTransactionCard({
                        messageId: transactionMessage.id,
                        sessionId: task.sessionId,
                        userId: taskUserId,
                        data: cardData,
                        status: 'complete',
                    });
                    fastSwapFinalized = true;

                    this.broadcastAssistantMessageComplete(taskUserId, task.sessionId, assistantMessageId);

                    // If swap was successful, complete the task and return
                    await this.repo.updateTaskStatus(task.id, 'done');
                    this.broadcastTaskStatus(taskUserId || userId, task, { taskId: task.id, status: 'done' });
                    return;

                } // end else (amountIn is valid)

            } // end if (fastSwapMode && isSwapIntent && hasSwapTarget && hasExplicitSwapVerb)

            // SAFE MODE: If user sends token address without explicit buy/sell intent, ask for confirmation
            // This applies when fast swap is enabled (either via fastSwapMode or allowance_trade)
            if (fastSwapMode && hasSwapTarget && !hasExplicitSwapVerb) {
                logger.info(LogCode.AI_ORCHESTRATOR, 'Fast swap safe mode activated', {
                    taskId: task.id,
                    reason: 'token_detected_without_explicit_trade_verb',
                });
                (task as any).systemInjection = 'FAST SWAP SAFE MODE: User shared a token address without explicit trade intent. Ask a short confirmation question: trade now or analyze? Do not execute any trade without a clear buy/sell instruction.';
            } // end if (fastSwapMode && hasSwapTarget && !hasExplicitSwapVerb)

            // Latency optimization: do NOT block the first model call on pre-fetch.
            // We still await this promise later (right before tool execution) to keep correctness.
            if (earlyPreFetchPromise) {
                logger.debug(LogCode.AI_API_CALL, 'ChatWorker: early pre-fetch still running; continue without blocking first call', {
                    taskId: task.id,
                    sessionId: task.sessionId,
                });
            }

            // Detect and resolve contract address if present
            let detectedChainId = task.toolContext?.chainId;
            let detectedChainName: string | undefined;
            let tokenInfo: any = null;
            if (parsedIntent.contractAddress) {
                logger.info(LogCode.AI_API_CALL, 'Contract address detected in user intent', {
                    taskId: task.id,
                    contractAddress: parsedIntent.contractAddress,
                });
                const resolved = await this.resolveTokenContext({
                    mode: 'deepseek',
                    task,
                    parsedIntent,
                    toolResultsCache,
                    userId,
                    detectedChainId,
                    detectedLaunchpadInfo,
                    broadcastScanningStatus: true,
                });
                detectedChainId = resolved.detectedChainId;
                detectedChainName = resolved.detectedChainName;
                tokenInfo = resolved.tokenInfo;
                detectedLaunchpadInfo = resolved.detectedLaunchpadInfo;
                if (tokenInfo) {
                    logger.info(LogCode.AI_API_CALL, 'Token context resolved', {
                        taskId: task.id,
                        symbol: tokenInfo.symbol,
                        chainName: tokenInfo.chainName,
                        chainId: tokenInfo.chainId,
                    });
                }
                if (detectedLaunchpadInfo) {
                    logger.info(LogCode.AI_LAUNCHPAD_DETECTED, 'Launchpad context available', {
                        taskId: task.id,
                        provider: detectedLaunchpadInfo.provider,
                    });
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

            const fullUserContext = this.buildUserContext(
                task,
                { chainId: detectedChainId || task.toolContext?.chainId, chainName: detectedChainName },
                parsedIntent
            );
            const userContext: UserContext = fullUserContext;

            // Inject Context into the LATEST User Message
            // We find the last message from 'user' in the history and wrap it
            let finalMessages = [...transformedHistory];
            const lastUserIndex = finalMessages.map(m => m.role).lastIndexOf('user');

            let balanceContextBlock = '';
            let tokenContextAvailable = false;
            let launchpadContextAvailable = false;
            let didInjectUserContext = false;
            if (lastUserIndex !== -1) {
                const lastMsg = finalMessages[lastUserIndex];

                // Add token info to context if detected
                let tokenContextBlock = '';
                let launchpadContextBlock = '';
                const requestedAddressSet = new Set<string>();
                if (parsedIntent?.contractAddress) {
                    requestedAddressSet.add(String(parsedIntent.contractAddress).toLowerCase());
                }
                const tokenIn = parsedIntent?.detailed?.token_in;
                const tokenOut = parsedIntent?.detailed?.token_out;
                const isAddressLike = (value?: string) => {
                    if (!value) return false;
                    const v = value.toLowerCase();
                    return v.startsWith('0x') || v.length >= 32;
                };
                if (isAddressLike(String(tokenIn || ''))) requestedAddressSet.add(String(tokenIn).toLowerCase());
                if (isAddressLike(String(tokenOut || ''))) requestedAddressSet.add(String(tokenOut).toLowerCase());

                const cacheStatus = toolResultsCache.has(`get_token_info:${this.stableStringify({ address: parsedIntent.contractAddress, chainId: detectedChainId || task.toolContext?.chainId })}`)
                    ? '✅ FROM CACHE'
                    : '🔄 FRESHLY FETCHED';
                const tokenBlock = buildTokenContextBlock({
                    mode: 'deepseek',
                    tokenInfo,
                    contractAddress: parsedIntent?.contractAddress,
                    cacheStatusLabel: cacheStatus,
                });
                tokenContextBlock = tokenBlock.tokenContextBlock;
                tokenContextAvailable = tokenBlock.tokenContextAvailable;

                const launchpadBlock = buildLaunchpadContextBlock({
                    launchpadInfo: detectedLaunchpadInfo,
                    tokenInfo,
                    fallbackAddress: parsedIntent?.contractAddress,
                    fallbackChainId: detectedChainId || task.toolContext?.chainId,
                });
                launchpadContextBlock = launchpadBlock.launchpadContextBlock;
                launchpadContextAvailable = launchpadBlock.launchpadContextAvailable;

                if (parsedIntent?.contractAddress) {
                    tokenContextBlock += `\n\n[USER_INPUT_CONTEXT]
Detected Contract Address: ${parsedIntent.contractAddress}
`;
                }

                // Build balance context via a single balance pipeline.
                const requestedTokens = new Set<string>();
                if (tokenIn) requestedTokens.add(String(tokenIn));
                if (tokenOut) requestedTokens.add(String(tokenOut));
                if (tokenInfo?.address) requestedTokens.add(String(tokenInfo.address));
                const nativePriceSnapshot = await this.resolveNativePriceSnapshot(task.toolContext?.chainId, toolResultsCache);

                const balanceContext = this.buildBalanceContext({
                    toolContext: task.toolContext,
                    toolResultsCache,
                    nativeSymbol: nativePriceSnapshot.nativeSymbol,
                    nativePriceUsd: nativePriceSnapshot.nativePriceUsd,
                    nativePriceSource: nativePriceSnapshot.nativePriceSource,
                    nativePriceFetchedAt: nativePriceSnapshot.nativePriceFetchedAt,
                    balanceSnapshotAt: this.getBalanceSnapshotTimestamp(task.toolContext),
                    requestedAddressSet,
                    requestedTokens: Array.from(requestedTokens),
                    // Keep DeepSeek path behavior focused: inject requested balances + availability only.
                    includePortfolioBlock: false,
                    includeRequestedTokenBlock: true,
                    includeExecutionRule: false,
                    chainLabel: String(task.toolContext?.chainId || 'Unknown'),
                    isExecutionIntent: EXECUTION_INTENTS.has(intent),
                });

                let tokensInPortfolio: string[] = balanceContext.tokensInPortfolio;
                if (balanceContext.cacheHit) {
                    logger.debug(LogCode.CACHE_HIT, 'Wallet context cache hit', {
                        taskId: task.id,
                        tokenCount: balanceContext.tokenCount,
                    });
                }
                tokenContextBlock += balanceContext.tokenContextBlock;
                balanceContextBlock += balanceContext.tokenContextBlock;
                const needUsdGuardrail = this.requiresUsdPriceGuardrail(lastUserMessage, parsedIntent);
                if (needUsdGuardrail) {
                    const hasNativePrice = Number.isFinite(nativePriceSnapshot.nativePriceUsd || NaN) && (nativePriceSnapshot.nativePriceUsd || 0) > 0;
                    tokenContextBlock = this.appendPriceGuardrailBlock(tokenContextBlock, {
                        nativeSymbol: nativePriceSnapshot.nativeSymbol,
                        hasNativePrice,
                    });
                    if (!hasNativePrice) {
                        toolDefinitions = this.ensureToolDefinitionPresent(toolDefinitions, baseToolDefs, 'get_token_price');
                    }
                }

                if (balanceContext.requestedTokenBlock) {
                    logger.info(LogCode.AI_API_CALL, 'ChatWorker: requested token balance resolved', {
                        walletAddress: task.toolContext?.walletAddress,
                        chainId: task.toolContext?.chainId,
                        requested: Array.from(requestedTokens),
                        matched: balanceContext.requestedMatched,
                        missing: balanceContext.requestedMissing,
                        resolvedBalances: balanceContext.resolvedBalances,
                    });
                }


                // Check if detected token is missing from portfolio and add it directly
                if (task.toolContext?.walletAddress) {
                    if (tokenInfo && tokenInfo.address && task.toolContext?.walletAddress) {
                        if (!tokensInPortfolio.includes(tokenInfo.address.toLowerCase())) {
                            try {
                                logger.info(LogCode.AI_API_CALL, 'Token not in portfolio; querying direct balance', {
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

                                logger.debug(LogCode.AI_API_CALL, 'Direct token balance query chain selected', {
                                    chainName,
                                    taskId: task.id,
                                });
                                const directBalance = await this.withTimeout(
                                    alchemy.getSpecificTokenBalance(
                                        task.toolContext.walletAddress,
                                        chainName,
                                        tokenInfo.address
                                    ),
                                    Math.max(250, parseInt(process.env.CHAT_DIRECT_BALANCE_TIMEOUT_MS || '700', 10) || 700),
                                    'direct_token_balance_query',
                                    null as any
                                );
                                if (!directBalance) {
                                    throw new Error('direct balance query timed out');
                                }

                                logger.debug(LogCode.AI_API_CALL, 'Direct token balance raw result', {
                                    raw: directBalance?.raw,
                                    decimals: directBalance?.decimals,
                                    formatted: directBalance?.formatted
                                });

                                // CRITICAL FIX: directBalance returns {raw, decimals, formatted}, not a number
                                const balanceNum = parseFloat(directBalance?.formatted || '0');
                                logger.debug(LogCode.AI_API_CALL, 'Direct token balance parsed', {
                                    taskId: task.id,
                                    symbol: tokenInfo.symbol,
                                    balanceNum,
                                });

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
                                    logger.info(LogCode.AI_API_CALL, 'Direct balance injected into token context', {
                                        taskId: task.id,
                                        symbol: tokenInfo.symbol,
                                        balance: directBalance.formatted,
                                    });
                                } else {
                                    logger.info(LogCode.AI_API_CALL, 'Direct balance unavailable or zero', {
                                        taskId: task.id,
                                        symbol: tokenInfo.symbol,
                                    });
                                }
                            } catch (e: any) {
                                logger.error(LogCode.SYS_ERROR, 'Failed to add direct token balance', {
                                    taskId: task.id,
                                    error: e.message,
                                    stack: e.stack?.split('\n').slice(0, 3).join('\n'),
                                });
                            }
                        } else {
                            logger.debug(LogCode.CACHE_HIT, 'Token already present in portfolio cache', {
                                taskId: task.id,
                                symbol: tokenInfo.symbol,
                            });
                        }
                    } else {
                        if (!tokenInfo) {
                            logger.debug(LogCode.AI_API_CALL, 'No tokenInfo available for direct balance injection', {
                                taskId: task.id,
                            });
                        } else {
                            logger.debug(LogCode.AI_API_CALL, 'Skipping direct balance injection due to missing wallet/token', {
                                taskId: task.id,
                            });
                        }
                    }
                }

                const isExecutionIntent = EXECUTION_INTENTS.has(intent);
                // For execution intents, keep prompt focused on trading-critical state.
                if (!isExecutionIntent) {
                    // Add social info if pre-fetched
                    const socialKey = `get_trending_casts:${this.stableStringify({})}`;
                    if (toolResultsCache.has(socialKey)) {
                        logger.debug(LogCode.CACHE_HIT, 'Trending casts context cache hit', {
                            taskId: task.id,
                        });
                        const socialData = toolResultsCache.get(socialKey);
                        if (socialData && Array.isArray(socialData)) {
                            tokenContextBlock += `\n\n[FARCASTER_TRENDING_CONTEXT]
Recent Hot Casts:
${socialData.slice(0, 5).map((c: any) => `- @${c.author?.username}: ${c.text.slice(0, 100)}...`).join('\n')}
`;
                        }
                    }
                }

                // Use Orchestrator to build the full prompt with context and anti-override
                if (task.sessionId) {
                    this.broadcastTaskStatus(userId, task, { status: 'running', message: 'Building context' });
                }
                const extraBlocks: string[] = [];
                if (tokenContextBlock) extraBlocks.push(tokenContextBlock);
                if (launchpadContextBlock) extraBlocks.push(launchpadContextBlock);

                const enrichedContent = this.buildEnrichedUserContent({
                    userQuery: lastMsg.content,
                    userContext,
                    intent,
                    extraBlocks,
                });

                // Create a shallow copy of the message with new content to send to LLM
                // (We don't update DB history to keep it clean, only what the LLM sees)
                finalMessages = this.injectEnrichedUserContent(finalMessages, lastUserIndex, enrichedContent);
                didInjectUserContext = true;
                logger.debug(LogCode.AI_API_CALL, 'User prompt enriched with context', {
                    taskId: task.id,
                    userAddress: userContext.userAddress || 'guest',
                });
            }

            // Apply context budget in unified orchestrator mode to reduce token cost.
            let compactedHistoryMessage: string | undefined;
            if (this.isUnifiedOrchestrator()) {
                const budgetSourceMessages = [...finalMessages];
                const budgetResult = this.applyContextBudgetWithMetrics(finalMessages, task, 'ChatWorker');
                finalMessages = this.ensureCriticalContextPinned(budgetResult.messages, budgetSourceMessages);
                compactedHistoryMessage = budgetResult.compactedHistoryMessage;
                lastBudgetMetrics = budgetResult.metrics;
                if (budgetResult.compactedHistoryMessage) {
                    await this.persistConversationRef(task, {
                        compactionCursor: `cmp_${Date.now()}`,
                    });
                }
            }

            // Start building messages
            const messages: any[] = [{ role: 'system', content: systemPrompt }];
            if (compactedHistoryMessage) {
                messages.push({ role: 'system', content: compactedHistoryMessage });
            }
            const resolvedMessages = this.attachFallbackSystemContext({
                messages,
                task,
                didInjectUserContext,
                balanceContextBlock,
                providerLabel: 'ChatWorker',
            });
            // No additional guidance injected; only context is provided.

            toolDefinitions = this.pruneToolsWithContextAvailability(toolDefinitions, {
                tokenContextAvailable,
                launchpadContextAvailable,
                providerLabel: 'ChatWorker',
            });

            const normalizedModelName = normalizeModel(task.model);
            const provider = this.resolveProvider(normalizedModelName);
            let requestBody: any;
            if (this.isUnifiedOrchestrator()) {
                const allowedToolNames = toolDefinitions.map(t => t.function?.name).filter(Boolean) as string[];
                const conversationRef = this.buildConversationRef(session);
                const gateway = modelGateway.prepareRequest({
                    model: normalizedModelName,
                    provider,
                    system: messages[0].content,
                    messages: [...resolvedMessages.slice(1), ...finalMessages],
                    tools: toolDefinitions as any,
                    allowedTools: { names: allowedToolNames },
                    conversationRef,
                    stream: true,
                    metadata: {
                        orchestrator: 'unified',
                        input_tokens_estimated: lastBudgetMetrics?.inputTokensEstimated,
                    },
                });
                requestBody = gateway.requestBody;
            } else {
                requestBody = {
                    model: normalizedModelName,
                    messages: [...resolvedMessages, ...finalMessages],
                    stream: true,
                    tools: toolDefinitions,
                    tool_choice: 'auto'
                };
            }
            const normalizedRequestModel = String(requestBody.model || '').toLowerCase();
            const useOpenAI = normalizedRequestModel.startsWith('gpt');
            const providerLabel = useOpenAI ? 'OpenAI' : 'DeepSeek';
            // chat.completions path does not require metadata for our flow.
            // Strip it to avoid provider-side validation differences.
            if (requestBody.metadata) {
                delete requestBody.metadata;
            }
            if (useOpenAI) {
                // OpenAI only returns usage in streaming when include_usage is enabled.
                requestBody.stream_options = { include_usage: true };
            }
            const targetUrl = useOpenAI ? OPENAI_API_URL : DEEPSEEK_API_URL;
            const apiKey = useOpenAI ? OPENAI_API_KEY : DEEPSEEK_API_KEY;
            if (!apiKey) {
                throw new Error(useOpenAI ? 'OPENAI_API_KEY is not configured' : 'DEEPSEEK_API_KEY is not configured');
            }

            // Broadcast running state before API call
            // IMPORTANT: Message order should be:
            // 1. message_start (already sent at line ~598)
            // 2. task_status: Running (this message)
            // 3. content chunks (sent during streaming)
            logger.debug(LogCode.WS_MESSAGE_SENT, 'Broadcasting running status', {
                taskId: task.id,
                assistantMessageId,
            });

            this.broadcastTaskStatus(userId, task, { status: 'running', message: this.getIntentStatusMessage(preProcessed?.parsedIntent) });

            let response: Response | undefined;
            let retryCount = 0;
            const maxRetries = 3;
            const apiRequestStartedAt = Date.now();
            let firstTokenAt: number | null = null;

            // Start retry loop
            while (retryCount < maxRetries) {
                try {
                    response = await fetch(targetUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`,
                        },
                        body: JSON.stringify(requestBody),
                    });

                    if (response.ok) break;

                    // If not ok, throw to trigger retry unless it's a 4xx error (client error)
                    if (response.status >= 400 && response.status < 500) {
                        const err: any = await response.json().catch(() => ({ error: { message: response?.statusText } }));
                        throw new Error(`${providerLabel} API error: ${err.error?.message || response?.statusText}`);
                    }
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                } catch (error: any) {
                    retryCount++;
                    logger.warn(LogCode.API_FETCH_FAILED, 'Provider API attempt failed', {
                        taskId: task.id,
                        provider: providerLabel,
                        retryCount,
                        error: error.message,
                    });
                    if (retryCount === maxRetries) throw error;
                    // Exponential backoff: 1s, 2s, 4s
                    await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
                }
            }

            if (!response || !response.ok) {
                // Try to get error details if response exists
                let errorMessage = `${providerLabel} API failed after ${maxRetries} attempts`;
                if (response) {
                    try {
                        const err: any = await response.json();
                        errorMessage = `${providerLabel} API error: ${err.error?.message || response.statusText}`;
                    } catch (e) {
                        errorMessage = `${providerLabel} API error: ${response.statusText}`;
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
            const STREAM_TIMEOUT_MS = 60000; // 60 seconds per chunk - generous for long reasoning responses

            // Initialize chunk counter for periodic cancellation checks
            let chunkCounter = 0;
            const CHECK_CANCEL_INTERVAL = 5; // Check Redis every 5 chunks (near-instant)
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
                        const cancelled = await this.checkTaskCancelled(task.id, 'DeepSeek');
                        if (cancelled) {
                            logger.info(LogCode.AI_ORCHESTRATOR, 'DeepSeek stream cancelled by user', {
                                taskId: task.id,
                            });
                            throw new Error('Task cancelled by user');
                        }
                    }

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (!line.startsWith('data: ') || line.trim() === 'data: [DONE]') continue;

                        try {
                            const data = JSON.parse(line.slice(6));
                            if (typeof data?.response_id === 'string') latestProviderResponseId = data.response_id;
                            if (typeof data?.id === 'string') latestProviderResponseId = data.id;
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
                                if (firstTokenAt === null) {
                                    firstTokenAt = Date.now();
                                    this.broadcastLatencyMetrics(userId, task, {
                                        ttftMs: firstTokenAt - apiRequestStartedAt,
                                        contextAssemblyMs: apiRequestStartedAt - taskProcessStartedAt,
                                        inputTokensEstimated: lastBudgetMetrics?.inputTokensEstimated,
                                        historyKept: lastBudgetMetrics?.historyKept,
                                        historyCompacted: lastBudgetMetrics?.historyCompacted,
                                        compactionHits: lastBudgetMetrics?.compactionHits,
                                        toolRounds: iteration,
                                    });
                                }
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
                                if (firstTokenAt === null) {
                                    firstTokenAt = Date.now();
                                    this.broadcastLatencyMetrics(userId, task, {
                                        ttftMs: firstTokenAt - apiRequestStartedAt,
                                        contextAssemblyMs: apiRequestStartedAt - taskProcessStartedAt,
                                        inputTokensEstimated: lastBudgetMetrics?.inputTokensEstimated,
                                        historyKept: lastBudgetMetrics?.historyKept,
                                        historyCompacted: lastBudgetMetrics?.historyCompacted,
                                        compactionHits: lastBudgetMetrics?.compactionHits,
                                        toolRounds: iteration,
                                    });
                                }
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
                                    logger.debug(LogCode.AI_API_CALL, 'Detected tool calls in stream, starting pre-fetch', {
                                        taskId: task.id,
                                    });
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
                    logger.warn(LogCode.AI_ORCHESTRATOR, 'Aborting stream due to cancellation', {
                        taskId: task.id,
                    });
                } else {
                    logger.warn(LogCode.API_FETCH_FAILED, 'Stream interrupted', {
                        taskId: task.id,
                        error: err.message,
                    });
                    // For meaningful interruptions (timeouts, network), show a message
                    if (!totalContent && !hasToolCalls && !iterContent) {
                        const fallbackMessage = '\n\n⚠️ *Generation interrupted. Please try again.*';
                        totalContent += fallbackMessage;
                        iterContent += fallbackMessage;
                    }
                }
            }

            if (streamError && lastToolResults.length > 0) {
                const fallback = this.buildToolFallbackMessage(lastToolResults);
                if (fallback) {
                    totalContent = (totalContent || '') + (totalContent ? '\n\n' : '') + fallback;
                    iterContent += fallback;
                    const fallbackChunk = {
                        index: chunkIndex++,
                        type: 'content' as const,
                        content: fallback,
                        delta: fallback,
                        messageId: assistantMessageId
                    };
                    this.ws.broadcastToUser(userId!, {
                        type: 'chunk',
                        sessionId: task.sessionId,
                        data: fallbackChunk
                    });
                }
            }

            // CRITICAL: Detect empty output from DeepSeek
            // This occurs when the model fails to generate any content or tool calls
            // Common causes: ambiguous prompts, context too long, or model confusion
            if (!iterContent && !hasToolCalls && !totalContent && !streamError) {
                logger.warn(LogCode.AI_API_CALL, 'DeepSeek returned empty output', {
                    taskId: task.id,
                });
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
            await this.persistAssistantMessageSafe({
                assistantMessageId,
                patch: {
                    content: totalContent,
                    reasoning_content: totalReasoning,
                    tool_calls: hasToolCalls ? toolCalls.filter(Boolean) : undefined,
                    usage: lastUsage || undefined,
                    citations: allCitations.length > 0 ? allCitations : undefined,
                    status: hasToolCalls ? 'streaming' : 'complete'
                },
                logLabel: 'DeepSeek iteration update',
            });

            // Process tool results
            if (hasToolCalls) {
                const currentToolCalls = toolCalls.filter(Boolean);
                totalToolCallsCount += currentToolCalls.length;
                for (const tc of currentToolCalls) {
                    const name = String(tc?.function?.name || '').trim().toLowerCase();
                    if (name) totalToolCallNames.push(name);
                }

                // CRITICAL FIX: Add the assistant message to in-memory history 
                // so the following tool messages have a valid predecessor for the LLM API.
                history.push({
                    role: 'assistant',
                    content: iterContent,
                    reasoning_content: iterReasoning,
                    tool_calls: currentToolCalls
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
                lastToolResults = toolResults;
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
                    r.startsWith('tool_call_limit')
                    || r.startsWith('tool_repeat_limit')
                    || r.startsWith('tool_failure_limit')
                    || r.startsWith('tool_consecutive_limit')
                    || r.startsWith('polymarket_search_no_match_limit')
                );
                if (loopStopReasons.length > 0) {
                    const isPolymarketNoMatch = loopStopReasons.some(r => r.startsWith('polymarket_search_no_match_limit'));
                    const notice = isPolymarketNoMatch
                        ? `\n\n⚠️ *No exact Polymarket market found after repeated searches. The market may not exist on Polymarket. Please refine the query or share a direct market link.*`
                        : `\n\n⚠️ *Tool usage limit reached. Please refine your request or provide more specific inputs.*`;
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
        if (latestProviderResponseId && this.isUnifiedOrchestrator()) {
            await this.persistConversationRef(task, { previousResponseId: latestProviderResponseId });
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
            logger.warn(LogCode.DB_TRANSACTION_FAILED, 'ChatWorker: failed to persist tool trace', { error: traceErr?.message || traceErr });
        }

        // CRITICAL FIX: Persist final message state for successful completion
        // Without this, status remains 'streaming' and data is lost on refresh
        if (iteration < maxIterations) {
            await this.persistAssistantMessageSafe({
                assistantMessageId,
                patch: {
                    content: totalContent,
                    reasoning_content: totalReasoning,
                    usage: lastUsage || undefined,
                    citations: allCitations.length > 0 ? allCitations : undefined,
                    compacted_data: {
                        summaryVersion: 1,
                        toolCalls: toolTrace.toolCalls.length,
                        stopReasons: Array.from(new Set(toolTrace.stopReasons)),
                        citationCount: allCitations.length,
                    },
                    status: 'complete'
                },
                logLabel: 'DeepSeek final update',
            });
            logger.debug(LogCode.AI_API_CALL, 'ChatWorker: DeepSeek final message persisted', { assistantMessageId });
            await this.persistBillingUsage({
                assistantMessageId,
                userId,
                model: task.model,
                usage: lastUsage,
                toolContext: task.toolContext,
                toolCallsCount: totalToolCallsCount,
                toolCallNames: totalToolCallNames
            });

            // CRITICAL: Broadcast message_complete to frontend so it stops showing "Thinking"
            logger.debug(LogCode.WS_MESSAGE_SENT, 'Broadcasting message_complete', { assistantMessageId, status: 'success' });
            this.broadcastLatencyMetrics(userId, task, {
                latencyMs: Date.now() - taskProcessStartedAt,
                inputTokensEstimated: lastBudgetMetrics?.inputTokensEstimated,
                promptTokens: lastUsage?.prompt_tokens,
                completionTokens: lastUsage?.completion_tokens,
                totalTokens: lastUsage?.total_tokens,
                cachedTokens: lastUsage?.prompt_tokens_details?.cached_tokens,
                toolRounds: iteration,
                compactionHits: lastBudgetMetrics?.compactionHits || 0,
                historyKept: lastBudgetMetrics?.historyKept,
                historyCompacted: lastBudgetMetrics?.historyCompacted,
            });
            this.broadcastAssistantMessageComplete(userId!, task.sessionId, assistantMessageId, {
                status: 'success',
                totalIterations: iteration,
            });
        }

        if (iteration >= maxIterations) {
            logger.warn(LogCode.AI_ORCHESTRATOR, 'Max tool iterations reached', {
                taskId: task.id,
                maxIterations,
            });

            // Append a notice to the content
            const maxIterError = '\n\n⚠️ *Note: Maximum tool iterations reached. Some operations may be incomplete.*';
            totalContent += maxIterError;

            await this.persistAssistantMessageSafe({
                assistantMessageId,
                patch: {
                    content: totalContent,
                    reasoning_content: totalReasoning,
                    usage: lastUsage || undefined,
                    citations: allCitations.length > 0 ? allCitations : undefined,
                    compacted_data: {
                        summaryVersion: 1,
                        toolCalls: toolTrace.toolCalls.length,
                        stopReasons: Array.from(new Set(toolTrace.stopReasons)),
                        citationCount: allCitations.length,
                    },
                    status: 'complete'
                },
                logLabel: 'DeepSeek max-iteration update',
            });
            await this.persistBillingUsage({
                assistantMessageId,
                userId,
                model: task.model,
                usage: lastUsage,
                toolContext: task.toolContext,
                toolCallsCount: totalToolCallsCount,
                toolCallNames: totalToolCallNames
            });

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
            logger.debug(LogCode.WS_MESSAGE_SENT, 'Broadcasting message_complete', { assistantMessageId, status: 'max_iterations' });
            this.broadcastLatencyMetrics(userId, task, {
                latencyMs: Date.now() - taskProcessStartedAt,
                inputTokensEstimated: lastBudgetMetrics?.inputTokensEstimated,
                promptTokens: lastUsage?.prompt_tokens,
                completionTokens: lastUsage?.completion_tokens,
                totalTokens: lastUsage?.total_tokens,
                cachedTokens: lastUsage?.prompt_tokens_details?.cached_tokens,
                toolRounds: iteration,
                compactionHits: lastBudgetMetrics?.compactionHits || 0,
                historyKept: lastBudgetMetrics?.historyKept,
                historyCompacted: lastBudgetMetrics?.historyCompacted,
            });
            this.broadcastAssistantMessageComplete(userId!, task.sessionId, assistantMessageId, {
                status: 'max_iterations',
                totalIterations: iteration,
            });
        }
    } // end processDeepSeekTask

    /**
     * Tool name to user-friendly status message mapping
     */
    private getToolStatusMessage(toolName: string): string {
        const toolMessages: Record<string, string> = {
            'external_web_search': 'Websearch',
            'x_search': 'Searching X',
            'get_trending_tokens': 'Fetching global trends',
            'get_token_info': 'Analyzing token',
            'get_token_chart': 'Generating chart',
            'swapTransaction': 'Preparing swap',
            'create_copy_trade_task': 'Setting up copy trade',
            'list_copy_trade_configs': 'Checking trade setups',
            'delete_copy_trade_config': 'Removing trade setup',
            'pause_copy_trade_config': 'Updating trade status',
            'get_launchpad_stats': 'Fetching launchpad data',
            'search_launchpad': 'Searching launchpads',
            'get_wallet_info': 'Checking wallet',
            'get_farcaster_profile': 'Analyzing profile',
            'get_trending_casts': 'Listening to social trends',
            'get_token_mentions': 'Analyzing sentiment',
            'get_gas_price': 'Checking gas prices',
            'get_token_price': 'Checking price',
            'get_historical_price': 'Analyzing history',
            'check_token_risk': 'Evaluating risk',
            'search_farcaster_casts': 'Searching social feed',
            'get_user_favorites': 'Loading favorites',
            'get_market_overview': 'Analyzing market',
            'get_polymarket_trending': 'Fetching predictions',
            'get_polymarket_event': 'Analyzing event',
            'search_polymarket': 'Searching markets',
        };
        // Use proper capitalization and mapping, or fallback to generic "Executing [tool_name]"
        if (toolMessages[toolName]) return toolMessages[toolName];

        // Convert snake_case to Space Case for fallback
        const fallback = toolName.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        return fallback;
    }

    private getIntentStatusMessage(parsedIntent: any): string {
        const type = parsedIntent?.highLevel?.type || parsedIntent?.intent;
        if (!type) return 'Thinking';

        const intentMessages: Record<string, string> = {
            'TOKEN_ANALYSIS': 'Analyzing token',
            'TRADING': 'Checking status',
            'SWAP': 'Checking price',
            'SOCIAL': 'Checking social',
            'SEARCH': 'Websearch',
            'WEB_SEARCH': 'Websearch',
            'X_SEARCH': 'Searching X',
        };

        return intentMessages[type] || 'Thinking';
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
            } catch (err: any) {
                logger.warn(LogCode.API_FETCH_FAILED, 'Early pre-fetch failed', {
                    toolName,
                    error: err?.message || String(err),
                });
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
                    }).catch(err => logger.warn(LogCode.API_FETCH_FAILED, 'TRADING get_wallet_info pre-fetch failed', {
                        error: err?.message || String(err),
                    }));
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
                }).catch(err => logger.warn(LogCode.API_FETCH_FAILED, 'TRADING token_info pre-fetch failed', {
                    error: err?.message || String(err),
                }));
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
                    }).catch(err => logger.warn(LogCode.API_FETCH_FAILED, 'Proactive get_wallet_info pre-fetch failed', {
                        error: err?.message || String(err),
                    }));
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
                    }).catch(err => logger.warn(LogCode.API_FETCH_FAILED, 'TRADING get_wallet_info pre-fetch failed', {
                        error: err?.message || String(err),
                    }));
                }
            }
        }

        // 🚀 SPECULATIVE simulate_swap (TRADING + all params present + showQuoteBeforeSwap)
        // Pre-fire the quote API call in parallel with LLM — when the model calls simulate_swap, it hits cache.
        if (isTrading && task.toolContext?.toolConfig?.showQuoteBeforeSwap && !task.toolContext?.toolConfig?.fastSwapMode) {
            const tokenIn = String(parsedIntent?.detailed?.token_in || parsedIntent?.tokenIn || '').trim();
            const tokenOut = String(parsedIntent?.detailed?.token_out || parsedIntent?.tokenOut || '').trim();
            const amount = this.canonicalizeSwapAmountForCache(parsedIntent?.detailed?.amount || parsedIntent?.amount);
            const chainId = parsedIntent?.chainId || task.toolContext?.chainId;

            if (tokenIn && tokenOut && amount && chainId) {
                const resolvedTokenIn = this.canonicalizeSwapTokenForCache(tokenIn, Number(chainId)) || tokenIn;
                const resolvedTokenOut = this.canonicalizeSwapTokenForCache(tokenOut, Number(chainId)) || tokenOut;
                const simArgs = {
                    token_in: resolvedTokenIn,
                    token_out: resolvedTokenOut,
                    amount_in: amount,
                    chain_id: Number(chainId),
                    slippage: task.toolContext?.toolConfig?.customSlippage ? Number(task.toolContext.toolConfig.customSlippage) : 1.0,
                };
                const simKey = `simulate_swap:${this.stableStringify(simArgs)}`;
                const canonicalKey = this.buildSimulateSwapCanonicalKey(simArgs);
                const legacyNormKey = this.buildSimulateSwapLegacyNormKey(simArgs);

                if (!resultsMap.has(simKey) && !(canonicalKey && resultsMap.has(canonicalKey))) {
                    logger.info(LogCode.AI_API_CALL, 'ChatWorker: speculative simulate_swap pre-fetch', {
                        taskId: task.id,
                        tokenIn: resolvedTokenIn,
                        tokenOut: resolvedTokenOut,
                        amount,
                        chainId,
                    });
                    toolRegistry.execute('simulate_swap', simArgs, task.toolContext).then(res => {
                        resultsMap.set(simKey, res);
                        if (canonicalKey) resultsMap.set(canonicalKey, res);
                        if (legacyNormKey) resultsMap.set(legacyNormKey, res);
                        logger.info(LogCode.CACHE_HIT, 'ChatWorker: speculative simulate_swap stored', { taskId: task.id });
                    }).catch(err => logger.warn(LogCode.API_FETCH_FAILED, 'Speculative simulate_swap failed (non-blocking)', {
                        taskId: task.id,
                        error: err?.message || String(err),
                    }));
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
                }).catch(err => logger.warn(LogCode.API_FETCH_FAILED, 'Proactive social pre-fetch failed', {
                    error: err?.message || String(err),
                }));
            }
        }
    }

    private async persistBillingUsage(params: {
        assistantMessageId: string;
        userId?: string | null;
        model: string;
        usage?: {
            prompt_tokens?: number;
            completion_tokens?: number;
            total_tokens?: number;
            reasoning_tokens?: number;
            cost_in_usd_ticks?: number;
            prompt_cache_hit_tokens?: number;
            prompt_cache_miss_tokens?: number;
            prompt_tokens_details?: { cached_tokens?: number; text_tokens?: number } | null;
            completion_tokens_details?: { reasoning_tokens?: number } | null;
        } | null;
        toolContext?: any;
        toolCallsCount?: number;
        toolCallNames?: string[];
    }): Promise<void> {
        if (!params.userId || !params.usage) return;

        const billingContext = params.toolContext?.billing || {};
        const modelCategory = billingContext.modelCategory || getBillingCategory(params.model);
        const isFree = typeof billingContext.isFree === 'boolean' ? billingContext.isFree : false;
        const usdCost = computeUsdCost(
            params.usage,
            params.model,
            Array.isArray(params.toolCallNames) && params.toolCallNames.length > 0
                ? params.toolCallNames
                : (params.toolCallsCount || 0)
        );
        const promptTokens = Number(params.usage.prompt_tokens || 0);
        const completionTokens = Number(params.usage.completion_tokens || 0);
        const totalTokens = computeTotalTokens(params.usage, params.model);

        const dateUtc = getUtcDateString();

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
                dateUtc,
                isFree
            });
            await recordUsage({
                userId: params.userId,
                dateUtc,
                modelCategory,
                model: params.model,
                assistantMessageId: params.assistantMessageId,
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
                const toolContext = {
                    ...(context || {}),
                    sessionId,
                    messageId,
                };
                const result = await toolRegistry.execute(tc.function.name, args, toolContext);
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
        const citationUrlSet = new Set<string>();
        logger.info(LogCode.AI_ORCHESTRATOR, 'ChatWorker: executing tools batch', {
            sessionId,
            messageId,
            userId: userId || undefined,
            toolCount: toolCalls.length
        });

        for (const tc of toolCalls) {
            const toolStart = Date.now();
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
            if (trace) {
                if (toolName !== 'search_polymarket') {
                    trace.polymarketSearchNoMatchStreak = 0;
                }
                if (trace.lastToolName === toolName) {
                    trace.consecutiveToolCalls += 1;
                } else {
                    trace.lastToolName = toolName;
                    trace.consecutiveToolCalls = 1;
                }
                if (trace.consecutiveToolCalls > this.maxConsecutiveToolCallsPerTool) {
                    trace.stopReasons.push(`tool_consecutive_limit:${toolName}`);
                    trace.toolCalls.push({
                        tool: toolName,
                        argsKey: this.buildToolKey(toolName, args),
                        status: 'blocked',
                        error: 'Consecutive tool call limit reached',
                    });
                    results.push({
                        role: 'tool',
                        tool_call_id: tc.id,
                        content: `Consecutive call limit reached for ${toolName}. Stop calling this tool repeatedly and respond to the user.`,
                    });
                    continue;
                }
            }
            logger.info(LogCode.AI_API_CALL, 'ChatWorker: tool start', {
                tool: toolName,
                sessionId,
                messageId,
                userId: userId || undefined
            });
            if (toolName === 'get_wallet_info') {
                const walletAddress = context?.walletAddress || context?.userAddress;
                if (walletAddress && !args.address) {
                    args.address = walletAddress;
                }
                if (context?.chainId && !args.chain && !args.chainId) {
                    args.chain = CHAIN_ID_MAP[context.chainId] || 'eth';
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
                // Fallback: simulate_swap normalized key lookup for speculative pre-fetch
                if (tc.function.name === 'simulate_swap' && cache) {
                    const canonicalKey = this.buildSimulateSwapCanonicalKey(args);
                    if (canonicalKey && cache.has(canonicalKey)) {
                        logger.info(LogCode.CACHE_HIT, 'ChatWorker: simulate cache diagnostic', {
                            source: 'canonical',
                            tool: tc.function.name,
                            canonicalKey,
                            tokenIn: args?.token_in ?? args?.tokenIn,
                            tokenOut: args?.token_out ?? args?.tokenOut,
                            amountIn: args?.amount_in ?? args?.amountIn,
                            chainId: args?.chain_id ?? args?.chainId,
                        });
                        logger.info(LogCode.CACHE_HIT, 'ChatWorker: simulate_swap speculative cache hit (canonical)', { tool: tc.function.name });
                        const cachedResult = cache.get(canonicalKey);
                        trace?.toolCalls.push({ tool: toolName, argsKey, status: 'cached' });
                        results.push({
                            role: 'tool',
                            tool_call_id: tc.id,
                            content: typeof cachedResult === 'string' ? cachedResult : JSON.stringify(cachedResult)
                        });
                        continue;
                    }

                    const legacyNormKey = this.buildSimulateSwapLegacyNormKey(args);
                    if (legacyNormKey && cache.has(legacyNormKey)) {
                        logger.info(LogCode.CACHE_HIT, 'ChatWorker: simulate cache diagnostic', {
                            source: 'legacy_norm',
                            tool: tc.function.name,
                            legacyNormKey,
                            canonicalKey: canonicalKey || null,
                            tokenIn: args?.token_in ?? args?.tokenIn,
                            tokenOut: args?.token_out ?? args?.tokenOut,
                            amountIn: args?.amount_in ?? args?.amountIn,
                            chainId: args?.chain_id ?? args?.chainId,
                        });
                        logger.info(LogCode.CACHE_HIT, 'ChatWorker: simulate_swap speculative cache hit (normalized)', { tool: tc.function.name });
                        const cachedResult = cache.get(legacyNormKey);
                        trace?.toolCalls.push({ tool: toolName, argsKey, status: 'cached' });
                        results.push({
                            role: 'tool',
                            tool_call_id: tc.id,
                            content: typeof cachedResult === 'string' ? cachedResult : JSON.stringify(cachedResult)
                        });
                        continue;
                    }

                    logger.debug(LogCode.CACHE_MISS, 'ChatWorker: simulate cache diagnostic', {
                        source: 'miss',
                        tool: tc.function.name,
                        canonicalKey: canonicalKey || null,
                        legacyNormKey: legacyNormKey || null,
                        tokenIn: args?.token_in ?? args?.tokenIn,
                        tokenOut: args?.token_out ?? args?.tokenOut,
                        amountIn: args?.amount_in ?? args?.amountIn,
                        chainId: args?.chain_id ?? args?.chainId,
                    });
                }
                if (toolName === 'get_wallet_info' && cache) {
                    const contextChain = this.normalizeChainName(this.resolveChainNameForContext(context?.chainId));
                    const requestedChain = this.resolveRequestedWalletChain(args);
                    const canUseContextChain = !requestedChain || !contextChain || requestedChain === contextChain;
                    const fallbackKey = `get_wallet_info:${this.stableStringify({
                        address: context?.walletAddress || context?.userAddress,
                        chainId: context?.chainId,
                    })}`;
                    if (cache.has(fallbackKey) && canUseContextChain) {
                        logger.info(LogCode.AI_API_CALL, 'ChatWorker: get_wallet_info short-circuited to client context', {
                            chainId: context?.chainId,
                            requestedChain: requestedChain || null,
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
                    const contextChain = this.normalizeChainName(this.resolveChainNameForContext(context?.chainId));
                    const requestedChain = this.resolveRequestedWalletChain(args);
                    const canUseContextChain = !requestedChain || !contextChain || requestedChain === contextChain;
                    const contextResult = this.buildWalletInfoFromContext({ toolContext: context } as AITask);
                    if (contextResult && canUseContextChain) {
                        logger.info(LogCode.AI_API_CALL, 'ChatWorker: get_wallet_info forced from client context', {
                            chainId: context?.chainId,
                            requestedChain: requestedChain || null,
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
                if (sessionId && execState?.task) {
                    this.broadcastTaskStatus(userId, execState.task, {
                        status: 'running',
                        message: this.getToolStatusMessage(tc.function.name)
                    });
                }


                const result = await toolRegistry.execute(tc.function.name, args, context);

                if (trace && toolName === 'search_polymarket') {
                    const noExactMatch = (() => {
                        if (!result || typeof result !== 'object') return false;
                        if ((result as any).exactMatch === true) return false;
                        if (Array.isArray((result as any).results)) return (result as any).results.length === 0;
                        if (Array.isArray((result as any).events)) return (result as any).events.length === 0;
                        if (typeof (result as any).count === 'number') return (result as any).count === 0;
                        return false;
                    })();
                    trace.polymarketSearchNoMatchStreak = noExactMatch
                        ? trace.polymarketSearchNoMatchStreak + 1
                        : 0;
                    if (trace.polymarketSearchNoMatchStreak >= 2) {
                        trace.stopReasons.push('polymarket_search_no_match_limit');
                        // Force subsequent search_polymarket calls to hit per-tool limit block.
                        trace.toolCallCounts[toolName] = Math.max(trace.toolCallCounts[toolName] || 0, this.maxToolCallsPerTool + 1);
                    }
                }
                logger.info(LogCode.AI_API_CALL, 'ChatWorker: tool success', {
                    tool: toolName,
                    sessionId,
                    messageId,
                    userId: userId || undefined,
                    durationMs: Date.now() - toolStart
                });

                // Collect citations from any tool that returns `{ citations: [...] }`.
                if (result && typeof result === 'object') {
                    this.appendUniqueCitations(
                        allCitations,
                        citationUrlSet,
                        (result as any).citations
                    );
                }

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
                if (clientAction) {
                    // Broadcast action to frontend IMMEDIATELY
                    if (sessionId && messageId) {
                        const actionDataForLog = clientAction.data || clientAction.payload || {};
                        const isTxCardAction = clientAction.type === 'show_transaction_status_card' || clientAction.type === 'show_cross_chain_status_card';
                        if (isTxCardAction) {
                            logger.info(LogCode.AI_API_CALL, '[CARD-BACKLOG] ChatWorker broadcasting tx card action', {
                                sessionId,
                                messageId,
                                toolName: tc.function.name,
                                actionType: clientAction.type,
                                status: actionDataForLog?.status || null,
                                txHash: actionDataForLog?.txHash || null,
                                chainId: actionDataForLog?.chainId || null,
                            });
                        }
                        this.ws.broadcastToUser(userId!, {
                            type: 'client_action',
                            sessionId: sessionId,
                            data: {
                                message_id: messageId,
                                targetMessageId: messageId, // CRITICAL: Frontend reads this field
                                action: clientAction
                            }
                        });
                        logger.debug(LogCode.WS_MESSAGE_SENT, 'Broadcasted client action for tool', {
                            toolName: tc.function.name,
                        });
                    }

                    // PERSIST: Map client action type to DB message type
                    let dbMessageType = 'text';
                    // DEPRECATED: show_swap_card removed from chat interface
                    if (clientAction.type === 'show_chart_card') dbMessageType = 'chart-card';
                    else if (clientAction.type === 'show_strategy_card') dbMessageType = 'strategy-card';
                    else if (clientAction.type === 'show_token_card') dbMessageType = 'token-card';
                    else if (clientAction.type === 'show_transaction_status_card' || clientAction.type === 'show_cross_chain_status_card') dbMessageType = 'transaction-status-card';

                    // For transaction cards: prepareSwap already creates and persists its own dedicated
                    // transaction message (with its own ID). If the tool result includes a messageId,
                    // that means a separate DB row already has the card data. Do NOT also overwrite the
                    // assistant message to card type — it should remain 'text' with the LLM summary.
                    // Otherwise on reload the assistant message would show as a half-broken card with
                    // stale data (contract addresses instead of symbols, amount 0, etc.).
                    const hasDedicatedTxMessage = dbMessageType === 'transaction-status-card' && result?.messageId && result.messageId !== messageId;

                    if (!hasDedicatedTxMessage) {
                        // Save card metadata to DB
                        const actionData = clientAction.data || clientAction.payload;
                        await this.repo.updateMessage(messageId, {
                            type: dbMessageType,
                            data: actionData,
                            transactionStatus: dbMessageType === 'transaction-status-card' ? actionData?.status : undefined,
                            transactionHash: dbMessageType === 'transaction-status-card' ? actionData?.txHash : undefined,
                        });
                        if (dbMessageType === 'transaction-status-card') {
                            logger.info(LogCode.AI_API_CALL, '[CARD-BACKLOG] ChatWorker persisted tx card action', {
                                sessionId,
                                messageId,
                                actionType: clientAction.type,
                                status: actionData?.status || null,
                                txHash: actionData?.txHash || null,
                                chainId: actionData?.chainId || null,
                            });
                        }
                    } else {
                        logger.info(LogCode.AI_API_CALL, '[CARD-BACKLOG] Skipping assistant msg persist - dedicated tx message exists', {
                            sessionId,
                            assistantMessageId: messageId,
                            txMessageId: result.messageId,
                        });
                    }

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
                    // Keep LLM content concise: only pass textual search summary, not full citation payload object.
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
                logger.warn(LogCode.AI_API_CALL, 'ChatWorker: tool error', {
                    tool: toolName,
                    sessionId,
                    messageId,
                    userId: userId || undefined,
                    durationMs: Date.now() - toolStart,
                    error: err?.message || 'Tool execution failed'
                });
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
    private async processGrokTask(
        task: AITask,
        history: any[],
        userId: string | null = null,
        sessionMessages: any[] = [],
        session: any = null,
        preProcessed?: { parsedIntent: any; resolvedContext: any; toolResultsCache: Map<string, any> }
    ) {
        const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';
        const XAI_API_KEY = process.env.XAI_API_KEY;
        const assistantMessageId = task.assistantMessageId!;
        let fullContent = '';
        let chunkIndex = 0;
        let lastUsage: any = null;  // Track usage for DB persistence
        let allCitations: any[] = [];  // Track citations for DB persistence
        let latestProviderResponseId: string | undefined;
        const citationUrlSet = new Set<string>();
        let lastDbSave = 0; // Periodic DB sync to prevent data loss on refresh
        let lastBudgetMetrics: { inputTokensEstimated: number; historyKept: number; historyCompacted: number; compactionHits: number } | null = null;
        const taskProcessStartedAt = Date.now();
        let iteration = 0;
        const maxIterations = 5;
        const seenLocalToolKeys = new Set<string>();
        let currentHistory = [...history];

        const toolTrace: ToolTraceState = {
            mode: 'execution',
            skillVersion: 'exec',
            toolCalls: [],
            toolCallCounts: {},
            toolArgsCounts: {},
            toolFailures: {},
            toolRepeats: {},
            consecutiveToolCalls: 0,
            polymarketSearchNoMatchStreak: 0,
            stopReasons: [],
            blockedKeys: new Set(),
            lastResultByKey: new Map(),
        };

        // Ensure wallet context is always present for execution-mode prompts/tools.
        if (!task.toolContext?.walletAddress && userId) {
            try {
                const chainId = Number(task.toolContext?.chainId || 0);
                const resolvedWallet = chainId === 900
                    ? await privyWallet.getSolanaEmbeddedWalletAddress(userId)
                    : await privyWallet.getEmbeddedWalletAddress(userId);
                if (resolvedWallet) {
                    task.toolContext = {
                        ...task.toolContext,
                        walletAddress: resolvedWallet,
                        userAddress: task.toolContext?.userAddress || resolvedWallet,
                    };
                    logger.info(LogCode.AI_API_CALL, 'Grok: wallet context resolved at runtime', {
                        taskId: task.id,
                        chainId: task.toolContext?.chainId,
                    });
                }
            } catch (e: any) {
                logger.warn(LogCode.API_FETCH_FAILED, 'Grok: failed to resolve wallet context at runtime', {
                    taskId: task.id,
                    error: e?.message || String(e),
                });
            }
        }

        // Initial status broadcast for Grok
        this.broadcastTaskStatus(userId, task, {
            status: 'running',
            message: this.getIntentStatusMessage(preProcessed?.parsedIntent)
        });

        const bypassed = await this.executeConfirmedSwapBypass({
            task,
            assistantMessageId,
            sessionMessages,
            userId,
            providerLabel: 'Grok',
        });
        if (bypassed) return;

        // Parse intent from user message
        this.broadcastTaskStatus(userId, task, {
            status: 'running',
            message: this.getInitialContextStatusMessage(task)
        });
        const lastUserMessage = history.filter(m => m.role === 'user').pop()?.content || '';
        const baseToolDefs = toolRegistry.getAllDefinitions();
        let toolDefinitions = baseToolDefs.map(def => ({ type: 'function', function: def }));
        logger.debug(LogCode.AI_TOOL_FILTERED, 'Grok: base tool list prepared', { count: toolDefinitions.length });
        const parsedIntent = preProcessed?.parsedIntent
            ? preProcessed.parsedIntent
            : await parseIntent(lastUserMessage, {
                userAddress: task.toolContext?.walletAddress,
                chainId: task.toolContext?.chainId,
                isWalletConnected: !!task.toolContext?.walletAddress,
            });
        const forceChainContextAnswer = this.isChainStatusQuery(lastUserMessage) && !!task.toolContext?.chainId;
        if (forceChainContextAnswer) {
            const chainId = Number(task.toolContext?.chainId);
            const chainName = this.resolveChainNameForContext(chainId) || 'Unknown Chain';
            const wallet = task.toolContext?.walletAddress || task.toolContext?.userAddress || '';
            parsedIntent.highLevel.type = 'TRADING';
            parsedIntent.highLevel.confidence = 1;
            parsedIntent.decision = {
                primary: 'TRADING',
                confidence: 1,
                labels: [{ label: 'TRADING', confidence: 1 }],
                evidence: [],
                routing: { stage: 'rule', reason: 'chain_context_query' },
                hardRule: { label: 'TRADING', reason: 'user_asks_current_chain' },
                signals: { hasAction: false, hasAmount: false, hasAsset: false } as any,
                slots: { action: false, amount: false, asset: false, target: false, complete: true } as any,
            };
            (task as any).systemInjection =
                `CHAIN_CONTEXT_ANSWER_REQUIRED: User asks current chain. Authoritative chain context is chainId=${chainId}, chainName=${chainName}, wallet=${wallet || 'unknown'}. ` +
                `You MUST answer directly from this context. Do NOT use web_search or any tool. Do NOT say you cannot access wallet/chain context.`;
        }
        if (parsedIntent?.detailed?.action === 'swap') {
            let tokenIn = String(parsedIntent?.detailed?.token_in || '').toUpperCase();
            const tokenOut = String(parsedIntent?.detailed?.token_out || '').toUpperCase();
            const amount = String(parsedIntent?.detailed?.amount || '').trim();
            const hasAmount = !!amount && !Number.isNaN(Number(amount));
            const isOutStable = ['USDC', 'USDT', 'DAI', 'FDUSD', 'BUSD', 'USD1'].includes(tokenOut);

            // When token_in isn't specified (e.g. "buy 1 USDC"), infer from chain's native currency.
            // The user implicitly means "use my native token (ETH/SOL/BNB) to buy X stablecoin".
            if (!tokenIn && isOutStable) {
                try {
                    const chainId = parsedIntent?.chainId || task.toolContext?.chainId;
                    if (chainId) {
                        const chainCfg = getChainConfig(Number(chainId));
                        tokenIn = chainCfg.nativeCurrency.symbol.toUpperCase();
                    }
                } catch { /* ignore unsupported chain */ }
            }

            const isInNative = ['ETH', 'BNB', 'SOL', 'POL', 'MATIC'].includes(tokenIn);
            const lowerMsg = lastUserMessage.toLowerCase();
            const hasBuySemantics = /\b(buy|get|receive|购买|买)\b/i.test(lastUserMessage);
            const outMentioned = tokenOut && lowerMsg.includes(tokenOut.toLowerCase());
            if (hasAmount && isOutStable && isInNative && hasBuySemantics && outMentioned) {
                (task as any).systemInjection = `AMOUNT_SEMANTICS_RULE: In this request, numeric amount ${amount} refers to target output ${tokenOut}, NOT input ${tokenIn}. Do NOT treat ${amount} as amount_in ${tokenIn}. You MUST first estimate the required ${tokenIn} input for receiving approximately ${amount} ${tokenOut} (use current price context or simulate with a small reference amount), then call simulate_swap with that estimated amount_in. NEVER use the user's full balance when a specific target output amount is requested.`;
            }
        }
        await this.recordIntentTrace(task, sessionMessages, parsedIntent, lastUserMessage);

        this.broadcastTaskStatus(userId, task, { status: 'running', message: 'Identifying intent' });

        // Use high-level intent for system prompt selection
        const intent: IntentType = parsedIntent.highLevel.type;
        const routingMode = this.resolveRoutingMode(intent, parsedIntent.decision);
        toolTrace.mode = 'execution';
        toolTrace.skillVersion = 'exec';
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
        const registry = skillRegistryExec;
        const matchedSkills = registry.getSkillsByIntent(intentStr);
        const allowedToolNames = new Set<string>();
        for (const skill of matchedSkills) {
            for (const name of skill.metadata.tools || []) {
                allowedToolNames.add(name);
            }
        }
        // Grok should use provider-native search for web/X discovery. Do not add local search fallbacks here.

        if (matchedSkills.length > 0 && allowedToolNames.size > 0) {
            const blockedForGrok = new Set(['external_web_search', 'get_trending_casts', 'get_farcaster_user', 'search_farcaster_casts', 'x_search']);
            const gated = baseToolDefs.filter(def => allowedToolNames.has(def.name) && !blockedForGrok.has(def.name));
            if (gated.length > 0) {
                toolDefinitions = gated.map(def => ({ type: 'function', function: def }));
                logger.throttled(LogCode.AI_TOOL_FILTERED, 'Grok: tool list gated by skills', {
                    count: toolDefinitions.length,
                    intent: intentStr,
                    skills: matchedSkills.map(s => s.metadata.id),
                    routingMode,
                    skillVersion: 'exec',
                });
                logger.info(LogCode.AI_SKILLS_ATTACHED, 'Grok: skills attached', {
                    taskId: task.id,
                    sessionId: task.sessionId,
                    model: task.model,
                    intent: intentStr,
                    routingMode,
                    skillVersion: 'exec',
                    skills: matchedSkills.map(s => s.metadata.id),
                    toolCount: toolDefinitions.length,
                });
            } else {
                logger.warn(LogCode.AI_TOOL_FILTERED, 'Grok: skill gating produced 0 tools; no fallback - skills control tool availability', { intent: intentStr });
            }
        }
        if (forceChainContextAnswer) {
            toolDefinitions = [];
        }

        // Log detailed intent for debugging

        // Phase 5 Cache: Shared across this task
        const toolResultsCache = preProcessed?.toolResultsCache || new Map<string, any>();
        if (!preProcessed?.toolResultsCache) {
            this.seedToolCacheFromContext(toolResultsCache, task);
        }

        // 🚀 PRE-EMPTIVE TOOL EXECUTION (Phase 5: Intent-based)
        const earlyPreFetchPromise = preProcessed?.resolvedContext
            ? Promise.resolve()
            : this.preFetchByIntent(task, parsedIntent, toolResultsCache).catch(err => {
                logger.warn(LogCode.AI_API_CALL, 'Grok: early pre-fetch failed', { error: err?.message || err });
            });

        const systemPrompt = promptOrchestrator.getSystemPrompt('grok', intent, { routingMode });

        // Detect and resolve contract address if present (same as DeepSeek)
        let { detectedChainId, detectedChainName, tokenInfo, detectedLaunchpadInfo } = preProcessed?.resolvedContext
            ? preProcessed.resolvedContext
            : { detectedChainId: task.toolContext?.chainId, detectedChainName: this.resolveChainNameForContext(task.toolContext?.chainId), tokenInfo: null, detectedLaunchpadInfo: null };

        if (!preProcessed?.resolvedContext) {
            const contextUpdate = await this.resolveTokenContext({
                mode: 'grok',
                task,
                parsedIntent,
                toolResultsCache,
                userId,
                broadcastScanningStatus: true
            });
            detectedChainId = contextUpdate.detectedChainId;
            detectedChainName = contextUpdate.detectedChainName;
            tokenInfo = contextUpdate.tokenInfo;
            detectedLaunchpadInfo = contextUpdate.detectedLaunchpadInfo;
        }

        let xSeedHandles: string[] = [];
        let officialSites: string[] = [];

        if (parsedIntent.contractAddress) {
            logger.info(LogCode.AI_TOKEN_DETECTED, 'Grok: contract address detected', { contractAddress: parsedIntent.contractAddress });

            // Only re-resolve if not already resolved by pre-processing
            if (!preProcessed?.resolvedContext) {
                const resolved = await this.resolveTokenContext({
                    mode: 'grok',
                    task,
                    parsedIntent,
                    toolResultsCache,
                    userId,
                    detectedChainId,
                    detectedLaunchpadInfo,
                    broadcastScanningStatus: true,
                });
                detectedChainId = resolved.detectedChainId;
                detectedChainName = resolved.detectedChainName;
                tokenInfo = resolved.tokenInfo;
                detectedLaunchpadInfo = resolved.detectedLaunchpadInfo;
            }

            if (detectedLaunchpadInfo) {
                logger.info(LogCode.AI_LAUNCHPAD_DETECTED, 'Grok: launchpad token detected', {
                    provider: detectedLaunchpadInfo.provider
                });
            }

            // Extract official socials/websites in unified mode.
            {
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

        const fullUserContext = this.buildUserContext(
            task,
            { chainId: detectedChainId || task.toolContext?.chainId, chainName: detectedChainName },
            parsedIntent
        );
        const userContext: UserContext = fullUserContext;

        // Latency optimization: do NOT block the first model call on pre-fetch.
        // We still await this promise later (right before tool execution) to keep correctness.
        logger.debug(LogCode.AI_API_CALL, 'Grok: early pre-fetch still running; continue without blocking first call', {
            taskId: task.id,
            sessionId: task.sessionId,
        });

        // Build enriched user message with context (similar to DeepSeek)
        this.broadcastTaskStatus(userId, task, { status: 'running', message: 'Building context' });
        let enrichedHistory = [...history];
        const lastUserIndex = enrichedHistory.map(m => m.role).lastIndexOf('user');
        let tokenContextAvailable = false;
        let launchpadContextAvailable = false;
        let didInjectUserContext = false;

        if (lastUserIndex !== -1) {
            const lastMsg = enrichedHistory[lastUserIndex];
            const walletAddressForContext = task.toolContext?.walletAddress || task.toolContext?.userAddress;
            const walletBalanceCacheKey = walletAddressForContext
                ? `get_wallet_info:${this.stableStringify({
                    address: walletAddressForContext,
                    chainId: task.toolContext?.chainId
                })}`
                : '';

            // Ensure Grok receives wallet state on first turn even when client did not provide
            // a full snapshot and async prefetch has not finished yet.
            if (walletAddressForContext && walletBalanceCacheKey && !toolResultsCache.has(walletBalanceCacheKey)) {
                const contextResult = this.buildWalletInfoFromContext(task);
                if (contextResult) {
                    toolResultsCache.set(walletBalanceCacheKey, contextResult);
                    logger.info(LogCode.AI_API_CALL, 'Grok: seeded wallet state from toolContext before prompt build', {
                        taskId: task.id,
                        chainId: task.toolContext?.chainId,
                    });
                } else {
                    const walletPrefetchTimeout = Math.max(400, parseInt(process.env.GROK_WALLET_PREFETCH_TIMEOUT_MS || '900', 10) || 900);
                    const prefetchedWallet = await this.withTimeout(
                        toolRegistry.execute('get_wallet_info', {
                            address: walletAddressForContext,
                            chainId: task.toolContext?.chainId
                        }, task.toolContext),
                        walletPrefetchTimeout,
                        'grok_wallet_prefetch',
                        null as any
                    );
                    if (prefetchedWallet) {
                        toolResultsCache.set(walletBalanceCacheKey, prefetchedWallet);
                        logger.info(LogCode.AI_API_CALL, 'Grok: prefetched wallet state before prompt build', {
                            taskId: task.id,
                            chainId: task.toolContext?.chainId,
                            timeoutMs: walletPrefetchTimeout,
                        });
                    } else {
                        logger.warn(LogCode.API_FETCH_FAILED, 'Grok: wallet prefetch missing before prompt build', {
                            taskId: task.id,
                            chainId: task.toolContext?.chainId,
                        });
                    }
                }
            }

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

            const tokenBlock = buildTokenContextBlock({
                mode: 'grok',
                tokenInfo,
                contractAddress: parsedIntent?.contractAddress,
                xSeedHandles,
                officialSites,
            });
            tokenContextBlock = tokenBlock.tokenContextBlock;
            tokenContextAvailable = tokenBlock.tokenContextAvailable;

            let launchpadContextBlock = '';
            const launchpadBlock = buildLaunchpadContextBlock({
                launchpadInfo: detectedLaunchpadInfo,
                tokenInfo,
                fallbackAddress: parsedIntent?.contractAddress,
                fallbackChainId: task.toolContext?.chainId,
            });
            launchpadContextBlock = launchpadBlock.launchpadContextBlock;
            launchpadContextAvailable = launchpadBlock.launchpadContextAvailable;

            if (task.toolContext?.walletAddress) {
                const chainId = task.toolContext?.chainId;
                const chainName = chainId ? (CHAIN_ID_MAP[chainId] || 'Unknown Chain') : 'Unknown Chain';
                tokenContextBlock += `\n\n[USER_WALLET_CONTEXT]
Wallet Address: ${task.toolContext.walletAddress}
Chain: ${chainName}${chainId ? ` (${chainId})` : ''}
`;
            }

            // Add balance info via unified balance pipeline.
            // Keep execution guardrails only for execution intents.
            if (task.toolContext?.walletAddress || task.toolContext?.userAddress) {
                const nativePriceSnapshot = await this.resolveNativePriceSnapshot(task.toolContext?.chainId, toolResultsCache);
                const balanceContext = this.buildBalanceContext({
                    toolContext: task.toolContext,
                    toolResultsCache,
                    nativeSymbol: nativePriceSnapshot.nativeSymbol,
                    nativePriceUsd: nativePriceSnapshot.nativePriceUsd,
                    nativePriceSource: nativePriceSnapshot.nativePriceSource,
                    nativePriceFetchedAt: nativePriceSnapshot.nativePriceFetchedAt,
                    balanceSnapshotAt: this.getBalanceSnapshotTimestamp(task.toolContext),
                    includePortfolioBlock: true,
                    includeRequestedTokenBlock: false,
                    includeExecutionRule: EXECUTION_INTENTS.has(intent),
                    chainLabel: String(task.toolContext?.chainId || 'Unknown'),
                    isExecutionIntent: EXECUTION_INTENTS.has(intent),
                });
                tokenContextBlock += balanceContext.tokenContextBlock;
                const needUsdGuardrail = this.requiresUsdPriceGuardrail(lastUserMessage, parsedIntent);
                if (needUsdGuardrail) {
                    const hasNativePrice = Number.isFinite(nativePriceSnapshot.nativePriceUsd || NaN) && (nativePriceSnapshot.nativePriceUsd || 0) > 0;
                    tokenContextBlock = this.appendPriceGuardrailBlock(tokenContextBlock, {
                        nativeSymbol: nativePriceSnapshot.nativeSymbol,
                        hasNativePrice,
                    });
                    if (!hasNativePrice) {
                        toolDefinitions = this.ensureToolDefinitionPresent(toolDefinitions, baseToolDefs, 'get_token_price');
                    }
                }
            }


            // Do not inject balance context; let the model request wallet data via tools.
            const extraBlocks = [tokenContextBlock, launchpadContextBlock].filter(Boolean);
            const enrichedContent = this.buildEnrichedUserContent({
                userQuery: lastMsg.content,
                userContext,
                intent,
                extraBlocks,
            });
            enrichedHistory = this.injectEnrichedUserContent(enrichedHistory, lastUserIndex, enrichedContent);
            didInjectUserContext = true;
        }

        toolDefinitions = this.pruneToolsWithContextAvailability(toolDefinitions, {
            tokenContextAvailable,
            launchpadContextAvailable,
            providerLabel: 'Grok',
        });

        let compactedHistoryMessage: string | undefined;
        if (this.isUnifiedOrchestrator()) {
            const budgetSourceMessages = [...enrichedHistory];
            const budgetResult = this.applyContextBudgetWithMetrics(enrichedHistory, task, 'Grok');
            enrichedHistory = this.ensureCriticalContextPinned(budgetResult.messages, budgetSourceMessages);
            compactedHistoryMessage = budgetResult.compactedHistoryMessage;
            lastBudgetMetrics = budgetResult.metrics;
            if (budgetResult.compactedHistoryMessage) {
                await this.persistConversationRef(task, {
                    compactionCursor: `cmp_${Date.now()}`,
                });
            }
        }

        let grokMessages = [
            { role: 'system', content: systemPrompt },
        ];
        if (compactedHistoryMessage) {
            grokMessages.push({ role: 'system', content: compactedHistoryMessage });
        }
        grokMessages = this.attachFallbackSystemContext({
            messages: grokMessages,
            task,
            didInjectUserContext,
            providerLabel: 'Grok',
        });
        grokMessages.push(...this.sanitizeGrokHistory(enrichedHistory));

        const isLikelyCaAnalysis = (() => {
            const lastUser = lastUserMessage?.content || '';
            return /0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44}/.test(lastUser)
                && parsedIntent?.highLevel?.type === 'RISK_SCAN';
        })();
        const requiresRealtimeSocialSearch = (() => {
            const lastUser = String(lastUserMessage?.content || '');
            if (!lastUser) return false;
            if (forceChainContextAnswer || EXECUTION_INTENTS.has(intent)) return false;
            return /\b(trending|trend|latest|right now|currently|now|buzz|sentiment|what.*saying|what.*people|on\s+x|on\s+twitter)\b/i.test(lastUser);
        })();
        if (requiresRealtimeSocialSearch) {
            grokMessages.splice(1, 0, {
                role: 'system',
                content: 'REALTIME SOCIAL SEARCH REQUIRED: This request is explicitly about current/trending/social activity. You have KiKo Grok SDK search capability available. You MUST use search evidence before answering. Do not give a trend summary from memory. If evidence is thin, say it is thin after searching.'
            });
        }

        const now = Date.now();
        const last7dIso = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

        const modelLower = String(task.model || '').toLowerCase();
        const isNonReasoningModel = modelLower.includes('non-reasoning');
        // xAI changed chat/completions tool schema (expects live_search) and now deprecates live_search for many accounts.
        // Disable provider-managed search by default and rely on function tools (`x_search`/`external_web_search`) for stability.
        // If needed, can be re-enabled with GROK_ENABLE_PROVIDER_SEARCH_TOOLS=true.
        const providerManagedSearchTools: any[] = (!forceChainContextAnswer && !EXECUTION_INTENTS.has(intent) && GROK_ENABLE_PROVIDER_SEARCH_TOOLS)
            ? [{
                type: 'live_search' as const,
                sources: [
                    { type: 'web' as const },
                    ...(isNonReasoningModel ? [] : [{ type: 'x' as const }]),
                ],
            }]
            : [];

        // Broadcast state before API call
        this.broadcastTaskStatus(userId, task, { status: 'running', message: this.getIntentStatusMessage(preProcessed?.parsedIntent) });

        while (iteration < maxIterations) {
            iteration++;
            // Broadcast Thinking state before API call
            this.broadcastTaskStatus(userId, task, {
                status: 'running',
                iteration,
                maxIterations,
                message: iteration > 1 ? `Processing tool results (${iteration}/${maxIterations})` : this.getIntentStatusMessage(preProcessed?.parsedIntent)
            });

            // Call Grok provider (prefer Python SDK gateway, then fallback to direct xAI)
            const previousResponseId = GROK_ENABLE_PREVIOUS_RESPONSE
                ? this.grokResponseIdBySession.get(task.sessionId)
                : undefined;
            const apiRequestStartedAt = Date.now();
            let firstTokenAt: number | null = null;
            let currentToolCalls: any[] = [];

            const directRequestBody: any = {
                model: task.model,
                messages: grokMessages,
                stream: true,
                tools: [...providerManagedSearchTools, ...toolDefinitions],
                tool_choice: 'auto',
            };
            const sdkGatewayBody: any = {
                model: task.model,
                messages: grokMessages,
                stream: true,
                // SDK gateway: keep native tools broadly available unless hard-disabled by chain-context guardrail.
                enable_search: !forceChainContextAnswer,
                ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
                // SDK gateway executes tools with its own native + custom registry.
                // Do not pass Node tool schemas to avoid duplicate tool ecosystems.
                tool_context: task.toolContext || undefined,
                tool_config: {
                    web_search: {},
                    x_search: {
                        from_date: last7dIso,
                        ...(xSeedHandles.length > 0 ? { allowed_x_handles: xSeedHandles.slice(0, 5).map(h => String(h).replace(/^@/, '')) } : {}),
                    }
                }
            };

            let response: Response | null = null;
            let activeTransport: 'sdk_gateway' | 'xai_direct' = 'xai_direct';
            const transportOrder: Array<'sdk_gateway' | 'xai_direct'> = GROK_PREFER_SDK_GATEWAY
                ? ['sdk_gateway', 'xai_direct']
                : ['xai_direct'];
            let lastTransportError = '';

            for (const transport of transportOrder) {
                try {
                    if (transport === 'sdk_gateway') {
                        const sdkHeaders: Record<string, string> = {
                            'Content-Type': 'application/json',
                        };
                        if (process.env.INTERNAL_SERVICE_KEY) {
                            sdkHeaders['X-Service-Key'] = process.env.INTERNAL_SERVICE_KEY;
                        }
                        const sdkResponse = await fetch(`${GROK_SERVICE_URL}/v1/chat/completions`, {
                            method: 'POST',
                            headers: sdkHeaders,
                            body: JSON.stringify(sdkGatewayBody),
                        });
                        if (sdkResponse.ok) {
                            response = sdkResponse;
                            activeTransport = 'sdk_gateway';
                            break;
                        }
                        lastTransportError = await sdkResponse.text();
                        logger.warn(LogCode.AI_API_CALL, 'Grok SDK gateway request failed, fallback to direct xAI', {
                            status: sdkResponse.status,
                            error: lastTransportError,
                        });
                        continue;
                    }

                    const directResponse = await fetch(XAI_API_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${XAI_API_KEY}`,
                        },
                        body: JSON.stringify(directRequestBody),
                    });

                    // Compatibility fallback: if xAI rejects built-in tool schema, retry once with function tools only.
                    if (!directResponse.ok && providerManagedSearchTools.length > 0) {
                        const firstErrorText = await directResponse.text();
                        const shouldFallback = directResponse.status === 400 || directResponse.status === 410 || directResponse.status === 422;
                        if (shouldFallback) {
                            logger.warn(LogCode.AI_API_CALL, 'Grok built-in search tool schema rejected, retrying without provider tools', {
                                status: directResponse.status,
                                error: firstErrorText,
                            });
                            const fallbackBody = {
                                ...directRequestBody,
                                tools: toolDefinitions,
                            };
                            const retried = await fetch(XAI_API_URL, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${XAI_API_KEY}`,
                                },
                                body: JSON.stringify(fallbackBody),
                            });
                            if (retried.ok) {
                                response = retried;
                                activeTransport = 'xai_direct';
                                break;
                            }
                            lastTransportError = await retried.text();
                            logger.error(LogCode.AI_API_CALL, 'Grok direct fallback failed', {
                                status: retried.status,
                                error: lastTransportError,
                            });
                        } else {
                            lastTransportError = firstErrorText;
                            logger.error(LogCode.AI_API_CALL, 'Grok API error', { status: directResponse.status, error: firstErrorText });
                        }
                    } else if (directResponse.ok) {
                        response = directResponse;
                        activeTransport = 'xai_direct';
                        break;
                    } else {
                        lastTransportError = await directResponse.text();
                        logger.error(LogCode.AI_API_CALL, 'Grok API error', { status: directResponse.status, error: lastTransportError });
                    }
                } catch (e: any) {
                    lastTransportError = e?.message || String(e);
                    logger.warn(LogCode.AI_API_CALL, 'Grok transport attempt failed', { transport, error: lastTransportError });
                }
            }

            if (!response || !response.ok) {
                const status = response ? response.status : 'no_response';
                const errText = response ? await response.text() : lastTransportError || 'Unknown transport failure';
                logger.error(LogCode.AI_API_CALL, 'Grok API error', { status, error: errText });
                throw new Error(`Grok API error: ${status} ${errText}`);
            }

            logger.debug(LogCode.AI_API_CALL, 'Grok transport selected', {
                transport: activeTransport,
                sessionId: task.sessionId,
            });

            const reader = response.body!.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let grokChunkReadCount = 0;
            const GROK_CANCEL_CHECK_INTERVAL = 5;

            let assistantContent = '';
            let toolCalls: any[] = [];
            const providerToolStatusBroadcasted = new Set<string>();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                grokChunkReadCount++;

                // Fast cancellation check (Redis <1ms)
                if (grokChunkReadCount % GROK_CANCEL_CHECK_INTERVAL === 0) {
                    const cancelled = await this.checkTaskCancelled(task.id, 'Grok');
                    if (cancelled) {
                        logger.info(LogCode.AI_ORCHESTRATOR, 'Grok stream cancelled by user', {
                            taskId: task.id,
                        });
                        return;
                    }
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ') || line.trim() === 'data: [DONE]') continue;

                    try {
                        const data = JSON.parse(line.slice(6));
                        // Compatibility: llm-gateway streams envelope events like:
                        // { event_type, provider_request_id, payload: { text|usage|citations|tool_calls } }
                        // Handle these before OpenAI-style chunk parsing.
                        const gatewayEventType = typeof data?.event_type === 'string' ? String(data.event_type) : '';
                        if (gatewayEventType) {
                            if (typeof data?.provider_request_id === 'string' && data.provider_request_id.trim()) {
                                latestProviderResponseId = data.provider_request_id;
                            }

                            if (gatewayEventType === 'error') {
                                const gwErr = data?.payload?.message || data?.payload?.error || 'Unknown gateway stream error';
                                throw new Error(`Grok gateway stream error: ${gwErr}`);
                            }

                            if (gatewayEventType === 'usage' && data?.payload?.usage) {
                                lastUsage = data.payload.usage;
                            }

                            if (gatewayEventType === 'citation') {
                                const newGatewayCitations = this.appendUniqueCitations(
                                    allCitations,
                                    citationUrlSet,
                                    data?.payload?.citations
                                );
                                if (newGatewayCitations.length > 0) {
                                    this.ws.broadcastToUser(userId!, {
                                        type: 'citations',
                                        sessionId: task.sessionId,
                                        data: {
                                            message_id: assistantMessageId,
                                            citations: newGatewayCitations,
                                        }
                                    });
                                }
                            }

                            if (gatewayEventType === 'tool_call' && Array.isArray(data?.payload?.tool_calls)) {
                                for (const tc of data.payload.tool_calls) {
                                    if (!tc || typeof tc !== 'object') continue;
                                    const idx = Number.isFinite(tc.index) ? Number(tc.index) : toolCalls.length;
                                    if (!toolCalls[idx]) {
                                        toolCalls[idx] = { ...tc, function: { ...(tc.function || {}) } };
                                    } else {
                                        if (!toolCalls[idx].function) toolCalls[idx].function = {};
                                        if (tc.id) toolCalls[idx].id = tc.id;
                                        if (tc.function?.name) toolCalls[idx].function.name = tc.function.name;
                                        if (tc.function?.arguments) {
                                            toolCalls[idx].function.arguments = (toolCalls[idx].function.arguments || '') + tc.function.arguments;
                                        }
                                    }
                                }
                            }

                            if (gatewayEventType === 'delta_text') {
                                const gatewayText = String(data?.payload?.text || '');
                                if (gatewayText) {
                                    if (firstTokenAt === null) {
                                        firstTokenAt = Date.now();
                                        this.broadcastLatencyMetrics(userId, task, {
                                            ttftMs: firstTokenAt - apiRequestStartedAt,
                                            inputTokensEstimated: lastBudgetMetrics?.inputTokensEstimated,
                                            toolRounds: iteration,
                                        });
                                    }
                                    assistantContent += gatewayText;
                                    fullContent += gatewayText;
                                    const scrubbedDelta = scrub(gatewayText);
                                    const chunkData = {
                                        index: chunkIndex++,
                                        type: 'content' as const,
                                        content: scrubbedDelta,
                                        delta: scrubbedDelta,
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
                            }

                            if (gatewayEventType === 'delta_reasoning') {
                                const reasoningText = String(data?.payload?.text || '');
                                if (reasoningText) {
                                    const scrubbedReasoning = scrub(reasoningText);
                                    const chunkData = {
                                        index: chunkIndex++,
                                        type: 'reasoning' as const,
                                        reasoning_content: scrubbedReasoning,
                                        messageId: assistantMessageId
                                    };
                                    this.ws.broadcastToUser(userId!, { type: 'chunk', sessionId: task.sessionId, data: chunkData });
                                }
                            }

                            // Gateway event handled, skip OpenAI chunk parsing for this line.
                            continue;
                        }

                        if (typeof data?.response_id === 'string') latestProviderResponseId = data.response_id;
                        if (typeof data?.id === 'string') latestProviderResponseId = data.id;
                        const choice = data.choices?.[0];
                        const delta = choice?.delta;

                        // Handle usage data if present
                        if (data.usage) {
                            lastUsage = data.usage;
                        }

                        // xAI may emit citations in different locations depending on tool/search path.
                        // Collect all known shapes and broadcast only newly discovered citations.
                        const newCitations = [
                            ...this.appendUniqueCitations(allCitations, citationUrlSet, choice?.message?.citations),
                            ...this.appendUniqueCitations(allCitations, citationUrlSet, choice?.delta?.citations),
                            ...this.appendUniqueCitations(allCitations, citationUrlSet, data?.citations),
                            ...this.appendUniqueCitations(allCitations, citationUrlSet, data?.sources),
                            ...this.appendUniqueCitations(allCitations, citationUrlSet, data?.references),
                        ];
                        if (newCitations.length > 0) {
                            this.ws.broadcastToUser(userId!, {
                                type: 'citations',
                                sessionId: task.sessionId,
                                data: {
                                    message_id: assistantMessageId,
                                    citations: newCitations,
                                }
                            });
                        }

                        if (!delta) continue;

                        // Accumulate tool calls
                        if (delta.tool_calls) {
                            for (const tc of delta.tool_calls) {
                                if (!toolCalls[tc.index]) {
                                    toolCalls[tc.index] = { ...tc, function: { ...tc.function } };
                                } else {
                                    if (!toolCalls[tc.index].function) {
                                        toolCalls[tc.index].function = {};
                                    }
                                    if (tc.id) {
                                        toolCalls[tc.index].id = tc.id;
                                    }
                                    if (tc.function?.name) {
                                        toolCalls[tc.index].function.name = tc.function.name;
                                    }
                                    if (tc.function?.arguments) {
                                        toolCalls[tc.index].function.arguments = (toolCalls[tc.index].function.arguments || '') + tc.function.arguments;
                                    }
                                }

                                const mergedToolName = String(toolCalls[tc.index]?.function?.name || '').trim().toLowerCase();
                                if (this.isGrokProviderManagedSearchTool(mergedToolName) && !providerToolStatusBroadcasted.has(mergedToolName)) {
                                    providerToolStatusBroadcasted.add(mergedToolName);
                                    this.broadcastTaskStatus(userId, task, {
                                        status: 'running',
                                        iteration,
                                        maxIterations,
                                        message: this.getToolStatusMessage(mergedToolName),
                                    });
                                }
                            }
                        }

                        // Handle content chunks
                        if (delta.content) {
                            if (firstTokenAt === null) {
                                firstTokenAt = Date.now();
                                this.broadcastLatencyMetrics(userId, task, {
                                    ttftMs: firstTokenAt - apiRequestStartedAt,
                                    inputTokensEstimated: lastBudgetMetrics?.inputTokensEstimated,
                                    toolRounds: iteration,
                                });
                            }
                            assistantContent += delta.content;
                            fullContent += delta.content;

                            const scrubbedDelta = scrub(delta.content);
                            const chunkData = {
                                index: chunkIndex++,
                                type: 'content' as const,
                                content: scrubbedDelta,
                                delta: scrubbedDelta,
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
                    } catch (e: any) {
                        // Ignore malformed SSE fragments, but DO NOT swallow real stream errors.
                        if (e instanceof SyntaxError) continue;
                        throw e;
                    }
                }
            }

            // After stream: Add assistant message to history
            const compactToolCalls = toolCalls.filter(Boolean);
            const shouldExecuteLocalTools = activeTransport === 'xai_direct';
            const localToolCalls = shouldExecuteLocalTools
                ? compactToolCalls.filter(tc => !this.isGrokProviderManagedSearchTool(tc?.function?.name))
                : [];
            const providerToolCalls = shouldExecuteLocalTools
                ? compactToolCalls.filter(tc => this.isGrokProviderManagedSearchTool(tc?.function?.name))
                : compactToolCalls;
            if (providerToolCalls.length > 0) {
                logger.info(LogCode.AI_API_CALL, 'Grok provider-managed search tool calls observed', {
                    sessionId: task.sessionId,
                    count: providerToolCalls.length,
                    names: providerToolCalls.map(tc => String(tc?.function?.name || '').trim().toLowerCase()).filter(Boolean),
                });
            }
            if (!shouldExecuteLocalTools && compactToolCalls.length > 0) {
                logger.info(LogCode.AI_API_CALL, 'Grok sdk_gateway tool calls handled upstream; skipping Node local tool execution', {
                    sessionId: task.sessionId,
                    count: compactToolCalls.length,
                    names: compactToolCalls.map(tc => String(tc?.function?.name || '').trim().toLowerCase()).filter(Boolean),
                });
            }

            const assistantMsg = {
                role: 'assistant',
                content: assistantContent || '',
                tool_calls: localToolCalls.length > 0 ? localToolCalls.map(tc => ({
                    id: tc.id,
                    type: 'function',
                    function: tc.function
                })) : undefined
            };
            (grokMessages as any[]).push(assistantMsg);

            // Execute tools if any
            if (localToolCalls.length > 0) {
                const toolResults = await Promise.all(localToolCalls.map(async (tc) => {
                    const name = tc.function.name;
                    const args = JSON.parse(tc.function.arguments || '{}');
                    const toolKey = `${String(name || '').trim().toLowerCase()}:${this.stableStringify(args)}`;
                    if (seenLocalToolKeys.has(toolKey)) {
                        return {
                            toolMessage: {
                                role: 'tool',
                                tool_call_id: tc.id,
                                name: name,
                                content: `No further tool calls (duplicate tool+args: ${name})`
                            },
                            citations: []
                        };
                    }
                    seenLocalToolKeys.add(toolKey);

                    this.broadcastTaskStatus(userId, task, {
                        status: 'running',
                        message: `Executing tool: ${name}`
                    });

                    try {
                        const result = await toolRegistry.execute(name, args, {
                            userId: userId || undefined,
                            sessionId: task.sessionId,
                            task,
                            toolResultsCache
                        });

                        const toolCitations = this.appendUniqueCitations(
                            allCitations,
                            citationUrlSet,
                            (result && typeof result === 'object') ? (result as any).citations : undefined
                        );

                        return {
                            toolMessage: {
                                role: 'tool',
                                tool_call_id: tc.id,
                                name: name,
                                content: typeof result === 'string' ? result : JSON.stringify(result)
                            },
                            citations: toolCitations
                        };
                    } catch (err: any) {
                        return {
                            toolMessage: {
                                role: 'tool',
                                tool_call_id: tc.id,
                                name: name,
                                content: `Error: ${err.message || String(err)}`
                            },
                            citations: []
                        };
                    }
                }));

                const newToolCitations = toolResults.flatMap(r => r.citations || []);
                if (newToolCitations.length > 0) {
                    this.ws.broadcastToUser(userId!, {
                        type: 'citations',
                        sessionId: task.sessionId,
                        data: {
                            message_id: assistantMessageId,
                            citations: newToolCitations,
                        }
                    });
                }

                grokMessages.push(...toolResults.map(r => r.toolMessage));
            } else {
                // No more tool calls, we are done
                break;
            }
        }

        if (latestProviderResponseId && GROK_ENABLE_PREVIOUS_RESPONSE) {
            this.grokResponseIdBySession.set(task.sessionId, latestProviderResponseId);
            if (this.isUnifiedOrchestrator()) {
                try {
                    await this.persistConversationRef(task, { previousResponseId: latestProviderResponseId });
                } catch (e: any) {
                    logger.warn(LogCode.DB_TRANSACTION_FAILED, 'Grok: failed to persist previous_response_id (non-critical)', {
                        taskId: task.id,
                        error: e?.message || String(e),
                    });
                }
            }
        }

        // Final output moderation
        const modResult = await moderationClient.moderateOutput(fullContent, userId, task.sessionId, task.model);
        if (!modResult.safe) {
            fullContent = modResult.filtered_text || '[Content removed for safety]';
        }
        fullContent = this.redactToolNames(fullContent);
        if ((fullContent || '').trim() === '') {
            fullContent = 'I did not receive a valid response payload from the model. Please retry.';
            logger.warn(LogCode.AI_API_CALL, 'Grok: completed with empty content, applied fallback text', {
                taskId: task.id,
                sessionId: task.sessionId,
                iteration,
            });
        }

        await this.persistAssistantMessageSafe({
            assistantMessageId,
            patch: {
                content: fullContent,
                usage: lastUsage || undefined,
                citations: allCitations.length > 0 ? allCitations : undefined,
                status: 'complete'
            },
            logLabel: 'Grok final update',
        });

        await this.persistBillingUsage({
            assistantMessageId,
            userId,
            model: task.model,
            usage: lastUsage,
            toolContext: task.toolContext,
            toolCallsCount: iteration,
        });

        this.broadcastLatencyMetrics(userId, task, {
            latencyMs: Date.now() - taskProcessStartedAt,
            inputTokensEstimated: lastBudgetMetrics?.inputTokensEstimated,
            promptTokens: lastUsage?.prompt_tokens,
            completionTokens: lastUsage?.completion_tokens,
            totalTokens: lastUsage?.total_tokens,
            toolRounds: iteration,
        });
        this.broadcastAssistantMessageComplete(userId, task.sessionId, assistantMessageId, {
            status: 'success',
            totalIterations: iteration,
            usage: lastUsage || undefined,
        });

        logger.throttled(LogCode.AI_API_CALL, 'Grok: task completed', { taskId: task.id, chunks: chunkIndex });
    }
}

export const chatWorkerLegacy = new ChatWorker();
