# 2026-04-19 Image Generation Policy Documentation

## Summary

KiKo's public policy documents now describe the image-generation feature as a
first-class service boundary. The docs clarify who owns the inputs, how
generated outputs may be used, what disclosure is required when sharing
publicly, and that ordinary web-chat generated images stay private unless the
user explicitly publishes a public copy.

## Why

The repository already had image-generation runtime owners and safety gates, but
the user-facing legal pages did not yet explain the image-generation feature in
the same way that other third-party AI products do. That created a policy gap
around:

- rights in prompts, reference images, and generated outputs
- public disclosure when sharing AI-generated images
- private-versus-public image storage boundaries
- disclaimer language for originality, non-infringement, and commercial use

## Decision

The updated policy language follows the common structure used by current image
generation products:

- the user is responsible for having rights to the inputs they provide
- the service does not claim ownership of user prompts or generated outputs
- AI image outputs are not guaranteed to be original, accurate, or legally
  cleared for every use
- public sharing may require explicit AI disclosure and platform policy
  compliance
- ordinary web chat images remain private in account history unless the user
  explicitly shares them to a public surface that needs a durable URL or embed

## Verification

- Verified in code that generated images use the same private image boundary as
  chat uploads, with opt-in public copies only for surfaces that require durable
  embeds.
- Verified in code that image-generation requests pass through moderation before
  publication and that safety blocks fail closed.
- Verified in the updated docs that English and Chinese policy pages now include
  image-generation terms, privacy handling, and disclaimer language.

## Document Provenance

- Source: OpenAI Service terms
  - Kind: official API doc
  - Retrieved: 2026-04-19
  - Applied To: user ownership of output, input responsibility, and service
    disclaimer framing
  - Verification: verified in docs
- Source: OpenAI Usage Policies
  - Kind: official API doc
  - Retrieved: 2026-04-19
  - Applied To: likeness/privacy restrictions and image generation safety
    framing
  - Verification: verified in docs
- Source: Canva AI Product Terms
  - Kind: official API doc
  - Retrieved: 2026-04-19
  - Applied To: user responsibility for input/output, AI disclosure, and
    "use at your own risk" disclaimer framing
  - Verification: verified in docs
- Source: Midjourney Terms of Service
  - Kind: official product doc
  - Retrieved: 2026-04-19
  - Applied To: input/output responsibility, copyright/trademark restrictions,
    public remix/disclosure language, and DMCA-style complaint framing
  - Verification: verified in docs
- Source: Adobe Firefly generative AI commitments
  - Kind: official product doc
  - Retrieved: 2026-04-19
  - Applied To: no ownership claim on user content and commercial-safety
    framing
  - Verification: verified in docs
- Source: `/Users/almurat/KiKo/kiko-api/src/services/generatedImageChatTask.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-19
  - Applied To: private history storage, opt-in public copies for social
    surfaces, and no server-side watermark rewrite
  - Verification: verified in code
- Source: `/Users/almurat/KiKo/kiko-api/src/services/chatImageUploads.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-19
  - Applied To: private object storage boundaries and durable public copy
    separation
  - Verification: verified in code
- Source: `/Users/almurat/KiKo/kiko-api/src/services/generatedImageSafety.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-19
  - Applied To: fail-closed moderation before publish
  - Verification: verified in code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/generated-image-safety.md
- /Users/almurat/KiKo/system-journal/design-language/generated-image-billing.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-generated-image-client-preview-hydration.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-farcaster-generated-image-reply-and-watermark.md
