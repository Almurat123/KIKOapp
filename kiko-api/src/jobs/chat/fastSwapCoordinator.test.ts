import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChatContextSnapshot } from './contracts.js';
import { deriveFastSwapIntentDraft } from './fastSwapCoordinator.js';

function makeSnapshot(message: string, overrides: Partial<ChatContextSnapshot> = {}): ChatContextSnapshot {
    const { runtime: runtimeOverrides, ...restOverrides } = overrides;
    return {
        sessionId: 'session-1',
        taskId: 'task-1',
        model: 'gpt-5-mini',
        history: [{ role: 'user', content: message }],
        lastUserMessage: message,
        requestedTokenAddresses: [],
        requestedTokenSymbols: [],
        toolDefinitions: [],
        runtime: {
            userSettings: {},
            contextBlocks: {},
            chainId: 8453,
            chainName: 'Base',
            ...(runtimeOverrides || {}),
        },
        ...restOverrides,
    } as ChatContextSnapshot;
}

test('deriveFastSwapIntentDraft lets explicit query chain override connected chain', () => {
    const snapshot = makeSnapshot('Buy CAKE on BNB chain with 1 BNB', {
        requestedTokenSymbols: ['CAKE', 'BNB'],
    });

    const intent = deriveFastSwapIntentDraft(snapshot);

    assert.equal(intent.chainId, 56);
    assert.equal(intent.swapIntent.tokenIn, 'BNB');
    assert.equal(intent.swapIntent.tokenOut, 'CAKE');
});

test('deriveFastSwapIntentDraft does not hard-map ETH to Base when no explicit chain exists', () => {
    const snapshot = makeSnapshot('Swap ETH to USDC', {
        requestedTokenSymbols: ['ETH', 'USDC'],
        runtime: {
            chainId: 1,
            chainName: 'Ethereum',
        },
    });

    const intent = deriveFastSwapIntentDraft(snapshot);

    assert.equal(intent.chainId, 1);
    assert.equal(intent.swapIntent.tokenIn, 'ETH');
    assert.equal(intent.swapIntent.tokenOut, 'USDC');
});
