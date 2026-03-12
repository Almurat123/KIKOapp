import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

const NON_CRITICAL_IDLE_TIMEOUT_MS = Math.max(
  60_000,
  Number(process.env.NON_CRITICAL_IDLE_TIMEOUT_MS || `${30 * 60 * 1000}`)
);

let lastEndUserActivityAt = 0;

export function markEndUserActivity(at = Date.now()): void {
  lastEndUserActivityAt = Math.max(lastEndUserActivityAt, at);
}

export function getLastEndUserActivityAt(): number {
  return lastEndUserActivityAt;
}

export function hasRecentEndUserActivity(now = Date.now()): boolean {
  if (lastEndUserActivityAt <= 0) return false;
  return now - lastEndUserActivityAt < NON_CRITICAL_IDLE_TIMEOUT_MS;
}

export function shouldRunNonCriticalJob(jobName: string, now = Date.now()): boolean {
  const active = hasRecentEndUserActivity(now);
  if (!active) {
    logger.info(LogCode.SYS_INFO, `[IdleMode] Skipping non-critical job while idle`, {
      jobName,
      idleTimeoutMs: NON_CRITICAL_IDLE_TIMEOUT_MS,
      lastEndUserActivityAt: lastEndUserActivityAt > 0
        ? new Date(lastEndUserActivityAt).toISOString()
        : null,
    });
  }
  return active;
}

