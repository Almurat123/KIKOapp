# 2026-04-20 Generated Image Public Proxy And Task Hydration

## What Changed

- Farcaster generated-image public URLs now default to an API-owned proxy route:
  `https://api.kikoapp.app/api/chat/generated-images/public/<object-key>`.
- Chat API now exposes `/api/chat/generated-images/public/*` as a public image
  proxy that serves only objects inside the generated-image public prefix.
- Generated-image attachment hydration and Farcaster reply assembly now derive
  the durable public media URL from `publicObjectKey` when present, overriding
  any legacy stored `publicUrl` values such as `cdn.kikoapp.app`.
- Session hydration no longer returns an `activeTask` when the bound assistant
  message is already terminal in durable storage.
- Frontend conversation hydration now prefers a richer terminal
  `generatedImage` payload from the database over a stale local placeholder.
- Root layout task matching now prefers the bound assistant `messageId`, and
  image message starts bind that `messageId` into `activeTask` immediately.

## Why

Two runtime failures were happening together:

1. Farcaster public replies could publish a URL on `cdn.kikoapp.app`, but the
   deployed URL shape was not guaranteed to resolve to the stored public R2
   object. The cast therefore showed a broken image card.
2. A generated-image assistant row could already be complete in storage while
   the web session still displayed a running task or a stale pre-image
   placeholder. That came from two places:
   - session hydration could revive a stale `activeTask`
   - local generated-image placeholder data could overwrite the richer DB row

The fix moves the public media boundary back under the API owner and tightens
hydration so terminal generated-image state wins consistently. It also ensures
legacy generated-image rows cannot keep publishing stale CDN URLs that Farcaster
renders as link cards instead of direct image embeds.

## Verification

- `cd /Users/almurat/KiKo/kiko-api && npm exec tsc --noEmit --pretty false`
- `cd /Users/almurat/KiKo/kiko-web && npm exec tsc --noEmit --pretty false`
- `cd /Users/almurat/KiKo/kiko-api && npm exec tsx --test src/services/farcaster-agent/farcasterIngressWorker.test.ts`

## Document Provenance

- Source: operator screenshots on 2026-04-20 showing:
  - a Farcaster cast with `Generated.` plus a broken `cdn.kikoapp.app` image card
  - a chat session where generated-image progress remained active after the
    assistant image had already reached storage
  - Kind: runtime observation
  - Retrieved: 2026-04-20
  - Applied To: API-owned generated-image public proxy and stale task/image
    hydration repair
  - Verification: verified in code
- Source: operator requirement on 2026-04-19 and 2026-04-20 that Farcaster
  image replies must publish a stable image and the web chat must not leave
  generated-image tasks running after completion
  - Kind: product instruction
  - Retrieved: 2026-04-20
  - Applied To: public proxy route and frontend/server hydration cleanup
  - Verification: verified in code
- Source: operator screenshot on 2026-04-20 showing the published Farcaster
  reply still rendering as an OGP-style link card instead of a direct image
  despite the public proxy route existing in code
  - Kind: runtime observation
  - Retrieved: 2026-04-20
  - Applied To: deriving outgoing Farcaster image URLs from `publicObjectKey`
    at read time so stale stored CDN URLs cannot survive publication
  - Verification: verified in code and targeted test

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-farcaster-generated-image-reply-and-watermark.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-farcaster-generated-image-english-media-reply.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-generated-image-client-preview-hydration.md
- /Users/almurat/KiKo/system-journal/design-language/generated-image-loading.md
