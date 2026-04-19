# 2026-04-19 Chat Image Upload Rate Limit Split Reverted

## What Changed

- Removed the dedicated `chat_image_upload` limiter bucket from
  `rateLimiterMiddleware`.
- Restored `/api/chat/uploads/images/*` to the prior generic chat limiter path.
- Removed the retry-later upload toast in the chat composer and returned to the
  generic upload failure message.

## Why

The dedicated upload bucket was too aggressive in practice and user-selected
image uploads were failing in production. The safer immediate move was to
remove the extra routing logic and restore the previous upload behavior so the
photo picker works again.

## Verification

- Verified in code that `rateLimiterMiddleware` no longer special-cases
  `/api/chat/uploads/images/*`.
- Verified in code that the chat composer now shows the generic upload failure
  message again.
- Verified `npm exec tsc --noEmit --pretty false` in both `kiko-api` and
  `kiko-web`.

## Document Provenance

- Source: operator request on 2026-04-19 to delete the upload rate-limit logic
  because photo uploads were no longer working
  - Kind: runtime observation
  - Retrieved: 2026-04-19
  - Applied To: reverting the upload-specific limiter and UI retry copy
  - Verification: verified in code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/loading-resilience.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-chat-image-upload-rate-limit-split.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-image-upload-r2-and-model-input.md
