# Fix Log: 2026-04-15 Farcaster Neynar Reply Publish Fallback

## What Changed

- Added an optional `NEYNAR_SIGNER_UUID` env boundary for Farcaster reply
  publication.
- Updated reply publication so it first attempts Neynar `publishCast` with the
  configured signer UUID and only falls back to Hub RPC if Neynar publishing is
  unavailable.
- Documented that the `NeynarAPIClient` wrapper expects camelCase params and
  converts them to OpenAPI wire keys internally; reply failures must be
  diagnosed through signer approval/configuration before changing request
  shape.
- Kept mention ingress on the existing webhook / notifications path; only the
  write path changed.

## Why

The webhook-backed mention ingress was working, but reply publication was still
using Hub RPC directly. The active Hub path was failing with transient gRPC
errors (`Call cancelled`, `RST_STREAM` protocol errors), so reply writes needed
a more stable primary route. A signed webhook replay on 2026-04-15 proved the
ingress event reached `processed`, but the outbound delivery failed after
Neynar publishing did not complete and Hub returned `RST_STREAM code 2`.
Signer lookup for the operator-provided UUID returned `generated`, not
`approved`, so that signer cannot publish replies yet.

## Product Rule

- If `NEYNAR_SIGNER_UUID` is configured, Farcaster reply publication should try
  Neynar first.
- `NeynarAPIClient.publishCast` wrapper calls must use camelCase params because
  the wrapper converts them to OpenAPI wire keys before calling the generated
  API client.
- The signer UUID must be approved by the bot Farcaster account before Neynar
  can publish replies.
- Hub RPC remains a fallback for writes when Neynar publishing is unavailable.
- The webhook secret must never be reused as a publish credential.

## Verification

- `npx tsx --test src/services/neynarService.test.ts` passed for the
  NeynarAPIClient wrapper request params.
- `npm run build` passed after the wrapper-param test correction.
- A direct Neynar `publishCast` diagnostic with the operator-provided signer
  UUID returned `403 SignerNotApproved` and `Signer status is generated.`
- Runtime retry pending until the signer UUID is approved and production has
  `NEYNAR_SIGNER_UUID` set to that approved UUID.

## Document Provenance

- Source: Neynar SDK `publishCast` typing and `NeynarAPIClient.publishCast`
  wrapper implementation
  - Kind: local SDK source
  - Retrieved: 2026-04-15
  - Applied To: signer UUID-based cast publishing and wrapper camelCase params
  - Verification: verified in code and tests
- Source: Farcaster runtime logs showing `Call cancelled` and `RST_STREAM`
  during reply publication
  - Kind: runtime observation
  - Retrieved: 2026-04-15
  - Applied To: Hub fallback being demoted to secondary write path
  - Verification: verified in runtime
- Source: Production database records for replayed cast
  `0x329a207af24579e6854fd038af4276757651ea48`
  - Kind: runtime observation
  - Retrieved: 2026-04-15
  - Applied To: identifying reply publication, not webhook ingress, as the
    remaining failed owner
  - Verification: verified in runtime
- Source: Neynar signer lookup for the operator-provided signer UUID
  - Kind: runtime observation
  - Retrieved: 2026-04-15
  - Applied To: identifying signer approval as a remaining blocker for
    Neynar-based reply publishing
  - Verification: verified in runtime

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-farcaster-neynar-webhook-ingress.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-farcaster-neynar-notifications-ingress.md
- /Users/almurat/KiKo/system-journal/conflicts.md
