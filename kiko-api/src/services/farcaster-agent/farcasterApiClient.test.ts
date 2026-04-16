import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHubMentionEvents, shouldUseNeynarMentionPolling } from './farcasterApiClient.js';

test('parseHubMentionEvents extracts Hub cast mentions into internal mention events', () => {
  const events = parseHubMentionEvents({
    messages: [
      {
        data: {
          type: 1,
          fid: 123,
          timestamp: 166530104,
          network: 1,
          castAddBody: {
            embedsDeprecated: [],
            mentions: [9000],
            parentCastId: {
              fid: 999,
              hash: Uint8Array.from(Buffer.from('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'hex')),
            },
            parentUrl: undefined,
            text: '@kikoapp what do you think about BTC?',
            mentionsPositions: [0],
            embeds: [],
            type: 0,
          },
        },
        hash: Uint8Array.from(Buffer.from('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'hex')),
        hashScheme: 1,
        signature: Uint8Array.from(Buffer.alloc(64, 1)),
        signatureScheme: 1,
        signer: Uint8Array.from(Buffer.alloc(32, 2)),
        dataBytes: Uint8Array.from(Buffer.alloc(0)),
      },
    ] as any,
  } as any);

  assert.deepEqual(events, [
    {
      eventId: 'farcaster:mention:0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      notificationType: 'mentions',
      castHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      text: '@kikoapp what do you think about BTC?',
      authorFid: 123,
      authorUsername: null,
      parentHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      parentAuthorFid: 999,
      rootCastHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      occurredAt: '2026-04-12T10:21:44.000Z',
    },
  ]);
});

test('parseHubMentionEvents skips non-cast messages', () => {
  const events = parseHubMentionEvents({
    messages: [
      {
        data: {
          type: 11,
          fid: 123,
          timestamp: 166530104,
          network: 1,
          userDataBody: {
            type: 6,
            value: 'alice',
          },
        },
        hash: Uint8Array.from(Buffer.from('cccccccccccccccccccccccccccccccccccccccc', 'hex')),
        hashScheme: 1,
        signature: Uint8Array.from(Buffer.alloc(64, 3)),
        signatureScheme: 1,
        signer: Uint8Array.from(Buffer.alloc(32, 4)),
        dataBytes: Uint8Array.from(Buffer.alloc(0)),
      },
    ] as any,
  } as any);

  assert.deepEqual(events, []);
});

test('parseHubMentionEvents passes through normalized mention events', () => {
  const events = parseHubMentionEvents({
    messages: [],
    events: [
      {
        eventId: 'farcaster:neynar:mentions:0x1234',
        notificationType: 'mentions',
        castHash: '0x1234',
        text: '@kikoapp hello',
        authorFid: 123,
        authorUsername: 'alice',
        parentHash: null,
        parentAuthorFid: null,
        rootCastHash: '0x1234',
        occurredAt: '2026-04-15T06:00:00.000Z',
      },
    ],
  } as any);

  assert.deepEqual(events, [
    {
      eventId: 'farcaster:neynar:mentions:0x1234',
      notificationType: 'mentions',
      castHash: '0x1234',
      text: '@kikoapp hello',
      authorFid: 123,
      authorUsername: 'alice',
      parentHash: null,
      parentAuthorFid: null,
      rootCastHash: '0x1234',
      occurredAt: '2026-04-15T06:00:00.000Z',
    },
  ]);
});

test('shouldUseNeynarMentionPolling disables Neynar reads when webhook is enabled', () => {
  assert.equal(shouldUseNeynarMentionPolling(true), false);
  assert.equal(shouldUseNeynarMentionPolling(false), true);
});
