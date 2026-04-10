# 2026-04-10 X Mention Webhook Subscription Restored

## What changed

The X webhook operator script now restores the legacy account activity user
subscription used by the current mention/reply ingress path, while continuing to
remove DM/chat activity subscriptions.

Owner file:

- `/Users/almurat/KiKo/kiko-api/src/scripts/manageXWebhook.ts`

## Why it changed

The runtime mention ingress still parses `tweet_create_events` from webhook
payloads. After the script was simplified to clean modern `activity`
subscriptions, the system no longer recreated the legacy user subscription that
actually delivers mention/reply webhook events for the current runtime.

That left the app with:

- a valid webhook URL
- no DM/chat subscriptions
- but also no restored mention/reply delivery subscription

After restoration, the upstream API returned:

- `DuplicateSubscriptionFailed: Subscription already exists`

That response is not a configuration failure. It is the upstream duplicate
signal for an already-active user subscription, so operator code must treat it
as idempotent success.

## Document provenance

### Source 1

- Source: X Account Activity API introduction
- Kind: official API doc
- Retrieved: 2026-04-10
- Applied To: restoring webhook user subscription for mention/reply delivery via
  `/2/account_activity/webhooks/{webhook_id}/subscriptions/all`
- Verification: partially verified

### Source 2

- Source: repo runtime owner review
- Kind: repo code
- Retrieved: 2026-04-10
- Applied To: confirming `xWebhook.ts` still consumes legacy `tweet_create_events`
  for mention handling
- Verification: verified in code

### Source 3

- Source: runtime response from `POST /2/account_activity/webhooks/{webhook_id}/subscriptions/all`
- Kind: runtime observation
- Retrieved: 2026-04-10
- Applied To: treating `DuplicateSubscriptionFailed` as successful ensure behavior
- Verification: verified in runtime

### Source 4

- Source: runtime response from `GET /2/account_activity/webhooks/{webhook_id}/subscriptions/all`
- Kind: runtime observation
- Retrieved: 2026-04-10
- Applied To: correcting verification requests to use user-context auth instead of app-only bearer
- Verification: verified in runtime

## Decision

Until mention ingress is migrated away from legacy webhook envelopes, operator
setup must ensure two conditions simultaneously:

1. DM/chat activity subscriptions remain removed
2. the legacy account activity user subscription remains present for the bot
3. duplicate-create responses must be treated as idempotent success
4. legacy subscription verification must also use user-context auth
