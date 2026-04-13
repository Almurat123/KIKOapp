# Fix Log: 2026-04-13 X Share Card Cache Busting

## What changed

The X reply share page now emits a versioned `og:image` / `twitter:image` URL and disables
HTML caching on the public share route.

Changes:

1. `buildXReplyShareImageUrl(...)` now accepts a renderer-version suffix.
2. The canonical share-page metadata now uses:
   - `/api/images/x-share/<token>.png?v=<renderer-version>-<createdAt>`
3. `/x/share/:token` now returns:
   - `Cache-Control: no-store, max-age=0`

## Why

Production origin verification proved the PNG renderer was already fixed:

- the live image route returned a correct image
- the live image hash changed from the old broken asset
- direct origin fetch rendered readable prompt/reply text

But X still showed the old broken card for an older share URL. That means the stale layer
had moved to X-side card caching, not the origin renderer.

New shares therefore need a canonical image URL that changes when the renderer contract
changes, so X cannot keep reusing a stale card image.

## Document provenance

### Source 1
- Source: live production fetch of `https://api.kikoapp.app/api/images/x-share/<token>.png`
- Kind: runtime observation
- Retrieved: 2026-04-13
- Applied to:
  - proving the origin image renderer was fixed even while X UI still showed a stale broken card
- Verification: verified in runtime

### Source 2
- Source: live production fetch of `https://api.kikoapp.app/x/share/<token>`
- Kind: runtime observation
- Retrieved: 2026-04-13
- Applied to:
  - verifying the share page still emitted a stable unversioned image URL before this fix
- Verification: verified in runtime

## Owner map

### `src/services/x/xReplyShareService.ts`
Owns:
- canonical share URL construction
- canonical image URL construction

Does not own:
- HTML response headers
- image rendering bytes

### `src/routes/xShare.ts`
Owns:
- share-page response headers
- embedding the canonical image URL into public meta tags

Does not own:
- token generation
- share row persistence

## Design rules

- Treat X card caching as a separate layer from origin image correctness.
- When renderer output changes materially, canonical image URLs must carry a version signal.
- Public share HTML should not be strongly cacheable.

## Runtime verification status

Verified in runtime:
- origin image route returned fixed readable PNG bytes
- old X UI still showed stale card content

Verified in code:
- share HTML now emits versioned `og:image`
- share HTML now disables route caching
