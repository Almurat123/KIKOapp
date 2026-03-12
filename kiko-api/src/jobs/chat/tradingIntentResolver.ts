import type { ChatContextSnapshot } from './contracts.js';

const STABLE_SYMBOLS = new Set(['USDC', 'USDT', 'DAI', 'FDUSD', 'BUSD', 'USD1']);
const NATIVE_SYMBOLS = new Set(['ETH', 'WETH', 'BNB', 'WBNB', 'SOL', 'WSOL', 'POL', 'MATIC', 'WMATIC']);

export interface TradingIntent {
    kind: 'trading' | 'trade_confirmation';
    type: 'swap' | 'copy_trade' | 'cross_chain_trade';
    slots: Record<string, any>;
}

export function parseTradingIntent(text: string, snapshot: ChatContextSnapshot): TradingIntent | null {
    const raw = String(text || '').trim();
    const lower = raw.toLowerCase();
    const confirmation = snapshot.confirmationState || {};

    if (confirmation.kind === 'swap_confirmation') {
        return {
            kind: 'trade_confirmation',
            type: 'swap',
            slots: confirmation.swap || {},
        };
    }
    if (confirmation.kind === 'copy_trade_confirmation') {
        return {
            kind: 'trade_confirmation',
            type: 'copy_trade',
            slots: confirmation.copyTrade || {},
        };
    }

    if (/\b(copy ?trade|follow this trader|跟单|复制交易)\b/i.test(lower)) {
        const wallet = snapshot.requestedTokenAddresses[0];
        return {
            kind: 'trading',
            type: 'copy_trade',
            slots: { target_wallet: wallet },
        };
    }

    if (/\b(bridge|cross.chain|cross chain)\b/i.test(lower)) {
        return {
            kind: 'trading',
            type: 'cross_chain_trade',
            slots: {},
        };
    }

    if (/\b(swap|buy|sell|trade|exchange|convert|买|卖|兑换)\b/i.test(lower)) {
        const amountMatch = raw.match(/\b(all|\d+(?:\.\d+)?%?)\b/i);
        const symbols = extractSymbols(raw);
        const contractAddresses = snapshot.requestedTokenAddresses || [];
        const tokenOut = contractAddresses[0] || guessTokenOut(raw, symbols, snapshot) || undefined;
        const tokenIn = guessTokenIn(raw, symbols, snapshot, tokenOut) || undefined;
        return {
            kind: 'trading',
            type: 'swap',
            slots: {
                amount: amountMatch ? amountMatch[1] : undefined,
                token_in: tokenIn,
                token_out: tokenOut,
                requested_addresses: snapshot.requestedTokenAddresses || [],
                requested_symbols: snapshot.requestedTokenSymbols || [],
            },
        };
    }

    return null;
}

function extractSymbols(raw: string): string[] {
    const seen: string[] = [];
    for (const match of raw.matchAll(/\b[A-Z]{2,10}\b/g)) {
        const symbol = String(match[0] || '').toUpperCase();
        if (!seen.includes(symbol)) {
            seen.push(symbol);
        }
    }
    return seen;
}

function guessTokenOut(raw: string, symbols: string[], snapshot: ChatContextSnapshot): string | null {
    const lower = raw.toLowerCase();
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
    for (const symbol of snapshot.requestedTokenSymbols || []) {
        if (!NATIVE_SYMBOLS.has(symbol)) return symbol;
    }
    return symbols[0] || null;
}

function guessTokenIn(raw: string, symbols: string[], snapshot: ChatContextSnapshot, tokenOut?: string | null): string | null {
    const lower = raw.toLowerCase();
    const chainId = Number(snapshot.runtime.chainId || 8453);
    const nativeByChain: Record<number, string> = {
        1: 'ETH',
        10: 'ETH',
        56: 'BNB',
        137: 'POL',
        42161: 'ETH',
        8453: 'ETH',
        900: 'SOL',
    };
    if (/\b(sell|dump|swap out of|convert)\b/i.test(lower) || raw.includes('卖')) {
        for (const symbol of symbols) {
            if (symbol !== tokenOut && !STABLE_SYMBOLS.has(symbol)) return symbol;
        }
        return tokenOut || null;
    }
    for (const symbol of symbols) {
        if (symbol !== tokenOut && NATIVE_SYMBOLS.has(symbol)) return symbol;
    }
    return nativeByChain[chainId] || 'ETH';
}
