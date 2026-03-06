import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { scheduleLateBuyConfirmationRecovery } from '../services/copytrade-v2/buy/lateBuyConfirmationRecovery.js';

describe('late buy confirmation recovery', () => {
  test('resolves once shared confirmation returns confirmed success', async () => {
    let resolvedKind = '';
    let sleepCalls = 0;

    scheduleLateBuyConfirmationRecovery({
      chainId: 1,
      txHash: '0xbuy',
      tokenAddress: '0xtoken',
      onResolved: async (confirmation) => {
        resolvedKind = confirmation.kind;
      },
      timeoutMs: 50,
      pollMs: 1,
    }, {
      probeBuyConfirmation: async () => ({
        success: true,
        kind: 'confirmed_success',
        visible: true,
      }),
      sleep: async () => {
        sleepCalls += 1;
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(resolvedKind, 'confirmed_success');
    assert.equal(sleepCalls, 0);
  });

  test('does not resolve when recovery only sees uncertain results', async () => {
    let resolved = false;

    scheduleLateBuyConfirmationRecovery({
      chainId: 1,
      txHash: '0xbuy-uncertain',
      tokenAddress: '0xtoken',
      onResolved: async () => {
        resolved = true;
      },
      timeoutMs: 5,
      pollMs: 1,
    }, {
      probeBuyConfirmation: async () => null,
      sleep: async () => undefined,
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(resolved, false);
  });

  test('forwards caller timeout and poll settings into confirmation probe', async () => {
    const seen: Array<{ timeoutMs: number; pollMs: number }> = [];

    scheduleLateBuyConfirmationRecovery({
      chainId: 1,
      txHash: '0xprobe',
      tokenAddress: '0xtoken',
      onResolved: async () => {},
      timeoutMs: 120,
      pollMs: 25,
    }, {
      probeBuyConfirmation: async ({ timeoutMs, pollMs }) => {
        seen.push({ timeoutMs, pollMs });
        return {
          success: true,
          kind: 'confirmed_success',
          visible: true,
        };
      },
      sleep: async () => undefined,
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(seen.length, 1);
    assert.equal(seen[0]?.timeoutMs, 120);
    assert.equal(seen[0]?.pollMs, 25);
  });

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
