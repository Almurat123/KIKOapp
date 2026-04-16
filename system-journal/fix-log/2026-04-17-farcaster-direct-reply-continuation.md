# Fix Log: 2026-04-17 Farcaster Direct Reply Continuation

## What Changed

- Made the Farcaster continuation rule explicit: the first turn needs an
  `@kikoapp` mention, but a later cast can continue the same agent thread without
  another mention when it directly replies to a bot-authored parent cast.
- Kept X/Twitter behavior unchanged; this rule is Farcaster-only.
- Added Hub fallback support for direct replies by reading recent
  `FarcasterConversationMapping.lastOutboundCastHash` values and fetching their
  direct children with `getCastsByParent`.
- Kept the admission boundary narrow: comments elsewhere in the same root thread
  still need an explicit mention, because the bot was not directly addressed.
- Added tests for webhook normalization of no-mention direct replies and Hub
  parsing of direct replies to tracked bot parent casts.

## Why

Farcaster conversation UX is closer to a public threaded conversation than X
reply permission rules. Once the bot has replied, a user should be able to reply
directly under the bot's cast without repeating the handle. The previous webhook
subscription already supported `parent_author_fids`, but Hub fallback only used
`getCastsByMention`, so fallback could not see no-mention continuation turns.

## Product Rule

- First activation: user must explicitly mention the bot.
- Continuation: user may omit the mention only when replying directly to a cast
  authored by the bot.
- Same root thread but not directly under a bot cast: user must mention the bot.
- X/Twitter: every public turn still requires a mention.

## Document Provenance

- Source: `@farcaster/hub-nodejs` dist typings
  - Kind: local SDK source
  - Retrieved: 2026-04-17
  - Applied To: `getCastsByParent` fallback for direct replies to bot-authored
    parent casts
  - Verification: verified in code and tests
- Source: Neynar "Listen for @bot Mentions" documentation
  - Kind: official API doc
  - Retrieved: 2026-04-15
  - Applied To: keeping webhook `mentioned_fids` plus `parent_author_fids` as the
    provider-side direct mention/reply contract
  - Verification: verified in docs and existing code
- Source: Farcaster direct-reply runtime policy review
  - Kind: product/runtime observation
  - Retrieved: 2026-04-17
  - Applied To: no-mention continuation semantics under bot-authored parent casts
  - Verification: verified in code and tests

## Verification

- `npx tsx --test src/services/farcaster-agent/neynarWebhookService.test.ts src/services/farcaster-agent/farcasterApiClient.test.ts`

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/owner-map/farcaster-neynar-webhook-ingress.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-farcaster-neynar-webhook-ingress.md
- /Users/almurat/KiKo/system-journal/conflicts.md
