import prisma from '../../db/prisma.js';
import cacheClient from '../../cache/cacheClient.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import { buildXLinkUrl, getUserByXUserId } from './xIdentityService.js';
import { findOrCreateXConversation, markXConversationInbound } from './xConversationService.js';
import { recordXQuotaMetric } from './xQuotaService.js';
import { enqueueXAgentMessage, waitForTaskAssistantText } from './xChatBridge.js';
import { xApiClient } from './xApiClient.js';
import { xReplyService } from './xReplyService.js';
import type { XDirectMessageEvent, XMentionEvent } from './types.js';

const MENTION_CURSOR_KEY = 'x:ingress:mentions:since_id';
const DM_CURSOR_KEY = 'x:ingress:dm:since_id';
const RECOVERY_BATCH_SIZE = Math.max(1, Number(process.env.X_WEBHOOK_RECOVERY_BATCH_SIZE || '20'));

function sortByNumericId<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    try {
      return Number(BigInt(a.id) - BigInt(b.id));
    } catch {
      return a.id.localeCompare(b.id);
    }
  });
}

function publicAckText(): string {
  return 'Received. I sent the details in DM.';
}

function publicBindText(username?: string | null): string {
  return `Link your X account in KIKO first: ${buildXLinkUrl({ username })}`;
}

function trimForPublicReply(text: string): string {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= 260) return normalized;
  return `${normalized.slice(0, 257)}...`;
}

function normalizeMentionPayload(payload: unknown): XMentionEvent | null {
  const item = payload as any;
  const id = String(item?.id || '').trim();
  const authorId = String(item?.authorId || item?.author_id || '').trim();
  const text = String(item?.text || '').trim();
  if (!id || !authorId || !text) return null;
  return {
    id,
    text,
    authorId,
    authorUsername: item?.authorUsername || item?.author_username || null,
    conversationId: item?.conversationId || item?.conversation_id || null,
    createdAt: item?.createdAt || item?.created_at || null,
  };
}

function normalizeDirectMessagePayload(payload: unknown): XDirectMessageEvent | null {
  const item = payload as any;
  const id = String(item?.id || '').trim();
  const senderId = String(item?.senderId || item?.sender_id || '').trim();
  const text = String(item?.text || '').trim();
  if (!id || !senderId || !text) return null;
  return {
    id,
    text,
    senderId,
    senderUsername: item?.senderUsername || item?.sender_username || null,
    dmConversationId: item?.dmConversationId || item?.dm_conversation_id || null,
    createdAt: item?.createdAt || item?.created_at || null,
  };
}

export async function createInboundEventLog(params: {
  eventId: string;
  xUserId: string;
  channel: 'mention' | 'dm';
  sourceId?: string | null;
  payload: unknown;
  userId?: string | null;
}) {
  try {
    const record = await prisma.xEventLog.create({
      data: {
        eventId: params.eventId,
        userId: params.userId || null,
        xUserId: params.xUserId,
        channel: params.channel,
        direction: 'inbound',
        sourceId: params.sourceId || null,
        payload: params.payload as any,
        status: 'received',
      },
    });
    return { accepted: true, record };
  } catch (error: any) {
    if (error?.code === 'P2002') return { accepted: false, record: null };
    throw error;
  }
}

async function claimInboundEvent(eventId: string): Promise<boolean> {
  const result = await prisma.xEventLog.updateMany({
    where: {
      eventId,
      direction: 'inbound',
      status: 'received',
    },
    data: {
      status: 'processing',
    },
  });
  return result.count > 0;
}

export async function markInboundProcessed(eventId: string, status: 'processed' | 'failed', error?: unknown) {
  await prisma.xEventLog.updateMany({
    where: { eventId },
    data: {
      status,
      processedAt: new Date(),
      errorMessage: error ? String((error as any)?.message || error || 'unknown_error').slice(0, 500) : null,
    },
  }).catch(() => {});
}

export class XIngressWorker {
  private mentionsTimer: NodeJS.Timeout | null = null;
  private dmTimer: NodeJS.Timeout | null = null;
  private recoveryTimer: NodeJS.Timeout | null = null;
  private runningMentions = false;
  private runningDm = false;
  private runningRecovery = false;

  start(): void {
    if (!env.x.enabled) return;
    if (env.x.ingressMode === 'polling') {
      this.scheduleMentions(1000);
      this.scheduleDm(1500);
    }
    this.scheduleRecovery(2000);
    logger.info(LogCode.SYS_STARTUP, '[X] ingress worker started', {
      mode: env.x.ingressMode,
      botUserId: env.x.botUserId || null,
      pollMentionsMs: env.x.pollMentionsMs,
      pollDmMs: env.x.pollDmMs,
      webhookRecoveryMs: env.x.webhookRecoveryMs,
    });
  }

  stop(): void {
    if (this.mentionsTimer) clearTimeout(this.mentionsTimer);
    if (this.dmTimer) clearTimeout(this.dmTimer);
    if (this.recoveryTimer) clearTimeout(this.recoveryTimer);
    this.mentionsTimer = null;
    this.dmTimer = null;
    this.recoveryTimer = null;
  }

  async enqueueMention(mention: XMentionEvent): Promise<boolean> {
    const accepted = await createInboundEventLog({
      eventId: mention.id,
      xUserId: mention.authorId,
      channel: 'mention',
      sourceId: mention.conversationId || mention.id,
      payload: mention,
    });
    if (!accepted.accepted) return false;
    this.kickMentionProcessing(mention);
    return true;
  }

  async enqueueDirectMessage(event: XDirectMessageEvent): Promise<boolean> {
    const accepted = await createInboundEventLog({
      eventId: event.id,
      xUserId: event.senderId,
      channel: 'dm',
      sourceId: event.dmConversationId || event.id,
      payload: event,
    });
    if (!accepted.accepted) return false;
    this.kickDirectMessageProcessing(event);
    return true;
  }

  async pollMentionsOnce(): Promise<void> {
    if (this.runningMentions || env.x.ingressMode !== 'polling' || !xApiClient.isConfigured()) return;
    this.runningMentions = true;
    try {
      const sinceId = await cacheClient.get(MENTION_CURSOR_KEY).catch(() => null);
      const mentions = sortByNumericId(await xApiClient.fetchMentions({ sinceId }));
      for (const mention of mentions) {
        await this.enqueueMention(mention);
      }
      const latestId = mentions.at(-1)?.id;
      if (latestId) {
        await cacheClient.set(MENTION_CURSOR_KEY, latestId, 7 * 24 * 60 * 60).catch(() => {});
      }
    } finally {
      this.runningMentions = false;
    }
  }

  async pollDirectMessagesOnce(): Promise<void> {
    if (this.runningDm || env.x.ingressMode !== 'polling' || !xApiClient.isConfigured()) return;
    this.runningDm = true;
    try {
      const sinceId = await cacheClient.get(DM_CURSOR_KEY).catch(() => null);
      const events = sortByNumericId(await xApiClient.fetchDirectMessages({ sinceId }));
      for (const event of events) {
        if (String(event.senderId) === String(env.x.botUserId)) continue;
        await this.enqueueDirectMessage(event);
      }
      const latestId = events.at(-1)?.id;
      if (latestId) {
        await cacheClient.set(DM_CURSOR_KEY, latestId, 7 * 24 * 60 * 60).catch(() => {});
      }
    } finally {
      this.runningDm = false;
    }
  }

  async recoverPendingEventsOnce(): Promise<void> {
    if (this.runningRecovery || !env.x.enabled) return;
    this.runningRecovery = true;
    try {
      const rows = await prisma.xEventLog.findMany({
        where: {
          direction: 'inbound',
          status: 'received',
        },
        orderBy: { createdAt: 'asc' },
        take: RECOVERY_BATCH_SIZE,
      });

      for (const row of rows) {
        if (row.channel === 'mention') {
          const mention = normalizeMentionPayload(row.payload);
          if (!mention) {
            await markInboundProcessed(row.eventId, 'failed', new Error('invalid_mention_payload'));
            continue;
          }
          this.kickMentionProcessing(mention);
          continue;
        }

        const directMessage = normalizeDirectMessagePayload(row.payload);
        if (!directMessage) {
          await markInboundProcessed(row.eventId, 'failed', new Error('invalid_dm_payload'));
          continue;
        }
        this.kickDirectMessageProcessing(directMessage);
      }
    } finally {
      this.runningRecovery = false;
    }
  }

  private scheduleMentions(delayMs: number): void {
    this.mentionsTimer = setTimeout(async () => {
      await this.pollMentionsOnce().catch((error) => {
        logger.warn(LogCode.API_NOTIFY_FAILED, '[X] mention poll failed', {
          error: String((error as any)?.message || error || 'unknown_error'),
        });
      });
      this.scheduleMentions(env.x.pollMentionsMs);
    }, delayMs);
  }

  private scheduleDm(delayMs: number): void {
    this.dmTimer = setTimeout(async () => {
      await this.pollDirectMessagesOnce().catch((error) => {
        logger.warn(LogCode.API_NOTIFY_FAILED, '[X] dm poll failed', {
          error: String((error as any)?.message || error || 'unknown_error'),
        });
      });
      this.scheduleDm(env.x.pollDmMs);
    }, delayMs);
  }

  private scheduleRecovery(delayMs: number): void {
    this.recoveryTimer = setTimeout(async () => {
      await this.recoverPendingEventsOnce().catch((error) => {
        logger.warn(LogCode.API_NOTIFY_FAILED, '[X] webhook recovery failed', {
          error: String((error as any)?.message || error || 'unknown_error'),
        });
      });
      this.scheduleRecovery(env.x.webhookRecoveryMs);
    }, delayMs);
  }

  private kickMentionProcessing(mention: XMentionEvent): void {
    void this.processMentionRecorded(mention).catch((error) => {
      logger.warn(LogCode.API_NOTIFY_FAILED, '[X] mention processing failed', {
        eventId: mention.id,
        error: String((error as any)?.message || error || 'unknown_error'),
      });
    });
  }

  private kickDirectMessageProcessing(event: XDirectMessageEvent): void {
    void this.processDirectMessageRecorded(event).catch((error) => {
      logger.warn(LogCode.API_NOTIFY_FAILED, '[X] dm processing failed', {
        eventId: event.id,
        error: String((error as any)?.message || error || 'unknown_error'),
      });
    });
  }

  private async processMentionRecorded(mention: XMentionEvent): Promise<void> {
    const claimed = await claimInboundEvent(mention.id);
    if (!claimed) return;
    try {
      await this.handleMentionBusiness(mention);
      await markInboundProcessed(mention.id, 'processed');
    } catch (error) {
      await markInboundProcessed(mention.id, 'failed', error);
      throw error;
    }
  }

  private async processDirectMessageRecorded(event: XDirectMessageEvent): Promise<void> {
    const claimed = await claimInboundEvent(event.id);
    if (!claimed) return;
    try {
      await this.handleDirectMessageBusiness(event);
      await markInboundProcessed(event.id, 'processed');
    } catch (error) {
      await markInboundProcessed(event.id, 'failed', error);
      throw error;
    }
  }

  private async handleMentionBusiness(mention: XMentionEvent): Promise<void> {
    const user = await getUserByXUserId(mention.authorId);
    if (!user?.privyDid) {
      await xReplyService.replyToMention({
        xUserId: mention.authorId,
        tweetId: mention.id,
        text: publicBindText(mention.authorUsername),
        idempotencyKey: `x:reply:bind:${mention.id}`,
      });
      return;
    }

    const messageQuota = await recordXQuotaMetric({ userId: user.privyDid, metric: 'messages' });
    const runQuota = await recordXQuotaMetric({ userId: user.privyDid, metric: 'agent_runs' });
    if (!messageQuota.allowed || !runQuota.allowed) {
      await xReplyService.replyToMention({
        userId: user.privyDid,
        xUserId: mention.authorId,
        tweetId: mention.id,
        text: 'Daily X usage limit reached. Continue in the KIKO app tomorrow or raise your plan limit.',
        idempotencyKey: `x:reply:quota:${mention.id}`,
      });
      return;
    }

    const dmCapable = Boolean(user.xDmOptInAt && !user.xNotificationsMutedAt);
    if (!dmCapable) {
      await xReplyService.replyToMention({
        userId: user.privyDid,
        xUserId: mention.authorId,
        tweetId: mention.id,
        text: publicBindText(mention.authorUsername),
        idempotencyKey: `x:reply:dmoptin:${mention.id}`,
      });
      return;
    }

    const mapping = await findOrCreateXConversation({
      userId: user.privyDid,
      xUserId: mention.authorId,
      xUsername: mention.authorUsername || user.xUsername || null,
      channel: 'mention',
      rootTweetId: mention.conversationId || mention.id,
    });
    await markXConversationInbound({
      mappingId: mapping.id,
      eventId: mention.id,
      messageId: mention.id,
      username: mention.authorUsername || user.xUsername || null,
    });

    const queued = await enqueueXAgentMessage({
      userId: user.privyDid,
      sessionId: mapping.chatSessionId,
      content: mention.text,
      channel: 'mention',
      xUserId: mention.authorId,
      xUsername: mention.authorUsername || user.xUsername || null,
      sourceMessageId: mention.id,
      rootTweetId: mention.conversationId || mention.id,
    });
    const assistantText = queued.completedSynchronously
      ? queued.assistantContent
      : await waitForTaskAssistantText({
          taskId: queued.task?.id,
          assistantMessageId: queued.assistantMessage.id,
        });

    const dmSent = await xReplyService.sendDirectMessage({
      userId: user.privyDid,
      xUserId: mention.authorId,
      conversationMappingId: mapping.id,
      text: assistantText,
      sourceMessageId: mention.id,
      idempotencyKey: `x:dm:mention:${mention.id}`,
      incrementRoundTrip: false,
    });

    await xReplyService.replyToMention({
      userId: user.privyDid,
      xUserId: mention.authorId,
      tweetId: mention.id,
      conversationMappingId: mapping.id,
      text: dmSent ? publicAckText() : trimForPublicReply(assistantText),
      idempotencyKey: `x:reply:mention:${mention.id}`,
    });
  }

  private async handleDirectMessageBusiness(event: XDirectMessageEvent): Promise<void> {
    const user = await getUserByXUserId(event.senderId);
    if (!user?.privyDid) {
      await xReplyService.sendDirectMessage({
        xUserId: event.senderId,
        text: publicBindText(event.senderUsername),
        sourceMessageId: event.id,
        idempotencyKey: `x:dm:bind:${event.id}`,
        incrementRoundTrip: false,
      });
      return;
    }

    const messageQuota = await recordXQuotaMetric({ userId: user.privyDid, metric: 'messages' });
    const runQuota = await recordXQuotaMetric({ userId: user.privyDid, metric: 'agent_runs' });
    if (!messageQuota.allowed || !runQuota.allowed) {
      await xReplyService.sendDirectMessage({
        userId: user.privyDid,
        xUserId: event.senderId,
        text: 'Daily X usage limit reached. Continue in the KIKO app tomorrow or raise your plan limit.',
        sourceMessageId: event.id,
        idempotencyKey: `x:dm:quota:${event.id}`,
        incrementRoundTrip: false,
      });
      return;
    }

    const mapping = await findOrCreateXConversation({
      userId: user.privyDid,
      xUserId: event.senderId,
      xUsername: event.senderUsername || user.xUsername || null,
      channel: 'dm',
      xDmConversationId: event.dmConversationId || event.senderId,
    });
    await markXConversationInbound({
      mappingId: mapping.id,
      eventId: event.id,
      messageId: event.id,
      username: event.senderUsername || user.xUsername || null,
    });

    const queued = await enqueueXAgentMessage({
      userId: user.privyDid,
      sessionId: mapping.chatSessionId,
      content: event.text,
      channel: 'dm',
      xUserId: event.senderId,
      xUsername: event.senderUsername || user.xUsername || null,
      sourceMessageId: event.id,
      xDmConversationId: event.dmConversationId || event.senderId,
    });
    const assistantText = queued.completedSynchronously
      ? queued.assistantContent
      : await waitForTaskAssistantText({
          taskId: queued.task?.id,
          assistantMessageId: queued.assistantMessage.id,
        });

    await xReplyService.sendDirectMessage({
      userId: user.privyDid,
      xUserId: event.senderId,
      conversationMappingId: mapping.id,
      text: assistantText,
      sourceMessageId: event.id,
      idempotencyKey: `x:dm:reply:${event.id}`,
      incrementRoundTrip: true,
    });
  }
}

export const xIngressWorker = new XIngressWorker();
