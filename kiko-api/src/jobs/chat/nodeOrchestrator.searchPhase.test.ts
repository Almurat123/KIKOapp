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

test('buildGenerationTools no longer hides local tools during native search phase', () => {
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
    const names = tools.map((item: any) => item.function.name);
    assert.deepEqual(names.sort(), ['get_early_buyers', 'get_token_info', 'prepare_swap_transaction']);
});

test('buildGenerationTools no longer hides non-execution tools in execution phase', () => {
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
    assert.deepEqual(names.sort(), ['get_token_info', 'place_polymarket_order', 'prepare_swap_transaction']);
});

test('native search guidance keeps local token analysis tools exposed while search stays available', async () => {
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
    assert.ok(seenRounds[0]?.tools.includes('get_token_info'));
    assert.equal(seenRounds[1]?.enableSearch, true);
    assert.ok(seenRounds[1]?.tools.includes('get_token_info'));
    assert.ok(broker.providerNativeEvidence.length >= 1);
    assert.equal(broker.texts.at(-1), 'Based on X sentiment and on-chain context, BTC holders are still active.');
});

test('search-capable queries can still return a direct answer without forced retry loops', async () => {
    const snapshot = makeSnapshot("What's trending on X right now?");
    const broker = makeBroker();
    const seenRounds: Array<{ tools: string[]; enableSearch: boolean }> = [];

    const generationClient = {
        async generate(params: any) {
            if (String(params?.taskId || '').endsWith(':plan')) {
                return { text: '', reasoning: '', toolCalls: [] };
            }
            seenRounds.push({
                tools: (params.tools || []).map((item: any) => item.function?.name).filter(Boolean),
                enableSearch: Boolean(params.providerOptions?.enable_search),
            });
            return {
                text: 'Here is a concise answer without using tools.',
                reasoning: '',
                toolCalls: [],
            };
        },
    };

    await runNodeOrchestration({
        snapshot,
        generationClient: generationClient as any,
        toolExecutionEngine: { async execute() { throw new Error('no local tool execution expected'); } } as any,
        broker: broker as any,
        toolContext: {},
    });

    assert.equal(seenRounds[0]?.enableSearch, true);
    assert.ok((seenRounds[0]?.tools.length || 0) > 0);
    assert.equal(seenRounds.length, 1);
    assert.equal(broker.texts.at(-1), 'Here is a concise answer without using tools.');
});

test('pseudo tool JSON in assistant text is sanitized but does not trigger a forced retry', async () => {
    const snapshot = makeSnapshot("What's trending on X right now?", {
        model: 'deepseek-reasoner',
        runtime: {
            walletAddress: '0xabc',
        },
    });
    const broker = makeBroker();
    let generationRound = 0;
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
            throw new Error('unexpected extra generation round');
        },
    };

    await runNodeOrchestration({
        snapshot,
        generationClient: generationClient as any,
        toolExecutionEngine: { async execute() { throw new Error('no tool execution expected'); } } as any,
        broker: broker as any,
        toolContext: {},
    });

    assert.equal(generationRound, 1);
    assert.deepEqual(broker.replacements, ["I'll search for the current trending topics on X."]);
    assert.equal(broker.texts.join(''), "I'll search for the current trending topics on X.");
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

test('plain-text answers are allowed without the removed hard evidence gate', async () => {
    const tokenAddress = '0xeCCBb861c0dda7eFd964010085488B69317e4444';
    const snapshot = makeSnapshot(`Search X for ${tokenAddress} at 2026-03-10 12:00 UTC and find early buyers`, {
        model: 'deepseek-reasoner',
        requestedTokenAddresses: [tokenAddress],
    });
    const broker = makeBroker();
    let generationRound = 0;

    const generationClient = {
        async generate(params: any) {
            if (String(params?.taskId || '').endsWith(':plan')) {
                return { text: '', reasoning: '', toolCalls: [] };
            }
            generationRound += 1;
            return {
                text: 'I found the buyers already and can summarize them now.',
                reasoning: 'I should just answer directly.',
                toolCalls: [],
            };
        },
    };

    await runNodeOrchestration({
        snapshot,
        generationClient: generationClient as any,
        toolExecutionEngine: { async execute() { throw new Error('no tool execution expected'); } } as any,
        broker: broker as any,
        toolContext: {},
    });

    assert.equal(generationRound, 1);
    assert.deepEqual(broker.replacements, []);
    assert.equal(broker.texts.join(''), 'I found the buyers already and can summarize them now.');
});

test('function_call-style pseudo tool output is sanitized but does not trigger a forced retry', async () => {
    const tokenAddress = '0xeCCBb861c0dda7eFd964010085488B69317e4444';
    const snapshot = makeSnapshot('2026-03-10上架的alpha，然后你能查询当天的early buyer吗？', {
        model: 'deepseek-reasoner',
        requestedTokenAddresses: [tokenAddress],
    });
    const broker = makeBroker();
    let generationRound = 0;
    const generationClient = {
        async generate(params: any) {
            if (String(params?.taskId || '').endsWith(':plan')) {
                return { text: '', reasoning: '', toolCalls: [] };
            }
            generationRound += 1;
            if (generationRound === 1) {
                return {
                    text: [
                        '<function_call name="get_early_buyers">',
                        `<argument name="token">${tokenAddress}</argument>`,
                        '<argument name="chain">56</argument>',
                        '<argument name="date">2026-03-10</argument>',
                        '</function_call>',
                    ].join('\n'),
                    reasoning: '',
                    toolCalls: [],
                };
            }
            throw new Error('unexpected extra generation round');
        },
    };

    await runNodeOrchestration({
        snapshot,
        generationClient: generationClient as any,
        toolExecutionEngine: { async execute() { throw new Error('no tool execution expected'); } } as any,
        broker: broker as any,
        toolContext: {},
    });

    assert.equal(generationRound, 1);
    assert.deepEqual(broker.replacements, ['']);
    assert.equal(broker.texts.join(''), '');
});

test('prose-style pseudo tool narration is sanitized but does not trigger a forced retry', async () => {
    const tokenAddress = '0xeCCBb861c0dda7eFd964010085488B69317e4444';
    const snapshot = makeSnapshot('Find the early buyers around 2026-03-10 for this token', {
        model: 'deepseek-reasoner',
        requestedTokenAddresses: [tokenAddress],
    });
    const broker = makeBroker();
    let generationRound = 0;
    const generationClient = {
        async generate(params: any) {
            if (String(params?.taskId || '').endsWith(':plan')) {
                return { text: '', reasoning: '', toolCalls: [] };
            }
            generationRound += 1;
            if (generationRound === 1) {
                return {
                    text: [
                        'I will use real tools now.',
                        `Function call: external_web_search(query="${tokenAddress} Binance Alpha 2026-03-10")`,
                        `Using tool get_early_buyers(address="${tokenAddress}", chain_id=56)`,
                    ].join('\n'),
                    reasoning: '',
                    toolCalls: [],
                };
            }
            throw new Error('unexpected extra generation round');
        },
    };

    await runNodeOrchestration({
        snapshot,
        generationClient: generationClient as any,
        toolExecutionEngine: { async execute() { throw new Error('no tool execution expected'); } } as any,
        broker: broker as any,
        toolContext: {},
    });

    assert.equal(generationRound, 1);
    assert.deepEqual(broker.replacements, ['I will use real tools now.']);
    assert.equal(broker.texts.join(''), 'I will use real tools now.');
});

test('pure early-buyer tool-name narration ends with the model response and does not auto-continue', async () => {
    const tokenAddress = '0xeCCBb861c0dda7eFd964010085488B69317e4444';
    const snapshot = makeSnapshot(`Check ${tokenAddress} early buyer`, {
        model: 'deepseek-reasoner',
        requestedTokenAddresses: [tokenAddress],
    });
    const broker = makeBroker();
    let generationRound = 0;
    const generationClient = {
        async generate(params: any) {
            if (String(params?.taskId || '').endsWith(':plan')) {
                return { text: '', reasoning: '', toolCalls: [] };
            }
            generationRound += 1;
            if (generationRound === 1) {
                return {
                    text: [
                        'Calling get_token_info and get_early_buyers for the provided token on BNB Chain.',
                        `I will fetch on-chain token info and early-buyer data now for ${tokenAddress} on BNB Chain (chain id 56). Proceeding to gather evidence.`,
                    ].join('\n'),
                    reasoning: '',
                    toolCalls: [],
                };
            }
            throw new Error('unexpected extra generation round');
        },
    };

    await runNodeOrchestration({
        snapshot,
        generationClient: generationClient as any,
        toolExecutionEngine: { async execute() { throw new Error('no tool execution expected'); } } as any,
        broker: broker as any,
        toolContext: {},
    });

    assert.equal(generationRound, 1);
    assert.deepEqual(broker.replacements, [
        `I will fetch on-chain token info and early-buyer data now for ${tokenAddress} on BNB Chain (chain id 56). Proceeding to gather evidence.`,
    ]);
    assert.equal(
        broker.texts.join(''),
        `I will fetch on-chain token info and early-buyer data now for ${tokenAddress} on BNB Chain (chain id 56). Proceeding to gather evidence.`,
    );
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
