import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateAutoExitPriceGuard } from '../runtime/autoExitPriceGuard.js';

test('auto-exit price guard allows rpc-backed exits when validator is temporarily unavailable', () => {
  const result = evaluateAutoExitPriceGuard({
    tokenInfo: {
      price: 0.00000123,
      provider: 'rpc+api',
      priceValidationReason: 'market_validator_unavailable',
      referencePrice: null,
      referenceProvider: null,
      priceFallbackUsed: false,
    }
  });

  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, 'AUTO_EXIT_PRICE_OK');
});

test('auto-exit price guard still blocks hard validation conflicts', () => {
  const result = evaluateAutoExitPriceGuard({
    tokenInfo: {
      price: 0.00000123,
      provider: 'rpc+api',
      priceValidationReason: 'market_validator_reference_conflict',
      referencePrice: null,
      referenceProvider: null,
      priceFallbackUsed: false,
    }
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, 'AUTO_EXIT_PRICE_VALIDATION_FAILED');
});
