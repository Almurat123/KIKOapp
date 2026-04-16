# Chat Usage Quota Owner Map

Updated: 2026-04-16

## Owned Layers

- `kiko-api/src/config/env.ts`
- `kiko-api/src/services/billing/billingService.ts`
- `kiko-api/src/services/usageCounter.ts`
- `kiko-api/src/services/usageLimitsService.ts`
- `kiko-api/src/services/usageAccess.ts`
- `kiko-api/src/routes/billing.ts`
- `kiko-web/src/services/billingApi.ts`
- `kiko-web/src/components/Layout/Sidebar.tsx`
- `docker-compose.yml`

## Ownership Boundaries

### Env boundary

Owns: parsing free-model/premium-model lists, billing-env fallback quotas, and
token-tier quota schema (`freeModelLimit`, `premiumLimit`, legacy `dailyLimit`).

Does not own: request-time access decisions or UI rendering.

### Usage counter boundary

Owns: per-day total/free/premium/model counters and same-day legacy category
backfill for quota reads.

Does not own: pricing, auth gating, or token-balance reads.

### Holder-tier quota boundary

Owns: reading token balance, caching per-user quota resolution, and converting a
matched holder tier into one free-model limit and one premium-model limit.

Does not own: model classification, route payload shapes, or UI messages.

### Access decision boundary

Owns: deciding whether a free or premium request is allowed, whether the current
request is free at the KIKO layer, and which limit message should be shown,
using the resolved holder-tier limits.

Does not own: quota storage, consent state, or sidebar presentation.

### Billing summary boundary

Owns: returning the active quota shape for the current user: free
usage/optional limit, premium usage/limit, and per-model diagnostic rows using
the same holder-tier quota resolution as request-time gating.

Does not own: inventing new quota policy beyond what `usageAccess` and env
configuration define.

### Sidebar boundary

Owns: rendering the server-provided free/premium quota shape without flattening
model rows back into guessed client buckets.

Does not own: recomputing limits or second-guessing server enforcement.

### Docker compose boundary

Owns: making the local API container see the same quota env file as the local
non-container runtime.

Does not own: production secret management or quota policy itself.
