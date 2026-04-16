# 2026-04-16 Canonical Intent Fast Normalizer

## What Changed

- Changed canonical intent normalization to stop inheriting slow reasoning-capable
  chat models by default.
- Added model fallback mapping so normalization prefers the paired fast
  non-reasoning variant when the selected chat model is a reasoning model.
- Kept `CANONICAL_INTENT_NORMALIZER_MODEL` as the explicit override for operators
  who want a different normalizer.

## Why

Runtime logs showed trivial assistant-meta turns such as `你好` spending more than
60 seconds inside the hidden normalization phase before the visible answer was
generated. The normalization request emitted `reasoning_delta`, but that channel
is intentionally discarded because normalization is an internal routing step, not
user-facing reasoning.

That produced two bad effects:

- users waited on hidden reasoning that was never shown
- the final assistant message could appear to have no reasoning even though the
  model had already spent time producing hidden normalization reasoning

## Product Rule

- Canonical intent normalization is an internal routing step and should optimize
  for low latency, not rich hidden reasoning.
- Hidden normalization reasoning must not delay trivial visible replies when a
  compatible fast non-reasoning model exists.
- Operator overrides still win when `CANONICAL_INTENT_NORMALIZER_MODEL` is set.

## Verification

- Verified in `/Users/almurat/KiKo/test.txt` that trace
  `61046237-c11c-4ab1-b16b-8ca406a9b6e5` spent about `62788ms` in
  `taskId=:normalize` before returning a simple welcome reply.
- Verified in code that normalization currently ignores `onReasoningDelta`.
- Verified in tests that reasoning variants now resolve to fast non-reasoning
  counterparts by default.

## Document Provenance

- Source: `/Users/almurat/KiKo/test.txt`
  - Kind: runtime observation
  - Retrieved: 2026-04-16
  - Applied To: identifying normalization latency and hidden reasoning discard
  - Verification: verified in runtime
- Source: `kiko-api/src/jobs/chat/canonicalIntentNormalizer.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-16
  - Applied To: changing normalization model selection defaults
  - Verification: verified in code
- Source: `kiko-api/src/jobs/chat/canonicalIntentNormalizer.test.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-16
  - Applied To: locking the new model mapping behavior
  - Verification: verified in tests

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-farcaster-agent-mode-prompt.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-reasoning-channel-duplication-guard.md
- /Users/almurat/KiKo/system-journal/conflicts.md
