import { useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useLoginToMiniApp } from '@privy-io/react-auth/farcaster';
import { sdk } from '@farcaster/miniapp-sdk';
import { useMiniAppContext } from '../contexts/MiniAppContext';

let miniAppLoginPromise: Promise<void> | null = null;

export function useAppLogin(): { login: () => void } {
  const { authenticated, login: loginWithPrivy } = usePrivy();
  const { isMiniApp, loading } = useMiniAppContext();
  const { initLoginToMiniApp, loginToMiniApp } = useLoginToMiniApp();

  const login = useCallback(() => {
    if (authenticated || loading) return;

    if (!isMiniApp) {
      loginWithPrivy();
      return;
    }

    if (miniAppLoginPromise) return;

    miniAppLoginPromise = (async () => {
      const { nonce } = await initLoginToMiniApp();
      const result = await sdk.actions.signIn({
        nonce,
        acceptAuthAddress: true,
      });

      await loginToMiniApp({
        message: result.message,
        signature: result.signature,
      });
    })().finally(() => {
      miniAppLoginPromise = null;
    });
  }, [authenticated, initLoginToMiniApp, isMiniApp, loading, loginToMiniApp, loginWithPrivy]);

  return { login };
}
