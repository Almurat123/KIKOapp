# Fix Log: 2026-04-15 Farcaster Neynar Legacy Reads Disabled

## What Changed

- Disabled legacy Neynar read helpers used for social search, profile
  supplementation, and the gRPC helper path.
- Kept Farcaster mention/reply ingress on Neynar notifications intact.
- Removed the remaining automatic Neynar fallback from Snapchain profile
  recovery.

## Why

The paid Neynar key should only back the mention ingress path. Search and
profile fallback traffic could silently spend quota during normal user
activity, so those paths were shut off at the repository layer.

## Product Rule

- Ingress mention polling may continue to use Neynar notifications.
- Search, profile lookup, follow checks, and the legacy gRPC helper must not
  call Neynar automatically.
- If a future product decision wants those reads back, they must be re-enabled
  explicitly.

## Verification

- `npm run build` passes after the legacy-read guards were added.
- Repository search shows no remaining runtime call sites for Neynar search or
  profile fallback outside the disabled helper functions.

## Document Provenance

- Source: repository audit of `neynarService.ts`, `socialRepository.ts`,
  `snapchainService.ts`, and `snapchainGrpcService.ts`
- Kind: repo doc
- Retrieved: 2026-04-15
- Applied To: disabling non-ingress Neynar call sites
- Verification: verified in code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-farcaster-neynar-notifications-ingress.md
- /Users/almurat/KiKo/system-journal/conflicts.md
