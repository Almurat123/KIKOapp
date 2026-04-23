import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import {
  __chatImageUploadsTest,
  inferPublicImageContentTypeFromExtension,
  inferPublicImageExtensionFromContentType,
  readObjectKeyImageExtension,
  resolveGeneratedImagePublicUrl,
  transcodeImageBufferForPublicDelivery,
} from './chatImageUploads.js';

test('generated-image public object keys use a jpg suffix for jpeg content', () => {
  const objectKey = __chatImageUploadsTest.buildGeneratedPublicObjectKey(
    'did:privy:test',
    'message-123',
    'image/jpeg',
  );

  assert.match(
    objectKey,
    /chat-uploads\/generated-public\/farcaster\/did_privy_test\/\d{4}-\d{2}-\d{2}\/message-123\.jpg$/,
  );
});

test('public generated-image proxy URLs include hotlink-ok to bypass Cloudflare hotlink protection', () => {
  const url = __chatImageUploadsTest.buildPublicObjectUrl(
    'chat-uploads/generated-public/farcaster/did_privy_test/2026-04-20/message-123.png',
  );

  assert.equal(
    url,
    'https://api.kikoapp.app/api/chat/generated-images/public/hotlink-ok/chat-uploads/generated-public/farcaster/did_privy_test/2026-04-20/message-123.png?v=message-123',
  );
});

test('public image extension helpers normalize jpeg aliases', () => {
  assert.equal(inferPublicImageExtensionFromContentType('image/jpeg'), 'jpg');
  assert.equal(inferPublicImageExtensionFromContentType('image/png'), 'png');
  assert.equal(inferPublicImageExtensionFromContentType('image/webp'), 'webp');
  assert.equal(readObjectKeyImageExtension('path/to/image.jpeg'), 'jpg');
  assert.equal(readObjectKeyImageExtension('path/to/image.jpg'), 'jpg');
  assert.equal(readObjectKeyImageExtension('path/to/image.png'), 'png');
  assert.equal(inferPublicImageContentTypeFromExtension('jpg'), 'image/jpeg');
  assert.equal(inferPublicImageContentTypeFromExtension('jpeg'), 'image/jpeg');
  assert.equal(inferPublicImageContentTypeFromExtension('png'), 'image/png');
});

test('legacy png-key jpeg bytes can be transcoded to a real png for public delivery', async () => {
  const jpegBuffer = await sharp({
    create: {
      width: 8,
      height: 8,
      channels: 3,
      background: { r: 24, g: 48, b: 96 },
    },
  }).jpeg({ quality: 90 }).toBuffer();

  const transcoded = await transcodeImageBufferForPublicDelivery({
    body: jpegBuffer,
    targetContentType: 'image/png',
  });
  const metadata = await sharp(transcoded).metadata();

  assert.equal(metadata.format, 'png');
  assert.equal(transcoded.length > 0, true);
});

test('public generated-image loader strips the hotlink-ok proxy prefix before object-key validation', () => {
  assert.equal(
    __chatImageUploadsTest.normalizePublicGeneratedImageProxyPath(
      'hotlink-ok/chat-uploads/generated-public/farcaster/did_privy_test/2026-04-20/message-123.png',
    ),
    'chat-uploads/generated-public/farcaster/did_privy_test/2026-04-20/message-123.png',
  );
});

test('generated-image public URL resolution recovers a proxy image URL from legacy publicUrl-only state', () => {
  assert.equal(
    resolveGeneratedImagePublicUrl({
      publicUrl: 'https://cdn.kikoapp.app/chat-uploads/generated-public/farcaster/did_privy_test/2026-04-20/message-123.png',
    }),
    'https://api.kikoapp.app/api/chat/generated-images/public/hotlink-ok/chat-uploads/generated-public/farcaster/did_privy_test/2026-04-20/message-123.png?v=message-123',
  );
});
