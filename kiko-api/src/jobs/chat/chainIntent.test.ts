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

test('resolveRequestedChainHint keeps bare ETH as wallet context when the connected chain is BNB Chain', () => {
    const result = resolveRequestedChainHint({
        text: 'Buy 0.01 ETH to 0x9aef1e321ea673d0b2ba929de0760ac8a1238ba3',
        requestedTokenSymbols: ['ETH'],
        runtimeChainId: 56,
        runtimeChainName: 'BNB Chain',
    });

    assert.deepEqual(result, {
        chainId: 56,
        chainName: 'BNB Chain',
        source: 'wallet_context',
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

test('resolveCanonicalChainRef prefers task route over stale canonical intent', () => {
    const result = resolveCanonicalChainRef({
        taskRoute: {
            requestedChain: {
                chainId: 8453,
                chainName: 'Base',
                source: 'llm',
            },
        } as any,
        canonicalIntent: {
            requestedChain: {
                chainId: 56,
                chainName: 'BNB Chain',
            },
        } as any,
        runtimeChainId: 137,
        runtimeChainName: 'Polygon',
    });

    assert.deepEqual(result, {
        chainId: 8453,
        chainName: 'Base',
        source: 'task_route',
    });
});
