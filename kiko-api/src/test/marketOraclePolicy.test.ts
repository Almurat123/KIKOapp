import test from 'node:test';
import assert from 'node:assert/strict';

import { decideValidatedMarketPrice } from '../services/pricing/launchpadOraclePolicy.js';
import { evaluateBuyPriceDeviationGuard } from '../services/copytrade/buy/buyGuardPriceDeviation.js';
import { resolveBuyGuardPolicy } from '../services/copytrade/guards/policy.js';

test('single-source near-zero external validator cannot override sane rpc market price', () => {
  const decision = decideValidatedMarketPrice({
    rpcPriceUsd: 4.034525965833,
    dexPriceUsd: 0.000000000003138,
    liquidityPriceUsd: 0,
    provider: 'rpc+api',
  });

  assert.equal(decision.finalPriceUsd, 4.034525965833);
  assert.equal(decision.finalProvider, 'rpc+api');
  assert.equal(decision.fallbackUsed, false);
  assert.equal(decision.reasonCode, 'market_validator_single_source_outlier_rejected');
});

test('replicated ETH buy scenario no longer collapses oracle price to zero', () => {
  const decision = decideValidatedMarketPrice({
    rpcPriceUsd: 4.034525965833,
    dexPriceUsd: 0.000000000003138,
    liquidityPriceUsd: 0,
    provider: 'rpc+api',
  });

  const guard = evaluateBuyPriceDeviationGuard({
    chainId: 1,
    oraclePrice: decision.finalPriceUsd,
    oracleProvider: decision.finalProvider,
    estimatedOut: 1,
    targetSwapValueUsd: 3.85672,
    strictTargetSwapValueUsd: 3.85672,
    strictTargetSwapValueReliable: true,
    strictTargetSwapValueSource: 'native_like_source_tx_value',
    policy: resolveBuyGuardPolicy('normal'),
    maxRatio: 3,
  });

  assert.equal(guard.reasonCode, 'PRICE_DEVIATION_OK');
  assert.equal(guard.passed, true);
});

test('corroborated external references can still override bad rpc price', () => {
  const decision = decideValidatedMarketPrice({
    rpcPriceUsd: 18,
    dexPriceUsd: 4.01,
    liquidityPriceUsd: 4.03,
    provider: 'rpc+api',
  });

  assert.equal(decision.fallbackUsed, true);
  assert.match(String(decision.finalProvider), /^(0x-dex|dexscreener-liquidity)$/);
  assert.match(String(decision.reasonCode), /^market_price_deviation_(dex|liquidity)$/);
});
