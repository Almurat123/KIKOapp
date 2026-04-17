import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChatContextSnapshot } from './contracts.js';
import { runChatV2Turn } from './chatV2TurnRunner.js';

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
    return {
        async bootstrapRuntime() {},
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
        async blockContent(content: string) {
            texts.length = 0;
            if (content) texts.push(content);
        },
        getCitations() { return []; },
        async recordProviderNativeEvidence() {},
        getProviderNativeEvidence() { return []; },
        async pushText(text: string) { texts.push(text); },
        async pushReasoning(text: string) { reasoning.push(text); },
        async applyModelPlan() {},
        async recordToolResult() {},
        async complete(overrides?: { content?: string }) {
            texts.length = 0;
            if (overrides?.content) texts.push(overrides.content);
        },
        getContent() { return texts.join(''); },
        getToolResults() { return []; },
        getReasoning() { return reasoning.join(''); },
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
            taskMode: 'answer',
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

test('runChatV2Turn defaults unnormalized turns to model-selected task menu instead of normalize call', async () => {
    const taskIds: string[] = [];
    const userContents: string[] = [];
    const generationClient = {
        async generate(params: { taskId: string; messages?: Array<{ role: string; content: any }>; onTextDelta: (text: string) => Promise<void> }) {
            taskIds.push(params.taskId);
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

    assert.equal(taskIds.includes('task-runner:normalize'), false);
    assert.ok(taskIds.includes('task-runner'));
    assert.equal(result.snapshot.normalizedIntent, null);
    assert.equal(result.snapshot.normalizationState?.bypassKind, 'model_selected_task_menu');
    assert.match(String(result.snapshot.normalizationState?.rawText || ''), /one_or_more/);
    assert.ok(userContents.some((content) => /\[TASK_MENU\]/.test(content)));
    assert.match(broker.getContent(), /CAKE quote/);
});
