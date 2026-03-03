import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  canStoreDecimal3818,
  encodePositionTokenAmount,
} from '../services/copytrade/positions/positionDecimalCodec.js';

describe('positionDecimalCodec', () => {
  test('stores safe decimal amounts in both exact and decimal fields', () => {
    const result = encodePositionTokenAmount({ exactAmount: '12345.6789' });
    assert.equal(result.exactAmount, '12345.6789');
    assert.equal(result.decimalAmount, '12345.6789');
    assert.equal(result.reasonCode, 'POSITION_DECIMAL_SAFE');
  });

  test('rejects Decimal(38,18) overflow but preserves exact string', () => {
    const largeAmount = '123456789012345678901.123456789';
    assert.equal(canStoreDecimal3818(largeAmount), false);

    const result = encodePositionTokenAmount({ exactAmount: largeAmount });
    assert.equal(result.exactAmount, largeAmount);
    assert.equal(result.decimalAmount, undefined);
    assert.equal(result.reasonCode, 'POSITION_DECIMAL_OVERFLOW_PREVENTED');
  });
});
