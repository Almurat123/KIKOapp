import assert from 'node:assert/strict';
import test from 'node:test';

import { runTurboCorrectFlow } from '../pipeline/turboCorrectFlow.js';
import type { HintedSourcePool } from '../../directSwapTypes.js';
import type { DirectSwapResult } from '../types.js';
import type { ResolvedPoolHint, TurboResolver } from '../turbo.js';
import { evaluateDirectSwapSendGuard } from '../pipeline/directSwapAttemptGuard.js';

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
  runtimeContext?: any;
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
      slippageBps: 500,
      runtimeContext: overrides?.runtimeContext
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

test('runTurboCorrectFlow times out a hung source fast path and halts before another attempt', async () => {
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

  assert.equal(result.result.success, false);
  assert.equal(result.result.error, 'hint_fast_path_timeout');
  assert.equal(result.selectedResolvedHintForCache?.poolAddress, sourceHint.pool.poolAddress);
  assert.deepEqual(callOrder, ['0xcccccccccccccccccccccccccccccccccccccccc']);
});

test('runTurboCorrectFlow waits for late-settling source fast path before falling back', async () => {
  const sourceHint = buildSourceHint('0xccccccccccccccccccccccccccccccccccccccce');
  const fallbackCandidate = buildResolvedHint('0xddddddddddddddddddddddddddddddddddddddde');
  const callOrder: string[] = [];

  const result = await runTurboCorrectFlow(createBaseParams({
    earlyHintedPool: sourceHint,
    singlePoolResolver: {
      resolveCandidates: async () => [
        buildResolvedHint('0xccccccccccccccccccccccccccccccccccccccce'),
        fallbackCandidate
      ]
    },
    tryResolvedPoolHintFastPath: async (_params, hint) => {
      const poolAddress = String(hint?.resolvedPoolHint?.poolAddress || '').toLowerCase();
      callOrder.push(poolAddress);
      if (poolAddress === '0xccccccccccccccccccccccccccccccccccccccce') {
        await new Promise((resolve) => setTimeout(resolve, 40));
        return {
          success: true,
          txHash: '0xlate-settle',
          provider: 'uniswap-v3'
        };
      }
      return {
        success: true,
        txHash: '0xshould-not-run',
        provider: 'uniswap-v3'
      };
    }
  }));

  assert.equal(result.result.success, true);
  assert.equal(result.result.txHash, '0xlate-settle');
  assert.deepEqual(callOrder, ['0xccccccccccccccccccccccccccccccccccccccce']);
});

test('runTurboCorrectFlow halts after an ambiguous fast-path timeout instead of sending another attempt', async () => {
  const sourceHint = buildSourceHint('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');
  const callOrder: string[] = [];

  const result = await runTurboCorrectFlow(createBaseParams({
    earlyHintedPool: sourceHint,
    singlePoolResolver: {
      resolveCandidates: async () => [
        buildResolvedHint('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'),
        buildResolvedHint('0xffffffffffffffffffffffffffffffffffffffff')
      ]
    },
    tryResolvedPoolHintFastPath: async (_params, hint) => {
      const poolAddress = String(hint?.resolvedPoolHint?.poolAddress || '').toLowerCase();
      callOrder.push(poolAddress);
      if (poolAddress === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
        return {
          success: false,
          error: 'hint_fast_path_timeout',
          provider: 'failed'
        };
      }
      return {
        success: true,
        txHash: '0xshould-not-send',
        provider: 'uniswap-v3'
      };
    }
  }));

  assert.equal(result.result.success, false);
  assert.equal(result.result.error, 'hint_fast_path_timeout');
  assert.deepEqual(callOrder, ['0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee']);
});

test('runTurboCorrectFlow converts a timed-out send_started attempt into an inflight halt', async () => {
  const sourceHint = buildSourceHint('0xabababababababababababababababababababab');
  const runtimeContext = {
    state: 'send_started',
    lastLifecycle: {
      status: 'broadcasted_unseen',
      txHash: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      attempts: 1,
      chainId: 8453
    },
    attempts: [
      {
        id: 'attempt-1',
        state: 'sending'
      }
    ]
  };
  const callOrder: string[] = [];

  const result = await runTurboCorrectFlow(createBaseParams({
    earlyHintedPool: sourceHint,
    runtimeContext,
    singlePoolResolver: {
      resolveCandidates: async () => [
        buildResolvedHint('0xabababababababababababababababababababab'),
        buildResolvedHint('0xcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd')
      ]
    },
    tryResolvedPoolHintFastPath: async (_params, hint) => {
      const poolAddress = String(hint?.resolvedPoolHint?.poolAddress || '').toLowerCase();
      callOrder.push(poolAddress);
      if (poolAddress === '0xabababababababababababababababababababab') {
        return await new Promise<DirectSwapResult | null>(() => undefined);
      }
      return {
        success: true,
        txHash: '0xshould-not-run',
        provider: 'uniswap-v3'
      };
    }
  }));

  assert.equal(result.result.success, false);
  assert.equal(result.result.error, 'direct_swap_send_inflight:send_started');
  assert.equal(result.result.txHash, '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc');
  assert.deepEqual(callOrder, ['0xabababababababababababababababababababab']);
});

test('runTurboCorrectFlow halts after source direct attempt already has send-started evidence', async () => {
  const sourceHint = buildSourceHint('0x1111111111111111111111111111111111111110');
  const callOrder: string[] = [];

  const result = await runTurboCorrectFlow(createBaseParams({
    earlyHintedPool: sourceHint,
    singlePoolResolver: {
      resolveCandidates: async () => [
        buildResolvedHint('0x1111111111111111111111111111111111111110'),
        buildResolvedHint('0x2222222222222222222222222222222222222220')
      ]
    },
    tryResolvedPoolHintFastPath: async (_params, hint) => {
      const poolAddress = String(hint?.resolvedPoolHint?.poolAddress || '').toLowerCase();
      callOrder.push(poolAddress);
      if (poolAddress === '0x1111111111111111111111111111111111111110') {
        return {
          success: false,
          error: 'failed_to_send_transaction:broadcasted_unseen',
          provider: 'failed',
          txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          txLifecycle: {
            status: 'broadcasted_unseen',
            txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            chainId: 8453,
            attempts: 1,
          } as any,
          runtimeContext: {
            state: 'send_started',
            canonicalTxHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            attempts: [{ state: 'sending' }],
            lastLifecycle: { status: 'broadcasted_unseen' },
          } as any,
        };
      }
      return {
        success: true,
        txHash: '0xshould-not-run',
        provider: 'uniswap-v3'
      };
    }
  }));

  assert.equal(result.result.success, false);
  assert.equal(result.result.error, 'failed_to_send_transaction:broadcasted_unseen');
  assert.deepEqual(callOrder, ['0x1111111111111111111111111111111111111110']);
});

test('runTurboCorrectFlow halts after candidate attempt already has visible tx evidence', async () => {
  const sourceHint = buildSourceHint('0x3333333333333333333333333333333333333330');
  const callOrder: string[] = [];

  const result = await runTurboCorrectFlow(createBaseParams({
    earlyHintedPool: sourceHint,
    singlePoolResolver: {
      resolveCandidates: async () => [
        buildResolvedHint('0x3333333333333333333333333333333333333330'),
        buildResolvedHint('0x4444444444444444444444444444444444444440'),
        buildResolvedHint('0x5555555555555555555555555555555555555550')
      ]
    },
    tryResolvedPoolHintFastPath: async (_params, hint) => {
      const poolAddress = String(hint?.resolvedPoolHint?.poolAddress || '').toLowerCase();
      callOrder.push(poolAddress);
      if (poolAddress === '0x3333333333333333333333333333333333333330') {
        return {
          success: false,
          error: 'hint_pool_pair_mismatch:pool_pair_mismatch',
          provider: 'failed'
        };
      }
      if (poolAddress === '0x4444444444444444444444444444444444444440') {
        return {
          success: false,
          error: 'failed_to_send_transaction:visible_pending',
          provider: 'failed',
          txHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          txLifecycle: {
            status: 'visible_pending',
            txHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            chainId: 8453,
            attempts: 1,
          } as any,
          runtimeContext: {
            state: 'hash_accepted',
            canonicalTxHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            attempts: [{ state: 'accepted' }],
            lastLifecycle: { status: 'visible_pending' },
          } as any,
        };
      }
      return {
        success: true,
        txHash: '0xshould-not-run',
        provider: 'uniswap-v3'
      };
    }
  }));

  assert.equal(result.result.success, false);
  assert.equal(result.result.error, 'failed_to_send_transaction:visible_pending');
  assert.deepEqual(callOrder, [
    '0x3333333333333333333333333333333333333330',
    '0x4444444444444444444444444444444444444440'
  ]);
});

test('direct swap send guard blocks additional send when runtime is already send_started', () => {
  const decision = evaluateDirectSwapSendGuard({
    runtimeContext: {
      state: 'send_started',
      canonicalTxHash: undefined,
      lastLifecycle: { status: 'broadcasted_unseen' },
      attempts: [{ state: 'sending' }],
    } as any,
  });

  assert.equal(decision.blocked, true);
  assert.equal(decision.reasonCode, 'send_started');
});
