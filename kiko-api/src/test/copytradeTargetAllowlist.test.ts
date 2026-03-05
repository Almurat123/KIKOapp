import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { evaluateCopytradeTargetAllowlist } from '../services/copytrade-v2/ingress/targetAllowlist.js';

const BASE_KEY = 'COPYTRADE_TARGET_ALLOWLIST_BASE';

afterEach(() => {
  delete process.env[BASE_KEY];
});

describe('copytrade target allowlist', () => {
  test('rejects when allowlist is missing', () => {
    const decision = evaluateCopytradeTargetAllowlist(8453, '0x77777351928ce19bee8ff5b4b1406bc4c152827a');
    assert.equal(decision.allowed, false);
    assert.equal(decision.reasonCode, 'target_allowlist_missing');
  });

  test('rejects wallets not in configured allowlist', () => {
    process.env[BASE_KEY] = '0x1111111111111111111111111111111111111111';
    const decision = evaluateCopytradeTargetAllowlist(8453, '0x77777351928ce19bee8ff5b4b1406bc4c152827a');
    assert.equal(decision.allowed, false);
    assert.equal(decision.reasonCode, 'target_not_allowlisted');
  });

  test('allows configured wallet', () => {
    process.env[BASE_KEY] = '0x77777351928ce19bee8ff5b4b1406bc4c152827a';
    const decision = evaluateCopytradeTargetAllowlist(8453, '0x77777351928ce19bee8ff5b4b1406bc4c152827a');
    assert.equal(decision.allowed, true);
    assert.equal(decision.reasonCode, 'target_allowlisted');
  });
});
