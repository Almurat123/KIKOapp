# Fix Log: 2026-04-12 Privy WalletConnect CSP Fix

## Summary
Privy was triggering a WalletConnect registry fetch during startup, and the
current Farcaster frame CSP blocked `https://explorer-api.walletconnect.com`.
The product does not support external wallet linking in the Mini App flow:
Farcaster identity should use Farcaster/social login, while trading uses Privy
embedded wallets. External wallet list configuration was removed instead of
adding external wallet options.

## What Changed
- Updated `kiko-web/src/components/ThemedPrivyProvider.tsx`
  - removed `walletList` and `walletChainType` from `appearance`
  - kept login methods social-only: email, Farcaster, Google, Twitter
  - kept embedded wallets enabled for Ethereum and Solana

## Document Provenance
- Source: Privy Docs - Connect an external wallet
- Kind: official API doc
- Retrieved: 2026-04-12
- Applied To: Removing external wallet UI configuration from the Mini App auth
  scope
- Verification: verified in docs and code; runtime effect pending deploy/test in
  Farcaster

## Why This Exists
Mini App environments can apply a restrictive frame CSP. If Privy pulls the
WalletConnect registry during provider startup, the app can fail before the UI
finishes loading. Since this product does not support external wallet linking,
the correct owner decision is to keep external wallet configuration out of the
Mini App shell.

## See Also
- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/farcaster-miniapp-shell.md
- /Users/almurat/KiKo/system-journal/owner-map/farcaster-miniapp-support.md
