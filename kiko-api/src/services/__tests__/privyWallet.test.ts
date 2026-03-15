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
