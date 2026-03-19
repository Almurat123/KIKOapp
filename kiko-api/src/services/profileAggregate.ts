import { LogCode } from '../config/logRegistry.js';
import { logger } from '../utils/logger.js';

const PROFILE_AGGREGATE_WINDOW_MS = Math.max(
  10_000,
  Number(process.env.COPYTRADE_PROFILE_AGGREGATE_WINDOW_MS || 60_000),
);

type AggregateKey = string;

type TimingEntry = {
  group: string;
  chainId?: number;
  path?: string;
  count: number;
  totalMs: number;
  maxMs: number;
};

const timingAggregates = new Map<AggregateKey, TimingEntry>();
let currentWindowStart = Math.floor(Date.now() / PROFILE_AGGREGATE_WINDOW_MS) * PROFILE_AGGREGATE_WINDOW_MS;
let flushTimer: NodeJS.Timeout | null = null;

function buildKey(params: { group: string; chainId?: number; path?: string }): AggregateKey {
  return `${params.group}::${params.chainId ?? 'na'}::${params.path || 'na'}`;
}

function rotateWindowIfNeeded(now = Date.now()): void {
  const windowStart = Math.floor(now / PROFILE_AGGREGATE_WINDOW_MS) * PROFILE_AGGREGATE_WINDOW_MS;
  if (windowStart === currentWindowStart) return;
  flushProfileAggregates();
  currentWindowStart = windowStart;
}

function ensureFlushTimer(): void {
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    flushProfileAggregates();
  }, PROFILE_AGGREGATE_WINDOW_MS);
  flushTimer.unref?.();
}

export function recordProfileTimingAggregate(params: {
  group: string;
  chainId?: number;
  path?: string;
  ms?: number;
}): void {
  rotateWindowIfNeeded();
  ensureFlushTimer();
  const key = buildKey(params);
  const current = timingAggregates.get(key) || {
    group: params.group,
    chainId: params.chainId,
    path: params.path,
    count: 0,
    totalMs: 0,
    maxMs: 0,
  };
  const ms = Math.max(0, Number(params.ms || 0));
  current.count += 1;
  current.totalMs += ms;
  current.maxMs = Math.max(current.maxMs, ms);
  timingAggregates.set(key, current);
}

export function flushProfileAggregates(): void {
  if (timingAggregates.size === 0) return;
  const windowStartIso = new Date(currentWindowStart).toISOString();
  const windowEndIso = new Date(currentWindowStart + PROFILE_AGGREGATE_WINDOW_MS).toISOString();
  const rows = [...timingAggregates.values()]
    .sort((a, b) => b.count - a.count)
    .map((entry) => ({
      group: entry.group,
      chainId: entry.chainId,
      path: entry.path,
      count: entry.count,
      avgMs: Number((entry.totalMs / Math.max(1, entry.count)).toFixed(2)),
      maxMs: entry.maxMs,
    }));

  logger.info(LogCode.SYS_INFO, 'Copytrade profile summary', {
    windowStartIso,
    windowEndIso,
    groups: rows.length,
    rows,
  });
  timingAggregates.clear();
}
