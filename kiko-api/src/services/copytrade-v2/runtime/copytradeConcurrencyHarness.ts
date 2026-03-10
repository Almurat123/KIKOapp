import { __resetChainSendLimiterForTests, getChainSendLimiterSnapshot, withChainSendLimiter } from '../../privyChainSendLimiter.js';
import {
  __resetUserTransactionSchedulerForTests,
  withUserTransactionLock,
} from '../../privyWalletQueue.js';
import {
  __resetCopytradeTradeLocksForTests,
  buildCopytradeTradeScopeKey,
  withCopytradeTradeLock,
} from './copytradeTradeLocks.js';

export type HarnessOrderKind = 'buy' | 'sell' | 'approval' | 'fee';

export type HarnessOrder = {
  id: string;
  userId: string;
  chainId: number;
  tokenAddress: string;
  kind: HarnessOrderKind;
  scheduledAtMs: number;
  txDurationMs: number;
  preTxDelayMs?: number;
};

export type HarnessScenario = {
  orders: HarnessOrder[];
};

export type HarnessOrderResult = {
  id: string;
  userId: string;
  chainId: number;
  tokenAddress: string;
  kind: HarnessOrderKind;
  scheduledAtMs: number;
  startedAtMs: number;
  completedAtMs: number;
  tradeLockWaitMs: number;
  userQueueWaitMs: number;
  chainLimiterWaitMs: number;
  totalLatencyMs: number;
};

export type HarnessSummary = {
  orderCount: number;
  users: number;
  chains: number[];
  maxTotalLatencyMs: number;
  avgTotalLatencyMs: number;
  maxTradeLockWaitMs: number;
  maxUserQueueWaitMs: number;
  maxChainLimiterWaitMs: number;
  blockedByTradeLock: number;
  blockedByUserQueue: number;
  blockedByChainLimiter: number;
  perChain: Array<{
    chainId: number;
    orders: number;
    maxLatencyMs: number;
    avgLatencyMs: number;
    limiterLimit: number;
  }>;
  results: HarnessOrderResult[];
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function txPurposeFor(kind: HarnessOrderKind): 'trade' | 'approval' | 'fee' | 'other' {
  switch (kind) {
    case 'buy':
    case 'sell':
      return 'trade';
    case 'approval':
      return 'approval';
    case 'fee':
      return 'fee';
    default:
      return 'other';
  }
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export async function runCopytradeConcurrencyHarness(scenario: HarnessScenario): Promise<HarnessSummary> {
  __resetCopytradeTradeLocksForTests();
  __resetUserTransactionSchedulerForTests();
  __resetChainSendLimiterForTests();

  const startedAt = Date.now();
  const results: HarnessOrderResult[] = [];

  await Promise.all(
    scenario.orders.map(async (order) => {
      await sleep(Math.max(0, order.scheduledAtMs));

      const localStartedAt = Date.now();
      const tradeLockEntered = async () => {
        const afterTradeLock = Date.now();
        if (order.preTxDelayMs && order.preTxDelayMs > 0) {
          await sleep(order.preTxDelayMs);
        }
        const beforeUserQueue = Date.now();
        return await withUserTransactionLock({
          userId: order.userId,
          chainId: order.chainId,
          tx: { txPurpose: txPurposeFor(order.kind) },
          fn: async () => {
            const afterUserQueue = Date.now();
            const beforeChainLimiter = Date.now();
            return await withChainSendLimiter(order.chainId, async () => {
              const afterChainLimiter = Date.now();
              await sleep(order.txDurationMs);
              const completedAt = Date.now();
              results.push({
                id: order.id,
                userId: order.userId,
                chainId: order.chainId,
                tokenAddress: order.tokenAddress,
                kind: order.kind,
                scheduledAtMs: order.scheduledAtMs,
                startedAtMs: localStartedAt - startedAt,
                completedAtMs: completedAt - startedAt,
                tradeLockWaitMs: afterTradeLock - localStartedAt,
                userQueueWaitMs: afterUserQueue - beforeUserQueue,
                chainLimiterWaitMs: afterChainLimiter - beforeChainLimiter,
                totalLatencyMs: completedAt - localStartedAt,
              });
            });
          },
        });
      };

      if (order.kind === 'buy') {
        await withCopytradeTradeLock(
          buildCopytradeTradeScopeKey(order.userId, order.chainId, order.tokenAddress),
          tradeLockEntered
        );
        return;
      }

      await tradeLockEntered();
    })
  );

  results.sort((left, right) => left.id.localeCompare(right.id));
  const perChainMap = new Map<number, HarnessOrderResult[]>();
  for (const result of results) {
    const bucket = perChainMap.get(result.chainId) || [];
    bucket.push(result);
    perChainMap.set(result.chainId, bucket);
  }

  return {
    orderCount: results.length,
    users: new Set(results.map((result) => result.userId)).size,
    chains: Array.from(perChainMap.keys()).sort((a, b) => a - b),
    maxTotalLatencyMs: Math.max(0, ...results.map((result) => result.totalLatencyMs)),
    avgTotalLatencyMs: average(results.map((result) => result.totalLatencyMs)),
    maxTradeLockWaitMs: Math.max(0, ...results.map((result) => result.tradeLockWaitMs)),
    maxUserQueueWaitMs: Math.max(0, ...results.map((result) => result.userQueueWaitMs)),
    maxChainLimiterWaitMs: Math.max(0, ...results.map((result) => result.chainLimiterWaitMs)),
    blockedByTradeLock: results.filter((result) => result.tradeLockWaitMs > 0).length,
    blockedByUserQueue: results.filter((result) => result.userQueueWaitMs > 0).length,
    blockedByChainLimiter: results.filter((result) => result.chainLimiterWaitMs > 0).length,
    perChain: Array.from(perChainMap.entries())
      .map(([chainId, chainResults]) => ({
        chainId,
        orders: chainResults.length,
        maxLatencyMs: Math.max(0, ...chainResults.map((result) => result.totalLatencyMs)),
        avgLatencyMs: average(chainResults.map((result) => result.totalLatencyMs)),
        limiterLimit: getChainSendLimiterSnapshot(chainId).limit,
      }))
      .sort((left, right) => left.chainId - right.chainId),
    results,
  };
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let next = Math.imul(t ^ (t >>> 15), 1 | t);
    next ^= next + Math.imul(next ^ (next >>> 7), 61 | next);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildSyntheticHarnessScenario(params?: {
  users?: number;
  ordersPerUser?: number;
  chains?: number[];
  seed?: number;
  baseSpacingMs?: number;
}): HarnessScenario {
  const users = Math.max(1, params?.users || 20);
  const ordersPerUser = Math.max(1, params?.ordersPerUser || 8);
  const chains = params?.chains && params.chains.length > 0 ? params.chains : [56, 8453, 1, 900];
  const seed = params?.seed || 42;
  const baseSpacingMs = Math.max(0, params?.baseSpacingMs || 15);
  const random = mulberry32(seed);
  const orders: HarnessOrder[] = [];

  for (let userIndex = 0; userIndex < users; userIndex += 1) {
    const userId = `user-${userIndex + 1}`;
    for (let orderIndex = 0; orderIndex < ordersPerUser; orderIndex += 1) {
      const chainId = chains[Math.floor(random() * chains.length)]!;
      const sameTokenBucket = orderIndex % 3;
      const tokenAddress = `0xtoken${sameTokenBucket.toString(16).padStart(2, '0')}`;
      const kindRoll = random();
      const kind: HarnessOrderKind =
        kindRoll < 0.55 ? 'buy' : kindRoll < 0.8 ? 'sell' : kindRoll < 0.92 ? 'approval' : 'fee';
      const scheduledAtMs = Math.floor((userIndex * 2 + orderIndex) * baseSpacingMs * random());
      const preTxDelayMs = kind === 'buy' ? Math.floor(3 + random() * 10) : kind === 'sell' ? Math.floor(2 + random() * 6) : 0;
      const txDurationMs =
        kind === 'approval' ? Math.floor(12 + random() * 12)
          : kind === 'fee' ? Math.floor(6 + random() * 6)
            : Math.floor(20 + random() * 30);
      orders.push({
        id: `${userId}-${orderIndex + 1}`,
        userId,
        chainId,
        tokenAddress,
        kind,
        scheduledAtMs,
        preTxDelayMs,
        txDurationMs,
      });
    }
  }

  return { orders };
}
