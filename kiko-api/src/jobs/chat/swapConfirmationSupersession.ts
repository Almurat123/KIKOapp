import type { ChatContextSnapshot, TradeConfirmationState } from './contracts.js';
import { resolveCanonicalChainRef } from './chainIntent.js';
import { resolveTradeSemantics } from '../../services/ai/tradeSemantics.js';
import { hasTaskRouteFacet } from './taskRoute.js';

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

    const taskRoute = params.snapshot.taskRoute || null;
    const normalizedIntent = params.snapshot.normalizedIntent || null;
    const routeWantsSwap = taskRoute?.owner === 'swap';
    const canonicalWantsSwap = !taskRoute && Boolean(
        normalizedIntent && ['swap', 'cross_chain_swap'].includes(String(normalizedIntent.intent || '')),
    );
    if (!routeWantsSwap && !canonicalWantsSwap) {
        return false;
    }
    if (taskRoute) {
        if (taskRoute.phase === 'confirm') return false;
    } else if (normalizedIntent?.taskMode === 'confirm') {
        return false;
    }

    const requestedChain = resolveCanonicalChainRef({
        taskRoute,
        canonicalIntent: normalizedIntent,
        requestedTokenAddresses: params.snapshot.requestedTokenAddresses,
        requestedTokenSymbols: params.snapshot.requestedTokenSymbols,
        runtimeChainId: params.snapshot.runtime.chainId,
        runtimeChainName: params.snapshot.runtime.chainName,
    });
    const semantics = resolveTradeSemantics({
        text: params.text,
        chainId: taskRoute?.requestedChain?.chainId || normalizedIntent?.requestedChain?.chainId || requestedChain?.chainId || params.snapshot.runtime.chainId,
        canonicalTokenAddresses: taskRoute?.entities.tokenAddresses?.length
            ? taskRoute.entities.tokenAddresses
            : normalizedIntent?.entities?.tokenAddresses,
        canonicalTokenSymbols: taskRoute?.entities.tokenSymbols?.length
            ? taskRoute.entities.tokenSymbols
            : normalizedIntent?.entities?.tokenSymbols,
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
    const nextChainId = taskRoute?.requestedChain?.chainId
        || normalizedIntent?.requestedChain?.chainId
        || requestedChain?.chainId
        || params.snapshot.runtime.chainId;

    const amountChanged = Boolean(nextAmountIn) && nextAmountIn !== pendingAmountIn;
    const tokenInChanged = Boolean(nextTokenIn) && nextTokenIn !== pendingTokenIn;
    const tokenOutChanged = Boolean(nextTokenOut) && nextTokenOut !== pendingTokenOut;
    const chainChanged = Boolean(nextChainId && pendingChainId) && Number(nextChainId) !== Number(pendingChainId);

    if (amountChanged || tokenInChanged || tokenOutChanged || chainChanged) {
        return true;
    }

    return taskRoute
        ? taskRoute.phase === 'execute' || hasTaskRouteFacet(taskRoute, 'cross_chain')
        : normalizedIntent?.taskMode === 'execute';
}
