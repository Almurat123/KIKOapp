import { generateCdpJwt } from '../services/coinbaseCdp.js';
import * as unifiedApiService from '../config/unifiedApiService.js';
import { getPreheatConfig } from '../config/preheat.js';

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

const headerName = process.env.CDP_WEBHOOK_AUTH_HEADER || '';
const headerValue = process.env.CDP_WEBHOOK_AUTH_VALUE || '';
const targetHeaders = headerName && headerValue ? { [headerName]: headerValue } : undefined;

function networkFromChainId(chainId: number): string {
  if (chainId === 8453) return 'base-mainnet';
  if (chainId === 1) return 'ethereum-mainnet';
  return `eip155:${chainId}`;
}

async function cdpRequest<T>(method: 'GET' | 'POST', path: string, body?: any): Promise<T> {
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

interface WebhookSubscription {
  subscriptionId?: string;
  id?: string;
  labels?: Record<string, string>;
  labelKey?: string;
  labelValue?: string;
  eventTypes?: string[];
  isEnabled?: boolean;
  target?: { url?: string; headers?: Record<string, string> };
}

async function listSubscriptions(): Promise<WebhookSubscription[]> {
  const path = `${COINBASE_CDP_API_BASE_URL}/data/webhooks/subscriptions`;
  const res = await cdpRequest<{ data?: WebhookSubscription[]; subscriptions?: WebhookSubscription[] }>('GET', path);
  return res?.subscriptions || res?.data || [];
}

function isBroadMatch(sub: WebhookSubscription, chainId: number, contract: string, url: string): boolean {
  const labels = sub.labels || (sub.labelKey && sub.labelValue ? { [sub.labelKey]: sub.labelValue } : {});
  const hasEventName = labels && 'event_name' in labels;
  const network = labels?.network;
  const contractLabel = labels?.contract_address;
  return (
    !hasEventName &&
    sub.target?.url === url &&
    contractLabel?.toLowerCase() === contract.toLowerCase() &&
    network === networkFromChainId(chainId)
  );
}

(async () => {
  const preheat = getPreheatConfig();
  const subs = await listSubscriptions();

  let created = 0;
  let skipped = 0;

  for (const chainId of preheat.chainIds) {
    const factories = preheat.factoryAllowlist[chainId] || [];
    const network = networkFromChainId(chainId);

    for (const factory of factories) {
      const exists = subs.some(sub => isBroadMatch(sub, chainId, factory, targetUrl));
      if (exists) {
        skipped += 1;
        continue;
      }

      const path = `${COINBASE_CDP_API_BASE_URL}/data/webhooks/subscriptions`;
      const payload: any = {
        eventTypes: ['onchain.activity.detected'],
        isEnabled: true,
        target: { url: targetUrl },
        labels: {
          network,
          contract_address: factory.toLowerCase()
        },
        description: `Broad CDP webhook (${factory.slice(0, 6)})`
      };
      if (targetHeaders) payload.target.headers = targetHeaders;

      await cdpRequest<any>('POST', path, payload);
      created += 1;
    }
  }

  console.log(`[CDP] Broad subscriptions created: ${created}, skipped: ${skipped}`);
})();
