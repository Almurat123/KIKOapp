# Owner Map: Generated Image Billing

Updated: 2026-04-24

## Owned Layers

- `kiko-api/src/services/generatedImageBilling.ts`
- `kiko-api/src/repositories/billingRepository.ts`
- `kiko-api/prisma/schema.prisma`
- `kiko-api/src/db/schema.sql`
- `kiko-api/src/db/migrations/002_billing.sql`

## Ownership Boundaries

### Generated image billing service owner

Owns: model normalization, free-vs-paid image reservation decisions, billing
consent checks, reservation locking, reservation status transitions, and
consuming the env-configured shared lifetime free-request allowance.

Does not own: provider HTTP calls, prompt orchestration, moderation, or
frontend picker chrome, or env parsing itself.

### Billing repository owner

Owns: persistence and aggregation for generated-image usage ledger rows and
their combination with existing daily billing aggregates.

Does not own: request-time product policy.

### Schema owners

Owns: the durable shape of generated-image usage reservation rows.

Does not own: pricing policy or UI availability.

## Boundary Rule

Any future generated-image route must reserve usage through
`generatedImageBilling.ts` before calling an upstream provider, and must
finalize that reservation to `completed`, `failed`, or `cancelled` after the
provider outcome is known.

## Document Provenance

- Source: /Users/almurat/KiKo/system-journal/design-language/generated-image-billing.md
  - Kind: repo doc
  - Retrieved: 2026-04-20
  - Applied To: splitting service and repository responsibilities
  - Verification: verified in code
- Source: /Users/almurat/KiKo/kiko-api/src/config/env.ts
  - Kind: repo doc
  - Retrieved: 2026-04-24
  - Applied To: env-side parsing of `CREDITS_LIFETIME_IMAGE_FREE_REQUESTS`
  - Verification: verified in code
- Source: operator requirement on 2026-04-18
  - Kind: product doc
  - Retrieved: 2026-04-18
  - Applied To: mandatory backend binding before generated-image provider calls
  - Verification: verified in code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/generated-image-billing.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-generated-image-billing-and-gating.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-generated-image-free-allowance-env-control.md
