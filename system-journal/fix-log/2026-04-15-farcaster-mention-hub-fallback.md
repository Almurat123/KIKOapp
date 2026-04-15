# Fix Log: 2026-04-15 Farcaster Mention Hub Fallback

## What Changed

- Expanded the Farcaster agent mention ingress path to fall back across known public Hub RPC peers when the primary configured Hub cannot be reached.
- Kept the existing worker policy intact; only the Hub connectivity layer changed.
- Preserved the current mention parser and reply publication flow.

## Why

The local Snapchain Hub path stopped returning Farcaster mention data reliably in development. Rather than changing the worker or reintroducing a second semantic owner, the safer correction is to keep the mention worker on the same contract and widen the Hub reachability layer.

## Product Rule

- Configured Hub RPC endpoints still take priority.
- If the primary endpoint fails, the client may try the known public peers already used elsewhere in the repo.
- The worker still receives normalized mention events and does not own provider selection.

## Verification

- Runtime test forced the first Hub endpoint to an unreachable local address and confirmed the client fell through to `hub.merv.fun:3381`.
- `npm run build` passed after the change.

## Document Provenance

- Source: `@farcaster/hub-nodejs` README and generated typings
- Kind: local SDK source
- Retrieved: 2026-04-15
- Applied To: Hub RPC client initialization and `getCastsByMention` usage
- Verification: verified in code

- Source: `/Users/almurat/KiKo/kiko-api/src/services/snapchainService.ts`
- Kind: repo doc
- Retrieved: 2026-04-15
- Applied To: public Hub fallback peer ordering
- Verification: verified in code

- Source: runtime test against a forced dead local Hub endpoint
- Kind: runtime observation
- Retrieved: 2026-04-15
- Applied To: proving the fallback path reaches a public Hub peer
- Verification: verified in runtime
