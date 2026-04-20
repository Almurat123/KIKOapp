# 2026-04-20 Farcaster Public Image Hotlink-Ok Proxy

## What Changed

- Public generated-image proxy URLs now publish under:

  `/api/chat/generated-images/public/hotlink-ok/...`

  instead of the bare `/api/chat/generated-images/public/...` path.
- The public generated-image loader now strips the leading `hotlink-ok/`
  segment before validating the stored public object key.
- Farcaster embed rewrite tests now expect the `hotlink-ok` proxy form.

## Why

The remaining Farcaster web failure was not the Node route anymore. It was
Cloudflare Hotlink Protection firing before the API code ran.

Live runtime repro on 2026-04-20 showed:

- `curl -I https://api.kikoapp.app/api/chat/generated-images/public/...png`
  returned `200` when there was no external `Referer`.
- The same request with
  `Referer: https://farcaster.xyz/` and image-like cross-site headers returned:
  - `HTTP/2 403`
  - body: `error code: 1011`
- Cloudflare documents that Hotlink Protection blocks supported image suffixes
  (`gif`, `ico`, `jpg`, `jpeg`, `png`) when the `Referer` is non-empty and does
  not include the site domain.
- The same Cloudflare doc also states that any path containing a directory named
  `hotlink-ok` is exempt from hotlink checks.
- Verified live on the current zone: the Farcaster-style cross-site request to
  `/api/chat/generated-images/public/hotlink-ok/.../definitely-missing.png`
  returned a normal app-level `404`, while the same request without
  `hotlink-ok` returned Cloudflare `403`.

That means old already-published bare `.png` proxy URLs are still blocked at
the edge unless Cloudflare configuration changes. However, new published proxy
URLs can bypass the edge block entirely by using the documented `hotlink-ok`
path exception.

## Verification

- `cd /Users/almurat/KiKo/kiko-api && npm exec tsx --test src/services/chatImageUploads.test.ts`
- `cd /Users/almurat/KiKo/kiko-api && npm exec tsx --test src/services/farcaster-agent/farcasterIngressWorker.test.ts`
- `cd /Users/almurat/KiKo/kiko-api && npm exec tsc --noEmit --pretty false`
- Live curl repro on 2026-04-20:
  - bare proxy path + Farcaster referer => `403 error code: 1011`
  - `hotlink-ok` proxy path + Farcaster referer => app-level `404`

## Document Provenance

- Source: Cloudflare Hotlink Protection docs
  - Kind: official doc
  - Retrieved: 2026-04-20
  - Applied To: using the documented `hotlink-ok` directory exemption for
    public generated-image proxy URLs
  - Verification: verified in docs and live runtime curl
- Source: operator Farcaster web request headers and failing `wrpcd.net`
  `err=9408` / `403` repro
  - Kind: runtime observation
  - Retrieved: 2026-04-20
  - Applied To: reproducing the exact external referer/cross-site image request
    pattern that triggered the edge block
  - Verification: verified in live curl and code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-farcaster-public-image-origin-and-message-preservation.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-farcaster-public-image-extension-content-type-alignment.md
- /Users/almurat/KiKo/system-journal/conflicts.md
