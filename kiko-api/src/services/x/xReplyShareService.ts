// CONTEXT MEMORY
// Updated: 2026-04-13
// Author: Rowan
// Reason: X mention replies now use a public KIKO share link instead of posting
//         full AI-generated text directly on X. The share target must be safe
//         for X card crawlers, yet must not expose private chat session access.
//         The share payload was later expanded to persist the user's original
//         prompt so the OG image can render a conversation-style preview. The
//         assistant preview now preserves paragraph boundaries instead of
//         collapsing everything into one line, because the OG image should feel
//         like a real reply excerpt, not a rewritten marketing summary. Later
//         review showed the preview was too aggressively truncated, leaving only
//         one or two visible lines in the card. The share summary budget was
//         expanded so the image can show a deeper excerpt and fade it out.
//         A later production check showed X can keep serving a stale card image
//         for an old share URL even after the renderer is fixed at origin. The
//         canonical OG image URL now carries a renderer version suffix so new
//         shares force a fresh card-image fetch instead of inheriting a cached
//         broken preview.
// Goal: generate opaque public share records that expose only preview-safe
//       summary text while still linking the user back into their real KIKO chat.
// Owns: X reply share token creation, preview-safe text shaping, and canonical
//       share/open-app URL construction.
// Does Not Own: model execution, X webhook parsing, or HTML/OG image rendering.
// Design Language:
// - Never put private session keys or auth tokens into the share URL.
// - Public shares may contain only preview-safe summary text, not full private history.
// - Share links must be deterministic from persisted rows, not runtime-only memory.
// - Open-app links should target the website chat route, not the public share page itself.
// - Keep enough reply text for the OG image to feel like a real excerpt, not a slogan.
// Document Provenance:
// - Source: X Cards markup + Getting started docs
// - Kind: official API doc
// - Retrieved: 2026-04-11
// - Applied To: server-rendered share pages with stable `twitter:*` metadata for crawler access
// - Verification: partially verified
// - Source: Open Graph protocol
// - Kind: official API doc
// - Retrieved: 2026-04-11
// - Applied To: fallback `og:*` metadata and image contract for public share pages
// - Verification: partially verified
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-11-x-reply-share-pages.md
// - Kind: repo doc
// - Retrieved: 2026-04-11
// - Applied To: reply-mode shift from direct X text to KIKO-hosted summary shares
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-12-x-share-og-chat-preview.md
// - Kind: repo doc
// - Retrieved: 2026-04-12
// - Applied To: persisting prompt snippets for the chat-screenshot card layout
// - Verification: verified in code
// - Source: user-provided design correction in active task thread
// - Kind: product/design reference
// - Retrieved: 2026-04-12
// - Applied To: preserving real prompt/reply preview formatting for X share cards
// - Verification: verified in design direction
// - Source: user-provided product correction in active task thread
// - Kind: product/design reference
// - Retrieved: 2026-04-13
// - Applied To: increasing public preview length so the OG image can render
//   several reply lines before fading out
// - Verification: verified in design direction
// - Source: runtime verification against https://api.kikoapp.app/api/images/x-share/<token>.png
// - Kind: runtime observation
// - Retrieved: 2026-04-13
// - Applied To: adding a renderer version suffix to canonical OG image URLs so
//   new share links cannot reuse stale X card-image cache entries
// - Verification: verified in runtime
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-11-x-reply-share-pages.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-12-x-share-og-chat-preview.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-13-x-share-card-cache-busting.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
import crypto from 'node:crypto';
import prisma from '../../db/prisma.js';
import { env } from '../../config/env.js';

const DEFAULT_SHARE_BASE_URL = 'https://api.kikoapp.app/x/share';
const DEFAULT_SHARE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_PREVIEW_TITLE = 'KIKO trade ready';
const MAX_PROMPT_LENGTH = 96;
const MAX_SUMMARY_LENGTH = 560;
const X_SHARE_RENDER_VERSION = '2026-04-13b';

function normalizeUrlBase(input: string): string {
  return String(input || '').trim().replace(/\/+$/, '');
}

function stripMarkdown(input: string): string {
  return String(input || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/^>\s+/gm, '')
    .replace(/^#+\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePreviewText(input: string): string {
  return String(input || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/^>\s+/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '- ')
    .split(/\n+/)
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

export function summarizeXReplyText(input: string): string {
  const normalized = normalizePreviewText(input);
  if (!normalized) {
    return 'Open in KIKO to view the trade reply.';
  }
  if (normalized.length <= MAX_SUMMARY_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, MAX_SUMMARY_LENGTH - 1).trimEnd()}…`;
}

export function summarizeXPromptText(input: string): string {
  const normalized = stripMarkdown(input);
  if (!normalized) {
    return 'Open in KIKO';
  }
  if (normalized.length <= MAX_PROMPT_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, MAX_PROMPT_LENGTH - 1).trimEnd()}…`;
}

export function getXReplyShareBaseUrl(): string {
  return normalizeUrlBase(env.x.shareBaseUrl || process.env.API_URL || DEFAULT_SHARE_BASE_URL);
}

export function buildXReplyShareUrl(token: string): string {
  return `${getXReplyShareBaseUrl()}/${encodeURIComponent(token)}`;
}

export function buildXReplyShareImageUrl(token: string, versionSuffix?: string): string {
  const encodedToken = encodeURIComponent(token);
  const query = versionSuffix ? `?v=${encodeURIComponent(versionSuffix)}` : '';
  try {
    const shareBase = new URL(getXReplyShareBaseUrl());
    return `${shareBase.protocol}//${shareBase.host}/api/images/x-share/${encodedToken}.png${query}`;
  } catch {
    return `https://api.kikoapp.app/api/images/x-share/${encodedToken}.png${query}`;
  }
}

export function buildXReplyShareImageVersion(createdAt: Date | string | number): string {
  const created = new Date(createdAt);
  const timestamp = Number.isFinite(created.getTime()) ? String(created.getTime()) : '0';
  return `${X_SHARE_RENDER_VERSION}-${timestamp}`;
}

export function buildKikoWebBaseUrl(): string {
  const base = String(env.x.linkBaseUrl || 'https://kikoapp.app/settings').trim();
  try {
    const parsed = new URL(base);
    return normalizeUrlBase(`${parsed.protocol}//${parsed.host}`);
  } catch {
    return 'https://kikoapp.app';
  }
}

export function buildXReplyOpenAppUrl(chatSessionId: string): string {
  return `${buildKikoWebBaseUrl()}/chat/${encodeURIComponent(chatSessionId)}?source=x-reply-share`;
}

export async function createXReplyShare(params: {
  userId?: string | null;
  xUserId: string;
  conversationMappingId?: string | null;
  chatSessionId: string;
  sourceTweetId?: string | null;
  promptText: string;
  assistantText: string;
}) {
  if (params.sourceTweetId) {
    const existing = await prisma.xReplyShare.findFirst({
      where: {
        xUserId: params.xUserId,
        chatSessionId: params.chatSessionId,
        sourceTweetId: params.sourceTweetId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      if (!String(existing.prompt || '').trim()) {
        const repaired = await prisma.xReplyShare.update({
          where: { id: existing.id },
          data: {
            prompt: summarizeXPromptText(params.promptText),
          },
        });
        return {
          record: repaired,
          shareUrl: buildXReplyShareUrl(repaired.token),
          imageUrl: buildXReplyShareImageUrl(repaired.token, buildXReplyShareImageVersion(repaired.createdAt)),
          openAppUrl: buildXReplyOpenAppUrl(repaired.chatSessionId),
        };
      }
      return {
        record: existing,
        shareUrl: buildXReplyShareUrl(existing.token),
        imageUrl: buildXReplyShareImageUrl(existing.token, buildXReplyShareImageVersion(existing.createdAt)),
        openAppUrl: buildXReplyOpenAppUrl(existing.chatSessionId),
      };
    }
  }

  const token = crypto.randomBytes(18).toString('base64url');
  const record = await prisma.xReplyShare.create({
    data: {
      token,
      userId: params.userId || null,
      xUserId: params.xUserId,
      conversationMappingId: params.conversationMappingId || null,
      chatSessionId: params.chatSessionId,
      sourceTweetId: params.sourceTweetId || null,
      title: DEFAULT_PREVIEW_TITLE,
      prompt: summarizeXPromptText(params.promptText),
      summary: summarizeXReplyText(params.assistantText),
      expiresAt: new Date(Date.now() + DEFAULT_SHARE_TTL_MS),
    },
  });

  return {
    record,
    shareUrl: buildXReplyShareUrl(record.token),
    imageUrl: buildXReplyShareImageUrl(record.token, buildXReplyShareImageVersion(record.createdAt)),
    openAppUrl: buildXReplyOpenAppUrl(record.chatSessionId),
  };
}

export async function getActiveXReplyShare(token: string) {
  const normalized = String(token || '').trim();
  if (!normalized) return null;
  const share = await prisma.xReplyShare.findUnique({
    where: { token: normalized },
  });
  if (!share) return null;
  if (share.expiresAt.getTime() <= Date.now()) return null;
  return share;
}

export async function markXReplyShareOpened(token: string): Promise<void> {
  await prisma.xReplyShare.updateMany({
    where: {
      token,
      openedAt: null,
    },
    data: {
      openedAt: new Date(),
    },
  }).catch(() => {});
}
