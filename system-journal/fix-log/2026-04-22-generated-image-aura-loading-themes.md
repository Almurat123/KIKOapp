# 2026-04-22 Generated Image Aura Loading Themes

## What Changed

- Added seven generated-image loading color themes aligned with the homepage
  aura palette family.
- Updated the generated-image loading frame so its pre-preview motion uses
  slow oval gradient fields that drift, scale, and rotate like the homepage
  aura background.
- Kept the existing generated-image contract: no percentage text, no backend
  stage labels, no extra copy once blurred preview pixels exist, and final
  images still open the shared NativeLightbox viewer.

## Why

The previous loading state was intentionally quiet, but it felt too fixed and
less connected to the new homepage aura design. The operator asked for a more
surprising loading motion with multiple color themes while preserving the
generated-image frame behavior.

## Verification

- Verified in code that the loading theme index is selected once per component
  mount and is not recomputed on every render.
- Verified in code that the new theme colors only affect CSS variables and do
  not change provider state, progress semantics, or task cleanup.

## Document Provenance

- Source: operator request on 2026-04-22 to make generated-image loading motion
  resemble the homepage flowing background and add seven color themes
- Kind: product doc
- Retrieved: 2026-04-22
- Applied To: generated-image loading theme variables and aura-like CSS motion
- Verification: verified in code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/generated-image-loading.md
- /Users/almurat/KiKo/kiko-web/src/components/Chat/GeneratedImageMessage.tsx
- /Users/almurat/KiKo/kiko-web/src/components/Chat/Chat.module.css
