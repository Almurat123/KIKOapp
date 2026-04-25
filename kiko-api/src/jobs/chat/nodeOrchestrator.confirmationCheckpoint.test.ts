import assert from 'node:assert/strict';
import test from 'node:test';

import { toolRegistry } from '../../tooling/registry.js';
import type { ChatContextSnapshot } from './contracts.js';
import { resolveExecutionGateContext, runNodeOrchestration } from './nodeOrchestrator.js';

function makeSnapshot(overrides: Partial<ChatContextSnapshot> = {}): ChatContextSnapshot {
    const { runtime: runtimeOverrides, ...rest } = overrides;
    return {
        sessionId: 'session-confirmation-checkpoint',
        taskId: 'task-confirmation-checkpoint',
        assistantMessageId: 'msg-confirmation-checkpoint',
        model: 'gpt-5.4-mini-2026-03-17',
        history: [],
        lastUserMessage: 'Sell all USDC to ETH',
        requestedTokenAddresses: [],
        requestedTokenSymbols: ['USDC', 'ETH'],
        toolDefinitions: toolRegistry.getAllDefinitions(),
        runtime: {
            userSettings: {},
            toolContext: {},
            prefetchedToolResults: {},
            contextBlocks: {},
            systemDirectives: [],
            ...(runtimeOverrides || {}),
        },
        taskRoute: {
            owner: 'swap',
            phase: 'execute',
            facets: [],
            entities: {
                tokenAddresses: [],
                tokenSymbols: ['USDC', 'ETH'],
                walletAddresses: [],
                marketIdentifiers: [],
                imageRefs: [],
            },
            requestedChain: {
                chainId: 8453,
                chainName: 'Base',
            },
            timeContext: null,
            rowCount: null,
            inheritEntitiesFromContext: false,
            locale: 'en',
            needsClarification: false,
            clarificationQuestion: null,
            explanation: 'Fresh sell request.',
            confidence: 0.98,
            source: 'llm',
        } as any,
        normalizedIntent: {
            domain: 'token',
            intent: 'swap',
            taskMode: 'execute',
            outputMode: 'confirmation_required',
            searchMode: 'forbidden',
            searchTarget: 'none',
            confidence: 0.98,
            explanation: 'Fresh sell request.',
            entities: {
                tokenAddresses: [],
                tokenSymbols: ['USDC', 'ETH'],
                walletAddresses: [],
                marketIdentifiers: [],
            },
            requestedChain: { chainId: 8453, chainName: 'Base' },
            timeContext: null,
            evidenceRequirements: ['connected_chain_evidence'],
            requiresRealtime: false,
            requiresOnchainEvidence: false,
            executionCandidate: true,
            rowCount: null,
            locale: 'en',
            needsClarification: false,
            clarificationQuestion: null,
            source: 'llm',
        } as any,
        policySnapshot: null,
        ...rest,
    } as ChatContextSnapshot;
}

function makeBroker() {
    const texts: string[] = [];
    const recordedToolResults: any[] = [];
    return {
        texts,
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
        pushUsage() {},
        pushCitation() {},
        getCitations() { return []; },
        async recordProviderNativeEvidence() {},
        getProviderNativeEvidence() { return []; },
        getContent() { return texts.join(''); },
        async pushText(text: string) { texts.push(text); },
        async pushReasoning() {},
        async blockContent(content: string) {
            texts.length = 0;
            if (content) texts.push(content);
        },
    };
}

test('confirmation-required swap tool result ends the turn with quote text instead of a model-written execution claim', async () => {
    const snapshot = makeSnapshot();
    const broker = makeBroker();
    let generationRounds = 0;

    const generationClient = {
        async generate(params: any) {
            if (String(params?.taskId || '').endsWith(':plan')) {
                return { text: '', reasoning: '', toolCalls: [] };
            }
            generationRounds += 1;
            assert.equal(generationRounds, 1, 'confirmation checkpoint should not trigger a second model round');
            return {
                text: '',
                reasoning: '',
                toolCalls: [
                    {
                        id: 'quote-1',
                        name: 'prepare_swap_transaction',
                        arguments: {
                            token_in: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
                            token_out: 'ETH',
                            amount_in: '2.322311',
                            chain_id: 8453,
                            execute: false,
                        },
                    },
                ],
            };
        },
    };

    const toolExecutionEngine = {
        async execute(call: any) {
            if (String(call.name).startsWith('read_')) {
                return {
                    id: call.id,
                    name: call.name,
                    arguments: call.arguments || {},
                    ok: true,
                    result: { available: true },
                    metadata: { source: 'tool_runtime' },
                };
            }
            assert.equal(call.name, 'prepare_swap_transaction');
            return {
                id: call.id,
                name: call.name,
                arguments: call.arguments || {},
                ok: true,
                result: {
                    mode: 'simulation_only',
                    success: true,
                    summary: 'Quote ready: 2.322311 USDC -> about 0.000997 ETH. Please reply "confirm" or "execute" to complete the trade.',
                    requires_confirmation: true,
                    quote: {
                        amountOut: '0.000997',
                        priceImpact: '-0.31%',
                        dex: '0x Aggregator',
                    },
                    swapDetails: {
                        tokenIn: 'USDC',
                        tokenOut: 'ETH',
                        amountIn: '2.322311',
                        chainId: 8453,
                    },
                },
                metadata: {
                    source: 'tool_runtime',
                    confirmationRequired: true,
                },
                continuation: {
                    next_action: 'ask_user_confirmation',
                    can_answer_now: true,
                    reason: 'Confirmation required.',
                    reusable_for_next_turn: true,
                },
            };
        },
    };

    await runNodeOrchestration({
        snapshot,
        generationClient: generationClient as any,
        toolExecutionEngine: toolExecutionEngine as any,
        broker: broker as any,
        toolContext: {},
    });

    assert.equal(generationRounds, 1);
    assert.equal(
        broker.getContent(),
        'Quote ready: 2.322311 USDC -> about 0.000997 ETH. Please reply "confirm" or "execute" to complete the trade.',
    );
    assert.ok(!/executed|submitted|swapped/i.test(broker.getContent()));
});

test('social confirmation-required swap result does not ask for another confirm turn', async () => {
    const snapshot = makeSnapshot({
        runtime: {
            currentPage: 'farcaster',
            pageContext: 'farcaster_agent',
            socialInput: { platform: 'farcaster' },
            toolContext: {
                currentPage: 'farcaster',
                pageContext: 'farcaster_agent',
            },
        } as any,
    });
    const broker = makeBroker();
    let generationRounds = 0;

    const generationClient = {
        async generate(params: any) {
            if (String(params?.taskId || '').endsWith(':plan')) {
                return { text: '', reasoning: '', toolCalls: [] };
            }
            generationRounds += 1;
            assert.equal(generationRounds, 1, 'social confirmation checkpoint should not trigger a second model round');
            return {
                text: '',
                reasoning: '',
                toolCalls: [
                    {
                        id: 'quote-social',
                        name: 'prepare_swap_transaction',
                        arguments: {
                            token_in: 'USDC',
                            token_out: 'ETH',
                            amount_in: '2.322311',
                            chain_id: 8453,
                            execute: false,
                        },
                    },
                ],
            };
        },
    };

    const toolExecutionEngine = {
        async execute(call: any) {
            if (String(call.name).startsWith('read_')) {
                return {
                    id: call.id,
                    name: call.name,
                    arguments: call.arguments || {},
                    ok: true,
                    result: { available: true },
                    metadata: { source: 'tool_runtime' },
                };
            }
            return {
                id: call.id,
                name: call.name,
                arguments: call.arguments || {},
                ok: true,
                result: {
                    mode: 'simulation_only',
                    success: true,
                    summary: 'Quote ready: 2.322311 USDC -> about 0.000997 ETH. Please reply "confirm" or "execute" to complete the trade.',
                    requires_confirmation: true,
                },
                metadata: { source: 'tool_runtime', confirmationRequired: true },
                continuation: {
                    next_action: 'ask_user_confirmation',
                    can_answer_now: true,
                    reason: 'Confirmation required.',
                    reusable_for_next_turn: true,
                },
            };
        },
    };

    await runNodeOrchestration({
        snapshot,
        generationClient: generationClient as any,
        toolExecutionEngine: toolExecutionEngine as any,
        broker: broker as any,
        toolContext: {},
    });

    assert.equal(generationRounds, 1);
    assert.match(broker.getContent(), /Swap was not submitted/i);
    assert.match(broker.getContent(), /Open KIKO to execute/i);
    assert.doesNotMatch(broker.getContent(), /reply ["']?(confirm|execute)|reply confirm/i);
});

test('social client-action swap result ends the turn without a model-written submitted claim', async () => {
    const snapshot = makeSnapshot({
        runtime: {
            currentPage: 'x',
            pageContext: 'x_agent',
            socialInput: { platform: 'x' },
            toolContext: {
                currentPage: 'x',
                pageContext: 'x_agent',
            },
        } as any,
    });
    const broker = makeBroker();
    let generationRounds = 0;
    const executedCalls: Array<{ name: string; arguments: Record<string, any> }> = [];

    const generationClient = {
        async generate(params: any) {
            if (String(params?.taskId || '').endsWith(':plan')) {
                return { text: '', reasoning: '', toolCalls: [] };
            }
            generationRounds += 1;
            assert.equal(generationRounds, 1, 'client action should not trigger a second model round');
            return {
                text: '',
                reasoning: '',
                toolCalls: [
                    {
                        id: 'execute-client-action',
                        name: 'prepare_swap_transaction',
                        arguments: {
                            token_in: 'USDC',
                            token_out: 'ETH',
                            amount_in: '2.322311',
                            chain_id: 8453,
                            execute: true,
                        },
                    },
                ],
            };
        },
    };

    const toolExecutionEngine = {
        async execute(call: any) {
            executedCalls.push({ name: call.name, arguments: call.arguments || {} });
            if (String(call.name).startsWith('read_')) {
                return {
                    id: call.id,
                    name: call.name,
                    arguments: call.arguments || {},
                    ok: true,
                    result: { available: true },
                    metadata: { source: 'tool_runtime' },
                };
            }
            return {
                id: call.id,
                name: call.name,
                arguments: call.arguments || {},
                ok: true,
                result: {
                    __client_action: {
                        type: 'execute_swap_instant',
                        payload: {
                            tokenIn: 'USDC',
                            tokenOut: 'ETH',
                            amountIn: '2.322311',
                            chainId: 8453,
                        },
                    },
                    mode: 'execute_client',
                    requires_user_confirmation: false,
                    summary: 'Executing instant swap: 2.322311 USDC -> ETH on chain 8453. Transaction will be submitted automatically.',
                },
                metadata: { source: 'tool_runtime' },
            };
        },
    };

    await runNodeOrchestration({
        snapshot,
        generationClient: generationClient as any,
        toolExecutionEngine: toolExecutionEngine as any,
        broker: broker as any,
        toolContext: {},
    });

    assert.equal(generationRounds, 1);
    assert.match(broker.getContent(), /Swap was not submitted/i);
    assert.match(broker.getContent(), /wallet\/client action/i);
    assert.doesNotMatch(broker.getContent(), /submitted automatically|executed successfully/i);
});

test('social executable confirmation payload continues to the mutation tool instead of asking confirm', async () => {
    const snapshot = makeSnapshot({
        lastUserMessage: '@kiko buy $1 of this Polymarket outcome',
        runtime: {
            currentPage: 'x',
            pageContext: 'x_agent',
            socialInput: { platform: 'x' },
            toolContext: {
                currentPage: 'x',
                pageContext: 'x_agent',
            },
        } as any,
        taskRoute: {
            owner: 'polymarket',
            phase: 'execute',
            facets: [],
            entities: {
                tokenAddresses: [],
                tokenSymbols: [],
                walletAddresses: [],
                marketIdentifiers: ['market-1'],
                imageRefs: [],
            },
            needsClarification: false,
            confidence: 0.98,
        } as any,
        normalizedIntent: {
            domain: 'polymarket',
            intent: 'polymarket_order',
            taskMode: 'execute',
            outputMode: 'execution_ready',
            searchMode: 'forbidden',
            searchTarget: 'none',
            confidence: 0.98,
            entities: { marketIdentifiers: ['market-1'] },
            evidenceRequirements: [],
            executionCandidate: true,
            needsClarification: false,
        } as any,
    });
    const broker = makeBroker();
    let generationRounds = 0;
    const executedCalls: Array<{ name: string; arguments: Record<string, any> }> = [];

    const generationClient = {
        async generate(params: any) {
            if (String(params?.taskId || '').endsWith(':plan')) {
                return { text: '', reasoning: '', toolCalls: [] };
            }
            generationRounds += 1;
            if (generationRounds === 1) {
                return {
                    text: '',
                    reasoning: '',
                    toolCalls: [
                        {
                            id: 'prepare-poly',
                            name: 'prepare_polymarket_bet',
                            arguments: {
                                token_id: '123',
                                question: 'Will it happen?',
                                outcome: 'Yes',
                                amount_usd: 1,
                            },
                        },
                    ],
                };
            }
            return {
                text: '',
                reasoning: '',
                toolCalls: [
                    {
                        id: `place-poly-${generationRounds}`,
                        name: 'place_polymarket_order',
                        arguments: {
                            token_id: '123',
                            question: 'Will it happen?',
                            outcome: 'Yes',
                            amount_usd: 1,
                            side: 'BUY',
                        },
                    },
                ],
            };
        },
    };

    const toolExecutionEngine = {
        async execute(call: any) {
            executedCalls.push({ name: call.name, arguments: call.arguments || {} });
            if (String(call.name).startsWith('read_')) {
                return {
                    id: call.id,
                    name: call.name,
                    arguments: call.arguments || {},
                    ok: true,
                    result: { available: true },
                    metadata: { source: 'tool_runtime' },
                };
            }
            if (call.name === 'prepare_polymarket_bet') {
                return {
                    id: call.id,
                    name: call.name,
                    arguments: call.arguments || {},
                    ok: true,
                    result: {
                        success: true,
                        requires_confirmation: true,
                        confirmation_payload: {
                            tool_name: 'place_polymarket_order',
                            args: {
                                token_id: '123',
                                question: 'Will it happen?',
                                outcome: 'Yes',
                                amount_usd: 1,
                                side: 'BUY',
                            },
                            confirmation_token: 'token',
                            action_class: 'ORDER_MUTATION',
                        },
                    },
                    metadata: { source: 'tool_runtime', confirmationRequired: true },
                    continuation: {
                        next_action: 'ask_user_confirmation',
                        can_answer_now: true,
                        reusable_for_next_turn: true,
                    },
                };
            }
            assert.equal(call.name, 'place_polymarket_order');
            return {
                id: call.id,
                name: call.name,
                arguments: call.arguments || {},
                ok: true,
                result: {
                    success: true,
                    order_id: 'order-123',
                    market_slug: 'will-it-happen',
                    market_url: 'https://polymarket.com/event/will-it-happen',
                },
                metadata: { source: 'tool_runtime' },
            };
        },
    };

    await runNodeOrchestration({
        snapshot,
        generationClient: generationClient as any,
        toolExecutionEngine: toolExecutionEngine as any,
        broker: broker as any,
        toolContext: {},
    });

    assert.equal(generationRounds, 1);
    assert.deepEqual(
        executedCalls
            .filter((call) => !String(call.name).startsWith('read_'))
            .map((call) => call.name),
        ['prepare_polymarket_bet', 'place_polymarket_order'],
    );
    const executedOrderCall = executedCalls.find((call) => call.name === 'place_polymarket_order');
    assert.equal(executedOrderCall?.arguments.token_id, '123');
    assert.equal(executedOrderCall?.arguments.side, 'BUY');
    assert.ok(broker.recordedToolResults.some((result: any) => result.name === 'place_polymarket_order' && result.result?.order_id === 'order-123'));
    assert.match(broker.getContent(), /Polymarket order placed/i);
    assert.match(broker.getContent(), /order-123/);
    assert.doesNotMatch(broker.getContent(), /reply ["']?confirm|Open KIKO/i);
});

test('social agent execute route opens a single-turn mutation execution gate without pending confirmation', () => {
    const snapshot = makeSnapshot({
        lastUserMessage: 'Deploy a token on Base name Test symbol TST',
        runtime: {
            currentPage: 'x',
            pageContext: 'x_agent',
            socialInput: { platform: 'x' },
        } as any,
        taskRoute: {
            owner: 'token_deploy',
            phase: 'execute',
            facets: [],
            entities: {
                tokenAddresses: [],
                tokenSymbols: ['TST'],
                walletAddresses: [],
                marketIdentifiers: [],
                imageRefs: [],
            },
            requestedChain: { chainId: 8453, chainName: 'Base' },
            timeContext: null,
            rowCount: null,
            inheritEntitiesFromContext: false,
            locale: 'en',
            needsClarification: false,
            clarificationQuestion: null,
            explanation: 'Social mention explicitly asks to deploy.',
            confidence: 0.99,
            source: 'llm',
        } as any,
        normalizedIntent: {
            domain: 'token',
            intent: 'clanker_deploy',
            taskMode: 'execute',
            outputMode: 'execution_ready',
            searchMode: 'forbidden',
            searchTarget: 'none',
            confidence: 0.99,
            explanation: 'Social mention explicitly asks to deploy.',
            entities: {
                tokenAddresses: [],
                tokenSymbols: ['TST'],
                walletAddresses: [],
                marketIdentifiers: [],
            },
            requestedChain: { chainId: 8453, chainName: 'Base' },
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
        } as any,
        confirmationState: null,
    });

    assert.deepEqual(resolveExecutionGateContext(snapshot), { phase: 'execute' });
});

test('ordinary web execute route does not open mutation execution gate without pending confirmation', () => {
    const snapshot = makeSnapshot({
        lastUserMessage: 'Deploy a token on Base name Test symbol TST',
        runtime: {
            currentPage: 'chat',
            pageContext: 'web_chat',
        } as any,
        taskRoute: {
            owner: 'token_deploy',
            phase: 'execute',
            facets: [],
            entities: {
                tokenAddresses: [],
                tokenSymbols: ['TST'],
                walletAddresses: [],
                marketIdentifiers: [],
                imageRefs: [],
            },
            requestedChain: { chainId: 8453, chainName: 'Base' },
            timeContext: null,
            rowCount: null,
            inheritEntitiesFromContext: false,
            locale: 'en',
            needsClarification: false,
            clarificationQuestion: null,
            explanation: 'Web chat deploy request still needs preview confirmation.',
            confidence: 0.99,
            source: 'llm',
        } as any,
        confirmationState: null,
    });

    assert.equal(resolveExecutionGateContext(snapshot), null);
});
