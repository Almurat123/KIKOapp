# 2026-04-10 X Trade Notifications Disabled

## What changed

X trade and copytrade notifications were hard-disabled in the backend notification owner layer.

Owner file:

- `/Users/almurat/KiKo/kiko-api/src/services/notifications/x/notificationService.ts`

Behavior after this change:

- the copytrade notification publisher no longer fans out notifications to X
- the dedicated X trade notification service files were removed from the codebase
- trade/copytrade notifications now remain on lower-cost channels only

## Why it changed

Runtime and product review concluded that X DM is the wrong delivery channel for high-frequency trade notifications.

The current notification path still incurs an outbound X DM write request per notification. For users with frequent trade activity, this creates a linear per-event cost profile that is materially worse than keeping notifications in lower-cost channels.

X remains useful for:

- low-frequency public interaction
- mention-driven agent entry

X is not retained for:

- trade success notifications
- trade failure notifications
- copytrade skipped notifications

## Document provenance

### Source 1

- Source: Local code review of X notification flow
- Kind: repo code
- Retrieved: 2026-04-10
- Applied to: confirming X trade notifications directly call outbound `sendDirectMessage(...)`
- Verification: verified in code

Relevant files:

- `/Users/almurat/KiKo/kiko-api/src/services/copytrade-v2/notifications/copytradeNotificationPublisher.ts`
- `/Users/almurat/KiKo/kiko-api/src/services/x/xReplyService.ts`

### Source 2

- Source: Local code review of mention-driven X agent flow
- Kind: repo code
- Retrieved: 2026-04-10
- Applied to: separating high-frequency notification cost from mention + AI interaction cost
- Verification: verified in code

Relevant files:

- `/Users/almurat/KiKo/kiko-api/src/services/x/xIngressWorker.ts`
- `/Users/almurat/KiKo/kiko-api/src/services/x/xChatBridge.ts`
- `/Users/almurat/KiKo/kiko-api/src/jobs/chat/legacyCompat.ts`

### Source 3

- Source: X API pricing documentation
- Kind: official API doc
- Retrieved: 2026-04-10
- Applied to: confirming X pricing is endpoint/usage based and not represented in this repository as a fixed universal `$0.01` per message rule
- Verification: partially verified

Reference:

- https://docs.x.com/x-api/getting-started/pricing

## Decision

Until a cheaper notification channel or materially different X cost model is adopted, X trade/copytrade notifications should remain absent from the publish graph.
