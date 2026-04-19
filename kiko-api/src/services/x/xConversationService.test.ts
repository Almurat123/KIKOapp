import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildXSessionTitle,
  MAX_DM_ROUND_TRIPS,
  shouldRolloverDmConversation,
} from './xConversationService.js';
import {
  buildSocialAgentSessionTitle,
  normalizeSocialAgentSessionTitlePrefix,
} from '../socialAgentSessionTitle.js';

test('buildSocialAgentSessionTitle formats time, platform, and cleaned message prefix', () => {
  const createdAt = new Date(2026, 3, 20, 22, 0);

  assert.equal(
    buildSocialAgentSessionTitle({
      platform: 'farcaster',
      text: '@kikoapp generate a photo of a glass city',
      createdAt,
    }),
    '22:00 farcaster generate a photo of a glass city',
  );
  assert.equal(
    normalizeSocialAgentSessionTitlePrefix('@kikoapp ' + 'a'.repeat(40), 12),
    'aaaaaaaaaaaa...',
  );
});

test('buildXSessionTitle uses social-agent title format with message fallback', () => {
  const createdAt = new Date(2026, 3, 20, 22, 0);

  assert.equal(
    buildXSessionTitle({
      channel: 'mention',
      username: 'kiko_user',
      initialMessageText: '@kikoapp summarize this wallet',
      createdAt,
    }),
    '22:00 x summarize this wallet',
  );
  assert.equal(
    buildXSessionTitle({ channel: 'dm', username: 'kiko_user', createdAt }),
    '22:00 x @kiko_user',
  );
});

test('shouldRolloverDmConversation only rolls over DM sessions at configured threshold', () => {
  assert.equal(shouldRolloverDmConversation({ channel: 'mention', roundTripCount: MAX_DM_ROUND_TRIPS }), false);
  assert.equal(shouldRolloverDmConversation({ channel: 'dm', roundTripCount: MAX_DM_ROUND_TRIPS - 1 }), false);
  assert.equal(shouldRolloverDmConversation({ channel: 'dm', roundTripCount: MAX_DM_ROUND_TRIPS }), true);
});
