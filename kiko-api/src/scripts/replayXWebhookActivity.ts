// CONTEXT MEMORY
// Updated: 2026-04-10
// Author: Almurat
// Reason: real-time X DM delivery became ambiguous even with a valid webhook
//         and subscription, so operators need a platform-side replay tool to
//         distinguish missed delivery from local parsing failures using the
//         current webhooks replay endpoint.
// Goal: trigger a webhook replay job against the exact registered webhook
//       without mutating webhook registration or user subscriptions.
// Owns: operator-triggered X webhook replay requests.
// Does Not Own: webhook creation, subscription creation, or event ingestion.
// Design Language:
// - Reuse the registered callback URL to resolve the webhook id.
// - Use app bearer auth exactly as documented for replay jobs.
// - Default to a safe UTC replay window ending 31 minutes ago.
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-x-webhook-replay-script.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-x-webhook-ingress-audit.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface XWebhookRecord {
  id: string;
  url: string;
  valid?: boolean;
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

function readArg(name: string): string | null {
  const prefix = `${name}=`;
  const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function formatUtcMinute(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mi = String(date.getUTCMinutes()).padStart(2, '0');
  return `${yyyy}${mm}${dd}${hh}${mi}`;
}

function safeJsonParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function xRequest<T>(url: string, init?: RequestInit, headers?: Record<string, string>): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(headers || {}),
      ...(init?.headers as Record<string, string> | undefined || {}),
    },
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

async function listWebhooks(appBearerToken: string): Promise<XWebhookRecord[]> {
  const result = await xRequest<{ data?: XWebhookRecord[] }>(
    'https://api.x.com/2/webhooks',
    { method: 'GET' },
    { Authorization: `Bearer ${appBearerToken}` },
  );
  return Array.isArray(result?.data) ? result.data : [];
}

function resolveWindow(): { fromDate: string; toDate: string } {
  const explicitFrom = readArg('from_date');
  const explicitTo = readArg('to_date');
  if (explicitFrom && explicitTo) {
    return { fromDate: explicitFrom, toDate: explicitTo };
  }

  const now = new Date();
  const to = new Date(now.getTime() - 31 * 60 * 1000);
  const from = new Date(to.getTime() - 2 * 60 * 60 * 1000);
  return {
    fromDate: formatUtcMinute(from),
    toDate: formatUtcMinute(to),
  };
}

async function main() {
  const appBearerToken = requireEnv('X_APP_BEARER_TOKEN');
  const callbackUrl = normalizeUrl(process.env.X_WEBHOOK_CALLBACK_URL || 'https://api.kikoapp.app/api/webhook/x');
  const webhooks = await listWebhooks(appBearerToken);
  const webhook = webhooks.find((item) => normalizeUrl(item.url) === callbackUrl);
  if (!webhook?.id) {
    throw new Error(`No webhook found for callback URL: ${callbackUrl}`);
  }

  const { fromDate, toDate } = resolveWindow();
  const result = await xRequest<{ created_at: string; job_id: string }>(
    'https://api.x.com/2/webhooks/replay',
    {
      method: 'POST',
      body: JSON.stringify({
        webhook_id: webhook.id,
        from_date: fromDate,
        to_date: toDate,
      }),
    },
    { Authorization: `Bearer ${appBearerToken}` },
  );

  console.log(JSON.stringify({
    callbackUrl,
    webhookId: webhook.id,
    webhookValid: webhook.valid ?? null,
    fromDate,
    toDate,
    replayJob: result,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
