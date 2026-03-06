const DEFAULT_EXIT_INFLIGHT_RETRY_GRACE_MS = Math.max(
  60_000,
  Number(process.env.COPYTRADE_EXIT_INFLIGHT_RETRY_GRACE_MS || '180000')
);

export function getExitInflightRetryGraceMs(): number {
  return DEFAULT_EXIT_INFLIGHT_RETRY_GRACE_MS;
}

export function hasRecentInflightExitRetryGuard(params: {
  exitTxHash?: string | null;
  lastExitAttempt?: Date | null;
  nowMs?: number;
  graceMs?: number;
}): boolean {
  const exitTxHash = String(params.exitTxHash || '').trim();
  if (!exitTxHash) return false;
  const lastExitAttemptMs = params.lastExitAttempt instanceof Date
    ? params.lastExitAttempt.getTime()
    : 0;
  if (!Number.isFinite(lastExitAttemptMs) || lastExitAttemptMs <= 0) return false;
  const nowMs = Number(params.nowMs || Date.now());
  const graceMs = Math.max(1_000, Number(params.graceMs || DEFAULT_EXIT_INFLIGHT_RETRY_GRACE_MS));
  return lastExitAttemptMs >= (nowMs - graceMs);
}