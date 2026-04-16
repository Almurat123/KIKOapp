# 2026-04-16 Normalization Reasoning Runtime Surface

## What Changed

- Added explicit `reasoningText` to canonical intent normalization state so the
  routing-phase reasoning can be inspected and streamed.
- Added an optional `onReasoningDelta` callback to
  `/Users/almurat/KiKo/kiko-api/src/jobs/chat/canonicalIntentNormalizer.ts`.
- Wired `/Users/almurat/KiKo/kiko-api/src/jobs/chatWorker.ts` to forward
  normalization reasoning into the normal assistant reasoning surface by
  default.
- Added a short phase label so users can tell the app is still analyzing the
  request before the final answer starts.

## Why

Runtime logs in `/Users/almurat/KiKo/test.txt` showed that trivial greeting and
assistant-meta turns could still spend a large number of tokens inside the
hidden `:normalize` phase. When that reasoning was discarded, the chat UI looked
stalled even though the provider was actively generating tokens.

The product rule changed here: runtime feedback matters more than hiding the
router's intermediate thought process. If the provider emits reasoning during
normalization, the user should see activity instead of waiting on a blank
surface.

## Product Rule

- Canonical intent normalization remains a routing step, but its reasoning may
  be surfaced through the same reasoning UI used by the assistant.
- Runtime feedback takes precedence over a silent wait when provider reasoning
  is already available.
- `CHAT_EXPOSE_NORMALIZATION_REASONING` stays as an escape hatch, but the
  default is enabled.

## Verification

- Verified in code that `normalizeCanonicalIntent` now captures both streamed
  reasoning deltas and final `result.reasoning`.
- Verified in tests that normalization reasoning can be forwarded through the
  new callback and preserved on `state.reasoningText`.
- Verified in repository code that NVIDIA Kimi instant aliases already map to
  `extra_body={"thinking":{"type":"disabled"}}` in
  `/Users/almurat/KiKo/kiko-python/llm_gateway/adapters/openai_like.py`.

## Document Provenance

- Source: `/Users/almurat/KiKo/test.txt`
  - Kind: runtime observation
  - Retrieved: 2026-04-16
  - Applied To: surfacing hidden normalization reasoning as user-visible
    runtime feedback
  - Verification: verified in runtime and code
- Source: NVIDIA NIM `moonshotai/kimi-k2.5` hosted inference docs
  - Kind: official API doc
  - Retrieved: 2026-04-16
  - Applied To: confirming instant-mode requests should disable thinking when
    the product explicitly wants no reasoning stream
  - Verification: verified in docs and mirrored in repo gateway code
- Source: `/Users/almurat/KiKo/kiko-python/llm_gateway/adapters/openai_like.py`
  - Kind: repo doc
  - Retrieved: 2026-04-16
  - Applied To: confirming the hosted Kimi instant alias already sends
    `thinking.type=disabled`
  - Verification: verified in code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-canonical-intent-fast-normalizer.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-stream-diagnostics.md
- /Users/almurat/KiKo/system-journal/conflicts.md
