# 2026-04-16 Farcaster Reply Sentence Reflow

## Summary

The earlier Farcaster formatter fixes stopped word-breaking and markdown leakage,
but normal multi-sentence replies could still publish as one dense paragraph.
Compared with other Farcaster bots, the result read too much like copied chat
output and not enough like a native in-thread social reply.

## What Changed

- Updated `farcasterCastText.ts` to reflow long sentence-heavy replies into
  short paragraph groups before publication.
- The formatter now:
  - keeps existing paragraph boundaries
  - splits long prose into sentence groups
  - limits each published paragraph to a small sentence/count budget
  - still only hard-wraps continuous no-space text when needed for client rendering

## Why

Farcaster readability is mostly about paragraph rhythm, not markdown. One dense
block looks wrong even when the content is correct. This owner already controls
publication-surface formatting, so sentence-aware paragraph reflow belongs here.

## Document Provenance

- Source: runtime comparison against other Farcaster bot replies and local
  screenshot of a dense single-block KiKo reply
- Kind: runtime observation
- Retrieved: 2026-04-16
- Applied To: sentence-aware paragraph reflow before cast publication
- Verification: verified in code and targeted tests

## Verification

- Added targeted test coverage that a long three-sentence wallet PnL reply is
  split into multiple short cast paragraphs

## Owner Boundaries

- Model prompting may encourage concise style, but `farcasterCastText.ts` owns
  the final publication-surface reflow.
- This change does not alter semantic content, only cast readability.
