import type { ChatHistoryMessage, RecentToolTrace, TradeConfirmationState } from './contracts.js';

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
    for (const match of text.match(EVM_ADDR_RE) || []) {
        values.add(match.toLowerCase());
    }
    for (const match of text.match(SOL_ADDR_RE) || []) {
        values.add(match);
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

export function extractRecentToolTrace(messages: any[]): RecentToolTrace | null {
    const recentAssistant = [...(messages || [])].reverse().find((msg) => msg.role === 'assistant' && msg.data?.toolTrace);
    if (!recentAssistant?.data?.toolTrace?.toolCalls) return null;
    return {
        messageId: recentAssistant.id,
        toolCalls: recentAssistant.data.toolTrace.toolCalls,
    };
}

export function isConfirmationMessage(message: string): boolean {
    const normalized = String(message || '').trim().toLowerCase();
    if (!normalized) return false;
    const compact = normalized.replace(/[\s._-]+/g, '');
    const keywords = [
        'confirm', 'confirmed', 'proceed', 'yes', 'y', 'ok', 'okay',
        '继续', '确认', '执行', '下单', '成交', '好的', '可以',
    ];
    return keywords.some((k) => compact === k || compact.includes(k) || normalized === k || normalized.includes(k));
}

export function isSetupProceedMessage(message: string): boolean {
    const text = String(message || '').trim().toLowerCase();
    if (!text) return false;
    const patterns = [
        /\bjust\s+create\b/,
        /\bcreate\s+it\b/,
        /\bgo\s+ahead\b/,
        /\buse\s+default\b/,
        /直接创建/,
        /就创建/,
        /按默认/,
        /不用了.*创建/,
    ];
    return patterns.some((p) => p.test(text)) || isConfirmationMessage(text);
}

export function parseCopyTradeRequestFromText(text: string): {
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
        || /\bcopy\b.*\bwallet\b/i.test(lower)
        || /跟单|复制交易/.test(raw);
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
    if (autoSell) parsed.mirror_sell = ['yes', 'true', 'on'].includes(autoSell[1].toLowerCase());

    const tpMatch = raw.match(/(?:\bTP\b|take\s*profit)\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)\s*%/i);
    if (tpMatch) parsed.take_profit_pct = Number(tpMatch[1]);
    const slMatch = raw.match(/(?:\bSL\b|stop\s*loss)\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)\s*%/i);
    if (slMatch) parsed.stop_loss_pct = Number(slMatch[1]);

    return parsed;
}

export function resolveTradeConfirmationState(messages: any[], latestUserMessage: string): TradeConfirmationState | null {
    const raw = String(latestUserMessage || '');
    const maybeProceed = isConfirmationMessage(raw) || isSetupProceedMessage(raw);
    if (!maybeProceed) return null;

    const toolTrace = extractRecentToolTrace(messages);
    const swapCall = [...(toolTrace?.toolCalls || [])].reverse().find((call) =>
        ['simulate_swap', 'prepare_swap_transaction', 'get_cross_chain_quote', 'prepare_cross_chain_tx'].includes(String(call.tool || '')) &&
        ['success', 'cached'].includes(String(call.status || ''))
    );
    if (swapCall) {
        const args = swapCall.args || {};
        return {
            kind: 'swap_confirmation',
            swap: {
                tokenIn: String(args.token_in || args.fromToken || ''),
                tokenOut: String(args.token_out || args.toToken || ''),
                amountIn: String(args.amount_in || args.fromAmount || ''),
                chainId: Number(args.chain_id || args.fromChain || 0) || undefined,
                toChain: Number(args.toChain || args.to_chain || 0) || undefined,
                isCrossChain: Boolean(args.toChain || args.to_chain || swapCall.tool?.includes('cross_chain')),
            },
        };
    }

    const parsedCopyTrade = [...(messages || [])]
        .sort((a, b) => (a.message_index || a.messageIndex || 0) - (b.message_index || b.messageIndex || 0))
        .reverse()
        .find((msg) => msg.role === 'user' && parseCopyTradeRequestFromText(String(msg.content || '')));
    if (parsedCopyTrade) {
        const args = parseCopyTradeRequestFromText(String(parsedCopyTrade.content || '')) || {};
        return {
            kind: 'copy_trade_confirmation',
            copyTrade: {
                targetWallet: String(args.target_wallet || ''),
                buyAmountUsd: Number(args.buy_amount_usd || 0),
                chainId: Number(args.chain_id || 0) || undefined,
                mirrorSell: typeof args.mirror_sell === 'boolean' ? args.mirror_sell : undefined,
                takeProfitPct: Number.isFinite(Number(args.take_profit_pct)) ? Number(args.take_profit_pct) : undefined,
                stopLossPct: Number.isFinite(Number(args.stop_loss_pct)) ? Number(args.stop_loss_pct) : undefined,
            },
        };
    }

    return null;
}
