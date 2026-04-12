# Fix Log: 2026-04-10 Farcaster Polling Agent Ingress

## What Changed

- Added a dedicated Farcaster polling ingress pipeline instead of reusing X-specific mention tables.
- Added Farcaster conversation mapping, inbound event log, and outbound delivery tables tied to shared `ChatSession`.
- Reworked the Farcaster agent to use the free Snapchain Hub RPC path instead of Neynar for both mention polling and reply publication.
- `FARCASTER_AGENT_HUB_RPC_URL` now accepts a comma-separated list of Hub RPC endpoints and falls back left-to-right when the first endpoint is unavailable.
- Default mention polling cadence is now `10s` and remains env-driven so operators can raise it to `15m` or `1h` without code changes.
- Limited full AI execution to users whose `farcasterFid` is already linked in KiKo; unlinked mention authors get a short bind prompt.
- Bootstrapped the polling watermark so first enablement does not replay historical notifications.

## Why

The chosen launch path is the free Snapchain Hub RPC path, not Neynar. That requires:

1. A polling worker that can cheaply scan recent mention casts.
2. Idempotent storage so repeated polling does not duplicate replies.
3. A clear owner boundary separate from the existing X ingress system.

The current product also already ties personalized agent execution to linked KiKo users. Reusing that rule for Farcaster keeps abuse/cost control consistent with the X mention flow.

## Product Rule

- Farcaster agent polling is opt-in via env and stays disabled until the bot FID, at least one Hub RPC URL, and signer private key are configured.
- On first boot, the worker records the latest mention watermark and does not auto-reply to old backlog.
- Only linked Farcaster users trigger the full AI pipeline.
- Public Farcaster replies are trimmed to cast-safe length before publish.
- Polling cadence is controlled entirely by `FARCASTER_AGENT_POLL_MENTIONS_MS` and defaults to `10000`.

## Document Provenance

- Source: @farcaster/hub-nodejs README and `dist/index.d.ts`
- Kind: local SDK source
- Retrieved: 2026-04-12
- Applied To: Hub RPC mention polling via `getCastsByMention`, cast lookup via `getCast`, and reply publication via `makeCastAdd`/`submitMessage`
- Verification: verified in runtime

- Source: public Hub runtime observation against `hub.merv.fun:3381`
- Kind: runtime observation
- Retrieved: 2026-04-12
- Applied To: free Hub RPC default endpoint and startup readiness expectations
- Verification: verified in runtime

- Source: local repo code review of X mention ingress and `/api/users/farcaster` sync route
- Kind: repo doc
- Retrieved: 2026-04-10
- Applied To: linked-user gating, conversation mapping shape, and shared chat-worker reuse
- Verification: verified in code
