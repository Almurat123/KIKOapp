# 2026-04-12 Farcaster Manifest Validation Fix

## What Changed

- Restored the Farcaster manifest fields to the user-provided canonical
  `frame` payload.
- Kept `imageUrl`, `buttonTitle`, `subtitle`, `tags`, and `ogTitle` aligned to
  the exact values the user confirmed for submission.
- Updated the page shell metadata so the embed name stays consistent with the
  user-provided `frame.name` value.

## Why

The Farcaster Developer Tools submit flow was failing because the payload in
the repo had drifted away from the exact manifest the user wanted to submit.
Resetting the fields to the canonical user-provided payload removes that drift.

## Guardrail

Do not change the user-confirmed `frame` payload unless the user explicitly
provides a new submission version.

## Document Provenance

- Source: Farcaster Mini Apps publishing guide
  - Kind: official API doc
  - Retrieved: 2026-04-12
  - Applied To: general manifest publication and embed field ownership
  - Verification: verified in docs

- Source: user-provided failing manifest payload
  - Kind: runtime observation
  - Retrieved: 2026-04-12
  - Applied To: canonical `frame` payload restored in repo files
  - Verification: verified in runtime

See also:
- `system-journal/INDEX.md`
- `system-journal/design-language/farcaster-miniapp-shell.md`
- `system-journal/owner-map/farcaster-miniapp-support.md`
- `system-journal/fix-log/2026-04-12-farcaster-manifest-splash-fix.md`
