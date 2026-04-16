// CONTEXT MEMORY
// Updated: 2026-04-17
// Author: Almurat
// Reason: the backend intent parser has its own model fallback for
//         model-routed parsing. That fallback must follow the product's free
//         Kimi 2.5 Instant/Fast default when INTENT_MODEL and DEFAULT_MODEL are
//         not configured.
// Goal: keep model-routed intent parsing on the current default family without
//       overriding explicit environment configuration.
// Owns: backend intent-parser fallback model selection.
// Does Not Own: chat session model persistence, frontend dropdown state, or
//               provider-specific request shaping.
// Design Language:
// - Explicit INTENT_MODEL wins over DEFAULT_MODEL.
// - DEFAULT_MODEL wins over the hardcoded product fallback.
// - The hardcoded fallback must match kiko-api/src/config/chatModels.ts.
// Document Provenance:
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-default-chat-model-switch-to-kimi-instant.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: backend intent model fallback
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-default-chat-model-switch-to-kimi-instant.md

import type { UserContext } from './types.js';
import { v4 as uuidv4 } from 'uuid';
import { fetchJson } from '../../config/unifiedApiService.js';
import { defaultNativeSymbolForChain, resolveTradeSemantics } from './tradeSemantics.js';

export type HighLevelIntentType =
    | 'TRADING'
    | 'COPY_TRADING'
    | 'PREDICTION_MARKETS'
    | 'RISK_SCAN'
    | 'GENERAL_QUERY';

export type DetailedIntentType =
    | 'swap'
    | 'copy_trade'
    | 'cross_chain_trade'
    | 'general_query';

export interface HighLevelIntent {
    type: HighLevelIntentType;
    confidence: number;
}

export interface IntentDecision {
    primary: HighLevelIntentType;
    confidence: number;
    labels: Array<{ label: HighLevelIntentType; confidence: number }>;
    routing: {
        stage: 'model' | 'rule' | 'fallback';
        reason: string;
    };
    hardRule?: {
        label: HighLevelIntentType;
        reason: string;
    };
}

export interface DetailedIntent {
    version: string;
    intent_id: string;
    origin: 'chat';
    action: DetailedIntentType;
    token_address?: string;
    token_symbol?: string;
    chain_id?: number;
    token_in?: string;
    token_out?: string;
    amount?: string;
    amount_semantic?: 'input' | 'output';
    wallet_address?: string;
    query?: string;
    parameters?: Record<string, any>;
    confidence?: number;
    evidence?: string[];
}

export interface ParsedIntent {
    highLevel: HighLevelIntent;
    detailed: DetailedIntent;
    contractAddress?: string;
    chainId?: number;
    swapIntent?: {
        tokenIn?: string;
        tokenOut?: string;
        amount?: string;
    };
    decision?: IntentDecision;
}

type IntentModelOutput = {
    highLevel?: {
        type?: string;
        confidence?: number;
    };
    detailed?: Partial<DetailedIntent> & {
        action?: string;
    };
    decision?: {
        primary?: string;
        confidence?: number;
        labels?: Array<{ label?: string; confidence?: number }>;
        routing?: {
            stage?: string;
            reason?: string;
        };
        hardRule?: {
            label?: string;
            reason?: string;
        };
    };
};

const DEFAULT_INTENT_MODEL = 'kimi-k2-5-instant';

const ALLOWED_HIGH_LEVELS = new Set<HighLevelIntentType>([
    'TRADING',
    'COPY_TRADING',
    'PREDICTION_MARKETS',
    'RISK_SCAN',
    'GENERAL_QUERY',
]);

const ALLOWED_ACTIONS = new Set<DetailedIntentType>([
    'swap',
    'copy_trade',
    'cross_chain_trade',
    'general_query',
]);

function getIntentModelRouterEnabled(): boolean {
    const mode = String(process.env.INTENT_MODEL_ROUTER || 'model').trim().toLowerCase();
    return !['0', 'false', 'off', 'rules', 'rule', 'legacy'].includes(mode);
}

function getIntentModelName(): string {
    return String(process.env.INTENT_MODEL || process.env.DEFAULT_MODEL || DEFAULT_INTENT_MODEL).trim() || DEFAULT_INTENT_MODEL;
}

function getIntentGatewayUrl(): string {
    return (process.env.LLM_GATEWAY_URL || 'http://127.0.0.1:8000/llm-gateway').replace(/\/+$/, '');
}

function getIntentTimeoutMs(): number {
    return Math.max(1500, Number(process.env.INTENT_MODEL_TIMEOUT_MS || '8000'));
}

function getIntentHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const internalKey = process.env.INTERNAL_SERVICE_KEY || '';
    if (internalKey) {
        headers['X-Service-Key'] = internalKey;
        headers['X-Internal-Service-Key'] = internalKey;
    }
    return headers;
}

export function detectContractAddress(text: string): string | null {
    const evmPattern = /0x[a-fA-F0-9]{40}/i;
    const evmMatch = text.match(evmPattern);
    if (evmMatch) return evmMatch[0];

    const solanaPattern = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
    const words = text.split(/\s+/);
    for (const word of words) {
        if (solanaPattern.test(word) && word.length >= 32 && word.length <= 44) {
            return word;
        }
    }
    return null;
}

function detectChainId(contractAddress: string | null, userContext?: UserContext): number | undefined {
    if (userContext?.chainId) return userContext.chainId;
    if (!contractAddress) return undefined;
    return contractAddress.startsWith('0x') ? 8453 : 900;
}

function hasCopyTradeKeywords(text: string): boolean {
    return /\b(copy ?trade|copytrading|copy-trade|follow this trader|mirror trade)\b/i.test(text)
        || /(跟单|复制交易|镜像交易)/i.test(text);
}

function hasCrossChainKeywords(text: string): boolean {
    return /\b(cross.chain|cross chain|bridge|bridging)\b/i.test(text);
}

function hasTradeKeywords(text: string): boolean {
    if (hasCopyTradeKeywords(text)) return false;
    return /\b(swap|trade|exchange|convert|buy|sell|purchase|ape)\b/i.test(text)
        || /(兑换|交易|买|购买|卖|卖出)/i.test(text);
}

function hasConfirmationKeywords(text: string): boolean {
    const cleanText = text.trim().toLowerCase();
    if (/^(proceed|confirm|yes|go ahead|execute|do it|approve|submit|ok|okay|sure|确认|确定|执行|好的|继续)$/i.test(cleanText)) {
        return true;
    }
    return /\b(confirm transaction|execute swap|proceed with trade|proceed with swap|continue with trade|confirm trade)\b/i.test(text);
}

function clampConfidence(value: unknown, fallback: number): number {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(1, n));
}

function normalizeHighLevelType(value: unknown, fallback: HighLevelIntentType): HighLevelIntentType {
    const candidate = String(value || '').trim().toUpperCase();
    return ALLOWED_HIGH_LEVELS.has(candidate as HighLevelIntentType)
        ? candidate as HighLevelIntentType
        : fallback;
}

function normalizeAction(value: unknown, fallback: DetailedIntentType): DetailedIntentType {
    const candidate = String(value || '').trim().toLowerCase();
    return ALLOWED_ACTIONS.has(candidate as DetailedIntentType)
        ? candidate as DetailedIntentType
        : fallback;
}

function normalizeStage(value: unknown): 'model' | 'rule' | 'fallback' {
    const candidate = String(value || '').trim().toLowerCase();
    if (candidate === 'model' || candidate === 'rule' || candidate === 'fallback') return candidate;
    return 'fallback';
}

function looksLikeTokenAddress(value: unknown): boolean {
    const candidate = String(value || '').trim();
    return /^0x[a-fA-F0-9]{40}$/.test(candidate) || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(candidate);
}

function buildContextSummary(userContext?: UserContext, contractAddress?: string | null, chainId?: number) {
    return {
        userAddress: userContext?.userAddress,
        chainId: userContext?.chainId ?? chainId,
        chainName: userContext?.chainName,
        isWalletConnected: userContext?.isWalletConnected,
        currentPage: userContext?.currentPage,
        pageContext: userContext?.pageContext,
        pendingSwapToken: userContext?.pendingSwapToken,
        detectedContractAddress: contractAddress || undefined,
    };
}

function buildClassifierMessages(message: string, contextSummary: Record<string, unknown>): Array<{ role: 'system' | 'user'; content: string }> {
    const system = [
        'You are KiKo intent classifier.',
        'Classify the latest user message into a single intent and slot set.',
        'Return only valid JSON and no markdown, no prose, and no code fences.',
        'Allowed high-level types: TRADING, COPY_TRADING, PREDICTION_MARKETS, RISK_SCAN, GENERAL_QUERY.',
        'Allowed detailed actions: swap, copy_trade, cross_chain_trade, general_query.',
        'Use GENERAL_QUERY for research, news, discovery, explanation, and non-action questions.',
        'Use TRADING only when the user is actually asking to buy, sell, swap, exchange, or bridge an asset.',
        'Do not infer trading intent from token mentions alone.',
        'Use the context block for wallet, chain, and pending token hints, but do not invent missing values.',
        'Response schema:',
        '{',
        '  "highLevel": {"type": string, "confidence": number},',
        '  "detailed": {',
        '    "action": string,',
        '    "token_address": string | null,',
        '    "token_symbol": string | null,',
        '    "chain_id": number | null,',
        '    "token_in": string | null,',
        '    "token_out": string | null,',
        '    "amount": string | null,',
        '    "amount_semantic": "input" | "output",',
        '    "confidence": number,',
        '    "evidence": [string]',
        '  },',
        '  "decision": {',
        '    "primary": string,',
        '    "confidence": number,',
        '    "labels": [{"label": string, "confidence": number}],',
        '    "routing": {"stage": "model", "reason": string}',
        '  }',
        '}',
    ].join('\n');

    const user = JSON.stringify({
        message,
        context: contextSummary,
    });

    return [
        { role: 'system', content: system },
        { role: 'user', content: user },
    ];
}

function extractJsonObject(raw: string): Record<string, any> | null {
    const text = String(raw || '').trim();
    if (!text) return null;
    const stripped = text
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```$/i, '')
        .trim();

    const attemptParse = (candidate: string): Record<string, any> | null => {
        try {
            const parsed = JSON.parse(candidate);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed as Record<string, any>;
            }
        } catch {
            return null;
        }
        return null;
    };

    const direct = attemptParse(stripped);
    if (direct) return direct;

    const first = stripped.indexOf('{');
    const last = stripped.lastIndexOf('}');
    if (first >= 0 && last > first) {
        return attemptParse(stripped.slice(first, last + 1));
    }
    return null;
}

function extractAssistantText(events: Array<Record<string, any>>): string {
    return events
        .map((event) => {
            const eventType = String(event?.event_type || event?.type || '');
            if (eventType !== 'delta_text' && eventType !== 'assistant_delta') return '';
            const payload = event?.payload || {};
            return String(payload?.text || payload?.content || '');
        })
        .join('');
}

async function classifyIntentWithModel(message: string, userContext?: UserContext, contractAddress?: string | null, chainId?: number): Promise<IntentModelOutput | null> {
    if (!getIntentModelRouterEnabled()) return null;

    const response = await fetchJson<{ events?: Array<Record<string, any>> }>({
        url: `${getIntentGatewayUrl()}/internal/v1/generate`,
        method: 'POST',
        headers: getIntentHeaders(),
        timeout: getIntentTimeoutMs(),
        body: JSON.stringify({
            model: getIntentModelName(),
            messages: buildClassifierMessages(message, buildContextSummary(userContext, contractAddress, chainId)),
            stream: false,
            tools: [],
            enable_search: false,
        }),
    });

    const events = Array.isArray(response?.events) ? response.events : [];
    for (const event of events) {
        if (String(event?.event_type || event?.type || '').toLowerCase() === 'error') {
            throw new Error(String(event?.payload?.message || 'intent classification failed'));
        }
    }

    const content = extractAssistantText(events);
    const parsed = extractJsonObject(content);
    return parsed as IntentModelOutput | null;
}

function parseIntentWithRules(message: string, userContext?: UserContext): ParsedIntent {
    const contractAddress = detectContractAddress(message);
    const chainId = detectChainId(contractAddress, userContext);

    let highLevel: HighLevelIntent = {
        type: 'GENERAL_QUERY',
        confidence: 0.55,
    };
    let action: DetailedIntentType = 'general_query';
    let reason = 'general_query_fallback';
    const decision: IntentDecision = {
        primary: 'GENERAL_QUERY',
        confidence: 0.55,
        labels: [{ label: 'GENERAL_QUERY', confidence: 0.55 }],
        routing: {
            stage: 'rule',
            reason,
        },
    };

    if (hasCopyTradeKeywords(message)) {
        highLevel = { type: 'COPY_TRADING', confidence: 0.95 };
        action = 'copy_trade';
        reason = 'copy_trade_keyword';
        decision.primary = 'COPY_TRADING';
        decision.confidence = 0.95;
        decision.labels = [{ label: 'COPY_TRADING', confidence: 0.95 }];
        decision.routing.reason = reason;
        decision.hardRule = { label: 'COPY_TRADING', reason };
    } else if (hasConfirmationKeywords(message) || hasTradeKeywords(message) || hasCrossChainKeywords(message)) {
        highLevel = { type: 'TRADING', confidence: hasConfirmationKeywords(message) ? 0.98 : 0.9 };
        action = hasCrossChainKeywords(message) ? 'cross_chain_trade' : 'swap';
        reason = hasConfirmationKeywords(message)
            ? 'trade_confirmation_keyword'
            : (hasCrossChainKeywords(message) ? 'cross_chain_keyword' : 'trade_keyword');
        decision.primary = 'TRADING';
        decision.confidence = highLevel.confidence;
        decision.labels = [{ label: 'TRADING', confidence: highLevel.confidence }];
        decision.routing.reason = reason;
        decision.hardRule = { label: 'TRADING', reason };
    }

    const semantics = action === 'general_query'
        ? null
        : resolveTradeSemantics({
            text: message,
            chainId,
            requestedTokenAddresses: contractAddress ? [contractAddress] : [],
            requestedTokenSymbols: userContext?.pendingSwapToken?.symbol ? [userContext.pendingSwapToken.symbol] : [],
            preferredTokenAddress: contractAddress || undefined,
            preferredTokenSymbol: userContext?.pendingSwapToken?.symbol,
        });
    const tokenOut = semantics?.tokenOut;
    const tokenIn = semantics?.tokenIn || defaultNativeSymbolForChain(chainId);
    const amount = semantics?.amount.value;
    const amountSemantic = semantics?.amount.semantic === 'output'
        ? 'output'
        : 'input';

    const detailed: DetailedIntent = {
        version: 'trade_only_v2',
        intent_id: uuidv4(),
        origin: 'chat',
        action,
        token_address: contractAddress || undefined,
        chain_id: chainId,
        token_in: tokenIn,
        token_out: tokenOut,
        amount,
        amount_semantic: amountSemantic,
        wallet_address: userContext?.userAddress,
        query: message,
        confidence: highLevel.confidence,
        evidence: [decision.routing.reason],
    };

    return {
        highLevel,
        detailed,
        contractAddress: contractAddress || undefined,
        chainId,
        swapIntent: action === 'swap' || action === 'cross_chain_trade'
            ? {
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                amount,
            }
            : undefined,
        decision,
    };
}

function normalizeModelIntent(message: string, userContext: UserContext | undefined, raw: IntentModelOutput, fallback: ParsedIntent): ParsedIntent {
    const fallbackHighLevel = fallback.highLevel;
    const fallbackDetailed = fallback.detailed;
    const fallbackDecision = fallback.decision;

    const modelHighLevel = normalizeHighLevelType(raw?.highLevel?.type, fallbackHighLevel.type);
    const modelConfidence = clampConfidence(raw?.highLevel?.confidence ?? raw?.decision?.confidence ?? raw?.detailed?.confidence, fallbackHighLevel.confidence);
    const modelAction = normalizeAction(
        raw?.detailed?.action,
        modelHighLevel === 'COPY_TRADING'
            ? 'copy_trade'
            : modelHighLevel === 'TRADING'
                ? 'swap'
                : 'general_query'
    );

    const modelTokenAddress = typeof raw?.detailed?.token_address === 'string' && looksLikeTokenAddress(raw.detailed.token_address)
        ? raw.detailed.token_address.trim()
        : undefined;
    const contractAddress = modelTokenAddress || detectContractAddress(message) || fallback.contractAddress || undefined;
    const chainId = raw?.detailed?.chain_id || fallback.chainId || detectChainId(contractAddress || null, userContext);
    const tokenIn = typeof raw?.detailed?.token_in === 'string' && raw.detailed.token_in.trim()
        ? raw.detailed.token_in.trim()
        : (modelHighLevel === 'TRADING' ? fallbackDetailed.token_in : undefined);
    const tokenOut = typeof raw?.detailed?.token_out === 'string' && raw.detailed.token_out.trim()
        ? raw.detailed.token_out.trim()
        : (modelHighLevel === 'TRADING' ? fallbackDetailed.token_out : undefined);
    const tokenSymbol = typeof raw?.detailed?.token_symbol === 'string' && raw.detailed.token_symbol.trim()
        ? raw.detailed.token_symbol.trim()
        : fallbackDetailed.token_symbol;
    const amount = typeof raw?.detailed?.amount === 'string' && raw.detailed.amount.trim()
        ? raw.detailed.amount.trim()
        : (modelHighLevel === 'TRADING' ? fallbackDetailed.amount : undefined);
    const amountSemantic = raw?.detailed?.amount_semantic === 'output'
        ? 'output'
        : raw?.detailed?.amount_semantic === 'input'
            ? 'input'
            : fallbackDetailed.amount_semantic || 'input';

    const decisionLabels = Array.isArray(raw?.decision?.labels) && raw.decision?.labels.length > 0
        ? raw.decision.labels
            .map((label) => ({
                label: normalizeHighLevelType(label?.label, modelHighLevel),
                confidence: clampConfidence(label?.confidence, modelConfidence),
            }))
            .filter((label) => !!label.label)
        : [{ label: modelHighLevel, confidence: modelConfidence }];

    const highLevel: HighLevelIntent = {
        type: modelHighLevel,
        confidence: modelConfidence,
    };

    const detailed: DetailedIntent = {
        ...fallbackDetailed,
        version: fallbackDetailed.version || 'trade_only_v2',
        intent_id: fallbackDetailed.intent_id || uuidv4(),
        origin: 'chat',
        action: modelHighLevel === 'TRADING' || modelHighLevel === 'COPY_TRADING'
            ? modelAction
            : 'general_query',
        token_address: contractAddress,
        token_symbol: tokenSymbol,
        chain_id: chainId,
        token_in: modelHighLevel === 'TRADING' || modelHighLevel === 'COPY_TRADING' ? tokenIn : undefined,
        token_out: modelHighLevel === 'TRADING' || modelHighLevel === 'COPY_TRADING' ? tokenOut : undefined,
        amount: modelHighLevel === 'TRADING' || modelHighLevel === 'COPY_TRADING' ? amount : undefined,
        amount_semantic: modelHighLevel === 'TRADING' || modelHighLevel === 'COPY_TRADING' ? amountSemantic : 'input',
        wallet_address: userContext?.userAddress,
        query: message,
        confidence: modelConfidence,
        evidence: Array.isArray(raw?.detailed?.evidence) && raw.detailed.evidence.length > 0
            ? raw.detailed.evidence.map((item) => String(item)).filter(Boolean)
            : [`model:${raw?.decision?.routing?.reason || 'classified'}`],
    };

    const decision: IntentDecision = {
        primary: normalizeHighLevelType(raw?.decision?.primary, modelHighLevel),
        confidence: clampConfidence(raw?.decision?.confidence, modelConfidence),
        labels: decisionLabels,
        routing: {
            stage: normalizeStage(raw?.decision?.routing?.stage) === 'fallback'
                ? 'model'
                : normalizeStage(raw?.decision?.routing?.stage),
            reason: String(raw?.decision?.routing?.reason || 'model_classification'),
        },
    };

    if (raw?.decision?.hardRule?.label || fallbackDecision?.hardRule) {
        decision.hardRule = raw?.decision?.hardRule?.label
            ? {
                label: normalizeHighLevelType(raw.decision.hardRule.label, modelHighLevel),
                reason: String(raw.decision.hardRule.reason || 'model_hard_rule'),
            }
            : fallbackDecision?.hardRule;
    }

    return {
        highLevel,
        detailed,
        contractAddress,
        chainId,
        swapIntent: modelHighLevel === 'TRADING' || modelHighLevel === 'COPY_TRADING'
            ? {
                tokenIn,
                tokenOut,
                amount,
            }
            : undefined,
        decision,
    };
}

export async function parseIntent(
    userMessage: string,
    userContext?: UserContext
): Promise<ParsedIntent> {
    const message = String(userMessage || '').trim();
    const contractAddress = detectContractAddress(message);
    const chainId = detectChainId(contractAddress, userContext);
    const fallback = parseIntentWithRules(message, userContext);

    try {
        const modelOutput = await classifyIntentWithModel(message, userContext, contractAddress, chainId);
        if (modelOutput) {
            return normalizeModelIntent(message, userContext, modelOutput, fallback);
        }
    } catch {
        // fall through to deterministic fallback
    }

    return fallback;
}

export type IntentType = HighLevelIntentType;
