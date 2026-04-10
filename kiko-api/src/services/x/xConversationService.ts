// CONTEXT MEMORY
// Updated: 2026-04-10
// Author: Almurat
// Reason: X mention sessions must inherit the authenticated user's saved
//         default model instead of falling back to an unrelated repository
//         default. Existing X-linked sessions must also be able to realign when
//         the user changes their preferred model on the website.
// Goal: keep X conversation mapping and X session model selection deterministic
//       and tied to persisted user preference.
// Owns: X conversation mapping creation/reuse and the model assigned to the
//       underlying chat session for X channels.
// Does Not Own: authenticated user settings writes, agent execution, or webhook parsing.
// Design Language:
// - New X sessions must receive an explicit normalized model when available.
// - Reused X sessions may be updated to the user's latest saved model.
// - Do not let X mention sessions silently drift to a legacy default model.
// Document Provenance:
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-user-default-chat-model-for-x-mentions.md
// - Kind: repo doc
// - Retrieved: 2026-04-10
// - Applied To: using persisted per-user model preference for X mention sessions
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-user-default-chat-model-for-x-mentions.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
import prisma from '../../db/prisma.js';
import * as chatRepo from '../../repositories/chatRepository.js';
import { normalizeSupportedChatModel } from '../../config/chatModels.js';
import type { XChannel } from './types.js';

export const MAX_DM_ROUND_TRIPS = 30;

export function buildXSessionTitle(params: { channel: XChannel; username?: string | null }): string {
  const handle = params.username ? `@${String(params.username).replace(/^@/, '')}` : '@unknown';
  return params.channel === 'dm' ? `X DM ${handle}` : `X Mention ${handle}`;
}

export function shouldRolloverDmConversation(mapping: { channel: string; roundTripCount: number }): boolean {
  return mapping.channel === 'dm' && Number(mapping.roundTripCount || 0) >= MAX_DM_ROUND_TRIPS;
}

async function createConversationMapping(params: {
  userId: string;
  xUserId: string;
  xUsername?: string | null;
  channel: XChannel;
  rootTweetId?: string | null;
  xDmConversationId?: string | null;
  rolloverCount?: number;
  preferredModel?: string | null;
}) {
  const session = await chatRepo.createSession(
    params.userId,
    buildXSessionTitle({ channel: params.channel, username: params.xUsername }),
    normalizeSupportedChatModel(params.preferredModel),
  );

  return prisma.xConversationMapping.create({
    data: {
      userId: params.userId || null,
      xUserId: params.xUserId,
      xUsername: params.xUsername || null,
      channel: params.channel,
      rootTweetId: params.rootTweetId || null,
      xDmConversationId: params.xDmConversationId || null,
      chatSessionId: session.id,
      rolloverCount: params.rolloverCount || 0,
      status: 'active',
    },
  });
}

export async function findOrCreateXConversation(params: {
  userId: string;
  xUserId: string;
  xUsername?: string | null;
  channel: XChannel;
  rootTweetId?: string | null;
  xDmConversationId?: string | null;
  preferredModel?: string | null;
}) {
  if (params.channel === 'mention' && params.rootTweetId) {
    const existing = await prisma.xConversationMapping.findFirst({
      where: {
        xUserId: params.xUserId,
        channel: 'mention',
        rootTweetId: params.rootTweetId,
        status: 'active',
      },
      orderBy: { updatedAt: 'desc' },
    });
    if (existing) {
      if (params.userId && !existing.userId) {
        return prisma.xConversationMapping.update({
          where: { id: existing.id },
          data: {
            userId: params.userId,
            xUsername: params.xUsername || existing.xUsername,
          },
        });
      }
      return existing;
    }
    return createConversationMapping(params);
  }

  const existing = await prisma.xConversationMapping.findFirst({
    where: {
      xUserId: params.xUserId,
      channel: 'dm',
      xDmConversationId: params.xDmConversationId || null,
      status: 'active',
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (!existing) {
    return createConversationMapping(params);
  }

  if (shouldRolloverDmConversation(existing)) {
    await prisma.xConversationMapping.update({
      where: { id: existing.id },
      data: { status: 'rolled_over' },
    });
    return createConversationMapping({
      ...params,
      rolloverCount: Number(existing.rolloverCount || 0) + 1,
    });
  }

  if (params.userId && !existing.userId) {
    return prisma.xConversationMapping.update({
      where: { id: existing.id },
      data: {
        userId: params.userId,
        xUsername: params.xUsername || existing.xUsername,
      },
    });
  }

  return existing;
}

export async function syncXConversationModel(params: {
  chatSessionId: string;
  preferredModel?: string | null;
}) {
  const preferredModel = normalizeSupportedChatModel(params.preferredModel);
  const session = await chatRepo.getSession(params.chatSessionId);
  if (!session || session.model === preferredModel) {
    return session;
  }
  return chatRepo.updateSession(params.chatSessionId, { model: preferredModel });
}

export async function markXConversationInbound(params: {
  mappingId: string;
  eventId?: string | null;
  messageId?: string | null;
  username?: string | null;
}) {
  return prisma.xConversationMapping.update({
    where: { id: params.mappingId },
    data: {
      xUsername: params.username || undefined,
      lastInboundAt: new Date(),
      lastInboundEventId: params.eventId || undefined,
      lastInboundMessageId: params.messageId || undefined,
    },
  });
}

export async function markXConversationOutbound(params: {
  mappingId: string;
  eventId?: string | null;
  messageId?: string | null;
  incrementRoundTrip?: boolean;
}) {
  const data: Record<string, unknown> = {
    lastOutboundAt: new Date(),
    lastOutboundEventId: params.eventId || undefined,
    lastOutboundMessageId: params.messageId || undefined,
  };
  if (params.incrementRoundTrip) {
    data.roundTripCount = { increment: 1 };
  }
  return prisma.xConversationMapping.update({
    where: { id: params.mappingId },
    data,
  });
}
