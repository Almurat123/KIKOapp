// CONTEXT MEMORY
// Updated: 2026-04-13
// Author: Almurat
// Reason: X outbound requests must resolve the current official bot token at
//         runtime, not assume a single static env-only credential, and must
//         survive OAuth2 bearer expiry without operator re-authorization; stale
//         credentials must now fail loudly instead of silently retrying with
//         known-expired tokens. The X channel is now outbound-only for DMs:
//         KIKO may send direct messages, but it no longer attempts to read or
//         reconstruct inbound XChat message text from webhook events. Mention
//         intake also needs author verification metadata so policy can ignore
//         non-verified accounts before starting expensive agent work. Runtime
//         evidence later showed webhook-delivered tweet events can still fail at
//         outbound reply time unless the same tweet is visible in the bot's
//         official mentions feed, so this client now owns the "is this really in
//         `/users/:id/mentions`?" confirmation helper. Later runtime checks also
//         showed blue-check users can be misreported as `verified=false` unless
//         `verified_type` is explicitly requested, so mention author verification
//         must be derived from both `verified` and `verified_type`.
// Goal: keep all X API calls using the same credential source and filtering
//       rules that the webhook and auth layers rely on.
// Owns: authenticated X REST access for bot replies, mention confirmation, and
//       outbound DM sends.
// Does Not Own: OAuth exchange, webhook subscription setup, or chat orchestration.
// Design Language:
// - Resolve bot credentials through the shared credential service first.
// - Fail fast when bot identity or access token is absent.
// - Keep API URL construction and auth header formation centralized here.
// - Retry once after OAuth2 refresh when X returns 401 for outbound bot calls.
// - Never re-use a stale OAuth2 token after refresh failed or config is missing.
// - Treat inbound X DM/chat content as unsupported product surface until X
//   exposes a documented readable path for XChat payloads.
// - Always request enough mention author metadata to enforce reply policy in
//   the worker layer.
// - Do not treat webhook ingress alone as proof that a tweet is replyable;
//   confirm replyable mention candidates against the bot's mentions feed.
// - Treat blue/business/government `verified_type` as verified mention authors;
//   do not rely on legacy `verified` alone.
// Document Provenance:
// - Source: X Direct Messages API docs (Send DM / lookup docs)
// - Kind: official API doc
// - Retrieved: 2026-04-10
// - Applied To: keep outbound DM sends while removing unsupported inbound chat lookup
// - Verification: partially verified
// - Source: production webhook + lookup logs
// - Kind: runtime observation
// - Retrieved: 2026-04-10
// - Applied To: confirmed `chat.received` arrives without readable text and public
//   lookup endpoints returned no usable DM body
// - Verification: verified in runtime
// - Source: X users/mentions API docs + production 403 reply logs
// - Kind: official API doc | runtime observation
// - Retrieved: 2026-04-13
// - Applied To: requiring a `/users/{botUserId}/mentions` confirmation before
//   treating a webhook mention as reply-eligible
// - Verification: partially verified
// - Source: direct `/users/{botUserId}/mentions` and `/users/{authorId}` API
//   comparison for user `1920347546704097280`
// - Kind: runtime observation
// - Retrieved: 2026-04-13
// - Applied To: requesting `verified_type` and using it as the canonical blue
//   verification signal for mention filtering
// - Verification: verified in runtime
// See also:
// - system-journal/INDEX.md
// - system-journal/fix-log/2026-04-09-x-oauth-official-account-flow.md
// - system-journal/fix-log/2026-04-10-x-oauth2-refresh-runtime.md
// - system-journal/fix-log/2026-04-10-x-expired-bot-token-hard-fail.md
// - system-journal/fix-log/2026-04-10-x-dm-outbound-only.md
// - system-journal/fix-log/2026-04-13-x-mention-feed-confirmation.md
// - system-journal/fix-log/2026-04-13-x-blue-verified-type-gate.md
// - system-journal/fix-log/2026-04-09-auth-debug-cleanup.md
// - system-journal/conflicts.md
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import { getXBotAccessToken, getXBotUserId, refreshXBotAccessToken } from './xCredentialsService.js';
import type { XMentionEvent, XSendResult } from './types.js';

function normalizeVerifiedType(value: unknown): string | null {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized || null;
}

function isVerifiedAuthor(user: any): boolean {
  const verifiedType = normalizeVerifiedType(user?.verified_type);
  if (user?.verified === true) return true;
  return verifiedType === 'blue' || verifiedType === 'business' || verifiedType === 'government';
}

function baseUrl(path: string): string {
  const base = String(env.x.apiBaseUrl || 'https://api.x.com/2').replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

function authHeaders(accessToken: string) {
  if (!accessToken) {
    throw new Error('X bot access token is not configured');
  }
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

function toSearchParams(entries: Array<[string, string | undefined]>): string {
  const params = new URLSearchParams();
  for (const [key, value] of entries) {
    if (value) params.set(key, value);
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}

function parseMention(item: any, usersById: Map<string, any>): XMentionEvent | null {
  const authorId = String(item?.author_id || '').trim();
  const id = String(item?.id || '').trim();
  const text = String(item?.text || '').trim();
  if (!id || !authorId || !text) return null;
  const user = usersById.get(authorId);
  return {
    id,
    text,
    authorId,
    authorUsername: user?.username || null,
    authorVerified: isVerifiedAuthor(user),
    authorVerifiedType: normalizeVerifiedType(user?.verified_type),
    conversationId: item?.conversation_id ? String(item.conversation_id) : null,
    createdAt: item?.created_at ? String(item.created_at) : null,
  };
}

function decrementSnowflake(id: string): string | null {
  try {
    const numeric = BigInt(String(id || '').trim());
    if (numeric <= 0n) return null;
    return String(numeric - 1n);
  } catch {
    return null;
  }
}


async function requestJson<T>(
  url: string,
  buildInit: (accessToken: string) => RequestInit,
): Promise<T> {
  const initialState = await refreshXBotAccessToken({ requireFresh: true });
  const initialToken = initialState?.accessToken || getXBotAccessToken();
  if (!initialToken) {
    throw new Error('X bot access token is not configured');
  }

  let response = await fetch(url, buildInit(initialToken));
  if (response.status === 401) {
    const refreshedState = await refreshXBotAccessToken({ force: true, requireFresh: true });
    const refreshedToken = refreshedState?.accessToken || getXBotAccessToken();
    if (refreshedToken && refreshedToken !== initialToken) {
      response = await fetch(url, buildInit(refreshedToken));
    }
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`X API ${response.status}: ${body.slice(0, 240)}`);
  }
  return response.json() as Promise<T>;
}

export class XApiClient {
  isConfigured(): boolean {
    return Boolean(env.x.enabled && getXBotAccessToken() && getXBotUserId());
  }

  async fetchMentions(params: { sinceId?: string | null }): Promise<XMentionEvent[]> {
    const botUserId = getXBotUserId();
    if (!this.isConfigured() || !botUserId) return [];
    const url = baseUrl(
      `/users/${botUserId}/mentions${toSearchParams([
        ['since_id', params.sinceId || undefined],
        ['max_results', String(env.x.pollBatchSize || 20)],
        ['tweet.fields', 'author_id,conversation_id,created_at'],
        ['expansions', 'author_id'],
        ['user.fields', 'username,verified,verified_type'],
      ])}`,
    );
    const payload = await requestJson<any>(url, (accessToken) => ({
      headers: authHeaders(accessToken),
    }));
    const usersById = new Map<string, any>((payload?.includes?.users || []).map((user: any) => [String(user.id), user]));
    return (payload?.data || [])
      .map((item: any) => parseMention(item, usersById))
      .filter(Boolean);
  }

  async fetchMentionByTweetId(tweetId: string): Promise<XMentionEvent | null> {
    const id = String(tweetId || '').trim();
    if (!id) return null;
    const sinceId = decrementSnowflake(id);
    const mentions = await this.fetchMentions({ sinceId });
    return mentions.find((item) => item.id === id) || null;
  }

  async replyToMention(params: { tweetId: string; text: string }): Promise<XSendResult> {
    const payload = await requestJson<any>(baseUrl('/tweets'), (accessToken) => ({
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify({
        text: params.text,
        reply: { in_reply_to_tweet_id: params.tweetId },
      }),
    }));
    return {
      id: payload?.data?.id ? String(payload.data.id) : null,
      raw: payload,
    };
  }

  async sendDirectMessage(params: { recipientId: string; text: string }): Promise<XSendResult> {
    const payload = await requestJson<any>(
      baseUrl(`/dm_conversations/with/${params.recipientId}/messages`),
      (accessToken) => ({
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ text: params.text }),
      }),
    );
    return {
      id: payload?.data?.dm_event_id
        ? String(payload.data.dm_event_id)
        : (payload?.data?.id ? String(payload.data.id) : null),
      raw: payload,
    };
  }

  buildBindingPrompt(username?: string | null): string {
    const label = username ? `@${String(username).replace(/^@/, '')}` : 'your account';
    return `Link ${label} in KIKO first, then mention me again: ${env.x.linkBaseUrl}`;
  }
}

export const xApiClient = new XApiClient();

export function logXApiDisabled(reason: string): void {
  logger.info(LogCode.API_NOTIFY_FAILED, '[X] API disabled', { reason });
}
