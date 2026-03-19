import { LogCode } from '../../config/logRegistry.js';
import { logger } from '../../utils/logger.js';
import type { RpcSelectionExplainSnapshot } from './explain.js';

const RPC_EXPLAIN_AGGREGATE_WINDOW_MS = Math.max(
  10_000,
  Number(process.env.RPC_EXPLAIN_AGGREGATE_WINDOW_MS || 60_000),
);

type AggregateKey = string;

type AggregateEntry = {
  chain: string;
  method: string;
  purpose: string;
  lane: string;
  calls: number;
  upgradedToFast: number;
  allFailed: number;
  reasons: Map<string, number>;
};

let currentWindowStart = Math.floor(Date.now() / RPC_EXPLAIN_AGGREGATE_WINDOW_MS) * RPC_EXPLAIN_AGGREGATE_WINDOW_MS;
const aggregates = new Map<AggregateKey, AggregateEntry>();
let flushTimer: NodeJS.Timeout | null = null;

function buildKey(params: {
  chain: string;
  method: string;
  purpose: string;
  lane: string;
}): AggregateKey {
  return `${params.chain}::${params.method}::${params.purpose}::${params.lane}`;
}

function rotateWindowIfNeeded(now = Date.now()): void {
  const windowStart = Math.floor(now / RPC_EXPLAIN_AGGREGATE_WINDOW_MS) * RPC_EXPLAIN_AGGREGATE_WINDOW_MS;
  if (windowStart === currentWindowStart) return;
  flushRpcSelectionExplainAggregates();
  currentWindowStart = windowStart;
}

function ensureFlushTimer(): void {
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    flushRpcSelectionExplainAggregates();
  }, RPC_EXPLAIN_AGGREGATE_WINDOW_MS);
  flushTimer.unref?.();
}

function collectReasons(snapshot: RpcSelectionExplainSnapshot): string[] {
  const reasons = new Set<string>();
  for (const reason of snapshot.upgradeReasons || []) {
    if (reason) reasons.add(String(reason));
  }
  if (reasons.size === 0) {
    for (const score of snapshot.topScores || []) {
      for (const reason of score.reasons || []) {
        if (reason) reasons.add(String(reason));
        if (reasons.size >= 8) break;
      }
      if (reasons.size >= 8) break;
    }
  }
  return [...reasons];
}

export function recordRpcSelectionExplainAggregate(params: {
  chain: string;
  purpose: string;
  snapshot: RpcSelectionExplainSnapshot;
}): void {
  rotateWindowIfNeeded();
  ensureFlushTimer();
  const key = buildKey({
    chain: params.chain,
    method: params.snapshot.method,
    purpose: params.purpose,
    lane: params.snapshot.lane,
  });
  const current = aggregates.get(key) || {
    chain: params.chain,
    method: params.snapshot.method,
    purpose: params.purpose,
    lane: params.snapshot.lane,
    calls: 0,
    upgradedToFast: 0,
    allFailed: 0,
    reasons: new Map<string, number>(),
  };
  current.calls += 1;
  if (params.snapshot.upgradedToFast) current.upgradedToFast += 1;
  for (const reason of collectReasons(params.snapshot)) {
    current.reasons.set(reason, (current.reasons.get(reason) || 0) + 1);
  }
  aggregates.set(key, current);
}

export function recordRpcSelectionExplainAllFailed(params: {
  chain: string;
  method: string;
  purpose: string;
  lane: string;
  reasons?: string[];
}): void {
  rotateWindowIfNeeded();
  ensureFlushTimer();
  const key = buildKey(params);
  const current = aggregates.get(key) || {
    chain: params.chain,
    method: params.method,
    purpose: params.purpose,
    lane: params.lane,
    calls: 0,
    upgradedToFast: 0,
    allFailed: 0,
    reasons: new Map<string, number>(),
  };
  current.allFailed += 1;
  for (const reason of params.reasons || []) {
    current.reasons.set(reason, (current.reasons.get(reason) || 0) + 1);
  }
  aggregates.set(key, current);
}

export function flushRpcSelectionExplainAggregates(): void {
  if (aggregates.size === 0) return;
  const windowStartIso = new Date(currentWindowStart).toISOString();
  const windowEndIso = new Date(currentWindowStart + RPC_EXPLAIN_AGGREGATE_WINDOW_MS).toISOString();
  const rows = [...aggregates.values()]
    .sort((a, b) => (b.calls + b.allFailed) - (a.calls + a.allFailed))
    .map((entry) => ({
      chain: entry.chain,
      method: entry.method,
      purpose: entry.purpose,
      lane: entry.lane,
      calls: entry.calls,
      upgradedToFast: entry.upgradedToFast,
      allFailed: entry.allFailed,
      topReasons: [...entry.reasons.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([reason, count]) => ({ reason, count })),
    }));

  logger.info(LogCode.SYS_INFO, 'RPC selection explain summary', {
    windowStartIso,
    windowEndIso,
    groups: rows.length,
    rows,
  });
  aggregates.clear();
}

export function __resetRpcSelectionExplainAggregatesForTests(): void {
  aggregates.clear();
  currentWindowStart = Math.floor(Date.now() / RPC_EXPLAIN_AGGREGATE_WINDOW_MS) * RPC_EXPLAIN_AGGREGATE_WINDOW_MS;
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}
