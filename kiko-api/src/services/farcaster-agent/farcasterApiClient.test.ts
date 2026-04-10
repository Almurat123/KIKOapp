import assert from 'node:assert/strict';
import test from 'node:test';
import { parseNotificationEvents } from './farcasterApiClient.js';

test('parseNotificationEvents extracts mention notifications into internal mention events', () => {
  const events = parseNotificationEvents({
    notifications: [
      {
        type: 'mentions',
        most_recent_timestamp: '2026-04-10T10:00:00.000Z',
        mentions: [
          {
            user: { fid: 123, username: 'alice' },
            cast: {
              hash: '0xabc',
              text: '@kikoapp what do you think about BTC?',
              parent_hash: '0xparent',
              parent_author: { fid: 999 },
              thread_hash: '0xroot',
              timestamp: '2026-04-10T09:59:00.000Z',
            },
          },
        ],
      },
    ],
  });

  assert.deepEqual(events, [
    {
      eventId: 'farcaster:mentions:0xabc',
      notificationType: 'mentions',
      castHash: '0xabc',
      text: '@kikoapp what do you think about BTC?',
      authorFid: 123,
      authorUsername: 'alice',
      parentHash: '0xparent',
      parentAuthorFid: 999,
      rootCastHash: '0xroot',
      occurredAt: '2026-04-10T09:59:00.000Z',
    },
  ]);
});

test('parseNotificationEvents extracts reply notifications and falls back to cast fields', () => {
  const events = parseNotificationEvents({
    notifications: [
      {
        type: 'replies',
        most_recent_timestamp: '2026-04-10T11:00:00.000Z',
        replies: [
          {
            cast: {
              hash: '0xdef',
              text: 'following up here',
              parent_hash: '0xabc',
              author: { fid: 321, username: 'bob' },
            },
          },
        ],
      },
    ],
  });

  assert.deepEqual(events, [
    {
      eventId: 'farcaster:replies:0xdef',
      notificationType: 'replies',
      castHash: '0xdef',
      text: 'following up here',
      authorFid: 321,
      authorUsername: 'bob',
      parentHash: '0xabc',
      parentAuthorFid: null,
      rootCastHash: '0xabc',
      occurredAt: '2026-04-10T11:00:00.000Z',
    },
  ]);
});
