import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { scheduleLateBuyConfirmationRecovery } from '../services/copytrade/buy/lateBuyConfirmationRecovery.js';

describe('late buy confirmation recovery', () => {
  test('resolves a late confirmed success after initial defer', async () => {
    const seen: string[] = [];
    let probeCount = 0;

    scheduleLateBuyConfirmationRecovery(
      {
        chainId: 1,
        txHash: '0xlate',
        tokenAddress: '0xpep',
        timeoutMs: 50,
        pollMs: 0,
        async onResolved(confirmation) {
          seen.push(confirmation.kind);
        }
      },
      {
        async probeBuyConfirmation() {
          probeCount += 1;
          if (probeCount < 2) return null;
          return { success: true, kind: 'confirmed_success', visible: true };
        },
        async sleep() {}
      },
    );

    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.deepEqual(seen, ['confirmed_success']);
  });
});
