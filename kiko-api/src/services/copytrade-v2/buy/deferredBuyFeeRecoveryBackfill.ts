import prisma from '../../../db/prisma.js';
import { LogCode } from '../../../config/logRegistry.js';
import { logger } from '../../../utils/logger.js';
import type { DirectSwapFeeSettlement } from '../../swap/fee/directSwapFeeCollector.js';
import { scheduleDeferredBuyFeeRecovery } from './deferredBuyFeeRecovery.js';

const BACKFILL_LOOKBACK_MS = Math.max(60_000, Number(process.env.COPYTRADE_DEFERRED_FEE_BACKFILL_LOOKBACK_MS || '21600000'));
const BACKFILL_BATCH_SIZE = Math.max(10, Number(process.env.COPYTRADE_DEFERRED_FEE_BACKFILL_BATCH_SIZE || '100'));

function extractDirectFeeSettlement(value: unknown): DirectSwapFeeSettlement | null {
  if (!value || typeof value !== 'object') return null;
  const seen = new Set<any>();
  const queue: any[] = [value];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') continue;
    if (seen.has(current)) continue;
    seen.add(current);

    const directFee = (current as Record<string, unknown>).directFeeSettlement;
    if (directFee && typeof directFee === 'object') {
      const candidate = directFee as DirectSwapFeeSettlement;
      if (candidate.deferred && candidate.chainId && candidate.normalizedTokenOut) {
        return candidate;
      }
    }

    for (const nested of Object.values(current as Record<string, unknown>)) {
      if (nested && typeof nested === 'object') queue.push(nested);
    }
  }
  return null;
}

export async function runDeferredBuyFeeRecoveryBackfill(params?: {
  lookbackMs?: number;
  batchSize?: number;
}): Promise<{ scanned: number; scheduled: number }> {
  const lookbackMs = Math.max(60_000, Number(params?.lookbackMs ?? BACKFILL_LOOKBACK_MS));
  const batchSize = Math.max(1, Number(params?.batchSize ?? BACKFILL_BATCH_SIZE));
  const rows = await prisma.copytradeOrderExecution.findMany({
    where: {
      createdAt: { gte: new Date(Date.now() - lookbackMs) },
      txHash: { not: null },
    },
    orderBy: { createdAt: 'desc' },
    take: batchSize,
    include: {
      order: {
        select: {
          userId: true,
          chainId: true,
          tokenOut: true,
          metadataJson: true,
        },
      },
    },
  });

  let scheduled = 0;
  for (const row of rows) {
    const settlement = extractDirectFeeSettlement(row.metadataJson) || extractDirectFeeSettlement(row.order?.metadataJson);
    if (!settlement?.deferred) continue;
    const userId = String(row.order?.userId || '').trim();
    if (!userId) continue;

    const accepted = scheduleDeferredBuyFeeRecovery({
      userId,
      chainId: Number(settlement.chainId || row.order?.chainId || 0),
      tokenAddress: String(settlement.normalizedTokenOut || row.order?.tokenOut || '').trim(),
      txHash: String(settlement.sourceTxHash || row.txHash || '').trim(),
      recoverySource: 'late_recovery',
      settlement,
    });
    if (accepted) scheduled += 1;
  }

  if (scheduled > 0) {
    logger.info(LogCode.SYS_INFO, '[CopyTradeBuyFeeRecovery] Backfill scheduled deferred fee recoveries', {
      scanned: rows.length,
      scheduled,
      lookbackMs,
      batchSize,
    });
  }

  return {
    scanned: rows.length,
    scheduled,
  };
}

export const __deferredBuyFeeRecoveryBackfillTest = {
  extractDirectFeeSettlement,
};
