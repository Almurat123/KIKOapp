import type { UserContext } from './types.js';
import { v4 as uuidv4 } from 'uuid';
import { defaultNativeSymbolForChain, resolveTradeSemantics } from './tradeSemantics.js';

export type HighLevelIntentType =
    | 'TRADING'
    | 'COPY_TRADING'
    | 'PREDICTION_MARKETS'
    | 'RISK_SCAN';

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

export async function parseIntent(
    userMessage: string,
    userContext?: UserContext
): Promise<ParsedIntent> {
    const message = String(userMessage || '').trim();
    const contractAddress = detectContractAddress(message);
    const chainId = detectChainId(contractAddress, userContext);

    let highLevel: HighLevelIntent = {
        type: 'TRADING',
        confidence: 0.55,
    };
    let action: DetailedIntentType = 'general_query';
    const decision: IntentDecision = {
        primary: 'TRADING',
        confidence: 0.55,
        labels: [{ label: 'TRADING', confidence: 0.55 }],
        routing: {
            stage: 'rule',
            reason: 'trade_only_fallback',
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

export type IntentType = HighLevelIntentType;
