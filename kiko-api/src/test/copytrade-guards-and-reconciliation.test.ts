import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateBuyPriceDeviationGuard } from '../services/copytrade-v2/buy/buyGuardPriceDeviation.js';
import { resolveBuyGuardPolicy } from '../services/copytrade-v2/guards/policy.js';
import { reconcileOpenPositionsForExit } from '../services/copytrade-v2/exit/openPositionReconciliation.js';

test('buy price deviation guard does not misclassify zero oracle price as extreme deviation', () => {
  const result = evaluateBuyPriceDeviationGuard({
    chainId: 1,
    oraclePrice: 0,
    estimatedOut: 10,
    targetSwapValueUsd: 37.87493,
    policy: resolveBuyGuardPolicy('normal'),
  });

  assert.equal(result.passed, false);
  assert.equal(result.reasonCode, 'PRICE_REFERENCE_ZERO');
  assert.equal(result.ratio, undefined);
  assert.equal(result.targetExecutionPrice, 3.787493);
});

test('buy price deviation guard flags true extreme deviation when oracle price is valid', () => {
  const result = evaluateBuyPriceDeviationGuard({
    chainId: 1,
    oraclePrice: 1,
    estimatedOut: 1,
    targetSwapValueUsd: 4.2,
    policy: resolveBuyGuardPolicy('normal'),
  });

  assert.equal(result.passed, false);
  assert.equal(result.reasonCode, 'PRICE_DEVIATION_TOO_HIGH');
  assert.equal(Number(result.ratio?.toFixed(1)), 4.2);
});

test('open position reconciliation matches EVM token positions case-insensitively', () => {
  const result = reconcileOpenPositionsForExit([
    { id: 'p1', tokenAddress: '0xA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48' },
    { id: 'p2', tokenAddress: '0x1111111111111111111111111111111111111111' },
  ], '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 1);

  assert.equal(result.reasonCode, 'POSITIONS_MATCHED');
  assert.equal(result.matchedPositions.length, 1);
  assert.equal(result.matchedPositions[0]?.id, 'p1');
});

test('open position reconciliation maps native placeholder to wrapped native for EVM positions', () => {
  const result = reconcileOpenPositionsForExit([
    { id: 'p1', tokenAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' },
  ], '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', 1);

  assert.equal(result.reasonCode, 'POSITIONS_MATCHED');
  assert.equal(result.matchedPositions.length, 1);
  assert.equal(result.metrics.matchedTokenAddress, '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2');
});
