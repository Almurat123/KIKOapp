import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveSolanaDbBalanceFallback } from '../services/copytrade-v2/exit/solanaDbBalanceFallback.js';

describe('solana db balance fallback', () => {
  test('uses entryAmountExact raw first', () => {
    const result = resolveSolanaDbBalanceFallback({
      positions: [
        { entryAmountExact: '1000' },
        { entryAmountExact: '2500' },
      ],
      tokenDecimals: 6,
    });

    assert.equal(result.balanceRaw, 3500n);
    assert.equal(result.decimals, 6);
    assert.equal(result.usedSource, 'entryAmountExact');
  });

  test('falls back to entryAmountDec when exact amount is unavailable', () => {
    const result = resolveSolanaDbBalanceFallback({
      positions: [
        { entryAmountDec: '1.5' },
        { entryAmountDec: '0.25' },
      ],
      tokenDecimals: 6,
    });

    assert.equal(result.balanceRaw, 1_750_000n);
    assert.equal(result.decimals, 6);
    assert.equal(result.usedSource, 'entryAmountDec');
  });

  test('falls back to legacy entryAmount field for historical records', () => {
    const result = resolveSolanaDbBalanceFallback({
      positions: [
        { entryAmount: '2.125' },
      ],
      tokenDecimals: 6,
    });

    assert.equal(result.balanceRaw, 2_125_000n);
    assert.equal(result.decimals, 6);
    assert.equal(result.usedSource, 'entryAmount');
  });

  test('returns none when all fields are empty', () => {
    const result = resolveSolanaDbBalanceFallback({
      positions: [
        { entryAmountExact: null, entryAmountDec: null, entryAmount: null },
      ],
      tokenDecimals: 6,
    });

    assert.equal(result.balanceRaw, 0n);
    assert.equal(result.decimals, 6);
    assert.equal(result.usedSource, 'none');
  });
});
