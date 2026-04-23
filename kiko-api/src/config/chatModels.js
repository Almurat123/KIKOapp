"use strict";
// CONTEXT MEMORY
// Updated: 2026-04-23
// Author: Almurat
// Reason: product policy moved the canonical default back to GPT-5.4 Mini
//         while keeping X and Farcaster replies bound to each user's saved
//         preference. The backend must still normalize every user-selected
//         model against one shared allowlist, but the allowlist now stays on
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
// - Provider replacement must happen through model allowlists, not ad hoc aliases in callers.
// - Remove provider modes that are not documented by the current official model page.
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPPORTED_CHAT_MODELS = exports.DEFAULT_CHAT_MODEL = void 0;
exports.normalizeSupportedChatModel = normalizeSupportedChatModel;
exports.DEFAULT_CHAT_MODEL = 'gpt-5.4-mini-2026-03-17';
exports.SUPPORTED_CHAT_MODELS = new Set([
    'gpt-5.4-mini-2026-03-17',
    'grok-4-1-fast-reasoning',
    'grok-4-1-fast-non-reasoning',
]);
function normalizeSupportedChatModel(model) {
    var normalized = String(model || '').trim().toLowerCase();
    if (!normalized)
        return exports.DEFAULT_CHAT_MODEL;
    return exports.SUPPORTED_CHAT_MODELS.has(normalized) ? normalized : exports.DEFAULT_CHAT_MODEL;
}
