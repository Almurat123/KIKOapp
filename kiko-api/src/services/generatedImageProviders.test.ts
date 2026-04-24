import assert from 'node:assert/strict';
import test from 'node:test';

import {
    generateImageWithProvider,
    resolveGeneratedImageExecutionProvider,
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
    assert.equal(supportsGeneratedImageReferenceInputModel('runware-flux-2-klein-9b-kv'), true);
    assert.equal(supportsGeneratedImageReferenceInputModel('cloudflare-flux-2-klein-4b'), false);
});

test('execution provider resolves OpenRouter only for gpt-image-2 when configured and new low-cost providers directly', () => {
    const originalOpenRouterApiKey = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    try {
        assert.equal(resolveGeneratedImageExecutionProvider('cloudflare-flux-2-klein-4b', 'cloudflare'), 'cloudflare');
        assert.equal(resolveGeneratedImageExecutionProvider('runware-flux-2-klein-9b-kv', 'runware'), 'runware');
        assert.equal(resolveGeneratedImageExecutionProvider('gpt-image-1-mini', 'openai'), 'openai');
        assert.equal(resolveGeneratedImageExecutionProvider('gpt-image-2', 'openai'), 'openai');
        process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
        assert.equal(resolveGeneratedImageExecutionProvider('gpt-image-2', 'openai'), 'openrouter');
        assert.equal(resolveGeneratedImageExecutionProvider('grok-imagine-image', 'xai'), 'xai');
    } finally {
        if (typeof originalOpenRouterApiKey === 'string') {
            process.env.OPENROUTER_API_KEY = originalOpenRouterApiKey;
        } else {
            delete process.env.OPENROUTER_API_KEY;
        }
    }
});

test('Cloudflare FLUX.2 Klein 4B image requests use Workers AI and decode base64 image payload', async () => {
    const originalFetch = globalThis.fetch;
    const originalAccountId = process.env.CLOUDFLARE_WORKERS_AI_ACCOUNT_ID;
    const originalApiToken = process.env.CLOUDFLARE_WORKERS_AI_API_TOKEN;
    const calls: Array<{ url: string; prompt: string | null; width: string | null; height: string | null }> = [];
    process.env.CLOUDFLARE_WORKERS_AI_ACCOUNT_ID = 'test-account';
    process.env.CLOUDFLARE_WORKERS_AI_API_TOKEN = 'test-cloudflare-token';
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const form = init?.body instanceof FormData ? init.body : null;
        calls.push({
            url: String(input),
            prompt: form ? String(form.get('prompt') || '') : null,
            width: form ? String(form.get('width') || '') : null,
            height: form ? String(form.get('height') || '') : null,
        });
        return new Response(
            JSON.stringify({
                result: {
                    image: Buffer.from('cloudflare-image').toString('base64'),
                },
                success: true,
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
            provider: 'cloudflare',
            model: 'cloudflare-flux-2-klein-4b',
            prompt: 'Fast free mascot poster.',
            quality: 'normal',
        });

        assert.equal(calls.length, 1);
        assert.equal(calls[0].url, 'https://api.cloudflare.com/client/v4/accounts/test-account/ai/run/@cf/black-forest-labs/flux-2-klein-4b');
        assert.equal(calls[0].prompt, 'Fast free mascot poster.');
        assert.equal(calls[0].width, '1024');
        assert.equal(calls[0].height, '1024');
        assert.equal(result.provider, 'cloudflare');
        assert.equal(result.executionProvider, 'cloudflare');
        assert.equal(result.model, 'cloudflare-flux-2-klein-4b');
        assert.equal(result.imageBuffer.toString('utf8'), 'cloudflare-image');
    } finally {
        globalThis.fetch = originalFetch;
        if (typeof originalAccountId === 'string') {
            process.env.CLOUDFLARE_WORKERS_AI_ACCOUNT_ID = originalAccountId;
        } else {
            delete process.env.CLOUDFLARE_WORKERS_AI_ACCOUNT_ID;
        }
        if (typeof originalApiToken === 'string') {
            process.env.CLOUDFLARE_WORKERS_AI_API_TOKEN = originalApiToken;
        } else {
            delete process.env.CLOUDFLARE_WORKERS_AI_API_TOKEN;
        }
    }
});

test('Runware FLUX.2 Klein 9B KV image requests use REST imageInference and download URL output', async () => {
    const originalFetch = globalThis.fetch;
    const originalRunwareApiKey = process.env.RUNWARE_API_KEY;
    const calls: Array<{ url: string; body: any }> = [];
    process.env.RUNWARE_API_KEY = 'test-runware-key';
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const rawBody = typeof init?.body === 'string' ? init.body : '';
        calls.push({
            url,
            body: rawBody ? JSON.parse(rawBody) : null,
        });
        if (url === 'https://api.runware.ai/v1') {
            return new Response(
                JSON.stringify({
                    data: [
                        {
                            taskType: 'imageInference',
                            taskUUID: calls[0].body[0].taskUUID,
                            imageURL: 'https://im.runware.ai/generated.png',
                            cost: 0.00078,
                        },
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
        return new Response('runware-image', {
            status: 200,
            headers: {
                'content-type': 'image/png',
            },
        });
    }) as typeof fetch;

    try {
        const result = await generateImageWithProvider({
            provider: 'runware',
            model: 'runware-flux-2-klein-9b-kv',
            prompt: 'Cheap fast product render.',
            quality: 'normal',
            inputImages: [
                { url: 'https://example.com/source.png', sourceLabel: 'reference' },
            ],
        });

        assert.equal(calls.length, 2);
        assert.equal(calls[0].url, 'https://api.runware.ai/v1');
        assert.equal(calls[0].body[0].taskType, 'imageInference');
        assert.equal(calls[0].body[0].model, 'runware:400@6');
        assert.equal(calls[0].body[0].positivePrompt, 'Cheap fast product render.');
        assert.equal(calls[0].body[0].seedImage, 'https://example.com/source.png');
        assert.equal(calls[0].body[0].strength, 0.9);
        assert.equal(result.provider, 'runware');
        assert.equal(result.executionProvider, 'runware');
        assert.equal(result.model, 'runware-flux-2-klein-9b-kv');
        assert.equal(result.imageBuffer.toString('utf8'), 'runware-image');
    } finally {
        globalThis.fetch = originalFetch;
        if (typeof originalRunwareApiKey === 'string') {
            process.env.RUNWARE_API_KEY = originalRunwareApiKey;
        } else {
            delete process.env.RUNWARE_API_KEY;
        }
    }
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
        assert.equal(result.executionProvider, 'openai');
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
            assert.equal(result.executionProvider, 'openrouter');
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
            assert.equal(result.executionProvider, 'openrouter');
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
            assert.equal(result.executionProvider, 'xai');
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
            assert.equal(result.executionProvider, 'xai');
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
