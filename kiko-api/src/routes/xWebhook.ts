// CONTEXT MEMORY
// Updated: 2026-04-10
// Author: Almurat
// Reason: webhook ingress is now the production path for X mentions and DMs,
//         replacing polling while keeping fast ACK and async processing. Test
//         diagnostics now require a minimal raw-ingress audit trail so we can
//         distinguish "X never delivered" from "we failed after receipt".
// Goal: verify inbound X events, filter bot-authored noise, and hand off clean
//       events to the internal conversation pipeline.
// Owns: X webhook CRC/signature handling and event extraction.
// Does Not Own: OAuth login, outbound token persistence, or chat execution.
// Design Language:
// - ACK fast and process asynchronously.
// - Fail closed on signature and bot identity checks.
// - Keep inbound event parsing separate from session creation.
// - Log raw ingress metadata without logging sensitive DM/tweet body text.
// See also:
// - system-journal/INDEX.md
// - system-journal/fix-log/2026-04-09-x-oauth-official-account-flow.md
// - system-journal/fix-log/2026-04-10-x-webhook-ingress-audit.md
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

      const inReplyToUserId = toId(item?.in_reply_to_user_id || item?.in_reply_to_user_id_str);
      const shouldHandle = textMentionsBot(text) || eventMentionsBot(item) || (botUserId && inReplyToUserId === botUserId);
      if (!shouldHandle) return null;

      const user = item?.user || usersById.get(authorId) || null;
      return {
        id,
        text,
        authorId,
        authorUsername: toUsername(user?.username || user?.screen_name),
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

    const mentions = extractMentionEvents(payload);
    const directMessages = extractDirectMessageEvents(payload);

    logger.info(LogCode.SYS_INFO, '[X] webhook ingress received', {
      forUserId: toId(payload.for_user_id),
      mentionCount: mentions.length,
      dmCount: directMessages.length,
      mentionIds: sampleIds(mentions, (item) => item.id),
      dmIds: sampleIds(directMessages, (item) => item.id),
      mentionAuthorIds: sampleIds(mentions, (item) => item.authorId),
      dmSenderIds: sampleIds(directMessages, (item) => item.senderId),
    });

    const accepted = await Promise.all([
      ...mentions.map((mention) => xIngressWorker.enqueueMention(mention)),
      ...directMessages.map((event) => xIngressWorker.enqueueDirectMessage(event)),
    ]);

    logger.info(LogCode.SYS_INFO, '[X] webhook ingress enqueued', {
      forUserId: toId(payload.for_user_id),
      mentionCount: mentions.length,
      dmCount: directMessages.length,
      acceptedCount: accepted.filter(Boolean).length,
    });

    return reply.send({
      ok: true,
      accepted: accepted.filter(Boolean).length,
    });
  });
}
