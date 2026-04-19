import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFarcasterSessionTitle } from './farcasterConversationService.js';

test('buildFarcasterSessionTitle uses time, farcaster platform, and cast prefix', () => {
  const createdAt = new Date(2026, 3, 20, 22, 0);

  assert.equal(
    buildFarcasterSessionTitle({
      username: 'kiko_user',
      initialMessageText: '@kikoapp can you generate a cyberpunk cat',
      createdAt,
    }),
    '22:00 farcaster can you generate a cyberpunk cat',
  );
  assert.equal(
    buildFarcasterSessionTitle({ username: 'kiko_user', createdAt }),
    '22:00 farcaster @kiko_user',
  );
});
