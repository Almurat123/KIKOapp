// CONTEXT MEMORY
// Updated: 2026-04-10
// Author: Almurat
// Reason: the official X bot account now needs a stable runtime source of truth
//         for both OAuth2 bot tokens and OAuth1 user-context credentials after
//         authorization completes, including OAuth2 refresh when runtime bearer
//         tokens expire.
// Goal: resolve bot credentials from env or storage, cache them safely, and keep
//       runtime callers agnostic to where the credentials came from.
// Owns: credential loading, caching, encryption/decryption, and persistence of
//       the official bot account token material, including OAuth2 refresh.
// Does Not Own: OAuth redirects, mention polling, DM handling, or webhook logic.
// Design Language:
// - Prefer stored encrypted credentials over ad hoc env overrides.
// - Never require callers to know whether credentials came from env or DB.
// - Treat missing bot identity as a hard runtime miss for X outbound actions.
// - Refresh expired OAuth2 bot tokens before outbound X writes rely on them.
// See also:
// - system-journal/INDEX.md
// - system-journal/fix-log/2026-04-09-x-oauth-official-account-flow.md
// - system-journal/fix-log/2026-04-10-x-oauth1-helper-flow.md
// - system-journal/fix-log/2026-04-10-x-oauth2-refresh-runtime.md
// - system-journal/fix-log/2026-04-09-auth-debug-cleanup.md
// - system-journal/owner-map/backend-swap-validation.md
// - system-journal/conflicts.md
import prisma from '../../db/prisma.js';
import { env } from '../../config/env.js';
import { decrypt, encrypt, isEncrypted, isEncryptionAvailable } from '../../utils/encryption.js';

export interface XBotAuthState {
  accessToken: string;
  refreshToken?: string | null;
  botUserId: string;
  botUsername?: string | null;
  tokenType?: string | null;
  scope?: string | null;
  expiresAt?: Date | null;
}

export interface XBotOAuth1State {
  accessToken: string;
  accessTokenSecret: string;
  botUserId: string;
  botUsername?: string | null;
  authorizedAt?: Date | null;
}

type StoredXCredential = {
  accessToken: string;
  refreshToken: string | null;
  oauth1AccessToken: string | null;
  oauth1AccessTokenSecret: string | null;
  botUserId: string;
  botUsername: string | null;
  tokenType: string | null;
  scope: string | null;
  expiresAt: Date | null;
  oauth1AuthorizedAt: Date | null;
};

let cachedAuthState: XBotAuthState | null = null;
let cachedOAuth1State: XBotOAuth1State | null = null;
let refreshInFlight: Promise<XBotAuthState | null> | null = null;
const X_REFRESH_SKEW_MS = 60_000;

function decodeStored(value?: string | null): string | null {
  if (!value) return null;
  try {
    return decrypt(value);
  } catch {
    return isEncrypted(value) ? null : value;
  }
}

function encodeStored(value?: string | null): string | null {
  const text = String(value || '').trim();
  if (!text) return null;
  return encrypt(text);
}

function fromStored(row: {
  accessToken: string | null;
  refreshToken: string | null;
  oauth1AccessToken?: string | null;
  oauth1AccessTokenSecret?: string | null;
  botUserId: string | null;
  botUsername: string | null;
  tokenType: string | null;
  scope: string | null;
  expiresAt: Date | null;
  oauth1AuthorizedAt?: Date | null;
} | null): XBotAuthState | null {
  if (!row?.accessToken || !row?.botUserId) return null;
  return {
    accessToken: decodeStored(row.accessToken) || '',
    refreshToken: decodeStored(row.refreshToken) || null,
    botUserId: row.botUserId,
    botUsername: row.botUsername || null,
    tokenType: row.tokenType || null,
    scope: row.scope || null,
    expiresAt: row.expiresAt || null,
  };
}

function oauth1FromStored(row: {
  oauth1AccessToken?: string | null;
  oauth1AccessTokenSecret?: string | null;
  botUserId: string | null;
  botUsername: string | null;
  oauth1AuthorizedAt?: Date | null;
} | null): XBotOAuth1State | null {
  if (!row?.oauth1AccessToken || !row?.oauth1AccessTokenSecret || !row?.botUserId) return null;
  return {
    accessToken: decodeStored(row.oauth1AccessToken) || '',
    accessTokenSecret: decodeStored(row.oauth1AccessTokenSecret) || '',
    botUserId: row.botUserId,
    botUsername: row.botUsername || null,
    authorizedAt: row.oauth1AuthorizedAt || null,
  };
}

export async function ensureXBotCredentialsLoaded(): Promise<XBotAuthState | null> {
  if (cachedAuthState?.accessToken && cachedAuthState.botUserId) {
    return cachedAuthState;
  }

  if (env.x.accessToken && env.x.botUserId) {
    cachedAuthState = {
      accessToken: env.x.accessToken,
      refreshToken: null,
      botUserId: env.x.botUserId,
      botUsername: env.x.botUsername || null,
      tokenType: 'bearer',
      scope: null,
      expiresAt: null,
    };
    return cachedAuthState;
  }

  const existing = await prisma.xOAuthCredential.findUnique({
    where: { provider: 'x' },
  }).catch(() => null);
  cachedAuthState = fromStored(existing as any);
  return cachedAuthState;
}

export function getCachedXBotCredentials(): XBotAuthState | null {
  return cachedAuthState;
}

export function getCachedXBotOAuth1Credentials(): XBotOAuth1State | null {
  return cachedOAuth1State;
}

export function getXBotAccessToken(): string | null {
  return cachedAuthState?.accessToken || env.x.accessToken || null;
}

export function getXBotUserId(): string | null {
  return cachedAuthState?.botUserId || env.x.botUserId || null;
}

export function getXBotUsername(): string | null {
  return cachedAuthState?.botUsername || env.x.botUsername || null;
}

function isOAuth2TokenFresh(state: XBotAuthState | null): boolean {
  if (!state?.accessToken) return false;
  if (!state.expiresAt) return true;
  return state.expiresAt.getTime() > (Date.now() + X_REFRESH_SKEW_MS);
}

export async function ensureXBotOAuth1CredentialsLoaded(): Promise<XBotOAuth1State | null> {
  if (cachedOAuth1State?.accessToken && cachedOAuth1State.accessTokenSecret && cachedOAuth1State.botUserId) {
    return cachedOAuth1State;
  }

  const existing = await prisma.xOAuthCredential.findUnique({
    where: { provider: 'x' },
  }).catch(() => null);
  cachedOAuth1State = oauth1FromStored(existing as any);
  return cachedOAuth1State;
}

export async function storeXBotCredentials(params: {
  accessToken: string;
  refreshToken?: string | null;
  botUserId: string;
  botUsername?: string | null;
  tokenType?: string | null;
  scope?: string | null;
  expiresInSeconds?: number | null;
}): Promise<XBotAuthState> {
  if (!isEncryptionAvailable()) {
    throw new Error('Refusing to store X bot credentials without a valid 32-character ENCRYPTION_KEY');
  }

  const expiresAt = params.expiresInSeconds
    ? new Date(Date.now() + Math.max(0, params.expiresInSeconds) * 1000)
    : null;

  const record = await prisma.xOAuthCredential.upsert({
    where: { provider: 'x' },
    update: {
      botUserId: params.botUserId,
      botUsername: params.botUsername || null,
      accessToken: encodeStored(params.accessToken),
      refreshToken: encodeStored(params.refreshToken || null),
      tokenType: params.tokenType || null,
      scope: params.scope || null,
      expiresAt,
      lastAuthorizedAt: new Date(),
    },
    create: {
      provider: 'x',
      botUserId: params.botUserId,
      botUsername: params.botUsername || null,
      accessToken: encodeStored(params.accessToken),
      refreshToken: encodeStored(params.refreshToken || null),
      tokenType: params.tokenType || null,
      scope: params.scope || null,
      expiresAt,
      lastAuthorizedAt: new Date(),
    },
  });

  cachedAuthState = {
    accessToken: params.accessToken,
    refreshToken: params.refreshToken || null,
    botUserId: params.botUserId,
    botUsername: params.botUsername || null,
    tokenType: params.tokenType || null,
    scope: params.scope || null,
    expiresAt,
  };

  return cachedAuthState;
}

export async function refreshXBotAccessToken(options?: {
  force?: boolean;
}): Promise<XBotAuthState | null> {
  const current = await ensureXBotCredentialsLoaded();
  if (!current?.accessToken) return current;

  if (!options?.force && isOAuth2TokenFresh(current)) {
    return current;
  }

  if (!current.refreshToken || !env.x.clientId || !env.x.clientSecret) {
    return current;
  }

  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: current.refreshToken || '',
      client_id: env.x.clientId,
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
      throw new Error(`X token refresh failed: ${response.status} ${raw.slice(0, 240)}`);
    }

    const json = raw ? JSON.parse(raw) : {};
    const accessToken = String(json.access_token || '').trim();
    if (!accessToken) {
      throw new Error('X token refresh returned no access token');
    }

    return storeXBotCredentials({
      accessToken,
      refreshToken: json.refresh_token ? String(json.refresh_token) : (current.refreshToken || null),
      botUserId: current.botUserId,
      botUsername: current.botUsername || null,
      tokenType: json.token_type ? String(json.token_type) : (current.tokenType || 'bearer'),
      scope: json.scope ? String(json.scope) : (current.scope || null),
      expiresInSeconds: json.expires_in ? Number(json.expires_in) : null,
    });
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

export async function storeXBotOAuth1Credentials(params: {
  accessToken: string;
  accessTokenSecret: string;
  botUserId: string;
  botUsername?: string | null;
}): Promise<XBotOAuth1State> {
  if (!isEncryptionAvailable()) {
    throw new Error('Refusing to store X bot OAuth1 credentials without a valid 32-character ENCRYPTION_KEY');
  }

  await prisma.xOAuthCredential.upsert({
    where: { provider: 'x' },
    update: {
      botUserId: params.botUserId,
      botUsername: params.botUsername || null,
      oauth1AccessToken: encodeStored(params.accessToken),
      oauth1AccessTokenSecret: encodeStored(params.accessTokenSecret),
      oauth1AuthorizedAt: new Date(),
    },
    create: {
      provider: 'x',
      botUserId: params.botUserId,
      botUsername: params.botUsername || null,
      oauth1AccessToken: encodeStored(params.accessToken),
      oauth1AccessTokenSecret: encodeStored(params.accessTokenSecret),
      oauth1AuthorizedAt: new Date(),
    },
  });

  cachedOAuth1State = {
    accessToken: params.accessToken,
    accessTokenSecret: params.accessTokenSecret,
    botUserId: params.botUserId,
    botUsername: params.botUsername || null,
    authorizedAt: new Date(),
  };

  return cachedOAuth1State;
}

export async function clearXBotCredentials(): Promise<void> {
  await prisma.xOAuthCredential.deleteMany({
    where: { provider: 'x' },
  }).catch(() => {});
  cachedAuthState = null;
  cachedOAuth1State = null;
}

export async function getStoredXBotCredentials(): Promise<StoredXCredential | null> {
  const row = await prisma.xOAuthCredential.findUnique({
    where: { provider: 'x' },
  }).catch(() => null);
  if (!row?.accessToken || !row.botUserId) return null;
  return {
    accessToken: decodeStored(row.accessToken) || '',
    refreshToken: decodeStored(row.refreshToken) || null,
    oauth1AccessToken: decodeStored((row as any).oauth1AccessToken) || null,
    oauth1AccessTokenSecret: decodeStored((row as any).oauth1AccessTokenSecret) || null,
    botUserId: row.botUserId,
    botUsername: row.botUsername || null,
    tokenType: row.tokenType || null,
    scope: row.scope || null,
    expiresAt: row.expiresAt || null,
    oauth1AuthorizedAt: (row as any).oauth1AuthorizedAt || null,
  };
}

export async function getStoredXBotOAuth1Credentials(): Promise<XBotOAuth1State | null> {
  const row = await prisma.xOAuthCredential.findUnique({
    where: { provider: 'x' },
  }).catch(() => null);
  if (!row?.oauth1AccessToken || !row?.oauth1AccessTokenSecret || !row.botUserId) return null;
  return {
    accessToken: decodeStored(row.oauth1AccessToken) || '',
    accessTokenSecret: decodeStored(row.oauth1AccessTokenSecret) || '',
    botUserId: row.botUserId,
    botUsername: row.botUsername || null,
    authorizedAt: row.oauth1AuthorizedAt || null,
  };
}
