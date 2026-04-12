# Farcaster Mini App Support Owner Map

Updated: 2026-04-12

## Owned Layers

- `kiko-web/src/contexts/MiniAppContext.tsx`
- `kiko-web/src/contexts/FarcasterContext.tsx`
- `kiko-web/src/main.tsx`
- `kiko-web/index.html`
- `kiko-web/public/.well-known/farcaster.json`
- `kiko-web/public/_headers`
- `kiko-web/public/farcaster-preview.png`
- `kiko-web/public/farcaster-promo.png`
- `kiko-web/public/farcaster-social.png`
- `kiko-web/public/icon.png`
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

### Published asset layer

Owns: the public Farcaster poster assets and the canonical loading icon used by
the shell and manifest.

Does not own: generated working renders under `output/` or transient preview
experiments.

## Notes

The Mini App shell should stay compatible with the existing browser app instead
of splitting into a second frontend.

## See Also

- `system-journal/INDEX.md`
- `system-journal/design-language/farcaster-miniapp-shell.md`
- `system-journal/fix-log/2026-04-10-farcaster-miniapp-support.md`
- `system-journal/fix-log/2026-04-12-farcaster-manifest-splash-fix.md`
- `system-journal/fix-log/2026-04-12-farcaster-miniapp-display-ready-fix.md`
