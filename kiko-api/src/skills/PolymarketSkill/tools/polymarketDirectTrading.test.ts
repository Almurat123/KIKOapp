import test from 'node:test';
import assert from 'node:assert/strict';

import { __directTradingTestables } from './polymarketDirectTrading.js';

test('buildPolymarketReadinessGate blocks orders when conversion is required', () => {
  const result = __directTradingTestables.buildPolymarketReadinessGate({
    hasCredentials: true,
    hasDelegatedEvm: true,
    hasUsdcApproval: true,
    hasCtfApproval: true,
    blockchainStatus: 'ok',
    usdcBalance: '0',
    nativeUsdcBalance: '10',
    walletAddress: '0xabc',
    isReady: false,
    conversionRequired: true,
    conversionSuggestion: {
      chainId: 137,
      fromToken: 'native-usdc',
      toToken: 'usdc.e',
      amountIn: '10',
    },
    missingSteps: ['Convert Polygon native USDC to Polymarket USDC.e'],
  });

  assert.ok(result);
  assert.equal(result?.blocked_by, 'polymarket_readiness');
  assert.equal(result?.readiness.conversion_required, true);
  assert.match(String(result?.error || ''), /blocked/i);
  assert.match(String(result?.next_step || ''), /Convert Polygon native USDC/i);
});

test('buildPolymarketReadinessGate blocks orders when readiness cannot be verified', () => {
  const result = __directTradingTestables.buildPolymarketReadinessGate({
    hasCredentials: true,
    hasDelegatedEvm: true,
    hasUsdcApproval: null,
    hasCtfApproval: null,
    blockchainStatus: 'unavailable',
    usdcBalance: '0',
    nativeUsdcBalance: '0',
    walletAddress: '0xabc',
    isReady: false,
    conversionRequired: false,
    conversionSuggestion: null,
    missingSteps: [],
  });

  assert.ok(result);
  assert.equal(result?.readiness.blockchain_status, 'unavailable');
  assert.match(String(result?.next_step || ''), /could not be verified/i);
});

test('buildPolymarketReadinessGate returns null when account is ready', () => {
  const result = __directTradingTestables.buildPolymarketReadinessGate({
    hasCredentials: true,
    hasDelegatedEvm: true,
    hasUsdcApproval: true,
    hasCtfApproval: true,
    blockchainStatus: 'ok',
    usdcBalance: '25',
    nativeUsdcBalance: '0',
    walletAddress: '0xabc',
    isReady: true,
    conversionRequired: false,
    conversionSuggestion: null,
    missingSteps: [],
  });

  assert.equal(result, null);
});

test('buildPolymarketBlockedOrderResponse exposes a conversion confirmation when Polygon native USDC must be activated', () => {
  const result = __directTradingTestables.buildPolymarketBlockedOrderResponse({
    readiness: {
      hasCredentials: true,
      hasDelegatedEvm: true,
      hasUsdcApproval: true,
      hasCtfApproval: true,
      blockchainStatus: 'ok',
      usdcBalance: '0',
      nativeUsdcBalance: '7',
      walletAddress: '0xabc',
      isReady: false,
      conversionRequired: true,
      conversionSuggestion: {
        chainId: 137,
        fromToken: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
        toToken: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        amountIn: '7',
      },
      missingSteps: ['Convert Polygon native USDC to Polymarket USDC.e'],
    },
    amountUsd: 3,
  });

  assert.ok(result);
  assert.equal(result?.requires_confirmation, true);
  assert.equal(result?.confirmation_payload?.tool_name, 'prepare_swap_transaction');
  assert.equal(result?.confirmation_payload?.action_class, 'TRADE_MUTATION');
});
