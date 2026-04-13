# 2026-04-12 Farcaster Manifest Validation Fix

## What Changed

- Kept the user-confirmed manifest structure in `frame` form.
- Fixed the two validation failures shown in the screenshot:
  - shortened `subtitle` to stay within the 30 character limit
  - moved `castShareUrl` onto the same domain as `homeUrl`
- Corrected the `social` search tag spelling after the manifest passed primary
  validation, without changing the user-confirmed `name`.
- Replaced the generic `token` search tag with `kiko` so brand-name search can
  match the app more reliably.
- Left the remaining fields aligned to the user's confirmed submission payload.

## Why

The Farcaster Developer Tools submit flow was failing because the repo payload
had one overlong subtitle and one cross-domain share URL. Resetting those two
fields removes the validation errors shown in the screenshot.

## Guardrail

Do not exceed documented string limits, and keep share URLs on the same domain
as `homeUrl`.

## Document Provenance

- Source: Farcaster Mini Apps publishing guide
  - Kind: official API doc
  - Retrieved: 2026-04-12
  - Applied To: `subtitle` length limit and share-URL same-origin rule
  - Verification: verified in docs

- Source: user-provided failing manifest payload
  - Kind: runtime observation
  - Retrieved: 2026-04-12
  - Applied To: updated `subtitle` and `castShareUrl` values in repo files
  - Verification: verified in runtime

See also:
- `system-journal/INDEX.md`
- `system-journal/design-language/farcaster-miniapp-shell.md`
- `system-journal/owner-map/farcaster-miniapp-support.md`
- `system-journal/fix-log/2026-04-12-farcaster-manifest-splash-fix.md`
