# Fix Log: 2026-04-12 Privy WalletConnect CSP Fix

## Summary
Privy was triggering a WalletConnect registry fetch during startup, and the
current Farcaster frame CSP blocked `https://explorer-api.walletconnect.com`.
The external wallet list was narrowed to explicit wallet options so the app can
keep embedded wallet login without requiring Registry discovery on load.

## What Changed
- Updated `kiko-web/src/components/ThemedPrivyProvider.tsx`
  - replaced the empty `walletList: []` with an explicit list of wallet options
    that do not require WalletConnect registry discovery
  - kept embedded wallets enabled for Ethereum and Solana

## Document Provenance
- Source: Privy Docs - Connect an external wallet
- Kind: official API doc
- Retrieved: 2026-04-12
- Applied To: Wallet list selection and WalletConnect discovery behavior
- Verification: verified in docs; runtime effect pending deploy/test in Farcaster

## Why This Exists
Mini App environments can apply a restrictive frame CSP. If Privy pulls the
WalletConnect registry during provider startup, the app can fail before the UI
finishes loading. This fix keeps the startup path within the allowed CSP.

## See Also
- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/farcaster-miniapp-shell.md
- /Users/almurat/KiKo/system-journal/owner-map/farcaster-miniapp-support.md
