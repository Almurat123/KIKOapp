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

export async function getPrivyAuthorizationConfig(): Promise<PrivyAuthorizationConfig> {
  const response = await fetch(`${API_URL}/api/config/auth-key-id`);
  if (!response.ok) {
    throw new Error('Authorization configuration unavailable.');
  }

  const data = await response.json();
  return {
    authKeyId: String(data.authKeyId || ''),
    policies: {
      autoTrading: {
        ethereum: data?.policies?.autoTrading?.ethereum || undefined,
        solana: data?.policies?.autoTrading?.solana || undefined,
      },
      billing: {
        ethereum: data?.policies?.billing?.ethereum || undefined,
      },
    },
  };
}
