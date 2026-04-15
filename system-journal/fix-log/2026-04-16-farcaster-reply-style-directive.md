# 2026-04-16 Farcaster Reply Style Directive

## What Changed

- Added a Farcaster-only runtime directive that tells the model to write public
  cast replies as short, natural replies instead of report-style answers.
- The directive requires:
  - direct answer first
  - one short supporting paragraph or a compact bullet list only when natural
  - no headings like `Conclusion`, `Evidence`, or `Next step`
  - exact preservation of addresses, handles, symbols, and numbers
- Added a regression test to ensure the directive appears whenever the Farcaster
  agent context is active.

## Why

The public reply text from the Farcaster agent was technically valid but read
like a report, with a stiff preamble and meta framing. Farcaster cast replies
do not need that structure. The model should write like a human replying in a
thread: direct, short, and readable.

## Document Provenance

- Source: Neynar / Farcaster cast writing docs
  - Kind: official API doc
  - Retrieved: 2026-04-15
  - Applied To: keeping public replies as simple cast text instead of a report format
  - Verification: verified in docs
- Source: runtime screenshot showing awkward report-style public reply
  - Kind: runtime observation
  - Retrieved: 2026-04-16
  - Applied To: adding a Farcaster-specific reply style directive
  - Verification: verified in code and targeted tests

## Verification

- `npx tsx --test src/jobs/chat/runtimeDirectiveResolver.test.ts` passed.

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-farcaster-reply-natural-wrap.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-farcaster-reply-text-wrapping.md
- /Users/almurat/KiKo/system-journal/owner-map/farcaster-neynar-webhook-ingress.md
