import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChatContextSnapshot } from './contracts.js';
import { runChatCompatTurn } from './chatCompatTurnRunner.js';

function makeSnapshot(message: string): ChatContextSnapshot {
    return {
        sessionId: 'session-compat',
        taskId: 'task-compat',
        assistantMessageId: 'assistant-compat',
        model: 'gpt-5.4-mini',
        history: [],
        lastUserMessage: message,
        requestedTokenAddresses: [],
        requestedTokenSymbols: [],
        toolDefinitions: [],
        recentToolTrace: {
            messageId: 'assistant-compat',
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

test('runChatCompatTurn currently aliases compat mode to the v2 runner explicitly', async () => {
    const calls: string[] = [];
    const result = await runChatCompatTurn({
        snapshot: makeSnapshot('hello'),
        task: {
            id: 'task-compat',
            sessionId: 'session-compat',
            assistantMessageId: 'assistant-compat',
            model: 'gpt-5.4-mini',
            toolContext: {},
        },
        userId: 'user-compat',
        broker: {} as any,
        generationClient: {} as any,
        toolExecutionEngine: {} as any,
    }, {
        runChatV2Turn: async () => {
            calls.push('v2');
            return {
                terminal: false,
                snapshot: makeSnapshot('hello'),
            };
        },
    });

    assert.deepEqual(calls, ['v2']);
    assert.equal(result.terminal, false);
});
