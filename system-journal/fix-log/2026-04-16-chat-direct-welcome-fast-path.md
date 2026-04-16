# 2026-04-16 Chat Direct Welcome Fast Path

## What Changed

- Added the missing worker-level direct response builder for deterministic
  greeting and assistant-introduction turns.
- Kept those turns inside the normal broker, moderation, completion, task, and
  billing lifecycle, but bypassed the slow provider generation call.
- Updated canonical normalizer tests so GLM aliases map to the fast NVIDIA Kimi
  instant normalizer instead of falling back to GLM for hidden routing work.

## Why

Runtime trace `5be7a239-eda6-4ef7-a8ea-7fb4b1160de3` showed a simple
`Hi, who are you?` request using `glm-5` spent about 19 seconds in hidden
normalization and about 68 seconds in the main GLM generation. The request was
deterministic product-copy behavior, not a task requiring tools or on-chain
evidence.

The worker already had the fast-path call site, but the response builder was
missing. That meant the intended shortcut could not compile or run.

## Product Rule

- Greetings and assistant-introduction questions should not invoke slow
  reasoning providers.
- Direct fast-path answers must still complete through normal output moderation
  and task lifecycle handling.
- Real wallet, token, swap, risk, copy-trade, PnL, or price requests must not be
  swallowed by the welcome fast path.

## Verification

- Verified with TypeScript diagnostics that `buildFastDirectAssistantResponse`
  was missing from `chatWorker.ts`.
- Added a canonical normalizer test that proves `Hi, who are you?` does not call
  the model.
- Updated the normalizer model test to keep GLM normalization on
  `kimi-k2-5-instant`.

## Document Provenance

- Source: local runtime log trace `5be7a239-eda6-4ef7-a8ea-7fb4b1160de3`
  - Kind: runtime observation
  - Retrieved: 2026-04-16
  - Applied To: bypassing hidden GLM normalization and main GLM generation for deterministic welcome turns
  - Verification: verified in runtime log and code
- Source: `kiko-api/src/jobs/chatWorker.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-16
  - Applied To: implementing missing direct response builder
  - Verification: verified in code
- Source: `kiko-api/src/jobs/chat/canonicalIntentNormalizer.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-16
  - Applied To: enforcing fast hidden normalization for GLM aliases
  - Verification: verified in tests

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-canonical-intent-fast-normalizer.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-direct-answer-tool-pruning.md
- /Users/almurat/KiKo/system-journal/conflicts.md
