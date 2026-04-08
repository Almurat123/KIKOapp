import cacheClient from '../../cache/cacheClient.js';

type QuotaMetric = 'messages' | 'agent_runs' | 'trade_confirms';

const DEFAULT_LIMITS: Record<QuotaMetric, number> = {
  messages: Number(process.env.X_QUOTA_MESSAGES_PER_DAY || '100'),
  agent_runs: Number(process.env.X_QUOTA_AGENT_RUNS_PER_DAY || '100'),
  trade_confirms: Number(process.env.X_QUOTA_TRADE_CONFIRMS_PER_DAY || '20'),
};

function quotaKey(userId: string, metric: QuotaMetric, dateUtc: string): string {
  return `xquota:${dateUtc}:${userId}:${metric}`;
}

function currentDateUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function recordXQuotaMetric(params: {
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
