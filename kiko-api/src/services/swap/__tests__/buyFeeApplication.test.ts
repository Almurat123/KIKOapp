import assert from 'node:assert/strict';
import test from 'node:test';

import { env } from '../../../config/env.js';
import {
  buildBuyFeeApplicationFromDirectSettlement,
  buildInlineAggregatorBuyFeeApplication,
} from '../fee/buyFeeApplication.js';

test('buildBuyFeeApplicationFromDirectSettlement returns direct_post_trade fee fact', () => {
  const restore = {
    enabled: env.platformFees.enabled,
    copyTradeBps: env.platformFees.copyTradeBps,
    evmRecipient: env.platformFees.evmRecipient,
  };
  env.platformFees.enabled = true;
  env.platformFees.copyTradeBps = 100;
  env.platformFees.evmRecipient = '0xc5377e6329770be29ef938d8acc11f22398d7e54';
  const fact = buildBuyFeeApplicationFromDirectSettlement({
    amountIn: '0.1',
    chainId: 8453,
    mode: 'copytrade',
    normalizedTokenIn: '0xeeee',
    normalizedTokenOut: '0xtoken',
    amountOutBase: '123',
    feeContext: 'copyTrade',
    deferred: true,
    reasonCode: 'broadcasted_unseen',
    sourceTxHash: '0xabc',
  });

  assert.deepEqual(fact, {
    kind: 'direct_post_trade',
    feeContext: 'copyTrade',
    feeBps: 100,
    feeRecipient: '0xc5377e6329770be29ef938d8acc11f22398d7e54',
    feeToken: '0xtoken',
    chargeFeeBy: null,
    sourceTxHash: '0xabc',
    deferred: true,
    reasonCode: 'broadcasted_unseen',
    provider: null,
  });
  env.platformFees.enabled = restore.enabled;
  env.platformFees.copyTradeBps = restore.copyTradeBps;
  env.platformFees.evmRecipient = restore.evmRecipient;
});

test('buildInlineAggregatorBuyFeeApplication returns aggregator_inline fee fact', () => {
  const restore = {
    enabled: env.platformFees.enabled,
    copyTradeBps: env.platformFees.copyTradeBps,
    evmRecipient: env.platformFees.evmRecipient,
  };
  env.platformFees.enabled = true;
  env.platformFees.copyTradeBps = 100;
  env.platformFees.evmRecipient = '0xc5377e6329770be29ef938d8acc11f22398d7e54';
  const fact = buildInlineAggregatorBuyFeeApplication({
    feeContext: 'copyTrade',
    feeToken: '0xeeee',
    sourceTxHash: '0xdef',
    provider: 'aggregator_fallback_0x_turbo',
  });

  assert.deepEqual(fact, {
    kind: 'aggregator_inline',
    feeContext: 'copyTrade',
    feeBps: 100,
    feeRecipient: '0xc5377e6329770be29ef938d8acc11f22398d7e54',
    feeToken: '0xeeee',
    chargeFeeBy: 'currency_in',
    sourceTxHash: '0xdef',
    deferred: false,
    reasonCode: 'aggregator_inline_fee',
    provider: 'aggregator_fallback_0x_turbo',
  });
  env.platformFees.enabled = restore.enabled;
  env.platformFees.copyTradeBps = restore.copyTradeBps;
  env.platformFees.evmRecipient = restore.evmRecipient;
});
