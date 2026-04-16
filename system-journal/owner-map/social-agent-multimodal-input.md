# Social Agent Multimodal Input Owner Map

## Owners

- `kiko-api/src/jobs/chat/nodePromptAssembler.ts` owns the canonical
  current-turn message shape and provider/model gating for social images.
- `kiko-python/generation/schemas.py` owns preserving structured content through
  the generation API boundary.
- `kiko-python/llm_gateway/schemas.py` owns preserving structured content through
  the provider gateway boundary.
- `kiko-python/llm_gateway/adapters/openai_like.py` owns NVIDIA passthrough and
  xAI SDK-gateway selection.
- `kiko-python/grok/router.py` owns xAI SDK request construction, including
  `image(...)` content and image-request history storage policy.
- `kiko-python/grok/message_content.py` owns provider-neutral extraction of text
  and image URLs from structured message content.

## Boundaries

- Social webhook hydration owns collecting post/cast images and thread context,
  but not provider request formatting.
- Prompt assembly owns adding images only to the current user turn, not replayed
  history.
- Provider adapters own translating the canonical content list into the vendor
  API shape.
- Billing, model labels, and frontend display do not decide whether a provider
  has vision support.

## Document Provenance

- Source: repo inspection of Node chat assembly, Python generation gateway, and
  Grok SDK adapter
  - Kind: repo code
  - Retrieved: 2026-04-16
  - Applied To: owner boundaries for social-agent image inputs
  - Verification: verified in code
- Source: NVIDIA NIM moonshotai/kimi-k2.5 inference docs and xAI Image Understanding docs
  - Kind: official API doc
  - Retrieved: 2026-04-16
  - Applied To: provider adapter ownership
  - Verification: verified in docs and code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/social-agent-multimodal-input.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-kimi-grok-social-image-input.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-social-agent-thread-context-and-image-input.md
