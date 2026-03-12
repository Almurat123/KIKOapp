import type { UserContext } from './types.js';
import { v4 as uuidv4 } from 'uuid';

export type HighLevelIntentType =
    | 'TRADING'
    | 'COPY_TRADING'
    | 'MARKET_ANALYSIS'
    | 'PREDICTION_MARKETS'
    | 'SOCIAL_SENSING'
    | 'RISK_SCAN'
    | 'GENERAL_CHAT';

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
        stage: 'rule';
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

const STABLE_SYMBOLS = new Set(['USDC', 'USDT', 'DAI', 'FDUSD', 'BUSD', 'USD1']);
const NATIVE_SYMBOLS = new Set(['ETH', 'WETH', 'BNB', 'WBNB', 'SOL', 'WSOL', 'POL', 'MATIC', 'WMATIC']);
const CHAIN_DEFAULT_NATIVE: Record<number, string> = {
    1: 'ETH',
    10: 'ETH',
    56: 'BNB',
    137: 'POL',
    42161: 'ETH',
    8453: 'ETH',
    900: 'SOL',
};

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
        || /\b(跟单|复制交易|镜像交易)\b/i.test(text);
}

function hasCrossChainKeywords(text: string): boolean {
    return /\b(cross.chain|cross chain|bridge|bridging)\b/i.test(text);
}

function hasTradeKeywords(text: string): boolean {
    if (hasCopyTradeKeywords(text)) return false;
    return /\b(swap|trade|exchange|convert|buy|sell|purchase|ape)\b/i.test(text)
        || /\b(兑换|交易|买|购买|卖|卖出)\b/i.test(text);
}

function hasConfirmationKeywords(text: string): boolean {
    const cleanText = text.trim().toLowerCase();
    if (/^(proceed|confirm|yes|go ahead|execute|do it|approve|submit|ok|okay|sure|确认|确定|执行|好的|继续)$/i.test(cleanText)) {
        return true;
    }
    return /\b(confirm transaction|execute swap|proceed with trade|proceed with swap|continue with trade|confirm trade)\b/i.test(text);
}

function extractOrderedSymbols(text: string): string[] {
    const found: string[] = [];
    for (const match of text.matchAll(/\b[A-Z]{2,10}\b/g)) {
        const symbol = String(match[0] || '').toUpperCase();
        if (!found.includes(symbol)) {
            found.push(symbol);
        }
    }
    return found;
}

function resolveTokenOut(text: string, symbols: string[], userContext?: UserContext, contractAddress?: string | null): string | undefined {
    const lower = text.toLowerCase();
    if (contractAddress) return contractAddress;
    for (const symbol of symbols) {
        if (['BUY', 'SELL', 'SWAP', 'TRADE', 'GET', 'ALL'].includes(symbol)) continue;
        if (new RegExp(`\\b(buy|get|receive)\\s+[\\d.%]*\\s*${symbol.toLowerCase()}\\b`, 'i').test(lower)) {
            return symbol;
        }
    }
    for (const symbol of symbols) {
        if (['BUY', 'SELL', 'SWAP', 'TRADE', 'GET', 'ALL'].includes(symbol)) continue;
        if (!NATIVE_SYMBOLS.has(symbol)) return symbol;
    }
    const pending = userContext?.pendingSwapToken;
    if (pending?.symbol) return pending.symbol;
    return symbols[0];
}

function resolveTokenIn(text: string, symbols: string[], tokenOut: string | undefined, userContext?: UserContext): string | undefined {
    const lower = text.toLowerCase();
    const chainId = Number(userContext?.chainId || 8453);
    if (/\b(sell|dump|swap out of|convert)\b/i.test(lower) || text.includes('卖')) {
        for (const symbol of symbols) {
            if (symbol !== tokenOut && !STABLE_SYMBOLS.has(symbol)) return symbol;
        }
        return tokenOut;
    }
    for (const symbol of symbols) {
        if (symbol !== tokenOut && NATIVE_SYMBOLS.has(symbol)) return symbol;
    }
    return CHAIN_DEFAULT_NATIVE[chainId] || 'ETH';
}

function parseAmount(text: string): string | undefined {
    const match = text.match(/\b(all|\d+(?:\.\d+)?%?)\b/i);
    return match ? match[1] : undefined;
}

function inferAmountSemantic(text: string): 'input' | 'output' {
    if (/\b(buy|get|receive)\b/i.test(text) || text.includes('买')) {
        return 'output';
    }
    return 'input';
}

export async function parseIntent(
    userMessage: string,
    userContext?: UserContext
): Promise<ParsedIntent> {
    const message = String(userMessage || '').trim();
    const contractAddress = detectContractAddress(message);
    const chainId = detectChainId(contractAddress, userContext);
    const symbols = extractOrderedSymbols(message);

    let highLevel: HighLevelIntent = {
        type: 'GENERAL_CHAT',
        confidence: 0.55,
    };
    let action: DetailedIntentType = 'general_query';
    const decision: IntentDecision = {
        primary: 'GENERAL_CHAT',
        confidence: 0.55,
        labels: [{ label: 'GENERAL_CHAT', confidence: 0.55 }],
        routing: {
            stage: 'rule',
            reason: 'non_trade_request',
        },
    };

    if (hasCopyTradeKeywords(message)) {
        highLevel = { type: 'COPY_TRADING', confidence: 0.95 };
        action = 'copy_trade';
        decision.primary = 'COPY_TRADING';
        decision.confidence = 0.95;
        decision.labels = [{ label: 'COPY_TRADING', confidence: 0.95 }];
        decision.routing.reason = 'copy_trade_keyword';
        decision.hardRule = { label: 'COPY_TRADING', reason: 'copy_trade_keyword' };
    } else if (hasConfirmationKeywords(message) || hasTradeKeywords(message) || hasCrossChainKeywords(message)) {
        highLevel = { type: 'TRADING', confidence: hasConfirmationKeywords(message) ? 0.98 : 0.9 };
        action = hasCrossChainKeywords(message) ? 'cross_chain_trade' : 'swap';
        decision.primary = 'TRADING';
        decision.confidence = highLevel.confidence;
        decision.labels = [{ label: 'TRADING', confidence: highLevel.confidence }];
        decision.routing.reason = hasConfirmationKeywords(message)
            ? 'trade_confirmation_keyword'
            : (hasCrossChainKeywords(message) ? 'cross_chain_keyword' : 'trade_keyword');
        decision.hardRule = { label: 'TRADING', reason: decision.routing.reason };
    }

    const tokenOut = action === 'general_query' ? undefined : resolveTokenOut(message, symbols, userContext, contractAddress);
    const tokenIn = action === 'general_query' ? undefined : resolveTokenIn(message, symbols, tokenOut, userContext);
    const amount = action === 'general_query' ? undefined : parseAmount(message);
    const amountSemantic = action === 'general_query' ? undefined : inferAmountSemantic(message);

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

export type IntentType = HighLevelIntentType;
