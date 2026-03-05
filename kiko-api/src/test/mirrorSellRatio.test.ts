import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { computeMirrorSellProportionalAmountRaw } from '../services/copytrade-v2/exit/mirrorSellRatio.js';

describe('mirror sell ratio', () => {
  test('applies partial sell proportionally', () => {
    const result = computeMirrorSellProportionalAmountRaw({
      baseSellAmountRaw: 1000n,
      targetSellAmountRaw: 25n,
      targetBuyBaseRaw: 100n,
    });

    assert.equal(result.applied, true);
    assert.equal(result.sellAmountRaw, 250n);
    assert.equal(result.ratioBps, 2500);
    assert.equal(result.reasonCode, 'MIRROR_RATIO_APPLIED');
  });

  test('caps at full sell when target sell exceeds buy base', () => {
    const result = computeMirrorSellProportionalAmountRaw({
      baseSellAmountRaw: 1000n,
      targetSellAmountRaw: 150n,
      targetBuyBaseRaw: 100n,
    });

    assert.equal(result.applied, true);
    assert.equal(result.sellAmountRaw, 1000n);
    assert.equal(result.ratioBps, 10000);
    assert.equal(result.reasonCode, 'MIRROR_RATIO_APPLIED');
  });

  test('keeps fallback when target buy base is unavailable', () => {
    const result = computeMirrorSellProportionalAmountRaw({
      baseSellAmountRaw: 1000n,
      targetSellAmountRaw: 25n,
      targetBuyBaseRaw: 0n,
    });

    assert.equal(result.applied, false);
    assert.equal(result.sellAmountRaw, 1000n);
    assert.equal(result.reasonCode, 'MIRROR_RATIO_NO_TARGET_BUY_BASE');
  });
});

