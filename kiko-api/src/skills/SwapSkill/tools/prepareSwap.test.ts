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
  assert.equal(result.completionData.amountOut, '0.1');
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
  assert.equal(result.completionData.amountOut, '0.3');
  assert.equal(result.toolResult.mode, 'executed');
  assert.equal(result.toolResult.data.status, 'success');
});

test('raceExecutionWithPendingHandoff returns the execution result when it finishes before the timeout', async () => {
  const result = await __prepareSwapTest.raceExecutionWithPendingHandoff(
    Promise.resolve('done'),
    25,
  );

  assert.equal(result, 'done');
});

test('raceExecutionWithPendingHandoff hands chat back a pending sentinel when execution is slow', async () => {
  const result = await __prepareSwapTest.raceExecutionWithPendingHandoff(
    new Promise<string>((resolve) => setTimeout(() => resolve('late'), 20)),
    1,
  );

  assert.deepEqual(result, { __pending_handoff: true });
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

test('findRecentSimulatedSwapFromTrace reuses the latest matching successful simulation from snapshot trace', () => {
  const simulated = __prepareSwapTest.findRecentSwapPrecheckFromTrace({
    toolCalls: [
      {
        tool: 'simulate_swap',
        status: 'success',
        args: {
          token_in: 'BNB',
          token_out: '0x0bc61768132aa1484e2b09301284b7def78a4444',
          amount_in: '0.001',
          chain_id: 56,
        },
        result: {
          finishedAt: new Date().toISOString(),
        },
      },
    ],
  }, 2 * 60 * 1000);

  assert.deepEqual(simulated, {
    token_in: 'BNB',
    token_out: '0x0bc61768132aa1484e2b09301284b7def78a4444',
    amount_in: '0.001',
    chain_id: 56,
  });
});

test('findRecentSwapPrecheckFromTrace accepts prepare_swap_transaction quote mode as execution evidence', () => {
  const simulated = __prepareSwapTest.findRecentSwapPrecheckFromTrace({
    toolCalls: [
      {
        tool: 'prepare_swap_transaction',
        status: 'success',
        args: {
          token_in: 'ETH',
          token_out: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          amount_in: '0.001',
          chain_id: 8453,
          execute: false,
        },
        result: {
          finishedAt: new Date().toISOString(),
          requires_confirmation: true,
        },
      },
    ],
  }, 2 * 60 * 1000);

  assert.deepEqual(simulated, {
    token_in: 'ETH',
    token_out: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    amount_in: '0.001',
    chain_id: 8453,
  });
});

test('findRecentSwapPrecheckFromTrace ignores execute=true prepare_swap_transaction calls', () => {
  const simulated = __prepareSwapTest.findRecentSwapPrecheckFromTrace({
    toolCalls: [
      {
        tool: 'prepare_swap_transaction',
        status: 'success',
        args: {
          token_in: 'ETH',
          token_out: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
          amount_in: '0.001',
          chain_id: 8453,
          execute: true,
        },
        result: {
          finishedAt: new Date().toISOString(),
        },
      },
    ],
  }, 2 * 60 * 1000);

  assert.equal(simulated, null);
});

test('repairSwapArgsFromMessages upgrades truncated simulated token addresses using session content', () => {
  const repaired = __prepareSwapTest.repairSwapArgsFromMessages({
    token_in: 'BNB',
    token_out: '0x0bc61768132aa1484e2b09301284b7def78a444',
    amount_in: '0.001',
    chain_id: 56,
  }, [
    {
      content: 'Buy 0x0bc61768132aa1484e2b09301284b7def78a4444 for 0.01 BNB on BSC',
    },
  ]);

  assert.deepEqual(repaired, {
    token_in: 'BNB',
    token_out: '0x0bc61768132aa1484e2b09301284b7def78a4444',
    amount_in: '0.001',
    chain_id: 56,
  });
});
