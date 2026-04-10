# Farcaster Mini App Support Owner Map

Updated: 2026-04-10

## Owned Layers

- `kiko-web/src/contexts/MiniAppContext.tsx`
- `kiko-web/src/contexts/FarcasterContext.tsx`
- `kiko-web/src/main.tsx`
- `kiko-web/index.html`
- `kiko-web/public/.well-known/farcaster.json`
- `kiko-web/public/_headers`
- `kiko-web/public/farcaster-miniapp-card.png`
- `kiko-web/public/farcaster-og-card.png`
- `kiko-web/public/farcaster-icon.png`
- `kiko-web/public/farcaster-splash.png`

## Ownership Boundaries

### Mini App bootstrap layer

Owns: host detection, `sdk.actions.ready()`, safe-area application, and the
`isMiniApp` shell state.

Does not own: Privy session issuance, wallet signing policy, or backend auth.

### Farcaster identity layer

Owns: read-only identity fallback from Mini App context plus Privy-backed sync
when an access token exists.

Does not own: the Farcaster client host handshake or manifest publication.

### Shell metadata layer

Owns: `fc:miniapp`, `fc:frame`, OG metadata, and the static manifest file.

Does not own: upload-time domain ownership verification or Warpcast signing.

## Notes

The Mini App shell should stay compatible with the existing browser app instead
of splitting into a second frontend.
