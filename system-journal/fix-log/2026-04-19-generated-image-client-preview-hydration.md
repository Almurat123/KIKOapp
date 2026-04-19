# 2026-04-19 Generated Image Client Preview Hydration

## What Changed

- Updated the generated-image chat task broadcast path so the WebSocket payload
  sent to the browser now carries hydrated `previewUrl` image attachments.
- Kept the database row and persisted task state on private object-key storage;
  only the client-facing broadcast was changed.
- Updated the frontend generated-image live-state path so a terminal
  `update_message_data.generatedImage.status` now finalizes the assistant row
  and clears the matching `activeTask` without waiting for a later
  `message_complete` or `task_status` event.
- Bound frontend `activeTask` state to the assistant `messageId` when websocket
  task events provide it, so terminal generated-image updates only clear the
  correct task.

## Why

The generated-image task owner was persisting assistant image rows correctly,
but the live browser path was receiving `generatedImage.images` entries without
`previewUrl`. The chat UI only renders generated-image frames when a preview URL
is present, so completed image replies could stay invisible until a later
hydration pass.

A second runtime report the same day showed the image card could become visible
while the composer still showed perpetual loading. The frontend was promoting
the row to `generated-image`, but it left the message in `streaming` status and
kept `activeTask` alive unless separate completion events arrived later. When
those events were delayed or overwritten, the state machine never settled.

## Verification

- Verified in code that the broadcast path now calls the existing hydration
  helper before sending `update_message_data` to chat clients.
- Verified in code that the persisted message row still stores private object
  keys and is not rewritten with public URLs.
- Verified in code that terminal generated-image payloads now map the assistant
  row to `complete` or `error` immediately inside the live chat owner.
- Verified in code that frontend `activeTask` state now carries `messageId`
  context from websocket `task_status` events and only clears when that context
  matches the terminal generated-image update.
- Verified with `npx tsx --test /Users/almurat/KiKo/kiko-web/src/components/Chat/generatedImageTaskState.test.ts`.

## Document Provenance

- Source: operator runtime report that text-model-triggered image generation
  completed without showing the final image in chat
- Kind: runtime observation
- Retrieved: 2026-04-19
- Applied To: selecting the generated-image client broadcast as the missing
  visibility boundary
- Verification: verified in code
- Source: operator screenshot and runtime report on 2026-04-19 showing the
  generated-image card rendered while the composer remained in loading state
- Kind: runtime observation
- Retrieved: 2026-04-19
- Applied To: treating generated-image terminal payloads as a chat-lifecycle
  completion boundary and binding active-task cleanup to assistant message ids
- Verification: verified in code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-generated-image-chat-execution-and-ui.md
- /Users/almurat/KiKo/system-journal/design-language/generated-image-loading.md
- /Users/almurat/KiKo/system-journal/design-language/generated-image-safety.md
