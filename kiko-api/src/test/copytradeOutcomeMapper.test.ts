import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { mapSwapResultToOutcome } from '../services/copytrade-v2/trading-flow/outcomeMapper.js';

describe('copytrade outcome mapper', () => {
  test('marks broadcasted_unseen success as uncertain trading execution', () => {
    const outcome = mapSwapResultToOutcome({
      success: true,
      txHash: '0xabc',
      txLifecycle: {
        status: 'broadcasted_unseen',
        txHash: '0xabc',
        attempts: 1,
        chainId: 8453,
      },
      metadata: {
        provider: 'test',
        mode: 'copytrade',
      },
    } as any);

    assert.equal(outcome.status, 'submitted');
    assert.equal(outcome.reasonCode, 'trading_execution_uncertain');
    assert.equal(outcome.metadata?.uncertainVisibility, true);
  });

  test('keeps confirmed success reason code for confirmed lifecycle', () => {
    const outcome = mapSwapResultToOutcome({
      success: true,
      txHash: '0xdef',
      txLifecycle: {
        status: 'confirmed_success',
        txHash: '0xdef',
        attempts: 1,
        chainId: 56,
      },
      metadata: {
        provider: 'test',
        mode: 'copytrade',
      },
    } as any);

    assert.equal(outcome.status, 'confirmed');
    assert.equal(outcome.reasonCode, 'ok_buy_confirmed_open');
  });
});
