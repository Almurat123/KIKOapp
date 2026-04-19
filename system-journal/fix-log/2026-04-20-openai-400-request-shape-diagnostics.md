# Fix Log: 2026-04-20 OpenAI 400 Request Shape Diagnostics And Guard

## Summary

OpenAI returned HTTP 400 for a GPT-5.4-mini chat/completions request, but the production logs only showed `raw_len=267`. That was not enough to honestly identify the rejected field.

This change does not alter KiKo intent routing or model-led tool exposure. It adds provider-safe diagnostics around the OpenAI request shape and downstream provider error body:

- request keys
- message count
- tool count
- first tool names
- reasoning parameter shape
- total tool schema bytes
- invalid tool names
- tool descriptions longer than 1024 characters
- non-object tool parameters
- truncated raw provider error excerpt

Prompt text, image URLs, secrets, and full tool schemas are intentionally not logged.

After the diagnostics landed, `/Users/almurat/KiKo/test.txt` captured the raw OpenAI error:

`Function tools with reasoning_effort are not supported for gpt-5.4-mini-2026-03-17 in /v1/chat/completions. Please use /v1/responses instead.`

The immediate production guard now omits `reasoning_effort` only for GPT-5.4 chat/completions requests that include function tools. It preserves the existing model-led tool exposure and does not change intent routing.

## Current Evidence

From `/Users/almurat/Downloads/logs.1776615188393.json`:

- `messageCount=2`
- `toolCount=78`
- model `gpt-5.4-mini-2026-03-17`
- OpenAI returned HTTP 400
- no leaked empty assistant placeholder was present in `recentMessages`
- the raw OpenAI error body was not logged

Local schema inspection also found overlong tool descriptions in the current 78-tool catalog. That is a suspect, not a final root cause until the raw OpenAI error is captured.

`/Users/almurat/KiKo/test.txt` resolved the final root cause: the rejected field was `reasoning_effort` combined with function tools on GPT-5.4 chat/completions.

## Changed Owners

- `/Users/almurat/KiKo/kiko-python/llm_gateway/adapters/openai_like.py`
  - Logs safe OpenAI request-shape summaries before sending provider requests.
  - Emits warnings when local tool schema fields are likely provider-unsafe.
  - Omits `reasoning_effort` for GPT-5.4 chat/completions requests that include function tools.
- `/Users/almurat/KiKo/kiko-python/generation/app.py`
  - Logs a truncated raw provider error excerpt for gateway errors.

## Document Provenance

- Source: `/Users/almurat/Downloads/logs.1776615188393.json`
  - Kind: runtime observation
  - Retrieved: 2026-04-20
  - Applied To: adding OpenAI request-shape diagnostics for opaque HTTP 400 failures
  - Verification: verified in runtime logs and code
- Source: OpenAI Chat Completions API reference
  - Kind: official API doc
  - Retrieved: 2026-04-20
  - Applied To: confirming Chat Completions supports tools, so diagnostics should inspect request shape rather than changing tool exposure policy
  - Verification: verified in docs
- Source: OpenAI GPT-5.4 latest-model guide
  - Kind: official API doc
  - Retrieved: 2026-04-20
  - Applied To: logging reasoning parameter shape for GPT-5.4 request compatibility checks
  - Verification: verified in docs
- Source: `/Users/almurat/KiKo/test.txt`
  - Kind: runtime observation
  - Retrieved: 2026-04-20
  - Applied To: omitting `reasoning_effort` when GPT-5.4 chat/completions requests include function tools
  - Verification: verified from raw OpenAI error excerpt and local unit tests

## Verification

- `cd /Users/almurat/KiKo/kiko-python && python3 -m unittest tests.test_llm_gateway_openai_request_diagnostics`
- `cd /Users/almurat/KiKo/kiko-python && python3 -m py_compile llm_gateway/adapters/openai_like.py generation/app.py`
- A live OpenAI request was not run because the local shell did not have `OPENAI_API_KEY`.
