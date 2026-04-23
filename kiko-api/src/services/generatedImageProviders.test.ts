import assert from 'node:assert/strict';
import test from 'node:test';

import {
    generateImageWithProvider,
    supportsGeneratedImageReferenceInputModel,
} from './generatedImageProviders.js';

async function withOpenAiImageFetchMock(
    handler: (calls: Array<{ url: string; body: any }>) => Promise<void>,
    fetchImpl: typeof fetch,
): Promise<void> {
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.OPENAI_API_KEY;
    const originalOpenRouterApiKey = process.env.OPENROUTER_API_KEY;
    const calls: Array<{ url: string; body: any }> = [];
    process.env.OPENAI_API_KEY = 'test-openai-key';
    delete process.env.OPENROUTER_API_KEY;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const rawBody = typeof init?.body === 'string' ? init.body : '';
        calls.push({
            url: String(input),
            body: rawBody ? JSON.parse(rawBody) : null,
        });
        return fetchImpl(input, init);
    }) as typeof fetch;
    try {
        await handler(calls);
    } finally {
        globalThis.fetch = originalFetch;
        if (typeof originalApiKey === 'string') {
            process.env.OPENAI_API_KEY = originalApiKey;
        } else {
            delete process.env.OPENAI_API_KEY;
        }
        if (typeof originalOpenRouterApiKey === 'string') {
            process.env.OPENROUTER_API_KEY = originalOpenRouterApiKey;
        } else {
            delete process.env.OPENROUTER_API_KEY;
        }
    }
}

async function withOpenRouterImageFetchMock(
    handler: (calls: Array<{ url: string; body: any }>) => Promise<void>,
    fetchImpl: typeof fetch,
): Promise<void> {
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.OPENROUTER_API_KEY;
    const calls: Array<{ url: string; body: any }> = [];
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const rawBody = typeof init?.body === 'string' ? init.body : '';
        calls.push({
            url: String(input),
            body: rawBody ? JSON.parse(rawBody) : null,
        });
        return fetchImpl(input, init);
    }) as typeof fetch;
    try {
        await handler(calls);
    } finally {
        globalThis.fetch = originalFetch;
        if (typeof originalApiKey === 'string') {
            process.env.OPENROUTER_API_KEY = originalApiKey;
        } else {
            delete process.env.OPENROUTER_API_KEY;
        }
    }
}

async function withXaiImageFetchMock(
    handler: (calls: Array<{ url: string; body: any }>) => Promise<void>,
    fetchImpl: typeof fetch,
): Promise<void> {
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.XAI_API_KEY;
    const calls: Array<{ url: string; body: any }> = [];
    process.env.XAI_API_KEY = 'test-xai-key';
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const rawBody = typeof init?.body === 'string' ? init.body : '';
        calls.push({
            url: String(input),
            body: rawBody ? JSON.parse(rawBody) : null,
        });
        return fetchImpl(input, init);
    }) as typeof fetch;
    try {
        await handler(calls);
    } finally {
        globalThis.fetch = originalFetch;
        if (typeof originalApiKey === 'string') {
            process.env.XAI_API_KEY = originalApiKey;
        } else {
            delete process.env.XAI_API_KEY;
        }
    }
}

test('reference-image support includes GPT and Grok image models', () => {
    assert.equal(supportsGeneratedImageReferenceInputModel('gpt-image-1-mini'), true);
    assert.equal(supportsGeneratedImageReferenceInputModel('gpt-image-2'), true);
    assert.equal(supportsGeneratedImageReferenceInputModel('grok-imagine-image'), true);
    assert.equal(supportsGeneratedImageReferenceInputModel('grok-imagine-image-pro'), true);
});

test('OpenAI gpt-image-2 uploaded-image requests use the edits endpoint with JSON image_url references', async () => {
    await withOpenAiImageFetchMock(
        async (calls) => {
            const result = await generateImageWithProvider({
                provider: 'openai',
                model: 'gpt-image-2',
                prompt: 'Place the uploaded subject into a moonlit forest scene.',
                quality: 'medium',
                inputImages: [
                    { url: 'https://example.com/source-image.png', sourceLabel: 'user upload 1' },
                ],
            });

            assert.equal(calls.length, 1);
            assert.equal(calls[0].url, 'https://api.openai.com/v1/images/edits');
            assert.equal(calls[0].body.model, 'gpt-image-2');
            assert.equal(Object.hasOwn(calls[0].body, 'input_fidelity'), false);
            assert.deepEqual(calls[0].body.images, [
                { image_url: 'https://example.com/source-image.png' },
            ]);
            assert.equal(result.imageBuffer.toString('utf8'), 'edited-image');
            assert.equal(result.contentType, 'image/png');
        },
        async () => new Response(
            JSON.stringify({
                data: [
                    { b64_json: Buffer.from('edited-image').toString('base64') },
                ],
            }),
            {
                status: 200,
                headers: {
                    'content-type': 'application/json',
                },
            },
        ),
    );
});

test('gpt-image-1-mini stays on OpenAI Images even when OpenRouter is configured', async () => {
    const originalFetch = globalThis.fetch;
    const originalOpenAiApiKey = process.env.OPENAI_API_KEY;
    const originalOpenRouterApiKey = process.env.OPENROUTER_API_KEY;
    const calls: Array<{ url: string; body: any }> = [];
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const rawBody = typeof init?.body === 'string' ? init.body : '';
        calls.push({
            url: String(input),
            body: rawBody ? JSON.parse(rawBody) : null,
        });
        return new Response(
            JSON.stringify({
                data: [
                    { b64_json: Buffer.from('mini-openai-image').toString('base64') },
                ],
            }),
            {
                status: 200,
                headers: {
                    'content-type': 'application/json',
                },
            },
        );
    }) as typeof fetch;

    try {
        const result = await generateImageWithProvider({
            provider: 'openai',
            model: 'gpt-image-1-mini',
            prompt: 'Make a rock style concert poster with neon stage lights.',
            quality: 'medium',
        });

        assert.equal(calls.length, 1);
        assert.equal(calls[0].url, 'https://api.openai.com/v1/images/generations');
        assert.equal(calls[0].body.model, 'gpt-image-1-mini');
        assert.equal(Object.hasOwn(calls[0].body, 'reasoning'), false);
        assert.equal(result.imageBuffer.toString('utf8'), 'mini-openai-image');
        assert.equal(result.contentType, 'image/png');
    } finally {
        globalThis.fetch = originalFetch;
        if (typeof originalOpenAiApiKey === 'string') {
            process.env.OPENAI_API_KEY = originalOpenAiApiKey;
        } else {
            delete process.env.OPENAI_API_KEY;
        }
        if (typeof originalOpenRouterApiKey === 'string') {
            process.env.OPENROUTER_API_KEY = originalOpenRouterApiKey;
        } else {
            delete process.env.OPENROUTER_API_KEY;
        }
    }
});

test('OpenAI streamed image edits parse image_edit SSE events', async () => {
    const encoder = new TextEncoder();
    await withOpenAiImageFetchMock(
        async (calls) => {
            const progressEvents: number[] = [];
            const result = await generateImageWithProvider({
                provider: 'openai',
                model: 'gpt-image-2',
                prompt: 'Turn the uploaded product photo into a clean studio ad.',
                quality: 'high',
                inputImages: [
                    { url: 'https://example.com/product.png', sourceLabel: 'user upload 1' },
                ],
                onProgress: async (event) => {
                    progressEvents.push(event.partialImageIndex);
                },
            });

            assert.deepEqual(progressEvents, [0]);
            assert.equal(calls[0].body.model, 'gpt-image-2');
            assert.equal(Object.hasOwn(calls[0].body, 'input_fidelity'), false);
            assert.equal(result.imageBuffer.toString('utf8'), 'streamed-edit-image');
            assert.equal(result.supportsProgressiveReveal, true);
        },
        async () => {
            const stream = new ReadableStream<Uint8Array>({
                start(controller) {
                    controller.enqueue(encoder.encode(
                        'event: image_edit.partial_image\n'
                        + 'data: {"type":"image_edit.partial_image","partial_image_index":0}\n\n',
                    ));
                    controller.enqueue(encoder.encode(
                        `event: image_edit.completed\n`
                        + `data: {"type":"image_edit.completed","b64_json":"${Buffer.from('streamed-edit-image').toString('base64')}"}\n\n`,
                    ));
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                    controller.close();
                },
            });
            return new Response(stream, {
                status: 200,
                headers: {
                    'content-type': 'text/event-stream',
                },
            });
        },
    );
});

test('OpenRouter gpt-image-2 image requests use chat completions with image_url content', async () => {
    await withOpenRouterImageFetchMock(
        async (calls) => {
            const result = await generateImageWithProvider({
                provider: 'openai',
                model: 'gpt-image-2',
                prompt: 'Place the uploaded subject into a moonlit forest scene.',
                quality: 'medium',
                inputImages: [
                    { url: 'https://example.com/source-image.png', sourceLabel: 'user upload 1' },
                ],
            });

            assert.equal(calls.length, 1);
            assert.equal(calls[0].url, 'https://openrouter.ai/api/v1/chat/completions');
            assert.equal(calls[0].body.model, 'openai/gpt-5.4-image-2');
            assert.deepEqual(calls[0].body.modalities, ['image', 'text']);
            assert.equal(Object.hasOwn(calls[0].body, 'image_config'), false);
            assert.deepEqual(calls[0].body.reasoning, {
                effort: 'medium',
            });
            assert.deepEqual(calls[0].body.messages, [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: 'Place the uploaded subject into a moonlit forest scene.' },
                        { type: 'image_url', image_url: { url: 'https://example.com/source-image.png' } },
                    ],
                },
            ]);
            assert.equal(result.imageBuffer.toString('utf8'), 'router-image');
            assert.equal(result.contentType, 'image/png');
            assert.equal(result.supportsProgressiveReveal, false);
        },
        async () => new Response(
            JSON.stringify({
                choices: [
                    {
                        message: {
                            role: 'assistant',
                            content: 'Generated.',
                            images: [
                                {
                                    type: 'image_url',
                                    image_url: {
                                        url: `data:image/png;base64,${Buffer.from('router-image').toString('base64')}`,
                                    },
                                },
                            ],
                        },
                    },
                ],
            }),
            {
                status: 200,
                headers: {
                    'content-type': 'application/json',
                },
            },
        ),
    );
});

test('OpenRouter streamed GPT image responses decode delta.images', async () => {
    const encoder = new TextEncoder();
    await withOpenRouterImageFetchMock(
        async (calls) => {
            const progressEvents: number[] = [];
            const result = await generateImageWithProvider({
                provider: 'openai',
                model: 'gpt-image-2',
                prompt: 'Turn the uploaded product photo into a clean studio ad.',
                quality: 'high',
                inputImages: [
                    { url: 'https://example.com/product.png', sourceLabel: 'user upload 1' },
                ],
                onProgress: async (event) => {
                    progressEvents.push(event.partialImageIndex);
                },
            });

            assert.deepEqual(progressEvents, [0]);
            assert.equal(calls[0].url, 'https://openrouter.ai/api/v1/chat/completions');
            assert.equal(calls[0].body.stream, true);
            assert.equal(calls[0].body.model, 'openai/gpt-5.4-image-2');
            assert.equal(Object.hasOwn(calls[0].body, 'image_config'), false);
            assert.deepEqual(calls[0].body.reasoning, {
                effort: 'high',
            });
            assert.equal(result.imageBuffer.toString('utf8'), 'streamed-router-image');
            assert.equal(result.supportsProgressiveReveal, true);
        },
        async () => {
            const stream = new ReadableStream<Uint8Array>({
                start(controller) {
                    controller.enqueue(encoder.encode(
                        'data: {"choices":[{"delta":{"images":[{"image_url":{"url":"data:image/png;base64,'
                        + Buffer.from('streamed-router-image').toString('base64')
                        + '"}}]}}]}\n\n',
                    ));
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                    controller.close();
                },
            });
            return new Response(stream, {
                status: 200,
                headers: {
                    'content-type': 'text/event-stream',
                },
            });
        },
    );
});

test('xAI Grok normal image requests use generation endpoint with auto aspect ratio and 1k resolution', async () => {
    await withXaiImageFetchMock(
        async (calls) => {
            const result = await generateImageWithProvider({
                provider: 'xai',
                model: 'grok-imagine-image',
                prompt: 'Epic mascot marching through a storm.',
                quality: 'normal',
            });

            assert.equal(calls.length, 2);
            assert.equal(calls[0].url, 'https://api.x.ai/v1/images/generations');
            assert.deepEqual(calls[0].body, {
                model: 'grok-imagine-image',
                prompt: 'Epic mascot marching through a storm.',
                n: 1,
                resolution: '1k',
                response_format: 'url',
                aspect_ratio: 'auto',
            });
            assert.equal(result.model, 'grok-imagine-image');
            assert.equal(result.quality, 'normal');
            assert.equal(result.imageBuffer.toString('utf8'), 'xai-image');
        },
        async (input: RequestInfo | URL) => {
            if (String(input) === 'https://api.x.ai/v1/images/generations') {
                return new Response(
                    JSON.stringify({
                        data: [
                            { url: 'https://example.com/generated-xai-image.png' },
                        ],
                    }),
                    {
                        status: 200,
                        headers: {
                            'content-type': 'application/json',
                        },
                    },
                );
            }
            return new Response('xai-image', {
                status: 200,
                headers: {
                    'content-type': 'image/png',
                },
            });
        },
    );
});

test('xAI Grok pro uploaded-image requests use edits endpoint with 2k resolution', async () => {
    await withXaiImageFetchMock(
        async (calls) => {
            const result = await generateImageWithProvider({
                provider: 'xai',
                model: 'grok-imagine-image-pro',
                prompt: 'Turn this mascot into a cinematic poster.',
                quality: 'pro',
                inputImages: [
                    { url: 'https://example.com/mascot.png', sourceLabel: 'upload 1' },
                ],
            });

            assert.equal(calls.length, 2);
            assert.equal(calls[0].url, 'https://api.x.ai/v1/images/edits');
            assert.deepEqual(calls[0].body, {
                model: 'grok-imagine-image',
                prompt: 'Turn this mascot into a cinematic poster.',
                n: 1,
                resolution: '2k',
                response_format: 'url',
                image: {
                    type: 'image_url',
                    url: 'https://example.com/mascot.png',
                },
            });
            assert.equal(result.model, 'grok-imagine-image-pro');
            assert.equal(result.quality, 'pro');
            assert.equal(result.imageBuffer.toString('utf8'), 'xai-pro-image');
        },
        async (input: RequestInfo | URL) => {
            if (String(input) === 'https://api.x.ai/v1/images/edits') {
                return new Response(
                    JSON.stringify({
                        data: [
                            { url: 'https://example.com/generated-xai-pro-image.png' },
                        ],
                    }),
                    {
                        status: 200,
                        headers: {
                            'content-type': 'application/json',
                        },
                    },
                );
            }
            return new Response('xai-pro-image', {
                status: 200,
                headers: {
                    'content-type': 'image/png',
                },
            });
        },
    );
});
