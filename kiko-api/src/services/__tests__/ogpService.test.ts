import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPreview, buildUnavailablePreview, classifyPreviewTarget, isGenericShellPreview } from '../ogpService.js';

test('classifyPreviewTarget identifies farcaster mini app links', () => {
    assert.equal(
        classifyPreviewTarget('https://farcaster.xyz/miniapps/0195dd17-b3f4-963d-ad9b-56dd5b898ff2/fundraider'),
        'miniapp',
    );
});

test('classifyPreviewTarget identifies x links', () => {
    assert.equal(classifyPreviewTarget('https://x.com/openai/status/1'), 'x');
});

test('classifyPreviewTarget identifies direct media links', () => {
    assert.equal(classifyPreviewTarget('https://example.com/preview.png'), 'media');
});

test('buildPreview degrades to compact when image is missing', () => {
    const preview = buildPreview({
        canonicalUrl: 'https://example.com',
        destinationUrl: 'https://example.com',
        title: 'Example',
        siteName: 'Example',
        source: 'html',
    });

    assert.equal(preview.kind, 'compact');
    assert.equal(preview.status, 'degraded');
    assert.equal(preview.image, undefined);
});

test('buildPreview creates miniapp previews with stable kind', () => {
    const preview = buildPreview({
        canonicalUrl: 'https://farcaster.xyz/miniapps/app',
        destinationUrl: 'https://app.example.com',
        title: 'Fundraider',
        description: 'Open this Farcaster Mini App',
        siteName: 'Farcaster Mini App',
        type: 'miniapp',
        kind: 'miniapp',
        status: 'degraded',
        source: 'fc-meta',
    });

    assert.equal(preview.kind, 'miniapp');
    assert.equal(preview.status, 'degraded');
    assert.equal(preview.destinationUrl, 'https://app.example.com');
});

test('isGenericShellPreview flags empty generic farcaster shells', () => {
    assert.equal(
        isGenericShellPreview({ title: 'Farcaster', siteName: 'Farcaster' }),
        true,
    );
});

test('buildUnavailablePreview returns stable unavailable payload', () => {
    const preview = buildUnavailablePreview('https://example.com');
    assert.equal(preview.kind, 'unavailable');
    assert.equal(preview.status, 'unavailable');
    assert.equal(preview.destinationUrl, 'https://example.com');
});
