# 2026-04-16 Kimi/Grok Social Image Input

## What Changed

- Social-agent current-turn image inputs now use true multimodal content for:
  - OpenAI GPT models
  - NVIDIA-hosted Kimi models
  - xAI Grok models
- NVIDIA GLM remains on labeled image-URL text fallback because the active GLM
  endpoint is not documented as image-capable in this repo.
- The Grok adapter now accepts structured message content, extracts text and
  image URLs, and appends xAI SDK `image(...)` content to user messages.
- xAI image requests now avoid `store_messages` and `previous_response_id`
  because xAI's image understanding docs advise not storing image request and
  response history on the server.
- The xAI gateway selection now forces image-bearing Grok requests through the
  Grok SDK adapter instead of the unverified direct chat-completions path.

## Why

The previous social-image repair only enabled OpenAI true image input and left
all non-OpenAI providers on text URL fallback. That was correct while Kimi/Grok
formats were unverified, but it left Kimi and Grok unable to actually inspect
post images even though their official docs support image understanding.

## Document Provenance

- Source: NVIDIA NIM moonshotai/kimi-k2.5 model docs
  - Kind: official API doc
  - Retrieved: 2026-04-16
  - Applied To: confirming Kimi K2.5 is multimodal and supports image input
  - Verification: verified in docs
- Source: NVIDIA NIM moonshotai/kimi-k2.5 inference docs
  - Kind: official API doc
  - Retrieved: 2026-04-16
  - Applied To: using chat/completions `content` object lists with `image_url`
    parts for Kimi user messages
  - Verification: verified in docs and code
- Source: xAI Image Understanding docs
  - Kind: official API doc
  - Retrieved: 2026-04-16
  - Applied To: converting structured image inputs to xAI SDK image content and
    disabling server-side stored history for image requests
  - Verification: verified in docs and code
- Source: repo inspection of `nodePromptAssembler.ts`,
  `llm_gateway/adapters/openai_like.py`, and `grok/router.py`
  - Kind: repo code
  - Retrieved: 2026-04-16
  - Applied To: confirming the old code only sent true image input on OpenAI
  - Verification: verified in code

## Verification

- `npm test -- src/jobs/chat/nodePromptAssembler.test.ts` passed.
- `PYTHONPATH=. python3 -m unittest tests.test_grok_message_content tests.test_llm_gateway_nvidia_model_resolution tests.test_llm_gateway_provider_request_id` passed.
- `python3 -m py_compile grok/router.py llm_gateway/adapters/openai_like.py grok/message_content.py generation/schemas.py llm_gateway/schemas.py` passed.
- Historical note: at the time, `npx tsc --noEmit` failed outside this change
  on `/Users/almurat/KiKo/kiko-api/src/jobs/chatWorker.ts:226` because
  `buildFastDirectAssistantResponse` was unresolved. That owner path was later
  moved into `chatV2TurnRunner.ts` and then removed on 2026-04-18.

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/social-agent-multimodal-input.md
- /Users/almurat/KiKo/system-journal/owner-map/social-agent-multimodal-input.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-social-agent-thread-context-and-image-input.md
