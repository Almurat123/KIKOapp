import { ethers } from 'ethers';
import type { RpcEndpointConfig } from '../../config/apiEndpoints.js';
import type { RpcImportance } from './types.js';
import type { RpcPurpose } from './purpose.js';

const RPC_TIMEOUT_MS = Number(process.env.RPC_TIMEOUT_MS || '10000');
const RPC_TIMEOUT_FAST_MS = Number(process.env.RPC_TIMEOUT_FAST_MS || '2500');
const RPC_TIMEOUT_CRITICAL_MS = Number(process.env.RPC_TIMEOUT_CRITICAL_MS || '1500');
const RPC_CRITICAL_HEDGE_ALLOW_WRITE = (process.env.RPC_CRITICAL_HEDGE_ALLOW_WRITE || 'false') === 'true';
const RPC_FORCE_EXHAUSTIVE_ETH_CALL_CRITICAL = (process.env.RPC_FORCE_EXHAUSTIVE_ETH_CALL_CRITICAL || 'false') === 'true';
const RPC_MAX_ENDPOINT_ATTEMPTS_NORMAL = Math.max(1, Number(process.env.RPC_MAX_ENDPOINT_ATTEMPTS_NORMAL || '3'));
const RPC_MAX_ENDPOINT_ATTEMPTS_CRITICAL = Math.max(1, Number(process.env.RPC_MAX_ENDPOINT_ATTEMPTS_CRITICAL || '4'));
const RPC_MAX_ENDPOINT_ATTEMPTS_WRITE = Math.max(1, Number(process.env.RPC_MAX_ENDPOINT_ATTEMPTS_WRITE || '4'));
const RPC_MAX_ENDPOINT_ATTEMPTS_ETH_CALL_NORMAL = Math.max(1, Number(process.env.RPC_MAX_ENDPOINT_ATTEMPTS_ETH_CALL_NORMAL || '2'));
const RPC_MAX_ENDPOINT_ATTEMPTS_ETH_CALL_CRITICAL = Math.max(1, Number(process.env.RPC_MAX_ENDPOINT_ATTEMPTS_ETH_CALL_CRITICAL || '2'));
const RPC_CONCURRENCY_NORMAL = Math.max(1, Number(process.env.RPC_CONCURRENCY_NORMAL || '28'));
const RPC_CONCURRENCY_CRITICAL = Math.max(1, Number(process.env.RPC_CONCURRENCY_CRITICAL || '56'));
const RPC_CONCURRENCY_WRITE = Math.max(1, Number(process.env.RPC_CONCURRENCY_WRITE || '10'));
const RPC_CONCURRENCY_ETH_CALL_NORMAL = Math.max(1, Number(process.env.RPC_CONCURRENCY_ETH_CALL_NORMAL || '14'));
const RPC_CONCURRENCY_ETH_CALL_CRITICAL = Math.max(1, Number(process.env.RPC_CONCURRENCY_ETH_CALL_CRITICAL || '8'));
const RPC_CRITICAL_POOL_CONCURRENCY = Math.max(1, Number(process.env.RPC_CRITICAL_POOL_CONCURRENCY || '64'));
const RPC_BEST_EFFORT_POOL_CONCURRENCY = Math.max(1, Number(process.env.RPC_BEST_EFFORT_POOL_CONCURRENCY || '20'));
const RPC_CRITICAL_MAX_INFLIGHT_BURST = Math.max(0, Number(process.env.RPC_CRITICAL_MAX_INFLIGHT_BURST || '2'));
const RPC_METHOD_COOLDOWN_ATTEMPT_CAP = Math.max(1, Number(process.env.RPC_METHOD_COOLDOWN_ATTEMPT_CAP || '1'));
const RPC_METHOD_COOLDOWN_BASE_MS = Math.max(0, Number(process.env.RPC_METHOD_COOLDOWN_BASE_MS || '250'));
const RPC_METHOD_COOLDOWN_MAX_MS = Math.max(RPC_METHOD_COOLDOWN_BASE_MS, Number(process.env.RPC_METHOD_COOLDOWN_MAX_MS || '4000'));

export function isWriteMethod(method: string): boolean {
  return (
    method === 'eth_sendRawTransaction'
    || method === 'eth_sendTransaction'
    || method === 'sendTransaction'
    || method === 'simulateTransaction'
  );
}

export function inferRpcClass(method: string, importance: RpcImportance): 'critical_tx' | 'best_effort_read' {
  if (
    method === 'eth_sendRawTransaction'
    || method === 'eth_sendTransaction'
    || method === 'sendTransaction'
    || method === 'eth_getTransactionByHash'
    || method === 'eth_getTransactionReceipt'
    || method === 'eth_getTransactionCount'
    || method === 'eth_estimateGas'
    || method === 'eth_feeHistory'
    || method === 'eth_gasPrice'
  ) {
    return 'critical_tx';
  }
  if (method === 'eth_call') return 'best_effort_read';
  return importance === 'critical' ? 'critical_tx' : 'best_effort_read';
}

export function resolveRpcTimeoutMs(
  method: string,
  options: { strategy?: 'fast' | 'cheap'; importance?: RpcImportance }
): number {
  const effectiveImportance: RpcImportance =
    options.importance || (options.strategy === 'fast' ? 'critical' : 'normal');

  if (effectiveImportance === 'critical') {
    if (method === 'eth_getTransactionByHash' || method === 'eth_getTransactionReceipt') {
      return Math.min(RPC_TIMEOUT_CRITICAL_MS, RPC_TIMEOUT_FAST_MS);
    }
    return RPC_TIMEOUT_CRITICAL_MS;
  }

  if (options.strategy === 'fast') return RPC_TIMEOUT_FAST_MS;
  return RPC_TIMEOUT_MS;
}

export function isNonRetryableRpcErrorMessage(message: string): boolean {
  const msg = String(message || '').toLowerCase();
  if (!msg) return false;
  return (
    msg.includes('execution reverted')
    || msg.includes('invalid opcode')
    || msg.includes('out of gas')
    || msg.includes('insufficient funds for gas * price + value')
    || msg.includes('insufficient funds')
  );
}

export function shouldCoalesceMethod(method: string): boolean {
  return !isWriteMethod(method) || method === 'eth_sendRawTransaction';
}

export function shouldTreatSendRawErrorAsKnown(message: string): boolean {
  const msg = String(message || '').toLowerCase();
  if (!msg) return false;
  return (
    msg.includes('already known')
    || msg.includes('known transaction')
    || msg.includes('already imported')
    || msg.includes('already exists')
  );
}

export function getPrimaryRpcUrl(chainSlug: string): string | undefined {
  const envKey = {
    eth: 'ETH_RPC_URL',
    base: 'BASE_RPC_URL',
    bsc: 'BSC_RPC_URL',
    polygon: 'POLYGON_RPC_URL',
    arbitrum: 'ARBITRUM_RPC_URL',
    optimism: 'OPTIMISM_RPC_URL',
    solana: 'SOLANA_RPC_URL',
  }[chainSlug];
  return envKey ? process.env[envKey] : undefined;
}

export function isPublicFreeEndpoint(endpoint: RpcEndpointConfig): boolean {
  return endpoint.type === 'public_free';
}

export function filterEndpointsForPurpose(endpoints: RpcEndpointConfig[], purpose: RpcPurpose): RpcEndpointConfig[] {
  if (purpose === 'polling_background' || purpose === 'background_reconcile' || purpose === 'preheat') {
    return endpoints.filter((endpoint) => endpoint.type === 'public_free' || endpoint.type === 'fallback');
  }
  if (purpose === 'trade_execution') {
    return endpoints.filter((endpoint) => endpoint.type === 'premium' || endpoint.type === 'fallback');
  }
  return endpoints;
}

export function countSelectedFreeEndpoints(endpoints: RpcEndpointConfig[]): number {
  return endpoints.filter((endpoint) => endpoint.type === 'public_free').length;
}

export { forceOpenEndpointCircuit } from './rpcState.js';

export function normalizeRawTx(rawTx: string): string | null {
  if (typeof rawTx !== 'string' || rawTx.length === 0) return null;
  const normalized = rawTx.startsWith('0x') ? rawTx : `0x${rawTx}`;
  if (!/^0x[0-9a-fA-F]+$/.test(normalized)) return null;
  return normalized.toLowerCase();
}

export function tryGetRawTxHash(rawTx: string): string | null {
  const normalized = normalizeRawTx(rawTx);
  if (!normalized) return null;
  try {
    return ethers.keccak256(normalized as `0x${string}`).toLowerCase();
  } catch {
    return null;
  }
}

export function createStableRequestKey(chainId: number, method: string, params: any, maxLen = 2048): string {
  const seen = new WeakSet<object>();
  const serialized = JSON.stringify(params, (_key, value) => {
    if (typeof value === 'bigint') return `bigint:${value.toString()}`;
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value;
    if (seen.has(value)) return '__cycle__';
    seen.add(value);
    return Object.keys(value).sort().reduce((acc, itemKey) => {
      (acc as Record<string, any>)[itemKey] = (value as Record<string, any>)[itemKey];
      return acc;
    }, {} as Record<string, any>);
  }) || '__no_params__';

  let key = `${chainId}:${method}:${serialized}`;
  if (key.length > maxLen) {
    key = `${chainId}:${method}:${Buffer.from(serialized).toString('base64url').slice(0, maxLen)}`;
  }
  return key;
}

export function buildMethodBackoffKey(
  chainId: number,
  executionLane: 'cheap' | 'critical',
  method: string,
  importance: RpcImportance = 'normal',
  rpcClass: 'critical_tx' | 'best_effort_read' = 'best_effort_read'
): string {
  return `${chainId}:${executionLane}:${method}:${importance}:${rpcClass}`;
}

export function getMethodConcurrencyLimit(
  method: string,
  importance: RpcImportance,
  cooldownActive: boolean,
  rpcClass: 'critical_tx' | 'best_effort_read'
): number {
  let base = rpcClass === 'critical_tx'
    ? RPC_CRITICAL_POOL_CONCURRENCY
    : RPC_BEST_EFFORT_POOL_CONCURRENCY;

  if (rpcClass === 'critical_tx') {
    base = method === 'eth_call'
      ? (importance === 'critical' ? RPC_CONCURRENCY_ETH_CALL_CRITICAL : RPC_CONCURRENCY_ETH_CALL_NORMAL)
      : (isWriteMethod(method)
        ? RPC_CONCURRENCY_WRITE
        : (importance === 'critical' ? RPC_CONCURRENCY_CRITICAL : RPC_CONCURRENCY_NORMAL));
  }

  if (cooldownActive) {
    if (importance === 'critical') {
      base = Math.max(2, Math.floor(base * 0.75));
    } else {
      base = Math.max(1, Math.floor(base / 2));
    }
  }
  return base;
}

export function shouldForceExhaustiveFailover(
  method: string,
  importance: RpcImportance,
  options?: { exhaustiveFailover?: boolean },
  purpose?: RpcPurpose
): boolean {
  if (options?.exhaustiveFailover === true) return true;
  if (importance !== 'critical') return false;
  if (purpose === 'tx_visibility' || purpose === 'trade_execution') {
    return method === 'eth_call'
      || method === 'eth_estimateGas'
      || method === 'eth_sendRawTransaction'
      || method === 'eth_getTransactionByHash'
      || method === 'eth_getTransactionReceipt'
      || method === 'eth_getTransactionCount'
      || method === 'eth_feeHistory'
      || method === 'eth_gasPrice'
      || method === 'eth_maxPriorityFeePerGas';
  }
  if (method === 'eth_call') return RPC_FORCE_EXHAUSTIVE_ETH_CALL_CRITICAL;
  return method === 'eth_estimateGas'
    || method === 'eth_sendRawTransaction'
    || method === 'eth_getTransactionByHash'
    || method === 'eth_getTransactionReceipt';
}

export function isResilientEthCallPath(method: string, path: string, importance: RpcImportance): boolean {
  if (method !== 'eth_call') return false;
  return importance === 'critical' || new Set([
    'direct_swap',
    'confirm_wait',
    'token_metadata',
    'token_decimals',
    'token_supply',
    'token_supply_market_cap',
  ]).has(String(path || 'default'));
}

export function getEndpointAttemptBudget(
  method: string,
  importance: RpcImportance,
  endpointCount: number,
  cooldownActive: boolean,
  forceExhaustive = false,
  path = 'default'
): number {
  const isTxLifecycleMethod = method === 'eth_sendRawTransaction'
    || method === 'eth_getTransactionByHash'
    || method === 'eth_getTransactionReceipt';
  if (isTxLifecycleMethod && importance === 'critical') {
    return Math.max(1, Math.min(endpointCount, 7));
  }

  const ethCallBudget = method === 'eth_call'
    ? (importance === 'critical' ? RPC_MAX_ENDPOINT_ATTEMPTS_ETH_CALL_CRITICAL : RPC_MAX_ENDPOINT_ATTEMPTS_ETH_CALL_NORMAL)
    : null;
  const baseBudget = ethCallBudget ?? (isWriteMethod(method)
    ? RPC_MAX_ENDPOINT_ATTEMPTS_WRITE
    : (importance === 'critical' ? RPC_MAX_ENDPOINT_ATTEMPTS_CRITICAL : RPC_MAX_ENDPOINT_ATTEMPTS_NORMAL));
  let budget = Math.max(1, Math.min(endpointCount, baseBudget));

  if (cooldownActive && !isTxLifecycleMethod) {
    const cooldownAttemptCap = isResilientEthCallPath(method, path, importance)
      ? Math.max(2, RPC_METHOD_COOLDOWN_ATTEMPT_CAP)
      : importance === 'critical'
      ? (isWriteMethod(method)
        ? Math.max(3, RPC_METHOD_COOLDOWN_ATTEMPT_CAP)
        : Math.max(2, RPC_METHOD_COOLDOWN_ATTEMPT_CAP))
      : RPC_METHOD_COOLDOWN_ATTEMPT_CAP;
    budget = Math.max(1, Math.min(budget, cooldownAttemptCap));
  }

  if (isResilientEthCallPath(method, path, importance)) {
    budget = Math.max(budget, Math.min(endpointCount, 3));
  }

  if (forceExhaustive) return Math.max(1, endpointCount);
  return budget;
}

export function expandEthCallSelectionWithCheapFallback(params: {
  method: string;
  path: string;
  importance: RpcImportance;
  selectedEndpoints: RpcEndpointConfig[];
  chainSlug: string;
  primaryUrl?: string;
  getRpcEndpointsWithStrategy: (chainSlug: string, strategy: 'fast' | 'cheap', primaryUrl?: string) => RpcEndpointConfig[];
  filterEndpointsByMethod: (endpoints: RpcEndpointConfig[], method: string) => RpcEndpointConfig[];
}): RpcEndpointConfig[] {
  if (!isResilientEthCallPath(params.method, params.path, params.importance)) {
    return params.selectedEndpoints;
  }
  const hasPublic = params.selectedEndpoints.some((endpoint) => endpoint.type === 'public_free');
  if (hasPublic) return params.selectedEndpoints;

  const cheapEndpoints = params.filterEndpointsByMethod(
    params.getRpcEndpointsWithStrategy(params.chainSlug, 'cheap', params.primaryUrl),
    params.method
  ).filter((endpoint) => endpoint.type === 'public_free');

  if (!cheapEndpoints.length) return params.selectedEndpoints;

  const seen = new Set(params.selectedEndpoints.map((endpoint) => endpoint.url));
  const expanded = [...params.selectedEndpoints];
  for (const endpoint of cheapEndpoints) {
    if (!endpoint?.url || seen.has(endpoint.url)) continue;
    seen.add(endpoint.url);
    expanded.push(endpoint);
    if (expanded.length >= params.selectedEndpoints.length + 2) break;
  }
  return expanded;
}

export function expandCriticalSelectionWithPublicFallback(params: {
  executionLane: 'cheap' | 'critical';
  selectedEndpoints: RpcEndpointConfig[];
  chainSlug: string;
  primaryUrl?: string;
  method: string;
  getRpcEndpointsForLane: (chainSlug: string, lane: 'cheap' | 'critical', primaryUrl?: string) => RpcEndpointConfig[];
  filterEndpointsByMethod: (endpoints: RpcEndpointConfig[], method: string) => RpcEndpointConfig[];
  isCircuitOpen: (url: string) => boolean;
}): RpcEndpointConfig[] {
  if (params.executionLane !== 'critical') {
    return params.selectedEndpoints;
  }
  if (params.selectedEndpoints.some((endpoint) => endpoint.type === 'public_free')) {
    return params.selectedEndpoints;
  }

  const premiumSelected = params.selectedEndpoints.filter((endpoint) => endpoint.type === 'premium');
  if (premiumSelected.length === 0) {
    return params.selectedEndpoints;
  }

  const alwaysIncludePublicFallback = params.method === 'eth_getTransactionByHash'
    || params.method === 'eth_getTransactionReceipt';
  const allPremiumCircuited = premiumSelected.every((endpoint) => params.isCircuitOpen(endpoint.url));
  if (!alwaysIncludePublicFallback && !allPremiumCircuited) {
    return params.selectedEndpoints;
  }

  const cheapPublicEndpoints = params.filterEndpointsByMethod(
    params.getRpcEndpointsForLane(params.chainSlug, 'cheap', params.primaryUrl),
    params.method
  ).filter((endpoint) => endpoint.type === 'public_free');

  if (!cheapPublicEndpoints.length) {
    return params.selectedEndpoints;
  }

  const seen = new Set(params.selectedEndpoints.map((endpoint) => endpoint.url));
  const expanded = [...params.selectedEndpoints];
  for (const endpoint of cheapPublicEndpoints) {
    if (!endpoint?.url || seen.has(endpoint.url)) continue;
    seen.add(endpoint.url);
    expanded.push(endpoint);
    if (expanded.length >= params.selectedEndpoints.length + 2) break;
  }
  return expanded;
}
