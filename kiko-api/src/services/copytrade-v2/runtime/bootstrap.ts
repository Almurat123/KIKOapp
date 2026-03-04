import prisma from '../../../db/prisma.js';
import { onSwapDetected } from '../../watcherService.js';
import { enqueueCopyTradeTask } from '../../copyTradeQueue.js';
import { onSolanaSwapDetected, startSolanaWatcher } from '../../solanaWatcher.js';
import { startCopyTradePendingWatcher, stopCopyTradePendingWatcher } from '../../copyTradePendingService.js';
import { runTargetSellReconciliationCycle } from '../reconcile/targetSellReconciliationJob.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import type { DecodedSwap } from '../../txDecoder.js';

const TARGET_SELL_RECONCILIATION_INTERVAL_MS = Math.max(
  15_000,
  Number(process.env.COPYTRADE_TARGET_SELL_RECONCILIATION_INTERVAL_MS || '30000'),
);

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
let targetSellReconciliationInterval: NodeJS.Timeout | null = null;

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
    enqueueCopyTradeTask(targetWallet, swap, chainId);
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

  targetSellReconciliationInterval = setInterval(() => {
    void runTargetSellReconciliationCycle()
      .then((result) => {
        if (result.scheduledOpen > 0 || result.armedPending > 0 || result.fullExitMatches > 0) {
          logger.info(LogCode.SYS_INFO, '[CopyTradeV2] Target sell reconcile cycle completed', result);
        }
      })
      .catch((error: any) => {
        logger.warn(LogCode.SYS_ERROR, '[CopyTradeV2] Target sell reconcile cycle failed', {
          error: error?.message || String(error),
        });
      });
  }, TARGET_SELL_RECONCILIATION_INTERVAL_MS);

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

  if (targetSellReconciliationInterval) {
    clearInterval(targetSellReconciliationInterval);
    targetSellReconciliationInterval = null;
  }

  stopCopyTradePendingWatcher();
  initialized = false;
}
