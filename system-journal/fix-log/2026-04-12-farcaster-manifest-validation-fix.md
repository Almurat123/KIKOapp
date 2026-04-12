# 2026-04-12 Farcaster Manifest Validation Fix

## What Changed

- Tightened the Farcaster manifest field values to match the publishing
  guide's validation rules.
- Removed the deprecated `imageUrl` field from the published manifest surface
  because it was being fed a non-3:2 preview asset.
- Replaced the long subtitle with a short, plain-text version that stays within
  the 30 character limit.
- Normalized the tag list to valid lowercase single-word tags and fixed the
  screenshot list to use separate array entries instead of one concatenated
  string.
- Updated the page shell description metadata to match the publishable
  manifest text.

## Why

The Farcaster Developer Tools submit flow returns `400` when the manifest
payload does not satisfy the published field constraints. The most likely
violations here were:

1. `imageUrl` pointing at a non-3:2 screenshot-style image.
2. `subtitle` exceeding the allowed length.
3. `screenshotUrls` containing one malformed string rather than a real array
   of URLs.
4. A tag typo (`socail`) and other text fields that were too long or too noisy.

## Guardrail

Do not reintroduce `imageUrl` unless it is a true 3:2 image. Keep the
published manifest text short, plain, and within the documented limits.

## Document Provenance

- Source: Farcaster Mini Apps publishing guide
  - Kind: official API doc
  - Retrieved: 2026-04-12
  - Applied To: field limits for `subtitle`, `description`, `screenshotUrls`,
    `heroImageUrl`, `ogTitle`, `ogDescription`, `tags`, and `canonicalDomain`
  - Verification: verified in docs

- Source: user-provided failing manifest payload
  - Kind: runtime observation
  - Retrieved: 2026-04-12
  - Applied To: corrected manifest field values and removed malformed `imageUrl`
  - Verification: verified in runtime

See also:
- `system-journal/INDEX.md`
- `system-journal/design-language/farcaster-miniapp-shell.md`
- `system-journal/owner-map/farcaster-miniapp-support.md`
- `system-journal/fix-log/2026-04-12-farcaster-manifest-splash-fix.md`
