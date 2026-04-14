// CONTEXT MEMORY
// Updated: 2026-04-14
// Author: Rowan
// Reason: Four.Meme sell can return a confirmed top-level `swapResult.txHash`
//         while the nested `swapResult.runtimeContext` snapshot has no canonical
//         tx hash, leaving mirror-sell runtime logs and persistence without the
//         actual exit transaction.
// Goal: preserve all copytrade exit execution evidence by merging both nested
//       runtime context state and top-level swap result tx hash into the exit
//       runtime owner before finality and persistence consume it.
// Owns: copytrade exit runtime creation and swap-result evidence merge.
// Does Not Own: launchpad transaction construction, route selection, or final
//               persisted position accounting.
// Design Language:
// - runtime snapshots must carry the actual exit tx hash even when execution
//   providers return it outside nested runtime context
// - top-level swap result tx hash is canonical exit evidence for this attempt
// - approval or provider-internal hashes may remain related hashes, but must not
//   erase the executed sell tx
// Document Provenance:
// - Source: /Users/almurat/Downloads/logs.1776168258795.json
// - Kind: runtime observation
// - Retrieved: 2026-04-14
// - Applied To: Four.Meme mirror-sell success tx hash handoff into runtime snapshot
// - Verification: verified in logs and targeted tests
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-14-copytrade-target-signal-cooldown-and-exit-finality.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

import {
  attachOrderTxHash,
  createOrderRuntimeContext,
  setOrderMetadata,
  snapshotOrderRuntime
} from '../../order-runtime/context.js';
import type { OrderRuntimeContext } from '../../order-runtime/types.js';
import type { MainSwapResult } from '../../MainSwapService.js';
import type { PositionExitReason } from './types.js';

export function createExitOrderRuntimeContext(seed: {
  userId: string;
  walletAddress: string;
  chainId: number;
  tokenAddress: string;
  exitReason: PositionExitReason;
  targetWallet?: string;
}): OrderRuntimeContext {
  return createOrderRuntimeContext({
    userId: seed.userId,
    walletAddress: seed.walletAddress,
    chainId: seed.chainId,
    side: 'sell',
    mode: 'copytrade',
    tokenIn: seed.tokenAddress,
    tokenOut: 'ETH',
    metadata: {
      exitReason: seed.exitReason,
      targetWallet: seed.targetWallet || null,
      flow: 'copytrade_exit'
    }
  });
}

export function mergeSwapResultIntoExitRuntime(
  target: OrderRuntimeContext,
  swapResult?: MainSwapResult | null
): OrderRuntimeContext {
  const source = swapResult?.runtimeContext;
  const topLevelTxHash = swapResult?.txHash;

  if (source) {
    const snapshot = snapshotOrderRuntime(source);
    target.state = snapshot.state;
    target.reasonCode = snapshot.reasonCode;
    target.route = { ...snapshot.route };
    target.lastLifecycle = snapshot.lastLifecycle ? { ...snapshot.lastLifecycle } : target.lastLifecycle;
    target.fallbackUsed = target.fallbackUsed || snapshot.fallbackUsed;
    target.metadata = { ...target.metadata, ...snapshot.metadata };

    if (!target.timing.routeStartedAt && source.timing.routeStartedAt) target.timing.routeStartedAt = source.timing.routeStartedAt;
    if (!target.timing.routeSelectedAt && source.timing.routeSelectedAt) target.timing.routeSelectedAt = source.timing.routeSelectedAt;
    if (!target.timing.txPreparedAt && source.timing.txPreparedAt) target.timing.txPreparedAt = source.timing.txPreparedAt;
    if (!target.timing.sendStartedAt && source.timing.sendStartedAt) target.timing.sendStartedAt = source.timing.sendStartedAt;
    if (!target.timing.hashAcceptedAt && source.timing.hashAcceptedAt) target.timing.hashAcceptedAt = source.timing.hashAcceptedAt;
    if (!target.timing.visibleAt && source.timing.visibleAt) target.timing.visibleAt = source.timing.visibleAt;
    if (!target.timing.includedAt && source.timing.includedAt) target.timing.includedAt = source.timing.includedAt;
    if (!target.timing.finishedAt && source.timing.finishedAt) target.timing.finishedAt = source.timing.finishedAt;

    for (const txHash of snapshot.relatedTxHashes) {
      attachOrderTxHash(target, txHash, { canonical: txHash === snapshot.canonicalTxHash });
    }

    if (snapshot.attempts.length > 0) {
      target.attempts = snapshot.attempts.map((attempt, index) => ({
        ...attempt,
        id: `${target.orderId}:attempt:${index + 1}`
      }));
    }
  }

  if (topLevelTxHash) {
    attachOrderTxHash(target, topLevelTxHash, { canonical: true });
  }
  if (swapResult?.txLifecycle) {
    target.lastLifecycle = { ...swapResult.txLifecycle };
  }
  setOrderMetadata(target, {
    directProvider: target.route.provider || swapResult?.metadata?.provider || null,
    fallbackUsed: target.fallbackUsed,
    lastTxLifecycleStatus: target.lastLifecycle?.status || swapResult?.metadata?.txLifecycleStatus || null
  });

  return target;
}
