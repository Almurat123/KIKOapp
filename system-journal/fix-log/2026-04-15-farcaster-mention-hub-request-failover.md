# Fix Log: 2026-04-15 Farcaster Mention Hub Request Failover

## What Changed

- Added request-level failover to the Farcaster Hub client so a transient
  `Call cancelled` on mention polling invalidates the active endpoint and
  advances to the next configured Hub.
- Kept the existing left-to-right startup fallback, but now the worker can
  recover mid-flight without waiting for the next process restart.
- Preserved the current worker policy; the retry logic lives in the Hub client
  layer instead of the polling loop.

## Why

Runtime logs showed the same Farcaster replica repeatedly starting, connecting
to `hub.merv.fun:3381`, and then failing mention polls with `Call cancelled`
every minute. That pattern meant the selected Hub could become unhealthy after
initial readiness and stay sticky because the client cache never rotated after
request failure.

## Product Rule

- A transient gRPC cancellation during mention polling must be treated as a
  recoverable Hub endpoint failure, not as a user action.
- The next Hub in the configured order should be tried automatically.
- Persistent failures should still surface in logs after the endpoint list is
  exhausted.

## Document Provenance

- Source: `/Users/almurat/Downloads/logs.1776233683014.json`
- Kind: runtime observation
- Retrieved: 2026-04-15
- Applied To: repeated `Call cancelled` mention polls on the same replica even
  after `Snapchain Hub RPC ready`
- Verification: verified in runtime

- Source: `/Users/almurat/Downloads/logs.1776233864338.json`
- Kind: runtime observation
- Retrieved: 2026-04-15
- Applied To: the same minute-by-minute `Call cancelled` failure pattern on a
  later replica
- Verification: verified in runtime

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-farcaster-mention-hub-fallback.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-farcaster-polling-agent-ingress.md
- /Users/almurat/KiKo/system-journal/conflicts.md
