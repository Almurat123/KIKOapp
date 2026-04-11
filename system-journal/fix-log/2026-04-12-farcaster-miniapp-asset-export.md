# 2026-04-12 Farcaster Mini App Asset Export

## What Changed

- Exported the current final Farcaster poster assets into `kiko-web/public` so
  the web app can serve them directly.
- Published the following canonical public filenames:
  - `/farcaster-preview.png`
  - `/farcaster-promo.png`
  - `/farcaster-loading.png`
  - `/farcaster-social.png`
- Unified the public logo filename to `/icon.png` and updated the web shell to
  point at that canonical icon path.
- Added cache headers for the new published assets so they can be served as
  long-lived static files.
- Removed the generated working render snapshots from the repository so the
  branch now keeps only the published public assets.

## Why

The asset pipeline is now simplified to one published layer in
`kiko-web/public/`. The ephemeral working renders were useful during design
iteration, but they are no longer kept in the repository.

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

- Source: `/Users/almurat/KiKo/kiko-web/index.html`
- Kind: repo doc
- Retrieved: 2026-04-12
- Applied To: canonical `icon.png` reference in the web shell
- Verification: verified in code

See also:
- `system-journal/INDEX.md`
- `system-journal/design-language/farcaster-miniapp-promo-assets.md`
- `system-journal/fix-log/2026-04-11-farcaster-miniapp-poster-redesign.md`
