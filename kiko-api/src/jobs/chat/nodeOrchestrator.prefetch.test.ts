import assert from 'node:assert/strict';
import test from 'node:test';
import { toolRegistry } from '../../tooling/registry.js';
import type { ChatContextSnapshot } from './contracts.js';
import { runNodeOrchestration } from './nodeOrchestrator.js';

function makeSnapshot(message: string, overrides: Partial<ChatContextSnapshot> = {}): ChatContextSnapshot {
    const { runtime: runtimeOverrides, ...restOverrides } = overrides;
    return {
        sessionId: 'session-prefetch',
        taskId: 'task-prefetch',
        assistantMessageId: 'msg-prefetch',
        model: 'gpt-5.4-mini',
        history: [],
        lastUserMessage: message,
        requestedTokenAddresses: [],
        requestedTokenSymbols: ['ETH', 'USDC'],
        normalizedIntent: {
            domain: 'token',
            intent: 'swap',
            taskMode: 'execute',
            outputMode: 'execution_ready',
            searchMode: 'forbidden',
            searchTarget: 'none',
            confidence: 0.96,
            explanation: 'swap execution test intent',
            entities: {
                tokenAddresses: [],
                tokenSymbols: ['ETH', 'USDC'],
                walletAddresses: [],
                marketIdentifiers: [],
            },
            requestedChain: {
                chainId: 8453,
                chainName: 'Base',
                source: 'llm',
            },
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
        normalizationState: {
            status: 'ok',
            source: 'llm',
            rawText: '{"intent":"swap"}',
        },
        toolDefinitions: toolRegistry.getAllDefinitions(),
        recentToolTrace: {
            messageId: 'msg-prefetch',
            toolCalls: [],
        },
        runtime: {
            userSettings: {
                showQuoteBeforeSwap: true,
            },
            toolContext: {},
            prefetchedToolResults: {},
            contextBlocks: {},
            systemDirectives: [],
            chainId: 8453,
            chainName: 'Base',
            nativeBalance: '0.01',
            ...(runtimeOverrides || {}),
        },
        ...restOverrides,
    } as ChatContextSnapshot;
}

function makeBroker() {
    const texts: string[] = [];
    const recordedToolResults: any[] = [];
    return {
        async bootstrapRuntime() {},
        async applyModelPlan() {},
        hasVisibleArtifact() { return false; },
        async markPlanPhase() {},
        async ensurePlanStep() {},
        async focusPlanStep() {},
        async noteToolSelected() {},
        async markPlanStepStarted() {},
        async markAnswerStarted() {},
        async setRuntimeState() {},
        pushUsage() {},
        pushCitation() {},
        getCitations() { return []; },
        async recordProviderNativeEvidence() {},
        getProviderNativeEvidence() { return []; },
        async pushText(text: string) { texts.push(text); },
        async pushReasoning() {},
        async blockContent(content: string) {
            texts.length = 0;
            if (content) texts.push(content);
        },
        async recordToolResult(result: any) { recordedToolResults.push(result); },
        async complete(overrides?: { content?: string }) {
            texts.length = 0;
            if (overrides?.content) texts.push(overrides.content);
        },
        getContent() { return texts.join(''); },
        recordedToolResults,
    };
}

test('swap execution prefetches only the required trade context reads and does so in parallel', async () => {
    const snapshot = makeSnapshot('swap 0.001 ETH to USDC');
    const broker = makeBroker();
    const executedTools: string[] = [];
    let activeCalls = 0;
    let maxActiveCalls = 0;

    const generationClient = {
        async generate() {
            return {
                text: 'Quote this trade now.',
                reasoning: '',
                toolCalls: [],
                citations: [],
            };
        },
    };

    await runNodeOrchestration({
        snapshot,
        generationClient: generationClient as any,
        toolExecutionEngine: {
            async execute(call: any) {
                executedTools.push(call.name);
                activeCalls += 1;
                maxActiveCalls = Math.max(maxActiveCalls, activeCalls);
                await new Promise((resolve) => setTimeout(resolve, 20));
                activeCalls -= 1;
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

    const prefetchedTools = executedTools.filter((name) => name.startsWith('read_'));
    assert.deepEqual(prefetchedTools.sort(), ['read_token_context', 'read_user_settings', 'read_wallet_state']);
    assert.ok(maxActiveCalls > 1);
    assert.equal(broker.getContent(), 'Quote this trade now.');
});
