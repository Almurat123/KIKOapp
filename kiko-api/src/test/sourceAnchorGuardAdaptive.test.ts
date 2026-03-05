import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateSourceAnchorQuote,
  resolveAdaptiveMinAnchorRatioBps,
  resolveSourceAnchorExpectation,
} from '../services/dex/directSwap/domain/guards.js';

describe('source anchor adaptive min ratio', () => {
  test('keeps configured min ratio when request size is not larger than source size', () => {
    const result = resolveAdaptiveMinAnchorRatioBps({
      configuredMinAnchorRatioBps: 7000,
      sourceAmountIn: 1000n,
      requestAmountIn: 1000n,
    });
    assert.equal(result.effectiveMinAnchorRatioBps, 7000);
    assert.equal(result.adaptiveApplied, false);
  });

  test('relaxes min ratio when follower request is significantly larger than source amount', () => {
    const result = resolveAdaptiveMinAnchorRatioBps({
      configuredMinAnchorRatioBps: 7000,
      sourceAmountIn: 1000n,
      requestAmountIn: 2000n,
    });
    assert.equal(result.effectiveMinAnchorRatioBps, 3500);
    assert.equal(result.amountScaleBps, 20000);
    assert.equal(result.adaptiveApplied, true);
  });

  test('resolveSourceAnchorExpectation exposes adaptive min and scale diagnostics', () => {
    const expectation = resolveSourceAnchorExpectation({
      hint: {
        sourceTokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        sourceTokenOut: '0x1234567890123456789012345678901234567890',
        sourceAmountIn: '1000',
        sourceAmountOut: '500',
      },
      tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      tokenOut: '0x1234567890123456789012345678901234567890',
      amountInWei: 2000n,
      wrappedNativeAddress: '0x4200000000000000000000000000000000000006',
      minAnchorRatioBps: 7000,
      maxAnchorRatioBps: 14000,
    });

    assert.ok(expectation);
    assert.equal(expectation?.configuredMinAnchorRatioBps, 7000);
    assert.equal(expectation?.minAnchorRatioBps, 3500);
    assert.equal(expectation?.adaptiveMinApplied, true);
    assert.equal(expectation?.amountScaleBps, 20000);
  });

  test('anchor quote acceptance uses effective adaptive min ratio', () => {
    const anchor = resolveSourceAnchorExpectation({
      hint: {
        sourceTokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        sourceTokenOut: '0x1234567890123456789012345678901234567890',
        sourceAmountIn: '1000',
        sourceAmountOut: '10000',
      },
      tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      tokenOut: '0x1234567890123456789012345678901234567890',
      amountInWei: 2000n,
      wrappedNativeAddress: '0x4200000000000000000000000000000000000006',
      minAnchorRatioBps: 7000,
      maxAnchorRatioBps: 14000,
    });

    assert.ok(anchor);
    const accepted = evaluateSourceAnchorQuote(7000n, anchor!);
    const rejected = evaluateSourceAnchorQuote(6000n, anchor!);

    assert.equal(anchor?.minAnchorRatioBps, 3500);
    assert.equal(accepted.accepted, true);
    assert.equal(accepted.ratioBps, 3500);
    assert.equal(rejected.accepted, false);
    assert.equal(rejected.ratioBps, 3000);
  });
});
