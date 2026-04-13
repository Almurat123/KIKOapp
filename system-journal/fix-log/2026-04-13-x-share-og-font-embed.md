# Fix Log: 2026-04-13 X Share OG Font Embed

## What Changed

- Added a shipped English-first font asset for X share OG rendering:
  - `kiko-api/src/assets/fonts/Inter-Regular.woff2`
- Updated the X share SVG renderer to embed that font with `@font-face` as a
  base64 data URL inside the generated SVG.
- Updated all OG text layers (prompt bubble, assistant preview, bottom title)
  to use the embedded font family first, then system fallbacks.
- Added SVG-layer text sanitization that strips emoji presentation glyphs from
  the OG image preview so missing color-emoji support does not break text
  rendering on production Linux.

## Why

Production reply links were working, and the latest `x_reply_shares` rows
contained real prompt and summary text, but the rendered X preview image showed
tofu boxes instead of readable text.

That means the share payload was correct and the failure was in the image
rendering layer. The production Linux renderer could not rely on local Apple
fonts or other system fonts being present. The SVG needed a font that ships
with the service itself.

## Product Rule

- X share OG images must not depend on production system fonts for English text.
- Emoji presentation glyphs are optional in the OG preview and may be dropped if
  production rendering support is inconsistent.

## Document Provenance

- Source: production screenshot showing tofu-box OG output while the same share
  row contained real prompt/summary text
- Kind: runtime observation
- Retrieved: 2026-04-13
- Applied To: identifying the OG rendering failure as a font/glyph issue instead
  of missing share data
- Verification: verified in runtime

- Source: latest `x_reply_shares` row for the successful reply on 2026-04-13
- Kind: runtime observation
- Retrieved: 2026-04-13
- Applied To: confirming prompt and summary text had already been persisted
- Verification: verified in runtime

- Source: [Inter](https://github.com/rsms/inter)
- Kind: external font asset
- Retrieved: 2026-04-13
- Applied To: shipping a deterministic English-first font for SVG OG rendering
- Verification: verified in code
