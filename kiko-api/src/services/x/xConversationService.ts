import prisma from '../../db/prisma.js';
import * as chatRepo from '../../repositories/chatRepository.js';
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
}) {
  const session = await chatRepo.createSession(
    params.userId,
    buildXSessionTitle({ channel: params.channel, username: params.xUsername }),
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
