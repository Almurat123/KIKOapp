import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveRequestedChainHint } from './chainIntent.js';

test('resolveRequestedChainHint recognizes BSC from uppercase chain symbol hints', () => {
    const result = resolveRequestedChainHint({
        text: 'Check early buyers for this token',
        requestedTokenSymbols: ['BSC'],
    });

    assert.deepEqual(result, {
        chainId: 56,
        chainName: 'BNB Chain',
        source: 'chain_symbol',
    });
});

test('resolveRequestedChainHint recognizes Base from uppercase chain symbol hints', () => {
    const result = resolveRequestedChainHint({
        text: 'Check token info',
        requestedTokenSymbols: ['BASE'],
    });

    assert.deepEqual(result, {
        chainId: 8453,
        chainName: 'Base',
        source: 'chain_symbol',
    });
});
