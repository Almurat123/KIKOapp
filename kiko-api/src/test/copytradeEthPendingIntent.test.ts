import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { inferEthPendingSwapIntent } from '../services/copytrade/eth/ethPendingSwapIntent.js';

describe('copytrade ETH pending intent', () => {
  test('detects native-funded ETH pending swap intent from tracked sender', () => {
    const result = inferEthPendingSwapIntent({
      chainId: 1,
      matchedWallet: '0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed',
      tx: {
        from: '0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed',
        to: '0x0000000000001ff3684f28c67538d4d072c22734',
        input: '0x2213bc0b1234',
        value: '0x1d0dd4793377a',
      },
    });

    assert.ok(result);
    assert.equal(result?.side, 'buy');
    assert.equal(result?.selector, '0x2213bc0b');
    assert.equal(result?.reasonCode, 'ETH_PENDING_NATIVE_SWAP_INTENT');
  });

  test('ignores non-tracked recipient-side matches and non-swap calldata', () => {
    const unmatchedSender = inferEthPendingSwapIntent({
      chainId: 1,
      matchedWallet: '0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed',
      tx: {
        from: '0x1111111111111111111111111111111111111111',
        to: '0x0000000000001ff3684f28c67538d4d072c22734',
        input: '0x2213bc0b1234',
        value: '0x1',
      },
    });
    assert.equal(unmatchedSender, null);

    const nonSwap = inferEthPendingSwapIntent({
      chainId: 1,
      matchedWallet: '0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed',
      tx: {
        from: '0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed',
        to: '0x0000000000001ff3684f28c67538d4d072c22734',
        input: '0xdeadbeef1234',
        value: '0x1',
      },
    });
    assert.equal(nonSwap, null);
  });
});
