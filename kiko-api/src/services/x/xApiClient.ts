// CONTEXT MEMORY
// Updated: 2026-04-09
// Author: Almurat
// Reason: X outbound requests must resolve the current official bot token at
//         runtime, not assume a single static env-only credential.
// Goal: keep all X API calls using the same credential source and filtering
//       rules that the webhook and auth layers rely on.
// Owns: authenticated X REST access for bot replies, DM sends, and lookup calls.
// Does Not Own: OAuth exchange, webhook subscription setup, or chat orchestration.
// Design Language:
// - Resolve bot credentials through the shared credential service first.
// - Fail fast when bot identity or access token is absent.
// - Keep API URL construction and auth header formation centralized here.
// See also:
// - system-journal/INDEX.md
// - system-journal/fix-log/2026-04-09-x-oauth-official-account-flow.md
// - system-journal/fix-log/2026-04-09-auth-debug-cleanup.md
// - system-journal/conflicts.md
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import { getXBotAccessToken, getXBotUserId } from './xCredentialsService.js';
import type { XDirectMessageEvent, XMentionEvent, XSendResult } from './types.js';

function baseUrl(path: string): string {
  const base = String(env.x.apiBaseUrl || 'https://api.x.com/2').replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

function authHeaders() {
  const accessToken = getXBotAccessToken();
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
    conversationId: item?.conversation_id ? String(item.conversation_id) : null,
    createdAt: item?.created_at ? String(item.created_at) : null,
  };
}

function parseDirectMessage(item: any, usersById: Map<string, any>): XDirectMessageEvent | null {
  const id = String(item?.id || item?.dm_event_id || '').trim();
  const senderId = String(
    item?.sender_id ||
    item?.message_create?.sender_id ||
    item?.event?.sender_id ||
    '',
  ).trim();
  const text = String(
    item?.text ||
    item?.message_create?.message_data?.text ||
    item?.message_data?.text ||
    '',
  ).trim();
  if (!id || !senderId || !text) return null;
  const user = usersById.get(senderId);
  return {
    id,
    text,
    senderId,
    senderUsername: user?.username || null,
    dmConversationId: item?.dm_conversation_id
      ? String(item.dm_conversation_id)
      : (item?.conversation_id ? String(item.conversation_id) : null),
    createdAt: item?.created_at ? String(item.created_at) : null,
  };
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
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
        ['user.fields', 'username'],
      ])}`,
    );
    const payload = await requestJson<any>(url, { headers: authHeaders() });
    const usersById = new Map<string, any>((payload?.includes?.users || []).map((user: any) => [String(user.id), user]));
    return (payload?.data || [])
      .map((item: any) => parseMention(item, usersById))
      .filter(Boolean);
  }

  async fetchDirectMessages(params: { sinceId?: string | null }): Promise<XDirectMessageEvent[]> {
    if (!this.isConfigured()) return [];
    const url = baseUrl(
      `/dm_events${toSearchParams([
        ['since_id', params.sinceId || undefined],
        ['max_results', String(env.x.pollBatchSize || 20)],
        ['dm_event.fields', 'sender_id,created_at,dm_conversation_id,text'],
        ['expansions', 'sender_id'],
        ['user.fields', 'username'],
      ])}`,
    );
    const payload = await requestJson<any>(url, { headers: authHeaders() });
    const usersById = new Map<string, any>((payload?.includes?.users || []).map((user: any) => [String(user.id), user]));
    return (payload?.data || [])
      .map((item: any) => parseDirectMessage(item, usersById))
      .filter(Boolean);
  }

  async replyToMention(params: { tweetId: string; text: string }): Promise<XSendResult> {
    const payload = await requestJson<any>(baseUrl('/tweets'), {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        text: params.text,
        reply: { in_reply_to_tweet_id: params.tweetId },
      }),
    });
    return {
      id: payload?.data?.id ? String(payload.data.id) : null,
      raw: payload,
    };
  }

  async sendDirectMessage(params: { recipientId: string; text: string }): Promise<XSendResult> {
    const payload = await requestJson<any>(baseUrl(`/dm_conversations/with/${params.recipientId}/messages`), {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ text: params.text }),
    });
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
