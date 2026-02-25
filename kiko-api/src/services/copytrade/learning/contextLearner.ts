import prisma from '../../../db/prisma.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import { isContextLearningShadowOnly } from '../context/featureFlags.js';

type FailureBucket =
  | 'unknown_selector'
  | 'hook_mismatch'
  | 'pair_mismatch'
  | 'allowance_or_balance'
  | 'slippage_or_deadline'
  | 'rpc_or_network'
  | 'other';

export function bucketizeFailure(status: string, simulationJson?: string | null): FailureBucket {
  const raw = `${status || ''} ${simulationJson || ''}`.toLowerCase();
  if (raw.includes('unknown_selector') || raw.includes('selector')) return 'unknown_selector';
  if (raw.includes('hook')) return 'hook_mismatch';
  if (raw.includes('pair_mismatch')) return 'pair_mismatch';
  if (raw.includes('allowance') || raw.includes('insufficient')) return 'allowance_or_balance';
  if (raw.includes('slippage') || raw.includes('deadline')) return 'slippage_or_deadline';
  if (raw.includes('rpc') || raw.includes('timeout') || raw.includes('network')) return 'rpc_or_network';
  return 'other';
}

export async function learnTemplateCandidateDrafts(options?: {
  lookbackHours?: number;
  minSampleCount?: number;
}): Promise<{
  generatedDrafts: number;
  failureBuckets: Record<FailureBucket, number>;
}> {
  const lookbackHours = Math.max(1, Number(options?.lookbackHours || 24));
  const minSampleCount = Math.max(5, Number(options?.minSampleCount || 20));
  const since = new Date(Date.now() - lookbackHours * 3600 * 1000);
  const failureBuckets: Record<FailureBucket, number> = {
    unknown_selector: 0,
    hook_mismatch: 0,
    pair_mismatch: 0,
    allowance_or_balance: 0,
    slippage_or_deadline: 0,
    rpc_or_network: 0,
    other: 0
  };

  try {
    const db = prisma as any;
    const [planRuns, samples, contexts] = await Promise.all([
      db.executionPlanRun.findMany({
        where: { createdAt: { gte: since } },
        select: { resultStatus: true, simulationJson: true }
      }),
      db.executionSample.findMany({
        where: {
          createdAt: { gte: since },
          status: 'success',
          selector: { not: null }
        },
        select: {
          chainId: true,
          router: true,
          selector: true,
          commandMetaJson: true
        }
      }),
      db.swapExecutionContext.findMany({
        where: {
          createdAt: { gte: since },
          sourceRouter: { not: null },
          sourceSelector: { not: null }
        },
        select: {
          chainId: true,
          sourceRouter: true,
          sourceSelector: true
        }
      })
    ]);

    for (const row of planRuns) {
      const bucket = bucketizeFailure(String(row.resultStatus || ''), row.simulationJson);
      failureBuckets[bucket] += 1;
    }

    const grouped = new Map<string, { chainId: number; router: string; selector: string; count: number }>();
    for (const sample of samples) {
      const chainId = Number(sample.chainId);
      const router = String(sample.router || '').toLowerCase();
      const selector = String(sample.selector || '').toLowerCase();
      if (!/^0x[0-9a-f]{40}$/.test(router) || !/^0x[0-9a-f]{8}$/.test(selector)) continue;
      const key = `${chainId}:${router}:${selector}`;
      const prev = grouped.get(key);
      if (prev) {
        prev.count += 1;
      } else {
        grouped.set(key, { chainId, router, selector, count: 1 });
      }
    }
    for (const ctx of contexts) {
      const chainId = Number(ctx.chainId);
      const router = String(ctx.sourceRouter || '').toLowerCase();
      const selector = String(ctx.sourceSelector || '').toLowerCase();
      if (!/^0x[0-9a-f]{40}$/.test(router) || !/^0x[0-9a-f]{8}$/.test(selector)) continue;
      const key = `${chainId}:${router}:${selector}`;
      const prev = grouped.get(key);
      if (prev) {
        prev.count += 1;
      } else {
        grouped.set(key, { chainId, router, selector, count: 1 });
      }
    }

    let generatedDrafts = 0;
    for (const item of grouped.values()) {
      if (item.count < minSampleCount) continue;
      const draftPayload = JSON.stringify({
        kind: 'selector_replay_draft',
        router: item.router,
        selector: item.selector,
        sampleCount: item.count,
        generatedAt: new Date().toISOString()
      });
      await db.templateCandidateDraft.upsert({
        where: {
          chainId_router_selector: {
            chainId: item.chainId,
            router: item.router,
            selector: item.selector
          }
        },
        create: {
          chainId: item.chainId,
          router: item.router,
          selector: item.selector,
          draftPayloadJson: draftPayload,
          shadowPassRate: 0,
          sampleCount: item.count,
          status: 'candidate'
        },
        update: {
          draftPayloadJson: draftPayload,
          sampleCount: item.count,
          updatedAt: new Date()
        }
      });
      generatedDrafts += 1;
    }

    if (!isContextLearningShadowOnly()) {
      logger.info(LogCode.SYS_INFO, '[CTX-LEARN] Auto-promotion is enabled (non-shadow mode)', {
        drafts: generatedDrafts
      });
    }

    return { generatedDrafts, failureBuckets };
  } catch (error: any) {
    logger.warn(LogCode.SYS_ERROR, '[CTX-LEARN] Failed to learn template candidate drafts', {
      error: error?.message || String(error)
    });
    return { generatedDrafts: 0, failureBuckets };
  }
}
