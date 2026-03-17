import assert from 'node:assert/strict';
import test from 'node:test';
import { toolRegistry } from '../../tooling/registry.js';
import type { ChatContextSnapshot } from './contracts.js';
import { buildGenerationTools, normalizeToolCallForProvider, runNodeOrchestration } from './nodeOrchestrator.js';

function makeSnapshot(message: string, overrides: Partial<ChatContextSnapshot> = {}): ChatContextSnapshot {
    const { runtime: runtimeOverrides, ...restOverrides } = overrides;
    const runtime = {
        userSettings: {},
        toolContext: {},
        prefetchedToolResults: {},
        contextBlocks: {},
        systemDirectives: [],
        ...(runtimeOverrides || {}),
    };
    return {
        sessionId: 'session-search',
        taskId: 'task-search',
        assistantMessageId: 'msg-search',
        model: 'grok-4-1-fast-non-reasoning',
        history: [],
        lastUserMessage: message,
        requestedTokenAddresses: [],
        requestedTokenSymbols: [],
        toolDefinitions: toolRegistry.getAllDefinitions(),
        policySnapshot: null,
        runtime,
        ...restOverrides,
    } as ChatContextSnapshot;
}

function makeBroker() {
    const citations: any[] = [];
    const texts: string[] = [];
    const replacements: string[] = [];
    const providerNativeEvidence: any[] = [];
    return {
        texts,
        replacements,
        citations,
        providerNativeEvidence,
        async bootstrapRuntime() {},
        async applyModelPlan() {},
        async markPlanPhase() {},
        async ensurePlanStep() {},
        async focusPlanStep() {},
        async noteToolSelected() {},
        async markPlanStepStarted() {},
        async recordToolResult() {},
        async markAnswerStarted() {},
        async setRuntimeState() {},
        pushUsage() {},
        pushCitation(citation: any) { citations.push(citation); },
        getCitations() { return [...citations]; },
        async recordProviderNativeEvidence(snapshot: any) { providerNativeEvidence.push(snapshot); },
        getProviderNativeEvidence() { return [...providerNativeEvidence]; },
        getContent() { return texts.join(''); },
        async pushText(text: string) { texts.push(text); },
        async pushReasoning() {},
        async blockContent(content: string) {
            replacements.push(content);
            texts.length = 0;
            if (content) texts.push(content);
        },
    };
}

test('buildGenerationTools hides local tools during native search phase', () => {
    const definitions = [
        { name: 'get_token_info', description: '', parameters: {} },
        { name: 'get_early_buyers', description: '', parameters: {} },
        { name: 'prepare_swap_transaction', description: '', parameters: {} },
    ];
    const tools = buildGenerationTools(
        definitions,
        ['get_token_info', 'get_early_buyers', 'prepare_swap_transaction'],
        [],
        ['get_token_info'],
        false,
        'grok',
        'native_search_only',
    );
    assert.deepEqual(tools, []);
});

test('buildGenerationTools keeps only execution-like tools in execution phase', () => {
    const definitions = [
        { name: 'get_token_info', description: '', parameters: {} },
        { name: 'prepare_swap_transaction', description: '', parameters: {} },
        { name: 'place_polymarket_order', description: '', parameters: {} },
    ];
    const tools = buildGenerationTools(
        definitions,
        ['get_token_info', 'prepare_swap_transaction', 'place_polymarket_order'],
        [],
        ['place_polymarket_order'],
        false,
        'grok',
        'execution',
    );
    const names = tools.map((item: any) => item.function.name);
    assert.deepEqual(names.sort(), ['place_polymarket_order', 'prepare_swap_transaction']);
});

test('native search phase runs before local token analysis tools', async () => {
    const snapshot = makeSnapshot('Search X for BTC sentiment, then analyze holders', {
        requestedTokenSymbols: ['BTC'],
    });
    const broker = makeBroker();
    const seenRounds: Array<{ tools: string[]; enableSearch: boolean }> = [];
    let generationRound = 0;

    const generationClient = {
        async generate(params: any) {
            if (String(params?.taskId || '').endsWith(':plan')) {
                return { text: '', reasoning: '', toolCalls: [] };
            }
            generationRound += 1;
            seenRounds.push({
                tools: (params.tools || []).map((item: any) => item.function?.name).filter(Boolean),
                enableSearch: Boolean(params.providerOptions?.enable_search),
            });
            if (generationRound === 1) {
                return {
                    text: 'X sentiment summary: traders are discussing BTC momentum.',
                    reasoning: '',
                    toolCalls: [
                        {
                            id: 'native-x',
                            name: 'x_search',
                            arguments: { query: 'BTC sentiment today' },
                        },
                    ],
                };
            }
            if (generationRound === 2) {
                return {
                    text: '',
                    reasoning: '',
                    toolCalls: [
                        {
                            id: 'token-1',
                            name: 'get_token_info',
                            arguments: { address: 'btc', chain_id: 1 },
                        },
                    ],
                };
            }
            return {
                text: 'Based on X sentiment and on-chain context, BTC holders are still active.',
                reasoning: '',
                toolCalls: [],
            };
        },
    };

    await runNodeOrchestration({
        snapshot,
        generationClient: generationClient as any,
        toolExecutionEngine: {
            async execute(call: any) {
                assert.equal(call.name, 'get_token_info');
                return {
                    ok: true,
                    result: { symbol: 'BTC' },
                    metadata: { source: 'tool_runtime' },
                };
            },
        } as any,
        broker: broker as any,
        toolContext: {},
    });

    assert.equal(seenRounds[0]?.enableSearch, true);
    assert.deepEqual(seenRounds[0]?.tools, []);
    assert.equal(seenRounds[1]?.enableSearch, false);
    assert.ok(seenRounds[1]?.tools.includes('get_token_info'));
    assert.ok(broker.providerNativeEvidence.length >= 1);
    assert.equal(broker.texts.at(-1), 'Based on X sentiment and on-chain context, BTC holders are still active.');
});

test('native search phase exits with controlled insufficient-evidence answer after retry budget', async () => {
    const snapshot = makeSnapshot("What's trending on X right now?");
    const broker = makeBroker();
    const seenRounds: Array<{ tools: string[]; enableSearch: boolean }> = [];
    let generationRound = 0;

    const generationClient = {
        async generate(params: any) {
            if (String(params?.taskId || '').endsWith(':plan')) {
                return { text: '', reasoning: '', toolCalls: [] };
            }
            generationRound += 1;
            seenRounds.push({
                tools: (params.tools || []).map((item: any) => item.function?.name).filter(Boolean),
                enableSearch: Boolean(params.providerOptions?.enable_search),
            });
            if (generationRound <= 2) {
                return {
                    text: '',
                    reasoning: '',
                    toolCalls: [
                        {
                            id: `native-${generationRound}`,
                            name: 'x_search',
                            arguments: { query: 'trending on X now' },
                        },
                    ],
                };
            }
            return {
                text: 'I could not retrieve enough real-time evidence from X or web search.',
                reasoning: '',
                toolCalls: [],
            };
        },
    };

    await runNodeOrchestration({
        snapshot,
        generationClient: generationClient as any,
        toolExecutionEngine: { async execute() { throw new Error('no local tool execution expected when search evidence is missing'); } } as any,
        broker: broker as any,
        toolContext: {},
    });

    assert.deepEqual(seenRounds[0]?.tools, []);
    assert.equal(seenRounds[0]?.enableSearch, true);
    assert.deepEqual(seenRounds[1]?.tools, []);
    assert.equal(seenRounds[1]?.enableSearch, true);
    assert.deepEqual(seenRounds[2]?.tools, []);
    assert.equal(seenRounds[2]?.enableSearch, false);
    assert.equal(broker.texts.at(-1), 'I could not retrieve enough real-time evidence from X or web search.');
});

test('pseudo tool JSON in assistant text is rejected and retried as a real tool call', async () => {
    const snapshot = makeSnapshot("What's trending on X right now?", {
        model: 'deepseek-reasoner',
        runtime: {
            walletAddress: '0xabc',
        },
    });
    const broker = makeBroker();
    let generationRound = 0;
    let executeCalls = 0;

    const generationClient = {
        async generate(params: any) {
            if (String(params?.taskId || '').endsWith(':plan')) {
                return { text: '', reasoning: '', toolCalls: [] };
            }
            generationRound += 1;
            if (generationRound === 1) {
                return {
                    text: [
                        "I'll search for the current trending topics on X.",
                        '```json',
                        '{',
                        '  "tool": "search_x_trending",',
                        '  "parameters": { "limit": 10 }',
                        '}',
                        '```',
                    ].join('\n'),
                    reasoning: '',
                    toolCalls: [],
                };
            }
            if (generationRound === 2) {
                return {
                    text: '',
                    reasoning: '',
                    toolCalls: [
                        {
                            id: 'tool-1',
                            name: 'external_web_search',
                            arguments: { query: 'trending on X right now', limit: 5 },
                        },
                    ],
                };
            }
            if (generationRound === 3) {
                return {
                    text: '',
                    reasoning: '',
                    toolCalls: [
                        {
                            id: 'tool-2',
                            name: 'get_wallet_info',
                            arguments: { wallet: '0xabc', chain_id: 8453 },
                        },
                    ],
                };
            }
            return {
                text: 'Here are the current topics trending on X after search and chain-side verification.',
                reasoning: '',
                toolCalls: [],
            };
        },
    };

    await runNodeOrchestration({
        snapshot,
        generationClient: generationClient as any,
        toolExecutionEngine: {
            async execute(call: any) {
                executeCalls += 1;
                if (executeCalls === 1) {
                    assert.equal(call.name, 'external_web_search');
                    return {
                        ok: true,
                        result: { results: [{ title: 'BTC trending' }] },
                        metadata: { source: 'tool_runtime' },
                    };
                }
                assert.equal(call.name, 'get_wallet_info');
                return {
                    ok: true,
                    result: { wallet: '0xabc', chain: 'base' },
                    metadata: { source: 'tool_runtime' },
                };
            },
        } as any,
        broker: broker as any,
        toolContext: {},
    });

    assert.equal(generationRound, 4);
    assert.equal(executeCalls, 2);
    assert.deepEqual(broker.replacements, ['']);
    assert.equal(broker.texts.join(''), 'Here are the current topics trending on X after search and chain-side verification.');
});

test('provider-native search does not finish an X query before chain evidence is gathered', async () => {
    const snapshot = makeSnapshot("What's trending on X for 0x1111111111111111111111111111111111111111?", {
        requestedTokenAddresses: ['0x1111111111111111111111111111111111111111'],
    });
    const broker = makeBroker();
    let generationRound = 0;
    let executeCalls = 0;

    const generationClient = {
        async generate(params: any) {
            if (String(params?.taskId || '').endsWith(':plan')) {
                return { text: '', reasoning: '', toolCalls: [] };
            }
            generationRound += 1;
            if (generationRound === 1) {
                return {
                    text: 'I found the relevant X timing evidence already.',
                    reasoning: '',
                    toolCalls: [
                        {
                            id: 'native-1',
                            name: 'x_search',
                            arguments: { query: '0x1111111111111111111111111111111111111111 trending on X' },
                        },
                    ],
                };
            }
            if (generationRound === 2) {
                return {
                    text: '',
                    reasoning: '',
                    toolCalls: [
                        {
                            id: 'chain-1',
                            name: 'get_token_info',
                            arguments: { address: '0x1111111111111111111111111111111111111111', chain_id: 1 },
                        },
                    ],
                };
            }
            return {
                text: 'Final answer after public-search evidence and chain-side verification.',
                reasoning: '',
                toolCalls: [],
            };
        },
    };

    await runNodeOrchestration({
        snapshot,
        generationClient: generationClient as any,
        toolExecutionEngine: {
            async execute(call: any) {
                executeCalls += 1;
                assert.equal(call.name, 'get_token_info');
                return {
                    ok: true,
                    result: { address: call.arguments.address, symbol: 'TEST' },
                    metadata: { source: 'tool_runtime' },
                };
            },
        } as any,
        broker: broker as any,
        toolContext: {},
    });

    assert.equal(generationRound, 3);
    assert.equal(executeCalls, 1);
    assert.equal(broker.texts.join(''), 'Final answer after public-search evidence and chain-side verification.');
});

test('strict evidence gate retries instead of accepting a plain-text answer before chain tools run', async () => {
    const tokenAddress = '0xeCCBb861c0dda7eFd964010085488B69317e4444';
    const snapshot = makeSnapshot(`Search X for ${tokenAddress} at 2026-03-10 12:00 UTC and find early buyers`, {
        model: 'deepseek-reasoner',
        requestedTokenAddresses: [tokenAddress],
    });
    const broker = makeBroker();
    let generationRound = 0;
    let executeCalls = 0;

    const generationClient = {
        async generate(params: any) {
            if (String(params?.taskId || '').endsWith(':plan')) {
                return { text: '', reasoning: '', toolCalls: [] };
            }
            generationRound += 1;
            if (generationRound === 1) {
                return {
                    text: 'I found the buyers already and can summarize them now.',
                    reasoning: 'I should just answer directly.',
                    toolCalls: [],
                };
            }
            if (generationRound === 2) {
                return {
                    text: '',
                    reasoning: '',
                    toolCalls: [
                        {
                            id: 'search-1',
                            name: 'external_web_search',
                            arguments: {
                                query: `${tokenAddress} Binance Alpha 2026-03-10 12:00 UTC`,
                                limit: 5,
                            },
                        },
                    ],
                };
            }
            if (generationRound === 3) {
                return {
                    text: '',
                    reasoning: '',
                    toolCalls: [
                        {
                            id: 'buyers-1',
                            name: 'get_early_buyers',
                            arguments: {
                                token_address: tokenAddress,
                                chain_id: 56,
                                timestamp: '2026-03-10T12:00:00Z',
                                limit: 20,
                            },
                        },
                    ],
                };
            }
            return {
                text: 'Here are the early buyers around the specified timestamp.',
                reasoning: '',
                toolCalls: [],
            };
        },
    };

    await runNodeOrchestration({
        snapshot,
        generationClient: generationClient as any,
        toolExecutionEngine: {
            async execute(call: any) {
                executeCalls += 1;
                if (executeCalls === 1) {
                    assert.equal(call.name, 'external_web_search');
                    return {
                        ok: true,
                        result: { results: [{ title: 'Binance Alpha update' }] },
                        metadata: { source: 'tool_runtime' },
                    };
                }
                assert.equal(call.name, 'get_early_buyers');
                assert.equal(call.arguments.address, tokenAddress);
                assert.ok(call.arguments.start_time);
                assert.ok(call.arguments.end_time);
                assert.equal('timestamp' in call.arguments, false);
                assert.equal('token_address' in call.arguments, false);
                return {
                    ok: true,
                    result: { earlyBuyers: [{ address: '0xabc' }] },
                    metadata: { source: 'tool_runtime' },
                };
            },
        } as any,
        broker: broker as any,
        toolContext: {},
    });

    assert.equal(generationRound, 4);
    assert.equal(executeCalls, 2);
    assert.deepEqual(broker.replacements, ['']);
    assert.equal(broker.texts.join(''), 'Here are the early buyers around the specified timestamp.');
});

test('normalizeToolCallForProvider rewrites legacy early-buyer time arguments to start_time/end_time', () => {
    const normalized = normalizeToolCallForProvider({
        id: 'buyers-legacy',
        name: 'get_early_buyers',
        arguments: {
            token_address: '0xabc',
            chain_id: 56,
            timestamp: '2026-03-10T12:00:00Z',
            limit: 10,
        },
    }, 'deepseek');

    assert.equal(normalized.arguments.address, '0xabc');
    assert.equal(typeof normalized.arguments.start_time, 'string');
    assert.equal(typeof normalized.arguments.end_time, 'string');
    assert.equal('token_address' in normalized.arguments, false);
    assert.equal('timestamp' in normalized.arguments, false);
});
