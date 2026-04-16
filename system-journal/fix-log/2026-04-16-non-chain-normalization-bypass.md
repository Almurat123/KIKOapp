# 2026-04-16 Non-Chain Normalization Bypass

## What Changed

- Added a deterministic worker/orchestrator bypass for obvious non-chain chat
  turns.
- Those turns now skip canonical intent normalization entirely instead of
  entering the heavy JSON routing prompt.
- Recorded the bypass as explicit normalization state so downstream owners know
  the turn was intentionally routed without canonical intent.

## Why

`/Users/almurat/KiKo/test.txt` showed a simple off-domain question,
`你好，量子纠缠是什么？`, spending almost all latency inside
`taskId=:normalize`, while the final visible answer was short and cheap.

That meant the system was doing the wrong work:

- first forcing a non-chain question through a crypto-oriented canonical schema
- then spending hidden reasoning budget on how to classify it
- only afterwards producing a small general answer

The user requirement was explicit: non-chain questions should not go through the
canonical intent router.

## Product Rule

- Obvious non-chain questions must bypass canonical intent normalization.
- Welcome/greeting/product-copy fast paths remain allowed, but they are separate
  from this non-chain bypass rule.
- Token, wallet, swap, copy-trade, social, market, and other product-domain
  turns must still go through the normal routing path.
- The bypass must be explicit state, not implicit worker memory, so later owner
  layers can avoid re-normalizing the same turn.

## Owner Boundaries

- `chatWorker.ts` owns the first decision to skip canonical normalization for a
  deterministic non-chain turn.
- `nodeOrchestrator.ts` must respect that bypass and must not re-run canonical
  normalization later in the same request.
- `canonicalIntentNormalizer.ts` owns the deterministic bypass predicate for
  obvious non-chain turns.
- `canonicalIntent.ts` owns the persisted shape of normalization state,
  including the deterministic bypass marker.

## Verification

- Verified in `/Users/almurat/KiKo/test.txt` that the off-domain question spent
  roughly 95 seconds in `:normalize` before producing a short answer.
- Added targeted tests proving:
  - obvious non-chain questions bypass normalization without calling the model
  - token-domain questions still call the normalization model

## Document Provenance

- Source: `/Users/almurat/KiKo/test.txt`
  - Kind: runtime observation
  - Retrieved: 2026-04-16
  - Applied To: proving obvious non-chain questions were incorrectly entering canonical normalization
  - Verification: verified in runtime log
- Source: user directive in Codex thread on 2026-04-16
  - Kind: product requirement
  - Retrieved: 2026-04-16
  - Applied To: enforcing that non-chain questions must not go through the canonical router
  - Verification: verified from user instruction
- Source: `kiko-api/src/jobs/chatWorker.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-16
  - Applied To: worker-level bypass before canonical normalization
  - Verification: verified in code
- Source: `kiko-api/src/jobs/chat/nodeOrchestrator.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-16
  - Applied To: preventing re-normalization after the worker-level bypass
  - Verification: verified in code
- Source: `kiko-api/src/jobs/chat/canonicalIntentNormalizer.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-16
  - Applied To: centralizing the deterministic non-chain bypass predicate
  - Verification: verified in code and tests

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-direct-welcome-fast-path.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-canonical-intent-fast-normalizer.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-normalization-reasoning-runtime-surface.md
- /Users/almurat/KiKo/system-journal/conflicts.md
