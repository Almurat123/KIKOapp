import type { RpcEndpointConfig } from '../../config/apiEndpoints.js';
import { getRpcPurposeProfile, type RpcPurpose } from './purpose.js';
import type { RpcEndpointHealthView, RpcImportance, RpcLane, RpcStrategyUpgradeDecision } from './types.js';

export function inferRpcLane(method: string, importance: RpcImportance): RpcLane {
  if (method === 'eth_sendRawTransaction' || method === 'eth_getTransactionCount' || method === 'eth_feeHistory' || method === 'eth_maxPriorityFeePerGas') {
    return 'write';
  }
  if (method === 'eth_getTransactionByHash' || method === 'eth_getTransactionReceipt') {
    return 'confirm';
  }
  if (importance === 'critical') {
    return 'route_read';
  }
  return 'background';
}

export function shouldPreferPremium(lane: RpcLane, importance: RpcImportance): boolean {
  if (lane === 'write' || lane === 'confirm') return true;
  return importance === 'critical' && lane === 'route_read';
}

export function shouldPreferPremiumForPurpose(purpose?: RpcPurpose, lane?: RpcLane, importance?: RpcImportance): boolean {
  if (purpose) {
    return getRpcPurposeProfile(purpose).premiumFirst;
  }
  return shouldPreferPremium(lane || 'background', importance || 'normal');
}

export function shouldUpgradeRpcStrategy(params: {
  endpoints: RpcEndpointConfig[];
  getHealth: (url: string) => RpcEndpointHealthView;
  method: string;
  importance: RpcImportance;
  purpose?: RpcPurpose;
}): RpcStrategyUpgradeDecision {
  const lane = inferRpcLane(params.method, params.importance);
  if (params.purpose) {
    const profile = getRpcPurposeProfile(params.purpose);
    if (!profile.allowPremiumEndpoints) {
      return { upgrade: false, lane, reasons: ['purpose_disallows_premium_upgrade'] };
    }
  }
  const reasons: string[] = [];
  const top = params.endpoints.slice(0, 3);
  if (top.length === 0) {
    return { upgrade: false, lane, reasons: ['no_endpoints'] };
  }

  let unhealthy = 0;
  let openCircuits = 0;
  let lowSuccess = 0;

  for (const endpoint of top) {
    const health = params.getHealth(endpoint.url);
    const successRate = health.totalAttempts > 0 ? health.successRate : 1;
    if (health.circuitOpen) {
      openCircuits += 1;
      unhealthy += 1;
      continue;
    }
    if (health.totalAttempts >= 10 && successRate < (lane === 'background' ? 0.5 : 0.8)) {
      lowSuccess += 1;
      unhealthy += 1;
    }
  }

  if (openCircuits > 0) reasons.push(`open_circuit:${openCircuits}`);
  if (lowSuccess > 0) reasons.push(`low_success:${lowSuccess}`);

  const upgrade = lane === 'write' || lane === 'confirm'
    ? unhealthy >= 1
    : unhealthy === top.length;

  if (upgrade && reasons.length === 0) {
    reasons.push('lane_policy_upgrade');
  }

  return { upgrade, lane, reasons };
}
