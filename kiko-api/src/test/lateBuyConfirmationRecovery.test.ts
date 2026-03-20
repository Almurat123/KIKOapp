import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { scheduleLateBuyConfirmationRecovery } from '../services/copytrade-v2/buy/lateBuyConfirmationRecovery.js';

describe('late buy confirmation recovery', () => {
  test('persists buy awaiting finality onto the canonical order observation queue', async () => {
    const scheduled: any[] = [];

    scheduleLateBuyConfirmationRecovery({
      chainId: 1,
      txHash: '0xbuy',
      tokenAddress: '0xtoken',
      orderId: 'order-1',
      timeoutMs: 120,
      pollMs: 25,
      onResolved: async () => undefined,
    }, {
      scheduleCanonicalOrderObservation: async (params) => {
        scheduled.push(params);
        return null as any;
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(scheduled.length, 1);
    assert.equal(scheduled[0]?.orderId, 'order-1');
    assert.equal(scheduled[0]?.kind, 'buy');
    assert.equal(scheduled[0]?.reasonCode, 'buy_awaiting_finality');
    assert.equal(scheduled[0]?.delayMs, 100);
  });
});
