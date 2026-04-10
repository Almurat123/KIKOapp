// CONTEXT MEMORY
// Updated: 2026-04-10
// Author: Linh Tran
// Reason: Farcaster mention replies need deterministic session reuse keyed by
//         thread/root cast instead of reusing X-specific conversation storage.
// Goal: keep Farcaster conversation mapping and session model selection tied to
//       the linked user's persisted chat preference.
// Owns: Farcaster conversation mapping creation/reuse and model sync for the
//       underlying shared chat session.
// Does Not Own: polling, user linking writes, or outbound cast publication.
// Design Language:
// - Reuse one active session per linked user and root cast thread.
// - New Farcaster sessions must get an explicit normalized model.
// - Reused sessions may be realigned to the latest saved user model.
// Document Provenance:
// - Source: repo code review of X conversation/session flow
// - Kind: repo doc
// - Retrieved: 2026-04-10
// - Applied To: mirroring thread-keyed mapping and model sync for Farcaster
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-farcaster-polling-agent-ingress.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
import prisma from '../../db/prisma.js';
import * as chatRepo from '../../repositories/chatRepository.js';
import { normalizeSupportedChatModel } from '../../config/chatModels.js';
import type { FarcasterChannel } from './types.js';

export function buildFarcasterSessionTitle(params: { username?: string | null }): string {
  const handle = params.username ? `@${String(params.username).replace(/^@/, '')}` : '@unknown';
  return `Farcaster ${handle}`;
}

async function createConversationMapping(params: {
  userId: string;
  farcasterFid: number;
  farcasterUsername?: string | null;
  channel: FarcasterChannel;
  rootCastHash?: string | null;
  parentCastHash?: string | null;
  preferredModel?: string | null;
}) {
  const session = await chatRepo.createSession(
    params.userId,
    buildFarcasterSessionTitle({ username: params.farcasterUsername }),
    normalizeSupportedChatModel(params.preferredModel),
  );

  return prisma.farcasterConversationMapping.create({
    data: {
      userId: params.userId,
      farcasterFid: params.farcasterFid,
      farcasterUsername: params.farcasterUsername || null,
      channel: params.channel,
      rootCastHash: params.rootCastHash || null,
      parentCastHash: params.parentCastHash || null,
      chatSessionId: session.id,
      status: 'active',
    },
  });
}

export async function findOrCreateFarcasterConversation(params: {
  userId: string;
  farcasterFid: number;
  farcasterUsername?: string | null;
  channel: FarcasterChannel;
  rootCastHash?: string | null;
  parentCastHash?: string | null;
  preferredModel?: string | null;
}) {
  const existing = await prisma.farcasterConversationMapping.findFirst({
    where: {
      farcasterFid: params.farcasterFid,
      channel: params.channel,
      rootCastHash: params.rootCastHash || null,
      status: 'active',
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (!existing) {
    return createConversationMapping(params);
  }

  if (params.userId && !existing.userId) {
    return prisma.farcasterConversationMapping.update({
      where: { id: existing.id },
      data: {
        userId: params.userId,
        farcasterUsername: params.farcasterUsername || existing.farcasterUsername,
        parentCastHash: params.parentCastHash || existing.parentCastHash,
      },
    });
  }

  if (
    params.farcasterUsername && params.farcasterUsername !== existing.farcasterUsername
    || (params.parentCastHash && params.parentCastHash !== existing.parentCastHash)
  ) {
    return prisma.farcasterConversationMapping.update({
      where: { id: existing.id },
      data: {
        farcasterUsername: params.farcasterUsername || existing.farcasterUsername,
        parentCastHash: params.parentCastHash || existing.parentCastHash,
      },
    });
  }

  return existing;
}

export async function syncFarcasterConversationModel(params: {
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

export async function markFarcasterConversationInbound(params: {
  mappingId: string;
  eventId?: string | null;
  castHash?: string | null;
  username?: string | null;
}) {
  return prisma.farcasterConversationMapping.update({
    where: { id: params.mappingId },
    data: {
      farcasterUsername: params.username || undefined,
      lastInboundAt: new Date(),
      lastInboundEventId: params.eventId || undefined,
      lastInboundCastHash: params.castHash || undefined,
    },
  });
}

export async function markFarcasterConversationOutbound(params: {
  mappingId: string;
  eventId?: string | null;
  castHash?: string | null;
  incrementRoundTrip?: boolean;
}) {
  const data: Record<string, unknown> = {
    lastOutboundAt: new Date(),
    lastOutboundEventId: params.eventId || undefined,
    lastOutboundCastHash: params.castHash || undefined,
  };
  if (params.incrementRoundTrip) {
    data.roundTripCount = { increment: 1 };
  }
  return prisma.farcasterConversationMapping.update({
    where: { id: params.mappingId },
    data,
  });
}
