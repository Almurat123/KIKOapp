import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPairValidatedNonV4HintedSourcePool,
  resolvePairSafeResolvedHintFromDecodedSwap,
} from '../supplyParser.js';

test('resolvePairSafeResolvedHintFromDecodedSwap drops a tail-hop resolved hint that does not match the requested pair', () => {
  const resolved = resolvePairSafeResolvedHintFromDecodedSwap({
    decoded: {
      tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      tokenOut: '0x4f9fd6be4a90f2620860d680c0d4d5fb53d1a825',
      resolvedPoolHint: {
        kind: 'v2',
        dex: 'uniswap',
        poolAddress: '0x7464850cc1cfb54a2223229b77b1bca2f888d946',
      },
      routeHopCount: 1,
      routeHops: [
        {
          kind: 'v2',
          dex: 'uniswap',
          poolAddress: '0x7464850cc1cfb54a2223229b77b1bca2f888d946',
          tokenIn: '0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b',
          tokenOut: '0x4f9fd6be4a90f2620860d680c0d4d5fb53d1a825',
        },
      ],
      canUseResolvedPoolFastPath: false,
    } as any,
    tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    tokenOut: '0x4f9fd6be4a90f2620860d680c0d4d5fb53d1a825',
    chainId: 8453,
  });

  assert.equal(resolved, null);
});

test('resolvePairSafeResolvedHintFromDecodedSwap keeps a route hop that matches the requested pair', () => {
  const resolved = resolvePairSafeResolvedHintFromDecodedSwap({
    decoded: {
      tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      tokenOut: '0x4f9fd6be4a90f2620860d680c0d4d5fb53d1a825',
      resolvedPoolHint: {
        kind: 'v2',
        dex: 'uniswap',
        poolAddress: '0x7464850cc1cfb54a2223229b77b1bca2f888d946',
      },
      routeHopCount: 1,
      routeHops: [
        {
          kind: 'v2',
          dex: 'uniswap',
          poolAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          tokenIn: '0x4200000000000000000000000000000000000006',
          tokenOut: '0x4f9fd6be4a90f2620860d680c0d4d5fb53d1a825',
        },
      ],
      canUseResolvedPoolFastPath: false,
    } as any,
    tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    tokenOut: '0x4f9fd6be4a90f2620860d680c0d4d5fb53d1a825',
    chainId: 8453,
  });

  assert.deepEqual(resolved, {
    kind: 'v2',
    dex: 'uniswap',
    poolAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    fee: undefined,
  });
});

test('buildPairValidatedNonV4HintedSourcePool rejects non-v4 hints when the actual pool pair does not match the requested pair', () => {
  const sourcePool = buildPairValidatedNonV4HintedSourcePool({
    resolved: {
      kind: 'v2',
      dex: 'uniswap',
      poolAddress: '0x7464850cc1cfb54a2223229b77b1bca2f888d946',
    },
    tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    tokenOut: '0x4f9fd6be4a90f2620860d680c0d4d5fb53d1a825',
    chainId: 8453,
    actualPoolTokens: {
      token0: '0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b',
      token1: '0x4f9fd6be4a90f2620860d680c0d4d5fb53d1a825',
    },
  });

  assert.equal(sourcePool, null);
});

test('buildPairValidatedNonV4HintedSourcePool keeps the actual pool token pair for matched hints', () => {
  const sourcePool = buildPairValidatedNonV4HintedSourcePool({
    resolved: {
      kind: 'v2',
      dex: 'uniswap',
      poolAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    },
    tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    tokenOut: '0x4f9fd6be4a90f2620860d680c0d4d5fb53d1a825',
    chainId: 8453,
    actualPoolTokens: {
      token0: '0x4200000000000000000000000000000000000006',
      token1: '0x4f9fd6be4a90f2620860d680c0d4d5fb53d1a825',
    },
  });

  assert.deepEqual(sourcePool, {
    kind: 'v2',
    dex: 'uniswap',
    pool: {
      poolAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      token0: '0x4200000000000000000000000000000000000006',
      token1: '0x4f9fd6be4a90f2620860d680c0d4d5fb53d1a825',
      fee: 0,
      version: 'v2',
      dex: 'uniswap',
    },
  });
});
