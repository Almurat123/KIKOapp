import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { buildSwapExecutionContext } from '../services/copytrade-v2/context/contextBuilder.js';

describe('solana context builder', () => {
  test('preserves case-sensitive solana hash and token mints', () => {
    const txHash = '5VkQyYyyTgVSE6Ja3krxobMXAqa1w4Yuxd6S3vYxVg8P5Y4gwtWojzPj9g8Wvs2no7Hgr2bMWkr2vsmGfP9QhS2A';
    const tokenIn = 'So11111111111111111111111111111111111111112';
    const tokenOut = 'AoeaVegh2RuPxG4e8P7M2Y3hW7HTJERJQ5WsRf2z8QLe';
    const routerProgram = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4';

    const context = buildSwapExecutionContext({
      chainId: 900,
      tx: {
        hash: txHash,
        to: routerProgram,
        input: '',
        value: '0',
      },
      decodedSwap: {
        txHash,
        tokenIn,
        tokenOut,
        amountIn: '1000000',
        amountOut: '123456',
        routeHops: [],
      } as any,
      targetWallet: '9xQeWvG816bUx9EPjHmaT23yvVMw6QTRPP6u8u78mfpn',
    });

    assert.equal(context.sourceTxHash, txHash);
    assert.equal(context.tokenIn, tokenIn);
    assert.equal(context.tokenOut, tokenOut);
    assert.equal(context.sourceRouter, routerProgram);
    assert.equal(context.trace?.targetWallet, '9xQeWvG816bUx9EPjHmaT23yvVMw6QTRPP6u8u78mfpn');
  });
});
