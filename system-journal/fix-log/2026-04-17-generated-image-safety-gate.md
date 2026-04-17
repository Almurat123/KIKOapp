# 2026-04-17 Generated Image Safety Gate

## What Changed

- Added a strict `/moderation/image-generation` Python endpoint that accepts
  text and image URLs and calls OpenAI `omni-moderation-latest`.
- Added `moderateGeneratedImage()` to the Node moderation client with
  fail-closed fallback semantics.
- Added `kiko-api/src/services/generatedImageSafety.ts` as the generated-image
  owner for prompt, reference-input, generated-output, and publish safety gates.
- Left ordinary chat worker moderation call sites unchanged.

## Why

Generated-image outputs can become durable public Farcaster assets. They need a
stricter safety policy than ordinary chat, but that strict policy should not
pollute normal chat behavior or add broad product friction.

## Runtime Contract

1. Before image provider invocation, call `assertGeneratedImagePromptSafe()`.
2. Before image edit/reference use, call `assertGeneratedImageReferenceInputSafe()`.
3. After provider output and before public promotion, call
   `assertGeneratedImageOutputSafe()` with the private/quarantined image URL.
4. Immediately before Farcaster publication, call
   `assertGeneratedImagePublishSafe()` with the cast text and public image URL.
5. Treat moderation errors, timeouts, empty payloads, or `safe=false` as blocked.

## Boundaries

- This change does not remove or rewire ordinary chat text moderation.
- This change does not call image generation providers.
- This change does not publish Farcaster embeds.
- This change establishes the strict safety owner that those future generated
  image flows must call.

## Document Provenance

- Source: OpenAI Moderation guide
  - Kind: official API doc
  - Retrieved: 2026-04-17
  - Applied To: moderation of text and image inputs with `omni-moderation-latest`
  - Verification: verified in docs and code
- Source: OpenAI Moderations API OpenAPI spec
  - Kind: official API doc
  - Retrieved: 2026-04-17
  - Applied To: `input` array request shape for `{ type: "text" }` and
    `{ type: "image_url" }`
  - Verification: verified in docs and code
- Source: operator requirement on 2026-04-17
  - Kind: product doc
  - Retrieved: 2026-04-17
  - Applied To: generated-image-only strict safety policy
  - Verification: verified in code boundaries

## Verification

- Passed:
  `cd /Users/almurat/KiKo/kiko-python && python3 -m py_compile moderation/models.py moderation/router.py`
- Passed:
  `cd /Users/almurat/KiKo/kiko-api && npx tsc --noEmit --pretty false --target ESNext --module NodeNext --moduleResolution NodeNext --lib ESNext,DOM --types node --strict --skipLibCheck src/services/moderationClient.ts src/services/generatedImageSafety.ts`
- Full API typecheck was blocked by unrelated existing errors in
  `kiko-api/src/services/clankerService.test.ts` around `result.payload` unknown/undefined typing.

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/generated-image-safety.md
- /Users/almurat/KiKo/system-journal/owner-map/generated-image-safety.md
