import assert from 'node:assert/strict';
import test from 'node:test';
import { buildNeynarCastReplyParams } from './neynarService.js';

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
