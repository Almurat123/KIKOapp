# 2026-04-20 Farcaster Generated Image Publish Diagnostics

## What Changed

- Added bridge-level diagnostics for Farcaster generated-image replies before
  publication.
- Added delivery-level diagnostics in the Farcaster reply service before and
  after outbound publish attempts.
- Added API-client diagnostics that record whether publication used Neynar or
  Hub fallback, together with normalized embed shape metadata.

## Why

The generated-image reply path had already been corrected to prefer API-owned
public proxy URLs, but the operator still needed to verify in production
whether a single retest was publishing:

1. a direct image-style URL ending in an image extension
2. a legacy CDN/public URL that Farcaster could still render as a link card
3. a correct bridge resolution that later got altered during publish

Without structured diagnostics at all three owners, one failed test still left
ambiguity about where the URL shape changed.

## Diagnostic Fields

- `embedCount`
- `embedDiagnostics[].host`
- `embedDiagnostics[].path`
- `embedDiagnostics[].extension`
- `embedDiagnostics[].isApiGeneratedImageProxy`
- `embedDiagnostics[].looksLikeDirectImage`
- `imageDiagnostics[].source`
- `imageDiagnostics[].hasPublicObjectKey`
- `imageDiagnostics[].storedPublicUrlHost`
- `publishPath`

## Verification

- `cd /Users/almurat/KiKo/kiko-api && npm exec tsc --noEmit --pretty false`
- `cd /Users/almurat/KiKo/kiko-api && npm exec tsx --test src/services/farcaster-agent/farcasterIngressWorker.test.ts`

## Document Provenance

- Source: operator request on 2026-04-20 to add production diagnostics before
  retesting Farcaster generated-image publication
  - Kind: product instruction
  - Retrieved: 2026-04-20
  - Applied To: bridge, reply-service, and API-client diagnostics
  - Verification: verified in code
- Source: operator screenshot on 2026-04-20 showing a published Farcaster
  generated-image reply still rendering as a link card
  - Kind: runtime observation
  - Retrieved: 2026-04-20
  - Applied To: logging enough URL-shape detail to distinguish direct-image
    embeds from OGP-like link-card embeds in one retry
  - Verification: verified in code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-generated-image-public-proxy-and-task-hydration.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-farcaster-generated-image-english-media-reply.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-farcaster-generated-image-reply-and-watermark.md
