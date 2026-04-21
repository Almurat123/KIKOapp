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
    const calls: Array<{ url: string; body: any }> = [];
    process.env.OPENAI_API_KEY = 'test-openai-key';
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
    }
}

test('reference-image support is limited to GPT image models', () => {
    assert.equal(supportsGeneratedImageReferenceInputModel('gpt-image-1-mini'), true);
    assert.equal(supportsGeneratedImageReferenceInputModel('gpt-image-1.5'), true);
    assert.equal(supportsGeneratedImageReferenceInputModel('grok-imagine-image'), false);
});

test('OpenAI uploaded-image requests use the edits endpoint with JSON image_url references', async () => {
    await withOpenAiImageFetchMock(
        async (calls) => {
            const result = await generateImageWithProvider({
                provider: 'openai',
                model: 'gpt-image-1-mini',
                prompt: 'Place the uploaded subject into a moonlit forest scene.',
                quality: 'medium',
                inputImages: [
                    { url: 'https://example.com/source-image.png', sourceLabel: 'user upload 1' },
                ],
            });

            assert.equal(calls.length, 1);
            assert.equal(calls[0].url, 'https://api.openai.com/v1/images/edits');
            assert.equal(calls[0].body.model, 'gpt-image-1-mini');
            assert.equal(calls[0].body.input_fidelity, 'high');
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

test('OpenAI streamed image edits parse image_edit SSE events', async () => {
    const encoder = new TextEncoder();
    await withOpenAiImageFetchMock(
        async () => {
            const progressEvents: number[] = [];
            const result = await generateImageWithProvider({
                provider: 'openai',
                model: 'gpt-image-1.5',
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
