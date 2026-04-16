# 2026-04-16 GLM Preserved Thinking On NVIDIA

## What Changed

- Updated the NVIDIA OpenAI-compatible gateway path so `glm-5` aliases now send
  preserved-thinking request config.
- Kept the existing reasoning extraction logic, but stopped relying on hosted
  runtime defaults for whether GLM thinking traces are retained in streamed
  output.

## Why

Runtime logs showed `glm-5` turns producing only visible assistant text while
 KiKo received no `reasoning_delta` events. Official GLM docs indicate that the
 model family supports reasoning/thinking, and NVIDIA's GLM deployment guidance
 for the same Z.ai family documents preserved-thinking request flags for agentic
 use cases.

Without explicit preserved-thinking config, KiKo may receive the final answer
text but no visible reasoning trace even when the model reasons internally.

## Product Rule

- If KiKo exposes a GLM reasoning-capable model in chat, the gateway must ask
  the provider to preserve the reasoning trace instead of assuming hosted
  defaults.
- Provider reasoning stays optional at runtime, but missing reasoning must no
  longer be caused by KiKo omitting the preserved-thinking request config.

## Verification

- Verified in `/Users/almurat/KiKo/test.txt` that `glm-5` sessions emitted
  `assistant_delta` and final text, but no `reasoning_delta`.
- Verified in code that `_resolve_nvidia_model` previously sent no GLM
  thinking/preserved-thinking config.
- Verified in tests that `glm-5` now resolves to `z-ai/glm5` with
  `chat_template_kwargs.enable_thinking=true` and `clear_thinking=false`.

## Document Provenance

- Source: NVIDIA GLM-4.7 model reference
  - Kind: official API doc
  - Retrieved: 2026-04-16
  - Applied To: preserved-thinking request config for NVIDIA-hosted GLM
  - Verification: verified in docs and code
- Source: Z.AI GLM-5 API guide
  - Kind: official API doc
  - Retrieved: 2026-04-16
  - Applied To: confirming GLM-5 supports a reasoning/thinking mode contract
  - Verification: verified in docs, partially inferred for NVIDIA-hosted path
- Source: `/Users/almurat/KiKo/test.txt`
  - Kind: runtime observation
  - Retrieved: 2026-04-16
  - Applied To: identifying missing `reasoning_delta` on `glm-5`
  - Verification: verified in runtime

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-nvidia-glm-kimi-provider-replacement.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-reasoning-channel-duplication-guard.md
- /Users/almurat/KiKo/system-journal/conflicts.md
