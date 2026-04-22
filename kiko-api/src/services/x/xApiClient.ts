// CONTEXT MEMORY
// Updated: 2026-04-22
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
//         must be derived from both `verified` and `verified_type`. Social-agent
//         mention replies now also need hydrated thread/media context so the
//         model can reason over parent posts and attached images instead of only
//         the webhook's short text snapshot. X API v2 media upload is now used
//         for generated-image replies so public mention responses can attach
//         real media IDs instead of OGP/share links.
// Goal: keep all X API calls using the same credential source and filtering
//       rules that the webhook and auth layers rely on while exposing one
//       normalized tweet/thread hydration path for social-agent turns.
// Owns: authenticated X REST access for bot replies, mention confirmation,
//       tweet hydration, outbound media uploads, and outbound DM sends.
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
// - Hydrate X thread/media context through REST lookups after webhook intake;
//   do not pretend webhook payloads already contain model-ready context.
// - Generated-image replies must upload image bytes first, then attach returned
//   media IDs to POST /2/tweets.
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
// - Source: X expansions/media docs
// - Kind: official API doc
// - Retrieved: 2026-04-16
// - Applied To: tweet hydration with `attachments.media_keys`,
//   `referenced_tweets.id`, and `referenced_tweets.id.attachments.media_keys`
// - Verification: verified in docs
// See also:
// - system-journal/INDEX.md
// - system-journal/fix-log/2026-04-16-social-agent-thread-context-and-image-input.md
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
import type { XMediaAttachment, XMentionEvent, XSendResult, XTweetContext } from './types.js';

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

function bearerAuthHeaders(accessToken: string) {
  if (!accessToken) {
    throw new Error('X bot access token is not configured');
  }
  return {
    Authorization: `Bearer ${accessToken}`,
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

function parseMediaAttachment(media: any, sourceTweetId: string): XMediaAttachment | null {
  const mediaKey = String(media?.media_key || '').trim();
  const url = String(media?.url || media?.preview_image_url || '').trim();
  if (!mediaKey || !url) return null;
  return {
    mediaKey,
    type: String(media?.type || '').trim() || 'unknown',
    url,
    previewImageUrl: media?.preview_image_url ? String(media.preview_image_url).trim() : null,
    altText: media?.alt_text ? String(media.alt_text).trim() : null,
    width: Number.isFinite(media?.width) ? Number(media.width) : null,
    height: Number.isFinite(media?.height) ? Number(media.height) : null,
    sourceTweetId,
  };
}

function parseTweetContext(params: {
  item: any;
  usersById: Map<string, any>;
  mediaByKey: Map<string, any>;
  tweetsById: Map<string, any>;
}): XTweetContext | null {
  const item = params.item;
  const authorId = String(item?.author_id || '').trim();
  const id = String(item?.id || '').trim();
  const text = String(item?.text || '').trim();
  if (!id || !authorId || !text) return null;

  const author = params.usersById.get(authorId);
  const mediaKeys = Array.isArray(item?.attachments?.media_keys) ? item.attachments.media_keys : [];
  const media = mediaKeys
    .map((mediaKey: unknown) => parseMediaAttachment(params.mediaByKey.get(String(mediaKey || '').trim()), id))
    .filter((value: XMediaAttachment | null): value is XMediaAttachment => Boolean(value));

  const referencedTweets = Array.isArray(item?.referenced_tweets) ? item.referenced_tweets : [];
  const references = referencedTweets.map((reference: any) => {
    const referencedId = String(reference?.id || '').trim();
    const referencedItem = params.tweetsById.get(referencedId);
    const referencedAuthorId = String(referencedItem?.author_id || '').trim();
    const referencedAuthor = referencedAuthorId ? params.usersById.get(referencedAuthorId) : null;
    const referencedMediaKeys = Array.isArray(referencedItem?.attachments?.media_keys)
      ? referencedItem.attachments.media_keys
      : [];
    return {
      id: referencedId,
      text: String(referencedItem?.text || '').trim(),
      authorId: referencedAuthorId || null,
      authorUsername: referencedAuthor?.username ? String(referencedAuthor.username).trim() : null,
      relationship: String(reference?.type || '').trim() as XTweetContext['referencedTweets'][number]['relationship'],
      media: referencedMediaKeys
        .map((mediaKey: unknown) => parseMediaAttachment(params.mediaByKey.get(String(mediaKey || '').trim()), referencedId))
        .filter((value: XMediaAttachment | null): value is XMediaAttachment => Boolean(value)),
    };
  }).filter((reference: { id: string }) => reference.id);

  const parent = references.find((reference: { relationship: string }) => reference.relationship === 'replied_to') || null;

  return {
    id,
    text,
    authorId,
    authorUsername: author?.username ? String(author.username).trim() : null,
    conversationId: item?.conversation_id ? String(item.conversation_id).trim() : null,
    createdAt: item?.created_at ? String(item.created_at).trim() : null,
    parentTweetId: parent?.id || null,
    parentAuthorId: parent?.authorId || null,
    media,
    referencedTweets: references.map((reference: any) => ({
      ...reference,
      relationship: reference.relationship === 'replied_to'
        || reference.relationship === 'quoted'
        || reference.relationship === 'retweeted'
        ? reference.relationship
        : 'unknown',
    })),
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

  async fetchTweetContextByTweetId(tweetId: string): Promise<XTweetContext | null> {
    const id = String(tweetId || '').trim();
    if (!id || !this.isConfigured()) return null;

    const url = baseUrl(
      `/tweets/${id}${toSearchParams([
        ['tweet.fields', 'author_id,conversation_id,created_at,referenced_tweets,in_reply_to_user_id'],
        ['expansions', 'author_id,attachments.media_keys,referenced_tweets.id,referenced_tweets.id.author_id,referenced_tweets.id.attachments.media_keys'],
        ['user.fields', 'username'],
        ['media.fields', 'media_key,type,url,preview_image_url,alt_text,width,height'],
      ])}`,
    );
    const payload = await requestJson<any>(url, (accessToken) => ({
      headers: authHeaders(accessToken),
    }));

    const usersById = new Map<string, any>((payload?.includes?.users || []).map((user: any) => [String(user.id), user]));
    const mediaByKey = new Map<string, any>((payload?.includes?.media || []).map((media: any) => [String(media.media_key), media]));
    const tweetsById = new Map<string, any>((payload?.includes?.tweets || []).map((tweet: any) => [String(tweet.id), tweet]));

    return parseTweetContext({
      item: payload?.data || null,
      usersById,
      mediaByKey,
      tweetsById,
    });
  }

  async uploadTweetImage(params: { buffer: Buffer; contentType: string; fileName?: string | null }): Promise<string> {
    const contentType = String(params.contentType || '').trim().toLowerCase();
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(contentType)) {
      throw new Error(`Unsupported X tweet image content type: ${contentType || 'unknown'}`);
    }
    const form = new FormData();
    form.set('media_category', 'tweet_image');
    form.set('media_type', contentType);
    form.set('shared', 'false');
    const mediaBytes = params.buffer.buffer.slice(
      params.buffer.byteOffset,
      params.buffer.byteOffset + params.buffer.byteLength,
    ) as ArrayBuffer;
    form.set('media', new Blob([mediaBytes], { type: contentType }), params.fileName || 'kiko-generated-image');

    const payload = await requestJson<any>(baseUrl('/media/upload'), (accessToken) => ({
      method: 'POST',
      headers: bearerAuthHeaders(accessToken),
      body: form,
    }));
    const mediaId = String(payload?.data?.id || '').trim();
    if (!mediaId) {
      throw new Error('X media upload did not return a media id');
    }
    return mediaId;
  }

  async replyToMention(params: { tweetId: string; text: string; mediaIds?: string[] | null }): Promise<XSendResult> {
    const mediaIds = (Array.isArray(params.mediaIds) ? params.mediaIds : [])
      .map((id) => String(id || '').trim())
      .filter(Boolean)
      .slice(0, 4);
    const body: Record<string, any> = {
      text: params.text,
      reply: { in_reply_to_tweet_id: params.tweetId },
    };
    if (mediaIds.length > 0) {
      body.media = { media_ids: mediaIds };
    }
    const payload = await requestJson<any>(baseUrl('/tweets'), (accessToken) => ({
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify(body),
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
