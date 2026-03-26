import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChatContextSnapshot } from './contracts.js';
import type { CanonicalIntent } from './canonicalIntent.js';
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

function makeCanonicalIntent(overrides: Partial<CanonicalIntent>): CanonicalIntent {
    return {
        domain: 'token',
        intent: 'swap',
        taskMode: 'execute',
        outputMode: 'execution_ready',
        searchMode: 'forbidden',
        searchTarget: 'none',
        confidence: 0.92,
        explanation: 'test intent',
        entities: {
            tokenAddresses: [],
            tokenSymbols: [],
            walletAddresses: [],
            marketIdentifiers: [],
        },
        requestedChain: null,
        timeContext: null,
        evidenceRequirements: [],
        requiresRealtime: false,
        requiresOnchainEvidence: false,
        executionCandidate: true,
        rowCount: null,
        locale: 'en',
        needsClarification: false,
        clarificationQuestion: null,
        source: 'llm',
        ...overrides,
    };
}

test('parseTradingIntent prefers explicit query chain over connected chain for native token inference', () => {
    const canonicalIntent = makeCanonicalIntent({
        entities: {
            tokenAddresses: [],
            tokenSymbols: ['CAKE'],
            walletAddresses: [],
            marketIdentifiers: [],
        },
        requestedChain: {
            chainId: 56,
            chainName: 'BNB Chain',
            source: 'llm',
        },
    });
    const intent = parseTradingIntent('Buy CAKE on BNB chain', makeSnapshot('Buy CAKE on BNB chain', {
        requestedTokenSymbols: ['CAKE', 'BNB'],
        normalizedIntent: canonicalIntent,
    }), canonicalIntent);

    assert.ok(intent);
    assert.equal(intent?.type, 'swap');
    assert.equal(intent?.slots.chain_id, 56);
    assert.equal(intent?.slots.chain_name, 'BNB Chain');
    assert.equal(intent?.slots.token_in, 'BNB');
    assert.equal(intent?.slots.token_out, 'CAKE');
});

test('parseTradingIntent infers Solana from requested token address shape even when connected chain is Base', () => {
    const solAddress = 'So11111111111111111111111111111111111111112';
    const canonicalIntent = makeCanonicalIntent({
        entities: {
            tokenAddresses: [solAddress],
            tokenSymbols: [],
            walletAddresses: [],
            marketIdentifiers: [],
        },
    });
    const intent = parseTradingIntent(`Buy ${solAddress}`, makeSnapshot(`Buy ${solAddress}`, {
        requestedTokenAddresses: [solAddress],
        normalizedIntent: canonicalIntent,
    }), canonicalIntent);

    assert.ok(intent);
    assert.equal(intent?.slots.chain_id, 900);
    assert.equal(intent?.slots.chain_name, 'Solana');
});

test('parseTradingIntent keeps USD-denominated buy semantics instead of treating value as token_in quantity', () => {
    const token = '0x76331326a25904ddcfb0fa7c03b5e2847d49ffff';
    const canonicalIntent = makeCanonicalIntent({
        locale: 'zh',
        entities: {
            tokenAddresses: [token],
            tokenSymbols: ['LOBSTER'],
            walletAddresses: [],
            marketIdentifiers: [],
        },
        requestedChain: {
            chainId: 56,
            chainName: 'BNB Chain',
            source: 'llm',
        },
    });

    const intent = parseTradingIntent(
        '你可以帮我买价值2美金的龙虾王吗？',
        makeSnapshot('你可以帮我买价值2美金的龙虾王吗？', {
            requestedTokenAddresses: [token],
            normalizedIntent: canonicalIntent,
            runtime: {
                chainId: 56,
                chainName: 'BNB Chain',
            },
        }),
        canonicalIntent,
    );

    assert.ok(intent);
    assert.equal(intent?.slots.token_in, 'BNB');
    assert.equal(intent?.slots.token_out, token);
    assert.equal(intent?.slots.amount, '2');
    assert.equal(intent?.slots.amount_kind, 'fiat_value');
    assert.equal(intent?.slots.amount_semantic, 'fiat_value');
    assert.equal(intent?.slots.needs_amount_resolution, true);
});

test('parseTradingIntent preserves sell destination asset for Chinese follow-up turns', () => {
    const token = '0x76331326a25904ddcfb0fa7c03b5e2847d49ffff';
    const canonicalIntent = makeCanonicalIntent({
        locale: 'zh',
        entities: {
            tokenAddresses: [token],
            tokenSymbols: ['LOBSTER'],
            walletAddresses: [],
            marketIdentifiers: [],
        },
        requestedChain: {
            chainId: 56,
            chainName: 'BNB Chain',
            source: 'llm',
        },
    });

    const intent = parseTradingIntent(
        '卖成 BNB',
        makeSnapshot('卖成 BNB', {
            requestedTokenAddresses: [token],
            normalizedIntent: canonicalIntent,
            runtime: {
                chainId: 56,
                chainName: 'BNB Chain',
            },
        }),
        canonicalIntent,
    );

    assert.ok(intent);
    assert.equal(intent?.slots.token_in, token);
    assert.equal(intent?.slots.token_out, 'BNB');
});
