import type { CopytradeModePolicy } from '../contracts/modePolicy.js';

const RETRY_BACKOFF_FACTOR = 1.6;
const RETRY_BACKOFF_CAP_MS = 5 * 60 * 1000;

export function resolveRetryDelayMs(policy: CopytradeModePolicy, attemptNo: number): number {
  const baseDelay = Math.max(100, policy.retryDelayMs);
  const retryPow = Math.max(0, attemptNo - 1);
  const delay = Math.floor(baseDelay * Math.pow(RETRY_BACKOFF_FACTOR, retryPow));
  return Math.min(delay, RETRY_BACKOFF_CAP_MS);
}

export function resolveRetryAt(
  policy: CopytradeModePolicy,
  attemptNo: number,
  now = Date.now(),
  overrideBaseDelayMs?: number,
): Date {
  if (Number.isFinite(overrideBaseDelayMs) && Number(overrideBaseDelayMs) > 0) {
    const baseDelay = Math.max(100, Number(overrideBaseDelayMs));
    const retryPow = Math.max(0, attemptNo - 1);
    const delay = Math.floor(baseDelay * Math.pow(RETRY_BACKOFF_FACTOR, retryPow));
    return new Date(now + Math.min(delay, RETRY_BACKOFF_CAP_MS));
  }
  return new Date(now + resolveRetryDelayMs(policy, attemptNo));
}
