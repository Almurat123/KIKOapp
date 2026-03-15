import { patchPositionExitIntentMetadata, updatePositionExitIntentState } from './positionExitIntentStore.js';
import type { ExitExecutionState } from './intentTypes.js';

export type ExitIntentHotPathStage =
  | 'queued'
  | 'routing'
  | 'approval_pending'
  | 'approval_ready'
  | 'swap_submitting'
  | 'swap_visible'
  | 'retry_wait'
  | 'confirmed'
  | 'failed';

export async function recordExitIntentProgress(params: {
  intentId?: string | null;
  stage: ExitIntentHotPathStage;
  workerId?: string | null;
  lifecycleState?: ExitExecutionState;
  reasonCode?: string | null;
  executionTxHash?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  const intentId = String(params.intentId || '').trim();
  if (!intentId) return;
  const metadataPatch = {
    hotPathStage: params.stage,
    hotPathStageAt: new Date().toISOString(),
    ...(params.workerId ? { hotPathWorkerId: params.workerId } : {}),
    ...(params.metadata || {}),
  };
  if (params.lifecycleState) {
    await updatePositionExitIntentState({
      id: intentId,
      lifecycleState: params.lifecycleState,
      lastReasonCode: params.reasonCode ?? undefined,
      executionTxHash: params.executionTxHash ?? undefined,
      clearClaim: false,
      metadataPatch,
    });
    return;
  }
  await patchPositionExitIntentMetadata({
    id: intentId,
    lastReasonCode: params.reasonCode ?? undefined,
    executionTxHash: params.executionTxHash ?? undefined,
    metadataPatch,
  });
}
