import assert from 'node:assert/strict';
import test from 'node:test';

import { parseIntent } from './intentParser.js';

process.env.INTENT_MODEL_ROUTER = 'rules';

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

test('parseIntent uses the model path for non-trading discovery questions', async () => {
    const previousRouterMode = process.env.INTENT_MODEL_ROUTER;
    const previousFetch = globalThis.fetch;
    process.env.INTENT_MODEL_ROUTER = 'model';

    const mockIntent = {
        highLevel: { type: 'GENERAL_QUERY', confidence: 0.91 },
        detailed: {
            action: 'general_query',
            token_address: null,
            token_symbol: null,
            chain_id: 56,
            token_in: null,
            token_out: null,
            amount: null,
            amount_semantic: 'input',
            confidence: 0.91,
            evidence: ['discovery request'],
        },
        decision: {
            primary: 'GENERAL_QUERY',
            confidence: 0.91,
            labels: [{ label: 'GENERAL_QUERY', confidence: 0.91 }],
            routing: { stage: 'model', reason: 'non_action_question' },
        },
    };

    globalThis.fetch = (async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
            events: [
                { event_type: 'message_start', provider: 'openai', payload: {} },
                { event_type: 'delta_text', provider: 'openai', payload: { text: JSON.stringify(mockIntent) } },
                { event_type: 'done', provider: 'openai', payload: {} },
            ],
        }),
    })) as any;

    try {
        const parsed = await parseIntent("What's the trending token today Grok ?", {
            chainId: 56,
            chainName: 'BNB Chain',
            isWalletConnected: true,
        } as any);

        assert.equal(parsed.highLevel.type, 'GENERAL_QUERY');
        assert.equal(parsed.detailed.action, 'general_query');
        assert.equal(parsed.decision?.routing.stage, 'model');
    } finally {
        if (previousRouterMode === undefined) {
            delete process.env.INTENT_MODEL_ROUTER;
        } else {
            process.env.INTENT_MODEL_ROUTER = previousRouterMode;
        }
        globalThis.fetch = previousFetch;
    }
});
