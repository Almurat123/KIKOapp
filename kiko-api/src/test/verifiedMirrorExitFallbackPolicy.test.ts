import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { evaluateVerifiedMirrorExitFallback } from '../services/copytrade-v2/exit/verifiedMirrorExitFallbackPolicy.js';

describe('verified mirror exit fallback policy', () => {
  test('allows full balance fallback for strict full-exit legacy open position', () => {
    const decision = evaluateVerifiedMirrorExitFallback({
      tokenAddress: '0xtoken',
      chainId: 1,
      walletAddress: '0xwallet',
      isMirrorSell: true,
      hasValidPrice: true,
      decimals: 18,
      balanceRaw: 1234n,
      balanceUsd: 1,
      treatAsEmptyOrDust: false,
      balanceRead: {
        status: 'success',
        value: 1234n,
        reasonCode: 'EXIT_BALANCE_CONFIRMED_POSITIVE',
        attemptCount: 1,
        lastError: null,
        providerSource: 'test',
      },
      positions: [{ id: 'pos-1', status: 'open', tokenAddress: '0xtoken' }],
      pendingLots: [],
      latestTargetSellTxHash: '0xsell',
      targetFullExitVerified: true,
      attribution: {
        eligiblePositions: [],
        sellAmountRaw: 0n,
        reasonCode: 'NO_CONFIRMED_POSITIONS',
        metrics: {},
        hasExternalBalance: false,
      },
    });

    assert.equal(decision.shouldFallback, true);
    assert.equal(decision.sellAmountRaw, 1234n);
    assert.equal(decision.reasonCode, 'FULL_BALANCE_FALLBACK');
  });
});
