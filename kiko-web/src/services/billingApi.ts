import { getAuthToken } from '../utils/authToken';
import { resolveCoreApiBase } from '../utils/coreApiBase';

const API_BASE_URL = resolveCoreApiBase();
const USAGE_SUMMARY_CACHE_TTL_MS = 30_000;

export interface UsageSummary {
  dateUtc: string;
  credits: {
    available: number;
    reserved: number;
    perUsd: number;
  };
  premiumTextFree: {
    used: number;
    limit: number;
    remaining: number;
  };
  generatedImageFree: {
    used: number;
    limit: number;
    remaining: number;
  };
  topUp: {
    mode: 'treasury_transfer' | 'router_contract';
    chainId: number;
    minimumUsd: number;
    paymentAddress: string | null;
    routerAddress: string | null;
    refundOperatorAddress: string | null;
    supportedAssets: Array<{
      symbol: string;
      tokenAddress?: string;
      decimals: number;
      requiredConfirmations: number;
      paymentAddress?: string;
      pricingMode: 'stable_1_to_1' | 'market_price';
    }>;
  };
  admin: {
    canManageRefunds: boolean;
  };
}

export interface CreditDepositItem {
  id: string;
  status: string;
  chainId: number;
  assetSymbol: string;
  txHash: string;
  amountHuman: number;
  paidCredits: number;
  bonusCredits: number;
  remainingPaidCredits: number;
  remainingBonusCredits: number;
  heldPaidCredits: number;
  heldBonusCredits: number;
  refundablePaidCredits: number;
  refundEligible: boolean;
  refundWindowExpiresAt: string | null;
  refundRequestId: string | null;
  refundRequestStatus: string | null;
  createdAt: string;
  creditedAt: string | null;
}

export interface CreditRefundItem {
  id: string;
  depositId: string;
  status: string;
  assetSymbol: string;
  requestedPaidCredits: number;
  reclaimedBonusCredits: number;
  refundAmountHuman: number;
  payoutTxHash: string | null;
  failureReason: string | null;
  approvedAt: string | null;
  approvedNote: string | null;
  approvedByUserId: string | null;
  resolvedByUserId: string | null;
  resolvedNote: string | null;
  requestedAt: string;
  resolvedAt: string | null;
}

export interface AdminCreditRefundItem extends CreditRefundItem {
  userId: string;
  refundToAddress: string;
  deposit: {
    txHash: string;
    fromAddress: string | null;
    toAddress: string | null;
    amountHuman: number;
    paidCredits: number;
    bonusCredits: number;
    remainingPaidCredits: number;
    remainingBonusCredits: number;
    createdAt: string;
    creditedAt: string | null;
  };
}

export interface CreditWatcherStatus {
  watcherKey: string;
  chainId: number;
  paymentAddress: string;
  cursorBlock: string | null;
  lastWebhookBlock: string | null;
  lastWebhookAt: string | null;
  lastReconciledAt: string | null;
  stats: Record<string, number> | null;
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
  return {
    active: false,
    deprecated: true,
  };
}

export async function grantBillingConsent(source: string) {
  void source;
  return {
    success: false,
    deprecated: true,
  };
}

export async function revokeBillingConsent() {
  return {
    success: false,
    deprecated: true,
  };
}

export async function getUsageSummary(
  authToken?: string | null,
  options: { forceFresh?: boolean } = {},
) {
  const token = authToken ?? await getAuthToken();
  const authKey = token || 'anonymous';
  const forceFresh = options.forceFresh === true;
  if (
    !forceFresh &&
    usageSummaryCache
    && usageSummaryCache.authKey === authKey
    && (Date.now() - usageSummaryCache.cachedAt) < USAGE_SUMMARY_CACHE_TTL_MS
  ) {
    return usageSummaryCache.data;
  }

  const inFlight = forceFresh ? null : usageSummaryInFlight.get(authKey);
  if (inFlight) return inFlight;

  const request = (async () => {
    const response = await authFetch('/api/billing/credits/summary', {}, token);
    if (!response.ok) {
      if (
        !forceFresh &&
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

  if (!forceFresh) {
    usageSummaryInFlight.set(authKey, request);
  }
  try {
    return await request;
  } finally {
    if (!forceFresh) {
      usageSummaryInFlight.delete(authKey);
    }
  }
}

export function invalidateBillingSummaryCache() {
  usageSummaryCache = null;
}

export async function getCreditDeposits(authToken?: string | null) {
  const response = await authFetch('/api/billing/deposits', {}, authToken);
  if (!response.ok) {
    throw new Error('Failed to fetch credit deposits');
  }
  const data = await response.json() as { items: CreditDepositItem[] };
  return data.items;
}

export async function getCreditRefunds(authToken?: string | null) {
  const response = await authFetch('/api/billing/refunds', {}, authToken);
  if (!response.ok) {
    throw new Error('Failed to fetch credit refunds');
  }
  const data = await response.json() as { items: CreditRefundItem[] };
  return data.items;
}

export async function requestCreditRefund(depositId: string, authToken?: string | null) {
  const response = await authFetch('/api/billing/refunds', {
    method: 'POST',
    body: JSON.stringify({ depositId }),
  }, authToken);
  if (!response.ok) {
    const data = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(data?.error || 'Failed to request refund');
  }
  invalidateBillingSummaryCache();
  return response.json();
}

export async function getAdminCreditRefunds(status = '', authToken?: string | null) {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const response = await authFetch(`/api/admin/billing/refunds${query}`, {}, authToken);
  if (!response.ok) {
    throw new Error('Failed to fetch admin refunds');
  }
  const data = await response.json() as { items: AdminCreditRefundItem[] };
  return data.items;
}

export async function approveAdminCreditRefund(refundRequestId: string, note?: string | null, authToken?: string | null) {
  const response = await authFetch(`/api/admin/billing/refunds/${encodeURIComponent(refundRequestId)}/approve-or-settle`, {
    method: 'POST',
    body: JSON.stringify({
      action: 'approve',
      note: note || undefined,
    }),
  }, authToken);
  if (!response.ok) {
    const data = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(data?.error || 'Failed to approve refund');
  }
  return response.json();
}

export async function settleAdminCreditRefund(refundRequestId: string, payoutTxHash: string, note?: string | null, authToken?: string | null) {
  const response = await authFetch(`/api/admin/billing/refunds/${encodeURIComponent(refundRequestId)}/approve-or-settle`, {
    method: 'POST',
    body: JSON.stringify({
      action: 'settle',
      payoutTxHash,
      note: note || undefined,
    }),
  }, authToken);
  if (!response.ok) {
    const data = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(data?.error || 'Failed to settle refund');
  }
  return response.json();
}

export async function rejectAdminCreditRefund(refundRequestId: string, failureReason: string, note?: string | null, authToken?: string | null) {
  const response = await authFetch(`/api/admin/billing/refunds/${encodeURIComponent(refundRequestId)}/reject`, {
    method: 'POST',
    body: JSON.stringify({
      failureReason,
      note: note || undefined,
    }),
  }, authToken);
  if (!response.ok) {
    const data = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(data?.error || 'Failed to reject refund');
  }
  return response.json();
}

export async function getCreditWatcherMonitor(authToken?: string | null) {
  const response = await authFetch('/api/admin/billing/monitor', {}, authToken);
  if (!response.ok) {
    throw new Error('Failed to fetch credit watcher monitor');
  }
  const data = await response.json() as { watcher: CreditWatcherStatus | null };
  return data.watcher;
}
