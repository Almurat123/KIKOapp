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

test('normalizeCanonicalIntent accepts Clanker deploy as a first-class execution intent', async () => {
    const result = await normalizeCanonicalIntent({
        snapshot: makeSnapshot('Deploy a token on Base name testbymybot symbol TBB'),
        generationClient: {
            async generate() {
                return {
                    text: JSON.stringify({
                        domain: 'token',
                        intent: 'clanker_deploy',
                        task_mode: 'execute',
                        output_mode: 'execution_ready',
                        search_mode: 'forbidden',
                        search_target: 'none',
                        confidence: 0.94,
                        explanation: 'The user wants to prepare a Clanker token launch.',
                        entities: {
                            token_addresses: [],
                            token_symbols: ['TBB'],
                            wallet_addresses: [],
                            market_identifiers: [],
                        },
                        requested_chain: {
                            chain_id: 8453,
                            chain_name: 'Base',
                        },
                        requested_time_window: null,
                        evidence_requirements: [],
                        requires_realtime: false,
                        requires_onchain_evidence: false,
                        execution_candidate: true,
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
    assert.equal(result.snapshot.normalizedIntent?.domain, 'token');
    assert.equal(result.snapshot.normalizedIntent?.intent, 'clanker_deploy');
    assert.equal(result.snapshot.normalizedIntent?.taskMode, 'execute');
    assert.equal(result.snapshot.normalizedIntent?.requestedChain?.chainId, 8453);
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

test('normalizeCanonicalIntent drops malformed wallet entities instead of preserving truncated copy-trade wallets', async () => {
    const result = await normalizeCanonicalIntent({
        snapshot: makeSnapshot('Copy trade 0xbd708164137146ac234aceb75d3981cd3599e21a on BSC'),
        generationClient: {
            async generate() {
                return {
                    text: JSON.stringify({
                        domain: 'token',
                        intent: 'copy_trade',
                        task_mode: 'execute',
                        output_mode: 'execution_ready',
                        search_mode: 'forbidden',
                        search_target: 'none',
                        confidence: 0.92,
                        explanation: 'Copy trade request.',
                        entities: {
                            token_addresses: [],
                            token_symbols: [],
                            wallet_addresses: ['0xbd708164137146ac234aceb75d3981cd359e21a'],
                            market_identifiers: [],
                        },
                        requested_chain: {
                            chain_id: 56,
                            chain_name: 'BNB Chain',
                        },
                        requested_time_window: null,
                        evidence_requirements: [],
                        requires_realtime: false,
                        requires_onchain_evidence: false,
                        execution_candidate: true,
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
    assert.deepEqual(result.snapshot.normalizedIntent?.entities.walletAddresses, []);
});

test('normalizeCanonicalIntent sends unwrapped Farcaster query to the normalization model', async () => {
    const token = '0x4972e029f2e1831d205b20d05833cc771feb2ba3';
    const snapshot = makeSnapshot(`Farcaster inbound mention context:\nCurrent @almurat: ${token}`);
    let normalizationPayload: any = null;

    const result = await normalizeCanonicalIntent({
        snapshot,
        generationClient: {
            async generate(args: any) {
                normalizationPayload = JSON.parse(String(args.messages?.[1]?.content || '{}'));
                return {
                    text: JSON.stringify({
                        domain: 'token',
                        intent: 'token_analysis',
                        task_mode: 'analyze',
                        output_mode: 'narrative',
                        search_mode: 'forbidden',
                        search_target: 'none',
                        confidence: 0.88,
                        explanation: 'Literal token query',
                        entities: {
                            token_addresses: [token],
                            token_symbols: [],
                            wallet_addresses: [],
                            market_identifiers: [],
                        },
                        requested_chain: null,
                        requested_time_window: null,
                        evidence_requirements: ['onchain_token_evidence'],
                        requires_realtime: false,
                        requires_onchain_evidence: true,
                        execution_candidate: false,
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

    assert.equal(normalizationPayload.latest_user_message, token);
    assert.equal(normalizationPayload.recent_history?.[0]?.content, token);
    assert.equal(result.state.status, 'ok');
    assert.equal(result.snapshot.normalizedIntent?.intent, 'token_analysis');
});

test('normalizeCanonicalIntent forwards requested address classifications to the model payload', async () => {
    const token = '0x4972e029f2e1831d205b20d05833cc771feb2ba3';
    const snapshot = makeSnapshot(token);
    snapshot.requestedTokenAddresses = [token];
    snapshot.requestedAddressClassifications = [
        {
            address: token,
            kind: 'token_contract',
            chainId: 8453,
            chainName: 'Base',
            source: 'rpc',
        },
    ];
    let normalizationPayload: any = null;

    const result = await normalizeCanonicalIntent({
        snapshot,
        generationClient: {
            async generate(args: any) {
                normalizationPayload = JSON.parse(String(args.messages?.[1]?.content || '{}'));
                return {
                    text: JSON.stringify({
                        domain: 'token',
                        intent: 'token_analysis',
                        task_mode: 'analyze',
                        output_mode: 'narrative',
                        search_mode: 'forbidden',
                        search_target: 'none',
                        confidence: 0.93,
                        explanation: 'Address is preclassified as token contract.',
                        entities: {
                            token_addresses: [token],
                            token_symbols: [],
                            wallet_addresses: [],
                            market_identifiers: [],
                        },
                        requested_chain: {
                            chain_id: 8453,
                            chain_name: 'Base',
                        },
                        requested_time_window: null,
                        evidence_requirements: ['onchain_token_evidence'],
                        requires_realtime: false,
                        requires_onchain_evidence: true,
                        execution_candidate: false,
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

    assert.equal(normalizationPayload.requested_address_classifications?.[0]?.kind, 'token_contract');
    assert.equal(result.state.status, 'ok');
    assert.equal(result.snapshot.normalizedIntent?.intent, 'token_analysis');
});

test('resolveNormalizationModel uses the active session model unchanged', () => {
    assert.equal(resolveNormalizationModel('grok-4-1-fast-reasoning'), 'grok-4-1-fast-reasoning');
    assert.equal(resolveNormalizationModel('grok-4-1-fast-non-reasoning'), 'grok-4-1-fast-non-reasoning');
    assert.equal(resolveNormalizationModel('kimi-k2-5-reasoning'), 'kimi-k2-5-reasoning');
    assert.equal(resolveNormalizationModel('moonshotai/kimi-k2.5-reasoning'), 'moonshotai/kimi-k2.5-reasoning');
    assert.equal(resolveNormalizationModel('kimi-k2-5-instant'), 'kimi-k2-5-instant');
    assert.equal(resolveNormalizationModel('kimi-k2-5-reasoning'), 'kimi-k2-5-reasoning');
    assert.equal(resolveNormalizationModel('deepseek-reasoner'), 'deepseek-reasoner');
    assert.equal(resolveNormalizationModel('deepseek-chat'), 'deepseek-chat');
    assert.equal(resolveNormalizationModel('gpt-5-mini'), 'gpt-5-mini');
});

test('normalizeCanonicalIntent sends greetings through the same-model canonical stage', async () => {
    let called = false;
    const snapshot = makeSnapshot('Hi, who are you?');
    snapshot.model = 'kimi-k2-5-reasoning';

    const result = await normalizeCanonicalIntent({
        snapshot,
        generationClient: {
            async generate() {
                called = true;
                return {
                    text: JSON.stringify({
                        domain: 'assistant_meta',
                        intent: 'assistant_meta',
                        task_mode: 'discover',
                        output_mode: 'narrative',
                        search_mode: 'forbidden',
                        search_target: 'none',
                        confidence: 0.99,
                        explanation: 'Greeting and introduction turn.',
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

    assert.equal(called, true);
    assert.equal(result.state.status, 'ok');
    assert.equal(result.snapshot.normalizedIntent?.domain, 'assistant_meta');
    assert.equal(result.snapshot.normalizedIntent?.intent, 'assistant_meta');
    assert.equal(result.snapshot.normalizedIntent?.searchMode, 'forbidden');
});

test('normalizeCanonicalIntent sends ordinary non-chain questions through the same-model canonical stage', async () => {
    let called = false;

    const result = await normalizeCanonicalIntent({
        snapshot: makeSnapshot('你好，量子纠缠是什么？'),
        generationClient: {
            async generate() {
                called = true;
                return {
                    text: JSON.stringify({
                        domain: 'general',
                        intent: 'general_answer',
                        task_mode: 'discover',
                        output_mode: 'narrative',
                        search_mode: 'forbidden',
                        search_target: 'none',
                        confidence: 0.97,
                        explanation: 'Ordinary general knowledge question.',
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

    assert.equal(called, true);
    assert.equal(result.state.status, 'ok');
    assert.equal(result.snapshot.normalizedIntent?.intent, 'general_answer');
    assert.equal(result.snapshot.normalizedIntent?.domain, 'general');
});

test('normalizeCanonicalIntent still calls the model for token-domain queries', async () => {
    let called = false;

    const result = await normalizeCanonicalIntent({
        snapshot: makeSnapshot('what is PEPE token?'),
        generationClient: {
            async generate() {
                called = true;
                return {
                    text: JSON.stringify({
                        domain: 'token',
                        intent: 'token_analysis',
                        task_mode: 'analyze',
                        output_mode: 'narrative',
                        search_mode: 'forbidden',
                        search_target: 'none',
                        confidence: 0.88,
                        explanation: 'Token-domain question.',
                        entities: {
                            token_addresses: [],
                            token_symbols: ['PEPE'],
                            wallet_addresses: [],
                            market_identifiers: [],
                        },
                        requested_chain: null,
                        requested_time_window: null,
                        evidence_requirements: ['onchain_token_evidence'],
                        requires_realtime: false,
                        requires_onchain_evidence: true,
                        execution_candidate: false,
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

    assert.equal(called, true);
    assert.equal(result.state.status, 'ok');
    assert.equal(result.snapshot.normalizedIntent?.intent, 'token_analysis');
});

test('normalizeCanonicalIntent preserves normalization reasoning for optional debug exposure', async () => {
    const reasoningDeltas: string[] = [];
    const result = await normalizeCanonicalIntent({
        snapshot: makeSnapshot('analyze this token'),
        generationClient: {
            async generate(args: any) {
                await args.onReasoningDelta?.('step one. ');
                await args.onReasoningDelta?.('step two.');
                return {
                    text: JSON.stringify({
                        domain: 'token',
                        intent: 'token_analysis',
                        task_mode: 'analyze',
                        output_mode: 'narrative',
                        search_mode: 'forbidden',
                        search_target: 'none',
                        confidence: 0.9,
                        explanation: 'Token analysis request.',
                        entities: {
                            token_addresses: [],
                            token_symbols: [],
                            wallet_addresses: [],
                            market_identifiers: [],
                        },
                        requested_chain: null,
                        requested_time_window: null,
                        evidence_requirements: ['onchain_token_evidence'],
                        requires_realtime: false,
                        requires_onchain_evidence: true,
                        execution_candidate: false,
                        row_count: null,
                        locale: 'en',
                        needs_clarification: false,
                        clarification_question: null,
                    }),
                    reasoning: 'step one. step two.',
                    toolCalls: [],
                };
            },
        } as any,
        onReasoningDelta: async (text) => {
            reasoningDeltas.push(text);
        },
    });

    assert.deepEqual(reasoningDeltas, ['step one. ', 'step two.']);
    assert.equal(result.state.reasoningText, 'step one. step two.');
    assert.equal(result.snapshot.normalizedIntent?.intent, 'token_analysis');
});
