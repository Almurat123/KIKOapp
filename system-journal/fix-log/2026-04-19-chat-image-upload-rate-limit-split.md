# 2026-04-19 Chat Image Upload Rate Limit Split

## What Changed

- Moved `/api/chat/uploads/images/prepare`, `/discard`, and `/finalize` out of
  the generic `/api/chat/*` rate bucket and into a dedicated `chat_image_upload`
  limiter bucket.
- Kept the image upload routes authenticated, but stopped letting ordinary chat
  message traffic consume the same low chat bucket.
- Surfaced a specific retry-later toast in the chat composer when image upload
  preparation is rate-limited, instead of only showing a generic upload failure.

## Why

Production uploads were failing with `429 Too Many Requests` even though the
image upload path is a user-initiated mutation, not a chat-stream spam surface.
The shared `/api/chat/*` bucket was too small for this route class and could be
hit by ordinary chat activity. The upload flow needs its own limiter contract so
image selection does not look broken just because other chat traffic is active.

## Product Rule

- Chat image uploads must not share the generic `/api/chat/*` limiter bucket.
- Image upload preparation should be allowed to fail with a clear retry-later
  message when the upload bucket is genuinely saturated.
- The image upload path should stay authenticated and rate limited, but not be
  punished as if it were a streaming chat mutation.

## Verification

- Verified in code that `rateLimiterMiddleware` now routes
  `/api/chat/uploads/images/*` to a dedicated `chat_image_upload` bucket.
- Verified in code that `ChatInterface` surfaces a specific rate-limit toast
  for upload preparation failures.
- Verified `npm exec tsc --noEmit --pretty false` in `kiko-api`.
- Verified `npm exec tsc --noEmit --pretty false` in `kiko-web`.

## Document Provenance

- Source: operator report on 2026-04-19 that web chat image uploads were
  returning 429 in production
  - Kind: runtime observation
  - Retrieved: 2026-04-19
  - Applied To: splitting chat image upload traffic into its own limiter
    bucket and clarifying the UI error path
  - Verification: verified in code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/loading-resilience.md
- /Users/almurat/KiKo/system-journal/design-language/chat-image-viewing.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-image-upload-r2-and-model-input.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-chat-image-native-lightbox-unification.md
