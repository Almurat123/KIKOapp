# Owner Map: Farcaster Neynar Webhook Ingress

Updated: 2026-04-17

## Owned Layers

- `kiko-api/src/routes/neynarWebhook.ts`
- `kiko-api/src/scripts/manageNeynarWebhook.ts`
- `kiko-api/src/services/farcaster-agent/farcasterApiClient.ts`
- `kiko-api/src/services/farcaster-agent/farcasterConversationService.ts`
- `kiko-api/src/services/farcaster-agent/farcasterIngressWorker.ts`
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

### Farcaster continuation fallback

Owns: Hub fallback collection for no-mention replies that are direct children of
recent bot-authored outbound casts tracked in `FarcasterConversationMapping`.

Does not own: arbitrary root-thread monitoring, X/Twitter mention policy, or
model-side conversation semantics.

## Boundary Rule

The webhook route is the preferred Farcaster ingress when enabled. It may hand
off normalized events to the existing worker, but it must not become a second
durable truth owner for mentions or replies. Worker admission is separate from
webhook normalization because valid provider payloads can still be rejected for
self/bot-loop safety.

If the webhook is disabled or unconfigured, the system may fall back to
notification polling, but the webhook owner itself still owns the callback
contract.

The provider-side `cast.created` subscription should follow Neynar's documented
bot pattern in a single filter object:

- `mentioned_fids` for direct `@bot` mentions
- `parent_author_fids` for replies to the bot

Once a user has directly addressed the bot, Farcaster continuation can proceed
without another `@` only when the next inbound cast is a direct reply to a
bot-authored parent cast. Comments elsewhere in the same root thread still need
an explicit mention.

Self-authored casts and casts from `FARCASTER_AGENT_BLOCKED_BOT_FIDS` must be
rejected before durable event-log persistence regardless of whether they arrive
through Neynar webhook, Hub polling, or recovery replay. Public bind-link prompts
must be scoped conservatively by author, not only by cast hash.

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
- Source: Neynar Documentation, Listen for @bot Mentions
  - Kind: official API doc
  - Retrieved: 2026-04-15
  - Applied To: provider-side `mentioned_fids` + `parent_author_fids`
    subscription ownership
  - Verification: verified in docs
- Source: Neynar Documentation, Verify Webhooks with HMAC Signatures
  - Kind: official API doc
  - Retrieved: 2026-04-15
  - Applied To: X-Neynar-Signature verification boundary
  - Verification: verified in docs
- Source: `@farcaster/hub-nodejs` dist typings
  - Kind: local SDK source
  - Retrieved: 2026-04-17
  - Applied To: `getCastsByParent` fallback for direct replies to tracked bot
    parent casts
  - Verification: verified in code and tests
- Source: Farcaster direct-reply runtime policy review
  - Kind: product/runtime observation
  - Retrieved: 2026-04-17
  - Applied To: no-mention continuation rule after the bot has replied
  - Verification: verified in code and tests
- Source: `/Users/almurat/Downloads/logs.1776362968247.json`
  - Kind: runtime observation
  - Retrieved: 2026-04-17
  - Applied To: self/bot-loop rejection and bind-link anti-spam cooldown
  - Verification: verified in runtime logs, code, and targeted tests

## See Also

- system-journal/INDEX.md
- system-journal/design-language/farcaster-miniapp-shell.md
- system-journal/fix-log/2026-04-15-farcaster-neynar-webhook-ingress.md
- system-journal/fix-log/2026-04-17-farcaster-direct-reply-continuation.md
- system-journal/fix-log/2026-04-17-farcaster-self-loop-bind-spam-guard.md
