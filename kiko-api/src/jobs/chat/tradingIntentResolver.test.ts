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

test('parseTradingIntent prefers a fresh amount adjustment over a stale swap confirmation', () => {
    const token = '0x0bc61768132aa1484e2b09301284b7def78a4444';
    const canonicalIntent = makeCanonicalIntent({
        entities: {
            tokenAddresses: [token],
            tokenSymbols: ['BENJI'],
            walletAddresses: [],
            marketIdentifiers: [],
        },
        requestedChain: {
            chainId: 56,
            chainName: 'BNB Chain',
            source: 'llm',
        },
    });

    const intent = parseTradingIntent('0.001 BNB', makeSnapshot('0.001 BNB', {
        requestedTokenAddresses: [token],
        requestedTokenSymbols: ['BENJI', 'BNB'],
        normalizedIntent: canonicalIntent,
        confirmationState: {
            kind: 'swap_confirmation',
            swap: {
                tokenIn: 'BNB',
                tokenOut: token,
                amountIn: '0.01',
                chainId: 56,
                isCrossChain: false,
            },
        },
        runtime: {
            chainId: 56,
            chainName: 'BNB Chain',
        },
    }), canonicalIntent);

    assert.ok(intent);
    assert.equal(intent?.kind, 'trading');
    assert.equal(intent?.type, 'swap');
    assert.equal(intent?.slots.amount, '0.001');
    assert.equal(intent?.slots.token_in, 'BNB');
    assert.equal(intent?.slots.token_out, token);
});

test('parseTradingIntent does not turn an analysis request into trade confirmation from stale swap context', () => {
    const token = '0x3e17ee3B1895dD1A7CF993A89769C5e029584444';
    const canonicalIntent = makeCanonicalIntent({
        intent: 'early_buyers',
        taskMode: 'analyze',
        outputMode: 'full_table',
        searchMode: 'fallback',
        executionCandidate: false,
        entities: {
            tokenAddresses: [token.toLowerCase()],
            tokenSymbols: [],
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
        `你能告诉我${token}的早期购买者吗？`,
        makeSnapshot(`你能告诉我${token}的早期购买者吗？`, {
            requestedTokenAddresses: [token.toLowerCase()],
            normalizedIntent: canonicalIntent,
            confirmationState: {
                kind: 'swap_confirmation',
                swap: {
                    tokenIn: 'BNB',
                    tokenOut: token,
                    amountIn: '0.001',
                    chainId: 56,
                    isCrossChain: false,
                },
            },
            runtime: {
                chainId: 56,
                chainName: 'BNB Chain',
            },
        }),
        canonicalIntent,
    );

    assert.equal(intent, null);
});

test('parseTradingIntent prefers task route swap owner over stale canonical analysis intent', () => {
    const token = '0x0bc61768132aa1484e2b09301284b7def78a4444';
    const intent = parseTradingIntent('Buy 0.001 BNB worth of BENJI on Base', makeSnapshot('Buy 0.001 BNB worth of BENJI on Base', {
        requestedTokenAddresses: [token],
        requestedTokenSymbols: ['BENJI', 'BNB'],
        taskRoute: {
            owner: 'swap',
            phase: 'execute',
            facets: [],
            entities: {
                tokenAddresses: [token],
                tokenSymbols: ['BENJI', 'BNB'],
                walletAddresses: [],
                marketIdentifiers: [],
                imageRefs: [],
            },
            requestedChain: {
                chainId: 8453,
                chainName: 'Base',
                source: 'llm',
            },
            timeContext: null,
            rowCount: null,
            inheritEntitiesFromContext: false,
            locale: 'en',
            needsClarification: false,
            clarificationQuestion: null,
            explanation: 'Execute the swap now.',
            confidence: 0.95,
            source: 'llm',
        } as any,
        normalizedIntent: makeCanonicalIntent({
            intent: 'early_buyers',
            taskMode: 'analyze',
            outputMode: 'full_table',
            executionCandidate: false,
            entities: {
                tokenAddresses: [token],
                tokenSymbols: ['BENJI'],
                walletAddresses: [],
                marketIdentifiers: [],
            },
            requestedChain: {
                chainId: 56,
                chainName: 'BNB Chain',
                source: 'llm',
            },
        }),
        runtime: {
            chainId: 8453,
            chainName: 'Base',
        },
    }));

    assert.ok(intent);
    assert.equal(intent?.type, 'swap');
    assert.equal(intent?.slots.chain_id, 8453);
    assert.equal(intent?.slots.chain_name, 'Base');
});

test('parseTradingIntent keeps task-route plain swap flow when stale canonical says cross-chain', () => {
    const token = '0x0bc61768132aa1484e2b09301284b7def78a4444';
    const intent = parseTradingIntent('Buy 0.001 BNB worth of BENJI on Base', makeSnapshot('Buy 0.001 BNB worth of BENJI on Base', {
        requestedTokenAddresses: [token],
        requestedTokenSymbols: ['BENJI', 'BNB'],
        taskRoute: {
            owner: 'swap',
            phase: 'execute',
            facets: [],
            entities: {
                tokenAddresses: [token],
                tokenSymbols: ['BENJI', 'BNB'],
                walletAddresses: [],
                marketIdentifiers: [],
                imageRefs: [],
            },
            requestedChain: {
                chainId: 8453,
                chainName: 'Base',
                source: 'llm',
            },
            timeContext: null,
            rowCount: null,
            inheritEntitiesFromContext: false,
            locale: 'en',
            needsClarification: false,
            clarificationQuestion: null,
            explanation: 'Execute a plain single-chain swap.',
            confidence: 0.96,
            source: 'llm',
        } as any,
        normalizedIntent: makeCanonicalIntent({
            intent: 'cross_chain_swap',
            taskMode: 'execute',
            requestedChain: {
                chainId: 8453,
                chainName: 'Base',
                source: 'llm',
            },
            entities: {
                tokenAddresses: [token],
                tokenSymbols: ['BENJI', 'BNB'],
                walletAddresses: [],
                marketIdentifiers: [],
            },
        }),
        runtime: {
            chainId: 8453,
            chainName: 'Base',
        },
    }));

    assert.ok(intent);
    assert.equal(intent?.kind, 'trading');
    assert.equal(intent?.type, 'swap');
    assert.equal(intent?.slots.chain_id, 8453);
    assert.equal(intent?.slots.token_out, token);
});

test('parseTradingIntent prefers the literal copy-trade wallet from the latest user message over malformed normalized wallet entities', () => {
    const literalWallet = '0xbd708164137146ac234aceb75d3981cd3599e21a';
    const malformedWallet = '0xbd708164137146ac234aceb75d3981cd359e21a';
    const canonicalIntent = makeCanonicalIntent({
        intent: 'copy_trade',
        entities: {
            tokenAddresses: [],
            tokenSymbols: [],
            walletAddresses: [malformedWallet],
            marketIdentifiers: [],
        },
        requestedChain: {
            chainId: 56,
            chainName: 'BNB Chain',
            source: 'llm',
        },
    });

    const intent = parseTradingIntent(
        `Copy Trade ${literalWallet} with $8 per trade at BSC, Auto Sell: YES, TP: 500%, SL: 75%`,
        makeSnapshot(`Copy Trade ${literalWallet} with $8 per trade at BSC, Auto Sell: YES, TP: 500%, SL: 75%`, {
            requestedTokenAddresses: [literalWallet],
            normalizedIntent: canonicalIntent,
        }),
        canonicalIntent,
    );

    assert.equal(intent?.type, 'copy_trade');
    assert.equal(intent?.slots.target_wallet, literalWallet);
    assert.equal(intent?.slots.chain_id, 56);
});

test('parseTradingIntent marks copy-trade target wallet ambiguous when the latest user message contains multiple wallets', () => {
    const firstWallet = '0xbd708164137146ac234aceb75d3981cd3599e21a';
    const secondWallet = '0x077b9981bc8a2ca417cea41861111da63266988b';
    const canonicalIntent = makeCanonicalIntent({
        intent: 'copy_trade',
        entities: {
            tokenAddresses: [],
            tokenSymbols: [],
            walletAddresses: [firstWallet],
            marketIdentifiers: [],
        },
        requestedChain: {
            chainId: 56,
            chainName: 'BNB Chain',
            source: 'llm',
        },
    });

    const intent = parseTradingIntent(
        `Copy Trade ${firstWallet} and ${secondWallet} with $8 per trade at BSC`,
        makeSnapshot(`Copy Trade ${firstWallet} and ${secondWallet} with $8 per trade at BSC`, {
            normalizedIntent: canonicalIntent,
        }),
        canonicalIntent,
    );

    assert.equal(intent?.type, 'copy_trade');
    assert.equal(intent?.slots.target_wallet, undefined);
    assert.equal(intent?.slots.target_wallet_ambiguous, true);
    assert.deepEqual(intent?.slots.target_wallet_candidates, [firstWallet, secondWallet]);
});

test('parseTradingIntent does not reuse token contract carry-over as copy-trade wallet fallback', () => {
    const token = '0x4972e029f2e1831d205b20d05833cc771feb2ba3';
    const canonicalIntent = makeCanonicalIntent({
        intent: 'copy_trade',
        entities: {
            tokenAddresses: [],
            tokenSymbols: [],
            walletAddresses: [],
            marketIdentifiers: [],
        },
        requestedChain: {
            chainId: 8453,
            chainName: 'Base',
            source: 'llm',
        },
    });

    const intent = parseTradingIntent(
        'copy trade this token',
        makeSnapshot('copy trade this token', {
            requestedTokenAddresses: [token],
            normalizedIntent: canonicalIntent,
        }),
        canonicalIntent,
    );

    assert.equal(intent?.type, 'copy_trade');
    assert.equal(intent?.slots.target_wallet, undefined);
    assert.deepEqual(intent?.slots.target_wallet_candidates, []);
    assert.equal(intent?.slots.target_wallet_ambiguous, false);
});
