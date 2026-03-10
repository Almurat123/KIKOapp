import assert from 'node:assert/strict';
import test from 'node:test';

import { deriveTradingReadinessState } from '../polymarketApprovalService.js';

test('deriveTradingReadinessState requires conversion when only Polygon native USDC is present', () => {
  const result = deriveTradingReadinessState({
    blockchainCallFailed: false,
    hasDelegatedEvm: true,
    usdcApproved: false,
    ctfApproved: false,
    usdcBalance: '0',
    nativeUsdcBalance: '12.5'
  });

  assert.equal(result.conversionRequired, true);
  assert.equal(result.conversionSuggestion?.chainId, 137);
  assert.equal(result.conversionSuggestion?.amountIn, '12.5');
  assert.equal(result.missingSteps.includes('Convert Polygon native USDC to Polymarket USDC.e'), true);
  assert.equal(result.missingSteps.includes('Deposit USDC to your wallet on Polygon'), false);
});

test('deriveTradingReadinessState does not require conversion when bridged USDC.e is already funded and approvals exist', () => {
  const result = deriveTradingReadinessState({
    blockchainCallFailed: false,
    hasDelegatedEvm: true,
    usdcApproved: true,
    ctfApproved: true,
    usdcBalance: '5',
    nativeUsdcBalance: '0'
  });

  assert.equal(result.conversionRequired, false);
  assert.equal(result.isReady, true);
  assert.deepEqual(result.missingSteps, []);
});
