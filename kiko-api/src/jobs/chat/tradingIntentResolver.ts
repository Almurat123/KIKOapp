import type { ChatContextSnapshot } from './contracts.js';
import { resolveRequestedChainHint } from './chainIntent.js';
import type { CanonicalIntent } from './canonicalIntent.js';

const STABLE_SYMBOLS = new Set(['USDC', 'USDT', 'DAI', 'FDUSD', 'BUSD', 'USD1']);
const NATIVE_SYMBOLS = new Set(['ETH', 'WETH', 'BNB', 'WBNB', 'SOL', 'WSOL', 'POL', 'MATIC', 'WMATIC']);

export interface TradingIntent {
    kind: 'trading' | 'trade_confirmation';
    type: 'swap' | 'copy_trade' | 'cross_chain_trade';
    slots: Record<string, any>;
}

export function parseTradingIntent(text: string, snapshot: ChatContextSnapshot, canonicalIntent?: CanonicalIntent | null): TradingIntent | null {
    const raw = String(text || '').trim();
    const lower = raw.toLowerCase();
    const confirmation = snapshot.confirmationState || {};
    const normalizedIntent = canonicalIntent || snapshot.normalizedIntent || null;
    const requestedChain = resolveRequestedChainHint({
        text: raw,
        requestedTokenAddresses: snapshot.requestedTokenAddresses,
        requestedTokenSymbols: snapshot.requestedTokenSymbols,
    });

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

    if (normalizedIntent) {
        const canonicalChain = normalizedIntent.requestedChain;
        if (normalizedIntent.intent === 'copy_trade') {
            return {
                kind: normalizedIntent.taskMode === 'confirm' ? 'trade_confirmation' : 'trading',
                type: 'copy_trade',
                slots: {
                    target_wallet: normalizedIntent.entities.walletAddresses[0] || snapshot.requestedTokenAddresses[0],
                    chain_id: canonicalChain?.chainId,
                    chain_name: canonicalChain?.chainName,
                },
            };
        }
        if (normalizedIntent.intent === 'cross_chain_swap') {
            return {
                kind: normalizedIntent.taskMode === 'confirm' ? 'trade_confirmation' : 'trading',
                type: 'cross_chain_trade',
                slots: {
                    chain_id: canonicalChain?.chainId,
                    chain_name: canonicalChain?.chainName,
                    requested_addresses: snapshot.requestedTokenAddresses || [],
                    requested_symbols: snapshot.requestedTokenSymbols || [],
                },
            };
        }
        if (normalizedIntent.intent === 'swap') {
            const tokenOut = normalizedIntent.entities.tokenAddresses[0]
                || normalizedIntent.entities.tokenSymbols[0]
                || snapshot.requestedTokenAddresses[0]
                || guessTokenOut(raw, extractSymbols(raw), snapshot)
                || undefined;
            const tokenIn = guessTokenIn(
                raw,
                [...normalizedIntent.entities.tokenSymbols, ...extractSymbols(raw)],
                snapshot,
                tokenOut,
                canonicalChain?.chainId || requestedChain?.chainId,
            ) || undefined;
            return {
                kind: normalizedIntent.taskMode === 'confirm' ? 'trade_confirmation' : 'trading',
                type: 'swap',
                slots: {
                    amount: parseAmount(raw),
                    token_in: tokenIn,
                    token_out: tokenOut,
                    chain_id: canonicalChain?.chainId || requestedChain?.chainId,
                    chain_name: canonicalChain?.chainName || requestedChain?.chainName,
                    requested_addresses: snapshot.requestedTokenAddresses || [],
                    requested_symbols: snapshot.requestedTokenSymbols || [],
                },
            };
        }
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
        const tokenIn = guessTokenIn(raw, symbols, snapshot, tokenOut, requestedChain?.chainId) || undefined;
        return {
            kind: 'trading',
            type: 'swap',
            slots: {
                amount: amountMatch ? amountMatch[1] : undefined,
                token_in: tokenIn,
                token_out: tokenOut,
                chain_id: requestedChain?.chainId,
                chain_name: requestedChain?.chainName,
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

function parseAmount(raw: string): string | undefined {
    const match = raw.match(/\b(all|\d+(?:\.\d+)?%?)\b/i);
    return match ? match[1] : undefined;
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

function guessTokenIn(
    raw: string,
    symbols: string[],
    snapshot: ChatContextSnapshot,
    tokenOut?: string | null,
    requestedChainId?: number,
): string | null {
    const lower = raw.toLowerCase();
    const chainId = Number(requestedChainId || snapshot.runtime.chainId || 8453);
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
