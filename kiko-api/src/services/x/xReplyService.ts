import prisma from '../../db/prisma.js';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import { markXConversationOutbound } from './xConversationService.js';
import { xApiClient } from './xApiClient.js';

type DeliveryChannel = 'mention' | 'dm';
type DeliveryType = 'reply' | 'dm' | 'notification';

async function createOrReuseDelivery(params: {
  userId?: string | null;
  xUserId: string;
  conversationMappingId?: string | null;
  channel: DeliveryChannel;
  messageType: DeliveryType;
  sourceMessageId?: string | null;
  idempotencyKey: string;
  payload: unknown;
}) {
  const existing = await prisma.xMessageDelivery.findUnique({
    where: { idempotencyKey: params.idempotencyKey },
  });
  if (existing && existing.status === 'sent') {
    return { record: existing, alreadySent: true };
  }
  // Block concurrent processing: treat recent pending records as already-sent.
  // But if the record has been pending for more than 5 minutes, it is likely
  // orphaned from a process crash — allow retry by falling through.
  const STALE_PENDING_MS = 5 * 60 * 1000;
  if (existing && existing.status === 'pending') {
    const age = Date.now() - existing.updatedAt.getTime();
    if (age < STALE_PENDING_MS) {
      return { record: existing, alreadySent: true };
    }
    // Stale pending — fall through to the retry path below.
  }
  if (existing) {
    const record = await prisma.xMessageDelivery.update({
      where: { id: existing.id },
      data: {
        attemptCount: { increment: 1 },
        payload: params.payload as any,
        errorMessage: null,
        status: 'pending',
      },
    });
    return { record, alreadySent: false };
  }
  const record = await prisma.xMessageDelivery.create({
    data: {
      userId: params.userId || null,
      xUserId: params.xUserId,
      conversationMappingId: params.conversationMappingId || null,
      channel: params.channel,
      direction: 'outbound',
      messageType: params.messageType,
      sourceMessageId: params.sourceMessageId || null,
      idempotencyKey: params.idempotencyKey,
      payload: params.payload as any,
      attemptCount: 1,
      status: 'pending',
    },
  });
  return { record, alreadySent: false };
}

async function markDeliveryFailed(id: string, error: unknown) {
  await prisma.xMessageDelivery.update({
    where: { id },
    data: {
      status: 'failed',
      errorMessage: String((error as any)?.message || error || 'unknown_error').slice(0, 500),
    },
  }).catch(() => {});
}

export class XReplyService {
  isConfigured(): boolean {
    return xApiClient.isConfigured();
  }

  async replyToMention(params: {
    xUserId: string;
    text: string;
    tweetId: string;
    userId?: string | null;
    conversationMappingId?: string | null;
    idempotencyKey: string;
  }): Promise<boolean> {
    if (!this.isConfigured()) return false;
    const { record, alreadySent } = await createOrReuseDelivery({
      userId: params.userId,
      xUserId: params.xUserId,
      conversationMappingId: params.conversationMappingId,
      channel: 'mention',
      messageType: 'reply',
      sourceMessageId: params.tweetId,
      idempotencyKey: params.idempotencyKey,
      payload: { tweetId: params.tweetId, text: params.text },
    });
    if (alreadySent) return true;

    try {
      const sent = await xApiClient.replyToMention({
        tweetId: params.tweetId,
        text: params.text,
      });
      await prisma.xMessageDelivery.update({
        where: { id: record.id },
        data: {
          status: 'sent',
          providerMessageId: sent.id || null,
        },
      });
      if (params.conversationMappingId) {
        await markXConversationOutbound({
          mappingId: params.conversationMappingId,
          messageId: sent.id,
          incrementRoundTrip: false,
        }).catch(() => {});
      }
      return true;
    } catch (error) {
      logger.warn(LogCode.API_NOTIFY_FAILED, '[X] Failed to reply to mention', {
        xUserId: params.xUserId,
        error: String((error as any)?.message || error || 'unknown_error'),
      });
      await markDeliveryFailed(record.id, error);
      return false;
    }
  }

  async sendDirectMessage(params: {
    xUserId: string;
    text: string;
    userId?: string | null;
    conversationMappingId?: string | null;
    idempotencyKey: string;
    sourceMessageId?: string | null;
    messageType?: DeliveryType;
    incrementRoundTrip?: boolean;
  }): Promise<boolean> {
    if (!this.isConfigured()) return false;
    const { record, alreadySent } = await createOrReuseDelivery({
      userId: params.userId,
      xUserId: params.xUserId,
      conversationMappingId: params.conversationMappingId,
      channel: 'dm',
      messageType: params.messageType || 'dm',
      sourceMessageId: params.sourceMessageId || null,
      idempotencyKey: params.idempotencyKey,
      payload: { text: params.text },
    });
    if (alreadySent) return true;

    try {
      const sent = await xApiClient.sendDirectMessage({
        recipientId: params.xUserId,
        text: params.text,
      });
      await prisma.xMessageDelivery.update({
        where: { id: record.id },
        data: {
          status: 'sent',
          providerMessageId: sent.id || null,
        },
      });
      if (params.conversationMappingId) {
        await markXConversationOutbound({
          mappingId: params.conversationMappingId,
          messageId: sent.id,
          incrementRoundTrip: Boolean(params.incrementRoundTrip),
        }).catch(() => {});
      }
      return true;
    } catch (error) {
      logger.warn(LogCode.API_NOTIFY_FAILED, '[X] Failed to send DM', {
        xUserId: params.xUserId,
        error: String((error as any)?.message || error || 'unknown_error'),
      });
      await markDeliveryFailed(record.id, error);
      return false;
    }
  }
}

export const xReplyService = new XReplyService();
