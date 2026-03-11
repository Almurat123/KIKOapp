import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  getApprovalQuoteRefreshDelayMs,
  shouldRetryApprovalQuoteRefresh,
} from '../approvalQuoteRefreshPolicy.js';

describe('approvalQuoteRefreshPolicy', () => {
  test('uses a shorter first delay than retry delay', () => {
    assert.ok(getApprovalQuoteRefreshDelayMs(1) <= getApprovalQuoteRefreshDelayMs(2));
  });

  test('retries when quote is missing or allowance target changed on first attempt', () => {
    assert.equal(shouldRetryApprovalQuoteRefresh({ attempt: 1, quoteFound: false, allowanceChanged: false }), true);
    assert.equal(shouldRetryApprovalQuoteRefresh({ attempt: 1, quoteFound: true, allowanceChanged: true }), true);
    assert.equal(shouldRetryApprovalQuoteRefresh({ attempt: 1, quoteFound: true, allowanceChanged: false }), false);
  });
});
