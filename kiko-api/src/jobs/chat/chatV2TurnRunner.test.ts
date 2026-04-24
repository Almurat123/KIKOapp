import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChatContextSnapshot } from './contracts.js';
import { runChatV2Turn } from './chatV2TurnRunner.js';
import { applyTaskRouteToSnapshot } from './taskRoute.js';

function makeSnapshot(message: string, overrides: Partial<ChatContextSnapshot> = {}): ChatContextSnapshot {
    const { runtime: runtimeOverrides, ...restOverrides } = overrides;
    return {
        sessionId: 'session-runner',
        taskId: 'task-runner',
        assistantMessageId: 'assistant-runner',
        model: 'gpt-5.4-mini',
        history: [],
        lastUserMessage: message,
        requestedTokenAddresses: [],
        requestedTokenSymbols: [],
        toolDefinitions: [],
        recentToolTrace: {
            messageId: 'assistant-runner',
            toolCalls: [],
        },
        runtime: {
            userSettings: {},
            toolContext: {},
            prefetchedToolResults: {},
            contextBlocks: {},
            systemDirectives: [],
            ...(runtimeOverrides || {}),
        },
        ...restOverrides,
    } as ChatContextSnapshot;
}

function makeBroker() {
    const texts: string[] = [];
    const reasoning: string[] = [];
    const runtimeActions: string[] = [];
    return {
        async bootstrapRuntime() { runtimeActions.push('bootstrapRuntime'); },
        hasVisibleArtifact() { return false; },
        async markPlanPhase() { runtimeActions.push('markPlanPhase'); },
        async ensurePlanStep() {},
        async focusPlanStep() {},
        async noteToolSelected() {},
        async markPlanStepStarted() {},
        async markAnswerStarted() {},
        async setRuntimeState() {},
        pushUsage() {},
        pushCitation() {},
        async blockContent(content: string) {
            texts.length = 0;
            if (content) texts.push(content);
        },
        getCitations() { return []; },
        async recordProviderNativeEvidence() {},
        getProviderNativeEvidence() { return []; },
        async pushText(text: string) { texts.push(text); },
        async pushReasoning(text: string) { reasoning.push(text); },
        async applyModelPlan() { runtimeActions.push('applyModelPlan'); },
        async recordToolResult() {},
        async complete(overrides?: { content?: string }) {
            texts.length = 0;
            if (overrides?.content) texts.push(overrides.content);
        },
        getContent() { return texts.join(''); },
        getToolResults() { return []; },
        getReasoning() { return reasoning.join(''); },
        getRuntimeActions() { return [...runtimeActions]; },
    };
}

test('runChatV2Turn reuses a pre-normalized snapshot without issuing a normalize generation call', async () => {
    const taskIds: string[] = [];
    const generationClient = {
        async generate(params: { taskId: string; onTextDelta: (text: string) => Promise<void> }) {
            taskIds.push(params.taskId);
            await params.onTextDelta('Quantum entanglement is a correlation pattern between quantum systems.');
            return {
                toolCalls: [],
                text: 'Quantum entanglement is a correlation pattern between quantum systems.',
                reasoning: '',
                citations: [],
            };
        },
    } as any;
    const broker = makeBroker();

    const snapshot = makeSnapshot('Explain quantum entanglement.', {
        normalizedIntent: {
            domain: 'general',
            intent: 'general_answer',
            taskMode: 'discover',
            outputMode: 'narrative',
            searchMode: 'forbidden',
            searchTarget: 'none',
            confidence: 0.99,
            explanation: 'pre-normalized general answer',
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
            executionCandidate: false,
            rowCount: null,
            locale: 'en',
            needsClarification: false,
            clarificationQuestion: null,
            source: 'llm',
        } as any,
    });

    const result = await runChatV2Turn({
        snapshot,
        task: {
            id: 'task-runner',
            sessionId: 'session-runner',
            assistantMessageId: 'assistant-runner',
            model: 'gpt-5.4-mini',
            toolContext: {},
        },
        userId: 'user-runner',
        broker: broker as any,
        generationClient,
        toolExecutionEngine: {} as any,
    });

    assert.equal(taskIds.includes('task-runner:normalize'), false);
    assert.ok(taskIds.includes('task-runner'));
    assert.equal(result.terminal, false);
    assert.match(broker.getContent(), /Quantum entanglement/);
    assert.equal(String(result.snapshot.conversationActionState?.pendingAction || 'none'), 'none');
});

test('runChatV2Turn reuses a pre-routed snapshot without route-selection or normalization calls', async () => {
    const taskIds: string[] = [];
    const generationClient = {
        async generate(params: { taskId: string; messages?: Array<{ role: string; content: any }>; onTextDelta: (text: string) => Promise<void> }) {
            taskIds.push(params.taskId);
            if (params.taskId.endsWith(':route_selection') || params.taskId.endsWith(':normalize')) {
                throw new Error(`unexpected intent stage call: ${params.taskId}`);
            }
            await params.onTextDelta('I can generate an image from the uploaded reference.');
            return {
                toolCalls: [],
                text: 'I can generate an image from the uploaded reference.',
                reasoning: '',
                citations: [],
            };
        },
    } as any;
    const broker = makeBroker();
    const snapshot = applyTaskRouteToSnapshot(
        makeSnapshot('Use the attached image and make a cleaner poster version', {
            runtime: {
                socialInput: {
                    platform: 'farcaster',
                    images: [{ url: 'https://example.com/reference.png' }],
                },
            },
        }),
        {
            owner: 'image',
            phase: 'execute',
            facets: ['reference_image', 'social_images'],
            entities: {
                tokenAddresses: [],
                tokenSymbols: [],
                walletAddresses: [],
                marketIdentifiers: [],
                imageRefs: ['https://example.com/reference.png'],
            },
            requestedChain: null,
            timeContext: null,
            rowCount: null,
            inheritEntitiesFromContext: true,
            locale: 'en',
            needsClarification: false,
            clarificationQuestion: null,
            explanation: 'Reference-image generation request.',
            confidence: 0.99,
            source: 'llm',
        },
    );

    const result = await runChatV2Turn({
        snapshot,
        task: {
            id: 'task-runner',
            sessionId: 'session-runner',
            assistantMessageId: 'assistant-runner',
            model: 'gpt-5.4-mini',
            toolContext: {},
        },
        userId: 'user-runner',
        broker: broker as any,
        generationClient,
        toolExecutionEngine: {} as any,
    });

    assert.deepEqual(taskIds, ['task-runner']);
    assert.equal(result.terminal, false);
    assert.equal(result.snapshot.taskRoute?.owner, 'image');
    assert.match(broker.getContent(), /generate an image/);
});

test('runChatV2Turn does not persist provider response ids from unresolved tool-call turns', async () => {
    const stateUpdates: Record<string, any>[] = [];
    const generationClient = {
        async generate(params: { taskId: string; onProviderState?: (state: any) => Promise<void>; onTextDelta: (text: string) => Promise<void> }) {
            assert.equal(params.taskId, 'task-runner');
            await params.onProviderState?.({
                previousResponseId: 'resp-tool-call-only',
                finishReason: 'tool_calls',
            });
            await params.onTextDelta('Ready for confirmation.');
            return {
                toolCalls: [],
                text: 'Ready for confirmation.',
                reasoning: '',
                citations: [],
                providerState: {
                    previousResponseId: 'resp-tool-call-only',
                    finishReason: 'tool_calls',
                },
            };
        },
    } as any;
    const broker = makeBroker();
    const snapshot = makeSnapshot('Prepare the swap.', {
        taskRoute: {
            owner: 'general',
            phase: 'analyze',
            facets: [],
            entities: {
                tokenAddresses: [],
                tokenSymbols: [],
                walletAddresses: [],
                marketIdentifiers: [],
                imageRefs: [],
            },
            requestedChain: null,
            timeContext: null,
            rowCount: null,
            inheritEntitiesFromContext: false,
            locale: 'en',
            needsClarification: false,
            clarificationQuestion: null,
            explanation: 'pre-routed test turn',
            confidence: 0.99,
            source: 'llm',
        } as any,
    });

    const result = await runChatV2Turn({
        snapshot,
        task: {
            id: 'task-runner',
            sessionId: 'session-runner',
            assistantMessageId: 'assistant-runner',
            model: 'gpt-5.4-mini',
            toolContext: {},
        },
        userId: 'user-runner',
        broker: broker as any,
        generationClient,
        toolExecutionEngine: {} as any,
        updateSessionConversationState: async (state) => {
            stateUpdates.push(state);
        },
    });

    assert.equal(result.terminal, false);
    assert.deepEqual(stateUpdates, []);
    assert.match(broker.getContent(), /Ready for confirmation/);
});

test('runChatV2Turn never persists provider response ids across user turns', async () => {
    const stateUpdates: Record<string, any>[] = [];
    const finishReasons = ['tool_calls', 'length', 'stop'];
    const generationClient = {
        async generate(params: { onProviderState?: (state: any) => Promise<void>; onTextDelta: (text: string) => Promise<void> }) {
            const finishReason = finishReasons.shift() || 'stop';
            const previousResponseId = `resp-${finishReason}`;
            await params.onProviderState?.({
                previousResponseId,
                finishReason,
            });
            await params.onTextDelta(`Round ${finishReason}.`);
            return {
                toolCalls: [],
                text: `Round ${finishReason}.`,
                reasoning: '',
                citations: [],
                providerState: {
                    previousResponseId,
                    finishReason,
                },
            };
        },
    } as any;

    const makeTurnParams = (id: string) => ({
        snapshot: makeSnapshot('Continue.', {
            taskRoute: {
                owner: 'general',
                phase: 'answer',
                facets: [],
                entities: {
                    tokenAddresses: [],
                    tokenSymbols: [],
                    walletAddresses: [],
                    marketIdentifiers: [],
                    imageRefs: [],
                },
                requestedChain: null,
                timeContext: null,
                rowCount: null,
                inheritEntitiesFromContext: false,
                locale: 'en',
                needsClarification: false,
                clarificationQuestion: null,
                explanation: 'pre-routed test turn',
                confidence: 0.99,
                source: 'llm',
            } as any,
        }),
        task: {
            id,
            sessionId: 'session-runner',
            assistantMessageId: `assistant-${id}`,
            model: 'gpt-5.4-mini',
            toolContext: {},
        },
        userId: 'user-runner',
        broker: makeBroker() as any,
        generationClient,
        toolExecutionEngine: {} as any,
        updateSessionConversationState: async (state: Record<string, any>) => {
            stateUpdates.push(state);
        },
    });

    await runChatV2Turn(makeTurnParams('task-tool-calls'));
    await runChatV2Turn(makeTurnParams('task-length'));
    await runChatV2Turn(makeTurnParams('task-stop'));

    assert.deepEqual(stateUpdates, []);
});

test('runChatV2Turn sends confirmation follow-ups through model orchestration instead of direct execution', async () => {
    const broker = makeBroker();
    const generationCalls: string[] = [];
    const snapshot = applyTaskRouteToSnapshot(
        makeSnapshot('Confirm', {
            confirmationState: {
                kind: 'order_confirmation',
                sourceTool: 'deploy_clanker_token',
                order: {
                    toolName: 'deploy_clanker_token',
                    args: {
                        name: 'Trace Test',
                        symbol: 'TRC',
                        chainId: 8453,
                        tokenAdmin: '0x1111111111111111111111111111111111111111',
                        description: 'Trace test token',
                    },
                    actionClass: 'TOKEN_DEPLOY_MUTATION',
                },
            } as any,
            conversationActionState: {
                pendingAction: 'order',
                confirmationPayload: {
                    kind: 'order_confirmation',
                    sourceTool: 'deploy_clanker_token',
                    order: {
                        toolName: 'deploy_clanker_token',
                        args: {
                            name: 'Trace Test',
                            symbol: 'TRC',
                            chainId: 8453,
                            tokenAdmin: '0x1111111111111111111111111111111111111111',
                            description: 'Trace test token',
                        },
                        actionClass: 'TOKEN_DEPLOY_MUTATION',
                    },
                },
                canExecute: true,
                needsClarification: false,
                clarificationQuestion: null,
            } as any,
            runtime: {
                userSettings: {},
                toolContext: {},
                prefetchedToolResults: {},
                contextBlocks: {},
                systemDirectives: [],
                walletAddress: '0x1111111111111111111111111111111111111111',
            },
        }),
        {
            owner: 'token_deploy',
            phase: 'confirm',
            facets: [],
            entities: {
                tokenAddresses: [],
                tokenSymbols: ['TRC'],
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
            explanation: 'Confirm the prepared token deployment.',
            confidence: 0.99,
            source: 'llm',
        },
    );

    const result = await runChatV2Turn({
        snapshot,
        task: {
            id: 'task-runner',
            sessionId: 'session-runner',
            assistantMessageId: 'assistant-runner',
            model: 'gpt-5.4-mini',
            toolContext: {
                userAddress: '0x1111111111111111111111111111111111111111',
            },
        },
        userId: 'user-runner',
        broker: broker as any,
        generationClient: {
            async generate(params: { taskId: string; onTextDelta?: (text: string) => Promise<void> }) {
                generationCalls.push(params.taskId);
                if (params.taskId.endsWith(':plan')) {
                    return { toolCalls: [], text: '', reasoning: '', citations: [] };
                }
                await params.onTextDelta?.('I will handle the confirmation through the model path.');
                return {
                    toolCalls: [],
                    text: 'I will handle the confirmation through the model path.',
                    reasoning: '',
                    citations: [],
                };
            },
        } as any,
        toolExecutionEngine: {
            async execute(call: any) {
                if (String(call?.name || '').startsWith('read_')) {
                    return {
                        id: call.id,
                        name: call.name,
                        arguments: call.arguments,
                        ok: true,
                        result: { ok: true },
                        metadata: { source: 'tool_runtime' },
                    };
                }
                throw new Error(`unexpected direct tool execution: ${String(call?.name || '')}`);
            },
        } as any,
    });

    assert.equal(result.terminal, false);
    assert.ok(generationCalls.includes('task-runner'));
    assert.match(broker.getContent(), /model path/);
});

test('runChatV2Turn routes explicit swap syntax through the unified owner-selection path', async () => {
    const taskIds: string[] = [];
    const generationClient = {
        async generate(params: { taskId: string; onTextDelta?: (text: string) => Promise<void> }) {
            taskIds.push(params.taskId);
            if (params.taskId.endsWith(':route')) {
                return {
                    toolCalls: [],
                    text: JSON.stringify({
                        owner: 'swap',
                        phase: 'execute',
                        facets: [],
                        entities: {
                            token_addresses: [],
                            token_symbols: ['ETH', 'USDC'],
                            wallet_addresses: [],
                            market_identifiers: [],
                            image_refs: [],
                        },
                        requested_chain: {
                            chain_id: 8453,
                            chain_name: 'Base',
                            source: 'llm',
                        },
                        requested_time_window: null,
                        row_count: null,
                        inherit_entities_from_context: false,
                        locale: 'en',
                        needs_clarification: false,
                        clarification_question: null,
                        explanation: 'Direct swap request on Base.',
                        confidence: 0.99,
                    }),
                    reasoning: '',
                    citations: [],
                };
            }
            await params.onTextDelta?.('I can quote this swap once the execution tool runs.');
            return {
                toolCalls: [],
                text: 'I can quote this swap once the execution tool runs.',
                reasoning: '',
                citations: [],
            };
        },
    } as any;
    const broker = makeBroker();

    const result = await runChatV2Turn({
        snapshot: makeSnapshot('swap 0.001 ETH to USDC', {
            requestedTokenSymbols: ['ETH', 'USDC'],
            runtime: {
                chainId: 8453,
                chainName: 'Base',
                nativeBalance: '0.03823547',
            },
        }),
        task: {
            id: 'task-runner',
            sessionId: 'session-runner',
            assistantMessageId: 'assistant-runner',
            model: 'gpt-5.4-mini',
            toolContext: {},
        },
        userId: 'user-runner',
        broker: broker as any,
        generationClient,
        toolExecutionEngine: {} as any,
    });

    assert.ok(taskIds.includes('task-runner:route'));
    assert.ok(taskIds.includes('task-runner'));
    assert.equal(result.snapshot.taskRoute?.owner, 'swap');
    assert.equal(result.snapshot.taskRoute?.phase, 'execute');
    assert.match(broker.getContent(), /quote this swap/i);
});

test('runChatV2Turn puts image execute turns into forced image tool work mode', async () => {
    const seenRounds: Array<{ tools: string[]; toolChoice: any; content: string }> = [];
    const generationClient = {
        async generate(params: {
            taskId: string;
            messages?: Array<{ role: string; content: any }>;
            tools?: Array<{ function?: { name?: string } }>;
            providerOptions?: Record<string, any>;
        }) {
            if (params.taskId.endsWith(':route_selection') || params.taskId.endsWith(':normalize')) {
                throw new Error(`unexpected intent stage call: ${params.taskId}`);
            }
            seenRounds.push({
                tools: (params.tools || []).map((tool) => String(tool.function?.name || '')).filter(Boolean),
                toolChoice: params.providerOptions?.tool_choice,
                content: (params.messages || [])
                    .map((message) => typeof message.content === 'string' ? message.content : JSON.stringify(message.content || ''))
                    .join('\n'),
            });
            return {
                toolCalls: [
                    {
                        id: 'call-image',
                        name: 'generate_image_from_intent',
                        arguments: {
                            user_intent: 'Create a cleaner poster from the attached reference image.',
                        },
                    },
                ],
                text: '',
                reasoning: '',
                citations: [],
            };
        },
    } as any;
    const broker = makeBroker();
    const executedTools: string[] = [];
    const snapshot = applyTaskRouteToSnapshot(
        makeSnapshot('Use the attached image and make a cleaner poster version', {
            toolDefinitions: [
                { name: 'generate_image_from_intent', description: 'Generate an image from user intent.', parameters: {} },
                { name: 'prepare_swap_transaction', description: 'Prepare a swap transaction.', parameters: {} },
            ] as any,
            runtime: {
                socialInput: {
                    platform: 'farcaster',
                    images: [{ url: 'https://example.com/reference.png' }],
                },
            },
        }),
        {
            owner: 'image',
            phase: 'execute',
            facets: ['reference_image', 'social_images'],
            entities: {
                tokenAddresses: [],
                tokenSymbols: [],
                walletAddresses: [],
                marketIdentifiers: [],
                imageRefs: ['https://example.com/reference.png'],
            },
            requestedChain: null,
            timeContext: null,
            rowCount: null,
            inheritEntitiesFromContext: true,
            locale: 'en',
            needsClarification: false,
            clarificationQuestion: null,
            explanation: 'Reference-image generation request.',
            confidence: 0.99,
            source: 'llm',
        },
    );

    const result = await runChatV2Turn({
        snapshot,
        task: {
            id: 'task-runner',
            sessionId: 'session-runner',
            assistantMessageId: 'assistant-runner',
            model: 'gpt-5.4-mini',
            toolContext: {},
        },
        userId: 'user-runner',
        broker: broker as any,
        generationClient,
        toolExecutionEngine: {
            async execute(call: { name: string }) {
                executedTools.push(call.name);
                return {
                    id: 'call-image',
                    name: call.name,
                    arguments: {},
                    ok: true,
                    result: {
                        handled_response: true,
                        response_channel: 'generated-image',
                    },
                    metadata: { source: 'tool_runtime' },
                    continuation: {
                        next_action: 'complete_with_side_effect',
                        can_answer_now: true,
                        reason: 'Generated image response is owned by the image task pipeline.',
                        reusable_for_next_turn: false,
                    },
                };
            },
        } as any,
    });

    assert.equal(result.terminal, true);
    assert.equal(result.terminalOwner, 'external');
    assert.deepEqual(executedTools, ['generate_image_from_intent']);
    assert.equal(seenRounds.length, 1);
    assert.ok(seenRounds[0]!.tools.includes('generate_image_from_intent'));
    assert.ok(!seenRounds[0]!.tools.includes('prepare_swap_transaction'));
    assert.deepEqual(seenRounds[0]!.toolChoice, {
        type: 'function',
        function: {
            name: 'generate_image_from_intent',
        },
    });
    assert.match(seenRounds[0]!.content, /\[IMAGE_EXECUTION_WORK_MODE\]/);
});

test('runChatV2Turn does not enforce intent allowlist after the first model round', async () => {
    let routeSelectionCount = 0;
    const toolPolicyAllowedTools: string[][] = [];
    const toolPolicyIntentAllowlistFlags: Array<boolean | undefined> = [];
    const generationClient = {
        async generate(params: {
            taskId: string;
            tools?: Array<{ function?: { name?: string } }>;
        }) {
            if (params.taskId.endsWith(':route')) {
                routeSelectionCount += 1;
                const isImageRoute = routeSelectionCount === 2;
                return {
                    toolCalls: [],
                    text: JSON.stringify({
                        owner: isImageRoute ? 'image' : 'general_answer',
                        phase: isImageRoute ? 'execute' : 'answer',
                        facets: isImageRoute ? ['reference_image', 'social_images'] : [],
                        entities: {
                            token_addresses: [],
                            token_symbols: [],
                            wallet_addresses: [],
                            market_identifiers: [],
                            image_refs: isImageRoute ? ['https://example.com/reference.png'] : [],
                        },
                        requested_chain: null,
                        requested_time_window: null,
                        row_count: null,
                        inherit_entities_from_context: true,
                        locale: 'en',
                        needs_clarification: false,
                        clarification_question: null,
                        explanation: isImageRoute
                            ? 'The user wants the previous image request generated now.'
                            : 'The first pass needs context before selecting a specialist route.',
                        confidence: 0.98,
                    }),
                    reasoning: '',
                    citations: [],
                };
            }

            const toolNames = (params.tools || []).map((tool) => String(tool.function?.name || '')).filter(Boolean);
            if (toolNames.includes('generate_image_from_intent')) {
                return {
                    toolCalls: [
                        {
                            id: 'call-image',
                            name: 'generate_image_from_intent',
                            arguments: {
                                user_intent: 'Regenerate the previous image request with the attached reference.',
                            },
                        },
                    ],
                    text: '',
                    reasoning: '',
                    citations: [],
                };
            }

            return {
                toolCalls: [
                    {
                        id: 'call-context',
                        name: 'read_user_context',
                        arguments: {},
                    },
                ],
                text: '',
                reasoning: '',
                citations: [],
            };
        },
    } as any;
    const broker = makeBroker();
    const executedTools: string[] = [];

    const result = await runChatV2Turn({
        snapshot: makeSnapshot('again', {
            toolDefinitions: [
                { name: 'read_user_context', description: 'Read user context.', parameters: {} },
                { name: 'generate_image_from_intent', description: 'Generate an image from user intent.', parameters: {} },
            ] as any,
            runtime: {
                socialInput: {
                    platform: 'farcaster',
                    images: [{ url: 'https://example.com/reference.png' }],
                },
            },
        }),
        task: {
            id: 'task-runner',
            sessionId: 'session-runner',
            assistantMessageId: 'assistant-runner',
            model: 'gpt-5.4-mini',
            toolContext: {},
        },
        userId: 'user-runner',
        broker: broker as any,
        generationClient,
        toolExecutionEngine: {
            async execute(call: { id?: string; name: string }, toolContext: Record<string, any>) {
                executedTools.push(call.name);
                toolPolicyAllowedTools.push([...(toolContext.__controlPolicy?.allowedTools || [])]);
                toolPolicyIntentAllowlistFlags.push(toolContext.__controlPolicy?.enforceIntentAllowlist);
                if (call.name === 'generate_image_from_intent') {
                    return {
                        id: call.id || 'call-image',
                        name: call.name,
                        arguments: {},
                        ok: true,
                        result: {
                            handled_response: true,
                            response_channel: 'generated-image',
                        },
                        metadata: { source: 'tool_runtime' },
                        continuation: {
                            next_action: 'complete_with_side_effect',
                            can_answer_now: true,
                            reason: 'Generated image response is owned by the image task pipeline.',
                            reusable_for_next_turn: false,
                        },
                    };
                }
                return {
                    id: call.id || 'call-context',
                    name: call.name,
                    arguments: {},
                    ok: true,
                    result: { ok: true },
                    metadata: { source: 'tool_runtime' },
                    continuation: {
                        next_action: 'call_another_tool',
                        can_answer_now: false,
                        reason: 'Context read completed.',
                        reusable_for_next_turn: true,
                    },
                };
            },
        } as any,
    });

    assert.equal(result.terminal, true);
    assert.deepEqual(executedTools, ['read_user_context', 'generate_image_from_intent']);
    assert.equal(routeSelectionCount, 2);
    assert.equal(toolPolicyAllowedTools[0]?.includes('generate_image_from_intent'), false);
    assert.ok(toolPolicyAllowedTools.at(-1)?.includes('generate_image_from_intent'));
    assert.equal(toolPolicyIntentAllowlistFlags[0], true);
    assert.equal(toolPolicyIntentAllowlistFlags[1], false);
});

test('runChatV2Turn normalizes unnormalized turns with the same session model before orchestration', async () => {
    const taskIds: string[] = [];
    const userContents: string[] = [];
    const generationClient = {
        async generate(params: { taskId: string; messages?: Array<{ role: string; content: any }>; onTextDelta: (text: string) => Promise<void> }) {
            taskIds.push(params.taskId);
            if (params.taskId.endsWith(':normalize')) {
                return {
                    toolCalls: [],
                    text: JSON.stringify({
                        domain: 'token',
                        intent: 'swap',
                        task_mode: 'execute',
                        output_mode: 'execution_ready',
                        search_mode: 'forbidden',
                        search_target: 'none',
                        confidence: 0.94,
                        explanation: 'The user wants to prepare a swap.',
                        entities: {
                            token_addresses: [],
                            token_symbols: ['CAKE', 'BNB'],
                            wallet_addresses: [],
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
                        inherit_entities_from_context: false,
                        row_count: null,
                        locale: 'en',
                        needs_clarification: false,
                        clarification_question: null,
                    }),
                    reasoning: '',
                    citations: [],
                };
            }
            const userMessage = (params.messages || []).find((message) => message.role === 'user');
            userContents.push(typeof userMessage?.content === 'string' ? userMessage.content : JSON.stringify(userMessage?.content || ''));
            await params.onTextDelta('I can prepare a CAKE quote on BNB when the required trade details are available.');
            return {
                toolCalls: [],
                text: 'I can prepare a CAKE quote on BNB when the required trade details are available.',
                reasoning: '',
                citations: [],
            };
        },
    } as any;
    const broker = makeBroker();

    const result = await runChatV2Turn({
        snapshot: makeSnapshot('Buy CAKE on BNB chain', {
            requestedTokenSymbols: ['CAKE', 'BNB'],
        }),
        task: {
            id: 'task-runner',
            sessionId: 'session-runner',
            assistantMessageId: 'assistant-runner',
            model: 'gpt-5.4-mini',
            toolContext: {},
        },
        userId: 'user-runner',
        broker: broker as any,
        generationClient,
        toolExecutionEngine: {} as any,
    });

    assert.equal(taskIds.includes('task-runner:normalize'), true);
    assert.ok(taskIds.includes('task-runner'));
    assert.equal(result.snapshot.normalizedIntent?.intent, 'swap');
    assert.equal(result.snapshot.normalizationState?.status, 'ok');
    assert.ok(userContents.every((content) => !/\[TASK_MENU\]/.test(content)));
    assert.ok(userContents.some((content) => /\[CANONICAL_INTENT\]/.test(content)));
    assert.ok(userContents.some((content) => /\[CONTEXT_CATALOG\]/.test(content)));
    assert.ok(userContents.some((content) => /\[TOOL_CONTEXT\]/.test(content)));
    assert.match(broker.getContent(), /CAKE quote/);
});

test('runChatV2Turn sends bare greetings through the main model instead of a direct intro macro', async () => {
    const taskIds: string[] = [];
    const generationClient = {
        async generate(params: { taskId: string; messages?: Array<{ role: string; content: any }>; onTextDelta: (text: string) => Promise<void> }) {
            taskIds.push(params.taskId);
            if (params.taskId.endsWith(':normalize')) {
                return {
                    toolCalls: [],
                    text: JSON.stringify({
                        domain: 'assistant_meta',
                        intent: 'assistant_meta',
                        task_mode: 'discover',
                        output_mode: 'narrative',
                        search_mode: 'forbidden',
                        search_target: 'none',
                        confidence: 0.98,
                        explanation: 'Greeting and assistant introduction turn.',
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
                    citations: [],
                };
            }
            await params.onTextDelta('你好，有什么我可以帮你分析的？');
            return {
                toolCalls: [],
                text: '你好，有什么我可以帮你分析的？',
                reasoning: '',
                citations: [],
            };
        },
    } as any;
    const broker = makeBroker();

    const result = await runChatV2Turn({
        snapshot: makeSnapshot('你好'),
        task: {
            id: 'task-runner',
            sessionId: 'session-runner',
            assistantMessageId: 'assistant-runner',
            model: 'gpt-5.4-mini',
            toolContext: {},
        },
        userId: 'user-runner',
        broker: broker as any,
        generationClient,
        toolExecutionEngine: {} as any,
    });

    assert.equal(taskIds.includes('task-runner:normalize'), true);
    assert.ok(taskIds.includes('task-runner'));
    assert.equal(result.terminal, false);
    assert.equal(result.snapshot.normalizedIntent?.intent, 'assistant_meta');
    assert.equal(broker.getContent(), '你好，有什么我可以帮你分析的？');
    assert.doesNotMatch(broker.getContent(), /我是 KiKo/);
});

test('runChatV2Turn model-led mode exposes tools and skips synthetic plan cards by default', async () => {
    const toolNamesByRound: string[][] = [];
    const userContents: string[] = [];
    const generationClient = {
        async generate(params: {
            taskId: string;
            messages?: Array<{ role: string; content: any }>;
            tools?: Array<{ function?: { name?: string } }>;
            onTextDelta: (text: string) => Promise<void>;
        }) {
            if (params.taskId.endsWith(':normalize')) {
                return {
                    toolCalls: [],
                    text: JSON.stringify({
                        domain: 'general',
                        intent: 'image_generation',
                        task_mode: 'discover',
                        output_mode: 'narrative',
                        search_mode: 'forbidden',
                        search_target: 'none',
                        confidence: 0.97,
                        explanation: 'The user wants an image generated now.',
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
                    citations: [],
                };
            }
            const userMessage = (params.messages || []).find((message) => message.role === 'user');
            userContents.push(typeof userMessage?.content === 'string' ? userMessage.content : JSON.stringify(userMessage?.content || ''));
            toolNamesByRound.push((params.tools || []).map((tool) => String(tool.function?.name || '')).filter(Boolean));
            await params.onTextDelta('Image generation request is ready for the image tool.');
            return {
                toolCalls: [],
                text: 'Image generation request is ready for the image tool.',
                reasoning: '',
                citations: [],
            };
        },
    } as any;
    const broker = makeBroker();

    const result = await runChatV2Turn({
        snapshot: makeSnapshot('Generate a screenshot of the instagram with a beautiful views', {
            toolDefinitions: [
                { name: 'generate_image_from_intent', description: 'Generate an image from user intent.', parameters: {} },
                { name: 'prepare_swap_transaction', description: 'Prepare a swap transaction.', parameters: {} },
            ] as any,
        }),
        task: {
            id: 'task-runner',
            sessionId: 'session-runner',
            assistantMessageId: 'assistant-runner',
            model: 'gpt-5.4-mini',
            toolContext: {},
        },
        userId: 'user-runner',
        broker: broker as any,
        generationClient,
        toolExecutionEngine: {} as any,
    });

    assert.equal(result.terminal, false);
    assert.ok(toolNamesByRound.some((tools) => tools.includes('generate_image_from_intent')));
    assert.ok(toolNamesByRound.every((tools) => !tools.includes('prepare_swap_transaction')));
    assert.ok(userContents.every((content) => !/\[TASK_MENU\]/.test(content)));
    assert.ok(userContents.some((content) => /\[CANONICAL_INTENT\]/.test(content)));
    assert.ok(userContents.some((content) => /\[CONTEXT_CATALOG\]/.test(content)));
    assert.deepEqual(broker.getRuntimeActions().filter((action) => action === 'bootstrapRuntime' || action === 'applyModelPlan'), []);
});
