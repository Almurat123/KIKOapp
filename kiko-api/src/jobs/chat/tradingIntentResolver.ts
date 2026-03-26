import type { ChatContextSnapshot } from './contracts.js';
import { resolveCanonicalChainRef } from './chainIntent.js';
import type { CanonicalIntent } from './canonicalIntent.js';
import { resolveTradeSemantics } from '../../services/ai/tradeSemantics.js';

export interface TradingIntent {
    kind: 'trading' | 'trade_confirmation';
    type: 'swap' | 'copy_trade' | 'cross_chain_trade';
    slots: Record<string, any>;
}

export function parseTradingIntent(text: string, snapshot: ChatContextSnapshot, canonicalIntent?: CanonicalIntent | null): TradingIntent | null {
    const raw = String(text || '').trim();
    const confirmation = snapshot.confirmationState || {};
    const normalizedIntent = canonicalIntent || snapshot.normalizedIntent || null;
    const requestedChain = resolveCanonicalChainRef({
        canonicalIntent: normalizedIntent,
        requestedTokenAddresses: snapshot.requestedTokenAddresses,
        requestedTokenSymbols: snapshot.requestedTokenSymbols,
        runtimeChainId: snapshot.runtime.chainId,
        runtimeChainName: snapshot.runtime.chainName,
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
            const semantics = resolveTradeSemantics({
                text: raw,
                chainId: canonicalChain?.chainId || requestedChain?.chainId || snapshot.runtime.chainId,
                canonicalTokenAddresses: normalizedIntent.entities.tokenAddresses,
                canonicalTokenSymbols: normalizedIntent.entities.tokenSymbols,
                requestedTokenAddresses: snapshot.requestedTokenAddresses || [],
                requestedTokenSymbols: snapshot.requestedTokenSymbols || [],
            });
            return {
                kind: normalizedIntent.taskMode === 'confirm' ? 'trade_confirmation' : 'trading',
                type: 'swap',
                slots: {
                    amount: semantics.amount.value,
                    amount_kind: semantics.amount.kind,
                    amount_semantic: semantics.amount.semantic,
                    amount_currency: semantics.amount.currency,
                    token_in: semantics.tokenIn || undefined,
                    token_out: semantics.tokenOut || undefined,
                    chain_id: canonicalChain?.chainId || requestedChain?.chainId,
                    chain_name: canonicalChain?.chainName || requestedChain?.chainName,
                    requested_addresses: snapshot.requestedTokenAddresses || [],
                    requested_symbols: snapshot.requestedTokenSymbols || [],
                    needs_amount_resolution: semantics.needsAmountResolution,
                },
            };
        }
    }

    return null;
}
