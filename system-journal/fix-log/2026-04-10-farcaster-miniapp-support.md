# 2026-04-10 Farcaster Mini App Support

## What Changed

- Added a dedicated Mini App bootstrap provider that detects Farcaster hosts,
  applies safe-area offsets, and calls `sdk.actions.ready()`.
- Extended the Farcaster identity context so it can fall back to the Mini App
  user context when Privy has not established a session.
- Added Farcaster embed metadata to `index.html` with matching Open Graph tags.
- Added a checked-in `/.well-known/farcaster.json` manifest template.
- Generated compliant Mini App and manifest image assets:
  - 3:2 embed card for `fc:miniapp`
  - 1200x630 OG card
  - 1024x1024 non-alpha icon
  - 200x200 splash image
- Updated static headers so the manifest revalidates and the image assets can be
  cached long term.

## Why

Farcaster Mini Apps are discovered and launched through host metadata rather
than a separate mobile build. KiKo needed a single web shell that can:

1. render correctly inside a Farcaster client,
2. publish the metadata Farcaster clients scrape,
3. keep existing browser behavior intact.

## Guardrail

Do not move Privy authentication or backend identity sync into the Mini App
bootstrap layer. The bootstrap layer only owns detection, safe-area handling,
and the ready handshake.

## Document Provenance

- Source: Farcaster Mini Apps loading guide
- Kind: official API doc
- Retrieved: 2026-04-10
- Applied To: `sdk.actions.ready()` timing and shell readiness
- Verification: verified in docs

- Source: Farcaster Mini Apps sharing guide
- Kind: official API doc
- Retrieved: 2026-04-10
- Applied To: `fc:miniapp` / `fc:frame` meta tags and embed card sizing
- Verification: verified in docs

- Source: Farcaster Mini Apps publishing guide
- Kind: official API doc
- Retrieved: 2026-04-10
- Applied To: `/.well-known/farcaster.json` and manifest ownership model
- Verification: verified in docs

- Source: Farcaster Mini Apps context guide
- Kind: official API doc
- Retrieved: 2026-04-10
- Applied To: `sdk.context.user` and `client.safeAreaInsets`
- Verification: verified in docs

- Source: Installed `@farcaster/miniapp-sdk` package source
- Kind: repo doc
- Retrieved: 2026-04-10
- Applied To: confirm `isInMiniApp`, `sdk.context`, and `actions.ready`
- Verification: verified in code

- Source: local asset inspection and FFmpeg output
- Kind: runtime observation
- Retrieved: 2026-04-10
- Applied To: choose compliant image dimensions and RGB output
- Verification: verified in runtime
