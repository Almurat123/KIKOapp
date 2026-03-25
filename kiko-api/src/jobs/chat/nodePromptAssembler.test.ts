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
        conversationActionState: {
            pendingAction: 'none',
            canExecute: false,
            needsClarification: false,
            clarificationQuestion: null,
        },
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
    assert.match(content, /\[WORKFLOW_STATE\]/);
    assert.match(content, /\[USER_SETTINGS\]/);
    assert.match(content, /quick_swap: true/);
    assert.match(content, /\[USER_CONTEXT\]/);
    assert.match(content, /wallet: 0xabc/);
    assert.match(content, /connected_chain.id: 8453/);
    assert.match(content, /Evidence: Trending Topics \| url=https:\/\/x\.com\/explore \| snippet=Top current trends\./);
    assert.equal(content.includes('"steps"'), false);
    assert.equal(content.includes('"sourceTypes"'), false);
    assert.equal(content.includes('"wallet"'), false);
    assert.equal(content.includes('"quick_swap"'), false);
});

test('assembleGenerationMessages marks requested chain separately from connected chain', () => {
    const snapshot: ChatContextSnapshot = {
        sessionId: 'session-3',
        taskId: 'task-3',
        model: 'gpt-5-mini',
        history: [],
        lastUserMessage: 'Buy CAKE on BNB chain',
        runtime: {
            contextBlocks: {},
            userSettings: {},
            walletAddress: '0xabc',
            chainId: 8453,
            chainName: 'Base',
        },
        requestedTokenAddresses: [],
        requestedTokenSymbols: ['CAKE', 'BNB'],
        toolDefinitions: [],
    };

    const providerInfo: ProviderInfo = {
        provider: 'openai',
        model: snapshot.model,
        supportsNativeSearch: false,
        supportsPreviousResponse: true,
    };

    const messages = assembleGenerationMessages(snapshot, [], providerInfo);
    const systemMessage = messages.find((message) => message.role === 'system');
    const userMessage = messages.find((message) => message.role === 'user');

    assert.match(String(systemMessage?.content || ''), /requested chain overrides the connected chain/i);
    assert.match(String(userMessage?.content || ''), /connected_chain.id: 8453/);
    assert.match(String(userMessage?.content || ''), /requested_chain.id: 56/);
    assert.match(String(userMessage?.content || ''), /requested_chain.name: BNB Chain/);
});

test('assembleGenerationMessages tells non-native-search providers to use local search tools when search is required', () => {
    const snapshot: ChatContextSnapshot = {
        sessionId: 'session-4',
        taskId: 'task-4',
        model: 'deepseek-reasoner',
        history: [],
        lastUserMessage: "Search X for 0x1111111111111111111111111111111111111111 around yesterday's announcement",
        runtime: {
            contextBlocks: {},
            userSettings: {},
        },
        requestedTokenAddresses: ['0x1111111111111111111111111111111111111111'],
        requestedTokenSymbols: [],
        toolDefinitions: [],
    };

    const providerInfo: ProviderInfo = {
        provider: 'deepseek',
        model: snapshot.model,
        supportsNativeSearch: false,
        supportsPreviousResponse: false,
    };

    const messages = assembleGenerationMessages(snapshot, [], providerInfo, {
        searchMode: 'required',
        searchReason: 'social_plus_chain_evidence_required',
        toolPhase: 'local_analysis',
        intentEnvelope: {
            primary_intent: 'social_discovery',
            task_mode: 'discover',
            search_mode: 'required',
            search_target: 'x',
            domain: 'x',
            execution_risk: 'read_only',
            required_evidence: ['native_search_results', 'onchain_token_evidence'],
        },
    });

    const systemMessage = messages.find((message) => message.role === 'system');
    assert.match(String(systemMessage?.content || ''), /use local search tools such as external_web_search/i);
    assert.match(String(systemMessage?.content || ''), /do not say you found, confirmed, verified, or retrieved anything unless a real tool/i);
    assert.match(String(systemMessage?.content || ''), /never narrate planned tool usage in plain text/i);
    assert.equal(String(systemMessage?.content || '').includes('[TOOL_CALL_EXAMPLES]'), false);
});

test('assembleGenerationMessages carries early-buyer evidence requirements through structured guidance', () => {
    const snapshot: ChatContextSnapshot = {
        sessionId: 'session-5',
        taskId: 'task-5',
        model: 'deepseek-reasoner',
        history: [],
        lastUserMessage: 'Find early buyers around 2026-03-10 12:00 UTC for 0xeCCBb861c0dda7eFd964010085488B69317e4444',
        runtime: {
            contextBlocks: {},
            userSettings: {},
        },
        requestedTokenAddresses: ['0xeCCBb861c0dda7eFd964010085488B69317e4444'],
        requestedTokenSymbols: [],
        toolDefinitions: [],
    };

    const providerInfo: ProviderInfo = {
        provider: 'deepseek',
        model: snapshot.model,
        supportsNativeSearch: false,
        supportsPreviousResponse: false,
    };

    const messages = assembleGenerationMessages(snapshot, [], providerInfo, {
        searchMode: 'required',
        searchReason: 'social_plus_chain_evidence_required',
        toolPhase: 'local_analysis',
        intentEnvelope: {
            primary_intent: 'social_discovery',
            task_mode: 'discover',
            search_mode: 'required',
            search_target: 'x',
            domain: 'x',
            execution_risk: 'read_only',
            required_evidence: ['native_search_results', 'onchain_token_evidence'],
        },
    });

    const userMessage = messages.find((message) => message.role === 'user');
    assert.match(String(userMessage?.content || ''), /\[TOOL_POLICY\]/);
    assert.match(String(userMessage?.content || ''), /required evidence before final execution\/conclusion: native_search_results, onchain_token_evidence/i);
});

test('assembleGenerationMessages uses compact execution mode guidance for swap execution flows', () => {
    const snapshot: ChatContextSnapshot = {
        sessionId: 'session-6',
        taskId: 'task-6',
        model: 'gpt-5-mini',
        history: [],
        lastUserMessage: 'Sell all 0x950e88438098bc08879243984a3cf7c63eb95ba3 to ETH',
        runtime: {
            contextBlocks: {},
            userSettings: {},
        },
        requestedTokenAddresses: ['0x950e88438098bc08879243984a3cf7c63eb95ba3'],
        requestedTokenSymbols: [],
        toolDefinitions: [],
    };

    const providerInfo: ProviderInfo = {
        provider: 'openai',
        model: snapshot.model,
        supportsNativeSearch: false,
        supportsPreviousResponse: true,
    };

    const messages = assembleGenerationMessages(snapshot, [], providerInfo, {
        intentEnvelope: {
            primary_intent: 'swap_execution',
            task_mode: 'execute',
            search_mode: 'forbidden',
            search_target: 'none',
            domain: 'token',
            execution_risk: 'mutation',
            required_evidence: [],
        },
    });

    const systemMessage = messages.find((message) => message.role === 'system');
    assert.match(String(systemMessage?.content || ''), /EXECUTION_MODE: quote_before_swap/);
    assert.match(String(systemMessage?.content || ''), /Quote once, wait for explicit confirmation/i);
});

test('assembleGenerationMessages includes canonical intent normalization summary when available', () => {
    const snapshot: ChatContextSnapshot = {
        sessionId: 'session-intent',
        taskId: 'task-intent',
        model: 'gpt-5-mini',
        history: [],
        lastUserMessage: 'Check early buyers for 30',
        requestedTokenAddresses: ['0xeCCBb861c0dda7eFd964010085488B69317e4444'],
        requestedTokenSymbols: [],
        toolDefinitions: [],
        normalizedIntent: {
            domain: 'token',
            intent: 'early_buyers',
            taskMode: 'analyze',
            outputMode: 'full_table',
            searchMode: 'forbidden',
            searchTarget: 'none',
            confidence: 0.9,
            explanation: 'Early buyer export',
            entities: {
                tokenAddresses: ['0xeCCBb861c0dda7eFd964010085488B69317e4444'],
                tokenSymbols: [],
                walletAddresses: [],
                marketIdentifiers: [],
            },
            requestedChain: {
                chainId: 56,
                chainName: 'BNB Chain',
                source: 'llm',
            },
            timeContext: null,
            evidenceRequirements: ['onchain_token_evidence'],
            requiresRealtime: false,
            requiresOnchainEvidence: true,
            executionCandidate: false,
            rowCount: 30,
            locale: 'en',
            needsClarification: false,
            clarificationQuestion: null,
            source: 'llm',
        },
        runtime: {
            contextBlocks: {},
            userSettings: {},
        },
    };

    const providerInfo: ProviderInfo = {
        provider: 'openai',
        model: snapshot.model,
        supportsNativeSearch: false,
        supportsPreviousResponse: false,
    };

    const messages = assembleGenerationMessages(snapshot, [], providerInfo);
    const userMessage = messages.find((message) => message.role === 'user');
    const content = String(userMessage?.content || '');
    assert.match(content, /\[INTENT_NORMALIZATION\]/);
    assert.match(content, /intent: early_buyers/);
    assert.match(content, /output_mode: full_table/);
    assert.match(content, /row_count: 30/);
});

test('assembleGenerationMessages adds fast swap contract guidance when fast swap mode is enabled', () => {
    const snapshot: ChatContextSnapshot = {
        sessionId: 'session-fast',
        taskId: 'task-fast',
        model: 'gpt-5-mini',
        history: [],
        lastUserMessage: 'Buy VIRTUAL now',
        runtime: {
            contextBlocks: {},
            userSettings: {
                fastSwapMode: true,
                showQuoteBeforeSwap: false,
            },
        },
        requestedTokenAddresses: [],
        requestedTokenSymbols: ['VIRTUAL'],
        toolDefinitions: [],
    };

    const providerInfo: ProviderInfo = {
        provider: 'openai',
        model: snapshot.model,
        supportsNativeSearch: false,
        supportsPreviousResponse: true,
    };

    const messages = assembleGenerationMessages(snapshot, [], providerInfo, {
        intentEnvelope: {
            primary_intent: 'swap_execution',
            task_mode: 'execute',
            search_mode: 'forbidden',
            search_target: 'none',
            domain: 'token',
            execution_risk: 'mutation',
            required_evidence: [],
        },
    });

    const systemMessage = messages.find((message) => message.role === 'system');
    assert.match(String(systemMessage?.content || ''), /EXECUTION_MODE: fast_swap/);
    assert.match(String(systemMessage?.content || ''), /Quote is optional, not a blocking prerequisite/i);
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
