import prisma from '../../../db/prisma.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';

const LIVE_EXIT_LANES = ['evm-exit', 'solana-exit'] as const;
const ACTIVE_INTENT_STATES = [
  'EXIT_INTENT_CREATED',
  'EXIT_PRECHECK_READY',
  'EXIT_SUBMITTING',
  'EXIT_ACCEPTED',
  'EXIT_PENDING_FINALITY',
  'EXIT_RETRYABLE_UNRESOLVED',
] as const;

const LIVE_EXIT_PRESSURE_WINDOW_MS = Math.max(
  5_000,
  Number(process.env.COPYTRADE_LIVE_EXIT_PRESSURE_WINDOW_MS || '15000')
);

export interface LiveExitPressureSnapshot {
  activeIntentCount: number;
  claimedIntentCount: number;
  recentActivityCount: number;
}

export function shouldDeferBackgroundCycle(snapshot: LiveExitPressureSnapshot): boolean {
  return snapshot.activeIntentCount > 0 || snapshot.claimedIntentCount > 0 || snapshot.recentActivityCount > 0;
}

export async function getLiveExitPressureSnapshot(): Promise<LiveExitPressureSnapshot> {
  const now = new Date();
  const activeSince = new Date(Date.now() - LIVE_EXIT_PRESSURE_WINDOW_MS);
  const [activeIntentCount, claimedIntentCount, recentActivityCount] = await Promise.all([
    prisma.positionExitIntent.count({
      where: {
        lane: { in: [...LIVE_EXIT_LANES] },
        lifecycleState: { in: [...ACTIVE_INTENT_STATES] },
        OR: [
          { notBefore: null },
          { notBefore: { lte: now } },
        ],
      },
    }),
    prisma.positionExitIntent.count({
      where: {
        lane: { in: [...LIVE_EXIT_LANES] },
        lifecycleState: { in: [...ACTIVE_INTENT_STATES] },
        claimedAt: { gte: activeSince },
      },
    }),
    prisma.positionExitIntent.count({
      where: {
        lane: { in: [...LIVE_EXIT_LANES] },
        lifecycleState: { in: [...ACTIVE_INTENT_STATES] },
        updatedAt: { gte: activeSince },
      },
    }),
  ]);

  return {
    activeIntentCount,
    claimedIntentCount,
    recentActivityCount,
  };
}

export async function runBackgroundCycleWhenIdle<T>(params: {
  cycle: string;
  fn: () => Promise<T>;
}): Promise<{ skipped: boolean; result?: T }> {
  const snapshot = await getLiveExitPressureSnapshot().catch(() => null);
  if (snapshot && shouldDeferBackgroundCycle(snapshot)) {
    logger.info(LogCode.SYS_INFO, '[CopyTradeExitHotPath] Background cycle deferred due to live exit pressure', {
      cycle: params.cycle,
      ...snapshot,
    });
    return { skipped: true };
  }
  return { skipped: false, result: await params.fn() };
}

export const __testOnly = {
  LIVE_EXIT_PRESSURE_WINDOW_MS,
};
