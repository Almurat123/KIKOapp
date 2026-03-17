import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChatContextSnapshot } from './contracts.js';
import { parseTradingIntent } from './tradingIntentResolver.js';

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

test('parseTradingIntent prefers explicit query chain over connected chain for native token inference', () => {
    const intent = parseTradingIntent('Buy CAKE on BNB chain', makeSnapshot('Buy CAKE on BNB chain', {
        requestedTokenSymbols: ['CAKE', 'BNB'],
    }));

    assert.ok(intent);
    assert.equal(intent?.type, 'swap');
    assert.equal(intent?.slots.chain_id, 56);
    assert.equal(intent?.slots.chain_name, 'BNB Chain');
    assert.equal(intent?.slots.token_in, 'BNB');
    assert.equal(intent?.slots.token_out, 'CAKE');
});

test('parseTradingIntent infers Solana from requested token address shape even when connected chain is Base', () => {
    const solAddress = 'So11111111111111111111111111111111111111112';
    const intent = parseTradingIntent(`Buy ${solAddress}`, makeSnapshot(`Buy ${solAddress}`, {
        requestedTokenAddresses: [solAddress],
    }));

    assert.ok(intent);
    assert.equal(intent?.slots.chain_id, 900);
    assert.equal(intent?.slots.chain_name, 'Solana');
});
