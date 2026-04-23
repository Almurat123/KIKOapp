import test from 'node:test';
import assert from 'node:assert/strict';

import { __swapExecutorTest } from '../SwapExecutor.js';
import { getUsableNativeBalanceEvidence, nativeBalanceEvidenceToBigInt } from '../nativeBalanceEvidence.js';

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
  assert.equal(decision.mustAbortExecution, true);
  assert.equal(decision.quoteToExecute.allowanceTarget, original.allowanceTarget);
  assert.equal(decision.quoteToExecute.data, original.data);
});

test('isPermit2Quote detects permit2 approval metadata and spender', () => {
  assert.equal(__swapExecutorTest.isPermit2Quote(makeQuote({
    approvalKind: 'permit2_24h',
  }) as any), true);

  assert.equal(__swapExecutorTest.isPermit2Quote(makeQuote({
    allowanceTarget: '0x000000000022d473030f116ddee9f6b43ac78ba3',
  }) as any), true);

  assert.equal(__swapExecutorTest.isPermit2Quote(makeQuote({
    approvalKind: 'exact_approve_fallback',
    allowanceTarget: '0x0000000000001ff3684f28c67538d4d072c22734',
  }) as any), false);
});

test('requiresExplicitApprovalQuote rejects permit2 and non-holder 0x quotes when permit2 is disabled', () => {
  assert.equal(__swapExecutorTest.requiresExplicitApprovalQuote({
    chainId: 8453,
    preferPermit2: false,
    quote: makeQuote({
      approvalKind: 'permit2_24h',
      allowanceTarget: '0x000000000022d473030f116ddee9f6b43ac78ba3',
    }),
  } as any), true);

  assert.equal(__swapExecutorTest.requiresExplicitApprovalQuote({
    chainId: 8453,
    preferPermit2: false,
    quote: makeQuote({
      approvalKind: 'exact_approve_fallback',
      allowanceTarget: '0x0000000000001ff3684f28c67538d4d072c22734',
    }),
  } as any), false);
});

test('finalizeApprovedSellQuote accepts compatible refresh when dex stays on 0x', () => {
  const original = makeQuote({ dex: '0x', dexName: '0x Aggregator' });
  const refreshed = makeQuote({ dex: '0x', dexName: '0x Aggregator' });

  const decision = __swapExecutorTest.finalizeApprovedSellQuote({
    originalQuote: original as any,
    refreshedQuote: refreshed as any,
  });

  assert.equal(decision.refreshApplied, true);
  assert.equal(decision.refreshFailureCode, undefined);
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

test('requiresExplicitApprovalQuote rejects permit2 quotes when permit2 is disabled', () => {
  const quote = makeQuote({
    approvalKind: 'permit2_24h',
    requiresTypedSignature: true,
    permit2Payload: { domain: {}, types: {}, primaryType: 'PermitSingle', message: {} },
    permit2Spender: '0x000000000022d473030f116ddee9dad608d18000',
  });

  assert.equal(__swapExecutorTest.isPermit2Quote(quote as any), true);
  assert.equal(__swapExecutorTest.requiresExplicitApprovalQuote({
    chainId: 8453,
    quote: quote as any,
    preferPermit2: false,
  }), true);
});

test('native balance evidence is reusable only for matching fresh wallet scope', () => {
  const evidence = {
    chainId: 8453,
    walletAddress: '0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B',
    balanceWei: '1000000000000000000',
    observedAtMs: 1_000,
    source: 'copytrade_buy_gas_guard' as const,
  };

  const usable = getUsableNativeBalanceEvidence({
    evidence,
    chainId: 8453,
    walletAddress: '0xfb64ce8d64cec808a8acb977d3ee7be1169f1a2b',
    nowMs: 2_000,
  });

  assert.ok(usable);
  assert.equal(nativeBalanceEvidenceToBigInt(usable), 1000000000000000000n);
  assert.equal(getUsableNativeBalanceEvidence({
    evidence,
    chainId: 1,
    walletAddress: evidence.walletAddress,
    nowMs: 2_000,
  }), null);
  assert.equal(getUsableNativeBalanceEvidence({
    evidence,
    chainId: 8453,
    walletAddress: evidence.walletAddress,
    nowMs: 20_000,
    maxAgeMs: 5_000,
  }), null);
});

test('turbo copytrade buy token-info bypass only activates for explicit copytrade buy scope', () => {
  assert.equal(__swapExecutorTest.shouldSkipCopytradeTokenInfoHotPath({
    feeContext: 'copyTrade',
    disableTokenInfo: true,
    isSell: false,
  } as any), true);

  assert.equal(__swapExecutorTest.shouldSkipCopytradeTokenInfoHotPath({
    feeContext: 'copyTrade',
    disableTokenInfo: false,
    isSell: false,
  } as any), false);

  assert.equal(__swapExecutorTest.shouldSkipCopytradeTokenInfoHotPath({
    feeContext: 'copyTrade',
    disableTokenInfo: true,
    isSell: true,
  } as any), false);

  assert.equal(__swapExecutorTest.shouldSkipCopytradeTokenInfoHotPath({
    feeContext: 'swap',
    disableTokenInfo: true,
    isSell: false,
  } as any), false);
});

test('interactive wallet swaps use the lightweight token metadata path', () => {
  assert.equal(__swapExecutorTest.isInteractiveWalletSwap({
    feeContext: 'swap',
    runtimeContext: { mode: 'swap-card' },
  } as any), true);

  assert.equal(__swapExecutorTest.isInteractiveWalletSwap({
    feeContext: 'swap',
    runtimeContext: { mode: 'allowance' },
  } as any), true);

  assert.equal(__swapExecutorTest.isInteractiveWalletSwap({
    feeContext: 'copyTrade',
    runtimeContext: { mode: 'swap-card' },
  } as any), false);
});
