import test from 'node:test';
import assert from 'node:assert/strict';

import { __generateImageFromIntentTest } from './generateImageFromIntent.js';

test('generated image source stays web chat when only linked Farcaster profile exists', () => {
    const source = __generateImageFromIntentTest.resolveGeneratedImageSource(
        {
            currentPage: '/',
            pageContext: 'KIKO | /',
            farcaster: {
                fid: 1576616,
                username: 'kikoapp',
            },
        },
        {
            runtime: {
                farcaster: {
                    fid: 1576616,
                    username: 'kikoapp',
                },
            },
        },
    );

    assert.equal(source, 'chat-v2-tool');
});

test('generated image source uses Farcaster for explicit Farcaster runtime page', () => {
    const source = __generateImageFromIntentTest.resolveGeneratedImageSource({
        currentPage: 'farcaster',
        pageContext: 'farcaster_agent',
    });

    assert.equal(source, 'farcaster');
});

test('generated image source uses Farcaster from snapshot page context', () => {
    const source = __generateImageFromIntentTest.resolveGeneratedImageSource(
        {},
        {
            runtime: {
                currentPage: 'chat',
                pageContext: 'farcaster_agent',
            },
        },
    );

    assert.equal(source, 'farcaster');
});

test('generated image tool uses product fallback only when no saved image preference exists', () => {
    assert.equal(
        __generateImageFromIntentTest.pickDefaultGeneratedImageModel('gpt-5.4-mini-2026-03-17'),
        'cloudflare-flux-2-klein-4b',
    );
});

test('generated image tool uses the same product fallback for non-OpenAI chat sessions', () => {
    assert.equal(
        __generateImageFromIntentTest.pickDefaultGeneratedImageModel('grok-4-1-fast-non-reasoning'),
        'cloudflare-flux-2-klein-4b',
    );
    assert.equal(
        __generateImageFromIntentTest.pickDefaultGeneratedImageModel('gpt-5.4-mini-2026-03-17'),
        'cloudflare-flux-2-klein-4b',
    );
});

test('generated image tool honors saved image model preferences from tool context', () => {
    assert.deepEqual(
        __generateImageFromIntentTest.resolveGeneratedImageToolPreference({
            generatedImagePreference: {
                model: 'grok-imagine-image',
                quality: 'normal',
            },
        }, 'gpt-5.4-mini-2026-03-17'),
        {
            requestedModel: 'grok-imagine-image',
            quality: 'normal',
        },
    );
});

test('generated image tool honors saved GPT Image 2 preference from tool context', () => {
    assert.deepEqual(
        __generateImageFromIntentTest.resolveGeneratedImageToolPreference({
            generatedImagePreference: {
                model: 'gpt-image-2',
                quality: 'high',
            },
        }, 'gpt-5.4-mini-2026-03-17'),
        {
            requestedModel: 'gpt-image-2',
            quality: 'high',
        },
    );
});

test('generated image tool falls back when saved image preference is unsupported', () => {
    assert.deepEqual(
        __generateImageFromIntentTest.resolveGeneratedImageToolPreference({
            generatedImagePreference: {
                model: 'gpt-image-1.5',
                quality: 'high',
            },
        }, 'gpt-5.4-mini-2026-03-17'),
        {
            requestedModel: 'cloudflare-flux-2-klein-4b',
            quality: 'normal',
        },
    );
});

test('generated image tool skips Cloudflare fallback when reference inputs require an editable model', () => {
    assert.deepEqual(
        __generateImageFromIntentTest.resolveGeneratedImageToolPreferenceWithOptions({}, 'gpt-5.4-mini-2026-03-17', {
            hasReferenceInputs: true,
        }),
        {
            requestedModel: 'gpt-image-1-mini',
            quality: 'medium',
        },
    );
});

test('generated image tool keeps Grok image preference when reference inputs are present and the model can edit', () => {
    assert.deepEqual(
        __generateImageFromIntentTest.resolveGeneratedImageToolPreferenceWithOptions({
            generatedImagePreference: {
                model: 'grok-imagine-image',
                quality: 'normal',
            },
        }, 'gpt-5.4-mini-2026-03-17', {
            hasReferenceInputs: true,
        }),
        {
            requestedModel: 'grok-imagine-image',
            quality: 'normal',
        },
    );
});

test('generated image tool passes implicit task and social images as provider reference inputs', () => {
    const merged = __generateImageFromIntentTest.mergeImplicitReferenceImages(
        [
            {
                url: 'https://example.com/explicit.png',
                description: 'explicit reference',
                purpose: 'match color palette',
            },
        ],
        [
            {
                url: 'https://example.com/farcaster-upload.png',
                sourceLabel: 'Farcaster attached image 1',
                purpose: 'preserve subject identity and visual details from the uploaded image',
            },
            {
                url: 'https://example.com/x-post-photo.png',
                sourceLabel: 'current X post by @user',
                purpose: 'preserve subject identity and visual details from the social post image',
            },
        ],
    );

    assert.deepEqual(
        __generateImageFromIntentTest.buildProviderReferenceImages(merged),
        [
            {
                url: 'https://example.com/explicit.png',
                sourceLabel: 'explicit reference | match color palette',
            },
            {
                url: 'https://example.com/farcaster-upload.png',
                sourceLabel: 'Farcaster attached image 1 | preserve subject identity and visual details from the uploaded image',
            },
            {
                url: 'https://example.com/x-post-photo.png',
                sourceLabel: 'current X post by @user | preserve subject identity and visual details from the social post image',
            },
        ],
    );
});

test('generated image tool reads implicit social reference images from runtime social input', () => {
    const socialImages = __generateImageFromIntentTest.readImplicitSocialReferenceImages({
        __snapshot: {
            runtime: {
                socialInput: {
                    images: [
                        {
                            url: 'https://example.com/source-post.png',
                            sourceLabel: 'current Farcaster post by @kikoapp',
                        },
                        {
                            url: 'not-a-url',
                            sourceLabel: 'bad',
                        },
                    ],
                },
            },
        },
    });

    assert.deepEqual(socialImages, [
        {
            url: 'https://example.com/source-post.png',
            sourceLabel: 'current Farcaster post by @kikoapp',
        },
    ]);
});

test('generated image tool builds provider reference images from social runtime input', () => {
    const built = __generateImageFromIntentTest.buildImplicitImageReferenceInputs({
        explicitReferenceImages: [],
        uploadedTaskImages: [],
        context: {
            __snapshot: {
                runtime: {
                    socialInput: {
                        images: [
                            {
                                url: 'https://example.com/farcaster-post-image.png',
                                sourceLabel: 'current Farcaster post by @kikoapp',
                            },
                        ],
                    },
                },
            },
        },
    });

    assert.deepEqual(built.providerReferenceImages, [
        {
            url: 'https://example.com/farcaster-post-image.png',
            sourceLabel: 'current Farcaster post by @kikoapp | preserve subject identity and visual details from the social post image',
        },
    ]);
});

test('generated image tool preserves social reference inputs when model requests action generate', () => {
    const built = __generateImageFromIntentTest.buildImplicitImageReferenceInputs({
        explicitReferenceImages: [],
        uploadedTaskImages: [],
        context: {
            __snapshot: {
                runtime: {
                    socialInput: {
                        images: [
                            {
                                url: 'https://example.com/x-reference-image.png',
                                sourceLabel: 'current X post by @artist',
                            },
                        ],
                    },
                },
            },
        },
    });
    const resolved = __generateImageFromIntentTest.resolveReferenceInputsForAction({
        requestedAction: 'generate',
        builtReferenceInputs: built,
    });

    assert.deepEqual(resolved.providerReferenceImages, [
        {
            url: 'https://example.com/x-reference-image.png',
            sourceLabel: 'current X post by @artist | preserve subject identity and visual details from the social post image',
        },
    ]);
});

test('generated image tool still rejects action edit without reference inputs', () => {
    const built = __generateImageFromIntentTest.buildImplicitImageReferenceInputs({
        explicitReferenceImages: [],
        uploadedTaskImages: [],
        context: {},
    });

    assert.throws(
        () => __generateImageFromIntentTest.resolveReferenceInputsForAction({
            requestedAction: 'edit',
            builtReferenceInputs: built,
        }),
        /action=edit requires a source or reference image input/,
    );
});
