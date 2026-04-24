// CONTEXT MEMORY
// Updated: 2026-04-23
// Author: Almurat
// Reason: product policy moved the canonical default back to GPT-5.4 Mini
//         while keeping X and Farcaster replies bound to each user's saved
//         preference. The backend must still normalize every user-selected
//         model against one shared allowlist, but the allowlist now stays on the
// Goal: preserve a single canonical chat-model default and normalization rule
//       across web chat, persisted user settings, X mention sessions, and
//       Farcaster mention sessions, while also providing a stable reasoning
//       fallback for persisted model preferences that need to round-trip the
//       selected effort / thinking level.
// Owns: supported model ids, default model selection, and backend normalization.
// Does Not Own: pricing, provider credentials, or frontend dropdown rendering.
// Design Language:
// - Keep one canonical default model id for all new user-facing chat sessions.
// - Normalize model ids at write boundaries before persisting them.
// - Never let X mention sessions silently fall back to an unrelated legacy model.
// - Do not duplicate model default strings across owner layers.
// - Persisted model preferences must also carry a normalized reasoning level
//   so split-effort families can reopen with the same control choice.
// - Provider replacement must happen through model allowlists, not ad hoc aliases in callers.
// - Removed provider modes must not remain active allowlisted options.
// - Legacy removed ids may normalize to a surviving canonical id at the
//   boundary, but must not remain active allowlisted options.
// Document Provenance:
// - Kind: product doc
// - Retrieved: 2026-04-23
// - Applied To: canonical default model and persisted user model preference
// - Verification: verified in code
// - Source: current repo model catalog in kiko-web/src/components/Chat/chatConstants.ts
// - Kind: repo doc
// - Retrieved: 2026-04-23
// - Verification: verified in code
//   from the active product model catalog
// - Kind: product doc
// - Retrieved: 2026-04-23
//   treating old ids as unsupported product input
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-default-chat-model-switch-to-gpt.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-model-thinking-label-correction.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-x-verified-mentions-only.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

export const DEFAULT_CHAT_MODEL = 'gpt-5.4-mini-2026-03-17';

export type SupportedChatReasoningLevel =
  | 'none'
  | 'fast'
  | 'thinking'
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh';

const SUPPORTED_CHAT_REASONING_LEVELS = new Set<SupportedChatReasoningLevel>([
  'none',
  'fast',
  'thinking',
  'low',
  'medium',
  'high',
  'xhigh',
]);

export const SUPPORTED_CHAT_MODELS = new Set([
  'gpt-5.4-mini-2026-03-17',
  'deepseek-v4-flash',
  'grok-4-1-fast-reasoning',
  'grok-4-1-fast-non-reasoning',
]);

export function normalizeSupportedChatModel(model?: string | null): string {
  const normalized = String(model || '').trim().toLowerCase();
  if (!normalized) return DEFAULT_CHAT_MODEL;
  return SUPPORTED_CHAT_MODELS.has(normalized) ? normalized : DEFAULT_CHAT_MODEL;
}

export function normalizeSupportedChatReasoningLevel(
  value?: string | null
): SupportedChatReasoningLevel | undefined {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return undefined;
  return SUPPORTED_CHAT_REASONING_LEVELS.has(normalized as SupportedChatReasoningLevel)
    ? (normalized as SupportedChatReasoningLevel)
    : undefined;
}

export function inferSupportedChatReasoningLevel(model?: string | null): SupportedChatReasoningLevel {
  const normalized = normalizeSupportedChatModel(model);
  if (
    normalized === 'grok-4-1-fast-reasoning'
  ) {
    return 'thinking';
  }
  if (normalized === 'gpt-5.4-mini-2026-03-17') {
    return 'low';
  }
  return 'fast';
}
