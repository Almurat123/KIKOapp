import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCopytradeRequestKey,
  buildCopytradeRequestPayloadHash,
  isValidCopytradeRequestKey,
} from '../orders/requestKey.js';

test('copytrade request key is stable for one logical follower order', () => {
  const input = {
    chainId: 8453,
    txHash: '0xABCDEF',
    targetWallet: '0xTARGET',
    userId: 'did:privy:user',
    configId: 'cfg-1',
  };

  const first = buildCopytradeRequestKey(input);
  const second = buildCopytradeRequestKey({
    ...input,
    txHash: '0xabcdef',
    targetWallet: '0xtarget',
  });

  assert.equal(first, second);
  assert.equal(isValidCopytradeRequestKey(first), true);
});

test('copytrade payload hash changes when same request key carries a different trade body', () => {
  const base = {
    chainId: 8453,
    txHash: '0xabc',
    targetWallet: '0xtarget',
    userId: 'did:privy:user',
    configId: 'cfg-1',
    mode: 'turbo',
    tokenIn: 'ETH',
    tokenOut: '0xtoken-a',
    amountIn: '1',
    amountOut: '1000',
  };

  assert.notEqual(
    buildCopytradeRequestPayloadHash(base),
    buildCopytradeRequestPayloadHash({ ...base, tokenOut: '0xtoken-b' }),
  );
});
