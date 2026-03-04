import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { buildEthPendingPredecodedSwap } from '../services/copytrade-v2/eth/ethPendingPredecodedSwap.js';
import { resolveCopyTradeQueuePriority } from '../services/copytrade-v2/eth/ethBuyFastPath.js';
import { resolveEthPendingSelectorCapability } from '../services/copytrade-v2/eth/ethPendingSelectorRegistry.js';

describe('copytrade ETH pending calldata predecoded swap', () => {
  test('builds a provisional native buy swap from supported ETH calldata', () => {
    const wallet = '0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed';
    const router = '0x0000000000001ff3684f28c67538d4d072c22734';
    const tokenOut = '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984';
    const input = [
      '0x2213bc0b',
      '0000000000000000000000002cd32fb42748774fafde72d8607f16ccc5f5c0ed',
      '0000000000000000000000000000000000001ff3684f28c67538d4d072c22734',
      '0000000000000000000000001f9840a85d5af5bf1d1762f925bdaddc4201f984',
    ].join('');

    const result = buildEthPendingPredecodedSwap({
      chainId: 1,
      matchedWallet: wallet,
      txHash: '0xabc',
      tx: {
        from: wallet,
        to: router,
        input,
        value: '0x1d0dd4793377a',
      },
    });

    assert.ok(result);
    assert.equal(result?.tokenIn, '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');
    assert.equal(result?.tokenOut, tokenOut);
    assert.equal(result?.amountOut, '0');
    assert.equal(result?.sourceSelector, '0x2213bc0b');
    assert.equal(result?.cashLegHint?.inferredTxType, 'TARGET_BUY');
  });

  test('gives pending calldata predecoded tasks top ETH queue priority', () => {
    const pendingCalldata = resolveCopyTradeQueuePriority({
      chainId: 1,
      source: 'pending_calldata_predecoded',
    });
    const pendingPrefetch = resolveCopyTradeQueuePriority({
      chainId: 1,
      source: 'pending_prefetch',
    });
    const webhook = resolveCopyTradeQueuePriority({
      chainId: 1,
      source: 'webhook_decode',
    });

    assert.ok(pendingCalldata > pendingPrefetch);
    assert.ok(pendingPrefetch > webhook);
  });

  test('marks unsupported selectors for explicit fallback instead of mis-decoding', () => {
    const capability = resolveEthPendingSelectorCapability('0x791ac947');
    assert.equal(capability.kind, 'unsupported');
    assert.equal(capability.reasonCode, 'PENDING_PREDECODE_UNSUPPORTED_SELECTOR');

    const wallet = '0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed';
    const result = buildEthPendingPredecodedSwap({
      chainId: 1,
      matchedWallet: wallet,
      txHash: '0xdef',
      tx: {
        from: wallet,
        to: '0x0000000000001ff3684f28c67538d4d072c22734',
        input: '0x791ac9471234',
        value: '0x0',
      },
    });
    assert.equal(result, null);
  });
});
