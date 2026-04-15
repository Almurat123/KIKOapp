# 2026-04-15 Farcaster Query Unwrapping And Wallet Guard

## Summary

Farcaster mention ingress had recovered enough webhook transport to enqueue jobs,
but the chat snapshot owner still treated the persisted wrapper text as the
literal user query. That allowed wrapper labels such as `Farcaster` and
`Current` to leak into requested token symbols and pushed canonical intent
normalization toward `farcaster/social_discovery` for a pure token-address
question. The same routing surface still had a separate copy-trade fallback that
could reinterpret any `requestedTokenAddresses` entry as a wallet because token
contracts and EOA wallets share the same `0x...` shape.

## What Changed

- Added `extractEffectiveUserQuery()` in
  `src/jobs/chat/conversationStateResolver.ts` to recover the literal text from
  Farcaster wrapper content shaped like:
  - `Farcaster inbound mention context:`
  - `Parent ...`
  - `Current ...: <user text>`
- Updated `assembleChatContext()` to use the effective user query for:
  - `snapshot.lastUserMessage`
  - requested token address extraction
  - requested token symbol extraction
  - prefetched runtime directives
- Updated `canonicalIntentNormalizer` to sanitize user-role recent history and
  `latest_user_message` before sending them to the normalization model.
- Added defense-in-depth stop words in `tradeSemantics` for wrapper labels:
  - `FARCASTER`
  - `CURRENT`
  - `PARENT`
- Removed the copy-trade fallback that used `snapshot.requestedTokenAddresses`
  as wallet candidates in `tradingIntentResolver.ts`.

## Why

The failing trace showed:

- webhook ingress succeeded
- `requestedAddresses: 1`
- `requestedSymbols: ["FARCASTER", "CURRENT"]`
- canonical normalization returned `domain=farcaster`, `intent=social_discovery`
- downstream tools searched Farcaster for the token contract string instead of
  analyzing the token

That means the primary fault was not address extraction. The primary fault was
transport wrapper leakage into the normalization surface.

The copy-trade wallet fallback was a separate correctness bug. Even if it did
not own the logged `social_discovery` misroute, it could still make a later
`0x...` token contract look like a wallet in copy-trade flows.

## Document Provenance

- Source: production/runtime logs for trace `dd7b79f7-41fb-4147-8e38-44a3c4bfeff0`
- Kind: runtime observation
- Retrieved: 2026-04-15
- Applied To: Farcaster query unwrapping and copy-trade wallet fallback removal
- Verification: verified in code and targeted tests

## Verification

Targeted tests added/updated:

- `src/jobs/chat/contextAssembler.test.ts`
- `src/jobs/chat/conversationStateResolver.test.ts`
- `src/jobs/chat/canonicalIntentNormalizer.test.ts`
- `src/jobs/chat/tradingIntentResolver.test.ts`

Test intent:

- wrapped Farcaster mention text should reduce to the literal token address
- wrapper labels should not appear in requested token symbols
- normalization payload should receive the unwrapped token query
- copy-trade should not treat token carry-over as wallet fallback

## Owner Boundaries

- `farcasterIngressWorker.ts` may keep rich ingress wrapper text for audit and
  thread context.
- `contextAssembler.ts` owns converting that persisted text into the effective
  user query for orchestration.
- `canonicalIntentNormalizer.ts` owns making sure routing prompts do not re-read
  ingress scaffolding.
- `tradingIntentResolver.ts` must never infer wallets from token carry-over.
