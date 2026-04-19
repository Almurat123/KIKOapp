// CONTEXT MEMORY
// Updated: 2026-04-19
// Author: Linh Tran / Almurat
// Reason: Snapchain-based Farcaster mention replies still need the same
//         delivery idempotency and retry accounting as other social surfaces,
//         but with cast hashes and parent reply semantics instead of tweet IDs.
//         Public link/bot-loop prevention also depends on idempotency surviving
//         concurrent attempts without throwing duplicate-key errors. Generated
//         image replies now need outbound cast embeds persisted in the delivery
//         payload and passed through to the Farcaster publication owner.
// Goal: keep outbound Farcaster reply publication deterministic and persisted,
//       including concurrent idempotency races and generated-image media embeds.
// Owns: Farcaster outbound delivery rows and cast-reply publication.
// Does Not Own: mention polling, AI generation, or user linking.
// Design Language:
// - Never publish the same reply twice for the same idempotency key.
// - Persist outbound attempts before making the external API call.
// - Update conversation mapping after a successful provider write.
// - Treat a concurrent unique-key collision as "already reserved" and do not
//   publish a second cast.
// - Persist outbound embed URLs with the delivery attempt so media publication
//   retries remain auditable and deterministic.
// Document Provenance:
// - Source: @farcaster/hub-nodejs README and dist typings
// - Kind: local SDK source
// - Retrieved: 2026-04-12
// - Applied To: reply publication through `makeCastAdd` and `submitMessage`
// - Verification: verified in runtime
// - Source: production runtime logs in
//   /Users/almurat/Downloads/logs.1776362968247.json showing public bind-reply
//   recursion risk
// - Kind: runtime observation
// - Retrieved: 2026-04-17
// - Applied To: preserving delivery idempotency under concurrent bind attempts
// - Verification: verified in code
// - Source: operator requirement on 2026-04-19 for Farcaster generated-image replies
// - Kind: product doc
// - Retrieved: 2026-04-19
// - Applied To: preserving and publishing generated-image cast embeds
// - Verification: verified in targeted test
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-farcaster-polling-agent-ingress.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-farcaster-self-loop-bind-spam-guard.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-farcaster-generated-image-reply-and-watermark.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
import prisma from '../../db/prisma.js';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import { farcasterApiClient } from './farcasterApiClient.js';
import { markFarcasterConversationOutbound } from './farcasterConversationService.js';

type DeliveryType = 'reply' | 'notification';

function normalizeFarcasterCastEmbedUrls(value: unknown): string[] {
  const rawUrls = Array.isArray(value) ? value : [];
  const deduped = new Set<string>();
  for (const raw of rawUrls) {
    const url = String(raw || '').trim();
    if (!url) continue;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') continue;
      deduped.add(parsed.toString());
    } catch {
      continue;
    }
  }
  return Array.from(deduped).slice(0, 2);
}

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
  const createPayload = {
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
  };
  let wasCreated = true;
  const record = await prisma.farcasterMessageDelivery.create({
    data: createPayload,
  }).catch(async (error: any) => {
    if (error?.code !== 'P2002') {
      throw error;
    }
    wasCreated = false;
    const raced = await prisma.farcasterMessageDelivery.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
    });
    if (!raced) {
      throw error;
    }
    return raced;
  });
  if (!wasCreated) {
    return { record, alreadySent: true };
  }
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
    embeds?: string[] | null;
  }): Promise<boolean> {
    if (!this.isConfigured()) return false;
    const embeds = normalizeFarcasterCastEmbedUrls(params.embeds);
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
        embeds,
      },
    });
    if (alreadySent) return true;

    try {
      const sent = await farcasterApiClient.publishCastReply({
        text: params.text,
        parentHash: params.parentHash,
        parentAuthorFid: params.parentAuthorFid,
        idem: params.idempotencyKey,
        embeds,
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
