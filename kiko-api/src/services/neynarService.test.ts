import assert from 'node:assert/strict';
import test from 'node:test';
import { buildNeynarCastReplyParams, normalizeNeynarCastHash } from './neynarService.js';

test('buildNeynarCastReplyParams uses NeynarAPIClient wrapper keys', () => {
  assert.deepEqual(buildNeynarCastReplyParams({
    signerUuid: 'signer-uuid',
    text: ' gm ',
    parentHash: '0xparent',
    parentAuthorFid: 1576616,
    idem: 'reply-idem',
  }), {
    signerUuid: 'signer-uuid',
    text: 'gm',
    parent: '0xparent',
    parentAuthorFid: 1576616,
    idem: 'reply-idem',
  });
});

test('normalizeNeynarCastHash rejects malformed cast hashes before publish', () => {
  assert.equal(normalizeNeynarCastHash('a2827859051455dd5cb7b0c1b33bb9cf4a8b0edb'), '0xa2827859051455dd5cb7b0c1b33bb9cf4a8b0edb');
  assert.equal(normalizeNeynarCastHash('0xA2827859051455DD5CB7B0C1B33BB9CF4A8B0EDB'), '0xa2827859051455dd5cb7b0c1b33bb9cf4a8b0edb');
  assert.equal(normalizeNeynarCastHash('0XA2827859051455DD5CB7B0C1B33BB9CF4A8B0EDB'), '0xa2827859051455dd5cb7b0c1b33bb9cf4a8b0edb');
  assert.equal(normalizeNeynarCastHash('synthetic-neynar-webhook-test'), null);
  assert.equal(normalizeNeynarCastHash('0xparent'), null);
});
