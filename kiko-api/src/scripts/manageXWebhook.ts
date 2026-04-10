// CONTEXT MEMORY
// Updated: 2026-04-10
// Author: Almurat
// Reason: the X webhook receiver was already implemented, but operator setup on
//         the X platform remained manual and error-prone, and subscription setup
//         must now follow the latest X Activity API docs rather than relying on
//         the legacy account_activity subscription path. Product direction then
//         changed: X DMs are outbound-only, so this script must remove DM/chat
//         subscriptions instead of recreating them.
// Goal: provide one repeatable operator script that can create or reuse the
//       webhook, then keep the app free of inbound DM/chat activity subscriptions.
// Owns: X webhook registration, lookup, and X Activity subscription cleanup.
// Does Not Own: webhook event parsing, OAuth callback storage, or runtime chat handling.
// Design Language:
// - Create-or-reuse by callback URL instead of spraying duplicate webhooks.
// - Use app bearer for webhook management and X Activity subscription cleanup.
// - Treat inbound DM/chat subscriptions as unwanted operator drift.
// - Fail loudly with exact upstream response details; never silently partially configure.
// - Keep the webhook alive for outbound DM support, but do not subscribe to DM/chat.
// See also:
// - system-journal/INDEX.md
// - system-journal/fix-log/2026-04-09-x-oauth-official-account-flow.md
// - system-journal/fix-log/2026-04-09-x-webhook-operator-script.md
// - system-journal/fix-log/2026-04-10-x-dm-outbound-only.md
// - system-journal/conflicts.md
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { decrypt, isEncrypted } from '../utils/encryption.js';

type Command = 'ensure' | 'list';
const DISABLED_EVENT_TYPES = ['dm.received', 'chat.received', 'dm.sent', 'chat.sent'] as const;

interface XWebhookRecord {
  id: string;
  url: string;
  valid?: boolean;
  created_at?: string;
}

interface XBotCredentialRecord {
  accessToken: string | null;
  refreshToken: string | null;
  oauth1AccessToken: string | null;
  oauth1AccessTokenSecret: string | null;
  botUserId: string | null;
  botUsername: string | null;
  tokenType: string | null;
  scope: string | null;
  expiresAt: Date | null;
  oauth1AuthorizedAt: Date | null;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function readArg(name: string): string | null {
  const prefix = `${name}=`;
  const match = process.argv.slice(3).find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
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

function requireEnv(name: string): string {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

async function readBotCredential(databaseUrl: string): Promise<XBotCredentialRecord> {
  const prisma = new PrismaClient({
    datasources: {
      db: { url: databaseUrl },
    },
  });

  try {
    const row = await prisma.xOAuthCredential.findUnique({
      where: { provider: 'x' },
    });
    if (!row?.accessToken || !row.botUserId) {
      throw new Error('No stored X bot OAuth credentials found in x_oauth_credentials');
    }
    return {
      accessToken: decodeStoredToken(row.accessToken),
      refreshToken: decodeStoredToken(row.refreshToken),
      oauth1AccessToken: decodeStoredToken((row as any).oauth1AccessToken),
      oauth1AccessTokenSecret: decodeStoredToken((row as any).oauth1AccessTokenSecret),
      botUserId: row.botUserId,
      botUsername: row.botUsername,
      tokenType: row.tokenType,
      scope: row.scope,
      expiresAt: row.expiresAt,
      oauth1AuthorizedAt: (row as any).oauth1AuthorizedAt,
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function xRequest<T>(
  url: string,
  init?: RequestInit,
  headers?: Record<string, string>,
): Promise<T> {
  const mergedHeaders: Record<string, string> = {
    ...(headers || {}),
    ...(init?.headers as Record<string, string> | undefined || {}),
  };
  if (init?.body && !mergedHeaders['Content-Type']) {
    mergedHeaders['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...init,
    headers: mergedHeaders,
  });

  const text = await response.text();
  const body = text ? safeJsonParse(text) : null;
  if (!response.ok) {
    throw new Error(
      `[X API] ${response.status} ${response.statusText} ${url} :: ${typeof body === 'string' ? body : JSON.stringify(body)}`
    );
  }
  return body as T;
}

function safeJsonParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function listWebhooks(appBearerToken: string): Promise<XWebhookRecord[]> {
  const result = await xRequest<{ data?: XWebhookRecord[] }>(
    'https://api.x.com/2/webhooks',
    { method: 'GET' },
    { Authorization: `Bearer ${appBearerToken}` },
  );
  return Array.isArray(result?.data) ? result.data : [];
}

async function createWebhook(appBearerToken: string, callbackUrl: string): Promise<XWebhookRecord> {
  const result = await xRequest<{ data: XWebhookRecord }>(
    'https://api.x.com/2/webhooks',
    {
      method: 'POST',
      body: JSON.stringify({ url: callbackUrl }),
    },
    { Authorization: `Bearer ${appBearerToken}` },
  );
  if (!result?.data?.id) {
    throw new Error('X API did not return webhook id after creation');
  }
  return result.data;
}

type ActivitySubscriptionRecord = {
  id: string;
  event_type: string;
  filter?: {
    user_id?: string | null;
    keyword?: string | null;
  } | null;
  webhook_id?: string | null;
  tag?: string | null;
};

async function listActivitySubscriptions(appBearerToken: string): Promise<ActivitySubscriptionRecord[]> {
  const result = await xRequest<{ data?: ActivitySubscriptionRecord[] }>(
    'https://api.x.com/2/activity/subscriptions',
    { method: 'GET' },
    { Authorization: `Bearer ${appBearerToken}` },
  );
  return Array.isArray(result?.data) ? result.data : [];
}

async function deleteActivitySubscription(appBearerToken: string, subscriptionId: string): Promise<void> {
  await xRequest(
    `https://api.x.com/2/activity/subscriptions/${subscriptionId}`,
    { method: 'DELETE' },
    { Authorization: `Bearer ${appBearerToken}` },
  );
}

async function ensureActivitySubscriptions(params: {
  appBearerToken: string;
  webhookId: string;
  botUserId: string;
}): Promise<ActivitySubscriptionRecord[]> {
  const existing = await listActivitySubscriptions(params.appBearerToken);
  const managed = existing.filter((item) =>
    DISABLED_EVENT_TYPES.includes(item.event_type as any)
    && String(item.filter?.user_id || '') === params.botUserId
    && String(item.webhook_id || '') === params.webhookId,
  );

  for (const subscription of managed) {
    await deleteActivitySubscription(params.appBearerToken, subscription.id);
  }

  const after = await listActivitySubscriptions(params.appBearerToken);
  return after.filter((item) =>
    DISABLED_EVENT_TYPES.includes(item.event_type as any)
    && String(item.filter?.user_id || '') === params.botUserId
    && String(item.webhook_id || '') === params.webhookId,
  );
}

function summarizeWebhook(webhook: XWebhookRecord | null, subscriptions: ActivitySubscriptionRecord[], bot: XBotCredentialRecord, callbackUrl: string) {
  return {
    callbackUrl,
    webhookId: webhook?.id || null,
    webhookUrl: webhook?.url || null,
    webhookValid: webhook?.valid ?? null,
    subscriptions,
    botUserId: bot.botUserId,
    botUsername: bot.botUsername,
    tokenType: bot.tokenType,
    scope: bot.scope,
  };
}

async function main() {
  const command = (process.argv[2] || 'ensure') as Command;
  if (!['ensure', 'list'].includes(command)) {
    throw new Error(`Unsupported command: ${command}`);
  }

  const callbackUrl = normalizeUrl(
    readArg('--url')
    || process.env.X_WEBHOOK_CALLBACK_URL
    || 'https://api.kikoapp.app/api/webhook/x',
  );

  const appBearerToken = requireEnv('X_APP_BEARER_TOKEN');
  const databaseUrl = requireEnv('DATABASE_URL');
  const bot = await readBotCredential(databaseUrl);
  const existing = await listWebhooks(appBearerToken);
  const matched = existing.find((item) => normalizeUrl(item.url) === callbackUrl) || null;

  if (command === 'list') {
    const activitySubscriptions = await listActivitySubscriptions(appBearerToken).catch(() => []);
    console.log(JSON.stringify({
      callbackUrl,
      webhooks: existing,
      matchedWebhookId: matched?.id || null,
      botUserId: bot.botUserId,
      botUsername: bot.botUsername,
      activitySubscriptions,
    }, null, 2));
    return;
  }

  if (!bot.botUserId) {
    throw new Error('Missing stored bot user id. Complete /api/auth/x/start first.');
  }

  const webhook = matched || await createWebhook(appBearerToken, callbackUrl);
  const activitySubscriptions = await ensureActivitySubscriptions({
    appBearerToken,
    webhookId: webhook.id,
    botUserId: bot.botUserId,
  });

  console.log(JSON.stringify(
    summarizeWebhook(webhook, activitySubscriptions, bot, callbackUrl),
    null,
    2,
  ));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
