const DEFAULT_COPYTRADE_STALE_BUY_MAX_AGE_MS = Math.max(
  0,
  Number(process.env.COPYTRADE_STALE_BUY_MAX_AGE_MS || '120000'),
);

export type StaleBuySignalDecision = {
  skip: boolean;
  signalAgeMs: number | null;
  maxAgeMs: number;
  reasonCode?: 'stale_target_buy_signal';
  sourceBlockTimestampMs?: number;
};

export function evaluateStaleBuySignal(params: {
  isBuy: boolean;
  sourceBlockTimestampMs?: number | null;
  nowMs?: number;
  maxAgeMs?: number;
}): StaleBuySignalDecision {
  const maxAgeMs = normalizeNonNegativeMs(
    params.maxAgeMs,
    DEFAULT_COPYTRADE_STALE_BUY_MAX_AGE_MS,
  );
  const sourceBlockTimestampMs = normalizeTimestampMs(params.sourceBlockTimestampMs);
  if (!params.isBuy || maxAgeMs <= 0 || !sourceBlockTimestampMs) {
    return {
      skip: false,
      signalAgeMs: sourceBlockTimestampMs
        ? Math.max(0, (params.nowMs || Date.now()) - sourceBlockTimestampMs)
        : null,
      maxAgeMs,
      sourceBlockTimestampMs: sourceBlockTimestampMs || undefined,
    };
  }

  const nowMs = params.nowMs || Date.now();
  const signalAgeMs = Math.max(0, nowMs - sourceBlockTimestampMs);
  if (signalAgeMs <= maxAgeMs) {
    return {
      skip: false,
      signalAgeMs,
      maxAgeMs,
      sourceBlockTimestampMs,
    };
  }

  return {
    skip: true,
    signalAgeMs,
    maxAgeMs,
    reasonCode: 'stale_target_buy_signal',
    sourceBlockTimestampMs,
  };
}

function normalizeNonNegativeMs(value: unknown, fallback: number): number {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) return fallback;
  return Math.max(0, normalized);
}

function normalizeTimestampMs(value: unknown): number | null {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized <= 0) return null;
  if (normalized >= 1e12) return Math.round(normalized);
  if (normalized >= 1e9) return Math.round(normalized * 1000);
  return null;
}
