import { learnTemplateCandidateDrafts } from './contextLearner.js';
import { isContextLearningEnabled } from '../context/featureFlags.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';

const DEFAULT_INTERVAL_MS = Math.max(
  60_000,
  Number(process.env.CTX_LEARNING_INTERVAL_MS || '3600000') // 1 hour default
);

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function tick(): Promise<void> {
  if (running) return; // prevent overlapping runs
  if (!isContextLearningEnabled()) return;
  running = true;
  try {
    const result = await learnTemplateCandidateDrafts();
    logger.info(LogCode.SYS_INFO, '[CTX-LEARN] Scheduled run completed', {
      generatedDrafts: result.generatedDrafts,
      failureBuckets: result.failureBuckets
    });
  } catch (err: any) {
    logger.warn(LogCode.SYS_ERROR, '[CTX-LEARN] Scheduled run failed', {
      error: err?.message || String(err)
    });
  } finally {
    running = false;
  }
}

/**
 * Start periodic template-learning runs.
 * Safe to call multiple times — only the first call creates the interval.
 */
export function startLearnerSchedule(intervalMs?: number): void {
  if (timer) return;
  if (!isContextLearningEnabled()) {
    logger.info(LogCode.SYS_INFO, '[CTX-LEARN] Scheduler skipped: learning disabled');
    return;
  }
  const interval = Math.max(60_000, intervalMs || DEFAULT_INTERVAL_MS);
  timer = setInterval(tick, interval);
  // Unref so the timer doesn't prevent Node from exiting gracefully
  if (typeof timer === 'object' && 'unref' in timer) timer.unref();
  logger.info(LogCode.SYS_INFO, '[CTX-LEARN] Scheduler started', { intervalMs: interval });
}

/** Stop the periodic learner. */
export function stopLearnerSchedule(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    logger.info(LogCode.SYS_INFO, '[CTX-LEARN] Scheduler stopped');
  }
}

/** Run a single learning pass on-demand (e.g. after shadow execution failure). */
export async function triggerLearnerOnce(): Promise<void> {
  if (!isContextLearningEnabled()) return;
  await tick();
}

export function isLearnerRunning(): boolean {
  return timer !== null;
}
