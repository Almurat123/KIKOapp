import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyCopytradeAssetEligibility,
  evaluateCopytradeSignalAssetPolicy,
} from '../copytradeAssetEligibility.js';

test('classifyCopytradeAssetEligibility rejects BSC stablecoin and wrapped native', () => {
  const stable = classifyCopytradeAssetEligibility({
    chainId: 56,
    tokenAddress: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  });
  assert.equal(stable.allowed, false);
  assert.equal(stable.reasonCode, 'forbidden_asset_stablecoin');

  const wrappedNative = classifyCopytradeAssetEligibility({
    chainId: 56,
    tokenAddress: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  });
  assert.equal(wrappedNative.allowed, false);
  assert.equal(wrappedNative.reasonCode, 'forbidden_asset_wrapped_native');
});

test('evaluateCopytradeSignalAssetPolicy rejects buying into stablecoin', () => {
  const result = evaluateCopytradeSignalAssetPolicy({
    chainId: 56,
    tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    tokenOut: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    direction: 'buy',
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, 'forbidden_asset_stablecoin');
});
