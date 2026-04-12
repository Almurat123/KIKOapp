# Farcaster Mini App Shell

Updated: 2026-04-10

## Purpose

Define how the web shell should behave when KiKo is launched inside a Farcaster
Mini App client.

## Canonical Rules

1. Mini App bootstrap must live in one dedicated owner layer that detects the
   host, applies safe-area offsets, and signals readiness.
2. Shared metadata for Farcaster discovery and embeds should stay in the HTML
   shell and manifest files, not in ad hoc page components.
3. Mini App-safe identity fallback may use Farcaster client context for read
   only personalization, but backend sync still requires an actual access token.
4. Use one 3:2 image for the `fc:miniapp` embed card and one 1200x630 image
   for Open Graph / promotional surfaces.
5. The manifest icon must be a non-alpha PNG, and the splash image should be a
   separate 200x200 logo-only asset rather than poster-style artwork.

## Forbidden Local Patch Patterns

- Calling `sdk.actions.ready()` from random pages or feature components.
- Hiding Farcaster metadata inside page-specific runtime fetches when the shell
  can publish it statically.
- Reusing a square app icon as the Mini App embed card.
- Moving Privy or backend auth responsibilities into the Mini App bootstrap.

## Related Outcomes

- Farcaster clients should get a ready Mini App shell without layout overlap.
- Mini App users should see correct safe-area padding and a valid follow-up
  identity fallback when no Privy session exists.

## See Also

- `system-journal/INDEX.md`
- `system-journal/owner-map/farcaster-miniapp-support.md`
- `system-journal/fix-log/2026-04-10-farcaster-miniapp-support.md`
- `system-journal/fix-log/2026-04-12-farcaster-manifest-splash-fix.md`
- `system-journal/fix-log/2026-04-12-farcaster-miniapp-display-ready-fix.md`
