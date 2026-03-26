import assert from 'node:assert/strict';
import test from 'node:test';

import { parseIntent } from './intentParser.js';

test('parseIntent preserves USD-denominated buy semantics for Chinese trade requests', async () => {
    const parsed = await parseIntent('你可以帮我买价值2美金的龙虾王吗？', {
        chainId: 56,
        chainName: 'BNB Chain',
        isWalletConnected: true,
    } as any);

    assert.equal(parsed.detailed.action, 'swap');
    assert.equal(parsed.swapIntent?.tokenIn, 'BNB');
    assert.equal(parsed.swapIntent?.amount, '2');
    assert.equal(parsed.detailed.amount_semantic, 'input');
});

test('parseIntent keeps explicit sell destination asset in Chinese', async () => {
    const parsed = await parseIntent('卖成 BNB', {
        chainId: 56,
        chainName: 'BNB Chain',
        isWalletConnected: true,
        pendingSwapToken: {
            symbol: 'LOBSTER',
        },
    } as any);

    assert.equal(parsed.detailed.action, 'swap');
    assert.equal(parsed.swapIntent?.tokenIn, 'LOBSTER');
    assert.equal(parsed.swapIntent?.tokenOut, 'BNB');
});
