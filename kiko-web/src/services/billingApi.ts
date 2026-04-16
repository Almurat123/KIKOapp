import { getAuthToken } from '../utils/authToken';
import { resolveCoreApiBase } from '../utils/coreApiBase';

const API_BASE_URL = resolveCoreApiBase();
const USAGE_SUMMARY_CACHE_TTL_MS = 30_000;

interface UsageSummary {
  dateUtc: string;
  total: { used: number; limit: number | null };
  free: { used: number; limit: number | null };
  premium: { used: number; limit: number };
  models?: Array<{
    model: string;
    used: number;
    limit: number | null;
    category: 'free' | 'premium' | 'other';
    limitSource: 'free_unlimited' | 'free_shared' | 'premium_shared' | 'none';
  }>;
  usesPremiumSharedLimit: boolean;
}

interface UsageSummaryCacheEntry {
  authKey: string;
  data: UsageSummary;
  cachedAt: number;
}

let usageSummaryCache: UsageSummaryCacheEntry | null = null;
const usageSummaryInFlight = new Map<string, Promise<UsageSummary>>();

// CONTEXT MEMORY
// Updated: 2026-04-16
// Author: Rowan
// Reason: Sidebar was refreshing billing usage on focus/visibility and turning
//         quick tab switches into repeated authenticated reads. The server now
//         exposes free-model usage plus an optional shared free cap and one
//         shared premium quota, so this layer must preserve the free/premium
//         envelope instead of flattening it back to the old category-only shape.
// Goal: keep billing summary accurate enough for UI display while avoiding
//       redundant refetches during normal navigation churn and preserve the
//       server-provided quota shape.
// Owns: Billing summary read dedupe and short-lived reuse for the sidebar.
// Does Not Own: Billing consent mutations, server-side quota computation, or
//       page-level refresh intent beyond this module.
// Design Language:
// - focus-driven refreshes should reuse a recent summary instead of refetching immediately
// - identical usage-summary reads must share one request
// - server-provided free/premium rows must not be collapsed into guessed client buckets
// - `free.limit === null` means free-model traffic is unlimited at the KIKO layer
// - forbidden local patch patterns: focus listeners that always hit the network
// Document Provenance:
// - Source: /Users/almurat/KiKo/kiko-api/src/routes/billing.ts
// - Kind: repo doc
// - Retrieved: 2026-04-16
// - Applied To: preserving the server-provided free/premium quota summary shape
// - Verification: verified in code
// - Source: operator quota-policy correction for optional free-model cap
// - Kind: product doc
// - Retrieved: 2026-04-16
// - Applied To: preserving nullable free-model limit from the summary API
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-navigation-burst-read-throttle.md
// - Kind: repo doc
// - Retrieved: 2026-04-10
// - Applied To: short-lived summary reuse and in-flight request dedupe
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/chat-usage-quota-policy.md
// - /Users/almurat/KiKo/system-journal/owner-map/chat-usage-quota.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-free-premium-chat-usage-quota-rework.md
// - /Users/almurat/KiKo/system-journal/design-language/loading-resilience.md
// - /Users/almurat/KiKo/system-journal/owner-map/frontend-data-loading.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-navigation-burst-read-throttle.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

async function authFetch(path: string, options: RequestInit = {}, authToken?: string | null) {
  const token = authToken ?? await getAuthToken();
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
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
  const token = authToken ?? await getAuthToken();
  const authKey = token || 'anonymous';
  if (
    usageSummaryCache
    && usageSummaryCache.authKey === authKey
    && (Date.now() - usageSummaryCache.cachedAt) < USAGE_SUMMARY_CACHE_TTL_MS
  ) {
    return usageSummaryCache.data;
  }

  const inFlight = usageSummaryInFlight.get(authKey);
  if (inFlight) return inFlight;

  const request = (async () => {
    const response = await authFetch('/api/billing/usage-summary', {}, token);
    if (!response.ok) {
      if (
        usageSummaryCache
        && usageSummaryCache.authKey === authKey
        && (Date.now() - usageSummaryCache.cachedAt) < USAGE_SUMMARY_CACHE_TTL_MS
      ) {
        return usageSummaryCache.data;
      }
      throw new Error('Failed to fetch usage summary');
    }
    const data = await response.json() as UsageSummary;
    usageSummaryCache = {
      authKey,
      data,
      cachedAt: Date.now(),
    };
    return data;
  })();

  usageSummaryInFlight.set(authKey, request);
  try {
    return await request;
  } finally {
    usageSummaryInFlight.delete(authKey);
  }
}
