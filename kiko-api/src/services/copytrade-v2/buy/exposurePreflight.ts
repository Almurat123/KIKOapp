import prisma from '../../../db/prisma.js';
import { buildCooldownThrottleWhere } from '../guards/cooldownPolicy.js';
import { evaluateCopytradeEntryPolicy } from './entryPolicy.js';
import {
  classifyCopytradeExposureState,
  type ExposurePositionLike,
  type ExposureStateResult,
} from '../positions/exposureState.js';

export type ExposurePreflightPosition = ExposurePositionLike & {
  id: string;
  status?: string | null;
  createdAt?: Date | null;
  closedAt?: Date | null;
};

export type ExposurePreflightOrder = {
  id: string;
  txHash?: string | null;
  lifecycleState?: string | null;
  createdAt?: Date | null;
  detectedAt?: Date | null;
};

export type CopytradeExposurePreflightResult =
  | {
      allowed: true;
      reasonCode: 'EXPOSURE_PREFLIGHT_OK';
      metrics: Record<string, unknown>;
      exposure: ExposureStateResult<ExposurePreflightPosition>;
    }
  | {
      allowed: false;
      reasonCode:
        | 'ENTRY_POLICY_BLOCK_ACTIVE_EXPOSURE'
        | 'COOLDOWN_RECENT_STRATEGY_ACTIVITY';
      metrics: Record<string, unknown>;
      exposure: ExposureStateResult<ExposurePreflightPosition>;
    };

export function evaluateCopytradeExposurePreflightFromPositions(params: {
  activePositions: ExposurePreflightPosition[];
  recentCooldownPositions?: ExposurePreflightPosition[];
  recentTargetSignalOrders?: ExposurePreflightOrder[];
  cooldownMinutes: number;
  allowScaleIn?: boolean;
}): CopytradeExposurePreflightResult {
  const exposure = classifyCopytradeExposureState(params.activePositions);
  const entryPolicy = evaluateCopytradeEntryPolicy({
    exposureState: exposure.state,
    allowScaleIn: params.allowScaleIn,
  });

  const recentCooldownPositions = Array.from(params.recentCooldownPositions || []);
  const recentTargetSignalOrders = Array.from(params.recentTargetSignalOrders || []);

  if (!entryPolicy.allow) {
    return {
      allowed: false,
      reasonCode: 'ENTRY_POLICY_BLOCK_ACTIVE_EXPOSURE',
      exposure,
      metrics: {
        exposureState: exposure.state,
        exposureReasonCode: exposure.reasonCode,
        entryPolicyMode: entryPolicy.mode,
        cooldownMinutes: Math.max(0, Number(params.cooldownMinutes || 0)),
        blockingPositionIds: exposure.blockingPositions.map((position) => position.id),
      },
    };
  }

  if (
    Math.max(0, Number(params.cooldownMinutes || 0)) > 0
    && (recentCooldownPositions.length > 0 || recentTargetSignalOrders.length > 0)
  ) {
    return {
      allowed: false,
      reasonCode: 'COOLDOWN_RECENT_STRATEGY_ACTIVITY',
      exposure,
      metrics: {
        exposureState: exposure.state,
        exposureReasonCode: exposure.reasonCode,
        entryPolicyMode: entryPolicy.mode,
        cooldownMinutes: Math.max(0, Number(params.cooldownMinutes || 0)),
        recentCooldownPositionIds: recentCooldownPositions.map((position) => position.id),
        recentCooldownPositionCount: recentCooldownPositions.length,
        recentTargetSignalOrderIds: recentTargetSignalOrders.map((order) => order.id),
        recentTargetSignalOrderCount: recentTargetSignalOrders.length,
      },
    };
  }

  return {
    allowed: true,
    reasonCode: 'EXPOSURE_PREFLIGHT_OK',
    exposure,
    metrics: {
      exposureState: exposure.state,
      exposureReasonCode: exposure.reasonCode,
      entryPolicyMode: entryPolicy.mode,
      cooldownMinutes: Math.max(0, Number(params.cooldownMinutes || 0)),
      recentCooldownPositionCount: recentCooldownPositions.length,
      recentTargetSignalOrderCount: recentTargetSignalOrders.length,
    },
  };
}

export async function evaluateCopytradeExposurePreflight(params: {
  userId: string;
  configId: string;
  tokenAddress: string;
  chainId: number;
  cooldownMinutes: number;
  targetWallet?: string;
  sourceTxHash?: string | null;
  allowScaleIn?: boolean;
}): Promise<CopytradeExposurePreflightResult> {
  const activePositions = await prisma.position.findMany({
    where: {
      userId: params.userId,
      configId: params.configId,
      tokenAddress: params.tokenAddress,
      chainId: params.chainId,
      status: {
        in: ['pending', 'pending_broadcast', 'broadcasted_unseen', 'open', 'closing', 'close_pending'] as any,
      },
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      closedAt: true,
    },
  });

  const cooldownWhere = buildCooldownThrottleWhere({
    userId: params.userId,
    configId: params.configId,
    tokenAddress: params.tokenAddress,
    chainId: params.chainId,
    cooldownMinutes: params.cooldownMinutes,
  });

  const recentCooldownPositions = cooldownWhere
    ? await prisma.position.findMany({
        where: cooldownWhere,
        select: {
          id: true,
          status: true,
          createdAt: true,
          closedAt: true,
        },
      })
    : [];

  // CONTEXT MEMORY
  // Updated: 2026-04-14
  // Author: Mira Chen
  // Reason: Runtime logs showed the 60-minute same-token protection was only scoped
  // to follower positions, so repeated target-wallet buys could re-enter when the
  // previous signal skipped or had already closed.
  // Goal: Treat target-wallet same-token buy signals as cooldown evidence for the
  // same user/config before any new follower buy can be created.
  // Owns: Querying recent canonical copytrade buy orders as target-signal cooldown evidence.
  // Does Not Own: Target-sell attribution, wallet activity persistence, or global cross-user throttles.
  // Design Language:
  // - Cooldown protects strategy admission, not only open follower exposure.
  // - Current leader tx must be excluded so the canonical order created for this signal does not block itself.
  // - Forbidden local patch patterns: relying on Position rows alone for target-wallet signal cooldown.
  // Document Provenance:
  // - Source: /Users/almurat/Downloads/logs.1776165812688.json
  // - Kind: runtime observation
  // - Retrieved: 2026-04-14
  // - Applied To: target-wallet same-token buy signal cooldown in exposure preflight
  // - Verification: verified in logs and unit tests
  // See also:
  // - system-journal/INDEX.md
  // - system-journal/design-language/copytrade-race-recovery.md
  // - system-journal/owner-map/copytrade-webhook-ingress.md
  // - system-journal/fix-log/2026-04-14-copytrade-target-signal-cooldown-and-exit-finality.md
  const normalizedTargetWallet = String(params.targetWallet || '').trim().toLowerCase();
  const currentSourceTxHash = String(params.sourceTxHash || '').trim().toLowerCase();
  const cooldownMinutes = Math.max(0, Number(params.cooldownMinutes || 0));
  const recentTargetSignalOrders = normalizedTargetWallet && cooldownMinutes > 0
    ? await prisma.copytradeOrder.findMany({
        where: {
          userId: params.userId,
          configId: params.configId,
          chainId: params.chainId,
          targetWallet: { equals: normalizedTargetWallet, mode: 'insensitive' },
          tokenOut: { equals: params.tokenAddress, mode: 'insensitive' },
          direction: 'buy',
          ...(currentSourceTxHash ? { txHash: { not: currentSourceTxHash } } : {}),
          OR: [
            { createdAt: { gte: new Date(Date.now() - cooldownMinutes * 60 * 1000) } },
            { detectedAt: { gte: new Date(Date.now() - cooldownMinutes * 60 * 1000) } },
          ],
        },
        select: {
          id: true,
          txHash: true,
          lifecycleState: true,
          createdAt: true,
          detectedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      })
    : [];

  return evaluateCopytradeExposurePreflightFromPositions({
    activePositions,
    recentCooldownPositions,
    recentTargetSignalOrders,
    cooldownMinutes: params.cooldownMinutes,
    allowScaleIn: params.allowScaleIn,
  });
}
