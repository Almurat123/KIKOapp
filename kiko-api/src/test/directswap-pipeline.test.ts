import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  capReferenceQuoteByMaxInput,
  computeMinReasonable
} from '../services/dex/directSwap/pipeline/referenceGate.js';
import {
  hasTurboBudget,
  summarizeTurboCandidateKinds
} from '../services/dex/directSwap/pipeline/turboFlow.js';
import {
  getResolvedHintKey,
  isResolvedHintPresent,
  runResolvedHintFastPathFlow
} from '../services/dex/directSwap/pipeline/resolvedHintFastPath.js';

describe('directSwap pipeline: reference gate', () => {
  test('computeMinReasonable clamps by bps', () => {
    assert.equal(computeMinReasonable(1000n, 1500), 850n);
    assert.equal(computeMinReasonable(1000n, -100), 1000n);
    assert.equal(computeMinReasonable(1000n, 9000), 500n);
  });

  test('capReferenceQuoteByMaxInput caps abnormal quote', () => {
    const capped = capReferenceQuoteByMaxInput({ referenceQuote: 2_000_000n, amountInWei: 1n });
    assert.equal(capped.capped, true);
    assert.equal(capped.quote, 0n);

    const normal = capReferenceQuoteByMaxInput({ referenceQuote: 100n, amountInWei: 1n });
    assert.equal(normal.capped, false);
    assert.equal(normal.quote, 100n);
  });
});

describe('directSwap pipeline: turbo utils', () => {
  test('summarizeTurboCandidateKinds aggregates counts', () => {
    const stats = summarizeTurboCandidateKinds([
      { kind: 'v4' },
      { kind: 'v3' },
      { kind: 'v4' }
    ]);
    assert.deepEqual(stats, { v4: 2, v3: 1 });
  });

  test('hasTurboBudget checks remaining ms', () => {
    assert.equal(hasTurboBudget(1000, 850, 80), true);
    assert.equal(hasTurboBudget(1000, 930, 80), false);
  });
});

describe('directSwap pipeline: resolved hint flow', () => {
  const logger = {
    info: () => undefined,
    warn: () => undefined
  };

  const fastPathDeps = {
    logger,
    callRpc: (async () => '0x') as any,
    executeV2Swap: async () => ({ success: true, provider: 'uniswap-v2' as const }),
    executeV3Swap: async () => ({ success: true, provider: 'uniswap-v3' as const }),
    executeV4Swap: async () => ({ success: true, provider: 'uniswap-v4' as const }),
    executeAerodromeSwap: async () => ({ success: true, provider: 'aerodrome' as const }),
    getV2ExpectedOutput: async () => 1n,
    wrappedNativeByChain: { 8453: '0x4200000000000000000000000000000000000006' },
    sourceAnchorMinRatioBps: 7000
  };

  const base = {
    swapStart: Date.now(),
    chainId: 8453,
    traceId: 't',
    requestedMode: 'turbo' as const,
    turboMode: true,
    normalizedTokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    poolTokenIn: '0x4200000000000000000000000000000000000006',
    poolTokenOut: '0x1111111111111111111111111111111111111111',
    amountInWei: 1n,
    normalizedParams: {
      userId: 'u',
      accessToken: 'a',
      walletAddress: '0x2222222222222222222222222222222222222222',
      tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      tokenOut: '0x1111111111111111111111111111111111111111',
      amountIn: '1',
      amountInWei: 1n,
      chainId: 8453,
      slippageBps: 500
    },
    turboFastDeadline: Date.now() + 1000,
    turboFastpathBudgetMs: 900,
    hintPoolTimeoutMs: 400,
    liquidityMultiplier: 100,
    fastPathDeps
  };

  test('no resolved hint: no-op result', async () => {
    const out = await runResolvedHintFastPathFlow({
      ...base,
      hint: undefined,
      deps: {
        logger,
        tryResolvedPoolHintFastPath: async () => null,
        isHintFastPathEligible: () => ({ eligible: false, hopCount: 0 }),
        evaluateResolvedHintFastPathLiquidityGate: async () => ({
          allowed: false,
          reason: 'none',
          blockType: 'none',
          poolCount: 0,
          matchingPoolCount: 0,
          matchingEligibleCount: 0,
          requiredReserveInWei: '0'
        }),
        isBuySideStableOrNativeIn: () => false,
        shouldSkipResolvedHintRetry: () => true,
        isTurboBudgetExceeded: () => false
      }
    });

    assert.equal(out.result, undefined);
    assert.equal(out.resolvedHintFastPathSkipped, false);
    assert.equal(out.resolvedHintFastPathFailed, false);
  });

  test('ineligible hint marks skipped', async () => {
    const out = await runResolvedHintFastPathFlow({
      ...base,
      hint: {
        resolvedPoolHint: {
          kind: 'v4',
          dex: 'uniswap',
          poolAddress: '0x3333333333333333333333333333333333333333',
          v4PoolKey: {
            currency0: '0x4200000000000000000000000000000000000006',
            currency1: '0x1111111111111111111111111111111111111111',
            hooks: '0x0000000000000000000000000000000000000000',
            poolManager: '0x0000000000000000000000000000000000000000',
            fee: 3000,
            tickSpacing: 60
          }
        }
      },
      deps: {
        logger,
        tryResolvedPoolHintFastPath: async () => null,
        isHintFastPathEligible: () => ({ eligible: false, reason: 'route_ctx', hopCount: 2 }),
        evaluateResolvedHintFastPathLiquidityGate: async () => ({
          allowed: true,
          reason: 'ok',
          blockType: 'none',
          poolCount: 0,
          matchingPoolCount: 0,
          matchingEligibleCount: 0,
          requiredReserveInWei: '0'
        }),
        isBuySideStableOrNativeIn: () => false,
        shouldSkipResolvedHintRetry: () => true,
        isTurboBudgetExceeded: () => false
      }
    });

    assert.equal(out.resolvedHintFastPathSkipped, true);
    assert.equal(out.result, undefined);
  });

  test('failed fast-path + exhausted budget returns explainable failure', async () => {
    const out = await runResolvedHintFastPathFlow({
      ...base,
      hint: {
        resolvedPoolHint: {
          kind: 'v4',
          dex: 'uniswap',
          poolAddress: '0x3333333333333333333333333333333333333333',
          v4PoolKey: {
            currency0: '0x4200000000000000000000000000000000000006',
            currency1: '0x1111111111111111111111111111111111111111',
            hooks: '0x0000000000000000000000000000000000000000',
            poolManager: '0x0000000000000000000000000000000000000000',
            fee: 3000,
            tickSpacing: 60
          }
        }
      },
      deps: {
        logger,
        tryResolvedPoolHintFastPath: async () => ({ success: false, provider: 'failed', error: 'any_fail' }),
        isHintFastPathEligible: () => ({ eligible: true, hopCount: 1 }),
        evaluateResolvedHintFastPathLiquidityGate: async () => ({
          allowed: true,
          reason: 'ok',
          blockType: 'none',
          poolCount: 1,
          matchingPoolCount: 1,
          matchingEligibleCount: 1,
          requiredReserveInWei: '1'
        }),
        isBuySideStableOrNativeIn: () => false,
        shouldSkipResolvedHintRetry: () => true,
        isTurboBudgetExceeded: () => true
      }
    });

    assert.equal(out.resolvedHintFastPathFailed, true);
    assert.equal(out.result?.success, false);
    assert.match(String(out.result?.error), /Fast-path budget exceeded/);
  });

  test('resolved hint key utilities', () => {
    const hint = {
      resolvedPoolHint: {
        kind: 'v2' as const,
        dex: 'uniswap' as const,
        poolAddress: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
      }
    };
    assert.equal(isResolvedHintPresent(hint), true);
    assert.equal(getResolvedHintKey(hint), 'v2:uniswap:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    assert.equal(getResolvedHintKey(undefined), 'none');
  });
});
