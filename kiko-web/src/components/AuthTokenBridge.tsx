import React from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { setAuthTokenProvider } from '../utils/authToken';

// Bridge Privy access token into API layer
export const AuthTokenBridge: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { getAccessToken } = usePrivy();

  React.useEffect(() => {
    setAuthTokenProvider(async () => {
      try {
        return await getAccessToken();
      } catch {
        return null;
      }
    });
  }, [getAccessToken]);

  return <>{children}</>;
};
