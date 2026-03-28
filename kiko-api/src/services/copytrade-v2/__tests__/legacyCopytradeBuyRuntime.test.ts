import assert from 'node:assert/strict';
import test from 'node:test';

import { processSingleUserBuy } from '../runtime/legacyCopytradeBuyRuntime.js';

test('legacy copytrade buy runtime advances canonical order when delay gate skips', async () => {
  const transitions: any[] = [];

  const result = await processSingleUserBuy({
    config: {
      id: 'config-1',
      userId: 'user-1',
      user: { walletAddress: '0xfollower', farcasterFid: null },
    },
    userSettings: null,
    targetWallet: '0xtarget',
    tokenToBuy: '0xtoken',
    swap: {
      txHash: '0xleader',
      tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      tokenOut: '0xtoken',
    },
    chainId: 8453,
    tokenInfo: {},
    targetSwapValueUsd: 1,
    strictTargetSwapValueUsd: 1,
    strictTargetSwapValueReliable: true,
    strictTargetSwapValueSource: 'test',
    strictMinGuardRequired: false,
    isFallbackMode: false,
    timing: {
      firstSeenAt: 1000,
      swapReadyAt: 1000,
      dispatchEligibleAt: 1000,
    },
  }, {
    withTradeLock: async (_key: string, fn: () => Promise<any>) => await fn(),
    resolveExecutionModeForConfig: () => 'turbo',
    resolveBuyGuardPolicy: () => ({ name: 'turbo' }),
    getPositionStatusCompat: async () => null,
    emitCopyTradeBuyGuardAudit: () => {},
    logger: { info: () => {}, error: () => {}, throttled: () => {}, warn: () => {} },
    LogCode: { EXE_QUOTE_FETCHED: 'EXE', WTC_TX_SKIPPED: 'SKIP', SYS_ERROR: 'ERR' },
    getCopyTradeDispatchTimingAnchor: () => ({ timestamp: 1000, delayAnchor: 'dispatch_eligible' }),
    isCopyTradeDelayExceeded: () => ({
      skip: true,
      delayMs: 13000,
      hardDelayMs: 13000,
      maxDelayMs: 12000,
      delayAnchor: 'dispatch_eligible',
      reasonCode: 'copytrade_delay_exceeded_dispatch',
    }),
    emitCopyTradeTimingAudit: () => {},
    isTokenLockedForUser: () => false,
    claimOrCreateCanonicalOrder: async () => ({ id: 'order-1' }),
    advanceCanonicalOrderState: async (params: any) => {
      transitions.push(params);
      return params;
    },
  } as any);

  assert.deepEqual(result, { outcome: 'skipped' });
  assert.equal(transitions.length, 1);
  assert.equal(transitions[0].lifecycleState, 'FAILED_TERMINAL');
  assert.equal(transitions[0].reasonCode, 'copytrade_delay_exceeded_dispatch');
  assert.equal(transitions[0].eventType, 'ORDER_BUY_SKIPPED');
});
