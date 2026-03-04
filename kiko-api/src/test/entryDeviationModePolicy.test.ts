import test from 'node:test';
import assert from 'node:assert/strict';

import {
  NORMAL_MIN_ENTRY_DEVIATION_BPS,
  TURBO_MIN_ENTRY_DEVIATION_BPS,
  resolveEntryDeviationModePolicy,
} from '../services/copytrade/config/entryDeviationModePolicy.js';

test('normal mode enforces minimum 1500bps even when config is lower', () => {
  const policy = resolveEntryDeviationModePolicy({
    maxEntryDeviationBps: 300,
  }, 'normal');

  assert.equal(policy.maxEntryDeviationBps, NORMAL_MIN_ENTRY_DEVIATION_BPS);
  assert.equal(policy.thresholdPolicy, 'normal_min_1500bps');
  assert.equal(policy.source, 'config_field');
});

test('turbo mode enforces minimum 3000bps even when payload is lower', () => {
  const policy = resolveEntryDeviationModePolicy({
    configPayload: {
      maxEntryDeviationBps: 900,
    },
  }, 'turbo');

  assert.equal(policy.maxEntryDeviationBps, TURBO_MIN_ENTRY_DEVIATION_BPS);
  assert.equal(policy.thresholdPolicy, 'turbo_min_3000bps');
  assert.equal(policy.source, 'config_payload');
});

test('mode policy preserves larger configured threshold', () => {
  const policy = resolveEntryDeviationModePolicy({
    maxEntryDeviationBps: 4200,
  }, 'turbo');

  assert.equal(policy.maxEntryDeviationBps, 4200);
  assert.equal(policy.thresholdPolicy, 'turbo_min_3000bps');
});
