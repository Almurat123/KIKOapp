# Fix Log: 2026-04-12 Farcaster Mini App Onboarding External Wallet Suppression

## What Changed

- Updated `kiko-web/src/hooks/useOnboardingFlow.ts`
  - reads `isMiniApp` from `MiniAppContext`
  - skips the automatic `fundWallet()` onboarding step inside Farcaster Mini App
    hosts
  - keeps normal browser funding onboarding unchanged

## Why

The product scope for the Mini App is Farcaster/social login plus Privy embedded
wallets. The automatic funding prompt can open external funding or wallet
connection surfaces. In Farcaster's frame environment those surfaces can trigger
WalletConnect/CSP failures and delay the Mini App ready path.

## Guardrail

Do not re-enable automatic funding prompts in Mini App hosts unless the product
explicitly supports external wallet/funding surfaces there and the CSP behavior
has been tested in Farcaster.

## Document Provenance

- Source: Farcaster Mini Apps loading guide
  - Kind: official API doc
  - Retrieved: 2026-04-12
  - Applied To: Avoid optional third-party UI during Mini App startup and ready
    flow
  - Verification: verified in code; runtime check pending deploy

See also:
- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/farcaster-miniapp-shell.md
- /Users/almurat/KiKo/system-journal/owner-map/farcaster-miniapp-support.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-12-privy-walletconnect-csp-fix.md
