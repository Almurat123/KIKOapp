import test from 'node:test';
import assert from 'node:assert/strict';
import { isPostBuyPreApprovalEnabled } from './swapPreApprovalPolicy.js';

const ENV_KEYS = [
  'SWAP_POST_BUY_PREAPPROVAL_ENABLED',
  'SWAP_DIRECT_POST_BUY_PREAPPROVAL_ENABLED',
  'SWAP_FALLBACK_POST_BUY_PREAPPROVAL_ENABLED',
  'COPYTRADE_POST_BUY_PREAPPROVAL_ENABLED'
] as const;

function withEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string>>, fn: () => void): void {
  const prev = new Map<string, string | undefined>();
  for (const key of ENV_KEYS) prev.set(key, process.env[key]);
  try {
    for (const key of ENV_KEYS) {
      const next = values[key];
      if (next === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = next;
      }
    }
    fn();
  } finally {
    for (const key of ENV_KEYS) {
      const value = prev.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('post-buy pre-approval is disabled by default', () => {
  withEnv({}, () => {
    assert.equal(isPostBuyPreApprovalEnabled('copytrade', 'direct'), false);
    assert.equal(isPostBuyPreApprovalEnabled('copytrade', 'fallback'), false);
    assert.equal(isPostBuyPreApprovalEnabled('fast-swap', 'direct'), false);
  });
});

test('global enable does not force copytrade unless explicitly enabled', () => {
  withEnv({
    SWAP_POST_BUY_PREAPPROVAL_ENABLED: 'true',
    COPYTRADE_POST_BUY_PREAPPROVAL_ENABLED: 'false'
  }, () => {
    assert.equal(isPostBuyPreApprovalEnabled('fast-swap', 'fallback'), true);
    assert.equal(isPostBuyPreApprovalEnabled('copytrade', 'direct'), false);
  });
});

test('copytrade pre-approval can be enabled explicitly', () => {
  withEnv({
    SWAP_POST_BUY_PREAPPROVAL_ENABLED: 'true',
    COPYTRADE_POST_BUY_PREAPPROVAL_ENABLED: 'true'
  }, () => {
    assert.equal(isPostBuyPreApprovalEnabled('copytrade', 'direct'), true);
    assert.equal(isPostBuyPreApprovalEnabled('copytrade', 'fallback'), true);
  });
});
