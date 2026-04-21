# 2026-04-21 GPT Image Mini Free Allowance

## What Changed

- Kept `gpt-image-1-mini` as the default Farcaster generated-image model.
- Changed generated-image billing so `gpt-image-1-mini` consumes the same
  backend-owned daily free image allowance as `grok-imagine-image` normal.
- Made GPT Image Mini and Grok normal share one request-time free pool and one
  billing-summary counter.
- Changed the default `GENERATED_IMAGE_DAILY_FREE_OUTPUTS` fallback from 2 to 3.
- Persisted live-chat picker clicks to remote settings so explicit image model
  choices can be read by Farcaster social turns.

## Why

The runtime log showed the generated-image route selected `gpt-image-1-mini`
and then failed before provider execution. The model default was correct; the
billing policy was wrong because GPT Image Mini had `freeOutputImageLimit: 0`,
so the first default image request required billing consent instead of using the
daily free image allowance. The billing summary also only queried
`grok-imagine-image`, so GPT Image Mini usage would not move the sidebar's free
image counter even after reservations started recording free usage.

## Invariants

- GPT Image Mini remains the default generated-image model.
- GPT Image Mini and Grok normal both count against the same backend-owned
  daily generated-image free output allowance.
- Paid spillover still requires billing consent after the free allowance is
  exhausted.
- Route/session hydration must not write old conversation models back into user
  defaults; only explicit picker clicks do.

## Verification

- `cd /Users/almurat/KiKo/kiko-api && npm exec tsx --test src/services/generatedImageBilling.test.ts`
- `cd /Users/almurat/KiKo/kiko-api && npm exec tsx --test src/services/farcaster-agent/farcasterIngressWorker.test.ts`
- `cd /Users/almurat/KiKo/kiko-api && npm exec tsc --noEmit --pretty false`
- `cd /Users/almurat/KiKo/kiko-web && npm exec tsc --noEmit --pretty false`

## Document Provenance

- Source: operator correction on 2026-04-21
  - Kind: product instruction
  - Retrieved: 2026-04-21
  - Applied To: GPT Image Mini default model and generated-image free allowance
  - Verification: verified in code and targeted tests
- Source: `/Users/almurat/Downloads/logs.1776742368695.json`
  - Kind: runtime observation
  - Retrieved: 2026-04-21
  - Applied To: confirming the provider never ran because billing blocked the
    generated-image task before execution
  - Verification: verified in runtime log

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-farcaster-generated-image-direct-routing.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-farcaster-generated-image-preference-persistence.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-generated-image-free-allowance-env-control.md
