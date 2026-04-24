import assert from 'node:assert/strict';
import test from 'node:test';

import { getZeroExTokenMetadata, __testOnly } from './zeroEx.js';

const BASE_USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';

test('getZeroExTokenMetadata caches fallback metadata instead of a 404 null entry', async () => {
  __testOnly.clearTokenMetadataCache();
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;

  globalThis.fetch = (async () => {
    fetchCount += 1;
    return new Response('not found', { status: 404 });
  }) as typeof fetch;

  try {
    const first = await getZeroExTokenMetadata(BASE_USDC, 8453);
    assert.equal(first?.decimals, 6);
    assert.equal(first?.symbol, 'USDC');

    const cacheEntry = __testOnly.getTokenMetadataCacheEntry(8453, BASE_USDC);
    assert.equal(cacheEntry?.data?.decimals, 6);
    assert.notEqual(cacheEntry?.data, null);

    const second = await getZeroExTokenMetadata(BASE_USDC, 8453);
    assert.equal(second?.decimals, 6);
    assert.equal(fetchCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
    __testOnly.clearTokenMetadataCache();
  }
});
