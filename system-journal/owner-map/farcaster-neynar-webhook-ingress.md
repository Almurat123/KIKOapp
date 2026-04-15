# Owner Map: Farcaster Neynar Webhook Ingress

Updated: 2026-04-15

## Owned Layers

- `kiko-api/src/routes/neynarWebhook.ts`
- `kiko-api/src/scripts/manageNeynarWebhook.ts`
- `kiko-api/src/services/farcaster-agent/neynarWebhookService.ts`

## Ownership Boundaries

### Neynar callback route

Owns: signature verification, payload admission, and handing accepted
cast.created mention/reply events to the existing Farcaster ingress worker.

Does not own: webhook registration, worker cadence, reply publication, or
conversation policy.

### Neynar webhook operator script

Owns: callback-url reuse, create/update/list webhook CRUD, and dashboard-visible
registration output.

Does not own: delivery handling, event dedupe, or reply execution.

### Neynar webhook normalization service

Owns: webhook CRUD calls, HMAC verification, and cast.created payload
normalization into `FarcasterMentionEvent`.

Does not own: mention polling cadence, Hub fallback, or downstream agent work.

## Boundary Rule

The webhook route is the preferred Farcaster ingress when enabled. It may hand
off accepted events to the existing worker, but it must not become a second
durable truth owner for mentions or replies.

If the webhook is disabled or unconfigured, the system may fall back to
notification polling, but the webhook owner itself still owns the callback
contract.

## Document Provenance

- Source: Neynar Documentation, Webhooks in Dashboard
  - Kind: official API doc
  - Retrieved: 2026-04-15
  - Applied To: callback URL and cast.created mention/reply delivery shape
  - Verification: verified in docs
- Source: Neynar Documentation, Programmatic Webhooks
  - Kind: official API doc
  - Retrieved: 2026-04-15
  - Applied To: webhook list/create/update CRUD
  - Verification: verified in docs
- Source: Neynar Documentation, Verify Webhooks with HMAC Signatures
  - Kind: official API doc
  - Retrieved: 2026-04-15
  - Applied To: X-Neynar-Signature verification boundary
  - Verification: verified in docs

## See Also

- system-journal/INDEX.md
- system-journal/design-language/farcaster-miniapp-shell.md
- system-journal/fix-log/2026-04-15-farcaster-neynar-webhook-ingress.md

