import assert from 'node:assert/strict';
import test from 'node:test';

import { toolRegistry } from '../../tooling/registry.js';
import type { ChatContextSnapshot } from './contracts.js';
import { runNodeOrchestration } from './nodeOrchestrator.js';

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
