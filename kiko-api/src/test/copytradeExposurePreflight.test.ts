import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { evaluateCopytradeExposurePreflightFromPositions } from '../services/copytrade/buy/exposurePreflight.js';
import { buildCooldownThrottleWhere, buildDuplicateTradeWhere, describeCooldownMode } from '../services/copytrade/guards/cooldownPolicy.js';

describe('copytrade exposure preflight', () => {
  test('open exposure blocks rebuy even after cooldown window has elapsed', () => {
    const result = evaluateCopytradeExposurePreflightFromPositions({
      activePositions: [
        {
          id: 'pos-open',
          status: 'open',
          createdAt: new Date('2026-03-04T09:00:00.000Z'),
        },
      ],
      recentCooldownPositions: [],
      cooldownMinutes: 60,
    });

    assert.equal(result.allowed, false);
    assert.equal(result.reasonCode, 'ENTRY_POLICY_BLOCK_ACTIVE_EXPOSURE');
    assert.equal(result.exposure.state, 'open');
  });

  test('entry-in-flight statuses stay as hard lock even when cooldown is disabled', () => {
    const result = evaluateCopytradeExposurePreflightFromPositions({
      activePositions: [
        {
          id: 'pos-broadcast',
          status: 'broadcasted_unseen',
          createdAt: new Date('2026-03-04T11:59:00.000Z'),
        },
      ],
      recentCooldownPositions: [],
      cooldownMinutes: 0,
    });

    assert.equal(result.allowed, false);
    assert.equal(result.reasonCode, 'ENTRY_POLICY_BLOCK_ACTIVE_EXPOSURE');
    assert.equal(result.exposure.state, 'pending_entry');
  });

  test('recently closed strategy activity triggers cooldown throttle when no active exposure exists', () => {
    const result = evaluateCopytradeExposurePreflightFromPositions({
      activePositions: [],
      recentCooldownPositions: [
        {
          id: 'pos-closed',
          status: 'closed',
          createdAt: new Date('2026-03-04T11:45:00.000Z'),
          closedAt: new Date('2026-03-04T11:50:00.000Z'),
        },
      ],
      cooldownMinutes: 60,
    });

    assert.equal(result.allowed, false);
    assert.equal(result.reasonCode, 'COOLDOWN_RECENT_STRATEGY_ACTIVITY');
    assert.equal(result.exposure.state, 'none');
  });

  test('explicit scale-in policy can allow rebuy while exposure exists', () => {
    const result = evaluateCopytradeExposurePreflightFromPositions({
      activePositions: [
        {
          id: 'pos-open',
          status: 'open',
          createdAt: new Date('2026-03-04T11:00:00.000Z'),
        },
      ],
      recentCooldownPositions: [],
      cooldownMinutes: 60,
      allowScaleIn: true,
    });

    assert.equal(result.allowed, true);
    assert.equal(result.reasonCode, 'EXPOSURE_PREFLIGHT_OK');
  });
});

describe('cooldown guard semantics', () => {
  test('pending lock query stays scoped to strategy and chain and does not include open cooldown logic', () => {
    const where = buildDuplicateTradeWhere({
      userId: 'user-1',
      configId: 'cfg-1',
      tokenAddress: '0xtoken',
      chainId: 1,
      cooldownMinutes: 60,
      positionStatusCompat: {
        lockStatuses: ['pending'],
      },
    });

    assert.deepEqual(where, {
      userId: 'user-1',
      configId: 'cfg-1',
      tokenAddress: '0xtoken',
      chainId: 1,
      status: { in: ['pending', 'pending_broadcast', 'broadcasted_unseen'] },
    });
  });

  test('cooldown throttle query uses recent strategy activity instead of open-position ownership', () => {
    const where = buildCooldownThrottleWhere({
      userId: 'user-1',
      configId: 'cfg-1',
      tokenAddress: '0xtoken',
      chainId: 1,
      cooldownMinutes: 60,
    });

    assert.ok(where);
    assert.equal(describeCooldownMode(60), 'recent_strategy_activity');
    assert.equal(describeCooldownMode(0), 'disabled');
    assert.equal((where as any).userId, 'user-1');
    assert.equal((where as any).configId, 'cfg-1');
    assert.equal((where as any).chainId, 1);
    assert.deepEqual((where as any).status, { in: ['open', 'closing', 'close_pending', 'closed'] });
    assert.ok((where as any).createdAt.gte instanceof Date);
  });
});
