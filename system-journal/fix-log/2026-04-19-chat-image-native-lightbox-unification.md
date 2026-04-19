# 2026-04-19 Chat Image Native Lightbox Unification

## What Changed

- Replaced the custom chat attachment preview overlay with the shared
  `NativeLightbox` viewer.
- Wired generated-image cards to the same `NativeLightbox` viewer so generated
  images and chat-uploaded images behave the same on the web.
- Kept thumbnail/card visuals intact while making the preview interaction shared
  across chat and social surfaces.
- Preserved keyboard access for image opening and let the lightbox own scroll
  lock, backdrop close, pull-down close, and zoom behavior.

## Why

The web chat surface should not maintain a separate image-viewing stack when
the app already has a shared viewer that matches the social page. Reusing the
same lightbox keeps generated images and uploaded images consistent and avoids
another one-off modal path.

## Product Rule

- Chat-uploaded images and generated images must use the shared `NativeLightbox`.
- Clicking an image thumbnail or generated-image frame should open the same
  viewer at the clicked index.
- Do not add a second chat-only fullscreen viewer.
- Keep the transcript card itself inline; the overlay belongs to the shared
  viewer component.

## Verification

- Verified in code that `ChatAttachmentTray` now opens `NativeLightbox`.
- Verified in code that `GeneratedImageMessage` now opens `NativeLightbox`.
- Verified in code that generated-image frames remain keyboard accessible.
- Verified `npm exec tsc --noEmit --pretty false` in `kiko-web`.

## Document Provenance

- Source: `kiko-web/src/pages/SocialPage.tsx` NativeLightbox usage
  - Kind: repo doc
  - Retrieved: 2026-04-19
  - Applied To: reusing the same lightbox interaction for chat images
  - Verification: verified in code
- Source: operator request on 2026-04-19
  - Kind: product doc
  - Retrieved: 2026-04-19
  - Applied To: aligning chat-uploaded images and generated images with the
    social-page image viewer
  - Verification: verified in code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/chat-image-viewing.md
- /Users/almurat/KiKo/system-journal/design-language/generated-image-loading.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-generated-image-chat-execution-and-ui.md
