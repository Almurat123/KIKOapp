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

test('legacy copytrade buy runtime defers buy dispatch audit off the synchronous path', async () => {
  const deferred: Array<() => void> = [];
  const auditCalls: any[] = [];

  const result = await processSingleUserBuy({
    config: {
      id: 'config-2',
      userId: 'user-2',
      user: { walletAddress: '0xfollower', farcasterFid: null },
    },
    userSettings: null,
    targetWallet: '0xtarget',
    tokenToBuy: '0xtoken',
    swap: {
      txHash: '0xleader-2',
      tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      tokenOut: '0xtoken',
    },
    chainId: 56,
    tokenInfo: {},
    targetSwapValueUsd: 1,
    strictTargetSwapValueUsd: 1,
    strictTargetSwapValueReliable: true,
    strictTargetSwapValueSource: 'test',
    strictMinGuardRequired: false,
    isFallbackMode: false,
    timing: {
      firstSeenAt: Date.now() - 3000,
      swapReadyAt: Date.now() - 3000,
      dispatchEligibleAt: Date.now() - 2900,
    },
  }, {
    withTradeLock: async (_key: string, fn: () => Promise<any>) => await fn(),
    resolveExecutionModeForConfig: () => 'turbo',
    resolveBuyGuardPolicy: () => ({ name: 'turbo' }),
    getPositionStatusCompat: async () => null,
    emitCopyTradeBuyGuardAudit: () => {},
    logger: { info: () => {}, error: () => {}, throttled: () => {}, warn: () => {} },
    LogCode: { EXE_QUOTE_FETCHED: 'EXE', WTC_TX_SKIPPED: 'SKIP', SYS_ERROR: 'ERR' },
    getCopyTradeDispatchTimingAnchor: () => ({ timestamp: Date.now() - 2900, delayAnchor: 'dispatch_eligible' }),
    isCopyTradeDelayExceeded: () => ({
      skip: true,
      delayMs: 2900,
      hardDelayMs: 3000,
      maxDelayMs: 12000,
      delayAnchor: 'dispatch_eligible',
      reasonCode: 'copytrade_delay_exceeded_dispatch',
    }),
    emitCopyTradeTimingAudit: (...args: any[]) => {
      auditCalls.push(args);
    },
    deferTimingAudit: (fn: () => void) => {
      deferred.push(fn);
    },
    isTokenLockedForUser: () => false,
    claimOrCreateCanonicalOrder: async () => null,
    advanceCanonicalOrderState: async () => null,
  } as any);

  assert.deepEqual(result, { outcome: 'skipped' });
  assert.equal(auditCalls.length, 0);
  assert.equal(deferred.length, 1);

  deferred[0]!();

  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0][0], 'buy_dispatch_gate');
  assert.equal(auditCalls[0][2].delayMs, 2900);
  assert.equal(auditCalls[0][2].skip, true);
});

test('legacy copytrade buy runtime blocks recent same-token cooldown before pending position create', async () => {
  const transitions: any[] = [];
  const notifications: any[] = [];
  let exposurePreflightArgs: any = null;
  let duplicateWhereCalled = false;

  const result = await processSingleUserBuy({
    config: {
      id: 'config-cooldown',
      userId: 'user-cooldown',
      copyTradeTokenCooldownMinutes: 60,
      buyAmountUsd: 10,
      user: { walletAddress: '0xfollower', farcasterFid: null },
    },
    userSettings: null,
    targetWallet: '0xtarget',
    tokenToBuy: '0xtoken',
    swap: {
      txHash: '0xleader-cooldown',
      tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      tokenOut: '0xtoken',
    },
    chainId: 56,
    tokenInfo: { symbol: 'TOK', marketCap: 1, liquidity: 1 },
    targetSwapValueUsd: 5,
    strictTargetSwapValueUsd: 5,
    strictTargetSwapValueReliable: true,
    strictTargetSwapValueSource: 'test',
    strictMinGuardRequired: false,
    isFallbackMode: false,
  }, {
    withTradeLock: async (_key: string, fn: () => Promise<any>) => await fn(),
    resolveExecutionModeForConfig: () => 'normal',
    resolveBuyGuardPolicy: () => ({ name: 'normal' }),
    getPositionStatusCompat: async () => ({ lockStatuses: ['pending'] }),
    emitCopyTradeBuyGuardAudit: () => {},
    logger: { info: () => {}, error: () => {}, throttled: () => {}, warn: () => {} },
    LogCode: { EXE_QUOTE_FETCHED: 'EXE', WTC_TX_SKIPPED: 'SKIP', SYS_ERROR: 'ERR' },
    getCopyTradeDispatchTimingAnchor: () => ({ timestamp: Date.now(), delayAnchor: 'dispatch_eligible' }),
    isCopyTradeDelayExceeded: () => ({
      skip: false,
      delayMs: 0,
      hardDelayMs: 0,
      maxDelayMs: 12000,
      delayAnchor: 'dispatch_eligible',
    }),
    emitCopyTradeTimingAudit: () => {},
    isTokenLockedForUser: () => false,
    resolveCopytradeSlippageBps: () => 300,
    resolveEntryDeviationModePolicy: () => ({
      maxEntryDeviationBps: 1500,
      source: 'config_payload',
      reasonCode: 'entry_deviation_signed_payload',
      thresholdPolicy: 'normal_min_1500bps',
      modeFloorBps: 1500,
    }),
    resolveEffectivePositiveThreshold: (value: number) => value || 0,
    resolveEffectiveMinTargetValueUsd: () => 0,
    roundGuardNumber: (value: number) => value,
    shouldEnforceBuyGuard: () => false,
    sendNotificationAsync: (payload: any) => { notifications.push(payload); },
    buildCopyTradeNotificationEvidence: () => ({}),
    isBelowMinTargetValue: () => false,
    MAX_COPY_TRADE_USD: 1000,
    notificationService: { sendNotification: async () => null },
    describeCooldownMode: (minutes: number) => minutes > 0 ? 'recent_strategy_activity' : 'disabled',
    evaluateCopytradeExposurePreflight: async (params: any) => {
      exposurePreflightArgs = params;
      return {
        allowed: false,
        reasonCode: 'COOLDOWN_RECENT_STRATEGY_ACTIVITY',
        metrics: { recentCooldownPositionCount: 1, recentCooldownPositionIds: ['pos-1'] },
        exposure: { state: 'none', reasonCode: 'none', blockingPositions: [] },
      };
    },
    claimOrCreateCanonicalOrder: async () => ({ id: 'order-cooldown' }),
    advanceCanonicalOrderState: async (params: any) => {
      transitions.push(params);
      return params;
    },
    buildDuplicateTradeWhere: () => {
      duplicateWhereCalled = true;
      return {};
    },
  } as any);

  assert.deepEqual(result, { outcome: 'skipped' });
  assert.equal(duplicateWhereCalled, false);
  assert.equal(transitions.length, 1);
  assert.equal(transitions[0].reasonCode, 'cooldown_recent_strategy_activity');
  assert.equal(notifications.length, 1);
  assert.equal(exposurePreflightArgs.targetWallet, '0xtarget');
  assert.equal(exposurePreflightArgs.sourceTxHash, '0xleader-cooldown');
});

test('legacy copytrade buy runtime blocks active exposure before pending position create', async () => {
  const transitions: any[] = [];

  const result = await processSingleUserBuy({
    config: {
      id: 'config-active',
      userId: 'user-active',
      copyTradeTokenCooldownMinutes: 60,
      buyAmountUsd: 10,
      user: { walletAddress: '0xfollower', farcasterFid: null },
    },
    userSettings: null,
    targetWallet: '0xtarget',
    tokenToBuy: '0xtoken',
    swap: {
      txHash: '0xleader-active',
      tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      tokenOut: '0xtoken',
    },
    chainId: 56,
    tokenInfo: { symbol: 'TOK', marketCap: 1, liquidity: 1 },
    targetSwapValueUsd: 5,
    strictTargetSwapValueUsd: 5,
    strictTargetSwapValueReliable: true,
    strictTargetSwapValueSource: 'test',
    strictMinGuardRequired: false,
    isFallbackMode: false,
  }, {
    withTradeLock: async (_key: string, fn: () => Promise<any>) => await fn(),
    resolveExecutionModeForConfig: () => 'normal',
    resolveBuyGuardPolicy: () => ({ name: 'normal' }),
    getPositionStatusCompat: async () => ({ lockStatuses: ['pending'] }),
    emitCopyTradeBuyGuardAudit: () => {},
    logger: { info: () => {}, error: () => {}, throttled: () => {}, warn: () => {} },
    LogCode: { EXE_QUOTE_FETCHED: 'EXE', WTC_TX_SKIPPED: 'SKIP', SYS_ERROR: 'ERR' },
    getCopyTradeDispatchTimingAnchor: () => ({ timestamp: Date.now(), delayAnchor: 'dispatch_eligible' }),
    isCopyTradeDelayExceeded: () => ({
      skip: false,
      delayMs: 0,
      hardDelayMs: 0,
      maxDelayMs: 12000,
      delayAnchor: 'dispatch_eligible',
    }),
    emitCopyTradeTimingAudit: () => {},
    isTokenLockedForUser: () => false,
    resolveCopytradeSlippageBps: () => 300,
    resolveEntryDeviationModePolicy: () => ({
      maxEntryDeviationBps: 1500,
      source: 'config_payload',
      reasonCode: 'entry_deviation_signed_payload',
      thresholdPolicy: 'normal_min_1500bps',
      modeFloorBps: 1500,
    }),
    resolveEffectivePositiveThreshold: (value: number) => value || 0,
    resolveEffectiveMinTargetValueUsd: () => 0,
    roundGuardNumber: (value: number) => value,
    shouldEnforceBuyGuard: () => false,
    sendNotificationAsync: () => {},
    buildCopyTradeNotificationEvidence: () => ({}),
    isBelowMinTargetValue: () => false,
    MAX_COPY_TRADE_USD: 1000,
    notificationService: { sendNotification: async () => null },
    describeCooldownMode: (minutes: number) => minutes > 0 ? 'recent_strategy_activity' : 'disabled',
    evaluateCopytradeExposurePreflight: async () => ({
      allowed: false,
      reasonCode: 'ENTRY_POLICY_BLOCK_ACTIVE_EXPOSURE',
      metrics: { blockingPositionIds: ['pos-open-1'] },
      exposure: { state: 'open', reasonCode: 'has_open_positions', blockingPositions: [{ id: 'pos-open-1' }] },
    }),
    claimOrCreateCanonicalOrder: async () => ({ id: 'order-active' }),
    advanceCanonicalOrderState: async (params: any) => {
      transitions.push(params);
      return params;
    },
  } as any);

  assert.deepEqual(result, { outcome: 'skipped' });
  assert.equal(transitions.length, 1);
  assert.equal(transitions[0].reasonCode, 'entry_policy_block_active_exposure');
});
