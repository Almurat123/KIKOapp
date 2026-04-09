// CONTEXT MEMORY
// Updated: 2026-04-09
// Author: Almurat
// Reason: X OAuth start/callback is a new owner layer that converts an authorized
//         KIKO official account into persisted bot credentials without changing
//         the existing agent or trading flow, and now also owns operator-safe
//         diagnostics for webhook CRC mismatches.
// Goal: preserve a strict PKCE-based OAuth2 bridge for the bot account and keep
//       token exchange, state validation, credential persistence, and limited
//       operator diagnostics in one place.
// Owns: X auth URL generation, PKCE state storage, token exchange, and callback
//       persistence for the official bot account, plus allowlisted CRC debug output.
// Does Not Own: X mention/DM ingestion, chat routing, or chain execution.
// Design Language:
// - PKCE state must be single-use and time bounded.
// - Callback must fail closed on state/code/token exchange mismatches.
// - Do not leak raw access tokens into logs or redirects.
// - Operator diagnostics may expose fingerprints, never raw secrets.
// See also:
// - system-journal/INDEX.md
// - system-journal/fix-log/2026-04-09-x-oauth-official-account-flow.md
// - system-journal/fix-log/2026-04-10-x-webhook-crc-debug-endpoint.md
// - system-journal/fix-log/2026-04-09-auth-debug-cleanup.md
// - system-journal/conflicts.md
import crypto from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { requireEndUserAuth } from '../middleware/auth.js';
import { env } from '../config/env.js';
import cacheClient from '../cache/cacheClient.js';
import { storeXBotCredentials, ensureXBotCredentialsLoaded } from '../services/x/xCredentialsService.js';
import { safeSecretEquals } from './webhookHelpers.js';
import { computeXWebhookCrcResponseToken } from './xWebhook.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

const PKCE_TTL_SECONDS = 15 * 60;
const PKCE_CACHE_PREFIX = 'x:oauth:pkce:';
const PKCE_CONSUME_LOCK_PREFIX = 'x:oauth:pkce:consume:';
const OAUTH_STATE_COOKIE_NAME = 'kiko_x_oauth_state';

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

interface PkceStateRecord {
  codeVerifier: string;
  redirectUri: string;
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
