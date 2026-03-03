import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  isConfirmedAttributedPosition,
  resolveAttributedPositionExitAmount,
} from '../services/copytrade/positions/positionAttribution.js';

describe('copytrade position attribution', () => {
  test('sells only attributed amount when wallet balance includes external holdings', () => {
    const result = resolveAttributedPositionExitAmount({
      positions: [
        {
          id: 'pos_1',
          tokenAddress: '0xToken',
          entryTxHash: '0xconfirmed',
          entryAmountDec: '100',
        },
      ],
      decimals: 18,
      onChainBalanceRaw: 150000000000000000000n,
    });

    assert.equal(result.reasonCode, 'ATTRIBUTED_AMOUNT_RESOLVED');
    assert.equal(result.attributedAmountRaw, 100000000000000000000n);
    assert.equal(result.sellAmountRaw, 100000000000000000000n);
    assert.equal(result.metrics.hasExternalBalance, true);
  });

  test('does not treat pending or recovered entries as confirmed ownership', () => {
    assert.equal(isConfirmedAttributedPosition({
      id: 'pending',
      tokenAddress: '0xToken',
      entryTxHash: 'PENDING_123',
      entryAmountDec: '10',
    }), false);

    assert.equal(isConfirmedAttributedPosition({
      id: 'recovered',
      tokenAddress: '0xToken',
      entryTxHash: 'RECOVERED_ONCHAIN_123',
      entryAmountDec: '10',
    }), false);
  });

  test('keeps auto exit disabled when attributed amount is missing', () => {
    const result = resolveAttributedPositionExitAmount({
      positions: [
        {
          id: 'legacy_pos',
          tokenAddress: '0xToken',
          entryTxHash: '0xconfirmed',
          entryAmountDec: null,
        },
      ],
      decimals: 18,
      onChainBalanceRaw: 5000000000000000000n,
    });

    assert.equal(result.reasonCode, 'NO_CONFIRMED_POSITIONS');
    assert.equal(result.sellAmountRaw, 0n);
    assert.equal(result.eligiblePositions.length, 0);
  });

  test('uses exact string amount when decimal helper field is unavailable', () => {
    const result = resolveAttributedPositionExitAmount({
      positions: [
        {
          id: 'large_pos',
          tokenAddress: '0xToken',
          entryTxHash: '0xconfirmed',
          entryAmountExact: '123456789012345678901.5',
          entryAmountDec: null,
        },
      ],
      decimals: 1,
      onChainBalanceRaw: 1234567890123456789015n,
    });

    assert.equal(result.reasonCode, 'ATTRIBUTED_AMOUNT_RESOLVED');
    assert.equal(result.sellAmountRaw, 1234567890123456789015n);
    assert.equal(result.eligiblePositions.length, 1);
  });
});
