import prisma from '../../../db/prisma.js';
import { onSwapDetected } from '../../watcherService.js';
import { onSolanaSwapDetected, startSolanaWatcher } from '../../solanaWatcher.js';
import { startCopyTradePendingWatcher, stopCopyTradePendingWatcher } from '../../copyTradePendingService.js';
import { runCopytradeAttributionRepairCycle } from '../jobs/copytradeAttributionRepairJob.js';
import { runDeferredBuyFeeRecoveryBackfill } from '../buy/deferredBuyFeeRecoveryBackfill.js';
import { runDeferredSellApprovalPreheatBackfill } from '../buy/deferredSellApprovalPreheatBackfill.js';
import { getLiveExitPressureSnapshot, runBackgroundCycleWhenIdle } from '../exit/exitHotPathPressure.js';
import { hasRecentEndUserActivity } from '../../runtimeActivityService.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import type { DecodedSwap } from '../../txDecoder.js';
import { dispatchCopyTradeIfReady } from '../ingress/copyTradeFastDispatcher.js';

const ATTRIBUTION_REPAIR_INTERVAL_MS = 600_000;
const DEFERRED_FEE_BACKFILL_INTERVAL_MS = Math.max(
  30_000,
  Number(process.env.COPYTRADE_DEFERRED_FEE_BACKFILL_INTERVAL_MS || '60000'),
);
const DEFERRED_APPROVAL_BACKFILL_INTERVAL_MS = Math.max(
  30_000,
  Number(process.env.COPYTRADE_DEFERRED_APPROVAL_BACKFILL_INTERVAL_MS || '60000'),
);
const IDLE_HYGIENE_INTERVAL_MS = 10 * 60_000;

type PositionStatusCompat = {
  lockStatuses: string[];
  pendingCreateStatus: string;
  failedFinalStatus: string;
};

let positionStatusCompatCache: { value: PositionStatusCompat; ts: number } | null = null;
const POSITION_STATUS_COMPAT_TTL_MS = 30_000;

let initialized = false;
let isShuttingDown = false;
let zombieCleanupInterval: NodeJS.Timeout | null = null;
let attributionRepairInterval: NodeJS.Timeout | null = null;
let deferredFeeBackfillInterval: NodeJS.Timeout | null = null;
let deferredApprovalBackfillInterval: NodeJS.Timeout | null = null;
const lastIdleHygieneRunByCycle = new Map<string, number>();

async function runCopytradeBackgroundTaskWhenIdle<T>(cycle: string, fn: () => Promise<T>): Promise<T | null> {
  const recentUserActivity = hasRecentEndUserActivity();
  const liveExitPressure = await getLiveExitPressureSnapshot().catch(() => null);
  const activePositionCount = await prisma.position.count({
    where: {
      status: { in: ['open', 'pending'] as any },
    },
  }).catch(() => 0);
  const hasActiveWork = activePositionCount > 0 || Boolean(
    liveExitPressure
    && (liveExitPressure.activeIntentCount > 0 || liveExitPressure.claimedIntentCount > 0 || liveExitPressure.recentActivityCount > 0)
  );
  if (!recentUserActivity && !hasActiveWork) {
    const now = Date.now();
    const lastRunAt = lastIdleHygieneRunByCycle.get(cycle) || 0;
    if (now - lastRunAt < IDLE_HYGIENE_INTERVAL_MS) {
      logger.info(LogCode.SYS_INFO, '[CopyTradeV2] Background cycle skipped while idle', {
        cycle,
        nextEligibleInMs: Math.max(0, IDLE_HYGIENE_INTERVAL_MS - (now - lastRunAt)),
      });
      return null;
    }
    lastIdleHygieneRunByCycle.set(cycle, now);
  } else {
    lastIdleHygieneRunByCycle.delete(cycle);
  }

  const result = await runBackgroundCycleWhenIdle({
    cycle,
    fn,
  }).catch(() => ({ skipped: false, result: null as T | null }));
  if (result.skipped) return null;
  return result.result ?? null;
}

async function getPositionStatusCompat(): Promise<PositionStatusCompat> {
  const cached = positionStatusCompatCache;
  if (cached && Date.now() - cached.ts < POSITION_STATUS_COMPAT_TTL_MS) {
    return cached.value;
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT e.enumlabel
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = 'PositionStatus'
    `;

    const labels = new Set(rows.map((row) => String(row.enumlabel)));
    const hasFailedFinal = labels.has('failed_final');

    const compat: PositionStatusCompat = {
      lockStatuses: ['pending'],
      pendingCreateStatus: 'pending',
      failedFinalStatus: hasFailedFinal ? 'failed_final' : 'failed',
    };
    positionStatusCompatCache = { value: compat, ts: Date.now() };
    return compat;
  } catch {
    const fallback: PositionStatusCompat = {
      lockStatuses: ['pending'],
      pendingCreateStatus: 'pending',
      failedFinalStatus: 'failed',
    };
    positionStatusCompatCache = { value: fallback, ts: Date.now() };
    return fallback;
  }
}

async function cleanupPendingPositions(): Promise<void> {
  try {
    const compat = await getPositionStatusCompat();
    const result = await prisma.position.updateMany({
      where: {
        status: { in: compat.lockStatuses as any },
        createdAt: { lt: new Date(Date.now() - 5 * 60 * 1000) },
      },
      data: {
        status: compat.failedFinalStatus as any,
        exitReason: 'pending_timeout',
        closedAt: new Date(),
      },
    });

    if (result.count > 0) {
      logger.info(LogCode.SYS_INFO, `[CopyTradeV2] Marked ${result.count} stale pending positions as terminal failed`);
    }
  } catch (error: any) {
    logger.error(LogCode.SYS_ERROR, '[CopyTradeV2] Failed to clean up zombie positions', {
      error: error?.message || String(error),
    });
  }
}

export function isCopytradeRuntimeShuttingDown(): boolean {
  return isShuttingDown;
}

export function initCopytradeV2Bootstrap(params: {
  solanaHandler: (
    targetWallet: string,
    swap: DecodedSwap,
    chainId: number,
    context?: { detectedAt?: number },
  ) => Promise<void>;
}): void {
  if (initialized) {
    logger.info(LogCode.SYS_INFO, '[CopyTradeV2] bootstrap already initialized');
    return;
  }

  isShuttingDown = false;
  initialized = true;

  logger.info(LogCode.SYS_STARTUP, 'Initializing CopyTrade V2 bootstrap...');

  onSwapDetected(async (targetWallet, swap, chainId) => {
    const txHash = String(swap?.txHash || '').trim();
    if (!txHash) return;
    await dispatchCopyTradeIfReady({
      chainId,
      txHash,
      targetWallet,
      swap,
      source: 'watcher_live',
    });
  });

  onSolanaSwapDetected(params.solanaHandler);
  startSolanaWatcher();

  startCopyTradePendingWatcher().catch((error: any) => {
    logger.warn(LogCode.SYS_INFO, '[CopyTradeV2] Failed to start pending watcher', {
      error: error?.message || String(error),
    });
  });

  zombieCleanupInterval = setInterval(() => {
    void cleanupPendingPositions();
  }, 5 * 60 * 1000);

  attributionRepairInterval = setInterval(() => {
    void runCopytradeBackgroundTaskWhenIdle('attribution_repair', () => runCopytradeAttributionRepairCycle())
      .then((result) => {
        if (!result) return;
        if (result.repairedCount > 0 || result.repairRequiredCount > 0) {
          logger.info(LogCode.SYS_INFO, '[CopyTradeV2] Attribution repair cycle completed', result);
        }
      })
      .catch((error: any) => {
        logger.warn(LogCode.SYS_ERROR, '[CopyTradeV2] Attribution repair cycle failed', {
          error: error?.message || String(error),
        });
      });
  }, ATTRIBUTION_REPAIR_INTERVAL_MS);

  deferredFeeBackfillInterval = setInterval(() => {
    void runCopytradeBackgroundTaskWhenIdle('deferred_buy_fee_backfill', () => runDeferredBuyFeeRecoveryBackfill()).catch((error: any) => {
      logger.warn(LogCode.SYS_ERROR, '[CopyTradeV2] Deferred fee recovery backfill failed', {
        error: error?.message || String(error),
      });
    });
  }, DEFERRED_FEE_BACKFILL_INTERVAL_MS);

  deferredApprovalBackfillInterval = setInterval(() => {
    void runCopytradeBackgroundTaskWhenIdle('deferred_sell_approval_preheat_backfill', () => runDeferredSellApprovalPreheatBackfill()).catch((error: any) => {
      logger.warn(LogCode.SYS_ERROR, '[CopyTradeV2] Deferred approval backfill failed', {
        error: error?.message || String(error),
      });
    });
  }, DEFERRED_APPROVAL_BACKFILL_INTERVAL_MS);

  void runCopytradeBackgroundTaskWhenIdle('attribution_repair_bootstrap', () => runCopytradeAttributionRepairCycle()).catch(() => { });
  void runCopytradeBackgroundTaskWhenIdle('deferred_buy_fee_backfill_bootstrap', () => runDeferredBuyFeeRecoveryBackfill()).catch(() => { });
  void runCopytradeBackgroundTaskWhenIdle('deferred_sell_approval_preheat_backfill_bootstrap', () => runDeferredSellApprovalPreheatBackfill()).catch(() => { });

  logger.info(LogCode.SYS_STARTUP, 'CopyTrade V2 bootstrap initialized', {
    mode: 'solana-watcher+evm-webhook+pending',
  });
}

export async function stopCopytradeV2Bootstrap(): Promise<void> {
  if (!initialized) return;

  logger.info(LogCode.SYS_SHUTDOWN, 'Stopping CopyTrade V2 bootstrap...');
  isShuttingDown = true;

  if (zombieCleanupInterval) {
    clearInterval(zombieCleanupInterval);
    zombieCleanupInterval = null;
  }

  if (attributionRepairInterval) {
    clearInterval(attributionRepairInterval);
    attributionRepairInterval = null;
  }
  if (deferredFeeBackfillInterval) {
    clearInterval(deferredFeeBackfillInterval);
    deferredFeeBackfillInterval = null;
  }
  if (deferredApprovalBackfillInterval) {
    clearInterval(deferredApprovalBackfillInterval);
    deferredApprovalBackfillInterval = null;
  }

  stopCopyTradePendingWatcher();
  initialized = false;
}
