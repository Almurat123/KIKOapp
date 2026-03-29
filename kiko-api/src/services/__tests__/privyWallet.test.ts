import assert from 'node:assert/strict';
import test from 'node:test';

import { __privyWalletTest } from '../privyWallet.js';

test('approval txs return accepted lifecycle immediately after tx hash', () => {
  assert.equal(__privyWalletTest.shouldReturnAcceptedLifecycleImmediately({
    to: '0xto',
    data: '0x1234',
    value: '0',
    chainId: 8453,
    txPurpose: 'approval',
  }), true);
});

test('fast trade txs return accepted lifecycle immediately after tx hash', () => {
  assert.equal(__privyWalletTest.shouldReturnAcceptedLifecycleImmediately({
    to: '0xto',
    data: '0x1234',
    value: '0',
    chainId: 8453,
    txPurpose: 'trade',
    executionProfile: 'base-sniper',
  }), true);
});

test('default trade txs keep synchronous lifecycle gating', () => {
  assert.equal(__privyWalletTest.shouldReturnAcceptedLifecycleImmediately({
    to: '0xto',
    data: '0x1234',
    value: '0',
    chainId: 8453,
    txPurpose: 'trade',
  }), false);
});

test('fallback-owned runtime states are recognized for loser-send suppression', () => {
  assert.equal(__privyWalletTest.isFallbackOwnedRuntimeState({ state: 'fallback_started' } as any), true);
  assert.equal(__privyWalletTest.isFallbackOwnedRuntimeState({ state: 'fallback_succeeded' } as any), true);
  assert.equal(__privyWalletTest.isFallbackOwnedRuntimeState({ state: 'failed' } as any), false);
});

test('fallback ownership suppresses only non-fallback branches', () => {
  const runtimeContext = { state: 'fallback_started' } as any;
  assert.equal(__privyWalletTest.shouldSuppressSendForFallbackOwnership({
    runtimeContext,
    executionBranch: 'primary',
  }), true);
  assert.equal(__privyWalletTest.shouldSuppressSendForFallbackOwnership({
    runtimeContext,
    executionBranch: 'fallback',
  }), false);
});
