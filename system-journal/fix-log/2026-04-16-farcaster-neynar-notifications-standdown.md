# Fix Log: 2026-04-16 Farcaster Neynar Notifications Standdown

## What Changed

- Webhook-enabled Farcaster mention polling no longer calls Neynar
  `fetchAllNotifications`.
- When the Neynar webhook is enabled, mention polling now goes directly to
  Hub-based fallback instead of consuming Neynar notification credits.
- Neynar notifications remain available only for deployments where the webhook
  is not enabled or not configured.
- Added a small regression test to lock the webhook-enabled standdown rule.

## Why

The usage dashboard showed Neynar `notifications` spending while the Farcaster
webhook path was already enabled. That was not the intended operating mode for
this repository. The long-lived boundary in the owner map already said
notifications should only be used when the webhook is unavailable, so the code
was brought back into alignment with that rule.

## Product Rule

- If `env.farcasterAgent.neynarWebhookEnabled` is true, Farcaster mention
  polling must not call Neynar notifications.
- Webhook-enabled polling should use Hub fallback only.
- Neynar notifications may still be used when the webhook is disabled or not
  configured.

## Verification

- `npx tsx --test kiko-api/src/services/farcaster-agent/farcasterApiClient.test.ts`
  passed.
- `npx tsx --test` coverage for the affected helper now locks the standdown
  rule in code.
- Code review confirmed `fetchMentionPage()` no longer enters the Neynar
  notifications path when webhook ingress is enabled.

## Document Provenance

- Source: usage dashboard screenshot showing `notifications` credit spend
  under `/v2/farcaster/notifications`
  - Kind: runtime observation
  - Retrieved: 2026-04-16
  - Applied To: identifying that webhook-enabled polling was still consuming
    Neynar read quota
  - Verification: inferred from dashboard and verified in code
- Source: `system-journal/owner-map/farcaster-neynar-webhook-ingress.md`
  - Kind: repo doc
  - Retrieved: 2026-04-16
  - Applied To: restoring the webhook-only boundary for enabled deployments
  - Verification: verified in code
- Source: `system-journal/fix-log/2026-04-15-farcaster-neynar-notifications-ingress.md`
  - Kind: repo doc
  - Retrieved: 2026-04-16
  - Applied To: superseding the temporary notifications-as-safety-net guidance
  - Verification: verified in code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/owner-map/farcaster-neynar-webhook-ingress.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-farcaster-neynar-webhook-ingress.md
- /Users/almurat/KiKo/system-journal/conflicts.md
