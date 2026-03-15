import { redis } from '../../../cache/cacheClient.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';

const EXIT_INTENT_QUEUE_PREFIX = 'copytrade:exit-intent-queue:v1';

const KNOWN_LANES = [
  'evm-exit',
  'solana-exit',
  'confirmation-reconcile',
] as const;

function canUseRedisQueue(): boolean {
  const client = redis as any;
  return !!client && !!client.isOpen && !!client.isReady;
}

function laneQueueKey(lane: string): string {
  return `${EXIT_INTENT_QUEUE_PREFIX}:${lane}`;
}

export async function scheduleExitIntentQueueEntry(params: {
  intentId: string;
  lane: string;
  notBefore?: Date | null;
}): Promise<boolean> {
  if (!canUseRedisQueue()) return false;
  const client = redis as any;
  const score = params.notBefore instanceof Date
    ? params.notBefore.getTime()
    : Date.now();
  try {
    await client.zAdd(laneQueueKey(params.lane), [{
      score,
      value: params.intentId,
    }]);
    return true;
  } catch (error: any) {
    logger.warn(LogCode.SYS_ERROR, '[CopyTradeExitIntentQueue] schedule failed', {
      lane: params.lane,
      intentId: params.intentId,
      error: error?.message || String(error),
    });
    return false;
  }
}

export async function removeExitIntentQueueEntry(params: {
  intentId: string;
  lane?: string | null;
}): Promise<void> {
  if (!canUseRedisQueue()) return;
  const client = redis as any;
  const lanes = params.lane ? [params.lane] : [...KNOWN_LANES];
  try {
    await Promise.all(lanes.map((lane) => client.zRem(laneQueueKey(lane), params.intentId)));
  } catch (error: any) {
    logger.warn(LogCode.SYS_ERROR, '[CopyTradeExitIntentQueue] remove failed', {
      lane: params.lane || null,
      intentId: params.intentId,
      error: error?.message || String(error),
    });
  }
}

export async function claimQueuedExitIntentIds(params: {
  lane: string;
  limit: number;
  nowMs?: number;
}): Promise<string[] | null> {
  if (!canUseRedisQueue()) return null;
  const client = redis as any;
  const nowMs = Number(params.nowMs || Date.now());
  const limit = Math.max(1, Number(params.limit || 1));
  try {
    const result = await client.eval(
      `
        local ids = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1], 'LIMIT', 0, ARGV[2])
        if (#ids == 0) then
          return ids
        end
        for i = 1, #ids do
          redis.call('ZREM', KEYS[1], ids[i])
        end
        return ids
      `,
      {
        keys: [laneQueueKey(params.lane)],
        arguments: [String(nowMs), String(limit)],
      }
    );
    return Array.isArray(result)
      ? result.map((entry: unknown) => String(entry || '').trim()).filter(Boolean)
      : [];
  } catch (error: any) {
    logger.warn(LogCode.SYS_ERROR, '[CopyTradeExitIntentQueue] claim failed', {
      lane: params.lane,
      limit,
      error: error?.message || String(error),
    });
    return null;
  }
}

export const __testOnly = {
  laneQueueKey,
};
