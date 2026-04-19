# 2026-04-19 Chat Model Reasoning Database Persistence

## What Changed

- Added `defaultChatReasoningLevel` to the persisted `UserSettings` contract
  and wired the authenticated settings route to save the paired reasoning level
  alongside the selected default model.
- Added `reasoningLevel` to persisted chat sessions and updated session
  creation / hydration so conversation reloads keep the same reasoning state
  instead of collapsing to the default.
- Changed the chat and welcome shells to restore from localStorage first, then
  fall back to the remote user default only when no local snapshot exists.
- Updated the frontend conversation DTO and create-session request path to
  round-trip the saved reasoning level.
- Added a backend regression test for reasoning normalization and model-driven
  inference.

## Why

The model choice and the thinking strength were not surviving a page refresh.
The UI was restoring only the model id, while the backend settings/session
rows did not carry the paired reasoning level. For split-effort families such
as GPT-5.4 mini, model id alone is not enough to reconstruct the same control
state.

## Verification

- Verified in code that `ChatInterface` and `WelcomeScreen` now restore the
  local snapshot before reading the remote default.
- Verified in code that `saveUserSettings` now persists both `defaultChatModel`
  and `defaultChatReasoningLevel`.
- Verified in code that chat session creation and hydration now include the
  saved reasoning level.
- Verified with:
  - `cd /Users/almurat/KiKo/kiko-api && npm exec tsc --noEmit --pretty false`
  - `cd /Users/almurat/KiKo/kiko-web && npm exec tsc --noEmit --pretty false`
  - `cd /Users/almurat/KiKo/kiko-api && npm exec tsx --test src/config/chatModels.test.ts`

## Document Provenance

- Source: user report that model selection reset to Kimi after refresh and
  reasoning strength did not persist
  - Kind: runtime observation
  - Retrieved: 2026-04-19
  - Applied To: deciding to persist reasoning in both user settings and chat sessions
  - Verification: verified in code
- Source: `/Users/almurat/KiKo/kiko-api/src/config/chatModels.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-19
  - Applied To: backend reasoning normalization and inference helpers
  - Verification: verified in code
- Source: OpenAI GPT-5.4 model page and current repo model catalog
  - Kind: official API doc / repo doc
  - Retrieved: 2026-04-19
  - Applied To: preserving the GPT-5.4 mini Low/Medium effort snapshot
  - Verification: verified in docs and code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/loading-resilience.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-model-reasoning-selection-persistence.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-default-chat-model-switch-to-kimi-instant.md
- /Users/almurat/KiKo/system-journal/conflicts.md
