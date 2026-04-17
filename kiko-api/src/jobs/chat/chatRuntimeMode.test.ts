import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChatContextSnapshot } from './contracts.js';
import { resolveChatRuntimeMode, runChatTurnByRuntimeMode } from './chatRuntimeMode.js';

function makeSnapshot(message: string): ChatContextSnapshot {
    return {
        sessionId: 'session-mode',
        taskId: 'task-mode',
        assistantMessageId: 'assistant-mode',
        model: 'gpt-5.4-mini',
        history: [],
        lastUserMessage: message,
        requestedTokenAddresses: [],
        requestedTokenSymbols: [],
        toolDefinitions: [],
        recentToolTrace: {
            messageId: 'assistant-mode',
            toolCalls: [],
        },
        runtime: {
            userSettings: {},
            toolContext: {},
            prefetchedToolResults: {},
            contextBlocks: {},
            systemDirectives: [],
        },
    } as ChatContextSnapshot;
}

test('resolveChatRuntimeMode defaults to v2_primary and accepts compatibility aliases', () => {
    assert.equal(resolveChatRuntimeMode(undefined), 'v2_primary');
    assert.equal(resolveChatRuntimeMode(''), 'v2_primary');
    assert.equal(resolveChatRuntimeMode('v2_primary'), 'v2_primary');
    assert.equal(resolveChatRuntimeMode('compat'), 'compat_fallback');
    assert.equal(resolveChatRuntimeMode('legacy'), 'compat_fallback');
    assert.equal(resolveChatRuntimeMode('v1_compat'), 'compat_fallback');
});

test('runChatTurnByRuntimeMode dispatches compat mode through the compat runner owner', async () => {
    const calls: string[] = [];
    const result = await runChatTurnByRuntimeMode({
        snapshot: makeSnapshot('hello'),
        task: {
            id: 'task-mode',
            sessionId: 'session-mode',
            assistantMessageId: 'assistant-mode',
            model: 'gpt-5.4-mini',
            toolContext: {},
        },
        userId: 'user-mode',
        broker: {} as any,
        generationClient: {} as any,
        toolExecutionEngine: {} as any,
        runtimeMode: 'compat_fallback',
    }, {
        runChatCompatTurn: async () => {
            calls.push('compat');
            return {
                terminal: false,
                snapshot: makeSnapshot('hello'),
            };
        },
        runChatV2Turn: async () => {
            calls.push('v2');
            return {
                terminal: false,
                snapshot: makeSnapshot('hello'),
            };
        },
    });

    assert.deepEqual(calls, ['compat']);
    assert.equal(result.runtimeMode, 'compat_fallback');
    assert.equal(result.terminal, false);
});

test('runChatTurnByRuntimeMode dispatches v2_primary directly to the v2 runner', async () => {
    const calls: string[] = [];
    const result = await runChatTurnByRuntimeMode({
        snapshot: makeSnapshot('hello'),
        task: {
            id: 'task-mode',
            sessionId: 'session-mode',
            assistantMessageId: 'assistant-mode',
            model: 'gpt-5.4-mini',
            toolContext: {},
        },
        userId: 'user-mode',
        broker: {} as any,
        generationClient: {} as any,
        toolExecutionEngine: {} as any,
        runtimeMode: 'v2_primary',
    }, {
        runChatCompatTurn: async () => {
            calls.push('compat');
            return {
                terminal: false,
                snapshot: makeSnapshot('hello'),
            };
        },
        runChatV2Turn: async () => {
            calls.push('v2');
            return {
                terminal: false,
                snapshot: makeSnapshot('hello'),
            };
        },
    });

    assert.deepEqual(calls, ['v2']);
    assert.equal(result.runtimeMode, 'v2_primary');
    assert.equal(result.terminal, false);
});
