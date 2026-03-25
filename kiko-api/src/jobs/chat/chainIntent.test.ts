import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveCanonicalChainRef, resolveRequestedChainHint } from './chainIntent.js';

test('resolveRequestedChainHint recognizes BSC from uppercase chain symbol hints', () => {
    const result = resolveRequestedChainHint({
        text: 'Check early buyers for this token',
        requestedTokenSymbols: ['BSC'],
    });

    assert.deepEqual(result, {
        chainId: 56,
        chainName: 'BNB Chain',
        source: 'entity_hint',
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
        source: 'entity_hint',
    });
});

test('resolveCanonicalChainRef prefers canonical intent over wallet context', () => {
    const result = resolveCanonicalChainRef({
        canonicalIntent: {
            requestedChain: {
                chainId: 56,
                chainName: 'BNB Chain',
            },
        } as any,
        runtimeChainId: 8453,
        runtimeChainName: 'Base',
    });

    assert.deepEqual(result, {
        chainId: 56,
        chainName: 'BNB Chain',
        source: 'normalized_intent',
    });
});
