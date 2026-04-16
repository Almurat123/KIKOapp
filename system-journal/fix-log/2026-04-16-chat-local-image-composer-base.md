# 2026-04-16 Chat Local Image Composer Base

## What Changed

- Added a local-only image draft base to the chat input surface.
- The welcome composer and the live chat composer now both show:
  - a `+` button to the left of the settings button
  - GPT-style image thumbnails above the textarea
  - per-image remove affordances before send
- Optimistic local user messages now preserve selected image thumbnails after
  send so the transcript stays visually consistent during local testing.

## Why

The product needed a local UI base for image-based chat before any storage,
upload, or model transport path was wired. The first requirement was to let the
user test the interaction locally without introducing a fake backend upload or
database persistence path.

## Boundaries

- This change does **not** upload images.
- This change does **not** write image data or image URLs into the database.
- This change does **not** send image data to the model backend yet.
- Image previews currently use local object URLs owned by the frontend chat
  runtime and are only valid for the current local session.

## Document Provenance

- Source: user-provided screenshot references and product direction on 2026-04-16
  - Kind: product doc
  - Retrieved: 2026-04-16
  - Applied To: `+` affordance placement, preview strip behavior, and GPT-style draft thumbnails
  - Verification: verified in code
- Source: repo inspection of `ChatInterface`, `ChatComposer`, and `WelcomeScreen`
  - Kind: repo code
  - Retrieved: 2026-04-16
  - Applied To: single-owner local draft state shared across welcome and live chat
  - Verification: verified in code

## Verification

- Passed: `cd /Users/almurat/KiKo/kiko-web && npx tsc --noEmit`
- Checked: `cd /Users/almurat/KiKo/kiko-web && npx eslint src/components/Chat/ChatComposer.tsx src/components/Chat/WelcomeScreen.tsx src/components/Chat/ChatAttachmentTray.tsx src/components/Chat/chatImageDrafts.ts`
  - Result: 1 existing warning in `WelcomeScreen.tsx` for
    `react-hooks/exhaustive-deps` on the `selectedModel.id` effect.
  - Impact: no new lint error introduced by the local image draft base.
- Not verified yet: browser visual pass in a running local session.

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/loading-resilience.md
- /Users/almurat/KiKo/system-journal/owner-map/frontend-data-loading.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-homepage-welcome-shell-split.md
