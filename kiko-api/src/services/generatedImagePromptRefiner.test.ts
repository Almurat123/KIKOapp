import assert from 'node:assert/strict';
import test from 'node:test';

import { refineGeneratedImagePromptWithOpenAi } from './generatedImagePromptRefiner.js';
import type { OptimizedGeneratedImagePromptSpec } from './generatedImagePromptOptimizer.js';

const baseSpec: OptimizedGeneratedImagePromptSpec = {
    editOrGenerate: 'edit',
    artifactType: 'image edit',
    subject: 'the same horse with a KIKO badge',
    scene: 'the original outdoor scene',
    keyDetails: 'badge follows the horse perspective',
    composition: 'preserve the source framing',
    style: 'photorealistic',
    lighting: 'match original lighting',
    camera: 'same camera angle',
    changeRequest: 'add a small badge with KIKO text',
    preserveElements: ['horse identity', 'background', 'lighting'],
    exactText: 'KIKO',
    textPlacement: 'on the badge, once',
    typography: 'bold sans-serif',
    aspectRatio: '1:1',
    safetyLevel: 'standard',
    constraints: ['render requested text verbatim, once, with no extra characters'],
    negativeConstraints: ['no extra letters'],
    referenceImages: [
        {
            description: 'Image 1: source horse image',
            purpose: 'source scene and subject identity',
        },
    ],
};

async function withOpenAiRefinerMock<T>(
    fetchImpl: typeof fetch,
    fn: () => Promise<T>,
): Promise<T> {
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.OPENAI_API_KEY;
    const originalModel = process.env.GENERATED_IMAGE_PROMPT_REFINER_MODEL;
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.GENERATED_IMAGE_PROMPT_REFINER_MODEL = 'gpt-5.4-mini-2026-03-17';
    globalThis.fetch = fetchImpl;
    try {
        return await fn();
    } finally {
        globalThis.fetch = originalFetch;
        if (typeof originalApiKey === 'string') {
            process.env.OPENAI_API_KEY = originalApiKey;
        } else {
            delete process.env.OPENAI_API_KEY;
        }
        if (typeof originalModel === 'string') {
            process.env.GENERATED_IMAGE_PROMPT_REFINER_MODEL = originalModel;
        } else {
            delete process.env.GENERATED_IMAGE_PROMPT_REFINER_MODEL;
        }
    }
}

test('refineGeneratedImagePromptWithOpenAi uses GPT-refined prompt when available', async () => {
    const calls: Array<{ url: string; body: any }> = [];
    const result = await withOpenAiRefinerMock(
        (async (input: RequestInfo | URL, init?: RequestInit) => {
            const body = JSON.parse(String(init?.body || '{}'));
            calls.push({ url: String(input), body });
            return new Response(JSON.stringify({
                choices: [
                    {
                        message: {
                            content: JSON.stringify({
                                prompt: 'Final refined OpenAI image prompt with Change, Preserve, and exact "KIKO" text.',
                            }),
                        },
                    },
                ],
            }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            });
        }) as typeof fetch,
        () => refineGeneratedImagePromptWithOpenAi({
            userIntent: 'Put KIKO on the horse',
            draftProviderPrompt: 'Draft prompt',
            spec: baseSpec,
        }),
    );

    assert.equal(result.usedRefiner, true);
    assert.equal(result.model, 'gpt-5.4-mini-2026-03-17');
    assert.match(result.prompt, /Final refined OpenAI image prompt/);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].body.response_format.type, 'json_object');
    assert.match(calls[0].body.messages[0].content, /OpenAI image prompting expert/);
    assert.match(calls[0].body.messages[1].content, /Put KIKO on the horse/);
});

test('refineGeneratedImagePromptWithOpenAi falls back when API key is missing', async () => {
    const originalApiKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
        const result = await refineGeneratedImagePromptWithOpenAi({
            userIntent: 'Generate a poster',
            draftProviderPrompt: 'Draft prompt',
            spec: baseSpec,
        });

        assert.equal(result.usedRefiner, false);
        assert.equal(result.prompt, 'Draft prompt');
        assert.match(result.errorMessage || '', /OPENAI_API_KEY/);
    } finally {
        if (typeof originalApiKey === 'string') {
            process.env.OPENAI_API_KEY = originalApiKey;
        }
    }
});
