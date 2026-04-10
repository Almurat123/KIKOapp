// CONTEXT MEMORY
// Updated: 2026-04-10
// Author: Linh Tran
// Reason: Farcaster agent ingress must resolve mention authors against the
//         shared User table without assuming webhook-only flows or frontend
//         state. Public mention replies also need one canonical link-back URL.
// Goal: keep Farcaster identity normalization and KiKo link URL shaping in one
//       place so ingress/reply layers stay deterministic.
// Owns: Farcaster username normalization, profile URL shaping, link URL shaping,
//       and linked-user lookup by FID.
// Does Not Own: Privy sync writes, polling cadence, or AI execution.
// Design Language:
// - Normalize usernames before comparison or persistence.
// - Use FID as the canonical external identity key.
// - Keep public bind prompts stable and short.
// Document Provenance:
// - Source: repo code review of `/api/users/farcaster` sync path
// - Kind: repo doc
// - Retrieved: 2026-04-10
// - Applied To: resolving linked users by persisted `farcasterFid`
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-farcaster-polling-agent-ingress.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
import prisma from '../../db/prisma.js';
import { env } from '../../config/env.js';

export function normalizeFarcasterUsername(username?: string | null): string | null {
  const value = String(username || '').trim().replace(/^@/, '');
  return value || null;
}

export function buildFarcasterProfileUrl(username?: string | null): string | null {
  const normalized = normalizeFarcasterUsername(username);
  return normalized ? `https://warpcast.com/${normalized}` : null;
}

export function buildFarcasterLinkUrl(params?: { username?: string | null }): string {
  const base = String(env.farcasterAgent.linkBaseUrl || 'https://kikoapp.app/settings').trim();
  try {
    const url = new URL(base);
    url.searchParams.set('connect', 'farcaster');
    if (params?.username) {
      url.searchParams.set('fc', normalizeFarcasterUsername(params.username) || '');
    }
    return url.toString();
  } catch {
    return base;
  }
}

export async function getUserByFarcasterFid(farcasterFid: number) {
  if (!Number.isFinite(farcasterFid) || farcasterFid <= 0) return null;
  return prisma.user.findFirst({
    where: { farcasterFid },
    orderBy: { createdAt: 'asc' },
    include: {
      settings: {
        select: {
          defaultChatModel: true,
        },
      },
    },
  });
}
