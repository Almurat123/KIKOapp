// CONTEXT MEMORY
// Updated: 2026-04-10
// Author: Almurat
// Reason: X OAuth start/callback is a new owner layer that converts an authorized
//         KIKO official account into persisted bot credentials without changing
//         the existing agent or trading flow, and now also owns OAuth1 helper
//         setup for webhook subscription plus operator-safe CRC diagnostics.
// Goal: preserve a strict PKCE-based OAuth2 bridge for the bot account and keep
//       token exchange, state validation, credential persistence, OAuth1 helper
//       setup, and limited operator diagnostics in one place.
// Owns: X auth URL generation, PKCE state storage, token exchange, and callback
//       persistence for the official bot account, OAuth1 request-token exchange,
//       and allowlisted CRC debug output.
// Does Not Own: X mention/DM ingestion, chat routing, or chain execution.
// Design Language:
// - PKCE state must be single-use and time bounded.
// - Callback must fail closed on state/code/token exchange mismatches.
// - Do not leak raw access tokens into logs or redirects.
// - Operator diagnostics may expose fingerprints, never raw secrets.
// See also:
// - system-journal/INDEX.md
// - system-journal/fix-log/2026-04-09-x-oauth-official-account-flow.md
// - system-journal/fix-log/2026-04-10-x-oauth1-helper-flow.md
// - system-journal/fix-log/2026-04-10-x-webhook-crc-debug-endpoint.md
// - system-journal/fix-log/2026-04-09-auth-debug-cleanup.md
// - system-journal/conflicts.md
import crypto from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { requireEndUserAuth } from '../middleware/auth.js';
import { env } from '../config/env.js';
import cacheClient from '../cache/cacheClient.js';
import {
  storeXBotCredentials,
  ensureXBotCredentialsLoaded,
  storeXBotOAuth1Credentials,
} from '../services/x/xCredentialsService.js';
import { safeSecretEquals } from './webhookHelpers.js';
import { computeXWebhookCrcResponseToken } from './xWebhook.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

const PKCE_TTL_SECONDS = 15 * 60;
const PKCE_CACHE_PREFIX = 'x:oauth:pkce:';
const PKCE_CONSUME_LOCK_PREFIX = 'x:oauth:pkce:consume:';
const OAUTH_STATE_COOKIE_NAME = 'kiko_x_oauth_state';
const OAUTH1_TTL_SECONDS = 15 * 60;
const OAUTH1_CACHE_PREFIX = 'x:oauth1:request:';
const OAUTH1_CONSUME_LOCK_PREFIX = 'x:oauth1:request:consume:';
const OAUTH1_COOKIE_NAME = 'kiko_x_oauth1_token';

interface StartQuery {
  redirect?: string;
  json?: string;
}

interface CallbackQuery {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
}

interface WebhookDebugQuery {
  crc_token?: string;
}

interface OAuth1CallbackQuery {
  oauth_token?: string;
  oauth_verifier?: string;
  denied?: string;
}

interface PkceStateRecord {
  codeVerifier: string;
  redirectUri: string;
  initiatorUserId: string;
  createdAt: string;
}

interface OAuth1RequestTokenStateRecord {
  requestTokenSecret: string;
  initiatorUserId: string;
  createdAt: string;
}

function redactDid(value: string | null | undefined): string | null {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  if (normalized.length <= 16) return normalized;
  return `${normalized.slice(0, 12)}...${normalized.slice(-8)}`;
}

function fingerprintDid(value: string | null | undefined): string | null {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 12);
}

function summarizeAuthorizedDidList(values: string[]): string[] {
  return values
    .map((value) => redactDid(value))
    .filter((value): value is string => !!value);
}

function summarizeAuthorizedDidFingerprints(values: string[]): Array<{ sample: string | null; length: number; fp: string | null }> {
  return values.map((value) => {
    const normalized = String(value || '').trim();
    return {
      sample: redactDid(normalized),
      length: normalized.length,
      fp: fingerprintDid(normalized),
    };
  });
}

function normalizeUsername(value: string | null | undefined): string {
  return String(value || '').trim().replace(/^@/, '').toLowerCase();
}

function cookieHeaderParts(rawCookieHeader?: string): Map<string, string> {
  const result = new Map<string, string>();
  const raw = String(rawCookieHeader || '').trim();
  if (!raw) return result;
  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (!key) continue;
    const value = rest.join('=');
    try {
      result.set(key, decodeURIComponent(value));
    } catch {
      result.set(key, value);
    }
  }
  return result;
}

function signStateForCookie(state: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(state).digest('hex');
}

export function buildOAuthStateCookieValue(state: string, secret: string): string {
  return `${state}.${signStateForCookie(state, secret)}`;
}

export function verifyOAuthStateCookieValue(cookieValue: string | null | undefined, state: string, secret: string): boolean {
  const raw = String(cookieValue || '').trim();
  if (!raw || !state || !secret) return false;
  const [cookieState, signature] = raw.split('.', 2);
  if (!cookieState || !signature || cookieState !== state) return false;
  return safeSecretEquals(signature, signStateForCookie(state, secret));
}

function serializeCookie(name: string, value: string, options?: { maxAgeSeconds?: number; clear?: boolean }): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/api/auth/x', 'HttpOnly', 'SameSite=Lax'];
  if (env.nodeEnv === 'production' || env.nodeEnv === 'prod') {
    parts.push('Secure');
  }
  if (options?.clear) {
    parts.push('Max-Age=0');
    parts.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    return parts.join('; ');
  }
  const maxAge = Math.max(1, options?.maxAgeSeconds || PKCE_TTL_SECONDS);
  parts.push(`Max-Age=${maxAge}`);
  return parts.join('; ');
}

function percentEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function oauth1Nonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

function oauth1Timestamp(): string {
  return String(Math.floor(Date.now() / 1000));
}

function buildOAuth1Header(params: {
  method: 'GET' | 'POST';
  url: string;
  consumerKey: string;
  consumerSecret: string;
  token?: string | null;
  tokenSecret?: string | null;
  extraOauthParams?: Record<string, string>;
}): string {
  const parsedUrl = new URL(params.url);
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: params.consumerKey,
    oauth_nonce: oauth1Nonce(),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: oauth1Timestamp(),
    oauth_version: '1.0',
    ...(params.token ? { oauth_token: params.token } : {}),
    ...(params.extraOauthParams || {}),
  };

  const signatureParams: Array<[string, string]> = [
    ...Array.from(parsedUrl.searchParams.entries()),
    ...Object.entries(oauthParams),
  ];

  const paramString = signatureParams
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${percentEncode(key)}=${percentEncode(value)}`)
    .join('&');

  const baseString = [
    params.method.toUpperCase(),
    percentEncode(`${parsedUrl.origin}${parsedUrl.pathname}`),
    percentEncode(paramString),
  ].join('&');

  const signingKey = `${percentEncode(params.consumerSecret)}&${percentEncode(params.tokenSecret || '')}`;
  oauthParams.oauth_signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');

  return `OAuth ${Object.entries(oauthParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${percentEncode(key)}="${percentEncode(value)}"`)
    .join(', ')}`;
}

export function isAuthorizedXBotAuthInitiator(userId: string, allowedUserIds: string[] = env.x.authorizedPrivyDids): boolean {
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) return false;
  return allowedUserIds.some((allowed) => String(allowed || '').trim() === normalizedUserId);
}

export function matchesExpectedXBotIdentity(user: { id: string; username?: string | null }): boolean {
  const expectedUserId = String(env.x.botUserId || '').trim();
  const expectedUsername = normalizeUsername(env.x.botUsername);
  const userId = String(user.id || '').trim();
  const username = normalizeUsername(user.username);

  if (expectedUserId && userId !== expectedUserId) return false;
  if (expectedUsername && username !== expectedUsername) return false;
  return true;
}

function base64Url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function generateCodeVerifier(): string {
  return base64Url(crypto.randomBytes(32));
}

export function generateCodeChallenge(verifier: string): string {
  return base64Url(crypto.createHash('sha256').update(verifier).digest());
}

export function generateState(): string {
  return crypto.randomBytes(16).toString('hex');
}

function fingerprintSecret(value: string | null | undefined): string | null {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

export function buildAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL('https://x.com/i/oauth2/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('scope', params.scope);
  url.searchParams.set('state', params.state);
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

async function storePkceState(state: string, record: PkceStateRecord): Promise<void> {
  await cacheClient.set(`${PKCE_CACHE_PREFIX}${state}`, JSON.stringify(record), PKCE_TTL_SECONDS);
}

async function consumePkceState(state: string): Promise<PkceStateRecord | null> {
  const key = `${PKCE_CACHE_PREFIX}${state}`;
  const consumeLock = `${PKCE_CONSUME_LOCK_PREFIX}${state}`;
  const acquired = await cacheClient.setIfNotExists(consumeLock, '1', PKCE_TTL_SECONDS);
  if (!acquired) return null;
  const raw = await cacheClient.get(key);
  if (!raw) return null;
  await cacheClient.del(key).catch(() => {});
  try {
    return JSON.parse(raw) as PkceStateRecord;
  } catch {
    return null;
  }
}

async function storeOAuth1RequestState(requestToken: string, record: OAuth1RequestTokenStateRecord): Promise<void> {
  await cacheClient.set(`${OAUTH1_CACHE_PREFIX}${requestToken}`, JSON.stringify(record), OAUTH1_TTL_SECONDS);
}

async function consumeOAuth1RequestState(requestToken: string): Promise<OAuth1RequestTokenStateRecord | null> {
  const key = `${OAUTH1_CACHE_PREFIX}${requestToken}`;
  const consumeLock = `${OAUTH1_CONSUME_LOCK_PREFIX}${requestToken}`;
  const acquired = await cacheClient.setIfNotExists(consumeLock, '1', OAUTH1_TTL_SECONDS);
  if (!acquired) return null;
  const raw = await cacheClient.get(key);
  if (!raw) return null;
  await cacheClient.del(key).catch(() => {});
  try {
    return JSON.parse(raw) as OAuth1RequestTokenStateRecord;
  } catch {
    return null;
  }
}

async function exchangeCodeForToken(params: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<{
  accessToken: string;
  refreshToken?: string | null;
  tokenType?: string | null;
  scope?: string | null;
  expiresIn?: number | null;
}> {
  if (!env.x.clientId || !env.x.clientSecret) {
    throw new Error('X client credentials are not configured');
  }

  const body = new URLSearchParams({
    code: params.code,
    grant_type: 'authorization_code',
    client_id: env.x.clientId,
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
  });

  const response = await fetch('https://api.x.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${env.x.clientId}:${env.x.clientSecret}`).toString('base64')}`,
    },
    body,
  });

  const raw = await response.text().catch(() => '');
  if (!response.ok) {
    throw new Error(`X token exchange failed: ${response.status} ${raw.slice(0, 240)}`);
  }

  const json = raw ? JSON.parse(raw) : {};
  return {
    accessToken: String(json.access_token || ''),
    refreshToken: json.refresh_token ? String(json.refresh_token) : null,
    tokenType: json.token_type ? String(json.token_type) : null,
    scope: json.scope ? String(json.scope) : null,
    expiresIn: json.expires_in ? Number(json.expires_in) : null,
  };
}

async function fetchCurrentUser(accessToken: string): Promise<{ id: string; username?: string | null }> {
  const response = await fetch('https://api.x.com/2/users/me?user.fields=username', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const raw = await response.text().catch(() => '');
  if (!response.ok) {
    throw new Error(`X user lookup failed: ${response.status} ${raw.slice(0, 240)}`);
  }
  const json = raw ? JSON.parse(raw) : {};
  const data = json?.data || {};
  const id = String(data.id || '').trim();
  if (!id) {
    throw new Error('X user lookup returned no id');
  }
  return {
    id,
    username: data.username ? String(data.username) : null,
  };
}

async function requestOAuth1RequestToken(params: {
  callbackUri: string;
}): Promise<{ oauthToken: string; oauthTokenSecret: string; oauthCallbackConfirmed: boolean }> {
  if (!env.x.consumerKey || !env.x.webhookSecret) {
    throw new Error('X OAuth1 consumer credentials are not configured');
  }

  const url = 'https://api.x.com/oauth/request_token';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: buildOAuth1Header({
        method: 'POST',
        url,
        consumerKey: env.x.consumerKey,
        consumerSecret: env.x.webhookSecret,
        extraOauthParams: {
          oauth_callback: params.callbackUri,
        },
      }),
    },
  });
  const raw = await response.text().catch(() => '');
  if (!response.ok) {
    throw new Error(`X OAuth1 request token failed: ${response.status} ${raw.slice(0, 240)}`);
  }
  const parsed = new URLSearchParams(raw);
  const oauthToken = String(parsed.get('oauth_token') || '').trim();
  const oauthTokenSecret = String(parsed.get('oauth_token_secret') || '').trim();
  const oauthCallbackConfirmed = String(parsed.get('oauth_callback_confirmed') || '').trim() === 'true';
  if (!oauthToken || !oauthTokenSecret) {
    throw new Error('X OAuth1 request token response missing token or secret');
  }
  return { oauthToken, oauthTokenSecret, oauthCallbackConfirmed };
}

function buildOAuth1AuthorizeUrl(oauthToken: string): string {
  const url = new URL('https://api.x.com/oauth/authorize');
  url.searchParams.set('oauth_token', oauthToken);
  return url.toString();
}

async function exchangeOAuth1AccessToken(params: {
  oauthToken: string;
  oauthVerifier: string;
  requestTokenSecret: string;
}): Promise<{ accessToken: string; accessTokenSecret: string; userId?: string | null; screenName?: string | null }> {
  if (!env.x.consumerKey || !env.x.webhookSecret) {
    throw new Error('X OAuth1 consumer credentials are not configured');
  }

  const url = 'https://api.x.com/oauth/access_token';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: buildOAuth1Header({
        method: 'POST',
        url,
        consumerKey: env.x.consumerKey,
        consumerSecret: env.x.webhookSecret,
        token: params.oauthToken,
        tokenSecret: params.requestTokenSecret,
        extraOauthParams: {
          oauth_verifier: params.oauthVerifier,
        },
      }),
    },
  });
  const raw = await response.text().catch(() => '');
  if (!response.ok) {
    throw new Error(`X OAuth1 access token failed: ${response.status} ${raw.slice(0, 240)}`);
  }
  const parsed = new URLSearchParams(raw);
  const accessToken = String(parsed.get('oauth_token') || '').trim();
  const accessTokenSecret = String(parsed.get('oauth_token_secret') || '').trim();
  if (!accessToken || !accessTokenSecret) {
    throw new Error('X OAuth1 access token response missing token or secret');
  }
  return {
    accessToken,
    accessTokenSecret,
    userId: parsed.get('user_id'),
    screenName: parsed.get('screen_name'),
  };
}

async function fetchCurrentUserWithOAuth1(params: {
  accessToken: string;
  accessTokenSecret: string;
}): Promise<{ id: string; username?: string | null }> {
  if (!env.x.consumerKey || !env.x.webhookSecret) {
    throw new Error('X OAuth1 consumer credentials are not configured');
  }

  const url = 'https://api.x.com/2/users/me?user.fields=username';
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: buildOAuth1Header({
        method: 'GET',
        url,
        consumerKey: env.x.consumerKey,
        consumerSecret: env.x.webhookSecret,
        token: params.accessToken,
        tokenSecret: params.accessTokenSecret,
      }),
    },
  });
  const raw = await response.text().catch(() => '');
  if (!response.ok) {
    throw new Error(`X OAuth1 user lookup failed: ${response.status} ${raw.slice(0, 240)}`);
  }
  const json = raw ? JSON.parse(raw) : {};
  const data = json?.data || {};
  const id = String(data.id || '').trim();
  if (!id) {
    throw new Error('X OAuth1 user lookup returned no id');
  }
  return {
    id,
    username: data.username ? String(data.username) : null,
  };
}

export async function xAuthRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: StartQuery }>('/start', { preHandler: requireEndUserAuth }, async (request: FastifyRequest<{ Querystring: StartQuery }>, reply: FastifyReply) => {
    if (!env.x.clientId || !env.x.clientSecret) {
      return reply.status(503).send({ success: false, error: 'X client credentials are not configured' });
    }

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ success: false, error: 'Unauthorized' });
    }
    if (!isAuthorizedXBotAuthInitiator(userId)) {
      return reply.status(403).send({
        success: false,
        error: 'Caller is not allowed to authorize the X bot account',
        debug: {
          callerDid: redactDid(userId),
          callerDidLength: String(userId || '').trim().length,
          callerDidFingerprint: fingerprintDid(userId),
          allowedDidCount: env.x.authorizedPrivyDids.length,
          allowedDidSamples: summarizeAuthorizedDidList(env.x.authorizedPrivyDids),
          allowedDidFingerprints: summarizeAuthorizedDidFingerprints(env.x.authorizedPrivyDids),
        },
      });
    }

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = generateState();
    const redirectUri = env.x.oauthRedirectUri;
    const scope = ['tweet.read', 'tweet.write', 'users.read', 'dm.read', 'dm.write', 'offline.access'].join(' ');
    const authUrl = buildAuthorizeUrl({
      clientId: env.x.clientId,
      redirectUri,
      scope,
      state,
      codeChallenge,
    });

    await storePkceState(state, {
      codeVerifier,
      redirectUri,
      initiatorUserId: userId,
      createdAt: new Date().toISOString(),
    });
    reply.header('Set-Cookie', serializeCookie(
      OAUTH_STATE_COOKIE_NAME,
      buildOAuthStateCookieValue(state, env.x.clientSecret),
      { maxAgeSeconds: PKCE_TTL_SECONDS },
    ));

    const wantsJson = request.query?.json === '1' || request.query?.redirect === '0';
    if (!wantsJson) {
      return reply.redirect(authUrl);
    }

    return {
      success: true,
      data: {
        authUrl,
        state,
        redirectUri,
        scope,
      },
    };
  });

  fastify.get<{ Querystring: StartQuery }>('/oauth1/start', { preHandler: requireEndUserAuth }, async (request, reply) => {
    if (!env.x.consumerKey || !env.x.webhookSecret) {
      return reply.status(503).send({ success: false, error: 'X OAuth1 consumer credentials are not configured' });
    }

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ success: false, error: 'Unauthorized' });
    }
    if (!isAuthorizedXBotAuthInitiator(userId)) {
      return reply.status(403).send({
        success: false,
        error: 'Caller is not allowed to authorize the X bot account',
      });
    }

    try {
      const requestToken = await requestOAuth1RequestToken({
        callbackUri: env.x.oauth1CallbackUri,
      });
      await storeOAuth1RequestState(requestToken.oauthToken, {
        requestTokenSecret: requestToken.oauthTokenSecret,
        initiatorUserId: userId,
        createdAt: new Date().toISOString(),
      });

      reply.header('Set-Cookie', serializeCookie(
        OAUTH1_COOKIE_NAME,
        buildOAuthStateCookieValue(requestToken.oauthToken, env.x.webhookSecret),
        { maxAgeSeconds: OAUTH1_TTL_SECONDS },
      ));

      const authUrl = buildOAuth1AuthorizeUrl(requestToken.oauthToken);
      const wantsJson = request.query?.json === '1' || request.query?.redirect === '0';
      if (!wantsJson) {
        return reply.redirect(authUrl);
      }

      return {
        success: true,
        data: {
          authUrl,
          oauthToken: requestToken.oauthToken,
          callbackUri: env.x.oauth1CallbackUri,
        },
      };
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: 'x_oauth1_start_failed',
        debug: {
          reason: String(err?.message || err || 'unknown').slice(0, 240),
        },
      });
    }
  });

  fastify.get<{ Querystring: WebhookDebugQuery }>('/debug/webhook-crc', { preHandler: requireEndUserAuth }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ success: false, error: 'Unauthorized' });
    }
    if (!isAuthorizedXBotAuthInitiator(userId)) {
      return reply.status(403).send({
        success: false,
        error: 'Caller is not allowed to inspect X bot webhook diagnostics',
      });
    }

    const crcToken = String(request.query?.crc_token || 'kiko_debug_crc_token').trim();
    const webhookSecret = String(env.x.webhookSecret || '').trim();

    return {
      success: true,
      data: {
        crcToken,
        webhookSecretPresent: Boolean(webhookSecret),
        webhookSecretLength: webhookSecret.length,
        webhookSecretFingerprint: fingerprintSecret(webhookSecret),
        responseToken: webhookSecret ? computeXWebhookCrcResponseToken(crcToken, webhookSecret) : null,
        botUsername: env.x.botUsername || null,
        botUserIdConfigured: Boolean(env.x.botUserId),
      },
    };
  });

  fastify.get<{ Querystring: OAuth1CallbackQuery }>('/oauth1/callback', async (request, reply) => {
    const { oauth_token: oauthToken, oauth_verifier: oauthVerifier, denied } = request.query || {};
    reply.header('Set-Cookie', serializeCookie(OAUTH1_COOKIE_NAME, '', { clear: true }));

    if (denied) {
      return reply.status(400).send({
        success: false,
        error: 'oauth1_denied',
      });
    }

    if (!oauthToken || !oauthVerifier) {
      return reply.status(400).send({ success: false, error: 'oauth_token and oauth_verifier are required' });
    }

    if (!verifyOAuthStateCookieValue(
      cookieHeaderParts(request.headers.cookie).get(OAUTH1_COOKIE_NAME),
      oauthToken,
      env.x.webhookSecret,
    )) {
      return reply.status(400).send({ success: false, error: 'OAuth1 browser state mismatch' });
    }

    const requestState = await consumeOAuth1RequestState(oauthToken);
    if (!requestState) {
      return reply.status(400).send({ success: false, error: 'Invalid or expired OAuth1 request token state' });
    }

    try {
      const token = await exchangeOAuth1AccessToken({
        oauthToken,
        oauthVerifier,
        requestTokenSecret: requestState.requestTokenSecret,
      });
      const user = await fetchCurrentUserWithOAuth1({
        accessToken: token.accessToken,
        accessTokenSecret: token.accessTokenSecret,
      });
      if (!matchesExpectedXBotIdentity(user)) {
        throw new Error('Authorized X OAuth1 account does not match the configured official bot identity');
      }

      await storeXBotOAuth1Credentials({
        accessToken: token.accessToken,
        accessTokenSecret: token.accessTokenSecret,
        botUserId: user.id,
        botUsername: user.username || null,
      });

      if (env.x.linkBaseUrl) {
        const url = new URL(env.x.linkBaseUrl);
        url.searchParams.set('x_oauth1', 'success');
        url.searchParams.set('x_user', user.username || user.id);
        return reply.redirect(url.toString());
      }

      return {
        success: true,
        data: {
          botUserId: user.id,
          botUsername: user.username,
          initiatorUserId: requestState.initiatorUserId,
        },
      };
    } catch (err: any) {
      const rawMessage = String(err?.message || err || 'x_oauth1_failed');
      let stage = 'unknown';
      if (rawMessage.includes('request token')) {
        stage = 'request_token';
      } else if (rawMessage.includes('access token')) {
        stage = 'access_token';
      } else if (rawMessage.includes('user lookup')) {
        stage = 'user_lookup';
      } else if (rawMessage.includes('does not match the configured official bot identity')) {
        stage = 'bot_identity_mismatch';
      } else if (rawMessage.includes('Refusing to store X bot OAuth1 credentials')) {
        stage = 'credential_storage';
      }
      return reply.status(500).send({
        success: false,
        error: 'x_oauth1_failed',
        debug: {
          stage,
          reason: rawMessage.slice(0, 240),
        },
      });
    }
  });

  fastify.get<{ Querystring: CallbackQuery }>('/callback', async (request: FastifyRequest<{ Querystring: CallbackQuery }>, reply: FastifyReply) => {
    const { code, state, error, error_description: errorDescription } = request.query || {};
    reply.header('Set-Cookie', serializeCookie(OAUTH_STATE_COOKIE_NAME, '', { clear: true }));
    if (error) {
      return reply.status(400).send({
        success: false,
        error,
        errorDescription: errorDescription || null,
      });
    }

    if (!code || !state) {
      return reply.status(400).send({ success: false, error: 'code and state are required' });
    }
    if (!verifyOAuthStateCookieValue(
      cookieHeaderParts(request.headers.cookie).get(OAUTH_STATE_COOKIE_NAME),
      state,
      env.x.clientSecret,
    )) {
      return reply.status(400).send({ success: false, error: 'OAuth browser state mismatch' });
    }

    const pkceState = await consumePkceState(state);
    if (!pkceState) {
      return reply.status(400).send({ success: false, error: 'Invalid or expired OAuth state' });
    }

    try {
      const token = await exchangeCodeForToken({
        code,
        codeVerifier: pkceState.codeVerifier,
        redirectUri: pkceState.redirectUri,
      });
      if (!token.accessToken) {
        throw new Error('X token exchange returned no access token');
      }

      const user = await fetchCurrentUser(token.accessToken);
      if (!matchesExpectedXBotIdentity(user)) {
        throw new Error('Authorized X account does not match the configured official bot identity');
      }
      await storeXBotCredentials({
        accessToken: token.accessToken,
        refreshToken: token.refreshToken || null,
        botUserId: user.id,
        botUsername: user.username || null,
        tokenType: token.tokenType || null,
        scope: token.scope || null,
        expiresInSeconds: token.expiresIn || null,
      });
      await ensureXBotCredentialsLoaded().catch(() => {});

      if (env.x.linkBaseUrl) {
        const url = new URL(env.x.linkBaseUrl);
        url.searchParams.set('x_auth', 'success');
        url.searchParams.set('x_user', user.username || user.id);
        return reply.redirect(url.toString());
      }

      return {
        success: true,
        data: {
          botUserId: user.id,
          botUsername: user.username,
          initiatorUserId: pkceState.initiatorUserId,
        },
      };
    } catch (err: any) {
      const rawMessage = String(err?.message || err || 'x_oauth_failed');
      let stage = 'unknown';
      if (rawMessage.includes('token exchange')) {
        stage = 'token_exchange';
      } else if (rawMessage.includes('user lookup')) {
        stage = 'user_lookup';
      } else if (rawMessage.includes('does not match the configured official bot identity')) {
        stage = 'bot_identity_mismatch';
      } else if (rawMessage.includes('Refusing to store X bot credentials')) {
        stage = 'credential_storage';
      } else if (rawMessage.includes('no access token')) {
        stage = 'token_payload';
      }
      logger.error(LogCode.SYS_ERROR, '[X OAuth] callback failed', {
        error: rawMessage,
        stage,
      });
      return reply.status(500).send({
        success: false,
        error: 'x_oauth_failed',
        debug: {
          stage,
          reason: rawMessage.slice(0, 240),
        },
      });
    }
  });
}
