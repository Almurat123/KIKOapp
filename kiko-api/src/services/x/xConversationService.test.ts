import assert from 'node:assert/strict';
import test from 'node:test';
import { buildXSessionTitle, MAX_DM_ROUND_TRIPS, shouldRolloverDmConversation } from './xConversationService.js';

test('buildXSessionTitle reflects channel and username', () => {
  assert.equal(buildXSessionTitle({ channel: 'dm', username: 'kiko_user' }), 'X DM @kiko_user');
  assert.equal(buildXSessionTitle({ channel: 'mention', username: 'kiko_user' }), 'X Mention @kiko_user');
});

test('shouldRolloverDmConversation only rolls over DM sessions at configured threshold', () => {
  assert.equal(shouldRolloverDmConversation({ channel: 'mention', roundTripCount: MAX_DM_ROUND_TRIPS }), false);
  assert.equal(shouldRolloverDmConversation({ channel: 'dm', roundTripCount: MAX_DM_ROUND_TRIPS - 1 }), false);
  assert.equal(shouldRolloverDmConversation({ channel: 'dm', roundTripCount: MAX_DM_ROUND_TRIPS }), true);
});
