import { generateCdpJwt } from '../services/coinbaseCdp.js';
import * as unifiedApiService from '../config/unifiedApiService.js';

const COINBASE_CDP_API_HOST = 'api.cdp.coinbase.com';
const COINBASE_CDP_API_BASE_URL = '/platform/v2';

const apiKeyId = process.env.COINBASE_CDP_API_KEY_ID || process.env.COINBASE_CDP_KEY_NAME || '';
const apiKeySecret = process.env.COINBASE_CDP_API_KEY_SECRET || process.env.COINBASE_CDP_KEY_SECRET || '';
const overrideSecret = process.env.CDP_WEBHOOK_SECRET_OVERRIDE || process.env.COINBASE_CDP_WEBHOOK_SECRET || '';

if (!apiKeyId || !apiKeySecret) {
  throw new Error('Missing COINBASE_CDP_API_KEY_ID / COINBASE_CDP_API_KEY_SECRET');
}
if (!overrideSecret) {
  throw new Error('Missing CDP_WEBHOOK_SECRET_OVERRIDE (or COINBASE_CDP_WEBHOOK_SECRET)');
}

const targetUrl = process.env.CDP_WEBHOOK_TARGET_URL || '';
const headerName = process.env.CDP_WEBHOOK_AUTH_HEADER || '';
const headerValue = process.env.CDP_WEBHOOK_AUTH_VALUE || '';
const targetHeaders = headerName && headerValue ? { [headerName]: headerValue } : undefined;

async function cdpRequest<T>(method: 'GET' | 'PUT', path: string, body?: any): Promise<T> {
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
  eventTypes: string[];
  isEnabled: boolean;
  target: { url: string; headers?: Record<string, string> };
  labels?: Record<string, string>;
  labelKey?: string;
  labelValue?: string;
  description?: string;
}

async function listSubscriptions(): Promise<WebhookSubscription[]> {
  const path = `${COINBASE_CDP_API_BASE_URL}/data/webhooks/subscriptions`;
  const res = await cdpRequest<{ data?: WebhookSubscription[]; subscriptions?: WebhookSubscription[] }>('GET', path);
  return res?.subscriptions || res?.data || [];
}

async function updateSubscription(sub: WebhookSubscription) {
  const id = sub.subscriptionId || sub.id;
  if (!id) return false;

  const path = `${COINBASE_CDP_API_BASE_URL}/data/webhooks/subscriptions/${id}`;
  const payload: any = {
    description: sub.description || 'Updated webhook subscription',
    eventTypes: sub.eventTypes,
    isEnabled: true,
    target: {
      url: targetUrl || sub.target?.url,
    },
    metadata: {
      secret: overrideSecret,
    },
  };

  if (targetHeaders) {
    payload.target.headers = targetHeaders;
  } else if (sub.target?.headers) {
    payload.target.headers = sub.target.headers;
  }

  if (sub.labels) {
    payload.labels = sub.labels;
  } else if (sub.labelKey && sub.labelValue) {
    payload.labelKey = sub.labelKey;
    payload.labelValue = sub.labelValue;
  }

  await cdpRequest('PUT', path, payload);
  return true;
}

(async () => {
  const subs = await listSubscriptions();
  const filtered = targetUrl
    ? subs.filter(s => s.target?.url === targetUrl)
    : subs;

  let updated = 0;
  for (const sub of filtered) {
    try {
      const ok = await updateSubscription(sub);
      if (ok) updated += 1;
    } catch (err: any) {
      console.error('[CDP] Update failed', err?.message || err);
    }
  }

  console.log(`[CDP] Updated ${updated} subscriptions with shared secret.`);
})();
