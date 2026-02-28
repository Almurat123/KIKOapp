import type { RpcEndpointConfig } from '../../config/apiEndpoints.js';

export type RpcImportance = 'normal' | 'critical';

export type RpcLane = 'write' | 'confirm' | 'route_read' | 'background';

export interface RpcEndpointHealthView {
  successRate: number;
  avgResponseTime: number;
  circuitOpen: boolean;
  consecutiveFailures: number;
  totalAttempts: number;
}

export interface RpcEndpointUsageView {
  inFlight: number;
  secondCount: number;
  minuteCount: number;
  lastUsedAt: number;
}

export interface RpcEndpointScoreBreakdown {
  endpoint: RpcEndpointConfig;
  lane: RpcLane;
  score: number;
  reasons: string[];
}

export interface RpcStrategyUpgradeDecision {
  upgrade: boolean;
  lane: RpcLane;
  reasons: string[];
}
