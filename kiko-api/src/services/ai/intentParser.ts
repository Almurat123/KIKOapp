/**
 * Intent Parser Service (Backend)
 * Converts natural language to structured Intent for WebSocket architecture
 * Supports both high-level (5 types) and detailed (31 types) intent classification
 */

import type { UserContext } from './types.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import { fetchJson } from '../../config/unifiedApiService.js';

// High-level intent types (for system prompt selection)
export type HighLevelIntentType =
    | 'TRADING'
    | 'COPY_TRADING'
    | 'MARKET_ANALYSIS'
    | 'PREDICTION_MARKETS'
    | 'SOCIAL_SENSING'
    | 'RISK_SCAN'
    | 'GENERAL_CHAT';

// Detailed intent types (for precise API routing and tool selection)
export type DetailedIntentType =
    // Token intents
    | 'token_info'
    | 'token_search'
    | 'token_detail'
    | 'token_chart'
    | 'token_trending'
    // Swap/Trading intents
    | 'swap'
    | 'auto_buy'
    | 'auto_sell'
    | 'strategy_create'
    | 'strategy_list'
    | 'strategy_delete'
    // Wallet intents
    | 'wallet_info'
    | 'wallet_balance'
    | 'wallet_transactions'
    // Market intents
    | 'market_data'
    | 'market_overview'
    | 'market_chains'
    | 'market_protocols'
    // Social intents
    | 'social_trending'
    | 'social_user_info'
    // Security intents
    | 'token_security'
    // Wallet PNL
    | 'wallet_pnl'
    // General
    | 'general_query';

// High-level intent result (for system prompt)
export interface HighLevelIntent {
    type: HighLevelIntentType;
    confidence: number;
}

export interface IntentLabelScore {
    label: HighLevelIntentType;
    confidence: number;
    evidence: string[];
    source: 'rule' | 'classifier' | 'llm';
}

export interface IntentConflict {
    type: 'risk_trade' | 'multi';
    labels: HighLevelIntentType[];
    question: string;
}

export interface IntentDecision {
    primary: HighLevelIntentType;
    confidence: number;
    labels: Array<{ label: HighLevelIntentType; confidence: number }>;
    evidence: IntentLabelScore[];
    routing: {
        stage: 'rule' | 'classifier' | 'llm' | 'hybrid';
        reason: string;
    };
    hardRule?: {
        label: HighLevelIntentType;
        reason: string;
    };
    signals?: {
        hasContractAddress: boolean;
        hasAction: boolean;
        hasQuestion: boolean;
        hasRisk: boolean;
        hasSocial: boolean;
        hasWallet: boolean;
        hasCopyTrade: boolean;
        hasPrediction: boolean;
        hasAmount: boolean;
        hasAsset: boolean;
    };
    slots?: {
        action: boolean;
        amount: boolean;
        asset: boolean;
        target: boolean;
        complete: boolean;
    };
    conflict?: IntentConflict;
}

// Detailed intent result (for API routing and tool selection)
export interface DetailedIntent {
    version: string;
    intent_id: string;
    correlation_id?: string;
    origin: 'chat' | 'market' | 'news' | 'defi';
    action: DetailedIntentType;
    // Token info
    token_address?: string;
    token_symbol?: string;
    chain_id?: number;
    // Swap
    token_in?: string;
    token_out?: string;
    amount?: string;
    amount_asset?: string;
    slippage_bps?: number;
    deadline_s?: number;
    max_gas?: string | 'auto';
    // List/Wallet
    wallet_address?: string;
    // Strategy
    trigger?: {
        type: 'price_drop_pct' | 'price_rise_pct' | 'price_target' | 'time' | 'wallet_action';
        value?: number;
        window_s?: number;
        min_duration_s?: number;
        target_price?: string;
        wallet_address?: string;
    };
    allowance_mode?: 'one_shot' | 'unlimited';
    validation?: string[];
    // General
    query?: string;
    parameters?: Record<string, any>;
    // Optional metadata (for traceability)
    confidence?: number;
    evidence?: string[];
}

// Combined result
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

// Mapping from detailed intent to high-level intent
const DETAILED_TO_HIGH_LEVEL: Record<DetailedIntentType, HighLevelIntentType> = {
    // TRADING
    'swap': 'TRADING',
    'auto_buy': 'TRADING',
    'auto_sell': 'TRADING',
    'strategy_create': 'TRADING',
    'strategy_list': 'TRADING',
    'strategy_delete': 'TRADING',
    // MARKET_ANALYSIS
    'token_info': 'MARKET_ANALYSIS',
    'token_search': 'MARKET_ANALYSIS',
    'token_detail': 'MARKET_ANALYSIS',
    'token_chart': 'MARKET_ANALYSIS',
    'token_trending': 'MARKET_ANALYSIS',
    'market_data': 'MARKET_ANALYSIS',
    'market_overview': 'MARKET_ANALYSIS',
    'market_chains': 'MARKET_ANALYSIS',
    'market_protocols': 'MARKET_ANALYSIS',
    'wallet_info': 'MARKET_ANALYSIS',
    'wallet_balance': 'MARKET_ANALYSIS',
    'wallet_transactions': 'MARKET_ANALYSIS',
    // SOCIAL_SENSING
    'social_trending': 'SOCIAL_SENSING',
    'social_user_info': 'SOCIAL_SENSING',
    // RISK_SCAN
    'token_security': 'RISK_SCAN',
    // Wallet PNL
    'wallet_pnl': 'MARKET_ANALYSIS',
    // GENERAL_CHAT
    'general_query': 'GENERAL_CHAT',
};

const DETAILED_INTENT_SYSTEM_PROMPT = `You are an AI assistant that helps users interact with Web3 DeFi protocols. Your job is to understand user intent and convert it to structured JSON.

Available intent types:
- token_info: Get information about a token (price, liquidity, volume, risk score)
- token_search: Search for tokens by symbol or name
- token_detail: Get detailed token information
- token_chart: Get token price chart data
- token_trending: Get trending tokens
- swap: Execute a token swap
- auto_buy: Set up automatic buy when conditions are met
- auto_sell: Set up automatic sell when conditions are met
- strategy_create: Create a trading strategy
- strategy_list: List existing strategies
- strategy_delete: Delete a strategy
- wallet_info: Get wallet information (may show list card with transactions)
- wallet_balance: Check wallet balance
- wallet_transactions: Get wallet transactions
- market_data: Get market data (trends, charts, etc.) (may show list card with trending tokens)
- market_overview: Get market overview statistics
- market_chains: Get blockchain chains data
- market_protocols: Get DeFi protocols data
- social_trending: Get trending social media posts (Farcaster)
- social_user_info: Get Farcaster user information
- token_security: Scan token security
- wallet_pnl: Analyze wallet trading performance (PNL, win rate, realized profit)
- general_query: General questions or chat

For token queries, extract:
- token_symbol (e.g., "ETH", "USDC")
- token_address (if provided)
- chain_id (default: 1 for Ethereum, 8453 for Base, etc.)

For swap queries, extract:
- token_in: input token symbol or address
- token_out: output token symbol or address
- amount: amount to swap
- amount_asset: unit of amount (e.g., "USDC", "ETH")
- slippage_bps: slippage tolerance in basis points (default: 50 = 0.5%)
- chain_id: blockchain network

For auto_buy/auto_sell, extract:
- token_in, token_out, amount, amount_asset
- trigger: conditions for execution
  - type: "price_drop_pct" | "price_rise_pct" | "price_target" | "time" | "wallet_action"
  - value: percentage or target value
  - window_s: time window in seconds
- allowance_mode: "one_shot" or "unlimited"

Always respond with valid JSON in this format:
{
  "version": "1.0",
  "intent_id": "generated-uuid",
  "origin": "chat",
  "action": "intent_type",
  ...relevant_fields...
}

If the user's intent is unclear or not related to Web3/DeFi, use action: "general_query" and include a "query" field with the user's question.

IMPORTANT: If the user message contains:
- A contract address (EVM: 0x + 40 hex, or Solana: base58 32-44 chars)
- Swap keywords: "swap", "trade", "exchange", "convert", "buy", "sell", "swap to", "trade for"
- Token symbols mentioned together (e.g., "ETH to USDC", "swap 100 USDC for ETH", "用SOL买USDC")
Then the action should be "swap" and you must extract token_in, token_out, and amount if available.

CONTRACT ADDRESS HANDLING:
- If user provides a contract address (EVM or Solana format), it means they want to BUY that token
- Set token_out to the contract address
- Set token_address to the contract address
- For Solana addresses, also set chain_id to 900
- Default token_in to "USDC" unless user specifies otherwise (for Solana, use "SOL" if context suggests)
- Don't guess addresses. Only use what is explicitly provided.`;

/**
 * Detect contract address pattern
 */
function detectContractAddress(text: string): string | null {
    // EVM address: 0x + 40 hex
    const evmPattern = /0x[a-fA-F0-9]{40}/i;
    const evmMatch = text.match(evmPattern);
    if (evmMatch) return evmMatch[0];

    // Solana address: base58, 32-44 chars
    const solanaPattern = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
    const words = text.split(/\s+/);

    for (const word of words) {
        if (solanaPattern.test(word) && word.length >= 32 && word.length <= 44) {
            const hasMultipleVowels = (word.match(/[aeiou]/gi) || []).length > 3;
            if (!hasMultipleVowels || word.length > 40) {
                return word;
            }
        }
    }

    return null;
}

/**
 * Detect copy trade keywords
 * This prevents copy trade commands from being misclassified as swap intents
 */
function hasCopyTradeKeywords(text: string): boolean {
    const copyTradeKeywords = [
        'copy trade', 'copy trading', 'copytrade', 'copytrading', 'copy-trade', 'copy-trading',
        'mirror trade', 'mirror trading',
        'follow trade', 'follow trading',
        'copy trader', 'copy this trader', 'follow this trader',
        'copy strategy', 'create a copy strategy',
        '跟单', '复制交易', '镜像交易'
    ];
    const lowerText = text.toLowerCase();
    return copyTradeKeywords.some(keyword => lowerText.includes(keyword));
}

/**
 * Detect swap keywords
 */
function hasSwapKeywords(text: string): boolean {
    const swapKeywords = [
        'swap', 'trade', 'exchange', 'convert',
        'buy', 'sell', 'swap to', 'trade for',
        'exchange for', 'convert to'
    ];
    const lowerText = text.toLowerCase();

    // CRITICAL: Exclude copy trade commands from swap detection
    // "copy trade" contains "trade" but should NOT trigger swap intent
    if (hasCopyTradeKeywords(text)) {
        logger.debug(LogCode.SYS_INFO, 'IntentParser: Copy trade detected, skipping swap keywords check');
        return false;
    }

    return swapKeywords.some(keyword => lowerText.includes(keyword));
}

function hasRiskKeywords(text: string): boolean {
    return /\b(risk|safe|honeypot|security|scan|check.*safe|is.*safe|scam|rug)\b/i.test(text) ||
        /\b(风险|安全|蜜罐|诈骗|拉盘|跑路)\b/i.test(text);
}

function hasTradeVerbs(text: string): boolean {
    if (hasCopyTradeKeywords(text)) {
        return false;
    }
    return /\b(swap|trade|exchange|convert|buy|sell|purchase|ape)\b/i.test(text) ||
        /\b(兑换|交易|买|购买|卖|卖出)\b/i.test(text);
}

/**
 * Extract token symbols from message
 */
function extractTokenSymbols(text: string): { tokenIn?: string; tokenOut?: string } {
    const commonTokens = ['ETH', 'USDC', 'USDT', 'DAI', 'WBTC', 'BTC', 'BNB', 'MATIC', 'POL', 'AVAX', 'SOL'];
    const tokenAlternatives = [...commonTokens].sort((a, b) => b.length - a.length);
    const tokenPattern = new RegExp(`\\b(${tokenAlternatives.join('|')})\\b`, 'gi');

    // Preserve appearance order in the user's text (do not use the static commonTokens order).
    const foundOrdered: string[] = [];
    const seen = new Set<string>();
    for (const match of text.matchAll(tokenPattern)) {
        const token = String(match[1] || '').toUpperCase();
        if (!token || seen.has(token)) continue;
        seen.add(token);
        foundOrdered.push(token);
        if (foundOrdered.length >= 2) break;
    }

    // Pattern: "ETH to USDC" or "swap ETH for USDC"
    // IMPORTANT: Only match if both sides are actual token symbols, not numbers
    // "buy 0xabc for 0.01 BNB" should NOT match "0.01" as tokenIn
    const toPattern = /\b([A-Z]{2,10})\s+(?:to|for|->)\s+([A-Z]{2,10})\b/i;
    const toMatch = text.match(toPattern);
    if (toMatch) {
        const maybeTokenIn = toMatch[1].toUpperCase();
        const maybeTokenOut = toMatch[2].toUpperCase();
        // Only use if they look like token symbols (not numbers)
        if (commonTokens.includes(maybeTokenIn) || commonTokens.includes(maybeTokenOut)) {
            return {
                tokenIn: maybeTokenIn,
                tokenOut: maybeTokenOut,
            };
        }
    }

    // Pattern: "buy X for Y BNB" - the native token is what we're spending
    // In this case, BNB is tokenIn, and X (contract address) is tokenOut
    const buyForPattern = /\bfor\s+([\d.]+)\s+(ETH|BNB|SOL|MATIC|POL|AVAX)\b/i;
    const buyForMatch = text.match(buyForPattern);
    if (buyForMatch) {
        const nativeToken = buyForMatch[2].toUpperCase();
        return {
            tokenIn: nativeToken,
            tokenOut: undefined, // Will be set from contract address
        };
    }

    if (foundOrdered.length >= 2) {
        return {
            tokenIn: foundOrdered[0],
            tokenOut: foundOrdered[1],
        };
    }

    // If only one token found and it's a native token, it's likely tokenIn for a buy
    if (foundOrdered.length === 1 && ['ETH', 'BNB', 'SOL', 'MATIC', 'POL', 'AVAX'].includes(foundOrdered[0])) {
        return {
            tokenIn: foundOrdered[0],
            tokenOut: undefined,
        };
    }

    // If only one token found and it's NOT a native token, treat it as tokenOut (buy target)
    if (foundOrdered.length === 1) {
        return {
            tokenIn: undefined,
            tokenOut: foundOrdered[0],
        };
    }

    return {};
}

// -----------------------------
// Lightweight intent classifier
// -----------------------------
const STOPWORDS = new Set([
    'a', 'an', 'the', 'to', 'of', 'in', 'on', 'for', 'and', 'or', 'is', 'are', 'with', 'at', 'by', 'from',
    'this', 'that', 'it', 'as', 'be', 'do', 'does', 'did', 'will', 'should', 'can', 'could',
]);

const INTENT_PROTOTYPES: Record<HighLevelIntentType, string[]> = {
    TRADING: [
        'swap eth to usdc',
        'buy this token',
        'sell all my tokens',
        'convert sol to usdc',
        'swap 100 usdc for eth on base',
    ],
    RISK_SCAN: [
        'is this token safe',
        'honeypot check',
        'is it a scam',
        'security scan token',
        '风险 安全 蜜罐',
    ],
    COPY_TRADING: [
        'copy trade this wallet',
        'mirror trades from this address',
        'follow this wallet',
        '跟单 复制交易',
    ],
    PREDICTION_MARKETS: [
        'polymarket odds',
        'betting market question',
        'prediction market yes no',
        '赔率 预测市场',
    ],
    SOCIAL_SENSING: [
        'what are people saying on twitter',
        'farcaster trending',
        'social sentiment',
        '社区 热度',
    ],
    MARKET_ANALYSIS: [
        'price chart analysis',
        'token market cap volume',
        'market overview',
        'why is this token pumping',
    ],
    GENERAL_CHAT: [
        'hello',
        'what is kiko',
        'help me',
        'how does this work',
    ],
};

function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .filter((t) => !STOPWORDS.has(t));
}

function hashEmbedding(text: string, dims = 128): number[] {
    const vec = new Array(dims).fill(0);
    const tokens = tokenize(text);
    for (const token of tokens) {
        let hash = 0;
        for (let i = 0; i < token.length; i += 1) {
            hash = (hash * 31 + token.charCodeAt(i)) | 0;
        }
        const idx = Math.abs(hash) % dims;
        vec[idx] += 1;
    }
    return vec;
}

function cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0;
    let aNorm = 0;
    let bNorm = 0;
    for (let i = 0; i < a.length; i += 1) {
        dot += a[i] * b[i];
        aNorm += a[i] * a[i];
        bNorm += b[i] * b[i];
    }
    if (aNorm === 0 || bNorm === 0) return 0;
    return dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm));
}

interface IntentSignals {
    hasContractAddress: boolean;
    hasAction: boolean;
    hasQuestion: boolean;
    hasRisk: boolean;
    hasSocial: boolean;
    hasWallet: boolean;
    hasCopyTrade: boolean;
    hasPrediction: boolean;
    hasAmount: boolean;
    hasAsset: boolean;
}

interface IntentSlots {
    action: boolean;
    amount: boolean;
    asset: boolean;
    target: boolean;
    complete: boolean;
}

function detectQuestionIntent(text: string): boolean {
    return /\b(what\s+is|what's|whats|analy[sz]e|worth|why|should\s+i|opinion|thoughts|narrative|community|sentiment|catalyst|is\s+this|is\s+\w+\s+legit)\b/i.test(text)
        || /\?/.test(text)
        || /(是什么|这是啥|分析|值不值得|能买吗|为什么|叙事|社区|情绪|催化)/.test(text);
}

function detectSellVerb(text: string): boolean {
    return /\b(sell|exit|cash\s*out|dump)\b/i.test(text) || /\b(卖|卖出)\b/.test(text);
}

function detectTargetSymbol(text: string): boolean {
    const symbolPattern = /(?:buy|sell|swap|ape|market\s+buy|market\s+sell)\s+[\d.]*\s*([A-Za-z0-9]{2,10})\b/i;
    const intoPattern = /\b(?:into|to)\s+([A-Za-z0-9]{2,10})\b/i;
    // CRITICAL FIX: Recognize chain names as targets for cross-chain swaps
    // "sell USDC to Base" should have target=true for slots.complete
    const chainNames = /\b(?:to|on)\s+(base|arbitrum|optimism|polygon|avalanche|bnb|ethereum|eth|mainnet)\b/i;
    return symbolPattern.test(text) || intoPattern.test(text) || chainNames.test(text);
}
function detectAmountPresence(text: string): boolean {
    if (/\b(\d{1,3})%/.test(text)) return true;
    if (/\b(all|half|quarter)\b/i.test(text)) return true;
    if (/\b(\d+\.?\d*)\s*(?:USDC|ETH|SOL|USDT|BNB|BTC|MATIC|POL)\b/i.test(text)) return true;
    return /\b(buy|sell|swap)\s+(\d+\.?\d*)\b/i.test(text);
}

function detectAssetPresence(text: string, tokenSymbols: { tokenIn?: string; tokenOut?: string }): boolean {
    if (tokenSymbols.tokenIn || tokenSymbols.tokenOut) return true;
    return /\b(ETH|USDC|USDT|SOL|BNB|BTC|MATIC|POL|ARB|OP|BASE)\b/i.test(text);
}

function getIntentSignals(userMessage: string, userContext?: UserContext): { signals: IntentSignals; slots: IntentSlots } {
    const contractAddress = detectContractAddress(userMessage);
    const tokenSymbols = extractTokenSymbols(userMessage);
    const hasSwap = hasSwapKeywords(userMessage);
    const hasTradeVerb = hasTradeVerbs(userMessage);
    const hasRisk = hasRiskKeywords(userMessage);
    const hasCopyTrade = hasCopyTradeKeywords(userMessage);
    const hasPrediction = /\b(polymarket|prediction\s*market|prediction|betting|bet\s+on|odds|implied\s+probability|market\s+probability|market\s+price)\b/i.test(userMessage);
    const hasSocial = /\b(trending|social|farcaster|twitter|x|sentiment|buzz|mentions?|influencer|kol|community\s+posts?|what.*people|what.*saying|on\s+x|on\s+twitter|on\s+farcaster)\b/i.test(userMessage);
    const hasWallet = /\b(wallet|balance|transaction|tx\s*history|portfolio|holdings|pnl|profit|loss)\b/i.test(userMessage);
    const hasQuestion = detectQuestionIntent(userMessage);
    const hasAmount = detectAmountPresence(userMessage);
    const hasAsset = detectAssetPresence(userMessage, tokenSymbols);
    const isSell = detectSellVerb(userMessage);
    const hasAction = hasSwap || hasTradeVerb;
    const target = !!contractAddress || !!tokenSymbols.tokenOut || !!tokenSymbols.tokenIn || detectTargetSymbol(userMessage);
    const slots: IntentSlots = {
        action: hasAction,
        amount: hasAmount,
        asset: hasAsset,
        target,
        complete: hasAction && hasAmount && target && (hasAsset || isSell),
    };

    return {
        signals: {
            hasContractAddress: !!contractAddress,
            hasAction,
            hasQuestion,
            hasRisk,
            hasSocial,
            hasWallet,
            hasCopyTrade,
            hasPrediction,
            hasAmount,
            hasAsset,
        },
        slots,
    };
}

function classifyIntentLight(text: string): { scores: Record<HighLevelIntentType, number>; top: HighLevelIntentType; confidence: number } {
    const scores: Record<HighLevelIntentType, number> = {
        TRADING: 0,
        RISK_SCAN: 0,
        COPY_TRADING: 0,
        PREDICTION_MARKETS: 0,
        SOCIAL_SENSING: 0,
        MARKET_ANALYSIS: 0,
        GENERAL_CHAT: 0,
    };

    const inputVec = hashEmbedding(text);
    for (const label of Object.keys(INTENT_PROTOTYPES) as HighLevelIntentType[]) {
        const protoList = INTENT_PROTOTYPES[label];
        let best = 0;
        for (const proto of protoList) {
            const sim = cosineSimilarity(inputVec, hashEmbedding(proto));
            if (sim > best) best = sim;
        }
        // Normalize to 0..1
        scores[label] = Math.max(0, Math.min(1, best));
    }

    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]) as [HighLevelIntentType, number][];
    const [top, confidence] = sorted[0];
    return { scores, top, confidence };
}

function evaluateRuleLayer(userMessage: string, userContext?: UserContext): {
    scores: IntentLabelScore[];
    signals: IntentSignals;
    slots: IntentSlots;
    hardRule?: { label: HighLevelIntentType; reason: string };
} {
    const { signals, slots } = getIntentSignals(userMessage, userContext);
    const tokenSymbols = extractTokenSymbols(userMessage);
    const looksLikeAnalysisQuestion = detectQuestionIntent(userMessage);
    const hasMarketAnalysisKeywords = /\b(price|chart|volume|liquidity|market.*cap|token.*info|token.*data|analysis)\b/i.test(userMessage);

    const scores: Partial<Record<HighLevelIntentType, IntentLabelScore>> = {};
    const add = (label: HighLevelIntentType, confidence: number, evidence: string[]) => {
        const existing = scores[label];
        if (!existing || confidence > existing.confidence) {
            scores[label] = { label, confidence, evidence, source: 'rule' };
        } else {
            existing.evidence.push(...evidence);
        }
    };

    if (signals.hasCopyTrade) {
        add('COPY_TRADING', 0.95, ['keyword: copy trade']);
    }
    if (signals.hasPrediction) {
        add('PREDICTION_MARKETS', 0.9, ['keyword: prediction/betting']);
    }
    if (signals.hasRisk) {
        add('RISK_SCAN', signals.hasAction ? 0.6 : 0.9, ['keyword: risk/safety']);
    }
    if (signals.hasAction && slots.complete && !signals.hasQuestion) {
        add('TRADING', 0.9, ['action + slots complete']);
    }
    if (signals.hasAction && !slots.complete) {
        add('MARKET_ANALYSIS', 0.7, ['trade intent incomplete']);
    }
    if (signals.hasContractAddress && !signals.hasAction) {
        add('MARKET_ANALYSIS', looksLikeAnalysisQuestion ? 0.9 : 0.8, ['contract address (no trade verb)']);
    }
    if (signals.hasQuestion) {
        add('MARKET_ANALYSIS', 0.9, ['question intent']);
    }
    if (signals.hasSocial) {
        add('SOCIAL_SENSING', 0.8, ['keyword: social/trending']);
    }
    if (signals.hasWallet) {
        add('MARKET_ANALYSIS', 0.8, ['keyword: wallet/portfolio']);
    }
    if (hasMarketAnalysisKeywords || (tokenSymbols.tokenIn && tokenSymbols.tokenOut)) {
        add('MARKET_ANALYSIS', 0.75, ['keyword: market analysis']);
    }

    if (Object.keys(scores).length === 0) {
        add('GENERAL_CHAT', 0.5, ['fallback: no rule match']);
    }

    const hardRule = (() => {
        if (signals.hasCopyTrade) return { label: 'COPY_TRADING' as HighLevelIntentType, reason: 'copy trade keyword' };
        if (signals.hasPrediction) return { label: 'PREDICTION_MARKETS' as HighLevelIntentType, reason: 'prediction market keyword' };
        if (signals.hasRisk && (signals.hasQuestion || !signals.hasAction)) {
            return { label: 'RISK_SCAN' as HighLevelIntentType, reason: 'risk question without trade action' };
        }
        if (signals.hasSocial) return { label: 'SOCIAL_SENSING' as HighLevelIntentType, reason: 'social intent' };
        // CRITICAL FIX: Prioritize TRADING over question intent when slots are complete
        // "Can you sell my 3 USDC to Base?" should be TRADING, not MARKET_ANALYSIS
        if (signals.hasAction && slots.complete) return { label: 'TRADING' as HighLevelIntentType, reason: 'action + slots complete' };
        if (signals.hasQuestion) return { label: 'MARKET_ANALYSIS' as HighLevelIntentType, reason: 'question intent' };
        if (signals.hasWallet) return { label: 'MARKET_ANALYSIS' as HighLevelIntentType, reason: 'wallet intent' };
        if (signals.hasContractAddress && !signals.hasAction) {
            return { label: 'MARKET_ANALYSIS' as HighLevelIntentType, reason: 'contract address without action' };
        }
        return undefined;
    })();

    return {
        scores: Object.values(scores).filter(Boolean) as IntentLabelScore[],
        signals,
        slots,
        hardRule,
    };
}

function detectIntentConflict(labels: Array<{ label: HighLevelIntentType; confidence: number }>): IntentConflict | undefined {
    const byLabel = new Map(labels.map((l) => [l.label, l.confidence]));
    if ((byLabel.get('TRADING') || 0) >= 0.65 && (byLabel.get('RISK_SCAN') || 0) >= 0.65) {
        return {
            type: 'risk_trade',
            labels: ['TRADING', 'RISK_SCAN'],
            question: 'Do you want to trade now, or only do a safety check first?',
        };
    }
    if (labels.length >= 2 && labels[0].confidence - labels[1].confidence < 0.12) {
        return {
            type: 'multi',
            labels: labels.slice(0, 2).map((l) => l.label),
            question: 'Do you want market analysis, or do you want to execute a trade?',
        };
    }
    return undefined;
}

function buildDecision(
    ruleResult: ReturnType<typeof evaluateRuleLayer>,
    classifierScores: ReturnType<typeof classifyIntentLight>,
    llmLabel?: HighLevelIntentType
): IntentDecision {
    const ruleScores = ruleResult.scores;
    const combinedScores: Record<HighLevelIntentType, number> = {
        TRADING: 0,
        RISK_SCAN: 0,
        COPY_TRADING: 0,
        PREDICTION_MARKETS: 0,
        SOCIAL_SENSING: 0,
        MARKET_ANALYSIS: 0,
        GENERAL_CHAT: 0,
    };

    for (const label of Object.keys(combinedScores) as HighLevelIntentType[]) {
        const rule = ruleScores.find((r) => r.label === label);
        const ruleScore = rule ? rule.confidence : 0;
        const clfScore = classifierScores.scores[label] || 0;
        combinedScores[label] = Math.min(1, ruleScore * 0.6 + clfScore * 0.4);
    }

    if (llmLabel) {
        combinedScores[llmLabel] = Math.max(combinedScores[llmLabel], 0.75);
    }

    if (ruleResult.hardRule) {
        combinedScores[ruleResult.hardRule.label] = Math.max(combinedScores[ruleResult.hardRule.label], 0.95);
    }

    const labels = Object.entries(combinedScores)
        .sort((a, b) => b[1] - a[1])
        .map(([label, confidence]) => ({ label: label as HighLevelIntentType, confidence }));

    const conflict = detectIntentConflict(labels);
    const primary = ruleResult.hardRule ? ruleResult.hardRule.label : labels[0].label;
    const confidence = ruleResult.hardRule ? Math.max(labels[0].confidence, 0.9) : labels[0].confidence;

    return {
        primary,
        confidence,
        labels,
        evidence: [
            ...ruleScores,
            ...(Object.keys(classifierScores.scores) as HighLevelIntentType[]).map((label) => ({
                label,
                confidence: classifierScores.scores[label],
                evidence: ['embedding similarity'],
                source: 'classifier' as const,
            })),
            ...(llmLabel
                ? [{
                    label: llmLabel,
                    confidence: 0.75,
                    evidence: ['llm classification'],
                    source: 'llm' as const,
                }]
                : []),
        ],
        routing: {
            stage: ruleResult.hardRule ? 'rule' : (llmLabel ? 'llm' : (ruleScores.length > 0 ? 'hybrid' : 'classifier')),
            reason: ruleResult.hardRule
                ? `Hard rule: ${ruleResult.hardRule.reason}`
                : (llmLabel ? 'LLM fallback for ambiguous intent' : 'Rule + classifier fusion'),
        },
        hardRule: ruleResult.hardRule,
        signals: ruleResult.signals,
        slots: ruleResult.slots,
        conflict,
    };
}

/**
 * Parse high-level intent using simple heuristics (fast, no API call)
 */
function parseHighLevelIntentHeuristic(
    userMessage: string,
    userContext?: UserContext
): HighLevelIntent {
    const { signals, slots } = getIntentSignals(userMessage, userContext);
    const tokenSymbols = extractTokenSymbols(userMessage);
    const hasRisk = hasRiskKeywords(userMessage);

    // COPY TRADING intent (must run before TRADING)
    if (signals.hasCopyTrade) {
        return {
            type: 'COPY_TRADING',
            confidence: 0.95,
        };
    }

    // PREDICTION MARKETS intent (Polymarket)
    if (signals.hasPrediction) {
        return {
            type: 'PREDICTION_MARKETS',
            confidence: 0.9,
        };
    }

    // RISK_SCAN intent (risk-only questions)
    // If user asks "is it safe/honeypot/rug" and does NOT ask to trade, prioritize risk scanning
    // even if they provided a contract address.
    if (hasRisk && !signals.hasAction) {
        return {
            type: 'RISK_SCAN',
            confidence: 0.9,
        };
    }

    // TRADING intent
    if (signals.hasAction && slots.complete && !signals.hasQuestion) {
        return {
            type: 'TRADING',
            confidence: 0.9,
        };
    }

    // SOCIAL_SENSING intent
    if (signals.hasSocial) {
        return {
            type: 'SOCIAL_SENSING',
            confidence: 0.8,
        };
    }

    // Contract address or question without trade verb is usually analysis.
    if (signals.hasQuestion || signals.hasContractAddress) {
        return {
            type: 'MARKET_ANALYSIS',
            confidence: 0.85,
        };
    }

    // RISK_SCAN intent
    if (hasRisk) {
        return {
            type: 'RISK_SCAN',
            confidence: 0.85,
        };
    }

    // MARKET_ANALYSIS intent
    if (/\b(price|chart|trending|volume|liquidity|market.*cap|token.*info|token.*data|analysis)\b/i.test(userMessage)
        || (tokenSymbols.tokenIn && tokenSymbols.tokenOut)) {
        return {
            type: 'MARKET_ANALYSIS',
            confidence: 0.75,
        };
    }

    // Default to GENERAL_CHAT
    return {
        type: 'GENERAL_CHAT',
        confidence: 0.5,
    };
}

/**
 * Parse detailed intent using AI (DeepSeek API)
 */
async function parseDetailedIntentAI(
    userMessage: string,
    userContext?: UserContext
): Promise<DetailedIntent | null> {
    const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';
    const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
    const apiKey = DEEPSEEK_API_KEY;

    if (!apiKey) {
        logger.info(LogCode.AI_INTENT_FAILED, 'IntentParser: DEEPSEEK_API_KEY not set, falling back to heuristic');
        return null;
    }

    // Build context-aware system prompt
    let systemPrompt = DETAILED_INTENT_SYSTEM_PROMPT;
    if (userContext?.chainId && userContext?.chainName) {
        systemPrompt += `\n\nUSER CONTEXT: \n- Current Chain: ${userContext.chainName} (ID: ${userContext.chainId}) \n - Wallet Connected: ${userContext.isWalletConnected ? 'Yes' : 'No'} \n\nIMPORTANT: Default to chain_id ${userContext.chainId} (${userContext.chainName}) unless the user explicitly mentions another network.`;
    }

    const messages = [
        {
            role: 'system' as const,
            content: systemPrompt,
        },
        {
            role: 'user' as const,
            content: userMessage,
        },
    ];

    try {
        const data = await fetchJson({
            url: DEEPSEEK_API_URL,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY} `,
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages,
                temperature: 0.3, // Lower temperature for more consistent JSON
                max_tokens: 500,
                enable_search: false, // Disable search tools for intent parsing
            }),
        });

        const content = data.choices[0]?.message?.content || '{}';

        // Extract JSON from response (might be wrapped in markdown code blocks)
        let jsonStr = content.trim();
        if (jsonStr.startsWith('```json')) {
            jsonStr = jsonStr.slice(7);
        }
        if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.slice(3);
        }
        if (jsonStr.endsWith('```')) {
            jsonStr = jsonStr.slice(0, -3);
        }
        jsonStr = jsonStr.trim();

        const intent: DetailedIntent = JSON.parse(jsonStr);

        // Validate and enhance intent
        if (!intent.intent_id) {
            intent.intent_id = uuidv4();
        }
        if (!intent.version) {
            intent.version = '1.0';
        }
        if (!intent.origin) {
            intent.origin = 'chat';
        }

        // Enhance swap intent with detected information
        const contractAddress = detectContractAddress(userMessage);
        const hasSwap = hasSwapKeywords(userMessage);
        const tokenSymbols = extractTokenSymbols(userMessage);

        // CRITICAL: Don't force swap intent for copy trade commands
        const isCopyTrade = hasCopyTradeKeywords(userMessage);

        if ((intent.action === 'swap' || hasSwap || contractAddress) && !isCopyTrade) {
            // If AI didn't detect swap but we did, override it
            if (intent.action !== 'swap' && (hasSwap || contractAddress)) {
                intent.action = 'swap';
            }

            // Fill in missing swap fields from detection
            if (contractAddress) {
                intent.token_address = contractAddress;
                if (!intent.token_out) {
                    intent.token_out = contractAddress;
                }

                // Detect if this is a Solana address
                const isSolanaAddress = !contractAddress.startsWith('0x') &&
                    contractAddress.length >= 32 &&
                    contractAddress.length <= 44 &&
                    /^[1-9A-HJ-NP-Za-km-z]+$/.test(contractAddress);

                if (isSolanaAddress && !intent.chain_id) {
                    intent.chain_id = 900;
                }

                // CRITICAL FIX: Ensure tokenIn is not the same as tokenOut
                if (!intent.token_in || intent.token_in === contractAddress) {
                    intent.token_in = isSolanaAddress ? 'SOL' : 'ETH';
                }
            }

            if (!intent.token_in && tokenSymbols.tokenIn) {
                intent.token_in = tokenSymbols.tokenIn;
            }
            if (!intent.token_out && tokenSymbols.tokenOut) {
                intent.token_out = tokenSymbols.tokenOut;
            }

            // If user says "buy X TOKEN" and token_out is missing but token_in is set, treat token_in as target
            if (!intent.token_out && intent.token_in) {
                const hasBuyVerb = /\b(buy|purchase|ape|买|购买)\b/i.test(userMessage);
                const isNativeIn = ['ETH', 'BNB', 'SOL', 'MATIC', 'POL', 'AVAX', 'BASE'].includes(intent.token_in.toUpperCase());
                if (hasBuyVerb && !isNativeIn) {
                    intent.token_out = intent.token_in;
                    intent.token_in = undefined;
                }
            }

            // If token_out exists but token_in missing, default to native token based on chain/context
            if (intent.token_out && !intent.token_in) {
                const isBsc = /\bBNB\b/i.test(userMessage) || userContext?.chainId === 56 || intent.chain_id === 56;
                const isSolana = intent.chain_id === 900;
                const isPolygon = userContext?.chainId === 137 || intent.chain_id === 137;
                intent.token_in = isSolana ? 'SOL' : (isBsc ? 'BNB' : (isPolygon ? 'POL' : 'ETH'));
            }

            // Normalize "BASE" to native token when on Base chain
            if (intent.chain_id === 8453) {
                if (intent.token_in?.toUpperCase() === 'BASE') intent.token_in = 'ETH';
                if (intent.token_out?.toUpperCase() === 'BASE') intent.token_out = 'ETH';
            }

            // FINAL VALIDATION: Ensure tokenIn and tokenOut are different
            if (intent.token_in && intent.token_out && intent.token_in.toLowerCase() === intent.token_out.toLowerCase()) {
                logger.info(LogCode.SYS_INFO, 'IntentParser: AI set tokenIn === tokenOut, fixing...');
                if (contractAddress) {
                    intent.token_out = contractAddress;
                    const isSolanaAddress = !contractAddress.startsWith('0x');
                    intent.token_in = isSolanaAddress ? 'SOL' : 'ETH';
                }
            }

            if (!intent.amount) {
                // Try to extract amount with various patterns
                const amountPatterns = [
                    /(\d+\.?\d*)\s*(?:USDC|ETH|SOL|USDT|BNB)/i,
                    /swap\s+(\d+\.?\d*)/i,
                    /buy\s+(\d+\.?\d*)/i,
                    /(\d+\.?\d*)\s*(?:to|for)/i
                ];

                for (const pattern of amountPatterns) {
                    const match = userMessage.match(pattern);
                    if (match) {
                        intent.amount = match[1];
                        // Try to extract the asset from the same match
                        const assetMatch = userMessage.match(/(\d+\.?\d*)\s*(USDC|ETH|SOL|USDT|BNB)/i);
                        if (assetMatch) {
                            intent.amount_asset = assetMatch[2].toUpperCase();
                        }
                        break;
                    }
                }
            }
        }

        // Set default chain_id if not provided
        if (!intent.chain_id && userContext?.chainId) {
            intent.chain_id = userContext.chainId;
        }

        return intent;
    } catch (error: any) {
        logger.error(LogCode.AI_INTENT_FAILED, 'IntentParser: Error parsing intent with AI', { error: error.message });
        return null;
    }
}

/**
 * Parse detailed intent using heuristics (fallback)
 */
function parseDetailedIntentHeuristic(
    userMessage: string,
    userContext?: UserContext
): DetailedIntent {
    const contractAddress = detectContractAddress(userMessage);
    const tokenSymbols = extractTokenSymbols(userMessage);
    const isSolana = contractAddress && !contractAddress.startsWith('0x') && contractAddress.length >= 32;
    const riskKeywords = hasRiskKeywords(userMessage);
    const { signals, slots } = getIntentSignals(userMessage, userContext);

    // Default intent
    let action: DetailedIntentType = 'general_query';
    let tokenIn: string | undefined;
    let tokenOut: string | undefined;
    let amount: string | undefined;
    let isSellOperation = false;

    // Detect swap
    // CRITICAL: Copy trade commands should NOT be classified as swap intents
    // even if they contain a contract address (which is the TARGET WALLET, not a token)
    const isStrategyCondition = /\b(when|if|once|whenever)\b/i.test(userMessage);
    const isCopyTradeCommand = hasCopyTradeKeywords(userMessage);
    const riskOnly = signals.hasRisk && !signals.hasAction;
    const shouldTrade = signals.hasAction
        && slots.complete
        && !signals.hasQuestion
        && !riskOnly
        && !isStrategyCondition
        && !isCopyTradeCommand;

    // If user asks "is 0x... safe/honeypot?" (risk-only), do NOT treat it as a swap intent.
    if (shouldTrade) {
        action = 'swap';

        // Detect if this is a SELL operation (selling the contract address token)
        isSellOperation = /\b(sell|卖)\b/i.test(userMessage) && !!contractAddress;

        // Detect native token based on chain
        const isBsc = /\bBNB\b/i.test(userMessage) || userContext?.chainId === 56;
        const isPolygon = userContext?.chainId === 137;
        const nativeToken = isSolana ? 'SOL' : (isBsc ? 'BNB' : (isPolygon ? 'POL' : 'ETH'));

        if (isSellOperation) {
            // Selling: contract address is tokenIn, native token is tokenOut
            tokenIn = contractAddress || undefined;
            tokenOut = tokenSymbols.tokenOut || nativeToken;
        } else {
            // Buying: native token is tokenIn, contract address is tokenOut
            tokenIn = tokenSymbols.tokenIn || nativeToken;
            tokenOut = contractAddress || tokenSymbols.tokenOut;
        }

        // If user says "buy X TOKEN" and token_out is missing but token_in is set, treat token_in as target
        if (!tokenOut && tokenIn) {
            const hasBuyVerb = /\b(buy|purchase|ape|买|购买)\b/i.test(userMessage);
            const isNativeIn = ['ETH', 'BNB', 'SOL', 'MATIC', 'POL', 'AVAX', 'BASE'].includes(tokenIn.toUpperCase());
            if (hasBuyVerb && !isNativeIn) {
                tokenOut = tokenIn;
                tokenIn = undefined;
            }
        }

        // If token_out exists but token_in missing, default to native token based on chain/context
        if (tokenOut && !tokenIn) {
            const isBsc = /\bBNB\b/i.test(userMessage) || userContext?.chainId === 56;
            const isPolygon = userContext?.chainId === 137;
            tokenIn = isSolana ? 'SOL' : (isBsc ? 'BNB' : (isPolygon ? 'POL' : 'ETH'));
        }

        // Normalize "BASE" to native token when on Base chain
        if ((userContext?.chainId || 0) === 8453) {
            if (tokenIn?.toUpperCase() === 'BASE') tokenIn = 'ETH';
            if (tokenOut?.toUpperCase() === 'BASE') tokenOut = 'ETH';
        }

        // CRITICAL FIX: Ensure tokenIn and tokenOut are different
        // Use case-insensitive comparison for addresses
        const tokenInLower = tokenIn?.toLowerCase();
        const tokenOutLower = tokenOut?.toLowerCase();
        if (tokenInLower && tokenOutLower && tokenInLower === tokenOutLower) {
            logger.info(LogCode.SYS_INFO, 'IntentParser: tokenIn and tokenOut are the same, fixing...');
            // If we have a contract address, it should be tokenOut (buying)
            if (contractAddress) {
                tokenOut = contractAddress;
                // Detect native token based on context - check for BNB mention
                const isBsc = /\bBNB\b/i.test(userMessage) || userContext?.chainId === 56;
                tokenIn = isSolana ? 'SOL' : (isBsc ? 'BNB' : 'ETH');
            }
        }

        // Parse amount - support percentage and quantity keywords
        // Priority: explicit percentage > quantity keywords > numeric values

        // Check for percentage keywords (all, half, quarter, etc.)
        const percentageKeywords: { [key: string]: string } = {
            // English keywords
            'all': 'all',
            '100%': 'all',
            'half': '50%',
            '50%': '50%',
            'quarter': '25%',
            '25%': '25%',
            '75%': '75%',
            '10%': '10%',
            '20%': '20%',
            '30%': '30%',
            '40%': '40%',
            '60%': '60%',
            '70%': '70%',
            '80%': '80%',
            '90%': '90%',
            // Chinese keywords
            '全部': 'all',
            '一半': '50%',
            '四分之一': '25%',
            '四分之三': '75%',
        };

        // First check for percentage patterns
        const percentMatch = userMessage.match(/\b(\d{1,3})%/);
        if (percentMatch) {
            const percent = parseInt(percentMatch[1]);
            if (percent > 0 && percent <= 100) {
                amount = percent === 100 ? 'all' : `${percent}%`;
            }
        }

        // Check for keyword-based percentages
        if (!amount) {
            for (const [keyword, value] of Object.entries(percentageKeywords)) {
                // Use word boundary for English, direct match for Chinese
                const isChineseKeyword = /[\u4e00-\u9fff]/.test(keyword);
                const pattern = isChineseKeyword
                    ? new RegExp(keyword, 'i')
                    : new RegExp(`\\b${keyword}\\b`, 'i');

                if (pattern.test(userMessage)) {
                    amount = value;
                    break;
                }
            }
        }

        // Fall back to numeric amount parsing
        if (!amount) {
            // Prefer patterns with explicit asset units (prevents matching "0x..." as amount).
            amount = userMessage.match(/(?:^|\s)(\d+\.?\d*)\s*(?:USDC|ETH|SOL|USDT|BNB)\b/i)?.[1] ||
                userMessage.match(/for\s+(\d+\.?\d*)\s*(?:USDC|ETH|SOL|USDT|BNB)\b/i)?.[1] ||
                userMessage.match(/\bswap\s+(\d+\.?\d*)(?:\s|$)/i)?.[1] ||
                userMessage.match(/\b(?:buy|sell)\s+(\d+\.?\d*)(?:\s|$)/i)?.[1] ||
                userMessage.match(/(\d+\.?\d*)\s+(?:worth|of)\b/i)?.[1];
        }

        logger.debug(LogCode.SYS_INFO, 'IntentParser: Amount parsing result', {
            rawMessage: userMessage.slice(0, 50),
            parsedAmount: amount,
            isSellOperation: isSellOperation
        });
    }
    // Detect token security
    else if (riskKeywords) {
        action = 'token_security';
    }
    // Default analysis when user asks a question or provides a CA without trade intent
    else if (action === 'general_query' &&
        (signals.hasQuestion || signals.hasContractAddress) &&
        !signals.hasWallet &&
        !signals.hasSocial &&
        !signals.hasPrediction &&
        !signals.hasCopyTrade) {
        action = 'token_info';
    }
    // Detect token info
    else if (/\b(price|chart|info|data|detail).*(?:token|coin|eth|btc|usdc)\b/i.test(userMessage)) {
        action = 'token_info';
    }
    // Detect PNL
    else if (/\b(pnl|profit|loss|win\s*rate|performance|收益|利润|胜率)\b/i.test(userMessage)) {
        action = 'wallet_pnl';
    }
    // Detect trending
    else if (/\b(trending|hot|popular|top)\b/i.test(userMessage)) {
        if (/\b(social|farcaster|twitter)\b/i.test(userMessage)) {
            action = 'social_trending';
        } else {
            action = 'token_trending';
        }
    }
    // Detect wallet
    else if (/\b(wallet|balance|transaction)\b/i.test(userMessage)) {
        if (/\b(balance)\b/i.test(userMessage)) {
            action = 'wallet_balance';
        } else if (/\b(transaction|tx|history)\b/i.test(userMessage)) {
            action = 'wallet_transactions';
        } else {
            action = 'wallet_info';
        }
    }
    // Detect market
    else if (/\b(market|overview|chains|protocols)\b/i.test(userMessage)) {
        if (/\b(overview|summary)\b/i.test(userMessage)) {
            action = 'market_overview';
        } else if (/\b(chains|blockchain)\b/i.test(userMessage)) {
            action = 'market_chains';
        } else if (/\b(protocols|defi)\b/i.test(userMessage)) {
            action = 'market_protocols';
        } else {
            action = 'market_data';
        }
    }

    return {
        version: '1.0',
        intent_id: uuidv4(),
        origin: 'chat',
        action,
        token_address: contractAddress || undefined,
        token_symbol: tokenSymbols.tokenOut,
        chain_id: isSolana ? 900 : (userContext?.chainId || 1),
        token_in: tokenIn,
        token_out: tokenOut,
        amount,
        amount_asset: action === 'swap' && amount ? (tokenIn || undefined) : undefined,
    };
}

/**
 * Main intent parser (hybrid: heuristic + AI fallback)
 */
export async function parseIntent(
    userMessage: string,
    userContext?: UserContext
): Promise<ParsedIntent> {
    const timerLabel = `intent_parsing_${uuidv4().slice(0, 8)}`;
    logger.startTimer(timerLabel);

    // Step 1: Rule layer + lightweight classifier
    const ruleResult = evaluateRuleLayer(userMessage, userContext);
    const classifier = classifyIntentLight(userMessage);
    let decision = buildDecision(ruleResult, classifier);

    let highLevel: HighLevelIntent = {
        type: decision.primary,
        confidence: decision.confidence,
    };

    // Step 2: Parse detailed intent
    let detailed: DetailedIntent;

    // Use AI if:
    // - Confidence is low (< 0.7)
    // - Message is complex (long or contains multiple concepts)
    // - Rule conflict detected
    const shouldUseAI = highLevel.confidence < 0.7 ||
        !!decision.conflict ||
        userMessage.length > 100 ||
        /(?:and|also|then|after|when)/i.test(userMessage);

    if (shouldUseAI) {
        logger.debug(LogCode.SYS_INFO, 'IntentParser: Using AI for detailed intent parsing');
        const aiIntent = await parseDetailedIntentAI(userMessage, userContext);
        if (aiIntent) {
            detailed = aiIntent;
        } else {
            logger.debug(LogCode.SYS_INFO, 'IntentParser: AI parsing failed, falling back to heuristic for detailed intent parsing');
            detailed = parseDetailedIntentHeuristic(userMessage, userContext);
        }
    } else {
        logger.debug(LogCode.SYS_INFO, 'IntentParser: Using heuristic for detailed intent parsing');
        detailed = parseDetailedIntentHeuristic(userMessage, userContext);
    }

    // Step 3: Map detailed intent to high-level (if mismatch, trust detailed)
    const mappedHighLevel = DETAILED_TO_HIGH_LEVEL[detailed.action] || highLevel.type;
    const allowOverride = !decision.hardRule && !decision.signals?.hasQuestion;
    if (allowOverride && mappedHighLevel !== highLevel.type && detailed.action !== 'general_query') {
        logger.debug(LogCode.SYS_INFO, 'IntentParser: High-level intent corrected', { from: highLevel.type, to: mappedHighLevel });
        highLevel.type = mappedHighLevel;
        highLevel.confidence = Math.max(highLevel.confidence, 0.75);
        decision = buildDecision(ruleResult, classifier, mappedHighLevel);
    }

    // Step 4: Extract additional metadata
    // CRITICAL: Force regex result over AI hallucination
    // The AI sometimes invents addresses (e.g., 0x123...) when none are provided
    // We ONLY trust what the regex explicitly finds in the user's message
    const contractAddress = detectContractAddress(userMessage);
    const tokenSymbols = extractTokenSymbols(userMessage);

    logger.endTimer(timerLabel, LogCode.AI_INTENT_PARSED, {
        userAddress: userContext?.userAddress,
        intent: detailed.action,
        highLevelIntent: highLevel.type,
        hasAI: shouldUseAI,
        confidence: highLevel.confidence,
        routingStage: decision.routing.stage,
        conflict: decision.conflict?.type,
        hardRule: decision.hardRule?.label,
        slotsComplete: decision.slots?.complete,
        labels: decision.labels?.slice(0, 3),
    });

    return {
        highLevel,
        detailed,
        contractAddress: contractAddress || undefined, // IGNORE detailed.token_address
        chainId: detailed.chain_id,
        swapIntent: detailed.action === 'swap' ? {
            tokenIn: detailed.token_in,
            tokenOut: detailed.token_out,
            amount: detailed.amount,
        } : undefined,
        decision,
    };
}

// Export types for backward compatibility
export type IntentType = HighLevelIntentType;
