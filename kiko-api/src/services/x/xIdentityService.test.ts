import assert from 'node:assert/strict';
import test from 'node:test';
import { buildXProfileUrl, extractPrivyXAccount, normalizeXUsername, serializeXContext } from './xIdentityService.js';

test('normalizeXUsername strips leading at-sign and blanks', () => {
  assert.equal(normalizeXUsername('@kikoapp'), 'kikoapp');
  assert.equal(normalizeXUsername('  kikoapp  '), 'kikoapp');
  assert.equal(normalizeXUsername(''), null);
});

test('buildXProfileUrl returns x.com profile url for a username', () => {
  assert.equal(buildXProfileUrl('@kikoapp'), 'https://x.com/kikoapp');
  assert.equal(buildXProfileUrl(null), null);
});

test('serializeXContext exposes safe x linkage state', () => {
  const linkedAt = new Date('2026-04-08T00:00:00.000Z');
  const dmOptInAt = new Date('2026-04-08T01:00:00.000Z');
  const payload = serializeXContext({
    xUserId: '123',
    xUsername: 'kikoapp',
    xLinkedAt: linkedAt,
    xDmOptInAt: dmOptInAt,
    xNotificationsMutedAt: null,
  });

  assert.equal(payload.xUserId, '123');
  assert.equal(payload.username, 'kikoapp');
  assert.equal(payload.profileUrl, 'https://x.com/kikoapp');
  assert.equal(payload.linkedAt, linkedAt.toISOString());
  assert.equal(payload.dmOptInAt, dmOptInAt.toISOString());
  assert.equal(payload.notificationsMuted, false);
});

test('extractPrivyXAccount only trusts linked twitter/x accounts', () => {
  const payload = extractPrivyXAccount({
    linkedAccounts: [
      { type: 'wallet', address: '0xabc' },
      { type: 'twitter', subject: '999', username: '@alice' },
    ],
  });

  assert.deepEqual(payload, {
    xUserId: '999',
    username: 'alice',
  });
});

test('extractPrivyXAccount returns nulls when no linked x account exists', () => {
  const payload = extractPrivyXAccount({
    linkedAccounts: [{ type: 'wallet', address: '0xabc' }],
  });

  assert.deepEqual(payload, {
    xUserId: null,
    username: null,
  });
});
