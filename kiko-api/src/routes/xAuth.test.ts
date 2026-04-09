import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAuthorizeUrl,
  buildOAuthStateCookieValue,
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
  isAuthorizedXBotAuthInitiator,
  matchesExpectedXBotIdentity,
  verifyOAuthStateCookieValue,
} from './xAuth.js';

test('generateCodeVerifier returns a url-safe verifier', () => {
  const verifier = generateCodeVerifier();
  assert.equal(verifier.length >= 43, true);
  assert.match(verifier, /^[A-Za-z0-9_-]+$/);
});

test('generateCodeChallenge is stable for a verifier', () => {
  const verifier = '2oxSM9wM54z5Qr3mBRRVSybRO4JDgOPyPmVqIz60I_I';
  assert.equal(generateCodeChallenge(verifier), 'I1KYVD2c4u1q_se41xYP4iTZiBLA2Fz01oAud4Czn7M');
});

test('buildAuthorizeUrl includes required oauth2 params', () => {
  const url = buildAuthorizeUrl({
    clientId: 'client-id',
    redirectUri: 'https://example.com/callback',
    scope: 'tweet.read tweet.write users.read dm.read dm.write offline.access',
    state: 'state-123',
    codeChallenge: 'challenge-abc',
  });

  const parsed = new URL(url);
  assert.equal(parsed.origin + parsed.pathname, 'https://x.com/i/oauth2/authorize');
  assert.equal(parsed.searchParams.get('response_type'), 'code');
  assert.equal(parsed.searchParams.get('client_id'), 'client-id');
  assert.equal(parsed.searchParams.get('redirect_uri'), 'https://example.com/callback');
  assert.equal(parsed.searchParams.get('scope'), 'tweet.read tweet.write users.read dm.read dm.write offline.access');
  assert.equal(parsed.searchParams.get('state'), 'state-123');
  assert.equal(parsed.searchParams.get('code_challenge'), 'challenge-abc');
  assert.equal(parsed.searchParams.get('code_challenge_method'), 'S256');
});

test('generateState returns hex string', () => {
  const state = generateState();
  assert.match(state, /^[0-9a-f]+$/);
});

test('oauth state cookie must match both state and signature', () => {
  const secret = 'client-secret';
  const state = 'state-123';
  const cookieValue = buildOAuthStateCookieValue(state, secret);

  assert.equal(verifyOAuthStateCookieValue(cookieValue, state, secret), true);
  assert.equal(verifyOAuthStateCookieValue(cookieValue, 'other-state', secret), false);
  assert.equal(verifyOAuthStateCookieValue(`${state}.tampered`, state, secret), false);
});

test('isAuthorizedXBotAuthInitiator only allows explicit allowlist entries', () => {
  assert.equal(isAuthorizedXBotAuthInitiator('did:privy:owner', ['did:privy:owner']), true);
  assert.equal(isAuthorizedXBotAuthInitiator('did:privy:attacker', ['did:privy:owner']), false);
  assert.equal(isAuthorizedXBotAuthInitiator('', ['did:privy:owner']), false);
});

test('matchesExpectedXBotIdentity enforces configured username and user id', () => {
  assert.equal(matchesExpectedXBotIdentity({ id: process.env.X_BOT_USER_ID || '', username: process.env.X_BOT_USERNAME || 'kikoapp' }), true);
  if (process.env.X_BOT_USER_ID) {
    assert.equal(matchesExpectedXBotIdentity({ id: 'wrong-user-id', username: process.env.X_BOT_USERNAME || 'kikoapp' }), false);
  }
  assert.equal(matchesExpectedXBotIdentity({ id: process.env.X_BOT_USER_ID || '123', username: 'wrong-handle' }), false);
});
