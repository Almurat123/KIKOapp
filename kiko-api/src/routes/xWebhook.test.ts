import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from '../config/env.js';
import {
  computeXWebhookCrcResponseToken,
  computeXWebhookSignature,
  extractDirectMessageEvents,
  extractMentionEvents,
  verifyXWebhookSignature,
} from './xWebhook.js';

test('computeXWebhookCrcResponseToken returns sha256-prefixed base64 HMAC', () => {
  const token = 'crc-token';
  const secret = 'webhook-secret';
  assert.equal(
    computeXWebhookCrcResponseToken(token, secret),
    'sha256=X+ql06XI20quiNnDL1Ao6MNN/RJxzLHGrVHLcsA8Yz8=',
  );
});

test('verifyXWebhookSignature validates raw body HMAC', () => {
  const rawBody = JSON.stringify({ test: true, id: '123' });
  const secret = 'webhook-secret';
  const signature = computeXWebhookSignature(rawBody, secret);

  assert.equal(verifyXWebhookSignature(signature, rawBody, secret), true);
  assert.equal(verifyXWebhookSignature(signature, rawBody, 'wrong-secret'), false);
});

test('extractMentionEvents keeps inbound mentions and filters bot-authored posts', () => {
  const originalUsername = env.x.botUsername;
  const originalUserId = env.x.botUserId;
  env.x.botUsername = 'kikoapp';
  env.x.botUserId = '999';

  const events = extractMentionEvents({
    tweet_create_events: [
      {
        id_str: '1',
        text: '@kikoapp buy pepe',
        user: { id_str: '111', screen_name: 'alice' },
        conversation_id_str: '42',
      },
      {
        id_str: '2',
        text: 'plain post',
        user: { id_str: '222', screen_name: 'bob' },
      },
      {
        id_str: '3',
        text: '@kikoapp status update',
        user: { id_str: '999', screen_name: 'kikoapp' },
      },
    ],
  });

  env.x.botUsername = originalUsername;
  env.x.botUserId = originalUserId;

  assert.equal(events.length, 1);
  assert.deepEqual(events[0], {
    id: '1',
    text: '@kikoapp buy pepe',
    authorId: '111',
    authorUsername: 'alice',
    conversationId: '42',
    createdAt: null,
  });
});

test('extractDirectMessageEvents keeps inbound DMs to the bot only', () => {
  const originalUserId = env.x.botUserId;
  env.x.botUserId = '999';

  const events = extractDirectMessageEvents({
    users: {
      '111': { id_str: '111', screen_name: 'alice' },
      '999': { id_str: '999', screen_name: 'kikoapp' },
    },
    direct_message_events: [
      {
        id: '10',
        created_timestamp: '1710000000000',
        message_create: {
          sender_id: '111',
          target: { recipient_id: '999' },
          message_data: { text: 'swap 1 eth to pepe' },
        },
      },
      {
        id: '11',
        created_timestamp: '1710000001000',
        message_create: {
          sender_id: '999',
          target: { recipient_id: '111' },
          message_data: { text: 'reply from bot' },
        },
      },
    ],
  });

  env.x.botUserId = originalUserId;

  assert.equal(events.length, 1);
  assert.deepEqual(events[0], {
    id: '10',
    text: 'swap 1 eth to pepe',
    senderId: '111',
    senderUsername: 'alice',
    dmConversationId: '999',
    createdAt: '1710000000000',
  });
});
