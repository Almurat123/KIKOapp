import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDisplayAmounts, formatAtomicAmount } from './crossChainTools.js';

test('formatAtomicAmount formats USDC atomic units for display', () => {
    assert.equal(formatAtomicAmount('10000000', 6), '10');
    assert.equal(formatAtomicAmount('9975000', 6), '9.975');
});

test('buildDisplayAmounts derives human-readable values from LI.FI quote payload', () => {
    const display = buildDisplayAmounts({
        id: 'route-1',
        type: 'lifi',
        tool: 'cbridge',
        action: {
            fromChainId: 8453,
            toChainId: 137,
            fromToken: { address: '0xfrom', symbol: 'USDC', decimals: 6 },
            toToken: { address: '0xto', symbol: 'USDC', decimals: 6 },
        },
        estimate: {
            fromAmount: '10000000',
            toAmount: '9975000',
            toAmountMin: '9900000',
            executionDuration: 4,
        },
    }, '10');

    assert.equal(display.amountInDisplay, '10');
    assert.equal(display.amountOutDisplay, '9.975');
    assert.equal(display.minAmountOutDisplay, '9.9');
    assert.equal(display.tokenInDecimals, 6);
    assert.equal(display.tokenOutDecimals, 6);
});
