import test from 'node:test';
import assert from 'node:assert/strict';
import { __sellApprovalPreheatTest } from './sellApprovalPreheater.js';

test('buildProbeAmountBase returns precision floor when balance is omitted', () => {
  const probe = __sellApprovalPreheatTest.buildProbeAmountBase(18, undefined);
  assert.equal(probe, 1_000_000_000_000n);
});

test('buildProbeAmountBase respects optional balance cap', () => {
  const probe = __sellApprovalPreheatTest.buildProbeAmountBase(18, undefined, 1000n);
  assert.equal(probe, 1000n);
});

test('buildProbeAmountBase uses usd-derived probe when available', () => {
  const probe = __sellApprovalPreheatTest.buildProbeAmountBase(6, 0.5, 10_000_000n);
  assert.ok(probe > 0n);
  assert.ok(probe <= 10_000_000n);
});

test('extractSpenders keeps unique valid addresses and removes zero address', () => {
  const spenders = __sellApprovalPreheatTest.extractSpenders({
    best: {
      allowanceTarget: '0x0000000000000000000000000000000000000000'
    },
    quotes: [
      { allowanceTarget: '0xdef1c0ded9bec7f1a1670819833240f027b25eff' },
      { allowanceTarget: '0xDef1C0ded9bec7f1a1670819833240f027b25EfF' },
      { allowanceTarget: '0x111111125421ca6dc452d289314280a0f8842a65' }
    ]
  });

  assert.equal(spenders.length >= 1, true);
  assert.equal(spenders[0].toLowerCase(), '0xdef1c0ded9bec7f1a1670819833240f027b25eff');
});
