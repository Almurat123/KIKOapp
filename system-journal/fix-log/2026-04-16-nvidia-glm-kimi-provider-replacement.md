# 2026-04-16 NVIDIA GLM/Kimi Provider Replacement

## What Changed

- Replaced the old DeepSeek-compatible gateway path with an NVIDIA-hosted
  OpenAI-compatible provider path for normal-model traffic.
- Switched prompt assembly and Node context rendering to use `nvidia` as the
  active normal-model family label while keeping `deepseek` only as a legacy
  compatibility value for older workers.
- Added normalized model ids for:
  - `glm-5`
  - `kimi-k2-5-reasoning`
  - `kimi-k2-5-instant`
- Mapped Kimi mode aliases onto one upstream model
  `moonshotai/kimi-k2.5` with official NVIDIA-hosted API request semantics.
- Mapped `glm-5` onto upstream NVIDIA model `z-ai/glm5`.
- Extended reasoning streaming normalization so NVIDIA reasoning deltas flow
  through the existing internal `delta_reasoning` / `reasoning_content`
  contract already used by KiKo orchestration.
- Updated backend and frontend model allowlists so new sessions no longer offer
  `deepseek-chat` or `deepseek-reasoner`.
- Updated quota/billing allowlists to classify GLM/Kimi as free-model traffic
  after the DeepSeek removal.

## Why

The product owner requested removing DeepSeek from the active model lineup and
replacing it with NVIDIA-hosted GLM and Kimi. The existing KiKo architecture
already depended on an OpenAI-compatible stream contract and an internal
reasoning side-channel. The correct owner-level fix was therefore to replace
the provider family at the gateway and model-catalog boundaries instead of
forking the orchestration protocol.

## Product Rule

- GLM and Kimi are the active free-model alternatives in the shared chat model
  catalog.
- Kimi mode selection is a product-level alias:
  - `kimi-k2-5-reasoning` -> hosted API thinking mode (no disable flag)
  - `kimi-k2-5-instant` -> hosted API instant mode via `extra_body.thinking.type=disabled`
- GLM/Kimi reasoning output must reuse the existing internal reasoning stream
  contract. Downstream code should not branch on provider brand to render
  reasoning.
- Removed DeepSeek ids must not remain the default fallback for new sessions or
  empty-model routing.
- Prompt and context owner layers must use `nvidia` for the active normal-model
  family so future maintenance does not accidentally preserve retired DeepSeek
  assumptions.

## Verification

- Verified in code that the Python LLM gateway now routes non-OpenAI,
  non-Grok traffic to NVIDIA instead of DeepSeek.
- Verified in code that Kimi now uses NVIDIA's documented hosted model id
  `moonshotai/kimi-k2.5` instead of the incorrect hyphenated variant that
  produced HTTP 404 responses.
- Verified in code that Kimi instant mode now uses the official hosted API
  disable-thinking payload instead of the self-hosted vLLM-only flag shape.
- Verified in code that Node provider classification now labels GLM/Kimi as
  `nvidia`.
- Verified in code that prompt assembly and Node token-context blocks now use
  `nvidia` as the active normal-model family label.
- Verified in code that `glm-5` and Kimi aliases are present in backend and
  frontend allowlists.
- Verified in code that stored reasoning content is preserved for GLM/Kimi
  reasoning-capable models through the same internal fields used previously for
  reasoning models, including final-message reasoning fields and typed content
  parts emitted by NVIDIA-hosted responses.

## Document Provenance

- Source: NVIDIA NIM model page for `moonshotai/kimi-k2-5`
  - Kind: official API doc
  - Retrieved: 2026-04-16
  - Applied To: Kimi upstream model id and hosted instant-mode request shape
  - Verification: verified in code
- Source: NVIDIA NIM model page for `z-ai/glm5`
  - Kind: official API doc
  - Retrieved: 2026-04-16
  - Applied To: GLM upstream model id and reasoning-capable stream handling
  - Verification: verified in code
- Source: repo code in `kiko-python/llm_gateway`, `kiko-api/src/jobs/chat`,
  and `kiko-web/src/components/Chat`
  - Kind: repo doc
  - Retrieved: 2026-04-16
  - Applied To: replacing DeepSeek defaults and allowlists with NVIDIA GLM/Kimi
  - Verification: verified in code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-default-chat-model-switch-to-gpt.md
- /Users/almurat/KiKo/system-journal/conflicts.md
