// CONTEXT MEMORY
// Updated: 2026-04-10
// Author: Almurat
// Reason: webhook subscription failures reached the point where operator guesses
//         were wasting time; we need a direct server-side diagnosis path using
//         the exact stored OAuth1 credentials and current app configuration.
// Goal: identify whether failures come from OAuth1 identity, signature shape,
//       webhook ownership, or subscription state without mutating data by default.
// Owns: read-only diagnosis for X Account Activity webhook subscription setup.
// Does Not Own: creating OAuth credentials, webhook event ingestion, or chat logic.
// Design Language:
// - Diagnose with the exact stored credentials, not copied tokens.
// - Prefer read-only checks before any mutation.
// - Print exact upstream status/body pairs for operator decisions.
// See also:
// - system-journal/INDEX.md
// - system-journal/fix-log/2026-04-10-x-oauth1-helper-flow.md
// - system-journal/fix-log/2026-04-10-x-webhook-subscription-diagnostics.md
// - system-journal/conflicts.md
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { decrypt, isEncrypted } from '../utils/encryption.js';

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

function percentEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function oauthNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

function oauthTimestamp(): string {
  return String(Math.floor(Date.now() / 1000));
}

function buildOAuth1Header(params: {
  method: 'GET' | 'POST';
  url: string;
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}): string {
  const parsedUrl = new URL(params.url);
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: params.consumerKey,
    oauth_nonce: oauthNonce(),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: oauthTimestamp(),
    oauth_token: params.accessToken,
    oauth_version: '1.0',
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

  const signingKey = `${percentEncode(params.consumerSecret)}&${percentEncode(params.accessTokenSecret)}`;
  oauthParams.oauth_signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');

  return `OAuth ${Object.entries(oauthParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${percentEncode(key)}="${percentEncode(value)}"`)
    .join(', ')}`;
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
  const consumerKey = requireEnv('X_CONSUMER_KEY');
  const consumerSecret = requireEnv('X_WEBHOOK_SECRET');
  const callbackUrl = normalizeUrl(process.env.X_WEBHOOK_CALLBACK_URL || 'https://api.kikoapp.app/api/webhook/x');

  const stored = await readStoredCreds(databaseUrl);
  const webhooks = await listWebhooks(appBearerToken);
  const webhook = webhooks.find((item) => normalizeUrl(item.url) === callbackUrl) || null;

  const oauth1Token = String(stored.oauth1AccessToken || '').trim();
  const oauth1Secret = String(stored.oauth1AccessTokenSecret || '').trim();
  if (!oauth1Token || !oauth1Secret) {
    throw new Error('Stored OAuth1 credentials are missing');
  }

  const meUrl = 'https://api.x.com/2/users/me?user.fields=username';
  const me = await fetchJsonOrText(meUrl, {
    method: 'GET',
    headers: {
      Authorization: buildOAuth1Header({
        method: 'GET',
        url: meUrl,
        consumerKey,
        consumerSecret,
        accessToken: oauth1Token,
        accessTokenSecret: oauth1Secret,
      }),
    },
  });

  const subscriptionCheck = webhook
    ? await fetchJsonOrText(`https://api.x.com/2/account_activity/webhooks/${webhook.id}/subscriptions/all`, {
        method: 'GET',
        headers: {
          Authorization: buildOAuth1Header({
            method: 'GET',
            url: `https://api.x.com/2/account_activity/webhooks/${webhook.id}/subscriptions/all`,
            consumerKey,
            consumerSecret,
            accessToken: oauth1Token,
            accessTokenSecret: oauth1Secret,
          }),
        },
      })
    : null;

  const subscriptionList = webhook
    ? await fetchJsonOrText(`https://api.x.com/2/account_activity/webhooks/${webhook.id}/subscriptions/all/list`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${appBearerToken}`,
        },
      })
    : null;

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
    oauth1UsersMe: me,
    subscriptionCheck,
    subscriptionList,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
