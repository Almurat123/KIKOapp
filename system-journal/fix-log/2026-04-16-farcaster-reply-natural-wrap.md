# 2026-04-16 Farcaster Reply Natural Wrap

## What Changed

- Changed the Farcaster public cast formatter so normal space-delimited
  sentences stay intact.
- Kept wrapping only for continuous text runs that have no natural break points
  and would otherwise become a single overflow token.
- Preserved existing UTF-8-safe truncation after formatting.
- Added a regression test that verifies ordinary English sentences are not
  split across artificial line breaks.

## Why

The previous formatter inserted line breaks at a fixed character width. That
made ordinary English replies render with broken words like `do n’t`, which
looked malformed in the Farcaster client even though the source text was fine.
The formatter should only introduce line breaks when the text itself lacks
natural break opportunities.

## Document Provenance

- Source: Neynar / Farcaster cast-writing docs
  - Kind: official API doc
  - Retrieved: 2026-04-15
  - Applied To: keeping public replies as cast text, not a custom layout engine
  - Verification: verified in docs
- Source: runtime screenshot showing word-broken public reply rendering
  - Kind: runtime observation
  - Retrieved: 2026-04-16
  - Applied To: removing forced word-splitting for normal English text
  - Verification: verified in code and targeted tests

## Verification

- `npx tsx --test src/services/farcaster-agent/farcasterIngressWorker.test.ts`
  passed.

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-farcaster-reply-text-wrapping.md
- /Users/almurat/KiKo/system-journal/owner-map/farcaster-neynar-webhook-ingress.md
