# 2026-04-12 Farcaster Manifest Splash Fix

## What Changed

- Created a dedicated `200x200` logo splash asset at
  `/Users/almurat/KiKo/kiko-web/public/farcaster-splash.png`.
- Updated the Farcaster shell metadata in `index.html` so both
  `fc:miniapp` and `fc:frame` reference `/farcaster-splash.png` instead of
  reusing the 1024x1024 app icon.
- Updated `/.well-known/farcaster.json` so `splashImageUrl` points at the
  same loading asset the user confirmed for submission.
- Added cache headers for the new splash file.

## Why

The Farcaster submission flow was failing because the repo drifted away from
the user-confirmed manifest payload. The loading/splash choice had to stay
aligned with that payload, not with later experimental edits.

## Guardrail

Do not change the user-confirmed loading asset without an explicit request.

## Document Provenance

- Source: Farcaster Mini Apps publishing guide
  - Kind: official API doc
  - Retrieved: 2026-04-12
  - Applied To: published manifest ownership and loading asset alignment
  - Verification: verified in docs

- Source: local asset inspection
  - Kind: runtime observation
  - Retrieved: 2026-04-12
  - Applied To: confirm `farcaster-splash.png` is present and published
  - Verification: verified in runtime

- Source: user-reported submit failure and `temp-account-association` 404
  - Kind: runtime observation
  - Retrieved: 2026-04-12
  - Applied To: isolate manifest drift from browser-session association issue
  - Verification: verified in runtime

See also:
- `system-journal/INDEX.md`
- `system-journal/design-language/farcaster-miniapp-shell.md`
- `system-journal/fix-log/2026-04-12-farcaster-miniapp-asset-export.md`
- `system-journal/design-language/farcaster-miniapp-promo-assets.md`
