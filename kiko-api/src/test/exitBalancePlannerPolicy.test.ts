import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { buildEvmExitPlanFromSnapshot } from '../services/copytrade-v2/exit/planner.js';

describe('exit balance planner policy', () => {
  test('take-profit exit should proceed when attributed amount is clamped to on-chain balance', () => {
    const plan = buildEvmExitPlanFromSnapshot({
      userId: 'user-1',
      tokenAddress: '0xtoken',
      chainId: 8453,
      exitReason: 'take_profit',
      tokenInfo: { price: 1, symbol: 'TEST' },
      universalSlippageBps: 500,
      executionMode: 'turbo',
      targetWallet: '0xtarget',
      snapshot: {
        tokenAddress: '0xtoken',
        chainId: 8453,
        walletAddress: '0xwallet',
        isMirrorSell: false,
        hasValidPrice: true,
        decimals: 18,
        balanceRaw: 100n,
        balanceUsd: 0,
        treatAsEmptyOrDust: false,
        balanceRead: {
          status: 'success',
          value: 100n,
          reasonCode: 'EXIT_BALANCE_CONFIRMED_POSITIVE',
          attemptCount: 1,
          lastError: null,
          providerSource: 'test',
        },
        positions: [{
          id: 'pos-1',
          tokenAddress: '0xtoken',
          status: 'open',
          entryTxHash: '0xbuy',
        }],
        pendingLots: [],
        latestTargetSellTxHash: null,
        targetFullExitVerified: false,
        targetFullExitReasonCode: null,
        attribution: {
          eligiblePositions: [{
            id: 'pos-1',
            tokenAddress: '0xtoken',
            status: 'open',
            entryTxHash: '0xbuy',
          }],
          sellAmountRaw: 100n,
          reasonCode: 'ATTRIBUTED_AMOUNT_CLAMPED_TO_ONCHAIN_BALANCE',
          metrics: {},
          hasExternalBalance: false,
        },
      },
    });

    assert.equal(plan.kind, 'swap');
    if (plan.kind === 'swap') {
      assert.equal(plan.attributedBalance, 100n);
      assert.equal(plan.amountInHuman, '0.0000000000000001');
    }
  });

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

  test('mirror sell keeps position open on confirmed zero balance', () => {
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
        treatAsEmptyOrDust: true,
        balanceRead: {
          status: 'success',
          value: 0n,
          reasonCode: 'EXIT_BALANCE_CONFIRMED_ZERO',
          attemptCount: 3,
          lastError: null,
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
          reasonCode: 'ONCHAIN_BALANCE_EMPTY',
          metrics: {},
          hasExternalBalance: false,
        },
      },
    });

    assert.equal(plan.kind, 'noop');
    assert.equal(plan.action, 'keep_open');
  });

  test('mirror sell closes when target exit verified and follower sold >=95%', () => {
    const plan = buildEvmExitPlanFromSnapshot({
      userId: 'user-1',
      tokenAddress: '0xtoken',
      chainId: 8453,
      exitReason: 'mirror_sell',
      tokenInfo: { price: 1, symbol: 'TEST' },
      universalSlippageBps: 500,
      executionMode: 'turbo',
      targetWallet: '0xtarget',
      snapshot: {
        tokenAddress: '0xtoken',
        chainId: 8453,
        walletAddress: '0xwallet',
        isMirrorSell: true,
        hasValidPrice: true,
        decimals: 18,
        balanceRaw: 40n,
        balanceUsd: 0.00000000000000004,
        treatAsEmptyOrDust: false,
        balanceRead: {
          status: 'success',
          value: 40n,
          reasonCode: 'EXIT_BALANCE_CONFIRMED_POSITIVE',
          attemptCount: 1,
          lastError: null,
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
          eligiblePositions: [{
            id: 'pos-1',
            tokenAddress: '0xtoken',
            status: 'open',
            entryTxHash: '0xbuy',
          }],
          sellAmountRaw: 40n,
          reasonCode: 'PENDING_ATTRIBUTED_AMOUNT_CLAMPED_TO_ONCHAIN_BALANCE',
          metrics: {
            attributedAmountRaw: '1000',
          },
          hasExternalBalance: false,
        },
      },
    });

    assert.equal(plan.kind, 'noop');
    assert.equal(plan.action, 'close_position');
    assert.equal(plan.closeReason, 'balance_dust');
  });

  test('mirror sell does not ratio-close when external balance contamination exists', () => {
    const plan = buildEvmExitPlanFromSnapshot({
      userId: 'user-1',
      tokenAddress: '0xtoken',
      chainId: 8453,
      exitReason: 'mirror_sell',
      tokenInfo: { price: 1, symbol: 'TEST' },
      universalSlippageBps: 500,
      executionMode: 'turbo',
      targetWallet: '0xtarget',
      snapshot: {
        tokenAddress: '0xtoken',
        chainId: 8453,
        walletAddress: '0xwallet',
        isMirrorSell: true,
        hasValidPrice: true,
        decimals: 18,
        balanceRaw: 40n,
        balanceUsd: 0.00000000000000004,
        treatAsEmptyOrDust: false,
        balanceRead: {
          status: 'success',
          value: 40n,
          reasonCode: 'EXIT_BALANCE_CONFIRMED_POSITIVE',
          attemptCount: 1,
          lastError: null,
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
          eligiblePositions: [{
            id: 'pos-1',
            tokenAddress: '0xtoken',
            status: 'open',
            entryTxHash: '0xbuy',
          }],
          sellAmountRaw: 40n,
          reasonCode: 'PENDING_ATTRIBUTED_AMOUNT_CLAMPED_TO_ONCHAIN_BALANCE',
          metrics: {
            attributedAmountRaw: '1000',
          },
          hasExternalBalance: true,
        },
      },
    });

    assert.equal(plan.kind, 'swap');
  });
});
