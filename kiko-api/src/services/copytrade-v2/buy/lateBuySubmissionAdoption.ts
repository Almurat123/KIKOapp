import type { OrderRuntimeContext } from '../../order-runtime/types.js';
import { hydrateResolvedCopytradeBuyEvidence } from './copytradeBuyEvidence.js';

export function scheduleLateBuySubmissionAdoption(params: {
  chainId: number;
  runtimeContext?: OrderRuntimeContext | null;
  pollMs?: number;
  maxWaitMs?: number;
  onAdopt: (resolved: {
    txHash: string;
    txLifecycleStatus: string;
    runtimeContext: OrderRuntimeContext;
  }) => Promise<void>;
  onExhausted?: (resolution: Awaited<ReturnType<typeof hydrateResolvedCopytradeBuyEvidence>>['resolution']) => Promise<void>;
}): void {
  const runtimeContext = params.runtimeContext;
  if (!runtimeContext) return;

  const pollMs = Math.max(250, params.pollMs ?? 500);
  const maxWaitMs = Math.max(pollMs, params.maxWaitMs ?? 15000);
  const startedAt = Date.now();
  let finished = false;

  const scheduleNext = () => {
    const timer = setTimeout(() => {
      void tick();
    }, pollMs);
    timer.unref?.();
  };

  const tick = async () => {
    if (finished) return;
    const evidence = await hydrateResolvedCopytradeBuyEvidence({
      runtimeContext,
      chainId: params.chainId,
      txHash: runtimeContext.canonicalTxHash,
    });
    const resolution = evidence.resolution;
    const txHash = String(evidence.txHash || '').trim().toLowerCase();
    const hasTxHash = /^0x[a-f0-9]{64}$/.test(txHash);

    if (hasTxHash && resolution.accepted && !resolution.failed) {
      finished = true;
      await params.onAdopt({
        txHash,
        txLifecycleStatus: runtimeContext.lastLifecycle?.status || 'broadcasted_unseen',
        runtimeContext,
      });
      return;
    }

    if (Date.now() - startedAt >= maxWaitMs) {
      finished = true;
      await params.onExhausted?.(resolution);
      return;
    }

    scheduleNext();
  };

  scheduleNext();
}
