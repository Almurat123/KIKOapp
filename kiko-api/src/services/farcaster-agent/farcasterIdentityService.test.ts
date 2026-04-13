import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildFarcasterProfileUrl,
  extractPrivyFarcasterAccount,
  normalizeFarcasterUsername,
} from './farcasterIdentityService.js';

test('normalizeFarcasterUsername strips leading at-sign and blanks', () => {
  assert.equal(normalizeFarcasterUsername('@kikoapp'), 'kikoapp');
  assert.equal(normalizeFarcasterUsername('  kikoapp  '), 'kikoapp');
  assert.equal(normalizeFarcasterUsername(''), null);
});

test('buildFarcasterProfileUrl returns warpcast profile url for a username', () => {
  assert.equal(buildFarcasterProfileUrl('@kikoapp'), 'https://warpcast.com/kikoapp');
  assert.equal(buildFarcasterProfileUrl(null), null);
});

test('extractPrivyFarcasterAccount trusts direct farcaster linked accounts', () => {
  const payload = extractPrivyFarcasterAccount({
    linkedAccounts: [
      { type: 'wallet', address: '0xabc' },
      { type: 'farcaster', fid: 1576616, username: '@kikoapp' },
    ],
  });

  assert.deepEqual(payload, {
    farcasterFid: 1576616,
    username: 'kikoapp',
  });
});

test('extractPrivyFarcasterAccount trusts farcaster wallet-shaped linked accounts', () => {
  const payload = extractPrivyFarcasterAccount({
    linkedAccounts: [
      { type: 'wallet', chainType: 'farcaster', fid: '1576616', username: 'kikoapp' },
    ],
  });

  assert.deepEqual(payload, {
    farcasterFid: 1576616,
    username: 'kikoapp',
  });
});

test('extractPrivyFarcasterAccount returns nulls when no linked farcaster account exists', () => {
  const payload = extractPrivyFarcasterAccount({
    linkedAccounts: [{ type: 'wallet', address: '0xabc' }],
  });

  assert.deepEqual(payload, {
    farcasterFid: null,
    username: null,
  });
});
