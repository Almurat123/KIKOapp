import test from 'node:test';
import assert from 'node:assert/strict';

import { __swapExecutorTest } from '../SwapExecutor.js';

function makeQuote(overrides: Record<string, unknown> = {}) {
  return {
    dex: '0x',
    dexName: '0x Aggregator',
    amountOut: '1.0',
    amountOutBase: '1000000000000000000',
    gasEstimate: 250000,
    priceImpact: 1,
    path: ['TOKEN', 'ETH'],
    router: '0xrouter',
    data: '0xabcdef',
    to: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    value: '0',
    allowanceTarget: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    deadline: Math.floor(Date.now() / 1000) + 600,
    tokenInDecimals: 18,
    tokenOutDecimals: 18,
    ...overrides,
  };
}

test('finalizeApprovedSellQuote keeps original quote when refreshed spender drifts', () => {
  const original = makeQuote();
  const refreshed = makeQuote({
    amountOut: '1.1',
    allowanceTarget: '0xcccccccccccccccccccccccccccccccccccccccc',
  });

  const decision = __swapExecutorTest.finalizeApprovedSellQuote({
    originalQuote: original as any,
    refreshedQuote: refreshed as any,
  });

  assert.equal(decision.refreshApplied, false);
  assert.equal(decision.refreshFailureCode, 'fresh_quote_allowance_changed_after_approval');
  assert.equal(decision.quoteToExecute.allowanceTarget, original.allowanceTarget);
  assert.equal(decision.quoteToExecute.data, original.data);
});

test('finalizeApprovedSellQuote keeps original quote when refreshed dex drifts', () => {
  const original = makeQuote({ dex: 'kyber', dexName: 'KyberSwap' });
  const refreshed = makeQuote({ dex: '0x', dexName: '0x Aggregator' });

  const decision = __swapExecutorTest.finalizeApprovedSellQuote({
    originalQuote: original as any,
    refreshedQuote: refreshed as any,
  });

  assert.equal(decision.refreshApplied, false);
  assert.equal(decision.refreshFailureCode, 'fresh_quote_dex_changed_after_approval');
  assert.equal(decision.quoteToExecute.dex, original.dex);
});

test('finalizeApprovedSellQuote accepts compatible pinned refresh', () => {
  const original = makeQuote();
  const refreshed = makeQuote({
    amountOut: '1.2',
    amountOutBase: '1200000000000000000',
    data: '0xfeedbeef',
  });

  const decision = __swapExecutorTest.finalizeApprovedSellQuote({
    originalQuote: original as any,
    refreshedQuote: refreshed as any,
  });

  assert.equal(decision.refreshApplied, true);
  assert.equal(decision.refreshFailureCode, undefined);
  assert.equal(decision.quoteToExecute.amountOut, '1.2');
  assert.equal(decision.quoteToExecute.data, '0xfeedbeef');
});
