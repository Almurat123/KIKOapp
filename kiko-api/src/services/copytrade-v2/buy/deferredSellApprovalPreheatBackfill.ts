import prisma from '../../../db/prisma.js';
import { LogCode } from '../../../config/logRegistry.js';
import { logger } from '../../../utils/logger.js';
import { scheduleDeferredSellApprovalPreheat } from './deferredSellApprovalPreheat.js';

const ACTIVE_MIRROR_SELL_INTENT_STATES = [
  'EXIT_INTENT_CREATED',
  'EXIT_PRECHECK_READY',
  'EXIT_SUBMITTING',
  'EXIT_ACCEPTED',
  'EXIT_PENDING_FINALITY',
  'EXIT_RETRYABLE_UNRESOLVED',
];

const APPROVAL_BACKFILL_LOOKBACK_MS = Math.max(60_000, Number(process.env.COPYTRADE_DEFERRED_APPROVAL_BACKFILL_LOOKBACK_MS || '21600000'));
const APPROVAL_BACKFILL_BATCH_SIZE = Math.max(10, Number(process.env.COPYTRADE_DEFERRED_APPROVAL_BACKFILL_BATCH_SIZE || '100'));

export async function runDeferredSellApprovalPreheatBackfill(params?: {
  lookbackMs?: number;
  batchSize?: number;
}): Promise<{ scanned: number; scheduled: number }> {
  const lookbackMs = Math.max(60_000, Number(params?.lookbackMs ?? APPROVAL_BACKFILL_LOOKBACK_MS));
  const batchSize = Math.max(1, Number(params?.batchSize ?? APPROVAL_BACKFILL_BATCH_SIZE));

  const intents = await prisma.positionExitIntent.findMany({
    where: {
      exitReason: 'mirror_sell',
      lifecycleState: { in: ACTIVE_MIRROR_SELL_INTENT_STATES },
      createdAt: { gte: new Date(Date.now() - lookbackMs) },
    },
    orderBy: { createdAt: 'desc' },
    take: batchSize,
    select: {
      positionId: true,
      userId: true,
      chainId: true,
      tokenAddress: true,
    },
  });

  const positions = await prisma.position.findMany({
    where: {
      id: { in: intents.map((intent) => intent.positionId) },
    },
    select: {
      id: true,
      user: {
        select: {
          walletAddress: true,
        },
      },
    },
  });
  const walletByPositionId = new Map(
    positions.map((position) => [position.id, String(position.user?.walletAddress || '').trim()]),
  );

  let scheduled = 0;
  for (const intent of intents) {
    const walletAddress = walletByPositionId.get(intent.positionId) || '';
    if (!walletAddress) continue;
    const accepted = scheduleDeferredSellApprovalPreheat({
      userId: intent.userId,
      walletAddress,
      chainId: intent.chainId,
      tokenAddress: intent.tokenAddress,
      trigger: 'mirror_sell_release',
    });
    if (accepted) scheduled += 1;
  }

  if (scheduled > 0) {
    logger.info(LogCode.SYS_INFO, '[SellApprovalPreheat] Backfill scheduled deferred approval warmups', {
      scanned: intents.length,
      scheduled,
      lookbackMs,
      batchSize,
    });
  }

  return {
    scanned: intents.length,
    scheduled,
  };
}
