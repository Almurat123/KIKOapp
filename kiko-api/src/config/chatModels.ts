// CONTEXT MEMORY
// Updated: 2026-04-10
// Author: Almurat
// Reason: chat model defaults previously drifted between frontend localStorage,
//         backend session creation, and X mention session routing. Product now
//         requires one canonical default and one normalized allowlist so X
//         replies can honor the same per-user model preference chosen on web.
// Goal: preserve a single canonical chat-model default and normalization rule
//       across web chat, persisted user settings, and X mention agent sessions.
// Owns: supported model ids, default model selection, and backend normalization.
// Does Not Own: pricing, provider credentials, or frontend dropdown rendering.
// Design Language:
// - Keep one canonical default model id for all new user-facing chat sessions.
// - Normalize model ids at write boundaries before persisting them.
// - Never let X mention sessions silently fall back to an unrelated legacy model.
// - Do not duplicate model default strings across owner layers.
// Document Provenance:
// - Source: product requirement: website default model and X mention reply model must follow the user's saved selection
// - Kind: product doc
// - Retrieved: 2026-04-10
// - Applied To: canonical default model and persisted user model preference
// - Verification: partially verified
// - Source: current repo model catalog in kiko-web/src/components/Chat/chatConstants.ts
// - Kind: repo doc
// - Retrieved: 2026-04-10
// - Applied To: supported model allowlist used by backend normalization
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-user-default-chat-model-for-x-mentions.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-x-verified-mentions-only.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

export const DEFAULT_CHAT_MODEL = 'grok-4-1-fast-non-reasoning';

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
