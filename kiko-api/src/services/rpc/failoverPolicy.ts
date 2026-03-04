import type { RpcEndpointConfig } from '../../config/apiEndpoints.js';

export function extendCheapBudgetToIncludePremiumFallback(params: {
  strategy: 'fast' | 'cheap';
  sortedEndpoints: RpcEndpointConfig[];
  endpointBudget: number;
  forceExhaustiveFailover: boolean;
}): number {
  if (params.strategy !== 'cheap') return params.endpointBudget;
  if (params.forceExhaustiveFailover) return params.endpointBudget;
  const premiumIndex = params.sortedEndpoints.findIndex((endpoint) => endpoint.type === 'premium');
  if (premiumIndex < 0) return params.endpointBudget;
  const requiredBudget = premiumIndex + 1;
  if (params.endpointBudget >= requiredBudget) return params.endpointBudget;
  return Math.min(params.sortedEndpoints.length, requiredBudget);
}

export function isRateLimitedFailure(message: string): boolean {
  const lower = String(message || '').toLowerCase();
  if (!lower) return false;
  return (
    lower.includes('http 429')
    || lower.includes('too many requests')
    || lower.includes('rate limit')
    || lower.includes('capacity_limited:rps')
    || lower.includes('capacity_limited:rpm')
    || lower.includes('capacity_limited:maxinflight')
  );
}

export function shouldSkipFailoverDelay(message: string): boolean {
  const lower = String(message || '').toLowerCase();
  return (
    isRateLimitedFailure(lower)
    || lower === 'circuit_open'
    || lower === 'endpoint_method_timeout_cooldown'
    || lower.startsWith('capacity_limited:')
  );
}

export function classifyFailoverReason(message: string): string {
  const lower = String(message || '').toLowerCase();
  if (!lower) return 'unknown';
  if (isRateLimitedFailure(lower)) return 'rate_limited';
  if (lower === 'circuit_open' || lower.includes('all_endpoints_circuit_open')) return 'circuit_open';
  if (lower === 'endpoint_method_timeout_cooldown') return 'timeout_cooldown';
  if (lower.includes('aborterror') || lower.includes('timeout')) return 'timeout';
  if (lower.includes('execution reverted') || lower.includes('invalid opcode') || lower.includes('out of gas')) return 'contract_revert';
  if (lower.includes('rpc error')) return 'rpc_error';
  if (lower.includes('http ')) return 'http_error';
  if (lower.startsWith('capacity_limited:')) return 'capacity_limited';
  return 'unknown';
}

export function summarizeTopFailoverReasons(reasonCounts: Map<string, number>, topN = 3): Array<{ reason: string; count: number }> {
  return Array.from(reasonCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(1, topN))
    .map(([reason, count]) => ({ reason, count }));
}
