import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeCanonicalIntent } from './canonicalIntentNormalizer.js';
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
