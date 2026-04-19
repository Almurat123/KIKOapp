# 2026-04-18 Chat Model Reasoning Selection Persistence

## What Changed

- Added a shared chat-model selection persistence helper for the welcome shell
  and live chat surface.
- Switched both owners to read the saved selected model through the same helper
  so stored reasoning or image-quality state is restored through one code path.
- Persisted model selection immediately when the user changes it, instead of
  waiting only for a later state effect.
- Added a regression test for restoring saved reasoning-strength snapshots.

## Why

The reasoning-strength picker was falling back to the default choice after a
quick refresh or return-to-app flow because the welcome shell relied on a later
state effect to write the new selection. If the component unmounted before that
effect ran, the saved snapshot never reached localStorage.

## Product Rule

- Selected model state must be written immediately when the user changes it.
- Stored model snapshots must round-trip reasoning strength or image quality,
  not only the model id.
- Welcome and chat surfaces must use the same local-storage read path.

## Verification

- Verified in code that both `WelcomeScreen` and `ChatInterface` now read from
  the shared persistence helper.
- Verified in code that both user-facing selection callbacks write localStorage
  synchronously before the next navigation or effect flush.
- Added `chatModelSelectionPersistence.test.ts` to cover reasoning-strength
  restore cases.
- Full runtime verification still depends on local test execution.

## Document Provenance

- Source: user bug report in the local runtime thread.
  - Kind: product instruction / runtime observation
  - Retrieved: 2026-04-18
  - Applied To: immediate persistence of chat model reasoning selection
  - Verification: inferred from code and helper tests
- Source: `/Users/almurat/KiKo/kiko-web/src/components/Chat/ChatInterface.tsx`
  - Kind: repo doc
  - Retrieved: 2026-04-18
  - Applied To: chat surface persistence path
  - Verification: verified in code
- Source: `/Users/almurat/KiKo/kiko-web/src/components/Chat/WelcomeScreen.tsx`
  - Kind: repo doc
  - Retrieved: 2026-04-18
  - Applied To: welcome shell persistence path
  - Verification: verified in code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-input-borderless-model-reasoning-selector.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-model-thinking-label-correction.md
- /Users/almurat/KiKo/system-journal/owner-map/frontend-data-loading.md
- /Users/almurat/KiKo/system-journal/conflicts.md
