import prisma from '../../../db/prisma.js';
import type { CopyTradeExecutionMode } from '../../copyTradeExecutionMode.js';
import { buildEvmExitPlan } from './planner.js';
import { reconcileOpenPositionsForExit } from './openPositionReconciliation.js';
import type { AttributedPositionLike } from '../positions/positionAttribution.js';

type PositionRecord = AttributedPositionLike & {
  id: string;
  status?: string | null;
  entryPrice: number;
  entryUsdValue: number | null;
  exitRetryCount?: number | null;
};

export type ExitEligibilityPreflightResult =
  | {
      allowed: false;
      reasonCode: string;
      metrics: Record<string, unknown>;
      positions: PositionRecord[];
      matchedPositions: PositionRecord[];
      closeReason?: 'balance_empty' | 'balance_dust';
    }
  | {
      allowed: true;
      positions: PositionRecord[];
      matchedPositions: PositionRecord[];
      metrics: Record<string, unknown>;
    };

export async function evaluateExitEligibilityPreflight(params: {
  userId: string;
  walletAddress: string;
  tokenAddress: string;
  chainId: number;
  executionMode: CopyTradeExecutionMode;
  universalSlippageBps: number;
}): Promise<ExitEligibilityPreflightResult> {
  const positions = await prisma.position.findMany({
    where: {
      userId: params.userId,
      chainId: params.chainId,
      status: { in: ['open', 'pending'] },
    },
  });

  const reconciled = reconcileOpenPositionsForExit(positions, params.tokenAddress, params.chainId);
  if (reconciled.matchedPositions.length === 0) {
    return {
      allowed: false,
      reasonCode: reconciled.reasonCode,
      positions,
      matchedPositions: [],
      metrics: reconciled.metrics,
    };
  }

  const plan = await buildEvmExitPlan({
    userId: params.userId,
    walletAddress: params.walletAddress,
    tokenAddress: params.tokenAddress,
    chainId: params.chainId,
    exitReason: 'mirror_sell',
    tokenInfo: {},
    universalSlippageBps: params.universalSlippageBps,
    executionMode: params.executionMode,
    positions: reconciled.matchedPositions,
  });

  if (plan.kind === 'noop') {
    return {
      allowed: false,
      reasonCode: plan.attributedReasonCode || (plan.action === 'close_position' ? 'EXIT_CLOSE_POSITION_EARLY' : 'EXIT_KEEP_OPEN_EARLY'),
      positions,
      matchedPositions: plan.positions as PositionRecord[],
      closeReason: plan.closeReason,
      metrics: {
        ...reconciled.metrics,
        balanceRaw: plan.balance.toString(),
        decimals: plan.decimals,
        balanceUsd: plan.balanceUsd,
        action: plan.action,
        attributedReasonCode: plan.attributedReasonCode || null,
        attributionMetrics: plan.attributionMetrics || null,
      },
    };
  }

  return {
    allowed: true,
    positions,
    matchedPositions: plan.positions as PositionRecord[],
    metrics: {
      ...reconciled.metrics,
      balanceRaw: plan.balance.toString(),
      decimals: plan.decimals,
      attributedBalanceRaw: plan.attributedBalance.toString(),
      attributedReasonCode: plan.attributedReasonCode,
      attributionMetrics: plan.attributionMetrics || null,
      hasExternalBalance: plan.hasExternalBalance,
    },
  };
}
