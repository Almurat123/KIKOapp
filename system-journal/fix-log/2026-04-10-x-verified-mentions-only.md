# 2026-04-10 X Verified Mentions Only

## What changed

X mention handling now requires the mention author to be `verified=true` before
KIKO spends quota, starts an agent run, sends a DM, or posts a public reply.

Owner files:

- `/Users/almurat/KiKo/kiko-api/src/services/x/xApiClient.ts`
- `/Users/almurat/KiKo/kiko-api/src/routes/xWebhook.ts`
- `/Users/almurat/KiKo/kiko-api/src/services/x/xIngressWorker.ts`
- `/Users/almurat/KiKo/kiko-api/src/services/x/types.ts`

## Why it changed

Product policy changed: X should remain a high-signal public interaction surface.
Automated mention replies from non-verified accounts create spam/cost pressure
without enough expected value.

The verified filter is therefore enforced at the ingress owner layer, before:

- user lookup
- quota burn
- chat session creation
- AI execution
- outbound DM
- public mention reply

## Document provenance

### Source 1

- Source: X users/mentions timeline and user lookup docs
- Kind: official API doc
- Retrieved: 2026-04-10
- Applied To: requesting/propagating `verified` user metadata on mention intake
- Verification: partially verified

### Source 2

- Source: repo code review of mention ingress path
- Kind: repo code
- Retrieved: 2026-04-10
- Applied To: placing the reject rule in the worker before any expensive side effect
- Verification: verified in code

## Decision

Non-verified mention authors are now ignored by policy. This is a hard filter,
not a heuristic ranking signal.
