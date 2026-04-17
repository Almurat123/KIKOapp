# Owner Map: Generated Image Safety

Updated: 2026-04-17

## Owned Layers

- `kiko-python/moderation/models.py`
- `kiko-python/moderation/router.py`
- `kiko-api/src/services/moderationClient.ts`
- `kiko-api/src/services/generatedImageSafety.ts`

## Ownership Boundaries

### Python moderation model owner

Owns: constructing OpenAI `omni-moderation-latest` requests for text-only chat
compatibility and text+image generated-image safety checks.

Does not own: chat worker moderation placement, image generation provider calls,
R2 storage, or social publication.

### Python moderation route owner

Owns: internal HTTP envelopes for `/input`, `/output`, and the strict
`/image-generation` endpoint.

Does not own: deciding which product flow needs strict blocking.

### Node moderation client owner

Owns: transport to the Python moderation service, normal-chat fallback behavior,
and generated-image fail-closed fallback behavior.

Does not own: generated-image stage sequencing.

### Generated image safety owner

Owns: generated-image safety stage semantics, including prompt,
reference-input, generated-output, and publish gates.

Does not own: normal chat, image model invocation, storage promotion, or
Farcaster cast publishing.

## Boundary Rule

Normal chat may continue using existing `/input` and `/output` text moderation.
Generated-image features must call `generatedImageSafety.ts` and must treat any
moderation outage or empty safety payload as blocked.

## Document Provenance

- Source: OpenAI Moderation guide
  - Kind: official API doc
  - Retrieved: 2026-04-17
  - Applied To: generated-image text+image moderation owner split
  - Verification: verified in docs and code
- Source: OpenAI Moderations API OpenAPI spec
  - Kind: official API doc
  - Retrieved: 2026-04-17
  - Applied To: Node/Python request envelope for text and `image_url` inputs
  - Verification: verified in docs and code
- Source: operator requirement on 2026-04-17
  - Kind: product doc
  - Retrieved: 2026-04-17
  - Applied To: keeping strict generated-image safety separate from ordinary chat
  - Verification: verified in code boundaries

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/generated-image-safety.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-generated-image-safety-gate.md
