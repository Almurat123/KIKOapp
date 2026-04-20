# 2026-04-20 Chat Home Default And Session Model Separation

## What Changed

- Stopped `ChatInterface` from writing chat-route model changes back into the
  shared home/default model snapshot.
- Gated the `localStorage` and storage-event sync in `ChatInterface` so it
  only follows the welcome/home model while the home shell is active.
- Updated the model-selection persistence helper comments to describe the
  persisted snapshot as the home/default model, not the active conversation
  model.
- Kept `WelcomeScreen` as the owner that writes the persisted home/default
  selection and remote user-settings default.

## Why

The same saved model snapshot was being reused for two different scopes:

1. the welcome/home default model
2. the active conversation model

When a conversation route synced its model into the shared snapshot, leaving
that route caused the homepage to reopen with the conversation's model instead
of the user's original home default.

## Verification

- Verified in code that `ChatInterface` no longer persists chat-route model
  flips into the shared home snapshot.
- Verified in code that `ChatInterface` only listens to shared model changes
  while the home shell is active.
- Verified in code that `WelcomeScreen` remains the home/default persistence
  owner.
- Verified in code that the persistence helper comments now scope the shared
  snapshot to the home/default model.
- Verified `npm exec tsc --noEmit --pretty false` in `kiko-web`.

## Document Provenance

- Source: current bug report that the homepage model matched the conversation
  model after exiting chat
  - Kind: runtime observation
  - Retrieved: 2026-04-20
  - Applied To: separating the home/default snapshot from the active
    conversation model
  - Verification: inferred from code
- Source: `/Users/almurat/KiKo/kiko-web/src/components/Chat/ChatInterface.tsx`
  - Kind: repo doc
  - Retrieved: 2026-04-20
  - Applied To: route-gated model sync and removal of chat-route snapshot writes
  - Verification: verified in code
- Source: `/Users/almurat/KiKo/kiko-web/src/components/Chat/WelcomeScreen.tsx`
  - Kind: repo doc
  - Retrieved: 2026-04-20
  - Applied To: home/default-only persistence owner boundary
  - Verification: verified in code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-chat-model-family-control-memory.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-chat-model-reasoning-database-persistence.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-model-reasoning-selection-persistence.md
- /Users/almurat/KiKo/system-journal/conflicts.md
