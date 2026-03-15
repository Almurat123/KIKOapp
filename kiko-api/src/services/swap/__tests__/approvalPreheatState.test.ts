import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { __approvalPreheatStateTest } from '../approvalPreheatState.js';

describe('approvalPreheatState', () => {
  test('builds a stable wallet-token-spender scoped key', () => {
    const key = __approvalPreheatStateTest.buildApprovalPreheatStateKey({
      chainId: 56,
      walletAddress: '0xa3864edce1b12345678901234567890123456789',
      tokenAddress: '0xeCCBb861c0dda7eFd964010085488B69317e4444',
      spenderAddress: '0x1111111111111111111111111111111111111111',
    });

    assert.equal(
      key,
      'copytrade:approval-preheat:v1:56:0xa3864edce1b12345678901234567890123456789:0xeccbb861c0dda7efd964010085488b69317e4444:0x1111111111111111111111111111111111111111'
    );
  });
});
