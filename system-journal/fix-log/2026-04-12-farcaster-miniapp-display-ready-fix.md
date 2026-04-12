# 2026-04-12 Farcaster Mini App Display Ready Fix

## What Changed

- Moved the Mini App `sdk.actions.ready()` handshake earlier in
  `MiniAppContext` so the Farcaster client can hide the splash screen as soon
  as host detection succeeds.
- Kept read-only Mini App context hydration and safe-area application after
  the early ready handshake so identity data can still populate without
  blocking display.

## Why

The Mini App getting-started guide says the app must call `ready()` after it
loads or users will see an infinite loading screen. In practice, waiting for
`sdk.context` before signaling readiness can delay display unnecessarily and
look like the app does not open.

## Guardrail

Do not move backend auth or Privy session logic into this bootstrap layer.
The only ownership here is Mini App host detection, safe-area application, and
the early ready handshake.

## Document Provenance

- Source: Farcaster Mini Apps getting-started guide
  - Kind: official API doc
  - Retrieved: 2026-04-12
  - Applied To: immediate `sdk.actions.ready()` call after host detection
  - Verification: verified in docs

- Source: local `MiniAppContext` implementation
  - Kind: repo doc
  - Retrieved: 2026-04-12
  - Applied To: moving the ready handshake before `sdk.context` hydration
  - Verification: verified in code

See also:
- `system-journal/INDEX.md`
- `system-journal/design-language/farcaster-miniapp-shell.md`
- `system-journal/owner-map/farcaster-miniapp-support.md`
- `system-journal/fix-log/2026-04-12-farcaster-manifest-splash-fix.md`
