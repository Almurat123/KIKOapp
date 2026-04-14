import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateCopytradeExposurePreflightFromPositions } from '../buy/exposurePreflight.js';

test('exposure preflight blocks recent target-wallet same-token buy signals without open follower positions', () => {
  const result = evaluateCopytradeExposurePreflightFromPositions({
    activePositions: [],
    recentCooldownPositions: [],
    recentTargetSignalOrders: [
      {
        id: 'order-recent-target-signal',
        txHash: '0xleader-previous',
        lifecycleState: 'FAILED_TERMINAL',
        createdAt: new Date(),
        detectedAt: new Date(),
      },
    ],
    cooldownMinutes: 60,
    allowScaleIn: false,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, 'COOLDOWN_RECENT_STRATEGY_ACTIVITY');
  assert.equal(result.metrics.recentTargetSignalOrderCount, 1);
  assert.deepEqual(result.metrics.recentTargetSignalOrderIds, ['order-recent-target-signal']);
});

test('exposure preflight allows fresh token when no active exposure or recent signal exists', () => {
  const result = evaluateCopytradeExposurePreflightFromPositions({
    activePositions: [],
    recentCooldownPositions: [],
    recentTargetSignalOrders: [],
    cooldownMinutes: 60,
    allowScaleIn: false,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, 'EXPOSURE_PREFLIGHT_OK');
  assert.equal(result.metrics.recentTargetSignalOrderCount, 0);
});
