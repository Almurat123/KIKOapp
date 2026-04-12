import React from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { useTheme } from '../hooks/useTheme';

const privyAppId = import.meta.env.VITE_PRIVY_APP_ID;
const privyClientId = import.meta.env.VITE_PRIVY_CLIENT_ID;

// CONTEXT MEMORY
// Updated: 2026-04-12
// Author: Codex
// Reason: Privy's default wallet discovery path can pull WalletConnect registry
//         data and get blocked by the Farcaster frame CSP.
// Goal: Keep embedded wallet login working in Mini App environments without
//       forcing a WalletConnect registry fetch on startup.
// Owns: Privy appearance configuration and the external wallet options shown
//       to users at login/connect time.
// Does Not Own: Farcaster manifest validation, app shell metadata, or on-chain
//               transaction logic.
// Design Language:
// - Prefer explicit, mobile-friendly wallet options over registry-driven lists.
// - Avoid WalletConnect registry fetches unless long-tail wallet coverage is
//   intentionally required and CSP has been verified.
// - Keep embedded wallet creation enabled even when external wallet discovery is
//   narrowed.
// Document Provenance:
// - Source: Privy Docs - Connect an external wallet
// - Kind: official API doc
// - Retrieved: 2026-04-12
// - Applied To: External wallet list selection and WalletConnect registry
//   avoidance in the Farcaster Mini App context.
// - Verification: verified in docs; runtime effect to be rechecked after deploy
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
          walletChainType: 'ethereum-and-solana',
          walletList: [
            'metamask',
            'coinbase_wallet',
            'base_account',
            'rainbow',
            'phantom',
            'solflare',
            'backpack',
            'rabby_wallet',
            'safe',
          ],
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
