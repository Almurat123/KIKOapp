import test from 'node:test';
import assert from 'node:assert/strict';

import { __prepareSwapTest } from './prepareSwap.js';

test('resolveSocketRecoverySearchStartMs uses original request start time when it predates socket recovery', () => {
  const requestStartedAt = 1_000_000;
  const recoveryStartedAt = 1_030_000;

  const result = __prepareSwapTest.resolveSocketRecoverySearchStartMs({
    requestStartedAt,
    recoveryStartedAt,
    lookbackMs: 5_000,
  });

  assert.equal(result, 995_000);
});

test('buildSocketRecoveryResult keeps recovered pending trades pending in the UI', () => {
  const result = __prepareSwapTest.buildSocketRecoveryResult({
    currentData: {
      amountOut: '0.1',
      tokenInSymbol: 'VIRTUAL',
      tokenOutSymbol: 'ETH',
    },
    recentSwap: {
      id: 'trade-1',
      txHash: '0xabc123',
      status: 'pending',
      tokenOutAmount: '0.2',
    },
    args: {
      amount_in: '1',
      token_in: 'VIRTUAL',
      token_out: 'ETH',
    },
  });

  assert.equal(result.completionData.status, 'pending');
  assert.equal(result.completionData.isLoading, true);
  assert.equal(result.toolResult.mode, 'pending');
  assert.equal(result.toolResult.data.status, 'pending');
});

test('buildSocketRecoveryResult marks confirmed trades as success', () => {
  const result = __prepareSwapTest.buildSocketRecoveryResult({
    currentData: {
      amountOut: '0.1',
      tokenInSymbol: 'VIRTUAL',
      tokenOutSymbol: 'ETH',
    },
    recentSwap: {
      id: 'trade-2',
      txHash: '0xdef456',
      status: 'success',
      tokenOutAmount: '0.3',
    },
    args: {
      amount_in: '1',
      token_in: 'VIRTUAL',
      token_out: 'ETH',
    },
  });

  assert.equal(result.completionData.status, 'success');
  assert.equal(result.completionData.isLoading, false);
  assert.equal(result.toolResult.mode, 'executed');
  assert.equal(result.toolResult.data.status, 'success');
});

test('hasQuoteModeExecutionAuthorization requires explicit execute gate or matching confirmation state', () => {
  assert.equal(__prepareSwapTest.hasQuoteModeExecutionAuthorization({
    __executionGate: { phase: 'execute' },
  } as any, {
    token_in: 'VIRTUAL',
    token_out: 'ETH',
    amount_in: '1',
    chain_id: 8453,
  }), true);

  assert.equal(__prepareSwapTest.hasQuoteModeExecutionAuthorization({
    __snapshot: {
      confirmationState: {
        kind: 'swap_confirmation',
        swap: {
          tokenIn: 'VIRTUAL',
          tokenOut: 'ETH',
          chainId: 8453,
        },
      },
    },
  } as any, {
    token_in: 'VIRTUAL',
    token_out: 'ETH',
    amount_in: '1',
    chain_id: 8453,
  }), true);

  assert.equal(__prepareSwapTest.hasQuoteModeExecutionAuthorization({
    __snapshot: {
      confirmationState: {
        kind: 'swap_confirmation',
        swap: {
          tokenIn: 'USDC',
          tokenOut: 'ETH',
          chainId: 8453,
        },
      },
    },
  } as any, {
    token_in: 'VIRTUAL',
    token_out: 'ETH',
    amount_in: '1',
    chain_id: 8453,
  }), false);
});

test('repairTruncatedEvmAddressFromMessages restores a uniquely matching full address from session content', () => {
  const repaired = __prepareSwapTest.repairTruncatedEvmAddressFromMessages(
    '0x0bc61768132aa1484e2b09301284b7def78a444',
    [
      {
        content: 'Buy 0x0bC61768132aA1484E2b09301284b7DeF78a4444 for 0.001 BNB on BSC',
      },
    ],
  );

  assert.equal(repaired, '0x0bC61768132aA1484E2b09301284b7DeF78a4444');
});

test('repairTruncatedEvmAddressFromMessages leaves ambiguous partial addresses unchanged', () => {
  const repaired = __prepareSwapTest.repairTruncatedEvmAddressFromMessages(
    '0x1234',
    [
      { content: '0x1234000000000000000000000000000000000000' },
      { content: '0x1234ffffffffffffffffffffffffffffffffffff' },
    ],
  );

  assert.equal(repaired, '0x1234');
});
