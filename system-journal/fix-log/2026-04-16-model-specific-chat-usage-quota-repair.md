# Fix Log: 2026-04-16 Model-Specific Chat Usage Quota Repair

Superseded: 2026-04-16 by
`/Users/almurat/KiKo/system-journal/fix-log/2026-04-16-free-premium-chat-usage-quota-rework.md`.
This entry records the earlier root cause for the accidental shared `15`
counter. The active policy no longer uses model-specific free quotas.

## What Changed

- Stopped applying the holder-tier total cap to non-holder chat users.
- Added optional model-specific free-quota overrides on top of category
  fallback quotas.
- Added model-level usage counters so request-time enforcement and summary reads
  can see per-model usage instead of only category aggregates.
- Extended `/api/billing/usage-summary` to expose per-model quota rows when
  model overrides are configured.
- Changed local Docker Compose API startup so quota env is loaded from
  `kiko-api/.env` instead of being pinned by compose-time defaults.

## Why

Non-holder quota enforcement was checking the shared total cap before it checked
whether the user was actually on the holder-tier path. Combined with local
compose defaults, that made quota behavior look like every model shared one
`15`-message limit even after env changes.

## Owner Boundary

- `kiko-api/src/config/env.ts` owns quota env parsing.
- `kiko-api/src/services/usageCounter.ts` owns model/category/total usage
  counters.
- `kiko-api/src/services/usageAccess.ts` owns request-time allow/deny logic and
  free-vs-paid classification.
- `kiko-api/src/routes/billing.ts` owns the summary payload shown to the UI.
- `kiko-web/src/components/Layout/Sidebar.tsx` owns displaying the summary
  shape returned by the server.
- `docker-compose.yml` owns local container env wiring, not quota policy.

## Document Provenance

- Source: operator report that all models were still collapsing to a shared
  `15` usage cap after env changes
- Kind: runtime observation
- Retrieved: 2026-04-16
- Applied To: reproducing the broken quota behavior that triggered this fix
- Verification: verified in code

- Source: `/Users/almurat/KiKo/kiko-api/src/services/usageAccess.ts`
- Kind: repo doc
- Retrieved: 2026-04-16
- Applied To: identifying the non-holder shared-total-cap bug
- Verification: verified in code

- Source: `/Users/almurat/KiKo/docker-compose.yml`
- Kind: repo doc
- Retrieved: 2026-04-16
- Applied To: identifying local container env defaults that shadowed quota config
- Verification: verified in code

- Source: `/Users/almurat/KiKo/kiko-api/env.example`
- Kind: repo doc
- Retrieved: 2026-04-16
- Applied To: documenting model-specific free-limit env overrides and holder-tier base limit semantics
- Verification: verified in code
