# 2026-04-17 Farcaster Self-Loop Bind Spam Guard

## Summary

A Farcaster incident showed bot-authored public bind replies re-entering the
Neynar webhook path as `parent_author_fids` reply events. Because the old ingress
only filtered self-authored events on the polling path or late in business logic,
the bot could recursively publish more public link prompts.

## What Changed

- Added one Farcaster inbound ignore rule for self-authored and configured
  blocked-bot-authored casts.
- Applied that rule before webhook/polling events are persisted through
  `enqueueMention()`.
- Kept the same rule in business processing as a recovery guard for events
  persisted before this fix.
- Changed public bind-link idempotency from per-cast to per-author/per-day.
- Changed bind cooldown to treat any recent bind attempt as suppression evidence,
  including pending or failed deliveries.
- Made Neynar webhook route logs distinguish normalized webhook payloads from
  worker admission, so self/bot-loop events no longer look accepted when the
  worker intentionally drops them.
- Hardened Farcaster outbound delivery reservation so a concurrent unique-key
  race is treated as an already-reserved delivery instead of allowing a second
  publish attempt.

## Why

Neynar's `parent_author_fids` subscription correctly emits replies to bot-authored
casts. That includes casts authored by the bot itself if the bot replies into the
same conversation. The ingress worker, not the webhook route, must own the
canonical "do not interact with self or known bot-loop sources" rule because
events can enter through webhook, polling fallback, and recovery replay.

For unlinked users, public bind replies are intentionally conservative. Missing a
repeat link prompt is acceptable; publishing a visible recursive link chain is
not.

## Document Provenance

- Source: `/Users/almurat/Downloads/logs.1776362968247.json`
- Kind: runtime observation
- Retrieved: 2026-04-17
- Applied To: identifying the self-loop chain where published replies had
  `parentAuthorFid=1576616` and were followed by more public bind replies
- Verification: verified in runtime logs and code

- Source: `kiko-api/src/services/farcaster-agent/farcasterIngressWorker.ts`
- Kind: repo code
- Retrieved: 2026-04-17
- Applied To: locating the existing polling-only bot filter, late self guard,
  continuation skip, bind cooldown, and event-log enqueue boundary
- Verification: verified in code and targeted tests

- Source: `kiko-api/src/routes/neynarWebhook.ts`
- Kind: repo code
- Retrieved: 2026-04-17
- Applied To: separating webhook normalization from worker admission in route
  logs
- Verification: verified in code

## Verification

- Added targeted tests for self/blocked-bot ignore classification.
- Added targeted tests for per-author/per-day bind-link idempotency keys.
- Added targeted test for Farcaster delivery idempotency under concurrent
  unique-key reservation races.

## Owner Boundaries

- `kiko-api/src/routes/neynarWebhook.ts` owns HMAC verification and payload
  normalization logging. It does not own social conversation policy.
- `kiko-api/src/services/farcaster-agent/farcasterIngressWorker.ts` owns durable
  admission, self/bot-loop rejection, bind-link cooldown, and event claiming.
- `kiko-api/src/services/farcaster-agent/farcasterReplyService.ts` owns outbound
  delivery reservation and must not publish twice for one idempotency key.

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/owner-map/farcaster-neynar-webhook-ingress.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-farcaster-direct-reply-continuation.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-farcaster-inbound-event-idempotence.md
- /Users/almurat/KiKo/system-journal/conflicts.md
