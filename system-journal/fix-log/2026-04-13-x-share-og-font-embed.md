# Fix Log: 2026-04-13 X Share OG Font Embed

## What Changed

- Added a shipped English-first font asset for X share OG rendering:
  - `kiko-api/src/assets/fonts/Inter-Variable.ttf`
- Replaced the X share PNG render path with `@resvg/resvg-js` and a bundled
  TTF font buffer.
- Removed the dependency on host Fontconfig/Pango for OG text rendering.
- Kept SVG text sanitization so emoji presentation glyphs do not break the
  preview image on Linux.

## Why

Production reply links were working, and the latest `x_reply_shares` rows
contained real prompt and summary text, but the rendered X preview image showed
tofu boxes instead of readable text.

That means the share payload was correct and the failure was in the image
rendering layer. Runtime logs also showed:

- `Fontconfig error: Cannot load default config file: No such file: (null)`

So the real failure was not missing data but the production render path relying
on host font configuration. A shipped `woff2` plus `sharp`/Pango was still not
deterministic enough on Linux. The final fix moved rendering to resvg with a
shipped TTF font buffer.

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

- Source: production runtime log `Fontconfig error: Cannot load default config file`
- Kind: runtime observation
- Retrieved: 2026-04-13
- Applied To: ruling out host Fontconfig/Pango as a stable production render
  dependency for X share OG images
- Verification: verified in runtime

- Source: [Google Fonts Inter](https://github.com/google/fonts/tree/main/ofl/inter)
- Kind: external font asset
- Retrieved: 2026-04-13
- Applied To: shipping a deterministic English-first TTF font buffer for resvg
- Verification: verified in code
