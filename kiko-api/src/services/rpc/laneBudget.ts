import type { RpcExecutionLane } from './executionLane.js';

interface TokenBucketState {
  tokens: number;
  lastRefillAt: number;
}

interface SemaphoreState {
  inFlight: number;
  queue: Array<() => void>;
}

const tokenBuckets = new Map<string, TokenBucketState>();
const semaphores = new Map<string, SemaphoreState>();

const CHEAP_RPS_BUDGET = Math.max(1, Number(process.env.RPC_LANE_CHEAP_RPS_BUDGET || '10'));
const CRITICAL_RPS_BUDGET = Math.max(1, Number(process.env.RPC_LANE_CRITICAL_RPS_BUDGET || '30'));
const CHEAP_CONCURRENCY_BUDGET = Math.max(1, Number(process.env.RPC_LANE_CHEAP_CONCURRENCY_BUDGET || '12'));
const CRITICAL_CONCURRENCY_BUDGET = Math.max(1, Number(process.env.RPC_LANE_CRITICAL_CONCURRENCY_BUDGET || '32'));

function getLaneRpsBudget(lane: RpcExecutionLane): number {
  return lane === 'critical' ? CRITICAL_RPS_BUDGET : CHEAP_RPS_BUDGET;
}

function getLaneConcurrencyBudget(lane: RpcExecutionLane): number {
  return lane === 'critical' ? CRITICAL_CONCURRENCY_BUDGET : CHEAP_CONCURRENCY_BUDGET;
}

function getBucketState(key: string, maxTokens: number): TokenBucketState {
  const now = Date.now();
  let state = tokenBuckets.get(key);
  if (!state) {
    state = { tokens: maxTokens, lastRefillAt: now };
    tokenBuckets.set(key, state);
    return state;
  }

  const elapsedMs = Math.max(0, now - state.lastRefillAt);
  const refill = (elapsedMs / 1000) * maxTokens;
  if (refill > 0) {
    state.tokens = Math.min(maxTokens, state.tokens + refill);
    state.lastRefillAt = now;
  }
  return state;
}

async function waitForTokenBudget(key: string, lane: RpcExecutionLane): Promise<void> {
  const maxTokens = getLaneRpsBudget(lane);
  while (true) {
    const state = getBucketState(key, maxTokens);
    if (state.tokens >= 1) {
      state.tokens -= 1;
      return;
    }
    const deficit = 1 - state.tokens;
    const waitMs = Math.max(25, Math.ceil((deficit / maxTokens) * 1000));
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

function getSemaphoreState(key: string): SemaphoreState {
  let state = semaphores.get(key);
  if (!state) {
    state = { inFlight: 0, queue: [] };
    semaphores.set(key, state);
  }
  return state;
}

async function withSemaphore<T>(key: string, limit: number, fn: () => Promise<T>): Promise<T> {
  const state = getSemaphoreState(key);
  if (state.inFlight >= limit) {
    await new Promise<void>((resolve) => state.queue.push(resolve));
  }

  state.inFlight += 1;
  try {
    return await fn();
  } finally {
    state.inFlight = Math.max(0, state.inFlight - 1);
    const next = state.queue.shift();
    if (next) next();
  }
}

export async function withRpcLaneBudget<T>(params: {
  chainId: number;
  lane: RpcExecutionLane;
  fn: () => Promise<T>;
}): Promise<T> {
  const laneKey = `${params.chainId}:${params.lane}`;
  await waitForTokenBudget(`bucket:${laneKey}`, params.lane);
  return await withSemaphore(
    `semaphore:${laneKey}`,
    getLaneConcurrencyBudget(params.lane),
    params.fn
  );
}

