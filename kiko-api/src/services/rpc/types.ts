import type { RpcEndpointConfig } from '../../config/apiEndpoints.js';
import type { RpcPurpose } from './purpose.js';

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
  reservedSecondCount?: number;
  reservedMinuteCount?: number;
}

export interface RpcEndpointScoreBreakdown {
  endpoint: RpcEndpointConfig;
  lane: RpcLane;
  purpose?: RpcPurpose;
  score: number;
  reasons: string[];
}

export interface RpcStrategyUpgradeDecision {
  upgrade: boolean;
  lane: RpcLane;
  reasons: string[];
}
