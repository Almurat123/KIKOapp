import type { RpcEndpointConfig } from '../../config/apiEndpoints.js';
import type { RpcImportance, RpcEndpointUsageView, RpcLane } from './types.js';
import type { RpcPurpose } from './purpose.js';

export function estimateUpcomingRpcBurstSize(params: {
  method: string;
  lane: RpcLane;
  importance: RpcImportance;
  purpose?: RpcPurpose;
}): number {
  const method = String(params.method || '');

  if (method === 'eth_sendRawTransaction') {
    return params.purpose === 'trade_execution' ? 2 : 1;
  }
  if (method === 'eth_estimateGas') {
    return params.purpose === 'trade_execution' ? 3 : 2;
  }
  if (method === 'eth_getTransactionReceipt' || method === 'eth_getTransactionByHash') {
    return 2;
  }
  if (method === 'eth_call') {
    if (params.purpose === 'trade_execution') return 3;
    if (params.purpose === 'tx_visibility') return 2;
    return params.lane === 'route_read' || params.importance === 'critical' ? 2 : 1;
  }
  if (params.lane === 'route_read' && params.importance === 'critical') {
    return 2;
  }
  return 1;
}

export function computeProjectedCapacityPressure(params: {
  endpoint: RpcEndpointConfig;
  usage: RpcEndpointUsageView;
  method: string;
  lane: RpcLane;
  importance: RpcImportance;
  purpose?: RpcPurpose;
}): {
  burstSize: number;
  projectedPressure: number;
  projectedRpsPressure: number;
  projectedRpmPressure: number;
  projectedInFlightPressure: number;
} {
  const burstSize = estimateUpcomingRpcBurstSize({
    method: params.method,
    lane: params.lane,
    importance: params.importance,
    purpose: params.purpose,
  });
  const limits = params.endpoint.limits || {};
  const reservedSecondCount = Math.max(0, params.usage.reservedSecondCount || 0);
  const reservedMinuteCount = Math.max(0, params.usage.reservedMinuteCount || 0);
  const projectedRpsPressure = limits.rps
    ? (params.usage.secondCount + reservedSecondCount + burstSize) / Math.max(1, limits.rps)
    : 0;
  const projectedRpmPressure = limits.rpm
    ? (params.usage.minuteCount + reservedMinuteCount + burstSize) / Math.max(1, limits.rpm)
    : 0;
  const projectedInFlightPressure = limits.maxInFlight
    ? (params.usage.inFlight + 1) / Math.max(1, limits.maxInFlight)
    : 0;

  return {
    burstSize,
    projectedPressure: Math.max(projectedRpsPressure, projectedRpmPressure, projectedInFlightPressure),
    projectedRpsPressure,
    projectedRpmPressure,
    projectedInFlightPressure,
  };
}
