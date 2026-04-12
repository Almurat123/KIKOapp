import React from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { useTheme } from '../hooks/useTheme';

const privyAppId = import.meta.env.VITE_PRIVY_APP_ID;
const privyClientId = import.meta.env.VITE_PRIVY_CLIENT_ID;

// CONTEXT MEMORY
// Updated: 2026-04-12
// Author: Codex
// Reason: The Mini App auth path is social-login first, with Privy embedded
//         wallets provisioned after login. External wallet linking is outside
//         the current product scope and can trigger WalletConnect registry
//         fetches that Farcaster's frame CSP blocks.
// Goal: Keep Farcaster/social login and embedded wallet provisioning available
//       without exposing external wallet connection options.
// Owns: Privy social login appearance and embedded-wallet provisioning config.
// Does Not Own: Farcaster manifest validation, app shell metadata, or on-chain
//               transaction logic.
// Design Language:
// - Login methods must stay social-only unless product scope explicitly adds
//   external wallet linking.
// - Do not configure `walletList`, `wallet_connect`, or detected wallet entries
//   for the Mini App shell.
// - Keep embedded wallet creation enabled for both Ethereum and Solana.
// Document Provenance:
// - Source: Privy Docs - Configure wallet options
// - Kind: official API doc
// - Retrieved: 2026-04-12
// - Applied To: Confirm that `walletList` is for external wallet options and
//   should not be used for this Mini App auth scope.
// - Verification: verified in code and docs; runtime effect to be rechecked
//   after deploy
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/owner-map/farcaster-miniapp-support.md
// - /Users/almurat/KiKo/system-journal/design-language/farcaster-miniapp-shell.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-12-privy-walletconnect-csp-fix.md
// Privy Provider with theme support
export const ThemedPrivyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { resolvedTheme } = useTheme();

  // Determine Privy theme and logo based on resolved theme
  const privyTheme = resolvedTheme === 'dark' ? '#222224' : '#FFFFFF';
  const privyLogo = resolvedTheme === 'dark'
    ? 'https://auth.privy.io/logos/privy-logo-dark.png'
    : 'https://auth.privy.io/logos/privy-logo.png';

  return (
    <PrivyProvider
      appId={privyAppId}
      clientId={privyClientId}
      config={{
        appearance: {
          accentColor: '#6A6FF5',
          theme: privyTheme,
          showWalletLoginFirst: false,
          logo: privyLogo,
        },
        loginMethods: ['email', 'farcaster', 'google', 'twitter'],
        // Removed fundingMethodConfig temporarily to test if sandbox is causing the crash
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'all-users',
          },
          solana: {
            createOnLogin: 'all-users',
          },
          showWalletUIs: true,
        },
        mfa: {
          noPromptOnMfaRequired: false,
        },
        solana: {
          rpcs: {
            'solana:mainnet': {
              rpc: {},
              rpcSubscriptions: {},
            },
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any
      }}
    >
      {children}
    </PrivyProvider>
  );
};
