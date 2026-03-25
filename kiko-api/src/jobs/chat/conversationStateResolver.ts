import type {
    ChatContextSnapshot,
    ChatHistoryMessage,
    ConversationActionState,
    RecentToolTrace,
    TradeConfirmationState,
} from './contracts.js';
import type { ActionClass } from './controlPolicy.js';
import { isExplicitChainSwitchRequest } from './chainIntent.js';

const EVM_ADDR_RE = /\b0x[a-fA-F0-9]{40}\b/g;
const SOL_ADDR_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;

export function sanitizeHistory(messages: any[]): ChatHistoryMessage[] {
    return (messages || []).map((msg) => ({
        role: msg.role,
        content: msg.content || '',
        reasoningContent: msg.reasoningContent || msg.reasoning_content || '',
        toolCalls: Array.isArray(msg.toolCalls) ? msg.toolCalls : (Array.isArray(msg.tool_calls) ? msg.tool_calls : undefined),
        toolCallId: msg.toolCallId || msg.tool_call_id,
        data: msg.data,
        messageId: msg.messageId || msg.id,
    })).map((msg, idx, arr) => {
        if (msg.role !== 'assistant' || !Array.isArray(msg.toolCalls) || msg.toolCalls.length === 0) {
            return msg;
        }
        const next = arr[idx + 1];
        if (next?.role === 'tool' && next.toolCallId) {
            return msg;
        }
        return { ...msg, toolCalls: undefined };
    });
}

export function extractRequestedTokenAddresses(text: string): string[] {
    const values = new Set<string>();
    for (const match of text.match(EVM_ADDR_RE) || []) values.add(match.toLowerCase());
    for (const match of text.match(SOL_ADDR_RE) || []) values.add(match);
    return Array.from(values);
}

export function extractRequestedTokenAddressesFromHistory(messages: any[], recentUserLimit = 6): string[] {
    const values = new Set<string>();
    for (const message of collectRecentUserMessages(messages, recentUserLimit)) {
        for (const value of extractRequestedTokenAddresses(String(message?.content || ''))) {
            values.add(value);
        }
    }
    return Array.from(values);
}

export function extractRequestedTokenSymbols(text: string): string[] {
    const values = new Set<string>();
    for (const match of text.matchAll(/\b[A-Z]{2,10}\b/g)) {
        values.add(match[0].toUpperCase());
    }
    return Array.from(values);
}

export function extractRequestedTokenSymbolsFromHistory(messages: any[], recentUserLimit = 6): string[] {
    const values = new Set<string>();
    for (const message of collectRecentUserMessages(messages, recentUserLimit)) {
        for (const value of extractRequestedTokenSymbols(String(message?.content || ''))) {
            values.add(value);
        }
    }
    return Array.from(values);
}

export function extractRecentToolTrace(messages: any[]): RecentToolTrace | null {
    const assistantMessages = [...(messages || [])]
        .filter((msg) => msg.role === 'assistant' && Array.isArray(msg.data?.toolTrace?.toolCalls))
        .sort(compareMessagesChronologically);
    if (assistantMessages.length === 0) return null;

    const toolCalls = assistantMessages
        .flatMap((msg) => Array.isArray(msg.data?.toolTrace?.toolCalls) ? msg.data.toolTrace.toolCalls : [])
        .filter((call) => call && typeof call === 'object' && String(call.tool || '').trim())
        .slice(-48);
    if (toolCalls.length === 0) return null;

    const recentAssistant = assistantMessages[assistantMessages.length - 1];
    return {
        messageId: recentAssistant.id,
        toolCalls,
    };
}

export function buildConversationActionState(snapshot: ChatContextSnapshot): ConversationActionState {
    const raw = String(snapshot.lastUserMessage || '').trim();
    const normalizedIntent = snapshot.normalizedIntent || null;
    const wantsConfirmation = normalizedIntent?.taskMode === 'confirm' || normalizedIntent?.taskMode === 'execute';
    const explicitChainSwitch = isExplicitChainSwitchRequest(raw, normalizedIntent);
    const toolTrace = snapshot.recentToolTrace || null;

    if (explicitChainSwitch) {
        return {
            pendingAction: 'none',
            confirmationPayload: null,
            canExecute: false,
            needsClarification: false,
            clarificationQuestion: null,
        };
    }

    const payloadConfirmation = resolveOrderConfirmationFromToolTrace(toolTrace);
    if (payloadConfirmation) {
        return {
            pendingAction: payloadConfirmation.kind === 'copy_trade_confirmation' ? 'copy_trade' : 'order',
            confirmationPayload: payloadConfirmation,
            canExecute: wantsConfirmation,
            needsClarification: false,
            clarificationQuestion: null,
        };
    }

    if (wantsConfirmation) {
        const swapConfirmation = resolveSwapConfirmationFromToolTrace(toolTrace);
        if (swapConfirmation) {
            return {
                pendingAction: 'swap',
                confirmationPayload: swapConfirmation,
                canExecute: true,
                needsClarification: false,
                clarificationQuestion: null,
            };
        }

        return {
            pendingAction: 'none',
            confirmationPayload: null,
            canExecute: false,
            needsClarification: true,
            clarificationQuestion: normalizedIntent?.locale === 'zh'
                ? '我目前没有待确认的执行步骤。请先让我准备交易或订单，再确认。'
                : 'There is no pending action to confirm yet. Let me prepare the trade or order first.',
        };
    }

    return {
        pendingAction: 'none',
        confirmationPayload: null,
        canExecute: false,
        needsClarification: false,
        clarificationQuestion: null,
    };
}

export function applyConversationActionState(snapshot: ChatContextSnapshot): ChatContextSnapshot {
    const conversationActionState = buildConversationActionState(snapshot);
    return {
        ...snapshot,
        conversationActionState,
        confirmationState: conversationActionState.confirmationPayload || null,
    };
}

export function resolveTradeConfirmationState(
    messages: any[],
    latestUserMessage: string,
    normalizedIntent?: ChatContextSnapshot['normalizedIntent'],
): TradeConfirmationState | null {
    const snapshot = applyConversationActionState({
        sessionId: 'adhoc',
        taskId: 'adhoc',
        model: 'adhoc',
        history: sanitizeHistory(messages),
        lastUserMessage: latestUserMessage,
        recentToolTrace: extractRecentToolTrace(messages),
        runtime: {},
        requestedTokenAddresses: extractRequestedTokenAddressesFromHistory(messages),
        requestedTokenSymbols: extractRequestedTokenSymbolsFromHistory(messages),
        normalizedIntent: normalizedIntent || null,
        toolDefinitions: [],
    } as ChatContextSnapshot);
    return snapshot.confirmationState || null;
}

export function isConfirmationMessage(_message: string, snapshot?: ChatContextSnapshot | null): boolean {
    const normalizedIntent = snapshot?.normalizedIntent || null;
    return normalizedIntent?.taskMode === 'confirm' || normalizedIntent?.taskMode === 'execute' || false;
}

function resolveSwapConfirmationFromToolTrace(trace: RecentToolTrace | null): TradeConfirmationState | null {
    const calls = trace?.toolCalls || [];
    for (let idx = calls.length - 1; idx >= 0; idx -= 1) {
        const call = calls[idx];
        if (!['success', 'cached'].includes(String(call?.status || ''))) continue;
        const toolName = String(call?.tool || '');
        if (!['simulate_swap', 'prepare_swap_transaction', 'get_cross_chain_quote', 'prepare_cross_chain_tx'].includes(toolName)) {
            continue;
        }
        const args = (call?.args && typeof call.args === 'object') ? call.args as Record<string, any> : {};
        if (toolName === 'get_cross_chain_quote' || toolName === 'prepare_cross_chain_tx') {
            if (!args.fromToken || !args.toToken || !args.fromAmount) continue;
            return {
                kind: 'swap_confirmation',
                swap: {
                    tokenIn: String(args.fromToken),
                    tokenOut: String(args.toToken),
                    amountIn: String(args.fromAmount),
                    chainId: Number(args.fromChain || 0) || undefined,
                    toChain: Number(args.toChain || 0) || undefined,
                    isCrossChain: true,
                },
            };
        }
        if (!args.token_in || !args.token_out || !args.amount_in) continue;
        return {
            kind: 'swap_confirmation',
            swap: {
                tokenIn: String(args.token_in),
                tokenOut: String(args.token_out),
                amountIn: String(args.amount_in),
                chainId: Number(args.chain_id || 0) || undefined,
                isCrossChain: false,
            },
        };
    }
    return null;
}

function resolveOrderConfirmationFromToolTrace(trace: RecentToolTrace | null): TradeConfirmationState | null {
    const calls = trace?.toolCalls || [];
    for (let idx = calls.length - 1; idx >= 0; idx -= 1) {
        const call = calls[idx];
        const result = (call?.result && typeof call.result === 'object') ? call.result : {};
        const payload = (result?.confirmation_payload && typeof result.confirmation_payload === 'object')
            ? result.confirmation_payload
            : null;
        if (!payload || result?.requires_confirmation !== true) continue;

        const toolName = String(payload.tool_name || call.tool || '').trim();
        const confirmationToken = String(payload.confirmation_token || '').trim();
        const actionClass = String(payload.action_class || '').trim() as ActionClass;
        if (!toolName || !confirmationToken) continue;

        const orderPayload = {
            toolName,
            args: (payload.args && typeof payload.args === 'object') ? payload.args : {},
            confirmationToken,
            actionClass: (actionClass === 'TRADE_MUTATION' ? 'TRADE_MUTATION' : 'ORDER_MUTATION') as ActionClass,
        };

        if (toolName === 'create_copy_trade_config' || toolName === 'create_polymarket_copy_config') {
            return {
                kind: 'copy_trade_confirmation',
                copyTrade: {
                    targetWallet: String(orderPayload.args.target_wallet || orderPayload.args.targetWallet || ''),
                    buyAmountUsd: Number(orderPayload.args.buy_amount_usd || orderPayload.args.bet_size_usd || 0),
                    chainId: Number(orderPayload.args.chain_id || 0) || undefined,
                    mirrorSell: typeof orderPayload.args.mirror_sell === 'boolean' ? orderPayload.args.mirror_sell : undefined,
                    takeProfitPct: Number.isFinite(Number(orderPayload.args.take_profit_pct)) ? Number(orderPayload.args.take_profit_pct) : undefined,
                    stopLossPct: Number.isFinite(Number(orderPayload.args.stop_loss_pct)) ? Number(orderPayload.args.stop_loss_pct) : undefined,
                },
            };
        }

        return {
            kind: 'order_confirmation',
            order: orderPayload,
        };
    }
    return null;
}

function compareMessagesChronologically(a: any, b: any): number {
    const aIndex = Number(a?.message_index || a?.messageIndex || 0);
    const bIndex = Number(b?.message_index || b?.messageIndex || 0);
    if (aIndex !== bIndex) return aIndex - bIndex;
    const aCreated = Date.parse(String(a?.created_at || a?.createdAt || 0)) || 0;
    const bCreated = Date.parse(String(b?.created_at || b?.createdAt || 0)) || 0;
    return aCreated - bCreated;
}

function collectRecentUserMessages(messages: any[], limit: number) {
    return [...(messages || [])]
        .filter((msg) => msg.role === 'user')
        .sort(compareMessagesChronologically)
        .slice(-limit);
}
