import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { prioritizeCopyTradePendingChains } from '../services/copytrade/eth/ethSignalPolicy.js';
import { resolveEthCopytradeRelayPolicy } from '../services/copytrade/eth/ethRelayPolicy.js';
import { resolveEthCopytradeFeePolicy } from '../services/copytrade/eth/ethFeePolicy.js';

describe('copytrade eth execution policy', () => {
  test('prioritizes ethereum pending polling ahead of other chains', () => {
    assert.deepEqual(prioritizeCopyTradePendingChains([8453, 56, 1, 10]), [1, 10, 56, 8453]);
  });

  test('enables private relay for eth copytrade regardless of execution mode', () => {
    assert.deepEqual(
      resolveEthCopytradeRelayPolicy({ chainId: 1, mode: 'copytrade', executionMode: 'turbo' }),
      {
        mevProtection: true,
        reasonCode: 'ETH_PRIVATE_RELAY_ENABLED',
      },
    );
  });

  test('keeps default relay policy outside eth copytrade', () => {
    assert.deepEqual(
      resolveEthCopytradeRelayPolicy({ chainId: 8453, mode: 'copytrade', executionMode: 'turbo' }),
      {
        mevProtection: false,
        reasonCode: 'DEFAULT_RELAY_POLICY',
      },
    );
  });

  test('uses aggressive fee policy for eth copytrade', () => {
    const policy = resolveEthCopytradeFeePolicy({ chainId: 1, mode: 'copytrade', executionMode: 'turbo' });
    assert.equal(policy.reasonCode, 'ETH_FEE_POLICY_AGGRESSIVE');
    assert.equal(policy.speedUpAfterMs, 900);
    assert.equal(policy.speedUpBumpBps, 26000);
    assert.equal(policy.priorityMultiplierBps, 30000);
    assert.equal(policy.minPriorityFeeWei, 2_000_000_000n);
  });

  test('keeps default fee policy outside eth copytrade', () => {
    assert.deepEqual(
      resolveEthCopytradeFeePolicy({ chainId: 56, mode: 'copytrade', executionMode: 'turbo' }),
      { reasonCode: 'DEFAULT_FEE_POLICY' },
    );
  });
});
