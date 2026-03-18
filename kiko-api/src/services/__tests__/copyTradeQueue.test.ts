import test from 'node:test';
import assert from 'node:assert/strict';
import {
  enqueueCopyTradeTask,
  resetCopyTradeQueueForTests,
  setCopyTradeQueueHandlerForTests,
  waitForCopyTradeQueueIdle,
} from '../copyTradeQueue.js';

test('queue boundary suppresses duplicate enqueue for same txHash', async () => {
  resetCopyTradeQueueForTests();
  const handled: string[] = [];
  setCopyTradeQueueHandlerForTests(async (_targetWallet, swap) => {
    handled.push(String(swap?.txHash || ''));
  });

  const swap = {
    txHash: `0xqueue_dedupe_${Date.now().toString(16)}`,
    tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    tokenOut: '0xae58ebfbe35d4f4a320dfb550fe4d27c0d2a7ba3',
    amountIn: '1',
    amountOut: '100',
    dexName: 'uniswap',
  } as any;

  const first = await enqueueCopyTradeTask('0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed', swap, 8453, {
    source: 'test_duplicate_a',
  });
  const second = await enqueueCopyTradeTask('0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed', swap, 8453, {
    source: 'test_duplicate_b',
  });

  await waitForCopyTradeQueueIdle(2_000);

  assert.equal(first, true);
  assert.equal(second, false);
  assert.deepEqual(handled, [swap.txHash]);
});
