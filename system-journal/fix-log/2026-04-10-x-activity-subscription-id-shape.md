# 2026-04-10 X Activity Subscription ID Shape

## What changed

The X webhook operator script was corrected to use `subscription_id` from the
`GET /2/activity/subscriptions` response instead of assuming the field is `id`.

Owner file:

- `/Users/almurat/KiKo/kiko-api/src/scripts/manageXWebhook.ts`

## Why it changed

Runtime deletion attempts failed with:

`POST/DELETE ... /2/activity/subscriptions/undefined`

The script was parsing list results as if every subscription record exposed `id`.
The current X Activity API response shape instead exposes `subscription_id`.

This caused cleanup of DM/chat subscriptions to fail even when the records were
present and otherwise matched correctly.

## Document provenance

### Source 1

- Source: runtime failure output from `npm run x:webhook:ensure`
- Kind: runtime observation
- Retrieved: 2026-04-10
- Applied To: proving deletion path used an undefined subscription identifier
- Verification: verified in runtime

### Source 2

- Source: X Activity API response shape observed from existing subscription payloads
- Kind: runtime observation
- Retrieved: 2026-04-10
- Applied To: using `subscription_id` as canonical deletion identifier
- Verification: verified in runtime

## Decision

Treat `subscription_id` as canonical for X Activity subscription mutation paths.
Keep `id` only as a backward-compatible fallback when reading mixed payloads.
