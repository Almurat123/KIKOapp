# Social Agent Multimodal Input

## Canonical Rules

- Social webhook text and image evidence must enter the model through a
  current-turn `socialInput` envelope, not by mutating persisted chat history.
- The canonical upstream message shape is an OpenAI-compatible user `content`
  list with one `text` part followed by `image_url` parts.
- Provider adapters may transform that canonical shape at the boundary, but
  they must not stringify image URLs into prompt text when the provider has a
  verified image input path.
- NVIDIA GLM stays on text fallback until the active endpoint documents image
  input. Kimi may receive `image_url` content lists through NVIDIA
  chat/completions.
- xAI Grok may receive the canonical upstream shape from Node, but Python must
  convert it to xAI SDK image content and avoid server-side stored history for
  image requests.

## Forbidden Local Patch Patterns

- Do not add image URLs only to `[USER_QUERY]` and call that vision support.
- Do not replay social images through stored historical assistant/user turns.
- Do not enable GLM images just because it shares the NVIDIA provider family.
- Do not bypass the Grok SDK adapter for image turns unless the direct xAI API
  path has been verified and documented in this repository.

## Document Provenance

- Source: NVIDIA NIM moonshotai/kimi-k2.5 model and inference docs
  - Kind: official API doc
  - Retrieved: 2026-04-16
  - Applied To: Kimi image enablement and GLM exclusion
  - Verification: verified in docs and code
- Source: xAI Image Understanding docs
  - Kind: official API doc
  - Retrieved: 2026-04-16
  - Applied To: Grok SDK image conversion and no server-side history for image turns
  - Verification: verified in docs and code
- Source: OpenAI Images and Vision / Chat Completions docs
  - Kind: official API doc
  - Retrieved: 2026-04-16
  - Applied To: canonical upstream `text` + `image_url` shape
  - Verification: verified in docs and code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/owner-map/social-agent-multimodal-input.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-kimi-grok-social-image-input.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-social-agent-thread-context-and-image-input.md
