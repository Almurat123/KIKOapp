// CONTEXT MEMORY
// Updated: 2026-04-13
// Author: Linh Tran
// Reason: Farcaster agent ingress must resolve mention authors against the
//         shared User table without assuming webhook-only flows or frontend
//         state. Public mention replies also need one canonical link-back URL,
//         and verified Farcaster linkage must come from Privy instead of
//         trusting client-supplied FIDs.
// Goal: keep Farcaster identity normalization and KiKo link URL shaping in one
//       place so ingress/reply layers stay deterministic.
// Owns: Farcaster username normalization, profile URL shaping, link URL shaping,
//       linked-user lookup by FID, and Privy-verified Farcaster identity sync.
// Does Not Own: polling cadence, or AI execution.
// Design Language:
// - Normalize usernames before comparison or persistence.
// - Use FID as the canonical external identity key.
// - Keep public bind prompts stable and short.
// - Never trust client-supplied Farcaster ids when Privy exposes the linked account.
// Document Provenance:
// - Source: repo code review of `/api/users/farcaster` sync path
// - Kind: repo doc
// - Retrieved: 2026-04-10
// - Applied To: resolving linked users by persisted `farcasterFid`
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/kiko-web/src/contexts/FarcasterContext.tsx
// - Kind: repo doc
// - Retrieved: 2026-04-13
// - Applied To: extracting Farcaster identity from Privy linked accounts
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-farcaster-polling-agent-ingress.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-13-farcaster-verified-identity-sync.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
import prisma from '../../db/prisma.js';
import { env } from '../../config/env.js';
import { PrivyClient } from '@privy-io/server-auth';
import { resolvePrivyServerConfig } from '../../config/privy.js';
import { getEmbeddedWalletAddress } from '../privyWallet.js';

const { appId: PRIVY_APP_ID, appSecret: PRIVY_APP_SECRET } = resolvePrivyServerConfig();
let farcasterIdentityPrivyClient: PrivyClient | null = null;
const AUTO_SYNC_COOLDOWN_MS = 60_000;
const autoSyncCooldown = new Map<string, number>();

function getFarcasterIdentityPrivyClient(): PrivyClient {
  if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
    throw new Error('Privy server credentials are not configured');
  }
  if (!farcasterIdentityPrivyClient) {
    farcasterIdentityPrivyClient = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);
  }
  return farcasterIdentityPrivyClient;
}

function parseFarcasterFid(value: unknown): number | null {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function normalizeFarcasterUsername(username?: string | null): string | null {
  const value = String(username || '').trim().replace(/^@/, '');
  return value || null;
}

export function extractPrivyFarcasterAccount(user: any): { farcasterFid: number | null; username: string | null } {
  const account = (user?.linkedAccounts || []).find((acc: any) => {
    const type = String(acc?.type || '').toLowerCase();
    const chainType = String(acc?.chainType || '').toLowerCase();
    return type === 'farcaster' || (type === 'wallet' && chainType === 'farcaster');
  });

  return {
    farcasterFid: parseFarcasterFid(account?.fid || account?.subject || user?.farcaster?.fid || user?.farcaster?.subject || null),
    username: normalizeFarcasterUsername(account?.username || user?.farcaster?.username || null),
  };
}

export async function getVerifiedPrivyFarcasterAccount(userId: string): Promise<{ farcasterFid: number | null; username: string | null }> {
  const client = getFarcasterIdentityPrivyClient();
  const user = await client.getUser(userId);
  return extractPrivyFarcasterAccount(user);
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
          defaultChatReasoningLevel: true,
          defaultGeneratedImageModel: true,
          defaultGeneratedImageQuality: true,
        },
      },
    },
  });
}

export async function syncVerifiedPrivyFarcasterUser(params: {
  userId: string;
}): Promise<{ status: 'synced' | 'no_farcaster_account' | 'missing_wallet'; user: any | null }> {
  const verifiedAccount = await getVerifiedPrivyFarcasterAccount(params.userId);
  const farcasterFid = Number(verifiedAccount.farcasterFid || 0);
  const username = normalizeFarcasterUsername(verifiedAccount.username);

  if (!Number.isFinite(farcasterFid) || farcasterFid <= 0) {
    return { status: 'no_farcaster_account', user: null };
  }

  const existingOwner = await prisma.user.findFirst({
    where: {
      farcasterFid,
      NOT: { privyDid: params.userId },
    },
    select: { privyDid: true },
  });
  if (existingOwner) {
    throw new Error('Farcaster account already linked to another user');
  }

  const existingUser = await prisma.user.findUnique({
    where: { privyDid: params.userId },
    select: {
      privyDid: true,
      username: true,
    },
  });

  if (existingUser) {
    const user = await prisma.user.update({
      where: { privyDid: params.userId },
      data: {
        username: existingUser.username || username,
        farcasterFid,
        farcasterUsername: username,
      },
    });
    return { status: 'synced', user };
  }

  const embeddedWalletAddress = await getEmbeddedWalletAddress(params.userId).catch(() => null);
  if (!embeddedWalletAddress) {
    return { status: 'missing_wallet', user: null };
  }

  const user = await prisma.user.create({
    data: {
      privyDid: params.userId,
      username,
      walletAddress: embeddedWalletAddress,
      farcasterFid,
      farcasterUsername: username,
    },
  });

  return { status: 'synced', user };
}

export async function maybeAutoSyncVerifiedPrivyFarcasterUser(userId: string): Promise<void> {
  if (!userId) return;
  const lastAttemptAt = autoSyncCooldown.get(userId) || 0;
  if ((Date.now() - lastAttemptAt) < AUTO_SYNC_COOLDOWN_MS) {
    return;
  }

  const existingUser = await prisma.user.findUnique({
    where: { privyDid: userId },
    select: { farcasterFid: true },
  }).catch(() => null);

  if (existingUser?.farcasterFid) {
    return;
  }

  autoSyncCooldown.set(userId, Date.now());
  await syncVerifiedPrivyFarcasterUser({ userId }).catch(() => undefined);
}
