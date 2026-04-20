# 2026-04-20 Farcaster Public Image Origin And Message Preservation

## What Changed

- Public generated-image proxy fetches under
  `/api/chat/generated-images/public/*` now bypass the global origin/app-key
  security gate for `GET` and `HEAD` requests.
- The same public generated-image proxy fetches now bypass the global API rate
  limiter before Redis/Postgres bucket accounting, because Farcaster web uses a
  shared Cloudflare image-resize proxy (`wrpcd.net/cdn-cgi/image/...`) and origin
  cache misses must not consume ordinary API request buckets.
- The public generated-image proxy route now adds cross-origin-friendly image
  headers (`Access-Control-Allow-Origin: *` and
  `Cross-Origin-Resource-Policy: cross-origin`) while retaining inline image
  content type and storage-layer object-key validation.
- Public generated-image embed URLs derived from `publicObjectKey` now include a
  stable `?v=<image-id>` query string. Farcaster web rewrites image embeds
  through `wrpcd.net/cdn-cgi/image/...`; versioned URLs prevent retries from
  reusing a previously cached failed transform for the same bare `.png` URL.
- `originRestriction` now has a path-scoped public generated-image bypass, so
  the same rule is preserved if the middleware is reused outside the bootstrap
  hook.
- `ChatStreamBroker` runtime-plan and tool-trace persistence now merge broker
  metadata with the latest durable assistant-message data before writing back
  to the database.
- Broker metadata persistence now preserves terminal generated-image status
  instead of resetting the row to `streaming`.

## Why

The production log `/Users/almurat/Downloads/logs.1776665425918.json` showed
two separate failures in the same Farcaster generated-image run:

1. The cast was published with one `.png` embed, but Farcaster/TwitterBot,
   `probe-image-size`, and a Node fetcher were blocked by `originRestriction`
   with `ORIGIN_NOT_ALLOWED`. That made Farcaster render the URL as an
   OGP/link card instead of a direct image.
2. The generated-image task completed and stored the image, then the generic
   chat broker persisted runtime/tool metadata using a stale empty
   `assistantData` object. That overwrote `data.generatedImage.images` and
   changed the assistant message back to `streaming`, so the web session could
   show a running task without the image.
3. A follow-up 2026-04-20 Farcaster web screenshot showed
   `ERROR 9408: Could not fetch the image — the server returned HTTP error 403
   Forbidden` for a `wrpcd.net/cdn-cgi/image/...` transformed URL. A direct curl
   to the underlying API public image URL returned `429 Too Many Requests`
   before the route served the object, proving the global `rateLimiter` still
   sat in front of the public media path even after the origin/app-key bypass.
4. The operator-provided `/Users/almurat/KiKo/test.txt` browser log confirmed
   the web client runs under `client.farcaster.xyz` / `client.warpcast.com` and
   allows `wrpcd.net` in its image/connect policy. That means the remaining
   issue is cache-key stability for the direct image URL that Farcaster rewrites,
   not converting the reply back into an OGP card.

## Verification

- Verified from log trace `39fa3d64-aba1-42b4-af42-7ea7b5546438` that:
  - generated-image moderation passed
  - `generate_image_from_intent` returned `ok=true`
  - Farcaster publish had `embedCount=1`
  - external image fetches were blocked by `ORIGIN_NOT_ALLOWED`
  - bridge publication had to use `task_output_fallback` because the assistant
    message itself had `generatedImageStatus=null`
- Verified in code that the public route still loads objects through
  `loadPublicGeneratedChatImageObject()`, which enforces the generated-image
  public object-key prefix.
- Verified by live curl on 2026-04-20 that
  `api.kikoapp.app/api/chat/generated-images/public/...cmo6uezyl011b10oqrc346bwz.png`
  could return `429 Too Many Requests` from the origin before deployment of the
  limiter bypass.
- Verified in code that rewritten legacy generated-image URLs now publish the
  API public proxy URL with a stable version query parameter.
- `cd /Users/almurat/KiKo/kiko-api && npm exec tsc --noEmit --pretty false`
- `cd /Users/almurat/KiKo/kiko-api && npm exec tsx --test src/middleware/originRestriction.test.ts`
- `cd /Users/almurat/KiKo/kiko-api && npm exec tsx --test src/middleware/rateLimiter.test.ts`
- `cd /Users/almurat/KiKo/kiko-api && node --test --test-force-exit --import tsx src/jobs/chat/streamBroker.test.ts`
- `cd /Users/almurat/KiKo/kiko-api && npm exec tsx --test src/services/farcaster-agent/farcasterIngressWorker.test.ts`

## Document Provenance

- Source: `/Users/almurat/Downloads/logs.1776665425918.json`
  - Kind: runtime observation
  - Retrieved: 2026-04-20
  - Applied To: public generated-image route security bypass and
    side-effect-safe broker metadata persistence
  - Verification: verified in runtime log and code
- Source: `/Users/almurat/KiKo/kiko-api/src/services/chatImageUploads.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-20
  - Applied To: relying on storage-layer public object-key validation after
    bypassing origin/app-key checks for the public proxy route
  - Verification: verified in code
- Source: operator Farcaster web screenshot and live Cloudflare resize URL
  `wrpcd.net/cdn-cgi/image/f=auto,w=1200/...`
  - Kind: runtime observation
  - Retrieved: 2026-04-20
  - Applied To: bypassing the API rate limiter for read-only public generated
    image media fetches and adding cross-origin-friendly image response headers
  - Verification: verified by live curl repro and code
- Source: `/Users/almurat/KiKo/test.txt`
  - Kind: runtime observation
  - Retrieved: 2026-04-20
  - Applied To: publishing versioned direct-image URLs that Farcaster web can
    rewrite through its allowed `wrpcd.net` proxy without reusing a failed cache key
  - Verification: verified in browser log and code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-generated-image-public-proxy-and-task-hydration.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-farcaster-generated-image-publish-diagnostics.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-generated-image-tool-call-repair-and-farcaster-wait-window.md
- /Users/almurat/KiKo/system-journal/conflicts.md
