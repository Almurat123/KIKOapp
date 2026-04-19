# 2026-04-18 NVIDIA Extra Body Flattening

## What Changed

- Flattened NVIDIA provider options that KiKo previously stored as SDK-style
  `extra_body` into the direct HTTP request body sent by
  `/Users/almurat/KiKo/kiko-python/llm_gateway/adapters/openai_like.py`.
- Added targeted coverage that `glm-5` sends top-level `chat_template_kwargs`
  and `kimi-k2-5-instant` sends top-level `thinking`, with no nested
  `extra_body` field in the raw HTTP payload.
- Expanded reasoning extraction to treat typed `reasoning_content` parts as
  reasoning instead of visible assistant text.

## Why

The local runtime log in `/Users/almurat/KiKo/test.txt` showed the Node stream
completed with `reasoningChunks=0` for `glm-5` even though the NVIDIA reasoning
path was expected to be enabled. The gateway was using `httpx` directly, but it
serialized OpenAI SDK examples literally as:

```json
{"extra_body": {"chat_template_kwargs": {"enable_thinking": true}}}
```

For direct HTTP calls, `extra_body` is not a provider API field. It is an SDK
escape hatch that merges additional keys into the outgoing body. Keeping it
nested can cause NVIDIA thinking/instant controls to be ignored before any
`delta_reasoning` can reach Node or the browser.

## Product Rule

- KiKo's Python gateway owns provider-specific request-body shaping.
- SDK helper parameters must not be copied literally into raw HTTP payloads.
- GLM/Kimi reasoning output must flow through the existing `delta_reasoning`
  event into Node and then `reasoning_content` on the frontend.
- Plain assistant text must not be duplicated into reasoning.

## Verification

- Verified from `/Users/almurat/KiKo/test.txt` that the failing live turn had
  `reasoningChunks=0` and only content chunks.
- Verified in code that NVIDIA request bodies now flatten provider-specific
  options before `_stream_sse(...)`.
- Verified with targeted Python tests for GLM request shaping, Kimi instant
  request shaping, and reasoning-content extraction.
- Not yet runtime-verified against a new live NVIDIA browser turn after the fix.

## Document Provenance

- Source: `/Users/almurat/KiKo/test.txt`
  - Kind: runtime observation
  - Retrieved: 2026-04-18
  - Applied To: identifying that Node received zero reasoning chunks for the
    GLM live turn.
  - Verification: verified in runtime log.
- Source: NVIDIA NIM reasoning model docs
  - Kind: official API doc
  - Retrieved: 2026-04-18
  - Applied To: treating `extra_body` as an SDK merge mechanism for
    `chat_template_kwargs`, not a literal raw HTTP field.
  - Verification: verified in docs and targeted tests.
- Source: NVIDIA NIM moonshotai/kimi-k2.5 model page
  - Kind: official API doc
  - Retrieved: 2026-04-18
  - Applied To: keeping Kimi thinking/instant request controls as provider
    fields in the outgoing body.
  - Verification: verified in docs and targeted tests.

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-glm-preserved-thinking-on-nvidia.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-nvidia-glm-kimi-provider-replacement.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-runtime-plan-visibility-and-nvidia-reasoning-restore.md
- /Users/almurat/KiKo/system-journal/conflicts.md
