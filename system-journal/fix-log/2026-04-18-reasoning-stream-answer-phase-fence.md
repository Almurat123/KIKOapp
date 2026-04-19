# Fix Log: 2026-04-18 Reasoning Stream Answer-Phase Fence

## Summary

The chat v2 generation stream now freezes user-visible reasoning once visible
assistant answer text starts. This prevents NVIDIA/Kimi/GLM turns from
continuing to append reasoning after the final answer is already on screen.

## Why This Changed

Runtime verification on 2026-04-18 showed two regressions in the current
provider mix:

1. NVIDIA-hosted Kimi Instant could still emit `reasoning` fields even when the
   request disabled thinking.
2. Some provider turns emitted content and reasoning in the same raw provider
   chunk, or continued reasoning after content had already started.

The previous Node stream owner forwarded every reasoning delta until
`message_complete`, so the frontend kept growing the thinking panel after the
answer appeared. That made the answer feel duplicated and prolonged the
streaming interaction even though the user-visible answer was already done.

## Correctness Rule

- User-visible reasoning is a pre-answer stream.
- Once visible assistant content starts, later reasoning must not continue to
  stream to the user for that message.
- The generation client may still accumulate raw reasoning internally for final
  result accounting, but the visible stream must honor the answer-phase fence.
- If a provider turn yields content and reasoning back-to-back from the same raw
  chunk, content wins for the user-visible stream.

This matches the DeepSeek reasoning streaming example, which treats each chunk
as either `reasoning_content` or `content` when building the visible stream.

## Owner Layer

- Owner file: `/Users/almurat/KiKo/kiko-api/src/jobs/chat/pythonGenerationClient.ts`
- Reason: this is the first Node owner that sees ordered generation SSE events
  before they enter the broker and frontend.

## What Was Changed

- Added a `visibleAnswerStarted` fence in `pythonGenerationClient.ts`.
- The client now stops forwarding `reasoning_delta` to downstream visible
  callbacks after the first forwarded `assistant_delta`.
- Added regression tests for:
  - reasoning first, then answer, then late reasoning
  - answer first, then same-turn reasoning

## Document Provenance

- Source: DeepSeek reasoning model streaming example
- Kind: official API doc
- Retrieved: 2026-04-18
- Applied To: enforcing a reasoning-then-content visible stream boundary
- Verification: verified in docs and tests

- Source: NVIDIA Kimi K2.5 model page
- Kind: official API doc
- Retrieved: 2026-04-18
- Applied To: confirming Instant/Thinking are distinct provider intents while
  still requiring local stream fencing because observed runtime ordering did not
  reliably suppress reasoning
- Verification: verified in docs and runtime

- Source: direct runtime probes against NVIDIA official API and local
  llm-gateway on 2026-04-18
- Kind: runtime observation
- Retrieved: 2026-04-18
- Applied To: reproducing post-answer reasoning deltas and same-turn
  content-plus-reasoning behavior
- Verification: verified in runtime
