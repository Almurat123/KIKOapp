import { generateCdpJwt } from '../services/coinbaseCdp.js';
import * as unifiedApiService from '../config/unifiedApiService.js';

const COINBASE_CDP_API_HOST = 'api.cdp.coinbase.com';
const COINBASE_CDP_API_BASE_URL = '/platform/v2';

const apiKeyId = process.env.COINBASE_CDP_API_KEY_ID || process.env.COINBASE_CDP_KEY_NAME || '';
const apiKeySecret = process.env.COINBASE_CDP_API_KEY_SECRET || process.env.COINBASE_CDP_KEY_SECRET || '';
if (!apiKeyId || !apiKeySecret) {
  throw new Error('Missing COINBASE_CDP_API_KEY_ID / COINBASE_CDP_API_KEY_SECRET');
}

const targetUrl = process.env.CDP_WEBHOOK_TARGET_URL || '';
if (!targetUrl) {
  throw new Error('Missing CDP_WEBHOOK_TARGET_URL');
}

const contractAddress = (process.env.CDP_WEBHOOK_CONTRACT || '').toLowerCase();
if (!contractAddress) {
  throw new Error('Missing CDP_WEBHOOK_CONTRACT (factory address)');
}

const network = process.env.CDP_WEBHOOK_NETWORK || 'base-mainnet';
const headerName = process.env.CDP_WEBHOOK_AUTH_HEADER || '';
const headerValue = process.env.CDP_WEBHOOK_AUTH_VALUE || '';
const targetHeaders = headerName && headerValue ? { [headerName]: headerValue } : undefined;

async function cdpRequest<T>(method: 'POST', path: string, body?: any): Promise<T> {
  const jwt = await generateCdpJwt(apiKeyId, apiKeySecret, method, COINBASE_CDP_API_HOST, path);
  const url = `https://${COINBASE_CDP_API_HOST}${path}`;
  return unifiedApiService.fetchJson<T>({
    url,
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    requestTimeout: 15000,
    endpointName: 'coinbase-cdp-webhook',
    retry: { retries: 2, minTimeout: 800 },
  });
}

(async () => {
  const path = `${COINBASE_CDP_API_BASE_URL}/data/webhooks/subscriptions`;
  const payload: any = {
    eventTypes: ['onchain.activity.detected'],
    isEnabled: true,
    target: { url: targetUrl },
    labels: {
      network,
      contract_address: contractAddress
    },
    description: `Broad CDP webhook (${contractAddress.slice(0, 6)})`
  };
  if (targetHeaders) payload.target.headers = targetHeaders;

  const res = await cdpRequest<any>('POST', path, payload);
  console.log('[CDP] Created broad subscription:', JSON.stringify(res));
})();
