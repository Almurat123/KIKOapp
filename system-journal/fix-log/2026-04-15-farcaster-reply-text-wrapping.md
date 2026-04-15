# Fix Log: 2026-04-15 Farcaster Reply Text Wrapping

## What Changed

- Changed Farcaster public reply formatting so model output no longer collapses
  every newline into a single space.
- Added line wrapping for long continuous text runs before byte truncation.
- Kept the existing UTF-8 byte-safe cast truncation behavior and fallback error
  text.
- Added focused tests for paragraph preservation, long unbroken text wrapping,
  and UTF-8-safe truncation.

## Why

Runtime testing showed Farcaster replies could look truncated in the client when
KIKO collapsed the entire assistant answer into one long line. This was
especially visible for text without spaces or paragraph breaks. The public reply
formatter should give the client normal wrap opportunities instead of relying on
client-specific overflow behavior.

## Product Rule

- Public Farcaster replies must stay short enough for normal cast compatibility.
- Do not collapse model paragraphs into one line.
- Long continuous text must be broken into displayable lines before byte
  truncation.
- The reply service still owns publication; the ingress worker owns formatting
  the assistant text into a public cast-safe reply.

## Verification

- `npx tsx --test src/services/farcaster-agent/farcasterIngressWorker.test.ts`
  passed.

## Document Provenance

- Source: Farcaster protocol discussion, external cast data / long casts
  - Kind: product doc
  - Retrieved: 2026-04-15
  - Applied To: keeping normal cast replies short and not relying on long-cast
    behavior
  - Verification: verified in docs
- Source: User runtime observation of Farcaster client truncating unbroken reply
  text
  - Kind: runtime observation
  - Retrieved: 2026-04-15
  - Applied To: preserving line breaks and inserting wrap points before
    publication
  - Verification: verified in code
- Source: Existing `trimCastText` implementation
  - Kind: repo code
  - Retrieved: 2026-04-15
  - Applied To: identifying whitespace collapse as the local formatting owner
  - Verification: verified in code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/owner-map/farcaster-neynar-webhook-ingress.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-farcaster-neynar-webhook-ingress.md
- /Users/almurat/KiKo/system-journal/conflicts.md
