import assert from 'node:assert/strict';
import test from 'node:test';
import { assembleGenerationMessages } from './nodePromptAssembler.js';
import type { ChatContextSnapshot, PlanCard, ProviderNativeEvidenceSnapshot } from './contracts.js';
import type { ProviderInfo } from './providerPolicyBuilder.js';

test('assembleGenerationMessages renders execution plan and provider evidence as summaries, not raw JSON blocks', () => {
    const snapshot: ChatContextSnapshot = {
        sessionId: 'session-1',
        taskId: 'task-1',
        model: 'grok-4-1-fast-non-reasoning',
        history: [],
        lastUserMessage: "what's trending on X?",
        runtime: {
            contextBlocks: {},
            userSettings: {
                quickSwapMode: true,
                mevProtection: true,
            },
            walletAddress: '0xabc',
            chainId: 8453,
            chainName: 'Base',
            currentPage: 'chat',
            pageContext: 'X trends dashboard',
        },
        requestedTokenAddresses: [],
        requestedTokenSymbols: [],
        toolDefinitions: [],
    };

    const providerInfo: ProviderInfo = {
        provider: 'grok',
        model: snapshot.model,
        supportsNativeSearch: true,
        supportsPreviousResponse: true,
    };

    const executionPlan: PlanCard = {
        planId: 'plan-1',
        title: 'Trending Topics on X',
        summary: 'Identify current trends on X.',
        status: 'in_progress',
        steps: [
            {
                id: 'step-1',
                title: 'Understand Query',
                description: 'Interpret the request for trending topics on X.',
                status: 'pending',
                preferredTools: ['x_search'],
            },
        ],
    };

    const providerNativeEvidence: ProviderNativeEvidenceSnapshot[] = [
        {
            sourceTypes: ['x_search'],
            querySummary: 'trending topics on X today',
            retrievedAt: '2026-03-16T10:00:00.000Z',
            round: 1,
            results: [
                {
                    sourceType: 'x_search',
                    title: 'Trending Topics',
                    url: 'https://x.com/explore',
                    snippet: 'Top current trends.',
                    retrievedAt: '2026-03-16T10:00:00.000Z',
                    round: 1,
                },
            ],
        },
    ];

    const messages = assembleGenerationMessages(snapshot, [], providerInfo, {
        executionPlan,
        providerNativeEvidence,
        toolPhase: 'local_analysis',
        searchMode: 'required',
        searchReason: 'realtime_social_context',
        intentEnvelope: {
            primary_intent: 'search_discovery',
            task_mode: 'discover',
            search_mode: 'required',
            search_target: 'x',
            domain: 'x',
            execution_risk: 'read_only',
            required_evidence: ['native_search_results'],
        },
    });

    const userMessage = messages.find((message) => message.role === 'user');
    assert.ok(userMessage?.content);

    const content = String(userMessage?.content || '');
    assert.match(content, /\[EXECUTION_PLAN\]/);
    assert.match(content, /Step step-1: Understand Query/);
    assert.match(content, /\[PROVIDER_NATIVE_EVIDENCE\]/);
    assert.match(content, /\[USER_SETTINGS\]/);
    assert.match(content, /quick_swap: true/);
    assert.match(content, /\[USER_CONTEXT\]/);
    assert.match(content, /wallet: 0xabc/);
    assert.match(content, /chain.id: 8453/);
    assert.match(content, /Evidence: Trending Topics \| url=https:\/\/x\.com\/explore \| snippet=Top current trends\./);
    assert.equal(content.includes('"steps"'), false);
    assert.equal(content.includes('"sourceTypes"'), false);
    assert.equal(content.includes('"wallet"'), false);
    assert.equal(content.includes('"quick_swap"'), false);
});

test('assembleGenerationMessages does not send stored reasoning_content back to DeepSeek history', () => {
    const snapshot: ChatContextSnapshot = {
        sessionId: 'session-2',
        taskId: 'task-2',
        model: 'deepseek-reasoner',
        history: [
            {
                role: 'assistant',
                content: 'Previous answer',
                reasoningContent: 'Internal reasoning that should stay local.',
            },
            {
                role: 'user',
                content: 'next question',
            },
        ],
        lastUserMessage: 'What is next?',
        runtime: {
            contextBlocks: {},
            userSettings: {},
        },
        requestedTokenAddresses: [],
        requestedTokenSymbols: [],
        toolDefinitions: [],
    };

    const providerInfo: ProviderInfo = {
        provider: 'deepseek',
        model: snapshot.model,
        supportsNativeSearch: false,
        supportsPreviousResponse: false,
    };

    const messages = assembleGenerationMessages(snapshot, [], providerInfo);
    const assistantHistory = messages.find((message) => message.role === 'assistant');
    assert.ok(assistantHistory);
    assert.equal('reasoning_content' in (assistantHistory || {}), false);
});
