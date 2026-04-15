// CONTEXT MEMORY
// Updated: 2026-04-15
// Author: Linh Tran
// Reason: Neynar webhook ingress needs a dedicated owner for webhook CRUD,
//         signature verification, and mention normalization so the Farcaster
//         agent can move off unstable polling without duplicating event logic.
//         Reply-thread mentions must not depend on a single Neynar payload
//         shape; webhook filters are keyed by mentioned_fids, while deliveries
//         may expose mention identity as profiles, numeric fids, or mention
//         arrays. The subscription itself must follow Neynar's documented bot
//         pattern: `mentioned_fids` for direct @mentions plus
//         `parent_author_fids` for replies to the bot.
// Goal: create or update the single callback-bound webhook, verify signed
//       deliveries, and normalize cast.created mention/reply payloads into the
//       same FarcasterMentionEvent shape used by the worker.
// Owns: Neynar webhook list/create/update calls, webhook signature verification,
//       and webhook payload normalization for mention/reply delivery.
// Does Not Own: worker cadence, Hub fallback, reply publication, or social
//               search.
// Design Language:
// - Webhook creation must reuse the configured callback URL instead of spraying
//   duplicate registrations.
// - Incoming webhook deliveries must be verified with X-Neynar-Signature before
//   any mention enters the worker.
// - Webhook mention payloads must normalize into the existing FarcasterMentionEvent
//   shape so downstream dedupe and recovery stay unchanged.
// - Mention detection must accept `mentioned_profiles`, `mentioned_fids`, and
//   `mentions` payload forms; do not make reply-thread mentions depend on a
//   single Neynar response shape.
// - Webhook subscription should use Neynar's documented fid filters for both
//   direct mentions and replies-to-bot; route admission remains fid-based as a
//   second guard.
// - Only cast.created deliveries that actually mention or reply to the bot
//   should be admitted.
// Document Provenance:
// - Source: Neynar Documentation, Webhooks in Dashboard
// - Kind: official API doc
// - Retrieved: 2026-04-15
// - Applied To: webhook target URL shape and cast.created mention/reply delivery
// - Verification: verified in docs
// - Source: Neynar Documentation, Programmatic Webhooks
// - Kind: official API doc
// - Retrieved: 2026-04-15
// - Applied To: webhook list/create/update endpoints and target-url reuse
// - Verification: verified in docs
// - Source: Neynar "Listen for @bot Mentions" documentation
// - Kind: official API doc
// - Retrieved: 2026-04-15
// - Applied To: `mentioned_fids` + `parent_author_fids` subscription filters
// - Verification: verified in docs
// - Source: Neynar Documentation, Verify Webhooks with HMAC Signatures
// - Kind: official API doc
// - Retrieved: 2026-04-15
// - Applied To: X-Neynar-Signature HMAC verification and sha512/hex digest shape
// - Verification: verified in docs
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/owner-map/farcaster-neynar-webhook-ingress.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-farcaster-neynar-webhook-ingress.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
import crypto from 'node:crypto';
import { safeSecretEquals } from '../../routes/webhookHelpers.js';
import type { FarcasterMentionEvent } from './types.js';

const NEYNAR_WEBHOOK_API_BASE = 'https://api.neynar.com/v2/farcaster/webhook';

export interface NeynarWebhookSecretRecord {
  uid?: string | null;
  value?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
}

export interface NeynarWebhookSubscriptionFilters {
  'cast.created'?: Record<string, unknown>;
  'cast.deleted'?: Record<string, unknown>;
  'user.created'?: Record<string, unknown>;
  'user.updated'?: Record<string, unknown>;
  'follow.created'?: Record<string, unknown>;
  'follow.deleted'?: Record<string, unknown>;
  'reaction.created'?: Record<string, unknown>;
  'reaction.deleted'?: Record<string, unknown>;
  'trade.created'?: Record<string, unknown>;
}

export interface NeynarWebhookRecord {
  object?: string;
  webhook_id?: string;
  developer_uuid?: string | null;
  target_url?: string | null;
  title?: string | null;
  secrets?: NeynarWebhookSecretRecord[] | null;
  description?: string | null;
  http_timeout?: string | null;
  rate_limit?: number | null;
  active?: boolean | null;
  rate_limit_duration?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
  subscription?: {
    object?: string | null;
    subscription_id?: string | null;
    filters?: NeynarWebhookSubscriptionFilters | null;
    created_at?: string | null;
    updated_at?: string | null;
  } | null;
}

export interface NeynarWebhookEnvelope {
  type?: string | null;
  created_at?: number | string | null;
  data?: Record<string, any> | null;
  event?: {
    data?: Record<string, any> | null;
  } | null;
}

export interface NeynarWebhookEnsureResult {
  action: 'created' | 'updated';
  webhook: NeynarWebhookRecord;
}

function normalizeUrl(value: string): string {
  return String(value || '').trim().replace(/\/+$/, '');
}

function readJson<T>(responseText: string): T {
  try {
    return JSON.parse(responseText) as T;
  } catch {
    throw new Error(`Neynar API returned non-JSON payload: ${responseText.slice(0, 200)}`);
  }
}

async function neynarRequest<T>(params: {
  apiKey: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
}): Promise<T> {
  const response = await fetch(`${NEYNAR_WEBHOOK_API_BASE}${params.path}`, {
    method: params.method,
    headers: {
      'content-type': 'application/json',
      'x-api-key': params.apiKey,
    },
    body: params.body === undefined ? undefined : JSON.stringify(params.body),
  });

  const text = await response.text();
  const parsed = text ? readJson<any>(text) : null;
  if (!response.ok) {
    throw new Error(
      `[Neynar webhook] ${response.status} ${response.statusText} ${params.method} ${params.path} :: ${typeof parsed === 'string' ? parsed : JSON.stringify(parsed)}`
    );
  }
  return parsed as T;
}

function extractTargetUrl(record: NeynarWebhookRecord): string {
  return normalizeUrl(String(record.target_url || ''));
}

export function buildNeynarMentionSubscription(
  botFid: number,
  _botUsername?: string | null,
): NeynarWebhookSubscriptionFilters {
  const fid = Number.isFinite(botFid) && botFid > 0 ? Math.trunc(botFid) : 0;
  if (!fid) {
    throw new Error('Missing or invalid Farcaster bot FID for Neynar webhook subscription');
  }

  return {
    'cast.created': {
      mentioned_fids: [fid],
      parent_author_fids: [fid],
    },
  };
}

export function verifyNeynarWebhookSignature(signature: unknown, rawBody: string, secret: string): boolean {
  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  return safeSecretEquals(signature, expected);
}

function toIsoTimestamp(value?: string | number | null): string | null {
  if (value === null || value === undefined || value === '') return null;
  const raw = typeof value === 'number' ? value : Number(value);
  if (Number.isFinite(raw) && raw > 0) {
    return new Date(raw > 1e12 ? raw : raw * 1000).toISOString();
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function mentionArrayContainsFid(value: unknown, botFid: number): boolean {
  if (!Array.isArray(value) || !Number.isFinite(botFid) || botFid <= 0) {
    return false;
  }
  return value.some((item: any) => {
    if (typeof item === 'number' || typeof item === 'string') {
      return Number(item) === botFid;
    }
    return Number(item?.fid || item?.id || item?.profile?.fid || 0) === botFid;
  });
}

function toMentionType(cast: Record<string, any>, botFid: number): 'mentions' | 'replies' | null {
  const parentAuthorFid = Number(cast?.parent_author?.fid || cast?.parent_author_fid || 0);
  if (Number.isFinite(botFid) && botFid > 0 && parentAuthorFid === botFid) {
    return 'replies';
  }

  if (
    mentionArrayContainsFid(cast?.mentioned_profiles, botFid)
    || mentionArrayContainsFid(cast?.mentioned_fids, botFid)
    || mentionArrayContainsFid(cast?.mentions, botFid)
  ) {
    return 'mentions';
  }

  return null;
}

export function normalizeNeynarWebhookMention(
  payload: unknown,
  botFid: number,
): FarcasterMentionEvent | null {
  const item = payload as NeynarWebhookEnvelope | Record<string, any> | null | undefined;
  const type = String(item?.type || '').trim();
  if (type !== 'cast.created') {
    return null;
  }

  const cast = (item?.data || item?.event?.data || {}) as Record<string, any>;
  if (!cast || typeof cast !== 'object') {
    return null;
  }

  const mentionType = toMentionType(cast, botFid);
  if (!mentionType) {
    return null;
  }

  const castHash = String(cast?.hash || '').trim();
  const text = String(cast?.text || '').trim();
  const authorFid = Number(cast?.author?.fid || 0);
  if (!castHash || !text || !Number.isFinite(authorFid) || authorFid <= 0) {
    return null;
  }

  const parentHash = String(cast?.parent_hash || '').trim() || null;
  const parentAuthorFid = Number(cast?.parent_author?.fid || cast?.parent_author_fid || 0) || null;
  const threadHash = String(cast?.thread_hash || '').trim() || castHash;
  const timestamp = toIsoTimestamp(cast?.timestamp || item?.created_at || null);

  return {
    eventId: `farcaster:mention:${castHash}`,
    notificationType: mentionType,
    castHash,
    text,
    authorFid,
    authorUsername: String(cast?.author?.username || '').trim() || null,
    parentHash,
    parentAuthorFid,
    rootCastHash: threadHash,
    occurredAt: timestamp,
  };
}

export async function listNeynarWebhooks(apiKey: string): Promise<NeynarWebhookRecord[]> {
  const response = await neynarRequest<{ webhooks?: NeynarWebhookRecord[] }>({
    apiKey,
    path: '/list/',
    method: 'GET',
  });
  return Array.isArray(response.webhooks) ? response.webhooks : [];
}

export async function createNeynarWebhook(apiKey: string, params: {
  name: string;
  url: string;
  subscription: NeynarWebhookSubscriptionFilters;
}): Promise<NeynarWebhookRecord> {
  const response = await neynarRequest<{ webhook?: NeynarWebhookRecord }>({
    apiKey,
    path: '/',
    method: 'POST',
    body: {
      name: params.name,
      url: params.url,
      subscription: params.subscription,
    },
  });

  if (!response.webhook?.webhook_id) {
    throw new Error('Neynar did not return a webhook_id after creation');
  }

  return response.webhook;
}

export async function updateNeynarWebhook(apiKey: string, params: {
  webhookId: string;
  name: string;
  url: string;
  subscription: NeynarWebhookSubscriptionFilters;
}): Promise<NeynarWebhookRecord> {
  const response = await neynarRequest<{ webhook?: NeynarWebhookRecord }>({
    apiKey,
    path: '/',
    method: 'PUT',
    body: {
      webhook_id: params.webhookId,
      name: params.name,
      url: params.url,
      subscription: params.subscription,
    },
  });

  if (!response.webhook?.webhook_id) {
    throw new Error('Neynar did not return a webhook_id after update');
  }

  return response.webhook;
}

export async function ensureNeynarWebhook(apiKey: string, params: {
  name: string;
  url: string;
  subscription: NeynarWebhookSubscriptionFilters;
}): Promise<NeynarWebhookEnsureResult> {
  const desiredUrl = normalizeUrl(params.url);
  const existing = await listNeynarWebhooks(apiKey);
  const matched = existing.find((record) => extractTargetUrl(record) === desiredUrl) || null;

  if (matched?.webhook_id) {
    return {
      action: 'updated',
      webhook: await updateNeynarWebhook(apiKey, {
        webhookId: matched.webhook_id,
        name: params.name,
        url: params.url,
        subscription: params.subscription,
      }),
    };
  }

  return {
    action: 'created',
    webhook: await createNeynarWebhook(apiKey, {
      name: params.name,
      url: params.url,
      subscription: params.subscription,
    }),
  };
}
