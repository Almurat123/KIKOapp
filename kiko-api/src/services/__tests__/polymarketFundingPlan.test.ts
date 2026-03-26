import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPolymarketFundingPlan } from '../polymarketFundingPlan.js';

test('buildPolymarketFundingPlan recommends Polygon native USDC conversion when conversion is required', () => {
  const plan = buildPolymarketFundingPlan({
    readiness: {
      isReady: false,
      usdcBalance: '0',
      nativeUsdcBalance: '12.5',
      conversionRequired: true,
      conversionSuggestion: {
        chainId: 137,
        fromToken: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
        toToken: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        amountIn: '12.5',
      },
      missingSteps: ['Convert Polygon native USDC to Polymarket USDC.e'],
    },
    amountUsd: 5,
  });

  assert.equal(plan.status, 'swap_required');
  assert.equal(plan.preferred_action?.tool_name, 'prepare_swap_transaction');
  assert.equal(plan.preferred_action?.args.chain_id, 137);
  assert.equal(plan.preferred_action?.args.amount_in, '5');
});

test('buildPolymarketFundingPlan recommends cross-chain quote when no Polygon funding is available but another chain has stables', () => {
  const plan = buildPolymarketFundingPlan({
    readiness: {
      isReady: false,
      usdcBalance: '0',
      nativeUsdcBalance: '0',
      conversionRequired: false,
      conversionSuggestion: null,
      missingSteps: ['Deposit USDC to your wallet on Polygon'],
    },
    context: {
      allChainBalances: {
        base: {
          tokens: [
            {
              symbol: 'USDC',
              balance: '25',
              contractAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
            },
          ],
        },
      },
    } as any,
    amountUsd: 10,
  });

  assert.equal(plan.status, 'cross_chain_required');
  assert.equal(plan.preferred_action?.tool_name, 'get_cross_chain_quote');
  assert.equal(plan.preferred_action?.args.fromChain, '8453');
  assert.equal(plan.preferred_action?.args.toChain, '137');
  assert.equal(plan.preferred_action?.args.fromAmount, '10');
});

test('buildPolymarketFundingPlan blocks oversized orders even when generic readiness is true', () => {
  const plan = buildPolymarketFundingPlan({
    readiness: {
      isReady: true,
      usdcBalance: '5',
      nativeUsdcBalance: '0',
      conversionRequired: false,
      conversionSuggestion: null,
      missingSteps: [],
    },
    context: {
      allChainBalances: {
        arbitrum: {
          tokens: [
            {
              symbol: 'USDC',
              balance: '100',
              contractAddress: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
            },
          ],
        },
      },
    } as any,
    amountUsd: 20,
  });

  assert.equal(plan.ready_for_requested_order, false);
  assert.equal(plan.additional_usdc_needed, '15');
  assert.equal(plan.status, 'cross_chain_required');
});
