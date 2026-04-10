# Fix Log: 2026-04-10 User Default Chat Model For X Mentions

## What Changed

- Added a persisted `UserSettings.defaultChatModel` field.
- Changed the canonical chat default to `grok-4-1-fast-non-reasoning`.
- Updated the web chat model picker to save the selected model into backend user settings, not just localStorage.
- Updated X mention session creation to use the user's saved default model.
- Updated existing X mention sessions to follow the latest saved user model before running the agent task.

## Why

The previous behavior drifted across three owners:

1. web UI default model came from localStorage or array order
2. backend chat session creation defaulted to `deepseek-chat`
3. X mention sessions created without an explicit model and therefore silently inherited the backend fallback

That meant a user could change models on the website but still get X mention replies from a different model.

## Owner Boundary

- `kiko-web` owns model selection UI and immediate persistence trigger.
- `UserSettings.defaultChatModel` owns the canonical per-user preference.
- X mention routing owns applying that persisted preference when creating or reusing X-linked chat sessions.

## Document Provenance

- Source: Product requirement from operator
- Kind: product doc
- Retrieved: 2026-04-10
- Applied To: setting `grok-4-1-fast-non-reasoning` as the website default and binding X mention replies to per-user saved model preferences
- Verification: partially verified

- Source: `/Users/almurat/KiKo/kiko-web/src/components/Chat/chatConstants.ts`
- Kind: repo doc
- Retrieved: 2026-04-10
- Applied To: backend supported model allowlist normalization
- Verification: verified in code

- Source: `/Users/almurat/KiKo/kiko-api/src/services/x/xIngressWorker.ts`
- Kind: repo doc
- Retrieved: 2026-04-10
- Applied To: X mention reply path uses the saved per-user model before enqueueing agent work
- Verification: verified in code
