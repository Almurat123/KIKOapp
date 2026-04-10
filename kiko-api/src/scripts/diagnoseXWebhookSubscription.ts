// CONTEXT MEMORY
// Updated: 2026-04-10
// Author: Almurat
// Reason: webhook subscription failures reached the point where operator guesses
//         were wasting time; we need a direct server-side diagnosis path using
//         the exact stored bot credentials and current app configuration, with
//         explicit visibility when the stored OAuth2 bot token is already stale.
// Goal: identify whether failures come from OAuth2 bot identity, webhook ownership,
//       or current X Activity subscription state without mutating data by default.
// Owns: read-only diagnosis for X Activity webhook subscription setup.
// Does Not Own: creating OAuth credentials, webhook event ingestion, or chat logic.
// Design Language:
// - Diagnose with the exact stored credentials, not copied tokens.
// - Prefer read-only checks before any mutation.
// - Print exact upstream status/body pairs for operator decisions.
// - Surface expired-token refresh failures explicitly instead of silently falling back.
// See also:
// - system-journal/INDEX.md
// - system-journal/fix-log/2026-04-10-x-oauth1-helper-flow.md
// - system-journal/fix-log/2026-04-10-x-webhook-subscription-diagnostics.md
// - system-journal/fix-log/2026-04-10-x-activity-api-migration.md
// - system-journal/fix-log/2026-04-10-x-expired-bot-token-hard-fail.md
// - system-journal/conflicts.md
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { decrypt, isEncrypted } from '../utils/encryption.js';
import { refreshXBotAccessToken } from '../services/x/xCredentialsService.js';

interface XWebhookRecord {
  id: string;
  url: string;
  valid?: boolean;
  created_at?: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function requireEnv(name: string): string {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

function normalizeUrl(value: string): string {
  return String(value || '').trim().replace(/\/+$/, '');
}

function decodeStoredToken(value?: string | null): string | null {
  if (!value) return null;
  try {
    return decrypt(value);
  } catch {
    return isEncrypted(value) ? null : value;
  }
}

async function readStoredCreds(databaseUrl: string) {
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const row = await prisma.xOAuthCredential.findUnique({ where: { provider: 'x' } });
    if (!row) throw new Error('No x_oauth_credentials row found');
    return {
      botUserId: row.botUserId,
      botUsername: row.botUsername,
      accessToken: decodeStoredToken(row.accessToken),
      oauth1AccessToken: decodeStoredToken(row.oauth1AccessToken),
      oauth1AccessTokenSecret: decodeStoredToken(row.oauth1AccessTokenSecret),
      oauth1AuthorizedAt: row.oauth1AuthorizedAt,
      lastAuthorizedAt: row.lastAuthorizedAt,
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function fetchJsonOrText(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const text = await res.text().catch(() => '');
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {}
  return {
    status: res.status,
    ok: res.ok,
    body,
  };
}

async function listWebhooks(appBearerToken: string): Promise<XWebhookRecord[]> {
  const result = await fetchJsonOrText('https://api.x.com/2/webhooks', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${appBearerToken}`,
    },
  });
  if (!result.ok) {
    throw new Error(`[X API] list webhooks failed: ${JSON.stringify(result)}`);
  }
  return Array.isArray((result.body as any)?.data) ? (result.body as any).data : [];
}

async function main() {
  const databaseUrl = requireEnv('DATABASE_URL');
  const appBearerToken = requireEnv('X_APP_BEARER_TOKEN');
  const callbackUrl = normalizeUrl(process.env.X_WEBHOOK_CALLBACK_URL || 'https://api.kikoapp.app/api/webhook/x');

  const stored = await readStoredCreds(databaseUrl);
  const webhooks = await listWebhooks(appBearerToken);
  const webhook = webhooks.find((item) => normalizeUrl(item.url) === callbackUrl) || null;
  const refresh = await refreshXBotAccessToken({ requireFresh: true })
    .then((state) => ({ ok: true as const, state, error: null }))
    .catch((error) => ({
      ok: false as const,
      state: null,
      error: error instanceof Error ? error.message : String(error),
    }));
  const botAccessToken = String(refresh.state?.accessToken || stored.accessToken || '').trim();

  const meUrl = 'https://api.x.com/2/users/me?user.fields=username';
  const me = botAccessToken
    ? await fetchJsonOrText(meUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${botAccessToken}`,
        },
      })
    : { status: 0, ok: false, body: 'missing bot access token' };

  const activitySubscriptions = await fetchJsonOrText('https://api.x.com/2/activity/subscriptions', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${appBearerToken}`,
    },
  });

  console.log(JSON.stringify({
    callbackUrl,
    webhook: webhook
      ? {
          id: webhook.id,
          url: webhook.url,
          valid: webhook.valid ?? null,
        }
      : null,
    stored: {
      botUserId: stored.botUserId,
      botUsername: stored.botUsername,
      hasOAuth2AccessToken: Boolean(stored.accessToken),
      hasOAuth1AccessToken: Boolean(stored.oauth1AccessToken),
      hasOAuth1AccessTokenSecret: Boolean(stored.oauth1AccessTokenSecret),
      oauth1AuthorizedAt: stored.oauth1AuthorizedAt,
      lastAuthorizedAt: stored.lastAuthorizedAt,
    },
    oauth2Refresh: refresh,
    oauth2UsersMe: me,
    activitySubscriptions,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
