# 2026-04-16 Farcaster Reply Plain Text Sanitizer

## Summary

Published Farcaster replies were carrying markdown emphasis markers such as
`**bold**` and inline code backticks literally into the public cast. Farcaster
does not render that markdown the way a chat UI does, so the reply looked
mechanical and visually wrong.

## What Changed

- Added markdown-decoration stripping in `farcasterCastText.ts` before
  whitespace normalization and byte-safe truncation.
- The formatter now converts these constructs to plain social text:
  - `**bold**`
  - `__bold__`
  - `` `inline code` ``
  - markdown links `[label](url)` -> `label`

## Why

This owner already formats assistant output for Farcaster-specific readability.
Removing markdown-only decoration belongs in the same layer because the problem
is surface rendering, not model reasoning.

## Document Provenance

- Source: runtime screenshot of a published Farcaster reply showing literal
  `**+$592.05 realized**`
- Kind: runtime observation
- Retrieved: 2026-04-16
- Applied To: plain-text sanitization before public cast publication
- Verification: verified in runtime observation, code, and targeted tests

## Verification

- Added targeted test coverage that `trimCastText()` strips markdown emphasis
  while preserving the underlying numeric content

## Owner Boundaries

- `nodePromptAssembler.ts` and runtime directives influence style at generation
  time.
- `farcasterCastText.ts` owns the final publication-surface sanitization.
- `farcasterApiClient.ts` only publishes the final text; it does not normalize
  markdown itself.
