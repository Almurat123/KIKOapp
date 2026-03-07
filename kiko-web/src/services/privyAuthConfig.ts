import { getAuthToken } from '../utils/authToken';

export interface PrivyAuthorizationConfig {
  authKeyId: string;
  policies: {
    autoTrading: {
      ethereum?: string;
      solana?: string;
    };
    billing: {
      ethereum?: string;
    };
  };
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

function firstNonEmptyString(values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }
  return undefined;
}

export async function getPrivyAuthorizationConfig(): Promise<PrivyAuthorizationConfig> {
  const authToken = await getAuthToken();
  if (!authToken) {
    throw new Error('Authentication required for authorization configuration.');
  }

  const response = await fetch(`${API_URL}/api/config/auth-key-id`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });
  if (!response.ok) {
    throw new Error('Authorization configuration unavailable.');
  }

  const data = await response.json();
  const autoTrading = data?.policies?.autoTrading || {};
  const billing = data?.policies?.billing || {};

  const ethereumPolicy = firstNonEmptyString([
    autoTrading?.ethereum,
    autoTrading?.evm,
    autoTrading?.eth,
    data?.policies?.ethereum,
    data?.policyIds?.autoTrading?.ethereum,
    data?.policyIds?.autoTrading?.evm,
    data?.policyIds?.autoTrading,
  ]);

  const solanaPolicy = firstNonEmptyString([
    autoTrading?.solana,
    autoTrading?.sol,
    data?.policies?.solana,
    data?.policyIds?.autoTrading?.solana,
    data?.policyIds?.autoTrading?.sol,
  ]);

  const billingPolicy = firstNonEmptyString([
    billing?.ethereum,
    billing?.evm,
    data?.policyIds?.billing?.ethereum,
    data?.policyIds?.billing,
    ethereumPolicy,
  ]);

  return {
    authKeyId: firstNonEmptyString([data?.authKeyId, data?.authorizationKeyId]) || '',
    policies: {
      autoTrading: {
        ethereum: ethereumPolicy,
        solana: solanaPolicy,
      },
      billing: {
        ethereum: billingPolicy,
      },
    },
  };
}
