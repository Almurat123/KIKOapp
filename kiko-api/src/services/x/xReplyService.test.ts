import assert from 'node:assert/strict';
import test from 'node:test';

import { __xReplyServiceTest, sanitizePublicXReplyText } from './xReplyService.js';

test('sanitizePublicXReplyText strips KIKO share and OGP links from public replies', () => {
  const text = sanitizePublicXReplyText(
    'I replied in KIKO. View it here: https://api.kikoapp.app/x/share/test-token',
  );

  assert.equal(text.includes('https://'), false);
  assert.equal(text.includes('kikoapp.app'), false);
  assert.equal(text, 'I replied in KIKO. View it here:');
});

test('sanitizePublicXReplyText strips generated image URLs and bare domains', () => {
  const text = sanitizePublicXReplyText(
    'Generated. https://api.kikoapp.app/api/chat/generated-images/public/test.png Also see dexscreener.com/base/abc',
  );

  assert.equal(text.includes('http'), false);
  assert.equal(text.includes('.png'), false);
  assert.equal(text.includes('dexscreener.com'), false);
  assert.equal(text, 'Generated. Also see');
});

test('sanitizePublicXReplyText preserves markdown link text without the URL', () => {
  const text = sanitizePublicXReplyText('Read the [wallet summary](https://kikoapp.app/chat/abc) before trading.');

  assert.equal(text, 'Read the wallet summary before trading.');
});

test('sanitizePublicXReplyText falls back when the reply is only a link', () => {
  const text = sanitizePublicXReplyText('https://api.kikoapp.app/x/share/test-token');

  assert.equal(text.includes('http'), false);
  assert.match(text, /processed this in KIKO/);
});

test('sanitizePublicXReplyText truncates long public replies under X budget', () => {
  const text = sanitizePublicXReplyText('A'.repeat(400));

  assert.equal(text.length <= 260, true);
  assert.equal(text.endsWith('...'), true);
});

test('generated-image ready replies require uploaded media when media URLs are present', () => {
  assert.equal(
    __xReplyServiceTest.shouldRequireUploadedMedia({
      originalText: 'Generated.',
      mediaUrls: ['https://api.kikoapp.app/image.png'],
    }),
    true,
  );
  assert.equal(
    __xReplyServiceTest.shouldRequireUploadedMedia({
      originalText: 'I found this token summary.',
      mediaUrls: ['https://api.kikoapp.app/image.png'],
    }),
    false,
  );
});
