# Fix Log: 2026-04-16 Free/Premium Chat Usage Quota Rework

## What Changed

- Removed the active Normal/Advanced and DeepSeek/Grok quota buckets from chat
  quota enforcement.
- Classified NVIDIA GLM/Kimi traffic as free-model traffic. Free-model traffic
  is unlimited by default at the KIKO quota layer, but can share one optional
  daily cap.
- Classified GPT and Grok traffic as premium-model traffic. GPT and Grok now
  consume one shared daily premium quota.
- Changed usage counters to write `free` and `premium` categories while reading
  same-day legacy `deepseek` and `grok` rows during deploy compatibility windows.
- Reattached chat quota enforcement and `/api/billing/usage-summary` to the
  token-holder tier resolver so each user now gets free/premium limits from the
  matched `USAGE_LIMITS_TIERS_JSON` tier when token gating is configured.
- Extended `USAGE_LIMITS_TIERS_JSON` parsing to support `freeModelLimit` and
  `premiumLimit` while keeping legacy `dailyLimit` as a backward-compatible
  premium-limit alias.
- Changed `/api/billing/usage-summary` and the sidebar to show free usage plus
  one optional shared free limit and one shared premium limit instead of a total
  cap or separate model caps.
- Updated env configuration to use `BILLING_DAILY_FREE_PREMIUM`,
  `BILLING_DAILY_FREE_MODEL_LIMIT`, `BILLING_FREE_MODELS`, and
  `BILLING_PREMIUM_MODELS` as model/fallback quota knobs.

## Why

DeepSeek is no longer part of the active product model catalog. NVIDIA-hosted
GLM and Kimi replaced it and should behave as free-model options. GPT and Grok
still share one premium allowance instead of carrying separate free counters.
However, the earlier free/premium rework accidentally disconnected chat gating
from token-holder tiers, so holder balance no longer increased quota. This
follow-up correction makes holder tiers the primary per-user quota owner again.

## Owner Boundary

- `kiko-api/src/config/env.ts` owns parsing free/premium model lists,
  billing-env fallback quotas, and token-tier dual-limit schema.
- `kiko-api/src/services/billing/billingService.ts` owns classifying models into
  `free`, `premium`, or `other`.
- `kiko-api/src/services/usageCounter.ts` owns total/free/premium/model counters
  and legacy same-day category backfill.
- `kiko-api/src/services/usageLimitsService.ts` owns token balance reads and
  per-user holder-tier quota resolution.
- `kiko-api/src/services/usageAccess.ts` owns allow/deny decisions and the
  free/premium limit messages using the resolved holder-tier limits.
- `kiko-api/src/routes/billing.ts` owns the authenticated summary payload shape.
- `kiko-web/src/services/billingApi.ts` and
  `kiko-web/src/components/Layout/Sidebar.tsx` own preserving and rendering that
  server-provided shape.

## Document Provenance

- Source: operator quota-policy correction after DeepSeek removal
- Kind: product doc
- Retrieved: 2026-04-16
- Applied To: free GLM/Kimi traffic and shared GPT/Grok premium quota
- Verification: verified in code

- Source: operator quota-policy correction for token-tier chat quota rebinding
- Kind: product doc
- Retrieved: 2026-04-16
- Applied To: per-user free/premium limits coming from `USAGE_LIMITS_TIERS_JSON`
- Verification: verified in code

- Source: `/Users/almurat/KiKo/system-journal/fix-log/2026-04-16-nvidia-glm-kimi-provider-replacement.md`
- Kind: repo doc
- Retrieved: 2026-04-16
- Applied To: confirming DeepSeek removal and active GLM/Kimi model ids
- Verification: verified in code

- Source: `/Users/almurat/KiKo/kiko-api/src/services/usageAccess.ts`
- Kind: repo doc
- Retrieved: 2026-04-16
- Applied To: request-time free/premium quota decisions
- Verification: verified in code

- Source: `/Users/almurat/KiKo/kiko-api/src/services/usageLimitsService.ts`
- Kind: repo doc
- Retrieved: 2026-04-16
- Applied To: holder-tier quota resolution and request/summary cache behavior
- Verification: verified in code

- Source: `/Users/almurat/KiKo/kiko-api/src/routes/billing.ts`
- Kind: repo doc
- Retrieved: 2026-04-16
- Applied To: summary API shape consumed by the sidebar
- Verification: verified in code

## Verification

- Verified in code that GLM/Kimi are classified as `free`.
- Verified in code that GPT/Grok are classified as `premium`.
- Verified in code that free requests compare against `counts.free` only when
  the resolved `freeModelLimit` is positive.
- Verified in code that premium requests compare against one shared
  `counts.premium` counter and the resolved holder-tier `premiumLimit`.
- Verified in code that `/api/billing/usage-summary` now returns the resolved
  holder-tier limits instead of static billing-env values.
- Automated test/build verification is recorded in the task response when run.

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/chat-usage-quota-policy.md
- /Users/almurat/KiKo/system-journal/owner-map/chat-usage-quota.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-nvidia-glm-kimi-provider-replacement.md
- /Users/almurat/KiKo/system-journal/conflicts.md
