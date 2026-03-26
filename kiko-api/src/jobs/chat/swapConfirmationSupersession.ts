import type { ChatContextSnapshot, TradeConfirmationState } from './contracts.js';
import { resolveCanonicalChainRef } from './chainIntent.js';
import { resolveTradeSemantics } from '../../services/ai/tradeSemantics.js';

function normalizeTradeValue(value: string | number | null | undefined): string {
    return String(value || '').trim().toLowerCase();
}

export function shouldSupersedePendingSwapConfirmation(params: {
    text: string;
    snapshot: ChatContextSnapshot;
    pendingSwap?: NonNullable<TradeConfirmationState['swap']> | null;
}): boolean {
    const pendingSwap = params.pendingSwap || null;
    if (!pendingSwap) return false;

    const normalizedIntent = params.snapshot.normalizedIntent || null;
    if (!normalizedIntent || !['swap', 'cross_chain_swap'].includes(String(normalizedIntent.intent || ''))) {
        return false;
    }
    if (normalizedIntent.taskMode === 'confirm') return false;

    const requestedChain = resolveCanonicalChainRef({
        canonicalIntent: normalizedIntent,
        requestedTokenAddresses: params.snapshot.requestedTokenAddresses,
        requestedTokenSymbols: params.snapshot.requestedTokenSymbols,
        runtimeChainId: params.snapshot.runtime.chainId,
        runtimeChainName: params.snapshot.runtime.chainName,
    });
    const semantics = resolveTradeSemantics({
        text: params.text,
        chainId: normalizedIntent.requestedChain?.chainId || requestedChain?.chainId || params.snapshot.runtime.chainId,
        canonicalTokenAddresses: normalizedIntent.entities?.tokenAddresses,
        canonicalTokenSymbols: normalizedIntent.entities?.tokenSymbols,
        requestedTokenAddresses: params.snapshot.requestedTokenAddresses || [],
        requestedTokenSymbols: params.snapshot.requestedTokenSymbols || [],
    });

    const hasFreshTradePayload = semantics.amount.kind !== 'unspecified'
        || Boolean(semantics.tokenIn || semantics.tokenOut)
        || Boolean(semantics.explicitTradeVerb && (semantics.targetAsset || semantics.sourceAsset || semantics.destinationAsset));
    if (!hasFreshTradePayload) return false;

    const pendingTokenIn = normalizeTradeValue(pendingSwap.tokenIn);
    const pendingTokenOut = normalizeTradeValue(pendingSwap.tokenOut);
    const pendingAmountIn = normalizeTradeValue(pendingSwap.amountIn);
    const pendingChainId = Number(pendingSwap.chainId || 0) || undefined;

    const nextTokenIn = normalizeTradeValue(semantics.tokenIn);
    const nextTokenOut = normalizeTradeValue(semantics.tokenOut);
    const nextAmountIn = normalizeTradeValue(semantics.amount.value);
    const nextChainId = normalizedIntent.requestedChain?.chainId || requestedChain?.chainId || params.snapshot.runtime.chainId;

    const amountChanged = Boolean(nextAmountIn) && nextAmountIn !== pendingAmountIn;
    const tokenInChanged = Boolean(nextTokenIn) && nextTokenIn !== pendingTokenIn;
    const tokenOutChanged = Boolean(nextTokenOut) && nextTokenOut !== pendingTokenOut;
    const chainChanged = Boolean(nextChainId && pendingChainId) && Number(nextChainId) !== Number(pendingChainId);

    if (amountChanged || tokenInChanged || tokenOutChanged || chainChanged) {
        return true;
    }

    return normalizedIntent.taskMode === 'execute';
}
