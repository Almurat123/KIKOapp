// CONTEXT MEMORY
// Updated: 2026-04-16
// Author: Linh Tran
// Reason: Farcaster social-agent ingress now needs cast-level image/embed
//         context so the model can see attached media rather than only parent
//         thread text. The webhook event snapshot remains lean, but hydrated
//         cast context must preserve normalized image inputs.
// Goal: keep mention events lightweight while exposing media-aware cast context
//       for Farcaster social-agent replies.
// Owns: shared Farcaster ingress event/context contracts.
// Does Not Own: Neynar/Hub fetching, webhook verification, or prompt assembly.
// Design Language:
// - Webhook mention events stay small and string-safe.
// - Hydrated cast context carries normalized media URLs separately from raw embeds.
// - Downstream owners should not parse provider-specific embed payloads twice.
// Document Provenance:
// - Source: Neynar cast lookup and notifications docs
// - Kind: official API doc
// - Retrieved: 2026-04-16
// - Applied To: media-aware Farcaster cast context hydration
// - Verification: verified in docs
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-social-agent-thread-context-and-image-input.md
// - /Users/almurat/KiKo/system-journal/owner-map/farcaster-neynar-webhook-ingress.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

export type FarcasterChannel = 'mention';

export interface FarcasterMentionEvent {
  eventId: string;
  notificationType: 'mentions' | 'replies';
  castHash: string;
  text: string;
  authorFid: number;
  authorUsername?: string | null;
  parentHash?: string | null;
  parentAuthorFid?: number | null;
  rootCastHash?: string | null;
  occurredAt?: string | null;
}

export interface FarcasterCastContext {
  hash: string;
  text: string;
  authorFid: number | null;
  authorUsername?: string | null;
  parentHash?: string | null;
  parentAuthorFid?: number | null;
  timestamp?: string | null;
  images?: Array<{
    url: string;
    altText?: string | null;
    mimeType?: string | null;
    sourceLabel?: string | null;
  }>;
}

export interface FarcasterSendResult {
  hash: string | null;
  raw: unknown;
}
