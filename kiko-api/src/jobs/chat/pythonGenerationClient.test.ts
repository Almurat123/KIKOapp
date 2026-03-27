import assert from 'node:assert/strict';
import test from 'node:test';
import { PythonGenerationClient } from './pythonGenerationClient.js';

function makeSseResponse(events: Array<{ type: string; payload?: any }>) {
    const body = events
        .map((event) => `data: ${JSON.stringify(event)}\n\n`)
        .join('') + 'data: [DONE]\n\n';
    const stream = new ReadableStream({
        start(controller) {
            controller.enqueue(new TextEncoder().encode(body));
            controller.close();
        },
    });
    return new Response(stream, { status: 200 });
}

test('streams visible deltas before tool_call_signal for node-controlled tool rounds', async () => {
    const client = new PythonGenerationClient();
    const originalFetch = globalThis.fetch;
    const textDeltas: string[] = [];
    const reasoningDeltas: string[] = [];

    globalThis.fetch = async () => makeSseResponse([
        { type: 'assistant_delta', payload: { text: 'Draft answer that should stay hidden.' } },
        { type: 'reasoning_delta', payload: { text: 'Hidden reasoning.' } },
        { type: 'tool_call_signal', payload: {} },
        { type: 'tool_call', payload: { id: 'tool-1', name: 'get_trending_tokens', arguments: { chain_id: 56 } } },
        { type: 'message_complete', payload: {} },
    ]) as any;

    try {
        const result = await client.generate({
            sessionId: 'session-1',
            taskId: 'task-1',
            model: 'grok-4-1-fast-non-reasoning',
            messages: [],
            tools: [{ type: 'function', function: { name: 'get_trending_tokens', description: '', parameters: {} } }],
            providerOptions: {
                tool_policy: {
                    control_plane: 'node',
                    native_tools: {
                        enable_search: true,
                    },
                },
            },
            onTextDelta: async (text) => { textDeltas.push(text); },
            onReasoningDelta: async (text) => { reasoningDeltas.push(text); },
            onUsage: () => {},
            onCitation: () => {},
        });

        assert.equal(result.toolCalls.length, 1);
        assert.deepEqual(textDeltas, ['Draft answer that should stay hidden.']);
        assert.deepEqual(reasoningDeltas, ['Hidden reasoning.']);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('stops forwarding post-signal deltas once a node-controlled tool round commits to tool execution', async () => {
    const client = new PythonGenerationClient();
    const originalFetch = globalThis.fetch;
    const textDeltas: string[] = [];
    const reasoningDeltas: string[] = [];

    globalThis.fetch = async () => makeSseResponse([
        { type: 'assistant_delta', payload: { text: 'Visible prefix. ' } },
        { type: 'tool_call_signal', payload: {} },
        { type: 'assistant_delta', payload: { text: 'Hidden suffix.' } },
        { type: 'reasoning_delta', payload: { text: 'Hidden reasoning.' } },
        { type: 'tool_call', payload: { id: 'tool-2', name: 'get_token_info', arguments: { chain_id: 56 } } },
        { type: 'message_complete', payload: {} },
    ]) as any;

    try {
        const result = await client.generate({
            sessionId: 'session-2',
            taskId: 'task-2',
            model: 'grok-4-1-fast-non-reasoning',
            messages: [],
            tools: [{ type: 'function', function: { name: 'get_trending_tokens', description: '', parameters: {} } }],
            providerOptions: {
                tool_policy: {
                    control_plane: 'node',
                    native_tools: {
                        enable_search: true,
                    },
                },
            },
            onTextDelta: async (text) => { textDeltas.push(text); },
            onReasoningDelta: async (text) => { reasoningDeltas.push(text); },
            onUsage: () => {},
            onCitation: () => {},
        });

        assert.equal(result.toolCalls.length, 1);
        assert.deepEqual(textDeltas, ['Visible prefix. ']);
        assert.deepEqual(reasoningDeltas, []);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('streams visible deltas immediately when no tool calls were emitted', async () => {
    const client = new PythonGenerationClient();
    const originalFetch = globalThis.fetch;
    const textDeltas: string[] = [];
    const reasoningDeltas: string[] = [];

    globalThis.fetch = async () => makeSseResponse([
        { type: 'assistant_delta', payload: { text: 'Stable final answer.' } },
        { type: 'reasoning_delta', payload: { text: 'Stable reasoning.' } },
        { type: 'message_complete', payload: {} },
    ]) as any;

    try {
        const result = await client.generate({
            sessionId: 'session-2',
            taskId: 'task-2',
            model: 'grok-4-1-fast-non-reasoning',
            messages: [],
            tools: [{ type: 'function', function: { name: 'get_trending_tokens', description: '', parameters: {} } }],
            providerOptions: {
                tool_policy: {
                    control_plane: 'node',
                    native_tools: {
                        enable_search: true,
                    },
                },
            },
            onTextDelta: async (text) => { textDeltas.push(text); },
            onReasoningDelta: async (text) => { reasoningDeltas.push(text); },
            onUsage: () => {},
            onCitation: () => {},
        });

        assert.equal(result.toolCalls.length, 0);
        assert.deepEqual(textDeltas, ['Stable final answer.']);
        assert.deepEqual(reasoningDeltas, ['Stable reasoning.']);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
