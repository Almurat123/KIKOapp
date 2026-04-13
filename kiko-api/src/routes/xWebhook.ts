// CONTEXT MEMORY
// Updated: 2026-04-13
// Author: Almurat
// Reason: webhook ingress remains the production path for X mentions, but X DM
//         input is no longer a supported chat surface after runtime/document
//         evidence showed `chat.received` does not expose readable message text
//         through public APIs. The route still keeps raw-ingress audit logs so
//         operator debugging can distinguish "X never delivered" from "we chose
//         to ignore unsupported DM payloads".
//         Production runtime later showed legacy `tweet_create_events` webhook
//         payloads can carry X snowflake ids as bare JSON numbers; normal
//         `JSON.parse` loses precision for those ids, which made valid mentions
//         miss the bot mentions feed confirmation step by changing tweet/user ids.
// Goal: verify inbound X events, filter bot-authored noise, and hand off only
//       supported mention events to the internal conversation pipeline.
// Owns: X webhook CRC/signature handling, mention extraction, and inbound audit.
// Does Not Own: OAuth login, outbound token persistence, or chat execution.
// Design Language:
// - ACK fast and process asynchronously.
// - Fail closed on signature and bot identity checks.
// - Keep inbound mention parsing separate from session creation.
// - Log raw ingress metadata without logging sensitive DM/tweet body text.
// - Prefer current X Activity event envelopes, but keep legacy payload support
//   until platform delivery behavior is fully stable.
// - When delivery is empty, log payload structure, not body text, so parsing
//   gaps can be debugged without leaking private message contents.
// - Ignore inbound DM/chat events at the product layer; X DMs are outbound-only.
// - Preserve mention author verification metadata so worker policy can reject
//   non-verified accounts without extra lookup.
// - Treat only explicit `@bot` mentions as replyable inbound work; do not infer
//   reply eligibility from thread structure alone.
// - Do not trust raw webhook numeric snowflakes after plain `JSON.parse`; repair
//   legacy tweet event ids from the original raw body before mention extraction.
// Document Provenance:
// - Source: X Activity API docs + production lookup probes
// - Kind: official API doc | runtime observation
// - Retrieved: 2026-04-10
// - Applied To: disabling DM/chat webhook handling while preserving mention ingress
// - Verification: verified in runtime
// - Source: X users/mentions and user lookup docs
// - Kind: official API doc
// - Retrieved: 2026-04-10
// - Applied To: carrying `verified` into mention events so only verified accounts
//   can receive automated mention replies
// - Verification: partially verified
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-x-explicit-mention-only.md
// - Kind: runtime observation
// - Retrieved: 2026-04-10
// - Applied To: requiring explicit `@bot` mention per turn after X rejected implicit thread replies
// - Verification: verified in runtime
// - Source: production log `logs.1776056502806.json` + direct tweet/mentions API inspection
// - Kind: runtime observation
// - Retrieved: 2026-04-13
// - Applied To: repairing legacy webhook snowflake precision so valid mention ids
//   survive webhook parsing and match `/users/{botUserId}/mentions`
// - Verification: verified in runtime
// See also:
// - system-journal/INDEX.md
// - system-journal/fix-log/2026-04-10-x-explicit-mention-only.md
// - system-journal/fix-log/2026-04-13-x-webhook-snowflake-precision-repair.md
// - system-journal/fix-log/2026-04-09-x-oauth-official-account-flow.md
// - system-journal/fix-log/2026-04-10-x-webhook-ingress-audit.md
// - system-journal/fix-log/2026-04-10-x-webhook-empty-payload-audit.md
// - system-journal/fix-log/2026-04-10-x-dm-outbound-only.md
// - system-journal/fix-log/2026-04-09-auth-debug-cleanup.md
// - system-journal/conflicts.md
import crypto from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { safeSecretEquals } from './webhookHelpers.js';
import type { XDirectMessageEvent, XMentionEvent } from '../services/x/types.js';
import { xIngressWorker } from '../services/x/xIngressWorker.js';
import { getXBotUserId, getXBotUsername } from '../services/x/xCredentialsService.js';

interface XWebhookCrcQuery {
  crc_token?: string;
}

interface XActivityPayload {
  for_user_id?: string | number;
  tweet_create_events?: any[];
  direct_message_events?: any[];
  users?: Record<string, any> | any[];
  data?: any;
}

function toId(value: unknown): string {
  return String(value || '').trim();
}

function toUsername(value: unknown): string | null {
  const normalized = String(value || '').trim().replace(/^@/, '');
  return normalized || null;
}

function sampleIds<T>(items: T[], select: (item: T) => string | null | undefined): string[] {
  return items
    .map((item) => String(select(item) || '').trim())
    .filter(Boolean)
    .slice(0, 5);
}

function sampleObjectKeys(value: any): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.keys(value).slice(0, 12);
}

function sampleActivityEventTypes(payload: XActivityPayload): string[] {
  const items = extractModernActivityItems(payload);
  return items
    .map((item) => String(item?.event_type || '').trim())
    .filter(Boolean)
    .slice(0, 8);
}

function sampleModernPayloadKeys(payload: XActivityPayload): string[] {
  const first = extractModernActivityItems(payload)[0];
  return sampleObjectKeys(first?.payload || first?.data || null);
}

function buildUsersById(users: XActivityPayload['users']): Map<string, any> {
  if (Array.isArray(users)) {
    return new Map(users.map((user) => [toId((user as any)?.id || (user as any)?.id_str), user]));
  }
  if (users && typeof users === 'object') {
    return new Map(
      Object.entries(users).map(([id, user]) => [toId(id || (user as any)?.id || (user as any)?.id_str), user]),
    );
  }
  return new Map();
}

function textMentionsBot(text: string): boolean {
  const username = String(getXBotUsername() || env.x.botUsername || '').trim().replace(/^@/, '');
  if (!username) return false;
  return new RegExp(`(^|\\s)@${username}(\\b|\\s|$)`, 'i').test(text);
}

function eventMentionsBot(item: any): boolean {
  const mentions = Array.isArray(item?.entities?.user_mentions) ? item.entities.user_mentions : [];
  const username = String(getXBotUsername() || env.x.botUsername || '').trim().replace(/^@/, '').toLowerCase();
  const botUserId = String(getXBotUserId() || env.x.botUserId || '').trim();
  return mentions.some((entry: any) => {
    const mentionId = toId(entry?.id || entry?.id_str);
    const mentionUsername = String(entry?.username || entry?.screen_name || '').trim().replace(/^@/, '').toLowerCase();
    return (botUserId && mentionId === botUserId) || (username && mentionUsername === username);
  });
}

export function computeXWebhookCrcResponseToken(crcToken: string, secret: string): string {
  const digest = crypto.createHmac('sha256', secret).update(crcToken).digest('base64');
  return `sha256=${digest}`;
}

export function computeXWebhookSignature(rawBody: string, secret: string): string {
  const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  return `sha256=${digest}`;
}

export function verifyXWebhookSignature(signature: unknown, rawBody: string, secret: string): boolean {
  if (typeof signature !== 'string' || !signature || !secret) return false;
  return safeSecretEquals(signature, computeXWebhookSignature(rawBody, secret));
}

export function extractMentionEvents(payload: XActivityPayload): XMentionEvent[] {
  const usersById = buildUsersById(payload.users);
  const botUserId = String(getXBotUserId() || env.x.botUserId || '').trim();
  const items = Array.isArray(payload?.tweet_create_events) ? payload.tweet_create_events : [];

  const parsed: Array<XMentionEvent | null> = items.map((item): XMentionEvent | null => {
      const id = toId(item?.id || item?.id_str);
      const authorId = toId(item?.author_id || item?.user?.id || item?.user?.id_str);
      const text = String(item?.text || '').trim();
      if (!id || !authorId || !text) return null;
      if (botUserId && authorId === botUserId) return null;

      const shouldHandle = textMentionsBot(text) || eventMentionsBot(item);
      if (!shouldHandle) return null;

      const user = item?.user || usersById.get(authorId) || null;
      return {
        id,
        text,
        authorId,
        authorUsername: toUsername(user?.username || user?.screen_name),
        authorVerified: Boolean(user?.verified),
        conversationId: toId(item?.conversation_id || item?.conversation_id_str || item?.in_reply_to_status_id || item?.in_reply_to_status_id_str) || null,
        createdAt: String(item?.created_at || item?.created_timestamp || '').trim() || null,
      };
    });

  return parsed.filter((item): item is XMentionEvent => item !== null);
}

export function extractDirectMessageEvents(payload: XActivityPayload): XDirectMessageEvent[] {
  const usersById = buildUsersById(payload.users);
  const botUserId = String(getXBotUserId() || env.x.botUserId || '').trim();
  const items = Array.isArray(payload?.direct_message_events) ? payload.direct_message_events : [];

  const parsed: Array<XDirectMessageEvent | null> = items.map((item): XDirectMessageEvent | null => {
      const messageCreate = item?.message_create || {};
      const id = toId(item?.id || item?.dm_event_id);
      const senderId = toId(item?.sender_id || messageCreate?.sender_id || item?.event?.sender_id);
      const recipientId = toId(
        item?.target?.recipient_id
        || messageCreate?.target?.recipient_id
        || item?.message_create?.target?.recipient_id,
      );
      const text = String(
        item?.text
        || item?.message_data?.text
        || messageCreate?.message_data?.text
        || '',
      ).trim();
      if (!id || !senderId || !text) return null;
      if (botUserId && senderId === botUserId) return null;
      if (botUserId && recipientId && recipientId !== botUserId) return null;

      const user = usersById.get(senderId) || null;
      return {
        id,
        text,
        senderId,
        senderUsername: toUsername(user?.username || user?.screen_name),
        dmConversationId: toId(item?.dm_conversation_id || item?.conversation_id || recipientId || senderId) || null,
        createdAt: String(item?.created_at || item?.created_timestamp || '').trim() || null,
      };
    });

  return parsed.filter((item): item is XDirectMessageEvent => item !== null);
}

function extractModernActivityItems(payload: XActivityPayload): any[] {
  if (Array.isArray(payload?.data)) return payload.data;
  if (payload?.data && typeof payload.data === 'object') return [payload.data];
  return [];
}

function findJsonArraySource(rawBody: string, propertyName: string): string | null {
  const propertyToken = `"${propertyName}"`;
  const propertyIndex = rawBody.indexOf(propertyToken);
  if (propertyIndex < 0) return null;
  const arrayStart = rawBody.indexOf('[', propertyIndex);
  if (arrayStart < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = arrayStart; index < rawBody.length; index += 1) {
    const char = rawBody[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '[') {
      depth += 1;
      continue;
    }
    if (char === ']') {
      depth -= 1;
      if (depth === 0) {
        return rawBody.slice(arrayStart, index + 1);
      }
    }
  }
  return null;
}

function splitTopLevelObjectSources(arraySource: string): string[] {
  const objects: string[] = [];
  let objectStart = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < arraySource.length; index += 1) {
    const char = arraySource[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') {
      if (depth === 0) {
        objectStart = index;
      }
      depth += 1;
      continue;
    }
    if (char === '}') {
      depth -= 1;
      if (depth === 0 && objectStart >= 0) {
        objects.push(arraySource.slice(objectStart, index + 1));
        objectStart = -1;
      }
    }
  }
  return objects;
}

function extractRawSnowflake(objectSource: string, fieldNames: string[]): string | null {
  for (const fieldName of fieldNames) {
    const patterns = [
      new RegExp(`"${fieldName}"\\s*:\\s*"([0-9]{10,})"`),
      new RegExp(`"${fieldName}"\\s*:\\s*([0-9]{10,})`),
    ];
    for (const pattern of patterns) {
      const match = objectSource.match(pattern);
      if (match?.[1]) {
        return match[1];
      }
    }
  }
  return null;
}

function repairLegacyTweetSnowflakes(payload: XActivityPayload, rawBody: string): void {
  const items = Array.isArray(payload?.tweet_create_events) ? payload.tweet_create_events : [];
  if (items.length === 0) return;

  const arraySource = findJsonArraySource(rawBody, 'tweet_create_events');
  if (!arraySource) return;
  const objectSources = splitTopLevelObjectSources(arraySource);
  if (objectSources.length !== items.length) return;

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const source = objectSources[index];
    const rawId = extractRawSnowflake(source, ['id_str', 'id']);
    const rawAuthorId = extractRawSnowflake(source, ['author_id']);
    const rawConversationId = extractRawSnowflake(source, ['conversation_id_str', 'conversation_id']);
    const rawInReplyToStatusId = extractRawSnowflake(source, ['in_reply_to_status_id_str', 'in_reply_to_status_id']);
    const rawUserId = extractRawSnowflake(source, ['user_id_str', 'user_id']);

    if (rawId) {
      item.id = rawId;
      item.id_str = rawId;
    }
    if (rawAuthorId) {
      item.author_id = rawAuthorId;
    }
    if (rawConversationId) {
      item.conversation_id = rawConversationId;
      item.conversation_id_str = rawConversationId;
    }
    if (rawInReplyToStatusId) {
      item.in_reply_to_status_id = rawInReplyToStatusId;
      item.in_reply_to_status_id_str = rawInReplyToStatusId;
    }
    if (item?.user && rawUserId) {
      item.user.id = rawUserId;
      item.user.id_str = rawUserId;
    }
  }
}

function parseModernActivityDirectMessage(item: any): XDirectMessageEvent | null {
  const eventType = String(item?.event_type || '').trim().toLowerCase();
  if (!['dm.received', 'chat.received', 'dm.sent', 'chat.sent'].includes(eventType)) {
    return null;
  }

  const filterUserId = toId(item?.filter?.user_id);
  const payload = item?.payload || {};
  const botUserId = String(getXBotUserId() || env.x.botUserId || '').trim();
  const eventId = toId(item?.event_uuid || item?.id || payload?.id || payload?.dm_event_id || payload?.message_id);
  const text = String(
    payload?.text
    || payload?.message_data?.text
    || payload?.body?.text
    || payload?.content?.text
    || '',
  ).trim();
  const senderId = toId(
    payload?.sender_id
    || payload?.sender?.id
    || payload?.from_user_id
    || payload?.from?.id,
  );
  const conversationId = toId(
    payload?.dm_conversation_id
    || payload?.conversation_id
    || payload?.conversation?.id
    || item?.filter?.conversation_id,
  ) || null;
  const recipientId = toId(
    payload?.recipient_id
    || payload?.target?.recipient_id
    || payload?.to_user_id
    || payload?.to?.id
    || filterUserId,
  );
  const username = toUsername(
    payload?.sender?.username
    || payload?.sender_username
    || payload?.from?.username,
  );

  if (!eventId || !senderId) return null;
  if (botUserId && senderId === botUserId && eventType.endsWith('.sent')) return null;
  if (botUserId && senderId === botUserId) return null;
  if (botUserId && recipientId && recipientId !== botUserId && filterUserId !== botUserId) return null;

  const requiresLookup = !text && eventType === 'chat.received';
  if (!text && !requiresLookup) return null;

  return {
    id: eventId,
    text: text || null,
    senderId,
    senderUsername: username,
    dmConversationId: conversationId || recipientId || senderId || null,
    createdAt: String(
      payload?.created_at
      || payload?.created_timestamp
      || item?.created_at
      || '',
    ).trim() || null,
    sourceEventType: eventType,
    requiresLookup,
    lookupCreatedAtMs: String(payload?.created_at_msec || item?.created_at_msec || '').trim() || null,
  };
}

export function extractModernActivityDirectMessageEvents(payload: XActivityPayload): XDirectMessageEvent[] {
  return extractModernActivityItems(payload)
    .map((item) => parseModernActivityDirectMessage(item))
    .filter((item): item is XDirectMessageEvent => item !== null);
}

export async function xWebhookRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: XWebhookCrcQuery }>('/', async (request, reply) => {
    if (!env.x.enabled || env.x.ingressMode !== 'webhook') {
      return reply.status(503).send({ error: 'X webhook ingress disabled' });
    }

    const crcToken = String(request.query?.crc_token || '').trim();
    if (!crcToken) {
      return reply.status(400).send({ error: 'crc_token is required' });
    }
    if (!env.x.webhookSecret) {
      return reply.status(503).send({ error: 'X webhook secret not configured' });
    }

    return reply.send({
      response_token: computeXWebhookCrcResponseToken(crcToken, env.x.webhookSecret),
    });
  });

  fastify.post('/', { config: { rawBody: true } }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!env.x.enabled || env.x.ingressMode !== 'webhook') {
      return reply.status(503).send({ error: 'X webhook ingress disabled' });
    }
    if (!env.x.webhookSecret) {
      return reply.status(503).send({ error: 'X webhook secret not configured' });
    }

    const rawBody = String((request as any).rawBody || '');
    if (!rawBody) {
      return reply.status(400).send({ error: 'Missing raw body' });
    }

    const signature = request.headers['x-twitter-webhooks-signature'];
    if (!verifyXWebhookSignature(signature, rawBody, env.x.webhookSecret)) {
      return reply.status(401).send({ error: 'Invalid signature' });
    }

    let payload: XActivityPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return reply.status(400).send({ error: 'Invalid JSON body' });
    }

    repairLegacyTweetSnowflakes(payload, rawBody);

    const mentions = extractMentionEvents(payload);
    const ignoredDirectMessages = [
      ...extractDirectMessageEvents(payload),
      ...extractModernActivityDirectMessageEvents(payload),
    ];

    logger.info(LogCode.SYS_INFO, '[X] webhook ingress received', {
      forUserId: toId(payload.for_user_id),
      mentionCount: mentions.length,
      dmCount: ignoredDirectMessages.length,
      mentionIds: sampleIds(mentions, (item) => item.id),
      dmIds: sampleIds(ignoredDirectMessages, (item) => item.id),
      mentionAuthorIds: sampleIds(mentions, (item) => item.authorId),
      dmSenderIds: sampleIds(ignoredDirectMessages, (item) => item.senderId),
    });

    if (ignoredDirectMessages.length > 0) {
      logger.info(LogCode.SYS_INFO, '[X] webhook ingress ignored dm payload', {
        forUserId: toId(payload.for_user_id),
        ignoredDmCount: ignoredDirectMessages.length,
        activityEventTypes: sampleActivityEventTypes(payload),
      });
    }

    if (mentions.length === 0 && ignoredDirectMessages.length === 0) {
      logger.info(LogCode.SYS_INFO, '[X] webhook ingress empty payload', {
        forUserId: toId(payload.for_user_id),
        topLevelKeys: sampleObjectKeys(payload),
        legacyMentionEventCount: Array.isArray(payload?.tweet_create_events) ? payload.tweet_create_events.length : 0,
        legacyDmEventCount: Array.isArray(payload?.direct_message_events) ? payload.direct_message_events.length : 0,
        activityDataType: Array.isArray(payload?.data) ? 'array' : (payload?.data && typeof payload.data === 'object' ? 'object' : typeof payload?.data),
        activityItemCount: extractModernActivityItems(payload).length,
        activityEventTypes: sampleActivityEventTypes(payload),
        firstActivityPayloadKeys: sampleModernPayloadKeys(payload),
        rawBodyBytes: Buffer.byteLength(rawBody, 'utf8'),
      });
    }

    const accepted = await Promise.all([
      ...mentions.map((mention) => xIngressWorker.enqueueMention(mention)),
    ]);

    logger.info(LogCode.SYS_INFO, '[X] webhook ingress enqueued', {
      forUserId: toId(payload.for_user_id),
      mentionCount: mentions.length,
      dmCount: ignoredDirectMessages.length,
      acceptedCount: accepted.filter(Boolean).length,
    });

    return reply.send({
      ok: true,
      accepted: accepted.filter(Boolean).length,
    });
  });
}
