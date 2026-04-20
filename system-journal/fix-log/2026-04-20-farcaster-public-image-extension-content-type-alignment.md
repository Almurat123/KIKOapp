# 2026-04-20 Farcaster Public Image Extension And Content-Type Alignment

## What Changed

- Farcaster public generated-image object keys now use an extension that matches
  the real encoded image format instead of always forcing `.png`.
- Generated-image attachment filenames now follow the same normalized output
  format, so JPEG provider output no longer carries a fake `.png` name.
- The public generated-image proxy now repairs legacy objects whose URL suffix
  and stored MIME disagree. If a historical Farcaster object key ends in
  `.png` but the stored bytes are actually JPEG/WebP, the proxy transcodes the
  response to the suffix-implied format before serving it.
- The proxy logs a repair warning when it has to correct one of those legacy
  mismatches.

## Why

The live Farcaster web failure still reproduced on a versioned URL:

- `wrpcd.net/cdn-cgi/image/.../cmo711s7j00rv13l0pxya53pw.png?v=...`
- Farcaster web showed `ERROR 9408: Could not fetch the image — the server returned HTTP error 403 Forbidden`

At the same time, a direct curl to the API proxy URL returned `200`, but with a
critical mismatch:

- URL suffix: `.png`
- Response header: `content-type: image/jpeg`

That means the earlier cache-busting/origin/rate-limit fixes were real but not
sufficient. Farcaster web still had to pass through `wrpcd`, and the source URL
was lying about the file type. Social image proxies are much less tolerant of
that inconsistency than a normal browser image element.

## Verification

- Verified by live curl on 2026-04-20 that:
  - `https://api.kikoapp.app/api/chat/generated-images/public/...cmo711s7j00rv13l0pxya53pw.png?v=...`
    returned `200`
  - but the response header was `content-type: image/jpeg`
- Verified in code that `buildGeneratedPublicObjectKey()` had been hardcoding
  `.png` for every Farcaster public object key regardless of provider MIME type.
- `cd /Users/almurat/KiKo/kiko-api && npm exec tsx --test src/services/chatImageUploads.test.ts`
- `cd /Users/almurat/KiKo/kiko-api && npm exec tsx --test src/services/farcaster-agent/farcasterIngressWorker.test.ts`
- `cd /Users/almurat/KiKo/kiko-api && npm exec tsc --noEmit --pretty false`

## Document Provenance

- Source: operator Farcaster web screenshot and failing `wrpcd.net` URL for
  `cmo711s7j00rv13l0pxya53pw`
  - Kind: runtime observation
  - Retrieved: 2026-04-20
  - Applied To: diagnosing the remaining Farcaster web image failure after
    versioned URLs were already deployed
  - Verification: verified by screenshot and code
- Source: live curl against the matching API public proxy URL on 2026-04-20
  - Kind: runtime observation
  - Retrieved: 2026-04-20
  - Applied To: proving the extension/content-type mismatch (`.png` vs
    `image/jpeg`)
  - Verification: verified in runtime curl output and code
- Source: `/Users/almurat/KiKo/kiko-api/src/services/chatImageUploads.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-20
  - Applied To: fixing public-object-key format selection and legacy proxy
    repair behavior
  - Verification: verified in code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-farcaster-public-image-origin-and-message-preservation.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-farcaster-generated-image-reply-and-watermark.md
- /Users/almurat/KiKo/system-journal/conflicts.md
