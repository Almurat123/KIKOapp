# Chat Image Viewing

Updated: 2026-04-19

## Purpose

Chat image thumbnails and generated-image cards should open the same
`NativeLightbox` viewer used by the social page. The chat surface should not
carry a second custom preview modal or a browser fullscreen path.

## Canonical Rules

1. Chat-uploaded image thumbnails open the shared `NativeLightbox` viewer.
2. Generated-image cards open the same shared `NativeLightbox` viewer.
3. The viewer should open at the clicked image index when multiple images are present.
4. Viewer gestures and close behavior should match the social page implementation.
5. Do not introduce a second image viewer for chat surfaces.

## Forbidden Local Patch Patterns

- Do not rebuild a separate chat-only fullscreen modal.
- Do not rely on browser fullscreen for image review.
- Do not diverge generated-image preview behavior from uploaded chat images.

## Document Provenance

- Source: `kiko-web/src/pages/SocialPage.tsx` NativeLightbox usage
  - Kind: repo doc
  - Retrieved: 2026-04-19
  - Applied To: choosing the shared image viewer implementation for chat
  - Verification: verified in code
- Source: operator request on 2026-04-19
  - Kind: product doc
  - Retrieved: 2026-04-19
  - Applied To: aligning chat-uploaded image previews and generated-image
    previews with the social-page viewer
  - Verification: verified in code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/generated-image-loading.md
- /Users/almurat/KiKo/system-journal/design-language/generated-image-safety.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-chat-image-native-lightbox-unification.md
