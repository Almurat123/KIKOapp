import assert from 'node:assert/strict';
import test from 'node:test';

import { runTurboCorrectFlow } from '../pipeline/turboCorrectFlow.js';
import type { HintedSourcePool } from '../../directSwapTypes.js';
import type { DirectSwapResult } from '../types.js';
import type { ResolvedPoolHint, TurboResolver } from '../turbo.js';

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout:${timeoutMs}`)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function buildSourceHint(poolAddress: string): HintedSourcePool {
  return {
    kind: 'v3',
    dex: 'uniswap',
    pool: {
      poolAddress,
      version: 'v3',
      dex: 'uniswap',
      fee: 500
    } as any
  };
}

function buildResolvedHint(poolAddress: string): ResolvedPoolHint {
  return {
    kind: 'v3',
    dex: 'uniswap',
    poolAddress,
    fee: 500
  };
}

function createBaseParams(overrides?: {
  earlyHintedPool?: HintedSourcePool | null;
  singlePoolResolver?: TurboResolver;
  tryResolvedPoolHintFastPath?: (
    params: any,
    hint: any,
    options?: { executionMode?: 'safe' | 'normal' | 'turbo'; trustedHint?: boolean }
  ) => Promise<DirectSwapResult | null>;
}): Parameters<typeof runTurboCorrectFlow>[0] {
  const now = Date.now();
  return {
    chainId: 8453,
    traceId: 'trace-test',
    swapStart: now,
    turboFastDeadline: now + 800,
    turboSinglePoolPhaseMs: 400,
    hintPoolTimeoutMs: 25,
    skipCandidateGateWithHint: false,
    buyLiqMultiplier: 1,
    normalizedTokenIn: '0x1111111111111111111111111111111111111111',
    poolTokenIn: '0x1111111111111111111111111111111111111111',
    poolTokenOut: '0x2222222222222222222222222222222222222222',
    amountInWei: 1_000_000n,
    hint: undefined,
    earlyHintedPool: overrides?.earlyHintedPool ?? null,
    normalizedParams: {
      userId: 'user-1',
      accessToken: 'token',
      walletAddress: '0x3333333333333333333333333333333333333333',
      tokenIn: '0x1111111111111111111111111111111111111111',
      tokenOut: '0x2222222222222222222222222222222222222222',
      amountIn: '1',
      amountInWei: 1_000_000n,
      chainId: 8453,
      slippageBps: 500
    },
    logger: {
      info: () => undefined,
      warn: () => undefined
    },
    withTimeout,
    resolveHintedPoolFromSourceTx: async () => null,
    getCachedSinglePoolWinnerHint: async () => null,
    singlePoolResolver: overrides?.singlePoolResolver ?? {
      resolveCandidates: async () => []
    },
    isBuySideStableOrNativeIn: () => false,
    findTokenPools: async () => [],
    evaluateResolvedHintFastPathLiquidityGateFromPools: () => ({
      allowed: true,
      reason: 'ok',
      blockType: 'none',
      poolCount: 0,
      matchingPoolCount: 0,
      matchingEligibleCount: 0,
      requiredReserveInWei: '0'
    }),
    tryResolvedPoolHintFastPath: overrides?.tryResolvedPoolHintFastPath ?? (async () => ({
      success: false,
      error: 'unexpected',
      provider: 'failed'
    })),
    shouldSkipResolvedHintRetry: () => false,
    shouldBypassTurboRescueForSinglePoolError: () => ({
      skip: false,
      reason: 'route_related_or_unknown',
      failureCode: 'unknown'
    }),
    sourceAnchorMinRatioBps: 7000,
    sourceAnchorMaxRatioBps: 13000,
    wrappedNativeAddress: '0x4200000000000000000000000000000000000006',
    getV4BestPoolQuote: async () => ({ pool: null, amountOut: 0n }),
    getV3BestQuoteOut: async () => 0n,
    getAerodromeExpectedOutput: async () => 0n,
    getV2ExpectedOutput: async () => 0n,
    runTurboRescue: async (reason: string) => ({
      success: false,
      error: `rescue:${reason}`,
      provider: 'failed'
    })
  };
}

test('runTurboCorrectFlow demotes a mismatched source hint and switches to the next candidate', async () => {
  const sourceHint = buildSourceHint('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  const fallbackCandidate = buildResolvedHint('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
  const callOrder: string[] = [];

  const result = await runTurboCorrectFlow(createBaseParams({
    earlyHintedPool: sourceHint,
    singlePoolResolver: {
      resolveCandidates: async () => [
        buildResolvedHint('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
        fallbackCandidate
      ]
    },
    tryResolvedPoolHintFastPath: async (_params, hint) => {
      const poolAddress = String(hint?.resolvedPoolHint?.poolAddress || '').toLowerCase();
      callOrder.push(poolAddress);
      if (poolAddress === '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa') {
        return {
          success: false,
          error: 'hint_pool_pair_mismatch:pool_pair_mismatch',
          provider: 'failed'
        };
      }
      return {
        success: true,
        txHash: '0xsuccess',
        provider: 'uniswap-v3'
      };
    }
  }));

  assert.equal(result.result.success, true);
  assert.equal(result.result.txHash, '0xsuccess');
  assert.equal(result.selectedResolvedHintForCache?.poolAddress, fallbackCandidate.poolAddress);
  assert.deepEqual(callOrder, [
    '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
  ]);
});

test('runTurboCorrectFlow times out a hung source fast path and still advances to the next candidate', async () => {
  const sourceHint = buildSourceHint('0xcccccccccccccccccccccccccccccccccccccccc');
  const fallbackCandidate = buildResolvedHint('0xdddddddddddddddddddddddddddddddddddddddd');
  const callOrder: string[] = [];

  const result = await runTurboCorrectFlow(createBaseParams({
    earlyHintedPool: sourceHint,
    singlePoolResolver: {
      resolveCandidates: async () => [
        buildResolvedHint('0xcccccccccccccccccccccccccccccccccccccccc'),
        fallbackCandidate
      ]
    },
    tryResolvedPoolHintFastPath: async (_params, hint) => {
      const poolAddress = String(hint?.resolvedPoolHint?.poolAddress || '').toLowerCase();
      callOrder.push(poolAddress);
      if (poolAddress === '0xcccccccccccccccccccccccccccccccccccccccc') {
        return await new Promise<DirectSwapResult | null>(() => undefined);
      }
      return {
        success: true,
        txHash: '0xrecovered',
        provider: 'uniswap-v3'
      };
    }
  }));

  assert.equal(result.result.success, true);
  assert.equal(result.result.txHash, '0xrecovered');
  assert.equal(result.selectedResolvedHintForCache?.poolAddress, fallbackCandidate.poolAddress);
  assert.deepEqual(callOrder, [
    '0xcccccccccccccccccccccccccccccccccccccccc',
    '0xdddddddddddddddddddddddddddddddddddddddd'
  ]);
});
