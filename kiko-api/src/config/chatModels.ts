// CONTEXT MEMORY
// Updated: 2026-04-18
// Author: Almurat
// Reason: product policy changed the canonical default from GPT to the free
//         Kimi 2.5 Instant/Fast model while keeping X and Farcaster replies
//         bound to each user's saved preference. The backend must still
//         normalize every user-selected model against one shared allowlist, and
//         DeepSeek ids are being replaced by NVIDIA-hosted GLM/Kimi ids. Later
//         official NVIDIA doc verification showed GLM-5 does not define a
//         documented Fast/Instant hosted mode, so the allowlist must collapse
//         GLM back to one canonical id while still normalizing removed legacy
//         aliases from stored user settings.
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
// - Remove provider modes that are not documented by the current official model page.
// - Legacy removed ids may normalize to a surviving canonical id at the
//   boundary, but must not remain active allowlisted options.
// Document Provenance:
// - Source: operator request to switch the product default from GPT to free Kimi
//           2.5 Instant while preserving the user's saved model for X/Farcaster replies
// - Kind: product doc
// - Retrieved: 2026-04-17
// - Applied To: canonical default model and persisted user model preference
// - Verification: verified in code
// - Source: current repo model catalog in kiko-web/src/components/Chat/chatConstants.ts
// - Kind: repo doc
// - Retrieved: 2026-04-16
// - Applied To: supported model allowlist used by backend normalization after NVIDIA model replacement
// - Verification: verified in code
// - Source: NVIDIA NIM model pages for moonshotai/kimi-k2-5 and z-ai/glm5
// - Kind: official API doc
// - Retrieved: 2026-04-16
// - Applied To: backend-supported model ids for NVIDIA Kimi/GLM
// - Verification: verified in code
// - Source: NVIDIA NIM model page for z-ai/glm5
// - Kind: official API doc
// - Retrieved: 2026-04-18
// - Applied To: removing `glm-5-reasoning` from the active allowlist while
//   keeping a compatibility normalization to `glm-5`
// - Verification: verified in docs and code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-default-chat-model-switch-to-kimi-instant.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-default-chat-model-switch-to-gpt.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-nvidia-glm-kimi-provider-replacement.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-model-thinking-label-correction.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-x-verified-mentions-only.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

export const DEFAULT_CHAT_MODEL = 'kimi-k2-5-instant';

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
  'glm-5',
  'kimi-k2-5-reasoning',
  'kimi-k2-5-instant',
  'gpt-5.4-mini-2026-03-17',
  'grok-4-1-fast-reasoning',
  'grok-4-1-fast-non-reasoning',
]);

export function normalizeSupportedChatModel(model?: string | null): string {
  const normalized = String(model || '').trim().toLowerCase();
  if (!normalized) return DEFAULT_CHAT_MODEL;
  if (
    normalized === 'glm-5-reasoning' ||
    normalized === 'glm5-reasoning' ||
    normalized === 'z-ai/glm5-reasoning' ||
    normalized === 'z-ai/glm-5-reasoning' ||
    normalized === 'glm5' ||
    normalized === 'z-ai/glm5' ||
    normalized === 'z-ai/glm-5'
  ) {
    return 'glm-5';
  }
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
    normalized === 'glm-5' ||
    normalized === 'kimi-k2-5-reasoning' ||
    normalized === 'grok-4-1-fast-reasoning'
  ) {
    return 'thinking';
  }
  if (normalized === 'gpt-5.4-mini-2026-03-17') {
    return 'low';
  }
  return 'fast';
}
