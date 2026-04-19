// CONTEXT MEMORY
// Updated: 2026-04-20
// Author: Linh Tran
// Reason: Farcaster mention replies need deterministic session reuse keyed by
//         thread/root cast instead of reusing X-specific conversation storage.
//         Direct reply continuation also needs a bounded list of bot-authored
//         outbound casts so Hub fallback can watch only casts the bot actually
//         wrote, not whole public threads. Agent-created chat history also
//         needs readable titles that distinguish repeated sessions from the
//         same author, so new Farcaster sessions now use the shared social-agent
//         title shape: `HH:mm farcaster message-prefix`.
// Goal: keep Farcaster conversation mapping and session model selection tied to
//       the linked user's persisted chat preference, expose a narrow
//       continuation target list for no-mention replies to the bot, and give
//       newly-created Farcaster chat sessions a time/platform/message-prefix
//       title.
// Owns: Farcaster conversation mapping creation/reuse and model sync for the
//       underlying shared chat session, plus the Farcaster-side inputs to the
//       shared social-agent session title helper.
// Does Not Own: polling, user linking writes, or outbound cast publication.
// Design Language:
// - Reuse one active session per linked user and root cast thread.
// - New Farcaster sessions must get an explicit normalized model.
// - Reused sessions may be realigned to the latest saved user model.
// - New Farcaster session titles must use `HH:mm farcaster message-prefix`; do
//   not fall back to handle-only titles when the inbound cast text is available.
// - Reply-continuation polling may read recent `lastOutboundCastHash` values, but
//   it must not decide provider fetch policy or broaden admission beyond direct
//   replies to bot-authored casts.
// Document Provenance:
// - Source: repo code review of X conversation/session flow
// - Kind: repo doc
// - Retrieved: 2026-04-10
// - Applied To: mirroring thread-keyed mapping and model sync for Farcaster
// - Verification: verified in code
// - Source: repo runtime policy review for Farcaster direct reply continuation
// - Kind: product/runtime observation
// - Retrieved: 2026-04-17
// - Applied To: exposing recent bot outbound cast hashes as bounded continuation targets
// - Verification: verified in code
// - Source: operator request on 2026-04-20
// - Kind: product doc
// - Retrieved: 2026-04-20
// - Applied To: Farcaster agent-created session title format
// - Verification: verified in targeted tests
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-social-agent-session-title-format.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-farcaster-polling-agent-ingress.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-farcaster-direct-reply-continuation.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
import prisma from '../../db/prisma.js';
import * as chatRepo from '../../repositories/chatRepository.js';
import { normalizeSupportedChatModel } from '../../config/chatModels.js';
import { buildSocialAgentSessionTitle } from '../socialAgentSessionTitle.js';
import type { FarcasterChannel } from './types.js';

export interface FarcasterReplyContinuationTarget {
  id: string;
  farcasterFid: number;
  rootCastHash: string | null;
  lastOutboundCastHash: string;
}

export function buildFarcasterSessionTitle(params: {
  username?: string | null;
  initialMessageText?: string | null;
  createdAt?: Date;
}): string {
  const handle = params.username ? `@${String(params.username).replace(/^@/, '')}` : '@unknown';
  return buildSocialAgentSessionTitle({
    platform: 'farcaster',
    text: params.initialMessageText || handle,
    createdAt: params.createdAt,
  });
}

async function createConversationMapping(params: {
  userId: string;
  farcasterFid: number;
  farcasterUsername?: string | null;
  channel: FarcasterChannel;
  rootCastHash?: string | null;
  parentCastHash?: string | null;
  preferredModel?: string | null;
  initialMessageText?: string | null;
}) {
  const session = await chatRepo.createSession(
    params.userId,
    buildFarcasterSessionTitle({
      username: params.farcasterUsername,
      initialMessageText: params.initialMessageText,
    }),
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
  initialMessageText?: string | null;
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

export async function listFarcasterReplyContinuationTargets(params?: {
  limit?: number;
  since?: Date | null;
}): Promise<FarcasterReplyContinuationTarget[]> {
  const limit = Math.min(Math.max(Math.trunc(Number(params?.limit || 25)), 1), 100);
  const rows = await prisma.farcasterConversationMapping.findMany({
    where: {
      channel: 'mention',
      status: 'active',
      lastOutboundCastHash: { not: null },
      lastOutboundAt: params?.since ? { gte: params.since } : { not: null },
    },
    select: {
      id: true,
      farcasterFid: true,
      rootCastHash: true,
      lastOutboundCastHash: true,
    },
    orderBy: { lastOutboundAt: 'desc' },
    take: limit,
  });

  return rows.flatMap((row) => {
    const lastOutboundCastHash = String(row.lastOutboundCastHash || '').trim();
    if (!lastOutboundCastHash) return [];
    return [{
      id: row.id,
      farcasterFid: row.farcasterFid,
      rootCastHash: row.rootCastHash || null,
      lastOutboundCastHash,
    }];
  });
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
