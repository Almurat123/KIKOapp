import prisma from '../../db/prisma.js';
import { env } from '../../config/env.js';
import type { XIdentitySnapshot } from './types.js';

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
  });
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
