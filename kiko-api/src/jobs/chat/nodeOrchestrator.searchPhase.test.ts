import assert from 'node:assert/strict';
import test from 'node:test';
import { toolRegistry } from '../../tooling/registry.js';
import type { ChatContextSnapshot } from './contracts.js';
import type { CanonicalIntent } from './canonicalIntent.js';
import { applyCanonicalIntentOverridesToToolCall, buildGenerationTools, normalizeToolCallForProvider, runNodeOrchestration } from './nodeOrchestrator.js';

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
        normalizedIntent: null,
        normalizationState: {
            status: 'invalid',
            source: 'llm',
            reasonCode: 'normalization_invalid_json',
        },
        toolDefinitions: toolRegistry.getAllDefinitions(),
        policySnapshot: null,
        runtime,
        ...restOverrides,
    } as ChatContextSnapshot;
}

function makeCanonicalIntent(overrides: Partial<CanonicalIntent>): CanonicalIntent {
    return {
        domain: 'x',
        intent: 'social_discovery',
        taskMode: 'discover',
        outputMode: 'narrative',
        searchMode: 'required',
        searchTarget: 'x',
        confidence: 0.9,
        explanation: 'test canonical intent',
        entities: {
            tokenAddresses: [],
            tokenSymbols: [],
            walletAddresses: [],
            marketIdentifiers: [],
        },
        requestedChain: null,
        timeContext: null,
        evidenceRequirements: ['native_search_results', 'connected_chain_evidence'],
        requiresRealtime: true,
        requiresOnchainEvidence: false,
        executionCandidate: false,
        rowCount: null,
        locale: 'en',
        needsClarification: false,
        clarificationQuestion: null,
        source: 'llm',
        ...overrides,
    };
}

function makeBroker() {
    const citations: any[] = [];
    const texts: string[] = [];
    const replacements: string[] = [];
    const providerNativeEvidence: any[] = [];
    const recordedToolResults: any[] = [];
    return {
        texts,
        replacements,
        citations,
        providerNativeEvidence,
        recordedToolResults,
        async bootstrapRuntime() {},
        async applyModelPlan() {},
        hasVisibleArtifact() { return false; },
        async markPlanPhase() {},
        async ensurePlanStep() {},
        async focusPlanStep() {},
        async noteToolSelected() {},
        async markPlanStepStarted() {},
        async recordToolResult(result: any) { recordedToolResults.push(result); },
        async markAnswerStarted() {},
        async setRuntimeState() {},
        async complete(overrides?: { content?: string }) {
            texts.length = 0;
            if (overrides?.content) texts.push(overrides.content);
        },
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

test('buildGenerationTools remains a generic formatter and respects the provided allow-list', () => {
    const definitions = [
        { name: 'get_token_info', description: '', parameters: {} },
        { name: 'get_early_buyers', description: '', parameters: {} },
        { name: 'prepare_swap_transaction', description: '', parameters: {} },
    ];
    const tools = buildGenerationTools(
        definitions,
        ['get_token_info'],
        [],
        ['get_token_info'],
        false,
        'grok',
        'native_search_only',
    );
    const names = tools.map((item: any) => item.function.name);
    assert.deepEqual(names, ['get_token_info']);
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

test('execution turns expose only missing required read tools before wider local analysis tools', async () => {
    const snapshot = makeSnapshot('Deploy a Clanker token named TG with symbol TG', {
        model: 'gpt-5.4-mini-2026-03-17',
        normalizedIntent: {
            domain: 'token',
            intent: 'clanker_deploy',
            taskMode: 'execute',
            outputMode: 'execution_ready',
            searchMode: 'forbidden',
            searchTarget: 'none',
            confidence: 0.95,
            explanation: 'test deploy intent',
            entities: {
                tokenAddresses: [],
                tokenSymbols: ['TG'],
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
        },
    });
    const broker = makeBroker();
    const seenRounds: Array<{ tools: string[]; bufferVisibleOutput: boolean }> = [];
    const seenMessages: any[][] = [];
    let generationRound = 0;

    const generationClient = {
        async generate(params: any) {
            if (String(params?.taskId || '').endsWith(':plan')) {
                return { text: '', reasoning: '', toolCalls: [] };
            }
            generationRound += 1;
            const roundTools = (params.tools || []).map((item: any) => item.function?.name).filter(Boolean);
            seenRounds.push({
                tools: roundTools,
                bufferVisibleOutput: Boolean(params.providerOptions?.buffer_visible_output),
            });
            seenMessages.push(params.messages || []);
            return {
                text: 'Ready to prepare the launch after reading the required context.',
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
                return {
                    id: call.id,
                    name: call.name,
                    arguments: call.arguments || {},
                    ok: true,
                    result: { available: true },
                    metadata: { source: 'tool_runtime' },
                };
            },
        } as any,
        broker: broker as any,
        toolContext: {},
    });

    assert.equal(generationRound, 1);
    assert.equal(seenRounds[0]!.bufferVisibleOutput, false);
    assert.ok(seenRounds[0]!.tools.includes('deploy_clanker_token'));
    assert.ok(seenRounds[0]!.tools.includes('get_clanker_tokens_by_admin'));
    assert.ok(!seenRounds[0]!.tools.includes('read_execution_plan'));
    assert.ok(!seenRounds[0]!.tools.includes('read_launchpad_context'));
    assert.ok(!seenRounds[0]!.tools.includes('read_skill_prompts'));
    assert.ok(!seenRounds[0]!.tools.includes('read_token_context'));
    assert.ok(!seenRounds[0]!.tools.includes('read_user_context'));
    assert.ok(!seenRounds[0]!.tools.includes('read_user_settings'));
    assert.ok(!seenRounds[0]!.tools.includes('read_wallet_state'));
    assert.ok(!seenRounds[0]!.tools.includes('read_workflow_state'));
    assert.ok(!seenRounds[0]!.tools.includes('prepare_swap_transaction'));
    assert.ok(!seenRounds[0]!.tools.includes('generate_image_from_intent'));
    assert.ok(!seenMessages[0]!.some((message: any) => message.role === 'tool'));
    assert.ok(seenMessages[0]!.some((message: any) => String(message.content || '').includes('[BACKEND_PREFETCHED_CONTEXT]')));
    assert.deepEqual(
        broker.recordedToolResults.map((item: any) => item.name),
        [
            'read_workflow_state',
            'read_skill_prompts',
            'read_execution_plan',
            'read_user_context',
            'read_user_settings',
            'read_wallet_state',
            'read_token_context',
            'read_launchpad_context',
        ],
    );
    assert.equal(broker.getContent(), 'Ready to prepare the launch after reading the required context.');
});

test('Grok social queries keep native search phase free of local tools, then hand off to local analysis', async () => {
    const snapshot = makeSnapshot('Search X for BTC sentiment, then analyze holders', {
        requestedTokenSymbols: ['BTC'],
        normalizedIntent: makeCanonicalIntent({
            entities: {
                tokenAddresses: [],
                tokenSymbols: ['BTC'],
                walletAddresses: [],
                marketIdentifiers: [],
            },
            evidenceRequirements: ['native_search_results', 'onchain_token_evidence'],
            requiresOnchainEvidence: true,
        }),
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
    assert.deepEqual(seenRounds[0]?.tools || [], []);
    assert.equal(seenRounds[1]?.enableSearch, false);
    assert.ok(seenRounds[1]?.tools.includes('get_token_info'));
    assert.ok(broker.providerNativeEvidence.length >= 1);
    assert.ok(broker.recordedToolResults.some((item: any) => item.name === 'x_search'));
    assert.equal(
        broker.recordedToolResults.find((item: any) => item.name === 'x_search')?.metadata?.source,
        'provider_native',
    );
    assert.equal(broker.texts.at(-1), 'Based on X sentiment and on-chain context, BTC holders are still active.');
});

test('search-capable queries can still return a direct answer without forced retry loops in native search phase', async () => {
    const snapshot = makeSnapshot("What's trending on X right now?", {
        normalizedIntent: makeCanonicalIntent({}),
    });
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
    assert.deepEqual(seenRounds[0]?.tools || [], []);
    assert.equal(seenRounds.length, 1);
    assert.equal(broker.texts.at(-1), 'Here is a concise answer without using tools.');
});

test('native-search phase buffers provisional prose until the final turn is ready', async () => {
    const snapshot = makeSnapshot('Search X for BTC sentiment, then analyze holders', {
        requestedTokenSymbols: ['BTC'],
        normalizedIntent: makeCanonicalIntent({
            entities: {
                tokenAddresses: [],
                tokenSymbols: ['BTC'],
                walletAddresses: [],
                marketIdentifiers: [],
            },
            evidenceRequirements: ['native_search_results', 'onchain_token_evidence'],
            requiresOnchainEvidence: true,
        }),
    });
    const broker = makeBroker();
    let generationRound = 0;

    const generationClient = {
        async generate(params: any) {
            if (String(params?.taskId || '').endsWith(':plan')) {
                return { text: '', reasoning: '', citations: [], toolCalls: [] };
            }
            generationRound += 1;
            if (generationRound === 1) {
                return {
                    text: 'Provisional native-search answer that should stay hidden.',
                    reasoning: 'Hidden native-search reasoning.',
                    citations: [{ url: 'https://x.com/example/status/1' }],
                    bufferedVisibleOutput: true,
                    toolCalls: [
                        {
                            id: 'native-x',
                            name: 'x_search',
                            arguments: { query: 'BTC sentiment today' },
                        },
                    ],
                };
            }
            return {
                text: 'Final answer after chain-side follow-up.',
                reasoning: '',
                citations: [],
                bufferedVisibleOutput: false,
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

    assert.equal(generationRound, 2);
    assert.equal(broker.getContent(), 'Final answer after chain-side follow-up.');
    assert.deepEqual(broker.citations, [{ url: 'https://x.com/example/status/1' }]);
});

test('truncated Grok final answers continue once without duplicating the visible prefix', async () => {
    const snapshot = makeSnapshot('Find upcoming TGE and airdrop projects with tutorials.', {
        normalizedIntent: makeCanonicalIntent({
            domain: 'market',
            searchTarget: 'x_and_web',
            evidenceRequirements: ['native_search_results'],
            requiresOnchainEvidence: false,
        }),
    });
    const broker = makeBroker();
    const seenRounds: Array<{ tools: string[]; enableSearch: boolean; bufferVisibleOutput: boolean; previousResponseId?: string }> = [];
    let generationRound = 0;

    const generationClient = {
        async generate(params: any) {
            if (String(params?.taskId || '').endsWith(':plan')) {
                return { text: '', reasoning: '', citations: [], toolCalls: [] };
            }
            generationRound += 1;
            seenRounds.push({
                tools: (params.tools || []).map((item: any) => item.function?.name).filter(Boolean),
                enableSearch: Boolean(params.providerOptions?.enable_search),
                bufferVisibleOutput: Boolean(params.providerOptions?.buffer_visible_output),
                previousResponseId: params.providerOptions?.previous_response_id,
            });
            if (generationRound === 1) {
                await params.onTextDelta?.('Project shortlist: Katana, Backpack, ');
                await params.onProviderState?.({ previousResponseId: 'resp-continue-1', finishReason: 'length' });
                return {
                    text: 'Project shortlist: Katana, Backpack, ',
                    reasoning: '',
                    citations: [],
                    providerState: { previousResponseId: 'resp-continue-1', finishReason: 'length' },
                    bufferedVisibleOutput: false,
                    toolCalls: [],
                };
            }
            return {
                text: 'Backpack, Polymarket, and others. Use the linked guides to complete quests and trading tasks.',
                reasoning: '',
                citations: [],
                providerState: { previousResponseId: 'resp-continue-1', finishReason: 'stop' },
                bufferedVisibleOutput: true,
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

    assert.equal(generationRound, 2);
    assert.deepEqual(seenRounds[0], {
        tools: [],
        enableSearch: true,
        bufferVisibleOutput: false,
        previousResponseId: undefined,
    });
    assert.equal(seenRounds[1]?.enableSearch, false);
    assert.equal(seenRounds[1]?.bufferVisibleOutput, true);
    assert.equal(seenRounds[1]?.previousResponseId, 'resp-continue-1');
    assert.equal(
        broker.getContent(),
        'Project shortlist: Katana, Backpack, Polymarket, and others. Use the linked guides to complete quests and trading tasks.',
    );
});

test('explicit structured swap requests use the fast swap lane without generation', async () => {
    const snapshot = makeSnapshot('Buy 0x0bc61768132aa1484e2b09301284b7def78a4444 for 0.001 BNB on BSC', {
        requestedTokenAddresses: ['0x0bc61768132aa1484e2b09301284b7def78a4444'],
        requestedTokenSymbols: ['BNB'],
        runtime: {
            chainId: 56,
            chainName: 'BNB Chain',
            nativeBalance: '0.00764573',
            userId: 'user-1',
            toolContext: {
                chainId: 56,
                chainName: 'BNB Chain',
                nativeBalance: '0.00764573',
                toolConfig: {
                    customSlippage: '10',
                },
            },
        },
    });
    const broker = makeBroker();
    const generationClient = {
        async generate() {
            throw new Error('generation should not be called for fast swap lane');
        },
    };
    const seenCalls: string[] = [];

    await runNodeOrchestration({
        snapshot,
        generationClient: generationClient as any,
        toolExecutionEngine: {
            async execute(call: any) {
                seenCalls.push(call.name);
                if (call.name === 'get_token_info') {
                    return {
                        id: call.id,
                        name: call.name,
                        arguments: call.arguments,
                        ok: true,
                        result: {
                            symbol: 'BENJI',
                            name: 'Benji Bean',
                        },
                    };
                }
                if (call.name === 'simulate_swap') {
                    return {
                        id: call.id,
                        name: call.name,
                        arguments: call.arguments,
                        ok: true,
                        result: {
                            expected_out_human: '8779.58',
                            price_impact: '0%',
                        },
                    };
                }
                throw new Error(`unexpected tool ${call.name}`);
            },
        } as any,
        broker: broker as any,
        toolContext: snapshot.runtime.toolContext || {},
    });

    assert.deepEqual(seenCalls.sort(), ['get_token_info', 'simulate_swap']);
    assert.match(broker.getContent(), /Fast quote ready|已获取快速报价/);
    assert.match(broker.getContent(), /0\.001 BNB/);
    assert.match(broker.getContent(), /BENJI/);
});

test('route-selected clarification stops before canonical normalization or main generation', async () => {
    const snapshot = makeSnapshot('Use the reference image to make a new poster');
    const broker = makeBroker();
    const taskIds: string[] = [];
    const generationClient = {
        async generate(params: { taskId: string }) {
            taskIds.push(params.taskId);
            if (params.taskId.endsWith(':route')) {
                return {
                    toolCalls: [],
                    text: JSON.stringify({
                        owner: 'image',
                        phase: 'execute',
                        facets: ['reference_image'],
                        entities: {
                            token_addresses: [],
                            token_symbols: [],
                            wallet_addresses: [],
                            market_identifiers: [],
                            image_refs: [],
                        },
                        requested_chain: null,
                        requested_time_window: null,
                        row_count: null,
                        inherit_entities_from_context: true,
                        locale: 'en',
                        needs_clarification: true,
                        clarification_question: 'Which visual style should I use?',
                        explanation: 'Image request requires a style choice.',
                        confidence: 0.97,
                    }),
                    reasoning: '',
                    citations: [],
                };
            }
            throw new Error(`unexpected generation call ${params.taskId}`);
        },
    };

    await runNodeOrchestration({
        snapshot,
        generationClient: generationClient as any,
        toolExecutionEngine: { async execute() { throw new Error('no tools expected'); } } as any,
        broker: broker as any,
        toolContext: {},
    });

    assert.deepEqual(taskIds, ['task-search:route']);
    assert.equal(broker.getContent(), 'Which visual style should I use?');
});

test('duplicate-only read-only rounds force a no-tool final answer from cached evidence', async () => {
    const snapshot = makeSnapshot("What's the trending token ?", {
        normalizedIntent: makeCanonicalIntent({
            domain: 'token',
            intent: 'token_analysis',
            searchTarget: 'none',
            entities: {
                tokenAddresses: [],
                tokenSymbols: [],
                walletAddresses: [],
                marketIdentifiers: [],
            },
            requestedChain: { chainId: 56, chainName: 'BSC', source: 'llm' },
        }),
    });
    const broker = makeBroker();
    const seenRounds: Array<{ tools: string[]; enableSearch: boolean }> = [];
    let generationRound = 0;
    let executeCalls = 0;

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
                    text: '',
                    reasoning: '',
                    toolCalls: (params.tools || [])
                        .map((item: any) => item.function?.name)
                        .filter((name: string | undefined) => typeof name === 'string' && name.startsWith('read_'))
                        .map((name: string, index: number) => ({
                            id: `read-${index + 1}`,
                            name,
                            arguments: {},
                        })),
                };
            }
            if (generationRound <= 3) {
                return {
                    text: '',
                    reasoning: '',
                    toolCalls: [
                        {
                            id: `trend-${generationRound}`,
                            name: 'get_trending_tokens',
                            arguments: { chain: 'bsc', chain_id: 56, limit: 10 },
                        },
                    ],
                };
            }
            assert.equal((params.tools || []).length, 0);
            assert.equal(Boolean(params.providerOptions?.enable_search), false);
            return {
                text: 'The top cached trending token on BSC is VIRTUAL.',
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
                if (String(call.name || '').startsWith('read_')) {
                    return {
                        ok: true,
                        result: { available: true },
                        metadata: { source: 'tool_runtime' },
                    };
                }
                executeCalls += 1;
                assert.equal(call.name, 'get_trending_tokens');
                return {
                    ok: true,
                    result: { topToken: { symbol: 'VIRTUAL', chain: 'bsc' } },
                    metadata: { source: 'tool_runtime' },
                };
            },
        } as any,
        broker: broker as any,
        toolContext: {},
    });

    assert.equal(executeCalls, 1);
    assert.equal(generationRound, 4);
    assert.equal(seenRounds[0]?.enableSearch, false);
    assert.ok((seenRounds[0]?.tools || []).includes('read_workflow_state'));
    assert.ok((seenRounds[0]?.tools || []).includes('read_user_context'));
    assert.ok((seenRounds[0]?.tools || []).includes('read_token_context'));
    assert.ok(!(seenRounds[0]?.tools || []).includes('get_trending_tokens'));
    assert.ok((seenRounds[1]?.tools || []).includes('get_trending_tokens'));
    assert.equal(seenRounds[3]?.enableSearch, false);
    assert.deepEqual(seenRounds[3]?.tools || [], []);
    assert.equal(broker.texts.join(''), 'The top cached trending token on BSC is VIRTUAL.');
});

test('pseudo tool JSON in assistant text is sanitized but does not trigger a forced retry', async () => {
    const snapshot = makeSnapshot("What's trending on X right now?", {
        model: 'deepseek-reasoner',
        runtime: {
            walletAddress: '0xabc',
        },
        normalizedIntent: makeCanonicalIntent({}),
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
        normalizedIntent: makeCanonicalIntent({
            entities: {
                tokenAddresses: ['0x1111111111111111111111111111111111111111'],
                tokenSymbols: [],
                walletAddresses: [],
                marketIdentifiers: [],
            },
            evidenceRequirements: ['native_search_results', 'onchain_token_evidence'],
            requiresOnchainEvidence: true,
        }),
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
        normalizedIntent: makeCanonicalIntent({
            entities: {
                tokenAddresses: [tokenAddress],
                tokenSymbols: [],
                walletAddresses: [],
                marketIdentifiers: [],
            },
            timeContext: {
                isTimeBound: true,
                description: '2026-03-10 12:00 UTC',
            },
            evidenceRequirements: ['native_search_results', 'onchain_token_evidence'],
            requiresOnchainEvidence: true,
        }),
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

test('function_call-style pseudo tool output is sanitized and rejected when no user-facing answer remains', async () => {
    const tokenAddress = '0xeCCBb861c0dda7eFd964010085488B69317e4444';
    const snapshot = makeSnapshot('2026-03-10上架的alpha，然后你能查询当天的early buyer吗？', {
        model: 'deepseek-reasoner',
        requestedTokenAddresses: [tokenAddress],
        normalizedIntent: makeCanonicalIntent({
            locale: 'zh',
            entities: {
                tokenAddresses: [tokenAddress],
                tokenSymbols: [],
                walletAddresses: [],
                marketIdentifiers: [],
            },
            timeContext: {
                isTimeBound: true,
                description: '2026-03-10 alpha listing day',
            },
            evidenceRequirements: ['native_search_results', 'onchain_token_evidence'],
            requiresOnchainEvidence: true,
        }),
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

    await assert.rejects(
        () => runNodeOrchestration({
            snapshot,
            generationClient: generationClient as any,
            toolExecutionEngine: { async execute() { throw new Error('no tool execution expected'); } } as any,
            broker: broker as any,
            toolContext: {},
        }),
        (error: any) => error?.code === 'NO_FINAL_USER_FACING_OUTPUT',
    );

    assert.equal(generationRound, 1);
    assert.deepEqual(broker.replacements, ['']);
});

test('prose-style pseudo tool narration may trigger one clean recovery round', async () => {
    const tokenAddress = '0xeCCBb861c0dda7eFd964010085488B69317e4444';
    const snapshot = makeSnapshot('Find the early buyers around 2026-03-10 for this token', {
        model: 'deepseek-reasoner',
        requestedTokenAddresses: [tokenAddress],
        normalizedIntent: makeCanonicalIntent({
            domain: 'token',
            intent: 'early_buyers',
            outputMode: 'full_table',
            searchTarget: 'none',
            searchMode: 'forbidden',
            entities: {
                tokenAddresses: [tokenAddress],
                tokenSymbols: [],
                walletAddresses: [],
                marketIdentifiers: [],
            },
            timeContext: {
                isTimeBound: true,
                description: 'around 2026-03-10',
            },
            evidenceRequirements: ['onchain_token_evidence'],
            requiresOnchainEvidence: true,
            requiresRealtime: false,
        }),
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
            if (generationRound >= 2) {
                return {
                    text: 'No verified early-buyer evidence has been gathered yet.',
                    reasoning: '',
                    toolCalls: [],
                };
            }
        },
    };

    await runNodeOrchestration({
        snapshot,
        generationClient: generationClient as any,
        toolExecutionEngine: { async execute() { throw new Error('no tool execution expected'); } } as any,
        broker: broker as any,
        toolContext: {},
    });

    assert.ok(generationRound >= 2);
    assert.deepEqual(broker.replacements, ['I will use real tools now.']);
    assert.match(broker.texts.join(''), /No verified early-buyer evidence has been gathered yet\./);
});

test('pure early-buyer tool-name narration may trigger one clean recovery round', async () => {
    const tokenAddress = '0xeCCBb861c0dda7eFd964010085488B69317e4444';
    const snapshot = makeSnapshot(`Check ${tokenAddress} early buyer`, {
        model: 'deepseek-reasoner',
        requestedTokenAddresses: [tokenAddress],
        normalizedIntent: makeCanonicalIntent({
            domain: 'token',
            intent: 'early_buyers',
            outputMode: 'full_table',
            searchTarget: 'none',
            searchMode: 'forbidden',
            entities: {
                tokenAddresses: [tokenAddress],
                tokenSymbols: [],
                walletAddresses: [],
                marketIdentifiers: [],
            },
            evidenceRequirements: ['onchain_token_evidence'],
            requiresOnchainEvidence: true,
            requiresRealtime: false,
        }),
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
            if (generationRound >= 2) {
                return {
                    text: 'No verified early-buyer data is available yet.',
                    reasoning: '',
                    toolCalls: [],
                };
            }
        },
    };

    await runNodeOrchestration({
        snapshot,
        generationClient: generationClient as any,
        toolExecutionEngine: { async execute() { throw new Error('no tool execution expected'); } } as any,
        broker: broker as any,
        toolContext: {},
    });

    assert.ok(generationRound >= 2);
    assert.deepEqual(broker.replacements, [
        `I will fetch on-chain token info and early-buyer data now for ${tokenAddress} on BNB Chain (chain id 56). Proceeding to gather evidence.`,
    ]);
    assert.match(broker.texts.join(''), /No verified early-buyer data is available yet\./);
});

test('artifact-only rounds fail when the model returns no final answer text', async () => {
    const snapshot = makeSnapshot('Show a market card and explain it', {
        normalizedIntent: makeCanonicalIntent({}),
    });
    const broker = makeBroker();
    broker.hasVisibleArtifact = () => true;

    const generationClient = {
        async generate(params: any) {
            if (String(params?.taskId || '').endsWith(':plan')) {
                return { text: '', reasoning: '', toolCalls: [] };
            }
            return {
                text: '',
                reasoning: '',
                toolCalls: [],
            };
        },
    };

    await assert.rejects(
        () => runNodeOrchestration({
            snapshot,
            generationClient: generationClient as any,
            toolExecutionEngine: { async execute() { throw new Error('unexpected tool execution'); } } as any,
            broker: broker as any,
            toolContext: {},
        }),
        (error: any) => error?.code === 'NO_FINAL_USER_FACING_OUTPUT',
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

test('applyCanonicalIntentOverridesToToolCall forces literal canonical early-buyer window over model-invented UTC window', () => {
    const overridden = applyCanonicalIntentOverridesToToolCall({
        id: 'buyers-window',
        name: 'get_early_buyers',
        arguments: {
            address: '0xabc',
            chain: 'bsc',
            start_time: '2026-04-03T11:48:00Z',
            end_time: '2026-04-03T11:48:59Z',
        },
    }, {
        domain: 'token',
        intent: 'early_buyers',
        taskMode: 'analyze',
        outputMode: 'full_table',
        searchMode: 'forbidden',
        searchTarget: 'none',
        confidence: 0.99,
        explanation: 'literal time-bound early buyer query',
        entities: {
            tokenAddresses: ['0xabc'],
            tokenSymbols: [],
            walletAddresses: [],
            marketIdentifiers: [],
        },
        requestedChain: {
            chainId: 56,
            chainName: 'BNB Chain',
            source: 'llm',
        },
        timeContext: {
            isTimeBound: true,
            description: 'today 11:48 in user timezone',
            startTime: '2026-04-03T11:48:00+08:00',
            endTime: '2026-04-03T11:48:59+08:00',
        },
        evidenceRequirements: ['onchain_token_evidence'],
        requiresRealtime: true,
        requiresOnchainEvidence: true,
        executionCandidate: false,
        rowCount: null,
        locale: 'zh',
        needsClarification: false,
        clarificationQuestion: null,
        source: 'llm',
    });

    assert.equal(overridden.arguments.start_time, '2026-04-03T11:48:00+08:00');
    assert.equal(overridden.arguments.end_time, '2026-04-03T11:48:59+08:00');
});

test('applyCanonicalIntentOverridesToToolCall prefers task-route time bounds when canonical is absent', () => {
    const overridden = applyCanonicalIntentOverridesToToolCall({
        id: 'buyers-window-route',
        name: 'get_early_buyers',
        arguments: {
            address: '0xabc',
            chain: 'base',
            start_time: '2026-04-23T03:48:00Z',
            end_time: '2026-04-23T03:48:59Z',
        },
    }, null, {
        owner: 'token',
        phase: 'analyze',
        facets: ['early_buyers', 'short_window'],
        entities: {
            tokenAddresses: ['0xabc'],
            tokenSymbols: [],
            walletAddresses: [],
            marketIdentifiers: [],
            imageRefs: [],
        },
        requestedChain: {
            chainId: 8453,
            chainName: 'Base',
            source: 'query',
        },
        timeContext: {
            isTimeBound: true,
            description: 'today 11:48 in user timezone',
            startTime: '2026-04-23T11:48:00+08:00',
            endTime: '2026-04-23T11:48:59+08:00',
        },
        rowCount: null,
        inheritEntitiesFromContext: false,
        locale: 'zh',
        needsClarification: false,
        clarificationQuestion: null,
        explanation: 'Literal time-bound early buyer query.',
        confidence: 0.98,
        source: 'llm',
    } as any);

    assert.equal(overridden.arguments.start_time, '2026-04-23T11:48:00+08:00');
    assert.equal(overridden.arguments.end_time, '2026-04-23T11:48:59+08:00');
});
