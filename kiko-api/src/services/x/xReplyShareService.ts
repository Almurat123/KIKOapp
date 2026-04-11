// CONTEXT MEMORY
// Updated: 2026-04-12
// Author: Rowan
// Reason: X mention replies now use a public KIKO share link instead of posting
//         full AI-generated text directly on X. The share target must be safe
//         for X card crawlers, yet must not expose private chat session access.
//         The share payload was later expanded to persist the user's original
//         prompt so the OG image can render a conversation-style preview.
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
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-11-x-reply-share-pages.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-12-x-share-og-chat-preview.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
import crypto from 'node:crypto';
import prisma from '../../db/prisma.js';
import { env } from '../../config/env.js';

const DEFAULT_SHARE_BASE_URL = 'https://api.kikoapp.app/x/share';
const DEFAULT_SHARE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_PREVIEW_TITLE = 'KIKO replied';
const MAX_PROMPT_LENGTH = 96;
const MAX_SUMMARY_LENGTH = 220;

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

export function summarizeXReplyText(input: string): string {
  const normalized = stripMarkdown(input);
  if (!normalized) {
    return 'Open in KIKO to view the full reply.';
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

export function buildXReplyShareImageUrl(token: string): string {
  try {
    const shareBase = new URL(getXReplyShareBaseUrl());
    return `${shareBase.protocol}//${shareBase.host}/api/images/x-share/${encodeURIComponent(token)}.png`;
  } catch {
    return `https://api.kikoapp.app/api/images/x-share/${encodeURIComponent(token)}.png`;
  }
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
          imageUrl: buildXReplyShareImageUrl(repaired.token),
          openAppUrl: buildXReplyOpenAppUrl(repaired.chatSessionId),
        };
      }
      return {
        record: existing,
        shareUrl: buildXReplyShareUrl(existing.token),
        imageUrl: buildXReplyShareImageUrl(existing.token),
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
    imageUrl: buildXReplyShareImageUrl(record.token),
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
