import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { hasPositiveAttributionAmount } from '../services/copytrade/positions/positionAttributionAmount.js';

describe('position attribution amount helper', () => {
  test('treats zero-like decimal strings as zero', () => {
    assert.equal(hasPositiveAttributionAmount('0'), false);
    assert.equal(hasPositiveAttributionAmount('0.0'), false);
    assert.equal(hasPositiveAttributionAmount('0.000000000000000000'), false);
    assert.equal(hasPositiveAttributionAmount('000.000'), false);
  });

  test('treats positive decimal strings as positive attribution', () => {
    assert.equal(hasPositiveAttributionAmount('0.0015195066668355008'), true);
    assert.equal(hasPositiveAttributionAmount('1'), true);
  });
});
