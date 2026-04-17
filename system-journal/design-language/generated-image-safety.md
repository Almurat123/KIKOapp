# Generated Image Safety

Updated: 2026-04-17

## Purpose

Generated-image models have a stricter safety boundary than ordinary chat
because their outputs can become durable public media on Farcaster. The strict
policy belongs only to image generation, reference-image editing, generated
output review, and social publication gates.

## Canonical Rules

1. Generated-image prompts must be moderated before any image-model provider is
   called.
2. Reference images must be moderated before they are used for image editing or
   image-conditioned generation.
3. Generated outputs must be moderated while still private or quarantined.
4. Farcaster-bound image URLs and cast text must be moderated immediately before
   publication.
5. Generated-image moderation failures, timeouts, or missing payloads block the
   flow.
6. Ordinary chat must not import generated-image strict safety gates.

## Forbidden Local Patch Patterns

- Do not rely only on provider-side image model safety and skip local gates.
- Do not publish a generated public image URL before output moderation passes.
- Do not reuse ordinary chat's fail-open moderation behavior for generated
  images.
- Do not add generated-image strict policy to the normal chat worker.
- Do not store a blocked generated image as a public Farcaster asset.

## Document Provenance

- Source: OpenAI Moderation guide
  - Kind: official API doc
  - Retrieved: 2026-04-17
  - Applied To: text and image moderation using `omni-moderation-latest`
  - Verification: verified in docs and code
- Source: OpenAI Moderations API OpenAPI spec
  - Kind: official API doc
  - Retrieved: 2026-04-17
  - Applied To: `input` array shape with text and `image_url` parts
  - Verification: verified in docs and code
- Source: operator requirement on 2026-04-17
  - Kind: product doc
  - Retrieved: 2026-04-17
  - Applied To: keeping strict safety only on generated-image flows, not normal chat
  - Verification: verified in code boundaries

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/owner-map/generated-image-safety.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-generated-image-safety-gate.md
