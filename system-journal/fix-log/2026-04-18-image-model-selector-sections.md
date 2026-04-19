# 2026-04-18 Image Model Selector Sections

## What Changed

- Split the shared chat model picker menu into `Text` and `Image` sections.
- Added frontend image-generation model families:
  - `gpt-image-1.5`
  - `grok-imagine-image`
- Exposed `gpt-image-1.5` image quality as `Low / Medium / High` using the same
  inline second-selector footprint as text reasoning.
- Exposed Grok image quality as `Normal / Pro`, mapping those choices to
  `grok-imagine-image` and `grok-imagine-image-pro`.
- Kept generated-image selections in local picker state and out of the
  authenticated `defaultChatModel` setting, which still owns text-chat defaults.

## Why

The model picker now has to serve two model modalities before the generated
image runtime is fully wired. Mixing image models into the same flat text-model
list would make the second selector ambiguous and could accidentally persist an
image model into the backend chat default. The UI should show the image options
now, but preserve the existing chat default boundary.

## Product Rule

- Text models and image models must be visually separated in the model menu.
- The second inline selector is contextual:
  - text families: reasoning / thinking strength
  - image families: generation quality
- OpenAI image quality is `Low / Medium / High`.
- Grok image quality is `Normal / Pro`.
- Remote user settings must keep storing only text chat model defaults until the
  generated-image runtime owns its own settings contract.

## Verification

- Verified in code that `ChatModelSelector` renders separate `Text` and `Image`
  sections.
- Verified in code that OpenAI image quality hydrates through local storage via
  `imageQuality` or the legacy `reasoningLevel` slot.
- Verified in code that Grok `Normal / Pro` maps to the two real model ids.
- Verified in code that `ChatInterface` and `WelcomeScreen` do not save image
  model selections to `defaultChatModel`.
- Verified `npm exec tsc --noEmit --pretty false` in `kiko-web`.

## Document Provenance

- Source: OpenAI GPT Image 1.5 model page
  - Kind: official API doc
  - Retrieved: 2026-04-18
  - Applied To: using `gpt-image-1.5` as the OpenAI image model id
  - Verification: verified in docs
- Source: OpenAI Image Generation Guide, Customize Image Output
  - Kind: official API doc
  - Retrieved: 2026-04-18
  - Applied To: exposing `quality` as low/medium/high in the image selector
  - Verification: verified in docs
- Source: xAI Grok Imagine Image model page
  - Kind: official API doc
  - Retrieved: 2026-04-18
  - Applied To: exposing `grok-imagine-image` as Grok normal image generation
  - Verification: verified in docs
- Source: xAI Grok Imagine Image Pro model page
  - Kind: official API doc
  - Retrieved: 2026-04-18
  - Applied To: exposing `grok-imagine-image-pro` as Grok pro image generation
  - Verification: verified in docs
- Source: `/Users/almurat/KiKo/kiko-web/src/components/Chat/chatConstants.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-18
  - Applied To: model family and quality metadata
  - Verification: verified in code
- Source: `/Users/almurat/KiKo/kiko-web/src/components/Chat/ChatModelSelector.tsx`
  - Kind: repo doc
  - Retrieved: 2026-04-18
  - Applied To: selector section rendering and contextual second control
  - Verification: verified in code
- Source: `/Users/almurat/KiKo/kiko-web/src/components/Chat/ChatInterface.tsx`
  - Kind: repo doc
  - Retrieved: 2026-04-18
  - Applied To: local-only persistence for generated-image selections
  - Verification: verified in code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-input-borderless-model-reasoning-selector.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-model-thinking-label-correction.md
- /Users/almurat/KiKo/system-journal/design-language/generated-image-safety.md
- /Users/almurat/KiKo/system-journal/owner-map/generated-image-safety.md
