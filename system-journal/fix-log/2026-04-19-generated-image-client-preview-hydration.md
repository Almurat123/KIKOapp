# 2026-04-19 Generated Image Client Preview Hydration

## What Changed

- Updated the generated-image chat task broadcast path so the WebSocket payload
  sent to the browser now carries hydrated `previewUrl` image attachments.
- Kept the database row and persisted task state on private object-key storage;
  only the client-facing broadcast was changed.

## Why

The generated-image task owner was persisting assistant image rows correctly,
but the live browser path was receiving `generatedImage.images` entries without
`previewUrl`. The chat UI only renders generated-image frames when a preview URL
is present, so completed image replies could stay invisible until a later
hydration pass.

## Verification

- Verified in code that the broadcast path now calls the existing hydration
  helper before sending `update_message_data` to chat clients.
- Verified in code that the persisted message row still stores private object
  keys and is not rewritten with public URLs.

## Document Provenance

- Source: operator runtime report that text-model-triggered image generation
  completed without showing the final image in chat
- Kind: runtime observation
- Retrieved: 2026-04-19
- Applied To: selecting the generated-image client broadcast as the missing
  visibility boundary
- Verification: verified in code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-generated-image-chat-execution-and-ui.md
- /Users/almurat/KiKo/system-journal/design-language/generated-image-loading.md
- /Users/almurat/KiKo/system-journal/design-language/generated-image-safety.md
