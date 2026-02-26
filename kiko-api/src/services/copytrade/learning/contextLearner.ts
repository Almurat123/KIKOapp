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
  if (
    raw.includes('allowance')
    || raw.includes('insufficient')
    || raw.includes('transfer_from_failed')
    || raw.includes('stf')
    || raw.includes('spender_unresolved')
    || raw.includes('insufficient_balance')
  ) return 'allowance_or_balance';
  if (raw.includes('slippage') || raw.includes('deadline')) return 'slippage_or_deadline';
  if (raw.includes('rpc') || raw.includes('timeout') || raw.includes('network')) return 'rpc_or_network';
  return 'other';
}

function normalizeRouter(input: unknown): string {
  const value = String(input || '').toLowerCase();
  return /^0x[0-9a-f]{40}$/.test(value) ? value : '';
}

function normalizeSelector(input: unknown): string {
  const value = String(input || '').toLowerCase();
  return /^0x[0-9a-f]{8}$/.test(value) ? value : '';
}

function parseSelectorFromPlanJson(planJson?: string | null): string {
  try {
    if (!planJson) return '';
    const parsed = JSON.parse(planJson);
    const fromCalldata = String(parsed?.execData?.sourceCalldata || '').slice(0, 10).toLowerCase();
    if (/^0x[0-9a-f]{8}$/.test(fromCalldata)) return fromCalldata;
    const fromMeta = String(parsed?.trace?.sourceSelector || '').toLowerCase();
    if (/^0x[0-9a-f]{8}$/.test(fromMeta)) return fromMeta;
    return '';
  } catch {
    return '';
  }
}

function parsePlanReplayIdentity(planJson?: string | null): { router: string; selector: string } | null {
  try {
    if (!planJson) return null;
    const parsed = JSON.parse(planJson);
    const commandType = String(parsed?.templateRef?.commandType || '').toLowerCase();
    if (commandType !== 'source_raw_calldata_replay' && commandType !== 'source_calldata_replay') return null;
    const router = normalizeRouter(parsed?.templateRef?.router);
    const selector = normalizeSelector(parseSelectorFromPlanJson(planJson));
    if (!router || !selector) return null;
    return { router, selector };
  } catch {
    return null;
  }
}

function parseSimulationSuccess(simulationJson?: string | null): boolean | null {
  try {
    if (!simulationJson) return null;
    const parsed = JSON.parse(simulationJson);
    if (typeof parsed?.success === 'boolean') return parsed.success;
    return null;
  } catch {
    return null;
  }
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
  const promoteShadowPassRate = Math.max(0, Math.min(1, Number(process.env.CTX_LEARNING_PROMOTE_PASS_RATE || '0.65') || 0.65));
  const rejectShadowPassRate = Math.max(0, Math.min(1, Number(process.env.CTX_LEARNING_REJECT_PASS_RATE || '0.25') || 0.25));
  const minShadowSamples = Math.max(5, Number(process.env.CTX_LEARNING_MIN_SHADOW_SAMPLES || '20') || 20);
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
        select: { resultStatus: true, simulationJson: true, planJson: true }
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
          selector: true
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
    const shadowStats = new Map<string, { pass: number; total: number }>();

    for (const row of planRuns) {
      const replayIdentity = parsePlanReplayIdentity(row.planJson);
      if (!replayIdentity) continue;
      const simOk = parseSimulationSuccess(row.simulationJson);
      if (simOk === null) continue;
      const key = `${replayIdentity.router}:${replayIdentity.selector}`;
      const prev = shadowStats.get(key) || { pass: 0, total: 0 };
      prev.total += 1;
      if (simOk) prev.pass += 1;
      shadowStats.set(key, prev);
    }

    for (const sample of samples) {
      const chainId = Number(sample.chainId);
      const router = normalizeRouter(sample.router);
      const selector = normalizeSelector(sample.selector);
      if (!router || !selector) continue;
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
      const router = normalizeRouter(ctx.sourceRouter);
      const selector = normalizeSelector(ctx.sourceSelector);
      if (!router || !selector) continue;
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
      const shadowKey = `${item.router}:${item.selector}`;
      const shadow = shadowStats.get(shadowKey) || { pass: 0, total: 0 };
      const shadowPassRate = shadow.total > 0 ? shadow.pass / shadow.total : 0;
      const status: 'candidate' | 'promoted' | 'rejected' =
        shadow.total >= minShadowSamples
          ? (shadowPassRate >= promoteShadowPassRate
            ? 'promoted'
            : (shadowPassRate <= rejectShadowPassRate ? 'rejected' : 'candidate'))
          : 'candidate';
      const draftPayload = JSON.stringify({
        kind: 'selector_replay_draft',
        router: item.router,
        selector: item.selector,
        sampleCount: item.count,
        shadowPassRate,
        shadowSamples: shadow.total,
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
          shadowPassRate,
          sampleCount: item.count,
          status
        },
        update: {
          draftPayloadJson: draftPayload,
          shadowPassRate,
          sampleCount: item.count,
          status,
          updatedAt: new Date()
        }
      });
      generatedDrafts += 1;
    }

    if (!isContextLearningShadowOnly()) {
      logger.info(LogCode.SYS_INFO, '[CTX-LEARN] Auto-promotion is enabled (non-shadow mode)', {
        drafts: generatedDrafts,
        promoteShadowPassRate,
        minShadowSamples
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
