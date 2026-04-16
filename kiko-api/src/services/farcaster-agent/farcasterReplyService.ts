// CONTEXT MEMORY
// Updated: 2026-04-17
// Author: Linh Tran / Almurat
// Reason: Snapchain-based Farcaster mention replies still need the same
//         delivery idempotency and retry accounting as other social surfaces,
//         but with cast hashes and parent reply semantics instead of tweet IDs.
// Goal: keep outbound Farcaster reply publication deterministic and persisted.
// Owns: Farcaster outbound delivery rows and cast-reply publication.
// Does Not Own: mention polling, AI generation, or user linking.
// Design Language:
// - Never publish the same reply twice for the same idempotency key.
// - Persist outbound attempts before making the external API call.
// - Update conversation mapping after a successful provider write.
// Document Provenance:
// - Source: @farcaster/hub-nodejs README and dist typings
// - Kind: local SDK source
// - Retrieved: 2026-04-12
// - Applied To: reply publication through `makeCastAdd` and `submitMessage`
// - Verification: verified in runtime
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-farcaster-polling-agent-ingress.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
import prisma from '../../db/prisma.js';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import { farcasterApiClient } from './farcasterApiClient.js';
import { markFarcasterConversationOutbound } from './farcasterConversationService.js';

type DeliveryType = 'reply' | 'notification';

async function createOrReuseDelivery(params: {
  userId?: string | null;
  farcasterFid: number;
  conversationMappingId?: string | null;
  channel: 'mention';
  messageType: DeliveryType;
  sourceMessageId?: string | null;
  idempotencyKey: string;
  payload: unknown;
}) {
  const existing = await prisma.farcasterMessageDelivery.findUnique({
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
    // Only retry previously failed deliveries.
    const record = await prisma.farcasterMessageDelivery.update({
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
  const record = await prisma.farcasterMessageDelivery.create({
    data: {
      userId: params.userId || null,
      farcasterFid: params.farcasterFid,
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
  await prisma.farcasterMessageDelivery.update({
    where: { id },
    data: {
      status: 'failed',
      errorMessage: String((error as any)?.message || error || 'unknown_error').slice(0, 500),
    },
  }).catch(() => {});
}

export class FarcasterReplyService {
  isConfigured(): boolean {
    return farcasterApiClient.isConfigured();
  }

  async replyToMention(params: {
    farcasterFid: number;
    text: string;
    parentHash: string;
    parentAuthorFid: number;
    userId?: string | null;
    conversationMappingId?: string | null;
    idempotencyKey: string;
  }): Promise<boolean> {
    if (!this.isConfigured()) return false;
    const { record, alreadySent } = await createOrReuseDelivery({
      userId: params.userId,
      farcasterFid: params.farcasterFid,
      conversationMappingId: params.conversationMappingId,
      channel: 'mention',
      messageType: 'reply',
      sourceMessageId: params.parentHash,
      idempotencyKey: params.idempotencyKey,
      payload: {
        parentHash: params.parentHash,
        parentAuthorFid: params.parentAuthorFid,
        text: params.text,
      },
    });
    if (alreadySent) return true;

    try {
      const sent = await farcasterApiClient.publishCastReply({
        text: params.text,
        parentHash: params.parentHash,
        parentAuthorFid: params.parentAuthorFid,
        idem: params.idempotencyKey,
      });
      await prisma.farcasterMessageDelivery.update({
        where: { id: record.id },
        data: {
          status: 'sent',
          providerMessageId: sent.hash || null,
        },
      });
      if (params.conversationMappingId) {
        await markFarcasterConversationOutbound({
          mappingId: params.conversationMappingId,
          castHash: sent.hash,
          incrementRoundTrip: true,
        }).catch(() => {});
      }
      return true;
    } catch (error) {
      logger.warn(LogCode.API_NOTIFY_FAILED, '[Farcaster] Failed to reply to mention', {
        farcasterFid: params.farcasterFid,
        error: String((error as any)?.message || error || 'unknown_error'),
      });
      await markDeliveryFailed(record.id, error);
      return false;
    }
  }
}

export const farcasterReplyService = new FarcasterReplyService();
