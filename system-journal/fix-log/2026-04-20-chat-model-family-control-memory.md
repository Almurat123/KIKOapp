# 2026-04-20 Chat Model Family Control Memory

## What Changed

- Expanded chat model selection persistence from a single selected-model
  snapshot into a bundle that also stores the last control level used for each
  model family.
- Updated the chat model selector so switching back to a family restores that
  family's last saved reasoning or quality choice instead of the family
  default.
- Updated the welcome and chat owners to persist the new bundle format through
  the shared helper.
- Added a regression test for bundle parsing and family-level control memory.

## Why

The previous persistence fix only remembered the currently selected model. That
was enough for refreshes, but it still lost a family's last reasoning choice
when the user switched to another family and later returned. The selector was
reconstructing the new family from the current model's reasoning level, which
collapsed to the first available option when the old family did not share that
same level.

## Verification

- Verified in code that `persistChatModelSelection` now stores both the current
  model and the last control level per family.
- Verified in code that `ChatModelSelector` now checks stored family control
  memory before using the current model's control level as a fallback.
- Verified in code that the shared frontend logger no longer crashes Node-based
  regression tests when the persistence helper is imported outside Vite.
- Added and updated tests in
  `/Users/almurat/KiKo/kiko-web/src/components/Chat/chatModelSelectionPersistence.test.ts`.
- Runtime verification still pending after typecheck.

## Document Provenance

- Source: user bug report that reasoning strength resets after switching away
  from a family and switching back
  - Kind: runtime observation
  - Retrieved: 2026-04-20
  - Applied To: storing family-level control memory in the same local snapshot
  - Verification: inferred from code
- Source: `/Users/almurat/KiKo/kiko-web/src/components/Chat/ChatModelSelector.tsx`
  - Kind: repo doc
  - Retrieved: 2026-04-20
  - Applied To: family switch fallback order
  - Verification: verified in code
- Source: `/Users/almurat/KiKo/kiko-web/src/components/Chat/chatModelSelectionPersistence.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-20
  - Applied To: new snapshot bundle format
  - Verification: verified in code
- Source: `/Users/almurat/KiKo/kiko-web/src/utils/logger.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-20
  - Applied To: safe logger import in Node test runners
  - Verification: verified in code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-chat-model-reasoning-database-persistence.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-model-reasoning-selection-persistence.md
- /Users/almurat/KiKo/system-journal/conflicts.md
