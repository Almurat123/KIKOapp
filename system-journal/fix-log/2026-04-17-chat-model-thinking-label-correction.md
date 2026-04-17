# 2026-04-17 Chat Model Thinking Label Correction

## What Changed

- Replaced the synthetic `Extra High` selector label with real `Fast` and
  `Thinking` labels in the chat model catalog.
- Added `glm-5-reasoning` as a real selectable alias for the GLM family so the
  selector can expose a genuine thinking variant instead of inventing one.
- Hid the reasoning selector for model families that only have one declared
  variant, so `GPT-5.4-Mini` no longer shows a fake second choice.
- Updated frontend cost lookup, backend allowlists, and quota pricing stubs to
  recognize the new real model ids.

## Why

OpenAI's GPT-5.4 docs do not define an `Extra High` label. The documented API
knob is `reasoning.effort`, with model-dependent values such as `none`, `low`,
`medium`, `high`, and `xhigh`. ChatGPT-facing naming is still Instant /
Thinking / Pro. The chat UI should therefore show real model variants and
truthful labels instead of synthesizing a fake extra tier.

## Product Rule

- Use `Fast` and `Thinking` for actual model variants.
- Do not show a reasoning selector when a family only has one declared
  variant.
- Do not invent a GPT-5.4 effort label in the selector unless the backend
  exposes a real effort knob.

## Verification

- Verified in code that the chat selector now hides the reasoning control for
  single-variant families.
- Verified in code that `glm-5-reasoning` is allowlisted in the backend and
  priced as a zero-cost NVIDIA alias.
- Verified `npm exec tsc --noEmit` in `kiko-web`.
- Verified `npm exec tsc --noEmit` in `kiko-api`.
- Verified `npm test -- src/services/billing/billingService.test.ts` in
  `kiko-api`.

## Document Provenance

- Source: OpenAI GPT-5.4 model page
  - Kind: official API doc
  - Retrieved: 2026-04-17
  - Applied To: confirming GPT-5.4 reasoning effort names are none/low/medium/high/xhigh
  - Verification: verified in docs
- Source: OpenAI latest model guide FAQ
  - Kind: official API doc
  - Retrieved: 2026-04-17
  - Applied To: using ChatGPT-facing Instant/Thinking terminology as the product mental model
  - Verification: verified in docs
- Source: /Users/almurat/KiKo/kiko-api/src/routes/ai.ts
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: confirming `glm-5-reasoning` is an actual backend-supported alias
  - Verification: verified in code
- Source: /Users/almurat/KiKo/kiko-web/src/components/Chat/chatConstants.ts
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: the visible selector labels and family grouping metadata
  - Verification: verified in code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-input-borderless-model-reasoning-selector.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-default-chat-model-switch-to-kimi-instant.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-nvidia-glm-kimi-provider-replacement.md
- /Users/almurat/KiKo/system-journal/conflicts.md

## Follow-up

- GPT-5.4 mini later narrowed to the product-visible `Low / Medium` subset in
  the borderless selector follow-up, so the family no longer shows `Fast`,
  `High`, or `Extra High` in the UI.
