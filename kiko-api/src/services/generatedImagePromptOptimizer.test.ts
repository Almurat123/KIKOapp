import assert from 'node:assert/strict';
import test from 'node:test';
import { optimizeGeneratedImagePrompt } from './generatedImagePromptOptimizer.js';

test('optimizeGeneratedImagePrompt builds a controlled provider prompt and summary', () => {
    const optimized = optimizeGeneratedImagePrompt({
        user_intent: 'Create a cyberpunk product poster for a transparent mechanical keyboard launch',
        style_hint: 'cinematic cyberpunk ad',
        aspect_ratio: '16:9',
        subject: 'a transparent mechanical keyboard floating above a reflective pedestal',
        scene: 'rain-soaked neon city backdrop with subtle volumetric haze',
        composition: 'hero shot with centered product and strong depth',
        constraints: ['show the full keyboard layout', 'leave clean negative space for a headline'],
        negative_constraints: ['no hands', 'no extra products'],
    });

    assert.equal(optimized.spec.editOrGenerate, 'generate');
    assert.equal(optimized.spec.aspectRatio, '16:9');
    assert.match(optimized.providerPrompt, /Subject:/);
    assert.match(optimized.providerPrompt, /Hard constraints:/);
    assert.match(optimized.providerPrompt, /Avoid:/);
    assert.doesNotMatch(optimized.providerPrompt, /\bno watermark\b/i);
    assert.match(optimized.providerPrompt, /provider-generated watermark/);
    assert.match(optimized.optimizedPromptSummary, /keyboard/i);
});

test('optimizeGeneratedImagePrompt infers edit mode from reference images', () => {
    const optimized = optimizeGeneratedImagePrompt({
        user_intent: 'Make this image feel like a premium poster',
        reference_images: [{ description: 'the existing uploaded visual' }],
    });

    assert.equal(optimized.spec.editOrGenerate, 'edit');
    assert.equal(optimized.spec.referenceImages.length, 1);
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
