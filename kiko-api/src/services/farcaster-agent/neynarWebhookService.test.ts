import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {
  buildNeynarMentionSubscription,
  normalizeNeynarWebhookMention,
  verifyNeynarWebhookSignature,
} from './neynarWebhookService.js';

test('buildNeynarMentionSubscription uses documented fid filter for mentions', () => {
  assert.deepEqual(buildNeynarMentionSubscription(1576616, '@kikoapp'), {
    'cast.created': {
      mentioned_fids: [1576616],
    },
  });
});

test('buildNeynarMentionSubscription does not require a bot handle', () => {
  assert.deepEqual(buildNeynarMentionSubscription(1576616), {
    'cast.created': {
      mentioned_fids: [1576616],
    },
  });
});

test('verifyNeynarWebhookSignature accepts the documented sha512 hex signature', () => {
  const body = JSON.stringify({
    type: 'cast.created',
    created_at: 1708025006,
    data: {
      object: 'cast',
      hash: '0xfe7908021a4c0d36d5f7359975f4bf6eb9fbd6f2',
      thread_hash: '0xfe7908021a4c0d36d5f7359975f4bf6eb9fbd6f2',
      parent_hash: null,
      parent_author: { fid: null },
      author: { fid: 234506, username: 'balzgolf' },
      text: '@neynar LFG',
      timestamp: '2024-02-15T19:23:22.000Z',
      mentioned_profiles: [{ fid: 1576616 }],
    },
  });
  const secret = 'webhook-secret';
  const signature = crypto.createHmac('sha512', secret).update(body).digest('hex');

  assert.equal(verifyNeynarWebhookSignature(signature, body, secret), true);
  assert.equal(verifyNeynarWebhookSignature(signature, body, 'wrong-secret'), false);
});

test('normalizeNeynarWebhookMention maps mention and reply casts into the worker shape', () => {
  const mention = normalizeNeynarWebhookMention({
    type: 'cast.created',
    created_at: 1708025006,
    data: {
      object: 'cast',
      hash: '0xfe7908021a4c0d36d5f7359975f4bf6eb9fbd6f2',
      thread_hash: '0xfe7908021a4c0d36d5f7359975f4bf6eb9fbd6f2',
      parent_hash: null,
      parent_author: { fid: null },
      author: { fid: 234506, username: 'balzgolf' },
      text: '@kikoapp LFG',
      timestamp: '2024-02-15T19:23:22.000Z',
      mentioned_profiles: [{ fid: 1576616 }],
    },
  }, 1576616);

  assert.ok(mention);
  assert.equal(mention?.notificationType, 'mentions');
  assert.equal(mention?.castHash, '0xfe7908021a4c0d36d5f7359975f4bf6eb9fbd6f2');
  assert.equal(mention?.authorFid, 234506);
  assert.equal(mention?.rootCastHash, '0xfe7908021a4c0d36d5f7359975f4bf6eb9fbd6f2');

  const reply = normalizeNeynarWebhookMention({
    type: 'cast.created',
    created_at: 1708025006,
    data: {
      object: 'cast',
      hash: '0xabc',
      thread_hash: '0xabc',
      parent_hash: '0xparent',
      parent_author: { fid: 1576616 },
      author: { fid: 234506, username: 'balzgolf' },
      text: '@kikoapp thanks',
      timestamp: '2024-02-15T19:23:22.000Z',
      mentioned_profiles: [],
    },
  }, 1576616);

  assert.ok(reply);
  assert.equal(reply?.notificationType, 'replies');
  assert.equal(reply?.parentAuthorFid, 1576616);
  assert.equal(reply?.parentHash, '0xparent');
});

test('normalizeNeynarWebhookMention accepts reply-thread mentions without profile objects', () => {
  const mentionWithFids = normalizeNeynarWebhookMention({
    type: 'cast.created',
    created_at: 1708025006,
    data: {
      object: 'cast',
      hash: '0xreplymention',
      thread_hash: '0xroot',
      parent_hash: '0xparent',
      parent_author: { fid: 877398 },
      author: { fid: 234506, username: 'balzgolf' },
      text: '@kikoapp are you there',
      timestamp: '2024-02-15T19:23:22.000Z',
      mentioned_fids: [1576616],
    },
  }, 1576616);

  assert.ok(mentionWithFids);
  assert.equal(mentionWithFids?.notificationType, 'mentions');
  assert.equal(mentionWithFids?.parentAuthorFid, 877398);

  const mentionWithObjects = normalizeNeynarWebhookMention({
    type: 'cast.created',
    created_at: 1708025006,
    data: {
      object: 'cast',
      hash: '0xreplymention2',
      thread_hash: '0xroot',
      parent_hash: '0xparent',
      parent_author_fid: 877398,
      author: { fid: 234506, username: 'balzgolf' },
      text: '@kikoapp are you there',
      timestamp: '2024-02-15T19:23:22.000Z',
      mentions: [{ fid: 1576616 }],
    },
  }, 1576616);

  assert.ok(mentionWithObjects);
  assert.equal(mentionWithObjects?.notificationType, 'mentions');
  assert.equal(mentionWithObjects?.parentAuthorFid, 877398);
});
