import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { __sellApprovalPreheatTest } from '../sellApprovalPreheater.js';

describe('sellApprovalPreheater', () => {
  test('extractSpenders keeps distinct provider spenders and drops invalid values', () => {
    const spenders = __sellApprovalPreheatTest.extractSpenders([
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222',
      '0x1111111111111111111111111111111111111111',
      '0x0000000000000000000000000000000000000000',
      'not-an-address',
      null,
      undefined,
    ]);

    assert.deepEqual(spenders, [
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222',
    ]);
  });
});
