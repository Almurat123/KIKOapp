import { useEffect, useRef } from 'react';
import { usePrivy, useCreateWallet as useCreateEthereumWallet } from '@privy-io/react-auth';
import { useCreateWallet as useCreateSolanaWallet } from '@privy-io/react-auth/solana';
import { useMiniAppContext } from '../contexts/MiniAppContext';
import { usePrivyEmbeddedWallets } from '../hooks/usePrivyEmbeddedWallets';
import { useAppLogin } from '../hooks/useAppLogin';

export function MiniAppPrivyBootstrap() {
  const { authenticated, ready, user } = usePrivy();
  const { isMiniApp, loading } = useMiniAppContext();
  const { login } = useAppLogin();
  const { createWallet: createEthereumWallet } = useCreateEthereumWallet();
  const { createWallet: createSolanaWallet } = useCreateSolanaWallet();
  const { evmWallet, solanaWallet } = usePrivyEmbeddedWallets();
  const autoLoginAttemptedRef = useRef(false);
  const walletProvisioningKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (authenticated) {
      autoLoginAttemptedRef.current = false;
      return;
    }

    if (loading || !isMiniApp || !ready || autoLoginAttemptedRef.current) {
      return;
    }

    autoLoginAttemptedRef.current = true;
    login();
  }, [authenticated, isMiniApp, loading, login, ready]);

  useEffect(() => {
    if (!isMiniApp || !ready || !authenticated || !user?.id) {
      return;
    }

    if (evmWallet?.address && solanaWallet?.address) {
      walletProvisioningKeyRef.current = null;
      return;
    }

    const provisioningKey = [
      user.id,
      evmWallet?.address || 'missing-evm',
      solanaWallet?.address || 'missing-solana',
    ].join(':');

    if (walletProvisioningKeyRef.current === provisioningKey) {
      return;
    }

    walletProvisioningKeyRef.current = provisioningKey;
    let cancelled = false;

    void (async () => {
      try {
        if (!evmWallet?.address) {
          await createEthereumWallet();
        }

        if (!cancelled && !solanaWallet?.address) {
          await createSolanaWallet();
        }
      } catch {
        // Best-effort provisioning only. If dashboard allowed domains/cookies are
        // misconfigured, this should not block the authenticated Mini App session.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    authenticated,
    createEthereumWallet,
    createSolanaWallet,
    evmWallet?.address,
    isMiniApp,
    ready,
    solanaWallet?.address,
    user?.id,
  ]);

  return null;
}
