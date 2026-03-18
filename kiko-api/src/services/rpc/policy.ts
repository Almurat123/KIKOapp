import type { RpcEndpointConfig } from '../../config/apiEndpoints.js';
import { computeProjectedCapacityPressure } from './prediction.js';
import { getRpcPurposeProfile, type RpcPurpose } from './purpose.js';
import type { RpcEndpointHealthView, RpcEndpointUsageView, RpcImportance, RpcLane, RpcStrategyUpgradeDecision } from './types.js';

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
  getUsage?: (url: string) => RpcEndpointUsageView;
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
  let predictedPressure = 0;
  let predictedHardCap = 0;

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
    const projected = computeProjectedCapacityPressure({
      endpoint,
      usage: params.getUsage
        ? params.getUsage(endpoint.url)
        : { inFlight: 0, secondCount: 0, minuteCount: 0, lastUsedAt: 0 },
      method: params.method,
      lane,
      importance: params.importance,
      purpose: params.purpose,
    });
    if (projected.projectedPressure >= 0.9) {
      predictedPressure += 1;
    }
    if (projected.projectedPressure >= 1) {
      predictedHardCap += 1;
    }
  }

  if (openCircuits > 0) reasons.push(`open_circuit:${openCircuits}`);
  if (lowSuccess > 0) reasons.push(`low_success:${lowSuccess}`);
  if (predictedPressure > 0) reasons.push(`predicted_pressure:${predictedPressure}`);
  if (predictedHardCap > 0) reasons.push(`predicted_hard_cap:${predictedHardCap}`);

  const upgrade = lane === 'write' || lane === 'confirm'
    ? unhealthy >= 1 || predictedPressure >= 1
    : unhealthy === top.length || predictedPressure >= Math.max(1, Math.min(2, top.length));

  if (upgrade && reasons.length === 0) {
    reasons.push('lane_policy_upgrade');
  }

  return { upgrade, lane, reasons };
}
