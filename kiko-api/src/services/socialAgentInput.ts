// CONTEXT MEMORY
// Updated: 2026-04-16
// Author: Linh Tran
// Reason: X and Farcaster social-agent ingress now need one shared,
//         serializable multimodal contract so the worker layer can preserve
//         thread text and image provenance without re-inventing provider input
//         shapes in multiple owners. The chat runtime still persists a plain
//         text transport message for audit/history, but it also needs a stable
//         structured attachment envelope for vision-capable providers.
// Goal: keep social ingress multimodal context explicit, provider-agnostic,
//       and safe to persist inside toolContext/message data.
// Owns: normalized social-agent multimodal input shape and image de-duplication.
// Does Not Own: platform-specific thread fetching, provider capability policy,
//               or database persistence.
// Design Language:
// - Social ingress must keep a plain-text transport message for audit/history.
// - Structured image attachments belong in a separate serializable envelope.
// - Image entries must be URL-normalized and de-duplicated before they reach
//   provider adapters.
// - Source labels should explain where each image came from without leaking
//   provider-specific request syntax.
// Document Provenance:
// - Source: X expansions/media docs
// - Kind: official API doc
// - Retrieved: 2026-04-16
// - Applied To: preserving post/thread media as normalized social-agent inputs
// - Verification: verified in docs
// - Source: Neynar cast lookup and notifications docs
// - Kind: official API doc
// - Retrieved: 2026-04-16
// - Applied To: preserving cast embed media as normalized social-agent inputs
// - Verification: verified in docs
// - Source: OpenAI Images and Vision / Chat Completions docs
// - Kind: official API doc
// - Retrieved: 2026-04-16
// - Applied To: provider-facing multimodal `content` arrays for social-agent turns
// - Verification: verified in docs
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-social-agent-thread-context-and-image-input.md
// - /Users/almurat/KiKo/system-journal/owner-map/farcaster-neynar-webhook-ingress.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

export type SocialPlatform = 'x' | 'farcaster';

export interface SocialImageInput {
  url: string;
  altText?: string | null;
  sourceId?: string | null;
  sourceLabel?: string | null;
  mimeType?: string | null;
}

export interface SocialAgentInput {
  platform: SocialPlatform;
  currentText: string;
  threadContextText?: string | null;
  images: SocialImageInput[];
}

export function normalizeSocialImageUrl(value: unknown): string | null {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  if (!/^https?:\/\//i.test(normalized)) return null;
  return normalized;
}

export function dedupeSocialImages(
  images: Array<SocialImageInput | null | undefined>,
  maxCount: number = 4,
): SocialImageInput[] {
  const next: SocialImageInput[] = [];
  const seen = new Set<string>();

  for (const item of images) {
    const url = normalizeSocialImageUrl(item?.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    next.push({
      url,
      altText: item?.altText ? String(item.altText).trim() || null : null,
      sourceId: item?.sourceId ? String(item.sourceId).trim() || null : null,
      sourceLabel: item?.sourceLabel ? String(item.sourceLabel).trim() || null : null,
      mimeType: item?.mimeType ? String(item.mimeType).trim() || null : null,
    });
    if (next.length >= Math.max(1, Math.trunc(maxCount || 4))) break;
  }

  return next;
}
