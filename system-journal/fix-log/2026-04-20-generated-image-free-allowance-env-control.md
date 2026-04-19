# 2026-04-20 Generated Image Free Allowance Env Control

## What Changed

- Added `GENERATED_IMAGE_DAILY_FREE_OUTPUTS` to the backend env config.
- Wired `kiko-api/src/services/generatedImageBilling.ts` to read the Grok normal
  free-output allowance from that env value instead of a hardcoded `2`.
- Updated the generated-image billing example env file and regression test so
  the free allowance is now visibly configurable.

## Why

The generated-image free allowance was previously hardcoded in the billing
owner, which meant ops could not change the number without editing code. That
made routine quota tuning brittle and hid the actual policy from deployment
configuration.

## Behavior

- Default free allowance remains `2`.
- The new env var controls the daily free-output cap for the enabled Grok
  normal image path.
- The backend remains the source of truth; frontend counters are not part of
  this policy.

## Verification

- Verified in code that `generatedImageBilling.ts` now reads the limit from the
  env config object.
- Verified in code that `env.ts` and `env.example` expose the new knob.
- Verified `generatedImageBilling.test.ts` covers a tunable allowance path.

## Document Provenance

- Source: /Users/almurat/KiKo/system-journal/design-language/generated-image-billing.md
  - Kind: repo doc
  - Retrieved: 2026-04-20
  - Applied To: env-driven generated-image free-output policy
  - Verification: verified in code
- Source: /Users/almurat/KiKo/kiko-api/src/services/generatedImageBilling.ts
  - Kind: repo doc
  - Retrieved: 2026-04-20
  - Applied To: the backend owner that consumes the free-output allowance
  - Verification: verified in code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/generated-image-billing.md
- /Users/almurat/KiKo/system-journal/owner-map/generated-image-billing.md
- /Users/almurat/KiKo/kiko-api/src/config/env.ts
- /Users/almurat/KiKo/kiko-api/src/services/generatedImageBilling.ts
