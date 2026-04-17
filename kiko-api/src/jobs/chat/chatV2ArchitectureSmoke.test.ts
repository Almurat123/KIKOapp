// CONTEXT MEMORY
// Updated: 2026-04-17
// Author: Rowan
// Reason: the chat v2 rewrite needs a small set of architecture smoke tests
//         that prove the top-level routing contracts still hold across the
//         main turn classes KiKo cares about.
// Goal: keep lean chat, specialist analysis, execution prompting, social-image
//       input, and bare-greeting fast path behavior observable in one file.
// Owns: high-signal smoke coverage for chat v2 prompt/routing boundaries.
// Does Not Own: exhaustive tool execution, provider transport, or business-skill correctness.
// Design Language:
// - smoke tests should verify owner boundaries, not every downstream detail
// - each top-level turn class should have one fast failing assertion set
// - execution turns must prove user settings stay contract-based, not prose-based
// Document Provenance:
// - Source: /Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: smoke coverage for lean/default chat and explicit specialist escalation
// - Verification: inferred from plan and verified in code
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-user-settings-contract.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: execution-turn contract assertion for read_user_settings
// - Verification: verified in code and targeted tests
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-user-settings-contract.md
// - /Users/almurat/KiKo/system-journal/owner-map/chat-runtime-planning.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

import assert from 'node:assert/strict';
import test from 'node:test';

import type { ChatContextSnapshot } from './contracts.js';
import { assembleGenerationMessages } from './nodePromptAssembler.js';
import type { ProviderInfo } from './providerPolicyBuilder.js';
import { buildFastDirectAssistantResponse } from './chatV2TurnRunner.js';

function makeSnapshot(message: string, overrides: Partial<ChatContextSnapshot> = {}): ChatContextSnapshot {
    const { runtime: runtimeOverrides, ...restOverrides } = overrides;
    return {
        sessionId: 'smoke-session',
        taskId: 'smoke-task',
        assistantMessageId: 'smoke-assistant',
        model: 'gpt-5.4-mini',
        history: [],
        lastUserMessage: message,
        requestedTokenAddresses: [],
        requestedTokenSymbols: [],
        toolDefinitions: [],
        recentToolTrace: {
            messageId: 'smoke-assistant',
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

function makeProviderInfo(provider: ProviderInfo['provider'], model = 'gpt-5.4-mini'): ProviderInfo {
    return {
        provider,
        model,
        supportsNativeSearch: provider === 'grok',
        supportsPreviousResponse: true,
    };
}

test('chat v2 smoke: bare greeting stays on deterministic fast path', async () => {
    const response = buildFastDirectAssistantResponse(
        {
            lastUserMessage: '你好',
            normalizedIntent: {
                requiresRealtime: false,
                requiresOnchainEvidence: false,
                executionCandidate: false,
            },
        },
        {
            querySignals: {
                welcome: true,
            },
        } as any,
    );

    assert.match(String(response || ''), /我是 KiKo/);
});

test('chat v2 smoke: plain question stays lean', () => {
    const messages = assembleGenerationMessages(
        makeSnapshot('解释一下量子纠缠。'),
        [],
        makeProviderInfo('openai'),
        {
            intentEnvelope: {
                primary_intent: 'general_answer',
                task_mode: 'discover',
                search_mode: 'forbidden',
                search_target: 'none',
                domain: 'general',
                execution_risk: 'read_only',
                required_evidence: [],
            },
        },
    );

    const userMessage = messages.find((message) => message.role === 'user');
    const content = String(userMessage?.content || '');
    assert.match(content, /mode: lean/);
    assert.match(content, /required_contexts: none/);
    assert.doesNotMatch(content, /\[TOOL_CONTEXT\]/);
    assert.doesNotMatch(content, /\[CONTEXT_READ_POLICY\]/);
});

test('chat v2 smoke: specialist token analysis exposes token context on demand', () => {
    const messages = assembleGenerationMessages(
        makeSnapshot('分析一下 VIRTUAL 的风险', {
            requestedTokenSymbols: ['VIRTUAL'],
        }),
        [],
        makeProviderInfo('openai'),
        {
            intentEnvelope: {
                primary_intent: 'token_risk',
                task_mode: 'analyze',
                search_mode: 'forbidden',
                search_target: 'none',
                domain: 'token',
                execution_risk: 'read_only',
                required_evidence: [],
            },
        },
    );

    const userMessage = messages.find((message) => message.role === 'user');
    const content = String(userMessage?.content || '');
    assert.match(content, /mode: analysis/);
    assert.match(content, /required_contexts: .*token_context/);
    assert.match(content, /required_context_tools: .*read_token_context/);
});

test('chat v2 smoke: execution turn exposes read_user_settings contract without inline execution prose', () => {
    const messages = assembleGenerationMessages(
        makeSnapshot('用 0.25 ETH 买 USDC', {
            requestedTokenSymbols: ['ETH', 'USDC'],
            runtime: {
                userSettings: {
                    fastSwapMode: true,
                    showQuoteBeforeSwap: false,
                },
            },
        }),
        [],
        makeProviderInfo('openai'),
        {
            intentEnvelope: {
                primary_intent: 'swap_execution',
                task_mode: 'execute',
                search_mode: 'forbidden',
                search_target: 'none',
                domain: 'token',
                execution_risk: 'mutation',
                required_evidence: [],
            },
        },
    );

    const systemMessage = messages.find((message) => message.role === 'system');
    const userMessage = messages.find((message) => message.role === 'user');
    const userContent = String(userMessage?.content || '');

    assert.match(userContent, /required_contexts: .*user_settings/);
    assert.match(userContent, /user_settings: worker preferences: execution mode, swap defaults, safety flags; read via read_user_settings/);
    assert.doesNotMatch(String(systemMessage?.content || ''), /EXECUTION_MODE:/);
});

test('chat v2 smoke: social image turn stays multimodal on the current user turn', () => {
    const messages = assembleGenerationMessages(
        makeSnapshot('这张图里是什么？', {
            runtime: {
                currentPage: 'chat',
                socialInput: {
                    platform: 'chat_upload',
                    images: [
                        {
                            url: 'https://example.com/upload.png',
                            sourceLabel: 'uploaded image',
                        },
                    ],
                },
            },
        }),
        [],
        makeProviderInfo('openai'),
        {
            intentEnvelope: {
                primary_intent: 'general_answer',
                task_mode: 'discover',
                search_mode: 'forbidden',
                search_target: 'none',
                domain: 'general',
                execution_risk: 'read_only',
                required_evidence: [],
            },
        },
    );

    const userMessage = messages.find((message) => message.role === 'user');
    const content = userMessage?.content as any[];
    assert.ok(Array.isArray(content));
    assert.equal(content[0]?.type, 'text');
    assert.equal(content[1]?.type, 'image_url');
    assert.equal(content[1]?.image_url?.url, 'https://example.com/upload.png');
});
