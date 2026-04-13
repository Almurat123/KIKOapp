# 2026-04-13 Webhook Weak-Evidence Dispatch Hardening

## Summary

EVM webhook ingress still had a pre-receipt fast path that could dispatch from
weak evidence:

- activity-only heuristic decode
- untrusted pending predecode

That violated the copytrade rule that ingress may accelerate strong evidence,
but uncertain cases must wait for receipt/full-tx decode or recovery.

## What Changed

- `kiko-api/src/services/copytrade-v2/ingress/evmIngressDecisionPolicy.ts`
  - Provisional dispatch now only allows trusted predecoded swaps.
  - Activity-only decode and untrusted predecode now explicitly require receipt.
- `kiko-api/src/routes/webhook.ts`
  - Removed activity-only provisional dispatch before receipt confirmation.
  - Kept trusted cached predecode, receipt/full-tx decode, and receipt recovery
    as the only fast runtime entry paths.
- `kiko-api/src/services/copytrade-v2/__tests__/evmIngressDecisionPolicy.test.ts`
  - Added regression coverage for weak-evidence rejection.

## Why

The repository design language already says webhook ingress is an evidence-entry
layer, not a durable truth system. Letting activity heuristics or untrusted
predecode snapshots enqueue copytrade work before receipt confirmation widened
the live-attribution surface too far for a money-moving system.

## Design Boundary

- Strong evidence may fast-dispatch:
  - trusted pending predecode
  - receipt/full-tx decode
  - receipt recovery
- Weak evidence must wait:
  - activity-only heuristic decode
  - untrusted pending predecode

## Document Provenance

- Source: `system-journal/design-language/copytrade-race-recovery.md`
- Kind: repo doc
- Retrieved: 2026-04-13
- Applied To: requiring recovery/receipt for weak ingress evidence
- Verification: verified in code

- Source: `system-journal/owner-map/copytrade-webhook-ingress.md`
- Kind: repo doc
- Retrieved: 2026-04-13
- Applied To: narrowing webhook runtime ownership to strong-evidence dispatch
- Verification: verified in code

## Verification

- `npx tsx --test --test-force-exit src/services/copytrade-v2/__tests__/evmIngressDecisionPolicy.test.ts src/services/copytrade-v2/__tests__/webhookRecovery.test.ts`
- `npx tsc --noEmit`
