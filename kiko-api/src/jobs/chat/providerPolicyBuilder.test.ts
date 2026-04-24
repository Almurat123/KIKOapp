import test from 'node:test';
import assert from 'node:assert/strict';

import { buildProviderOptions, resolveProviderInfo } from './providerPolicyBuilder.js';

test('resolveProviderInfo routes only DeepSeek V4 Flash to the DeepSeek provider bucket', () => {
    assert.deepEqual(resolveProviderInfo('deepseek-v4-flash'), {
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        supportsNativeSearch: false,
        supportsPreviousResponse: false,
    });

    assert.equal(resolveProviderInfo('deepseek-chat').provider, 'openai');
});

test('buildProviderOptions keeps DeepSeek Flash lightweight and stateless', () => {
    const providerInfo = resolveProviderInfo('deepseek-v4-flash');
    const options = buildProviderOptions(
        {
            sessionId: 'session-1',
            taskId: 'task-1',
            runtime: {
                toolContext: { reasoningEffort: 'high', walletAddress: '0xabc' },
            },
        } as any,
        providerInfo,
        'hello',
        undefined,
        { previousResponseId: 'resp_123' },
    );

    assert.equal(options.api_mode, 'chat_completions');
    assert.equal(options.enable_search, false);
    assert.equal(options.previous_response_id, undefined);
    assert.equal(options.reasoning_effort, undefined);
    assert.deepEqual(options.tool_context, { walletAddress: '0xabc' });
});
