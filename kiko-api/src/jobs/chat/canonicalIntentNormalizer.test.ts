import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeCanonicalIntent, resolveNormalizationModel } from './canonicalIntentNormalizer.js';
import type { ChatContextSnapshot } from './contracts.js';

function makeSnapshot(message: string): ChatContextSnapshot {
    return {
        sessionId: 'session-normalize',
        taskId: 'task-normalize',
        assistantMessageId: 'msg-normalize',
        model: 'gpt-5-mini',
        history: [{ role: 'user', content: message }],
        lastUserMessage: message,
        requestedTokenAddresses: [],
        requestedTokenSymbols: [],
        toolDefinitions: [],
        runtime: {
            userSettings: {},
            toolContext: {},
            prefetchedToolResults: {},
            contextBlocks: {},
            systemDirectives: [],
        },
        policySnapshot: null,
    } as ChatContextSnapshot;
}

test('normalizeCanonicalIntent parses a valid early-buyer full-table payload', async () => {
    const result = await normalizeCanonicalIntent({
        snapshot: makeSnapshot('Check 0xabc early buyer for 30'),
        generationClient: {
            async generate() {
                return {
                    text: JSON.stringify({
                        domain: 'token',
                        intent: 'early_buyers',
                        task_mode: 'analyze',
                        output_mode: 'full_table',
                        search_mode: 'forbidden',
                        search_target: 'none',
                        confidence: 0.91,
                        explanation: 'Early buyer export',
                        entities: {
                            token_addresses: ['0xeCCBb861c0dda7eFd964010085488B69317e4444'],
                            token_symbols: [],
                            wallet_addresses: [],
                            market_identifiers: [],
                        },
                        requested_chain: {
                            chain_id: 56,
                            chain_name: 'BNB Chain',
                        },
                        requested_time_window: {
                            is_time_bound: false,
                            description: '',
                        },
                        evidence_requirements: ['onchain_token_evidence'],
                        requires_realtime: false,
                        requires_onchain_evidence: true,
                        execution_candidate: false,
                        row_count: 30,
                        locale: 'en',
                        needs_clarification: false,
                        clarification_question: null,
                    }),
                    reasoning: '',
                    toolCalls: [],
                };
            },
        } as any,
    });

    assert.equal(result.state.status, 'ok');
    assert.equal(result.snapshot.normalizedIntent?.intent, 'early_buyers');
    assert.equal(result.snapshot.normalizedIntent?.outputMode, 'full_table');
    assert.equal(result.snapshot.normalizedIntent?.rowCount, 30);
    assert.equal(result.snapshot.requestedTokenAddresses[0], '0xeCCBb861c0dda7eFd964010085488B69317e4444');
});

test('normalizeCanonicalIntent preserves literal time windows for early-buyer queries', async () => {
    const result = await normalizeCanonicalIntent({
        snapshot: makeSnapshot('帮我获取0xabc今天11:48的早期购买者'),
        generationClient: {
            async generate() {
                return {
                    text: JSON.stringify({
                        domain: 'token',
                        intent: 'early_buyers',
                        task_mode: 'analyze',
                        output_mode: 'full_table',
                        search_mode: 'forbidden',
                        search_target: 'none',
                        confidence: 0.9,
                        explanation: 'Literal time-bound early buyer query.',
                        entities: {
                            token_addresses: ['0xabc'],
                            token_symbols: [],
                            wallet_addresses: [],
                            market_identifiers: [],
                        },
                        requested_chain: {
                            chain_id: 56,
                            chain_name: 'BNB Chain',
                        },
                        requested_time_window: {
                            is_time_bound: true,
                            description: 'today 11:48 in user timezone',
                            start_time: '2026-04-03T11:48:00+08:00',
                            end_time: '2026-04-03T11:48:59+08:00',
                        },
                        evidence_requirements: ['onchain_token_evidence'],
                        requires_realtime: true,
                        requires_onchain_evidence: true,
                        execution_candidate: false,
                        row_count: null,
                        locale: 'zh',
                        needs_clarification: false,
                        clarification_question: null,
                    }),
                    reasoning: '',
                    toolCalls: [],
                };
            },
        } as any,
    });

    assert.equal(result.state.status, 'ok');
    assert.equal(result.snapshot.normalizedIntent?.intent, 'early_buyers');
    assert.equal(result.snapshot.normalizedIntent?.timeContext?.isTimeBound, true);
    assert.equal(result.snapshot.normalizedIntent?.timeContext?.startTime, '2026-04-03T11:48:00+08:00');
    assert.equal(result.snapshot.normalizedIntent?.timeContext?.endTime, '2026-04-03T11:48:59+08:00');
});

test('normalizeCanonicalIntent marks invalid JSON explicitly', async () => {
    const result = await normalizeCanonicalIntent({
        snapshot: makeSnapshot('whatever'),
        generationClient: {
            async generate() {
                return {
                    text: 'not json',
                    reasoning: '',
                    toolCalls: [],
                };
            },
        } as any,
    });

    assert.equal(result.state.status, 'invalid');
    assert.equal(result.state.reasonCode, 'normalization_invalid_json');
    assert.equal(result.snapshot.normalizedIntent, null);
});

test('normalizeCanonicalIntent accepts assistant_meta domain and clears stale token carry-over when the model disables inheritance', async () => {
    const snapshot = makeSnapshot('Why did you reply like that just now?');
    snapshot.requestedTokenSymbols = ['WHAT', 'KIKO'];

    const result = await normalizeCanonicalIntent({
        snapshot,
        generationClient: {
            async generate() {
                return {
                    text: JSON.stringify({
                        domain: 'assistant_meta',
                        intent: 'assistant_meta',
                        task_mode: 'analyze',
                        output_mode: 'narrative',
                        search_mode: 'forbidden',
                        search_target: 'none',
                        confidence: 0.97,
                        explanation: 'The user is asking about the assistant behavior itself.',
                        entities: {
                            token_addresses: [],
                            token_symbols: [],
                            wallet_addresses: [],
                            market_identifiers: [],
                        },
                        requested_chain: null,
                        requested_time_window: null,
                        evidence_requirements: [],
                        requires_realtime: false,
                        requires_onchain_evidence: false,
                        execution_candidate: false,
                        inherit_entities_from_context: false,
                        row_count: null,
                        locale: 'en',
                        needs_clarification: false,
                        clarification_question: null,
                    }),
                    reasoning: '',
                    toolCalls: [],
                };
            },
        } as any,
    });

    assert.equal(result.state.status, 'ok');
    assert.equal(result.snapshot.normalizedIntent?.domain, 'assistant_meta');
    assert.equal(result.snapshot.normalizedIntent?.intent, 'assistant_meta');
    assert.equal(result.snapshot.normalizedIntent?.inheritEntitiesFromContext, false);
    assert.deepEqual(result.snapshot.requestedTokenSymbols, []);
});

test('normalizeCanonicalIntent accepts multilingual requests as long as the canonical schema is valid', async () => {
    const messages = [
        '查这个代币前30个早期买家',
        'Dame los primeros 30 compradores tempranos',
        '最初の30人の早期購入者を見せて',
        'اعرض أول 30 من المشترين الأوائل',
    ];

    for (const message of messages) {
        const result = await normalizeCanonicalIntent({
            snapshot: makeSnapshot(message),
            generationClient: {
                async generate() {
                    return {
                        text: JSON.stringify({
                            domain: 'token',
                            intent: 'early_buyers',
                            task_mode: 'analyze',
                            output_mode: 'full_table',
                            search_mode: 'forbidden',
                            search_target: 'none',
                            confidence: 0.83,
                            explanation: 'Canonical multilingual early buyer query',
                            entities: {
                                token_addresses: [],
                                token_symbols: ['BAP'],
                                wallet_addresses: [],
                                market_identifiers: [],
                            },
                            requested_chain: null,
                            requested_time_window: null,
                            evidence_requirements: ['onchain_token_evidence'],
                            requires_realtime: false,
                            requires_onchain_evidence: true,
                            execution_candidate: false,
                            row_count: 30,
                            locale: /[\u4e00-\u9fff]/.test(message) ? 'zh' : 'en',
                            needs_clarification: false,
                            clarification_question: null,
                        }),
                        reasoning: '',
                        toolCalls: [],
                    };
                },
            } as any,
        });

        assert.equal(result.state.status, 'ok');
        assert.equal(result.snapshot.normalizedIntent?.intent, 'early_buyers');
        assert.equal(result.snapshot.normalizedIntent?.rowCount, 30);
    }
});

test('resolveNormalizationModel follows the selected model unless an override is configured', () => {
    assert.equal(resolveNormalizationModel('grok-4-1-fast-reasoning'), 'grok-4-1-fast-reasoning');
    assert.equal(resolveNormalizationModel('grok-4-1-fast-non-reasoning'), 'grok-4-1-fast-non-reasoning');
    assert.equal(resolveNormalizationModel('deepseek-chat'), 'deepseek-chat');
    assert.equal(resolveNormalizationModel('gpt-5-mini'), 'gpt-5-mini');
});
