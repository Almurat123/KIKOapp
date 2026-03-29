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

test('forwards Grok progress, client actions, and latency metrics without losing the final answer', async () => {
    const client = new PythonGenerationClient();
    const originalFetch = globalThis.fetch;
    const providerProgress: Array<{ status?: string; toolBatch?: Record<string, any> }> = [];
    const clientActions: any[] = [];
    const latencyMetrics: Record<string, any>[] = [];
    const textDeltas: string[] = [];

    globalThis.fetch = async () => makeSseResponse([
        { type: 'tool_progress', payload: { status: 'Running 2 tools', tool_batch: { phase: 'started', count: 2, tools: ['web_search', 'x_search'] } } },
        { type: 'client_action', payload: { client_actions: [{ type: 'show_polymarket_card', data: { slug: 'btc-up-down' } }] } },
        { type: 'assistant_delta', payload: { text: 'Final Grok answer.' } },
        { type: 'latency_metrics', payload: { first_token_ms: 420, end_to_end_ms: 1800 } },
        { type: 'message_complete', payload: {} },
    ]) as any;

    try {
        const result = await client.generate({
            sessionId: 'session-3',
            taskId: 'task-3',
            model: 'grok-4-1-fast-non-reasoning',
            messages: [],
            tools: [],
            providerOptions: {},
            onTextDelta: async (text) => { textDeltas.push(text); },
            onReasoningDelta: async () => {},
            onUsage: () => {},
            onCitation: () => {},
            onClientAction: async (action) => { clientActions.push(action); },
            onProviderProgress: async (progress) => { providerProgress.push(progress); },
            onLatencyMetrics: async (metrics) => { latencyMetrics.push(metrics); },
        });

        assert.equal(result.text, 'Final Grok answer.');
        assert.deepEqual(textDeltas, ['Final Grok answer.']);
        assert.equal(providerProgress.length, 1);
        assert.equal(providerProgress[0]?.status, 'Running 2 tools');
        assert.equal(providerProgress[0]?.toolBatch?.phase, 'started');
        assert.equal(clientActions.length, 1);
        assert.equal(clientActions[0]?.type, 'show_polymarket_card');
        assert.equal(latencyMetrics.length, 1);
        assert.equal(latencyMetrics[0]?.first_token_ms, 420);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('buffers native-search prose and citations until the orchestrator decides the turn is final', async () => {
    const client = new PythonGenerationClient();
    const originalFetch = globalThis.fetch;
    const textDeltas: string[] = [];
    const reasoningDeltas: string[] = [];
    const citations: any[] = [];

    globalThis.fetch = async () => makeSseResponse([
        { type: 'tool_progress', payload: { status: 'Searching X', tool_batch: { phase: 'started', count: 1, tools: ['x_search'] } } },
        { type: 'assistant_delta', payload: { text: 'This should not be shown yet.' } },
        { type: 'reasoning_delta', payload: { text: 'Interim reasoning.' } },
        { type: 'citation', payload: { citations: [{ url: 'https://x.com/example/status/1' }] } },
        { type: 'tool_call_signal', payload: {} },
        { type: 'tool_call', payload: { id: 'native-x', name: 'x_search', arguments: { query: 'token sentiment' } } },
        { type: 'message_complete', payload: {} },
    ]) as any;

    try {
        const result = await client.generate({
            sessionId: 'session-native-buffer',
            taskId: 'task-native-buffer',
            model: 'grok-4-1-fast-non-reasoning',
            messages: [],
            tools: [],
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
            onCitation: (citation) => { citations.push(citation); },
        });

        assert.equal(result.bufferedVisibleOutput, true);
        assert.equal(result.text, 'This should not be shown yet.');
        assert.equal(result.reasoning, 'Interim reasoning.');
        assert.equal(result.toolCalls.length, 1);
        assert.deepEqual(textDeltas, []);
        assert.deepEqual(reasoningDeltas, []);
        assert.deepEqual(citations, []);
        assert.deepEqual(result.citations, [{ url: 'https://x.com/example/status/1' }]);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('captures provider finish_reason and explicit buffering for continuation rounds', async () => {
    const client = new PythonGenerationClient();
    const originalFetch = globalThis.fetch;
    const textDeltas: string[] = [];
    const providerStates: any[] = [];

    globalThis.fetch = async () => makeSseResponse([
        { type: 'assistant_delta', payload: { text: 'Partial answer that should stay buffered.' } },
        { type: 'provider_state', payload: { previous_response_id: 'resp-1', finish_reason: 'length' } },
        { type: 'message_complete', payload: {} },
    ]) as any;

    try {
        const result = await client.generate({
            sessionId: 'session-native-continuation',
            taskId: 'task-native-continuation',
            model: 'grok-4-1-fast-non-reasoning',
            messages: [],
            tools: [],
            providerOptions: {
                buffer_visible_output: true,
            },
            onTextDelta: async (text) => { textDeltas.push(text); },
            onReasoningDelta: async () => {},
            onUsage: () => {},
            onCitation: () => {},
            onProviderState: async (state) => { providerStates.push(state); },
        });

        assert.equal(result.bufferedVisibleOutput, true);
        assert.equal(result.text, 'Partial answer that should stay buffered.');
        assert.equal(result.providerState?.previousResponseId, 'resp-1');
        assert.equal(result.providerState?.finishReason, 'length');
        assert.deepEqual(textDeltas, []);
        assert.equal(providerStates[0]?.finishReason, 'length');
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('retries generation stream open once after a transient fetch failure', async () => {
    const client = new PythonGenerationClient();
    const originalFetch = globalThis.fetch;
    const textDeltas: string[] = [];
    let attempts = 0;

    globalThis.fetch = async () => {
        attempts += 1;
        if (attempts === 1) {
            throw new TypeError('fetch failed');
        }
        return makeSseResponse([
            { type: 'assistant_delta', payload: { text: 'Recovered answer.' } },
            { type: 'message_complete', payload: {} },
        ]) as any;
    };

    try {
        const result = await client.generate({
            sessionId: 'session-retry-open',
            taskId: 'task-retry-open',
            model: 'deepseek-chat',
            messages: [],
            tools: [],
            providerOptions: {},
            onTextDelta: async (text) => { textDeltas.push(text); },
            onReasoningDelta: async () => {},
            onUsage: () => {},
            onCitation: () => {},
        });

        assert.equal(attempts, 2);
        assert.equal(result.text, 'Recovered answer.');
        assert.deepEqual(textDeltas, ['Recovered answer.']);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('does not retry non-transient generation stream open failures', async () => {
    const client = new PythonGenerationClient();
    const originalFetch = globalThis.fetch;
    let attempts = 0;

    globalThis.fetch = async () => {
        attempts += 1;
        return new Response('Unauthorized', { status: 401 }) as any;
    };

    try {
        await assert.rejects(
            client.generate({
                sessionId: 'session-open-fail',
                taskId: 'task-open-fail',
                model: 'deepseek-chat',
                messages: [],
                tools: [],
                providerOptions: {},
                onTextDelta: async () => {},
                onReasoningDelta: async () => {},
                onUsage: () => {},
                onCitation: () => {},
            }),
            /Failed to open generation stream: HTTP 401: Unauthorized/,
        );
        assert.equal(attempts, 1);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
