// CONTEXT MEMORY
// Updated: 2026-04-15
// Author: Linh Tran
// Reason: Operators need one repeatable command that can create or reuse the
//         Farcaster webhook registration in Neynar after the paid plan is
//         enabled, instead of relying on manual dashboard clicks.
// Goal: create or update the single KIKO webhook for the configured callback
//       URL and report the resulting webhook id so the developer portal shows
//       the exact live registration.
// Owns: Neynar webhook discovery, create/update requests, and operator output.
// Does Not Own: webhook delivery handling, runtime mention processing, or
//               Farcaster reply publication.
// Design Language:
// - Reuse by callback URL, not by spraying duplicate webhooks.
// - Keep the subscription narrowly focused on the bot's mention and reply
//   delivery, with a narrow @handle text fallback for Neynar mention-filter
//   delivery gaps observed in production.
// - Print the resulting webhook id, target URL, and action so operators can
//   confirm the dashboard state immediately.
// - Allow explicit API-key override so the operator can target the online paid
//   key instead of the local workspace `.env` value.
// Document Provenance:
// - Source: Neynar Documentation, Webhooks in Dashboard
// - Kind: official API doc
// - Retrieved: 2026-04-15
// - Applied To: callback URL shape and mention/reply event use case
// - Verification: verified in docs
// - Source: Neynar Documentation, Programmatic Webhooks
// - Kind: official API doc
// - Retrieved: 2026-04-15
// - Applied To: list/create/update webhook endpoints and callback-url reuse
// - Verification: verified in docs
// - Source: Neynar OpenAPI WebhookSubscriptionFiltersCast and production
//   signed replay of a real @kikoapp cast
// - Kind: official API doc / runtime observation
// - Retrieved: 2026-04-15
// - Applied To: adding @handle text fallback to the operator-created webhook
// - Verification: verified in docs and runtime
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/owner-map/farcaster-neynar-webhook-ingress.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-farcaster-neynar-webhook-ingress.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildNeynarMentionSubscription,
  ensureNeynarWebhook,
  listNeynarWebhooks,
} from '../services/farcaster-agent/neynarWebhookService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

type Command = 'ensure' | 'list';

function readArg(name: string): string | null {
  const prefix = `${name}=`;
  const match = process.argv.slice(3).find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function requireEnv(name: string): string {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function readApiKey(): { value: string; source: string } {
  const cliValue = String(readArg('--api-key') || '').trim();
  if (cliValue) {
    return { value: cliValue, source: 'cli' };
  }
  const envValue = String(process.env.NEYNAR_API_KEY || '').trim();
  if (envValue) {
    return { value: envValue, source: 'env' };
  }
  throw new Error('Missing required Neynar API key. Pass --api-key=... or set NEYNAR_API_KEY');
}

function normalizeUrl(value: string): string {
  return String(value || '').trim().replace(/\/+$/, '');
}

async function main(): Promise<void> {
  const command = (process.argv[2] || 'ensure') as Command;
  if (!['ensure', 'list'].includes(command)) {
    throw new Error(`Unsupported command: ${command}`);
  }

  const apiKeyInfo = readApiKey();
  const botFidRaw = String(
    readArg('--bot-fid')
    || process.env.FARCASTER_AGENT_BOT_FID
    || process.env.KIKO_FARCASTER_FID
    || '',
  ).trim();
  const botFid = Number.parseInt(botFidRaw, 10);
  if (!Number.isFinite(botFid) || botFid <= 0) {
    throw new Error('Missing or invalid Farcaster bot FID. Pass --bot-fid=<fid> or set FARCASTER_AGENT_BOT_FID');
  }

  const callbackUrl = normalizeUrl(
    readArg('--url')
    || process.env.NEYNAR_WEBHOOK_CALLBACK_URL
    || 'https://api.kikoapp.app/api/webhook/neynar',
  );
  const webhookName = String(
    readArg('--name')
    || process.env.NEYNAR_WEBHOOK_NAME
    || 'kiko-farcaster-agent',
  ).trim();
  const botUsername = String(
    readArg('--bot-username')
    || process.env.FARCASTER_AGENT_BOT_USERNAME
    || process.env.KIKO_FARCASTER_USERNAME
    || 'kikoapp',
  ).trim();
  const subscription = buildNeynarMentionSubscription(botFid, botUsername);

  if (command === 'list') {
    const webhooks = await listNeynarWebhooks(apiKeyInfo.value);
    const matched = webhooks.find((item) => normalizeUrl(String(item.target_url || '')) === callbackUrl) || null;
    console.log(JSON.stringify({
      callbackUrl,
      apiKeySource: apiKeyInfo.source,
      matchedWebhookId: matched?.webhook_id || null,
      webhooks,
    }, null, 2));
    return;
  }

  const result = await ensureNeynarWebhook(apiKeyInfo.value, {
    name: webhookName,
    url: callbackUrl,
    subscription,
  });

  console.log(JSON.stringify({
    action: result.action,
    callbackUrl,
    apiKeySource: apiKeyInfo.source,
    webhookId: result.webhook.webhook_id || null,
    targetUrl: result.webhook.target_url || null,
    title: result.webhook.title || webhookName,
    subscription,
    active: result.webhook.active ?? null,
    createdAt: result.webhook.created_at || null,
    updatedAt: result.webhook.updated_at || null,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
