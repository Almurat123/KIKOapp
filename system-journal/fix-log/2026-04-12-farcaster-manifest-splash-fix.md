# 2026-04-12 Farcaster Manifest Splash Fix

## What Changed

- Created a dedicated `200x200` logo splash asset at
  `/Users/almurat/KiKo/kiko-web/public/farcaster-splash.png`.
- Updated the Farcaster shell metadata in `index.html` so both
  `fc:miniapp` and `fc:frame` reference `/farcaster-splash.png` instead of
  reusing the 1024x1024 app icon.
- Updated `/.well-known/farcaster.json` so `splashImageUrl` points at the
  same 200x200 splash asset.
- Added cache headers for the new splash file.

## Why

The Farcaster submission flow was failing because the loading/splash image was
being reused from the square app icon instead of using a separate 200x200
asset. That violates the Mini App publishing constraints and can cause the
manifest tool to reject the final submit.

## Guardrail

Do not reuse the square favicon icon for splash surfaces. Keep
`/icon.png` reserved for favicon / touch icon roles and use
`/farcaster-splash.png` for Farcaster loading surfaces.

## Document Provenance

- Source: Farcaster Mini Apps publishing guide
  - Kind: official API doc
  - Retrieved: 2026-04-12
  - Applied To: split between `iconUrl` and `splashImageUrl`
  - Verification: verified in docs

- Source: local asset inspection
  - Kind: runtime observation
  - Retrieved: 2026-04-12
  - Applied To: confirm `farcaster-splash.png` is a `200x200` RGB PNG with no alpha
  - Verification: verified in runtime

- Source: user-reported submit failure and `temp-account-association` 404
  - Kind: runtime observation
  - Retrieved: 2026-04-12
  - Applied To: isolate the manifest validation issue from the browser-session association issue
  - Verification: verified in runtime

See also:
- `system-journal/INDEX.md`
- `system-journal/design-language/farcaster-miniapp-shell.md`
- `system-journal/fix-log/2026-04-12-farcaster-miniapp-asset-export.md`
- `system-journal/design-language/farcaster-miniapp-promo-assets.md`
