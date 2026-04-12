# 2026-04-12 Farcaster Mini App Asset Export

## What Changed

- Exported the current final Farcaster poster assets into `kiko-web/public` so
  the web app can serve them directly.
- Published the following canonical public filenames:
  - `/farcaster-preview.png`
  - `/farcaster-promo.png`
  - `/farcaster-social.png`
- Unified the public logo filename to `/icon.png` for favicon / touch icon use
  and added a separate `/farcaster-splash.png` loading logo for Farcaster
  surfaces.
- Updated the PWA `manifest.json` icons to also use `/icon.png` so the public
  web entry points share one canonical logo asset.
- Updated the public app naming to `KiKo your best way to trade !` and
  tightened the subtitle to a short trade-analysis / copy-trade summary.
- Added cache headers for the new published assets so they can be served as
  long-lived static files.
- Removed the generated working render snapshots from the repository so the
  branch now keeps only the published public assets.

## Why

The asset pipeline is now simplified to one published layer in
`kiko-web/public/`. The ephemeral working renders were useful during design
iteration, but they are no longer kept in the repository. The loading surface
is logo-first and points at `/farcaster-splash.png`, not a poster-style splash
image.

## Guardrail

Do not introduce a second public logo filename or scatter Farcaster poster
assets across ad hoc folders. Keep `icon.png` as the single public logo source
and the `farcaster-*.png` files as the published poster set.

## Document Provenance

- Source: local poster renders before pruning
  - Kind: runtime observation
  - Retrieved: 2026-04-12
  - Applied To: final public asset filenames and icon export
  - Verification: verified by local file copy and web shell references

- Source: repository asset cleanup after export
  - Kind: runtime observation
  - Retrieved: 2026-04-12
  - Applied To: removal of generated working render folders from version control
  - Verification: verified in file tree

- Source: logo-only loading correction from user feedback
  - Kind: runtime observation
  - Retrieved: 2026-04-12
  - Applied To: use of `/farcaster-splash.png` as the Farcaster loading splash and removal of the poster-style loading asset from the published set
  - Verification: verified in shell metadata and manifest JSON

- Source: `/Users/almurat/KiKo/kiko-web/index.html`
  - Kind: repo doc
  - Retrieved: 2026-04-12
  - Applied To: canonical `icon.png` reference in the web shell
  - Verification: verified in code

- Source: `/Users/almurat/KiKo/kiko-web/public/manifest.json`
  - Kind: repo doc
  - Retrieved: 2026-04-12
  - Applied To: canonical `icon.png` reference in the PWA manifest
  - Verification: verified in code

- Source: user-provided app name and subtitle correction
  - Kind: runtime observation
  - Retrieved: 2026-04-12
  - Applied To: Farcaster manifest and shell metadata naming
  - Verification: verified in code

See also:
- `system-journal/INDEX.md`
- `system-journal/design-language/farcaster-miniapp-promo-assets.md`
- `system-journal/fix-log/2026-04-11-farcaster-miniapp-poster-redesign.md`
