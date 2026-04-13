# Fix Log: 2026-04-13 Farcaster Verified Identity Sync

## What Changed

- Reworked Farcaster identity sync so the backend no longer trusts client-supplied `fid` or username values.
- Added a Privy-backed Farcaster identity service that extracts the verified Farcaster account from `linkedAccounts`, checks ownership conflicts, and persists the canonical `farcasterFid` / `farcasterUsername` onto the shared `User` row.
- Added best-effort Farcaster auto-sync in authenticated requests, matching the existing X repair path.
- Kept `POST /api/users/farcaster` as the public route, but changed its behavior so the request body is informational only and the server derives identity from Privy.

## Why

The prior Farcaster sync route accepted arbitrary `fid` values from the frontend. That was enough to populate the user row, but it was not equivalent to the verified X sync path and left the account-link boundary weaker than intended.

Farcaster agent routing and session ownership are keyed by `farcasterFid`, so allowing the client to choose that key directly was the wrong authority boundary. The verified source of truth needs to be Privy.

## Product Rule

- Farcaster linkage must be derived from the authenticated user's verified Privy linked account.
- The request body for `POST /api/users/farcaster` must not be trusted as identity input.
- Farcaster ownership conflicts must hard-fail when the same `farcasterFid` is already linked to another KiKo user.
- Best-effort auth-time repair may update missing Farcaster linkage, but it must never block successful authentication.

## Document Provenance

- Source: /Users/almurat/KiKo/kiko-web/src/contexts/FarcasterContext.tsx
- Kind: repo doc
- Retrieved: 2026-04-13
- Applied To: Privy `linkedAccounts` parsing for Farcaster accounts, including `type === "farcaster"` and wallet-shaped Farcaster linked accounts
- Verification: verified in code

- Source: /Users/almurat/KiKo/kiko-api/src/services/x/xIdentityService.ts
- Kind: repo doc
- Retrieved: 2026-04-13
- Applied To: mirroring the verified-account sync pattern, ownership conflict checks, and auth-time auto-sync behavior already used for X
- Verification: verified in code
