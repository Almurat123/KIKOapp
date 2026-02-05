import { generateCdpJwt } from '../services/coinbaseCdp.js';
import { getPreheatConfig } from '../config/preheat.js';
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
  throw new Error('Missing CDP_WEBHOOK_TARGET_URL (your Railway webhook URL)');
}

const network = process.env.CDP_WEBHOOK_NETWORK || 'base-mainnet';
const headerName = process.env.CDP_WEBHOOK_AUTH_HEADER || '';
const headerValue = process.env.CDP_WEBHOOK_AUTH_VALUE || '';
const targetHeaders = headerName && headerValue ? { [headerName]: headerValue } : undefined;
const preheat = getPreheatConfig();
const baseFactories = preheat.factoryAllowlist[8453] || [];

const EVENT_NAME_MAP: Record<string, string> = {
  tokencreated: 'TokenCreated',
  newtoken: 'NewToken',
  createdtoken: 'CreatedToken',
  tokendeployed: 'TokenDeployed',
  deployedtoken: 'DeployedToken',
  prelaunched: 'PreLaunched',
  launched: 'Launched',
  deployed: 'Deployed',
  graduated: 'Graduated',
  paircreated: 'PairCreated',
};

function canonicalEventName(name: string): string {
  const key = name.trim().toLowerCase();
  return EVENT_NAME_MAP[key] || name;
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
  id: string;
  eventTypes: string[];
  isEnabled: boolean;
  target: { url: string };
  labels?: Record<string, string>;
  metadata?: { secret?: string };
}

async function listSubscriptions(): Promise<WebhookSubscription[]> {
  const path = `${COINBASE_CDP_API_BASE_URL}/data/webhooks/subscriptions`;
  const res = await cdpRequest<{ data: WebhookSubscription[] }>('GET', path);
  return res?.data || [];
}

async function createSubscription(payload: any): Promise<WebhookSubscription> {
  const path = `${COINBASE_CDP_API_BASE_URL}/data/webhooks/subscriptions`;
  return cdpRequest<WebhookSubscription>('POST', path, payload);
}

function buildKey(labels: Record<string, string>, url: string): string {
  const ordered = Object.keys(labels).sort().map(k => `${k}:${labels[k]}`).join('|');
  return `${url}|${ordered}`;
}

(async () => {
  const events = Array.from(new Set(preheat.eventNames.map(canonicalEventName)));
  if (events.length === 0) {
    throw new Error('No preheat event names configured.');
  }
  if (baseFactories.length === 0) {
    throw new Error('No Base factory addresses configured for preheat.');
  }

  const existing = await listSubscriptions();
  const existingKeys = new Set(
    existing.map(s => buildKey(s.labels || {}, s.target?.url || ''))
  );

  const created: WebhookSubscription[] = [];

  for (const factory of baseFactories) {
    for (const eventName of events) {
      const labels = {
        network,
        contract_address: factory,
        event_name: eventName,
      };
      const key = buildKey(labels, targetUrl);
      if (existingKeys.has(key)) {
        continue;
      }

      const payload: any = {
        eventTypes: ['onchain.activity.detected'],
        isEnabled: true,
        target: { url: targetUrl },
        labels,
        description: `Preheat ${eventName} (${factory.slice(0, 6)})`,
      };
      if (targetHeaders) {
        payload.target.headers = targetHeaders;
      }

      const sub = await createSubscription(payload);
      created.push(sub);
      existingKeys.add(key);
      if (sub?.metadata?.secret) {
        console.log(`[CDP] Created subscription ${sub.id} secret=${sub.metadata.secret}`);
      } else {
        console.log(`[CDP] Created subscription ${sub.id}`);
      }
    }
  }

  console.log(`[CDP] Done. Created ${created.length} subscriptions. Existing ${existing.length}.`);
})();
