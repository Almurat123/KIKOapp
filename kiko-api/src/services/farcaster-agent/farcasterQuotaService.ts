// CONTEXT MEMORY
// Updated: 2026-04-10
// Author: Linh Tran
// Reason: polling-based Farcaster agent ingress needs an inexpensive hard stop
//         against runaway public usage before chat work and publish-cast calls.
// Goal: keep Farcaster mention cost controls deterministic and cache-backed.
// Owns: daily Farcaster agent quota counters.
// Does Not Own: billing plan logic, chat usage accounting, or message formatting.
// Design Language:
// - Enforce quotas before expensive agent work.
// - Keep counters day-scoped in UTC.
// - Separate public message volume from agent-run volume.
// Document Provenance:
// - Source: product requirement for low-cost polling fallback
// - Kind: repo doc
// - Retrieved: 2026-04-10
// - Applied To: daily caps for mention replies and agent runs
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-farcaster-polling-agent-ingress.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
import cacheClient from '../../cache/cacheClient.js';

type QuotaMetric = 'messages' | 'agent_runs';

const DEFAULT_LIMITS: Record<QuotaMetric, number> = {
  messages: Number(process.env.FARCASTER_QUOTA_MESSAGES_PER_DAY || '100'),
  agent_runs: Number(process.env.FARCASTER_QUOTA_AGENT_RUNS_PER_DAY || '100'),
};

function quotaKey(userId: string, metric: QuotaMetric, dateUtc: string): string {
  return `farcasterquota:${dateUtc}:${userId}:${metric}`;
}

function currentDateUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function recordFarcasterQuotaMetric(params: {
  userId: string;
  metric: QuotaMetric;
  increment?: number;
}): Promise<{ allowed: boolean; used: number; limit: number; remaining: number }> {
  const increment = Math.max(1, Number(params.increment || 1));
  const limit = DEFAULT_LIMITS[params.metric];
  const key = quotaKey(params.userId, params.metric, currentDateUtc());
  const ttl = 24 * 60 * 60;

  const used = await cacheClient.incrBy(key, increment, ttl).catch(async () => {
    const next = increment;
    await cacheClient.set(key, String(next), ttl).catch(() => {});
    return next;
  });

  return {
    allowed: used <= limit,
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
}
