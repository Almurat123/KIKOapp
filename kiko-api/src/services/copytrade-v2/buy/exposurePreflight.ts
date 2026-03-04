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
  cooldownMinutes: number;
  allowScaleIn?: boolean;
}): CopytradeExposurePreflightResult {
  const exposure = classifyCopytradeExposureState(params.activePositions);
  const entryPolicy = evaluateCopytradeEntryPolicy({
    exposureState: exposure.state,
    allowScaleIn: params.allowScaleIn,
  });

  const recentCooldownPositions = Array.from(params.recentCooldownPositions || []);

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

  if (Math.max(0, Number(params.cooldownMinutes || 0)) > 0 && recentCooldownPositions.length > 0) {
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
    },
  };
}

export async function evaluateCopytradeExposurePreflight(params: {
  userId: string;
  configId: string;
  tokenAddress: string;
  chainId: number;
  cooldownMinutes: number;
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

  return evaluateCopytradeExposurePreflightFromPositions({
    activePositions,
    recentCooldownPositions,
    cooldownMinutes: params.cooldownMinutes,
    allowScaleIn: params.allowScaleIn,
  });
}
