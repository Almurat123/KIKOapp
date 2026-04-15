// CONTEXT MEMORY
// Updated: 2026-04-15
// Author: Almurat
// Reason: product policy changed the canonical default away from Grok to GPT
//         while keeping X and Farcaster replies bound to each user's saved
//         preference. The backend must still normalize every user-selected
//         model against one shared allowlist.
// Goal: preserve a single canonical chat-model default and normalization rule
//       across web chat, persisted user settings, X mention sessions, and
//       Farcaster mention sessions.
// Owns: supported model ids, default model selection, and backend normalization.
// Does Not Own: pricing, provider credentials, or frontend dropdown rendering.
// Design Language:
// - Keep one canonical default model id for all new user-facing chat sessions.
// - Normalize model ids at write boundaries before persisting them.
// - Never let X mention sessions silently fall back to an unrelated legacy model.
// - Do not duplicate model default strings across owner layers.
// Document Provenance:
// - Source: operator request to switch the product default from Grok to GPT while
//           preserving the user's saved model for X/Farcaster replies
// - Kind: product doc
// - Retrieved: 2026-04-15
// - Applied To: canonical default model and persisted user model preference
// - Verification: verified in code
// - Source: current repo model catalog in kiko-web/src/components/Chat/chatConstants.ts
// - Kind: repo doc
// - Retrieved: 2026-04-15
// - Applied To: supported model allowlist used by backend normalization
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-default-chat-model-switch-to-gpt.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-x-verified-mentions-only.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

export const DEFAULT_CHAT_MODEL = 'gpt-5.4-mini-2026-03-17';

export const SUPPORTED_CHAT_MODELS = new Set([
  'deepseek-chat',
  'deepseek-reasoner',
  'gpt-5.4-mini-2026-03-17',
  'grok-4-1-fast-reasoning',
  'grok-4-1-fast-non-reasoning',
]);

export function normalizeSupportedChatModel(model?: string | null): string {
  const normalized = String(model || '').trim().toLowerCase();
  if (!normalized) return DEFAULT_CHAT_MODEL;
  return SUPPORTED_CHAT_MODELS.has(normalized) ? normalized : DEFAULT_CHAT_MODEL;
}
