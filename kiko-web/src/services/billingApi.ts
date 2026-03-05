import { getAuthToken } from '../utils/authToken';

const API_BASE_URL = import.meta.env.VITE_API_URL || (
  import.meta.env.PROD ? 'https://api.kiko.app' : 'http://localhost:3001'
);

async function authFetch(path: string, options: RequestInit = {}, authToken?: string | null) {
  const token = authToken ?? await getAuthToken();
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (import.meta.env.VITE_APP_KEY) {
    headers.set('X-App-Key', import.meta.env.VITE_APP_KEY);
  }
  headers.set('Content-Type', 'application/json');

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });
  return response;
}

export async function getBillingConsent() {
  const response = await authFetch('/api/billing/consent');
  if (!response.ok) {
    throw new Error('Failed to fetch billing consent');
  }
  return response.json() as Promise<{ active: boolean; termsVersion: string; consentId?: string }>;
}

export async function grantBillingConsent(source: string) {
  const response = await authFetch('/api/billing/consent', {
    method: 'POST',
    body: JSON.stringify({ source }),
  });
  if (!response.ok) {
    throw new Error('Failed to grant billing consent');
  }
  return response.json() as Promise<{ success: boolean; termsVersion: string }>;
}

export async function revokeBillingConsent() {
  const response = await authFetch('/api/billing/consent/revoke', {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to revoke billing consent');
  }
  return response.json() as Promise<{ success: boolean }>;
}

export async function getUsageSummary(authToken?: string | null) {
  const response = await authFetch('/api/billing/usage-summary', {}, authToken);
  if (!response.ok) {
    throw new Error('Failed to fetch usage summary');
  }
  return response.json() as Promise<{
    dateUtc: string;
    total: { used: number; limit: number };
    normal: { used: number; limit: number };
    advanced: { used: number; limit: number };
    tokenBalance: number;
  }>;
}
