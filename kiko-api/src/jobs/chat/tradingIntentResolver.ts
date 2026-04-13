// CONTEXT MEMORY
// Updated: 2026-04-13
// Author: Rowan
// Reason: copy-trade target wallet resolution previously trusted LLM wallet
//         entities before the user's literal address, which allowed malformed
//         wallet strings to flow into tool arguments.
// Goal: resolve copy-trade target wallets from exact user-provided addresses
//       first, and only fall back to normalized entities when they are strict-valid.
// Owns: trading-intent slot resolution for chat execution and confirmation turns.
// Does Not Own: persistence validation, signed config payload generation, or
//               database repair for already-corrupted copy-trade configs.
// Design Language:
// - exact wallet strings from the latest user message outrank LLM entities
// - malformed wallet candidates must never become copy-trade target slots
// - keep swap confirmation supersession separate from copy-trade wallet resolution
// Document Provenance:
// - Source: chat transcript + runtime logs + production database inspection for BSC copy-trade target wallets
// - Kind: runtime observation
// - Retrieved: 2026-04-13
// - Applied To: copy-trade slot resolution preferring literal user wallets over LLM-mutated entities
// - Verification: verified in code review and unit tests
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/copytrade-race-recovery.md
// - /Users/almurat/KiKo/system-journal/owner-map/copytrade-buy-confirmation.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-13-copytrade-wallet-entity-hardening.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
import type { ChatContextSnapshot } from './contracts.js';
import { resolveCanonicalChainRef } from './chainIntent.js';
import type { CanonicalIntent } from './canonicalIntent.js';
import { resolveTradeSemantics } from '../../services/ai/tradeSemantics.js';
import { shouldSupersedePendingSwapConfirmation } from './swapConfirmationSupersession.js';
import { isStrictWalletAddress } from '../../utils/validation.js';

const EVM_ADDRESS_RE = /\b0x[a-fA-F0-9]{40}\b/g;
const SOLANA_ADDRESS_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;

export interface TradingIntent {
    kind: 'trading' | 'trade_confirmation';
    type: 'swap' | 'copy_trade' | 'cross_chain_trade';
    slots: Record<string, any>;
}

export function parseTradingIntent(text: string, snapshot: ChatContextSnapshot, canonicalIntent?: CanonicalIntent | null): TradingIntent | null {
    const raw = String(text || '').trim();
    const confirmation = snapshot.confirmationState || {};
    const normalizedIntent = canonicalIntent || snapshot.normalizedIntent || null;
    const allowsTradeConfirmation = normalizedIntent
        ? normalizedIntent.taskMode === 'confirm'
            || normalizedIntent.taskMode === 'execute'
            || ['swap', 'cross_chain_swap', 'copy_trade'].includes(String(normalizedIntent.intent || ''))
        : true;
    const supersededSwap = confirmation.kind === 'swap_confirmation'
        && shouldSupersedePendingSwapConfirmation({
            text: raw,
            snapshot,
            pendingSwap: confirmation.swap,
        })
        ? confirmation.swap || null
        : null;
    const requestedChain = resolveCanonicalChainRef({
        canonicalIntent: normalizedIntent,
        requestedTokenAddresses: snapshot.requestedTokenAddresses,
        requestedTokenSymbols: snapshot.requestedTokenSymbols,
        runtimeChainId: snapshot.runtime.chainId,
        runtimeChainName: snapshot.runtime.chainName,
    });

    if (
        confirmation.kind === 'swap_confirmation'
        && allowsTradeConfirmation
        && !supersededSwap
    ) {
        return {
            kind: 'trade_confirmation',
            type: 'swap',
            slots: confirmation.swap || {},
        };
    }
    if (confirmation.kind === 'copy_trade_confirmation' && allowsTradeConfirmation) {
        return {
            kind: 'trade_confirmation',
            type: 'copy_trade',
            slots: confirmation.copyTrade || {},
        };
    }

    if (normalizedIntent) {
        const canonicalChain = normalizedIntent.requestedChain;
        if (normalizedIntent.intent === 'copy_trade') {
            const targetWallet = resolveCopyTradeTargetWallet(raw, snapshot, normalizedIntent);
            return {
                kind: normalizedIntent.taskMode === 'confirm' ? 'trade_confirmation' : 'trading',
                type: 'copy_trade',
                slots: {
                    target_wallet: targetWallet,
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
            const inheritedTokenIn = semantics.tokenIn || supersededSwap?.tokenIn;
            const inheritedTokenOut = semantics.tokenOut || supersededSwap?.tokenOut;
            return {
                kind: normalizedIntent.taskMode === 'confirm' ? 'trade_confirmation' : 'trading',
                type: 'swap',
                slots: {
                    amount: semantics.amount.value,
                    amount_kind: semantics.amount.kind,
                    amount_semantic: semantics.amount.semantic,
                    amount_currency: semantics.amount.currency,
                    token_in: inheritedTokenIn || undefined,
                    token_out: inheritedTokenOut || undefined,
                    chain_id: canonicalChain?.chainId || requestedChain?.chainId || supersededSwap?.chainId,
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

function resolveCopyTradeTargetWallet(
    text: string,
    snapshot: ChatContextSnapshot,
    normalizedIntent: CanonicalIntent,
): string | undefined {
    const literalWallet = extractStrictWallets(text)[0];
    if (literalWallet) return literalWallet;

    const normalizedWallet = (normalizedIntent.entities.walletAddresses || []).find((value) => isStrictWalletAddress(value));
    if (normalizedWallet) return normalizedWallet;

    return (snapshot.requestedTokenAddresses || []).find((value) => isStrictWalletAddress(value));
}

function extractStrictWallets(text: string): string[] {
    const values = new Set<string>();
    for (const match of String(text || '').match(EVM_ADDRESS_RE) || []) {
        if (isStrictWalletAddress(match)) values.add(match.toLowerCase());
    }
    for (const match of String(text || '').match(SOLANA_ADDRESS_RE) || []) {
        if (isStrictWalletAddress(match)) values.add(match);
    }
    return Array.from(values);
}
