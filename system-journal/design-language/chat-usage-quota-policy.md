# Chat Usage Quota Policy

Updated: 2026-04-16

## Purpose

Define one canonical rule set for chat usage quotas so backend enforcement,
summary APIs, and the sidebar all describe the same policy.

## Canonical Rules

1. Free-model traffic has one optional shared daily cap. GLM and Kimi are the
   canonical free-model families unless env explicitly extends the list.
2. Premium-model traffic has one shared daily free quota. GPT and Grok consume
   the same premium counter; they must not have separate daily free buckets.
3. When `USAGE_LIMITS_TOKEN_ADDRESS` is configured, the current user's chat
   quota must be resolved from the matched `USAGE_LIMITS_TIERS_JSON` holder
   tier before any request-time gating or summary rendering happens.
4. Tier entries should define `freeModelLimit` and `premiumLimit`. Legacy
   `dailyLimit` remains a backward-compatible alias for `premiumLimit`.
5. `BILLING_DAILY_FREE_MODEL_LIMIT` and `BILLING_DAILY_FREE_PREMIUM` are
   fallback defaults only. They apply when token-tier gating is unavailable or
   when a tier omits the corresponding field.
6. `freeModelLimit = 0` means unlimited free-model traffic at the KIKO layer.
7. Model ids must be normalized once before quota lookup, cache writes, and
   summary reads.
8. Summary APIs must expose free usage plus either the resolved free cap or
   `null` when free traffic is unlimited.
9. Local Docker Compose runs must load API quota env from `kiko-api/.env`
   instead of hard-coding compose-time defaults that shadow runtime config.

## Forbidden Local Patch Patterns

- Reintroducing Normal/Advanced or DeepSeek/Grok quota buckets.
- Blocking GLM/Kimi unless the resolved `freeModelLimit` is a positive integer
  and the shared free counter reached that cap.
- Giving GPT and Grok separate daily free counters.
- Rendering env default limits in the sidebar when request-time enforcement uses
  per-user holder-tier limits.
- Adding a new chat model without making quota lookup, usage counting, and
  summary reads agree on the normalized model id.
