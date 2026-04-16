# 2026-04-16 Reasoning Channel Duplication Guard

## What Changed

- Tightened reasoning extraction in the Python LLM gateway so plain assistant
  `content` strings are no longer emitted as `delta_reasoning`.
- Applied the same guard to the direct backend proxy route to keep fallback
  behavior aligned with the main gateway.
- Added a regression test covering:
  - plain assistant content must not become reasoning
  - typed `reasoning` content parts still flow into reasoning
  - explicit `reasoning_content` strings still flow into reasoning

## Why

The earlier NVIDIA/GLM/Kimi compatibility patch broadened reasoning extraction
to inspect `delta.content` for typed reasoning parts. That was correct for
providers that encode reasoning as structured content parts, but the helper also
accepted raw strings. As a result, normal assistant text was duplicated into the
reasoning surface and the final answer surface for reasoning-capable turns.

## Product Rule

- Only explicit reasoning fields or typed reasoning/thinking content parts may
  enter the reasoning channel.
- Plain assistant text belongs only to the assistant content channel.
- The direct route and Python gateway must enforce the same channel split.

## Verification

- Verified in `test.txt` and screenshots that duplicated visible content was
  being rendered into both reasoning and assistant surfaces.
- Verified in code that `delta.content` strings previously flowed through
  reasoning extraction.
- Verified in tests that plain assistant content no longer becomes reasoning,
  while typed reasoning parts and explicit reasoning fields still do.

## Document Provenance

- Source: `/Users/almurat/KiKo/test.txt`
  - Kind: runtime observation
  - Retrieved: 2026-04-16
  - Applied To: identifying the duplicated reasoning/assistant output regression
  - Verification: partially verified
- Source: `/Users/almurat/Desktop/截屏2026-04-16 12.39.59.png`
  - Kind: runtime observation
  - Retrieved: 2026-04-16
  - Applied To: confirming duplicated mixed rendering in the chat UI
  - Verification: partially verified
- Source: `kiko-python/llm_gateway/adapters/openai_like.py` and `kiko-api/src/routes/ai.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-16
  - Applied To: tightening reasoning extraction ownership at the backend boundary
  - Verification: verified in code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-nvidia-glm-kimi-provider-replacement.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-runtime-plan-card-reasoning-separation.md
- /Users/almurat/KiKo/system-journal/conflicts.md
