# Fix Log: 2026-04-15 Farcaster Neynar Notifications Ingress

## What Changed

- Switched Farcaster mention ingestion to Neynar `fetchAllNotifications`
  with `mentions` and `replies` as the primary read path.
- Switched thread hydration to Neynar `lookupCastByHashOrUrl` before falling
  back to the legacy Hub path.
- Kept Hub RPC publication intact so replies still submit through the existing
  signer-based flow.

## Why

The public Hub path had been unstable for mention polling, and the available
Neynar keys were previously rate-limited. After the paid Neynar plan became
available, notifications became the cleaner primary ingress source.

## Product Rule

- Use Neynar notifications for inbound mentions and replies when the API key
  is configured.
- Keep Hub RPC only as a fallback for hydration and reply publication.
- Continue to normalize mention events before they reach the worker.

## Verification

- `npm run build` passes after the Neynar notification source change.
- The mention parser test now accepts normalized Neynar event payloads.

## Document Provenance

- Source: Neynar notifications API `fetchAllNotifications`
- Kind: official API doc
- Retrieved: 2026-04-15
- Applied To: mentions/replies notification polling and pagination
- Verification: verified in code

- Source: Neynar cast lookup API `lookupCastByHashOrUrl`
- Kind: official API doc
- Retrieved: 2026-04-15
- Applied To: thread hydration before Hub fallback
- Verification: verified in code

- Source: `@neynar/nodejs-sdk` local package typings
- Kind: local SDK source
- Retrieved: 2026-04-15
- Applied To: SDK enums and response model shapes used by the service layer
- Verification: verified in code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-farcaster-mention-hub-fallback.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-farcaster-mention-hub-request-failover.md
- /Users/almurat/KiKo/system-journal/conflicts.md
