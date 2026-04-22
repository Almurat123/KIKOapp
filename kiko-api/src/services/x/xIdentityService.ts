// CONTEXT MEMORY
// Updated: 2026-04-10
// Author: Almurat
// Reason: X identity linkage now needs a server-verified source of truth from
//         Privy to prevent clients from claiming arbitrary X accounts, and the
//         authenticated backend must be able to auto-persist verified X linkage
//         instead of relying on a frontend-only sync side effect.
// Goal: keep X identity normalization and Privy-backed verification in one
//       layer so route handlers never trust frontend-provided X account claims.
// Owns: X username normalization, profile/link URL shaping, and verified X
//       identity lookup for authenticated Privy users, including auto-sync into
//       the shared User row.
// Does Not Own: OAuth bot authorization, webhook ingress, or DM delivery.
// Design Language:
// - Never trust client-supplied X ids when Privy can verify the linked account.
// - Normalize handles before any persistence or comparison.
// - Keep route payloads limited to safe X context, not token material.
// - Existing authenticated users should gain verified X linkage without a second
//   manual bind step when Privy already knows the linked account.
// See also:
// - system-journal/INDEX.md
// - system-journal/fix-log/2026-04-09-x-oauth-official-account-flow.md
// - system-journal/fix-log/2026-04-10-x-user-auto-sync.md
// - system-journal/conflicts.md
import prisma from '../../db/prisma.js';
import { env } from '../../config/env.js';
import { PrivyClient } from '@privy-io/server-auth';
import { resolvePrivyServerConfig } from '../../config/privy.js';
import { getEmbeddedWalletAddress } from '../privyWallet.js';
import type { XIdentitySnapshot } from './types.js';

const { appId: PRIVY_APP_ID, appSecret: PRIVY_APP_SECRET } = resolvePrivyServerConfig();
let xIdentityPrivyClient: PrivyClient | null = null;
const AUTO_SYNC_COOLDOWN_MS = 60_000;
const autoSyncCooldown = new Map<string, number>();

function getXIdentityPrivyClient(): PrivyClient {
  if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
    throw new Error('Privy server credentials are not configured');
  }
  if (!xIdentityPrivyClient) {
    xIdentityPrivyClient = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);
  }
  return xIdentityPrivyClient;
}

export function extractPrivyXAccount(user: any): { xUserId: string | null; username: string | null } {
  const account = (user?.linkedAccounts || []).find((acc: any) => {
    const type = String(acc?.type || '').toLowerCase();
    return type === 'twitter' || type === 'x';
  });
  const xUserId = String(account?.subject || account?.userId || user?.twitter?.subject || user?.twitter?.userId || '').trim() || null;
  const username = normalizeXUsername(account?.username || user?.twitter?.username || null);
  return { xUserId, username };
}

export async function getVerifiedPrivyXAccount(userId: string): Promise<{ xUserId: string | null; username: string | null }> {
  const client = getXIdentityPrivyClient();
  const user = await client.getUser(userId);
  return extractPrivyXAccount(user);
}

export function normalizeXUsername(username?: string | null): string | null {
  const value = String(username || '').trim().replace(/^@/, '');
  return value || null;
}

export function buildXProfileUrl(username?: string | null): string | null {
  const normalized = normalizeXUsername(username);
  return normalized ? `https://x.com/${normalized}` : null;
}

export function buildXLinkUrl(params?: { username?: string | null }): string {
  const base = String(env.x.linkBaseUrl || 'https://kikoapp.app/settings').trim();
  try {
    const url = new URL(base);
    url.searchParams.set('connect', 'x');
    if (params?.username) {
      url.searchParams.set('x', normalizeXUsername(params.username) || '');
    }
    return url.toString();
  } catch {
    return base;
  }
}

export function serializeXContext(user: {
  xUserId?: string | null;
  xUsername?: string | null;
  xLinkedAt?: Date | null;
  xDmOptInAt?: Date | null;
  xNotificationsMutedAt?: Date | null;
} | null): XIdentitySnapshot {
  return {
    xUserId: user?.xUserId || null,
    username: user?.xUsername || null,
    profileUrl: buildXProfileUrl(user?.xUsername),
    linkedAt: user?.xLinkedAt?.toISOString() || null,
    dmOptInAt: user?.xDmOptInAt?.toISOString() || null,
    notificationsMuted: Boolean(user?.xNotificationsMutedAt),
    linkUrl: buildXLinkUrl({ username: user?.xUsername || null }),
  };
}

export async function getUserByXUserId(xUserId: string) {
  if (!xUserId) return null;
  return prisma.user.findUnique({
    where: { xUserId },
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

export async function syncVerifiedPrivyXUser(params: {
  userId: string;
  dmOptIn?: boolean;
  accessTokenRef?: string | null;
  refreshTokenRef?: string | null;
}): Promise<{ status: 'synced' | 'no_x_account' | 'missing_wallet'; user: any | null }> {
  const verifiedXAccount = await getVerifiedPrivyXAccount(params.userId);
  const xUserId = String(verifiedXAccount.xUserId || '').trim();
  const username = normalizeXUsername(verifiedXAccount.username);
  const dmOptIn = params.dmOptIn !== false;
  const accessTokenRef = String(params.accessTokenRef || '').trim() || null;
  const refreshTokenRef = String(params.refreshTokenRef || '').trim() || null;

  if (!xUserId) {
    return { status: 'no_x_account', user: null };
  }

  const existingOwner = await prisma.user.findFirst({
    where: {
      xUserId,
      NOT: { privyDid: params.userId },
    },
    select: { privyDid: true },
  });
  if (existingOwner) {
    throw new Error('X account already linked to another user');
  }

  const existingUser = await prisma.user.findUnique({
    where: { privyDid: params.userId },
    select: {
      privyDid: true,
      username: true,
      xDmOptInAt: true,
    },
  });

  if (existingUser) {
    const user = await prisma.user.update({
      where: { privyDid: params.userId },
      data: {
        username: existingUser.username || username,
        xUserId,
        xUsername: username,
        xLinkedAt: new Date(),
        xDmOptInAt: existingUser.xDmOptInAt || (dmOptIn ? new Date() : null),
        xAccessTokenRef: accessTokenRef,
        xRefreshTokenRef: refreshTokenRef,
        xNotificationsMutedAt: null,
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
      username: username,
      walletAddress: embeddedWalletAddress,
      xUserId,
      xUsername: username,
      xLinkedAt: new Date(),
      xDmOptInAt: dmOptIn ? new Date() : null,
      xAccessTokenRef: accessTokenRef,
      xRefreshTokenRef: refreshTokenRef,
      xNotificationsMutedAt: null,
    },
  });

  return { status: 'synced', user };
}

export async function maybeAutoSyncVerifiedPrivyXUser(userId: string): Promise<void> {
  if (!userId) return;
  const lastAttemptAt = autoSyncCooldown.get(userId) || 0;
  if ((Date.now() - lastAttemptAt) < AUTO_SYNC_COOLDOWN_MS) {
    return;
  }

  const existingUser = await prisma.user.findUnique({
    where: { privyDid: userId },
    select: { xUserId: true },
  }).catch(() => null);

  if (existingUser?.xUserId) {
    return;
  }

  autoSyncCooldown.set(userId, Date.now());
  await syncVerifiedPrivyXUser({ userId, dmOptIn: true }).catch(() => undefined);
}

export async function getXContextForUser(userId: string): Promise<XIdentitySnapshot | null> {
  const user = await prisma.user.findUnique({
    where: { privyDid: userId },
    select: {
      xUserId: true,
      xUsername: true,
      xLinkedAt: true,
      xDmOptInAt: true,
      xNotificationsMutedAt: true,
    },
  });
  if (!user) return null;
  return serializeXContext(user);
}
