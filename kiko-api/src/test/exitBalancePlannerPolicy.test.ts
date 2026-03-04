import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { buildEvmExitPlanFromSnapshot } from '../services/copytrade/exit/planner.js';

describe('exit balance planner policy', () => {
  test('mirror sell defers exit when balance oracle is uncertain', () => {
    const plan = buildEvmExitPlanFromSnapshot({
      userId: 'user-1',
      tokenAddress: '0xtoken',
      chainId: 56,
      exitReason: 'mirror_sell',
      tokenInfo: { price: 1, symbol: 'TEST' },
      universalSlippageBps: 500,
      executionMode: 'turbo',
      targetWallet: '0xtarget',
      snapshot: {
        tokenAddress: '0xtoken',
        chainId: 56,
        walletAddress: '0xwallet',
        isMirrorSell: true,
        hasValidPrice: true,
        decimals: 18,
        balanceRaw: 0n,
        balanceUsd: 0,
        treatAsEmptyOrDust: false,
        balanceRead: {
          status: 'uncertain',
          value: 0n,
          reasonCode: 'EXIT_BALANCE_RPC_UNCERTAIN',
          attemptCount: 3,
          lastError: 'rpc down',
          providerSource: 'test',
        },
        positions: [{
          id: 'pos-1',
          tokenAddress: '0xtoken',
          status: 'open',
          entryTxHash: '0xbuy',
        }],
        pendingLots: [],
        latestTargetSellTxHash: '0xsell',
        targetFullExitVerified: true,
        targetFullExitReasonCode: 'TARGET_FULL_EXIT_CONFIRMED',
        attribution: {
          eligiblePositions: [],
          sellAmountRaw: 0n,
          reasonCode: 'NO_CONFIRMED_POSITIONS',
          metrics: {},
          hasExternalBalance: false,
        },
      },
    });

    assert.equal(plan.kind, 'noop');
    assert.equal(plan.action, 'retry_later');
    assert.equal(plan.attributedReasonCode, 'EXIT_BALANCE_RPC_UNCERTAIN');
  });
});
