import React from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { setAuthTokenProvider } from '../utils/authToken';

// Bridge Privy access token into API layer
export const AuthTokenBridge: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { getAccessToken, authenticated } = usePrivy();

  React.useEffect(() => {
    setAuthTokenProvider(async () => {
      if (!authenticated) return null;
      try {
        return await getAccessToken();
      } catch {
        return null;
      }
    });
  }, [authenticated, getAccessToken]);

  return <>{children}</>;
};
