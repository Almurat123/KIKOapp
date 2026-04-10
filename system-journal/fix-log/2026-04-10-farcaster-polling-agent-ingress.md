# Fix Log: 2026-04-10 Farcaster Polling Agent Ingress

## What Changed

- Added a dedicated Farcaster polling ingress pipeline instead of reusing X-specific mention tables.
- Added Farcaster conversation mapping, inbound event log, and outbound delivery tables tied to shared `ChatSession`.
- Added a Neynar-backed polling client that reads `mentions,replies` notifications for the bot FID and posts reply casts with the configured signer UUID.
- Limited full AI execution to users whose `farcasterFid` is already linked in KiKo; unlinked mention authors get a short bind prompt.
- Bootstrapped the polling watermark so first enablement does not replay historical notifications.

## Why

The chosen launch path is `Neynar Free + polling`, not paid webhooks. That requires:

1. A polling worker that can cheaply scan recent notifications.
2. Idempotent storage so repeated polling does not duplicate replies.
3. A clear owner boundary separate from the existing X ingress system.

The current product also already ties personalized agent execution to linked KiKo users. Reusing that rule for Farcaster keeps abuse/cost control consistent with the X mention flow.

## Product Rule

- Farcaster agent polling is opt-in via env and stays disabled until `NEYNAR_API_KEY`, bot FID, and signer UUID are configured.
- On first boot, the worker records the latest notification timestamp and does not auto-reply to old backlog.
- Only linked Farcaster users trigger the full AI pipeline.
- Public Farcaster replies are trimmed to cast-safe length before publish.

## Document Provenance

- Source: Neynar Notifications API docs (`/v2/farcaster/notifications`)
- Kind: official API doc
- Retrieved: 2026-04-10
- Applied To: polling `mentions,replies`, page-size limits, and cursor-based page walking
- Verification: not runtime-verified

- Source: Neynar Post a cast API docs (`/v2/farcaster/cast`)
- Kind: official API doc
- Retrieved: 2026-04-10
- Applied To: reply publication with `signer_uuid`, `parent`, `parent_author_fid`, and `idem`
- Verification: not runtime-verified

- Source: local repo code review of X mention ingress and `/api/users/farcaster` sync route
- Kind: repo doc
- Retrieved: 2026-04-10
- Applied To: linked-user gating, conversation mapping shape, and shared chat-worker reuse
- Verification: verified in code
