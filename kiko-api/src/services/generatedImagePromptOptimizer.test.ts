import assert from 'node:assert/strict';
import test from 'node:test';
import { optimizeGeneratedImagePrompt } from './generatedImagePromptOptimizer.js';

test('optimizeGeneratedImagePrompt builds a controlled provider prompt and summary', () => {
    const optimized = optimizeGeneratedImagePrompt({
        user_intent: 'Create a cyberpunk product poster for a transparent mechanical keyboard launch',
        artifact_type: 'product launch poster',
        style_hint: 'cinematic cyberpunk ad',
        aspect_ratio: '16:9',
        subject: 'a transparent mechanical keyboard floating above a reflective pedestal',
        scene: 'rain-soaked neon city backdrop with subtle volumetric haze',
        key_details: 'clear translucent keycaps, brushed metal switch plate, crisp reflections',
        composition: 'hero shot with centered product and strong depth',
        constraints: ['show the full keyboard layout', 'leave clean negative space for a headline'],
        negative_constraints: ['no hands', 'no extra products'],
    });

    assert.equal(optimized.spec.editOrGenerate, 'generate');
    assert.equal(optimized.spec.artifactType, 'product launch poster');
    assert.equal(optimized.spec.aspectRatio, '16:9');
    assert.match(optimized.providerPrompt, /Scene\/background:/);
    assert.match(optimized.providerPrompt, /Subject:/);
    assert.match(optimized.providerPrompt, /Key details:/);
    assert.match(optimized.providerPrompt, /Hard constraints:/);
    assert.match(optimized.providerPrompt, /Avoid:/);
    assert.match(optimized.providerPrompt, /Output surface:/);
    assert.doesNotMatch(optimized.providerPrompt, /\bno watermark\b/i);
    assert.match(optimized.providerPrompt, /provider-generated watermark/);
    assert.match(optimized.optimizedPromptSummary, /keyboard/i);
});

test('optimizeGeneratedImagePrompt infers edit mode from reference images', () => {
    const optimized = optimizeGeneratedImagePrompt({
        user_intent: 'Make this image feel like a premium poster',
        reference_images: [{ description: 'the existing uploaded visual' }],
    });

    assert.equal(optimized.spec.action, 'auto');
    assert.equal(optimized.spec.editOrGenerate, 'edit');
    assert.equal(optimized.spec.referenceImages.length, 1);
});

test('optimizeGeneratedImagePrompt honors Responses-style forced image actions', () => {
    const forcedGenerate = optimizeGeneratedImagePrompt({
        user_intent: 'Create a new poster inspired by the previous image',
        action: 'generate',
        edit_or_generate: 'edit',
        reference_images: [{ description: 'previous image' }],
    });
    assert.equal(forcedGenerate.spec.action, 'generate');
    assert.equal(forcedGenerate.spec.editOrGenerate, 'generate');

    const forcedEdit = optimizeGeneratedImagePrompt({
        user_intent: 'Make this look realistic',
        action: 'edit',
    });
    assert.equal(forcedEdit.spec.action, 'edit');
    assert.equal(forcedEdit.spec.editOrGenerate, 'edit');
});

test('optimizeGeneratedImagePrompt synthesizes user_intent from structured image fields when missing', () => {
    const optimized = optimizeGeneratedImagePrompt({
        user_intent: '',
        subject: 'full moon in the night sky',
        scene: 'serene stars above a quiet ocean horizon',
        style: 'cinematic and ethereal',
        composition: 'wide atmospheric frame with the moon as focal point',
        aspect_ratio: '16:9',
    });

    assert.equal(optimized.spec.subject, 'full moon in the night sky');
    assert.equal(optimized.spec.scene, 'serene stars above a quiet ocean horizon');
    assert.equal(optimized.spec.aspectRatio, '16:9');
    assert.match(optimized.providerPrompt, /full moon in the night sky/i);
});

test('optimizeGeneratedImagePrompt applies OpenAI edit preserve and exact text structure', () => {
    const optimized = optimizeGeneratedImagePrompt({
        user_intent: 'Put KIKO on the horse image as a readable badge',
        artifact_type: 'image edit',
        edit_or_generate: 'edit',
        reference_images: [
            {
                description: 'Image 1: horse photo',
                purpose: 'source scene and subject identity',
            },
        ],
        subject: 'the same horse from the source image wearing a small badge',
        scene: 'the original source scene',
        change_request: 'add a small badge on the horse with the requested text',
        preserve_elements: [
            'horse identity and pose',
            'original background',
            'camera angle and lighting',
        ],
        exact_text: 'KIKO',
        text_placement: 'on the badge, once, clearly readable',
        typography: 'bold clean sans-serif, high contrast',
        constraints: ['badge follows the horse perspective and lighting'],
        negative_constraints: ['no extra letters', 'no unrelated redesign'],
    });

    assert.equal(optimized.spec.editOrGenerate, 'edit');
    assert.match(optimized.providerPrompt, /Input image roles: reference 1/);
    assert.match(optimized.providerPrompt, /Change: add a small badge/);
    assert.match(optimized.providerPrompt, /Preserve: horse identity and pose; original background; camera angle and lighting/);
    assert.match(optimized.providerPrompt, /Text: "KIKO"; rendered verbatim; placement: on the badge, once, clearly readable; typography: bold clean sans-serif, high contrast/);
    assert.match(optimized.providerPrompt, /render requested text verbatim, once, with no extra characters/);
});
