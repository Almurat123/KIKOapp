import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { evaluateOrphanRecovery } from '../services/copytrade/recovery/orphanRecoveryPolicy.js';

describe('orphan recovery policy', () => {
  test('forces exit when target full exit is verified for a single uncontaminated open position', () => {
    const decision = evaluateOrphanRecovery({
      tokenAddress: '0xtoken',
      chainId: 8453,
      walletAddress: '0xwallet',
      isMirrorSell: true,
      hasValidPrice: true,
      decimals: 18,
      balanceRaw: 100n,
      balanceUsd: 1,
      treatAsEmptyOrDust: false,
      balanceRead: {
        status: 'success',
        value: 100n,
        reasonCode: 'EXIT_BALANCE_CONFIRMED_POSITIVE',
        attemptCount: 1,
        lastError: null,
        providerSource: 'test',
      },
      positions: [{ id: 'pos-1', status: 'open', tokenAddress: '0xtoken', entryTxHash: '0xtx' }],
      pendingLots: [],
      latestTargetSellTxHash: '0xtargetsell',
      targetFullExitVerified: true,
      targetFullExitReasonCode: 'TARGET_FULL_EXIT_CONFIRMED',
      attribution: {
        eligiblePositions: [],
        sellAmountRaw: 0n,
        reasonCode: 'NO_CONFIRMED_POSITIONS',
        metrics: {},
        hasExternalBalance: false,
      },
    });

    assert.equal(decision.action, 'force_exit');
  });

  test('quarantines when target full exit is verified but external balance contamination exists', () => {
    const decision = evaluateOrphanRecovery({
      tokenAddress: '0xtoken',
      chainId: 8453,
      walletAddress: '0xwallet',
      isMirrorSell: true,
      hasValidPrice: true,
      decimals: 18,
      balanceRaw: 100n,
      balanceUsd: 1,
      treatAsEmptyOrDust: false,
      balanceRead: {
        status: 'success',
        value: 100n,
        reasonCode: 'EXIT_BALANCE_CONFIRMED_POSITIVE',
        attemptCount: 1,
        lastError: null,
        providerSource: 'test',
      },
      positions: [{ id: 'pos-1', status: 'open', tokenAddress: '0xtoken', entryTxHash: '0xtx' }],
      pendingLots: [],
      latestTargetSellTxHash: '0xtargetsell',
      targetFullExitVerified: true,
      targetFullExitReasonCode: 'TARGET_FULL_EXIT_CONFIRMED',
      attribution: {
        eligiblePositions: [],
        sellAmountRaw: 0n,
        reasonCode: 'NO_CONFIRMED_POSITIONS',
        metrics: {},
        hasExternalBalance: true,
      },
    });

    assert.equal(decision.action, 'quarantine');
  });

  test('keeps mirror sell open when verified target exit sees zero follower balance', () => {
    const decision = evaluateOrphanRecovery({
      tokenAddress: '0xtoken',
      chainId: 8453,
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
        attemptCount: 2,
        lastError: null,
        providerSource: 'test',
      },
      positions: [{ id: 'pos-1', status: 'open', tokenAddress: '0xtoken', entryTxHash: '0xtx' }],
      pendingLots: [],
      latestTargetSellTxHash: '0xtargetsell',
      targetFullExitVerified: true,
      targetFullExitReasonCode: 'TARGET_FULL_EXIT_CONFIRMED',
      attribution: {
        eligiblePositions: [],
        sellAmountRaw: 0n,
        reasonCode: 'NO_CONFIRMED_POSITIONS',
        metrics: {},
        hasExternalBalance: false,
      },
    });

    assert.equal(decision.action, 'noop');
    assert.equal(decision.reasonCode, 'orphan_recovery_target_exit_balance_empty_keep_open');
  });
});
