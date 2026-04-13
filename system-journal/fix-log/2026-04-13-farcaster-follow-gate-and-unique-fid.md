# Fix Log: 2026-04-13 Farcaster Follow Gate And Unique FID

## What Changed

- Added a database-level unique constraint for `User.farcasterFid` so one Farcaster account cannot be bound to multiple KiKo users.
- Reworked Farcaster follow detection to scan `linksByFid` follow messages instead of relying on `linkById`, which returned broken results on the public Hub currently used by the app.
- Added a resolved identity flag to the Farcaster frontend context and changed onboarding to wait for that resolution before deciding whether to show the follow modal.

## Why

Two separate issues were interacting:

1. The app only enforced Farcaster ownership at the service layer, not the database layer.
2. The onboarding flow could open the follow modal before Farcaster identity had finished hydrating, so users with a valid linked Farcaster account could still see the modal during startup.

The public Hub path used for follow checks also returned incorrect `linkById` failures, which made follow-state reads less trustworthy than intended.

## Product Rule

- `User.farcasterFid` must be unique at the database layer.
- Follow-state readers should prefer stable Hub endpoints even if they require paginated scans.
- Onboarding must not treat "identity not loaded yet" as "user has no Farcaster account".

## Document Provenance

- Source: /Users/almurat/KiKo/llmdoc/farllm.md
- Kind: repo doc
- Retrieved: 2026-04-13
- Applied To: `linksByFid`, `linksByTargetFid`, and `linkById` HTTP API semantics
- Verification: verified in docs

- Source: runtime observation against https://hub.merv.fun
- Kind: runtime observation
- Retrieved: 2026-04-13
- Applied To: replacing unstable `linkById` follow reads with `linksByFid` scans for onboarding/status checks
- Verification: verified in runtime
