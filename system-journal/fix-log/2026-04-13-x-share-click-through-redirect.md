# Fix Log: 2026-04-13 X Share Click-Through Redirect

## What changed

The public X reply share page still returns crawler-readable HTML metadata, but browser
users are now immediately redirected to the real KIKO chat page.

The share page keeps:

1. `twitter:*` metadata
2. `og:*` metadata
3. the public OG image URL

It originally emitted:

1. `link rel="canonical"` pointing to the KIKO chat URL
2. a JavaScript redirect to the KIKO chat URL
3. a `noscript` refresh fallback

The production click-through check showed JavaScript redirect is not enough for X in-app
navigation. The route now uses a server-side split:

1. known card crawlers receive the crawler-readable HTML metadata
2. non-crawler visitors receive a `302` redirect to the KIKO chat URL

## Why

The API share URL exists for X card crawlers. It should not be the final human product
destination.

Users clicking the X card expect to continue in KIKO, not land on an API-owned preview
HTML page. The API route must therefore split responsibilities:

- crawler path: serve card metadata and preview image
- human path: redirect into KIKO

## Document provenance

### Source 1
- Source: user-provided X click-through screenshot in active task thread
- Kind: runtime/product observation
- Retrieved: 2026-04-13
- Applied to:
  - confirming the share page was being used as the final human landing page
  - changing the route to redirect humans into KIKO
- Verification: verified in code

### Source 3
- Source: production fetch of `https://api.kikoapp.app/x/share/<token>`
- Kind: runtime observation
- Retrieved: 2026-04-14
- Applied to:
  - confirming the route still returned `200 text/html` to normal user navigation
  - replacing client-side redirect with server-side crawler/user split
- Verification: verified in runtime

### Source 2
- Source: X Cards markup behavior from previous integration work
- Kind: official API doc
- Retrieved: 2026-04-11
- Applied to:
  - preserving crawler-visible `twitter:*` and `og:*` metadata on the share route
- Verification: partially verified

## Owner map

### `src/routes/xShare.ts`
Owns:
- crawler-readable public share HTML
- user click-through behavior from the public share URL

Does not own:
- private chat authorization
- KIKO chat page rendering
- X card cache timing

## Design rules

- The API share page is a crawler bridge, not a product destination.
- Do not remove metadata from the share page; X still needs it for the card.
- Human visitors should be sent to the website chat target.

## Verification

Verified in code:
- share page keeps meta tags
- share page emits canonical KIKO chat URL
- non-crawler visitors receive server-side redirect to KIKO chat
- crawler visitors still receive metadata HTML

Not yet verified:
- X in-app browser redirect behavior after production deployment
