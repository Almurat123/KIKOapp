import type { RpcEndpointConfig } from '../../config/apiEndpoints.js';
import { inferRpcLane, shouldPreferPremium } from './policy.js';
import type {
  RpcEndpointHealthView,
  RpcEndpointScoreBreakdown,
  RpcEndpointUsageView,
  RpcImportance
} from './types.js';

export function scoreRpcEndpoint(params: {
  endpoint: RpcEndpointConfig;
  method: string;
  importance: RpcImportance;
  now: number;
  health: RpcEndpointHealthView;
  usage: RpcEndpointUsageView;
}): RpcEndpointScoreBreakdown {
  const { endpoint, method, importance, now, health, usage } = params;
  const lane = inferRpcLane(method, importance);
  const reasons: string[] = [];
  let score = 0;

  const successScore = (health.totalAttempts > 0 ? health.successRate : 0.7) * 12;
  score += successScore;
  reasons.push(`success=${successScore.toFixed(2)}`);

  const latencyScore = health.avgResponseTime > 0 ? Math.max(0, 1500 - health.avgResponseTime) / 300 : 1.5;
  score += latencyScore;
  reasons.push(`latency=${latencyScore.toFixed(2)}`);

  if (shouldPreferPremium(lane, importance)) {
    if (endpoint.type === 'premium') {
      score += 3;
      reasons.push('premium_preferred');
    } else if (endpoint.type === 'public') {
      score -= 1;
      reasons.push('public_penalty');
    }
  } else if (lane === 'background') {
    if (endpoint.type === 'public') {
      score += 2;
      reasons.push('cheap_preferred');
    } else if (endpoint.type === 'premium') {
      score -= 0.75;
      reasons.push('premium_cost_penalty');
    }
  }

  if (health.circuitOpen) {
    score -= 6;
    reasons.push('circuit_open');
  }
  if (health.consecutiveFailures > 0) {
    const penalty = Math.min(3, health.consecutiveFailures * 0.6);
    score -= penalty;
    reasons.push(`failures=-${penalty.toFixed(2)}`);
  }

  const limits = endpoint.limits;
  if (limits?.maxInFlight && usage.inFlight >= limits.maxInFlight) {
    score -= lane === 'write' || lane === 'confirm' ? 4 : 2;
    reasons.push('maxInFlight_pressure');
  }
  if (limits?.rps && usage.secondCount >= limits.rps) {
    score -= lane === 'write' || lane === 'confirm' ? 3 : 1.5;
    reasons.push('rps_pressure');
  }
  if (limits?.rpm && usage.minuteCount >= limits.rpm) {
    score -= lane === 'write' || lane === 'confirm' ? 2 : 1;
    reasons.push('rpm_pressure');
  }

  if (now - usage.lastUsedAt < 50) {
    score -= lane === 'write' ? 0.1 : 0.25;
    reasons.push('recently_used');
  }

  if (endpoint.weight) {
    score += endpoint.weight;
    reasons.push(`weight=${endpoint.weight}`);
  }

  const priorityBonus = Math.max(0, 4 - Math.min(4, endpoint.priority || 4)) * 0.25;
  score += priorityBonus;
  reasons.push(`priority=${priorityBonus.toFixed(2)}`);

  return {
    endpoint,
    lane,
    score,
    reasons
  };
}

export function sortRpcEndpointsByScore(params: {
  endpoints: RpcEndpointConfig[];
  method: string;
  importance: RpcImportance;
  now: number;
  getHealth: (url: string) => RpcEndpointHealthView;
  getUsage: (url: string) => RpcEndpointUsageView;
}): RpcEndpointConfig[] {
  return params.endpoints
    .map((endpoint) => scoreRpcEndpoint({
      endpoint,
      method: params.method,
      importance: params.importance,
      now: params.now,
      health: params.getHealth(endpoint.url),
      usage: params.getUsage(endpoint.url)
    }))
    .sort((a, b) => b.score - a.score)
    .map((row) => row.endpoint);
}

export function buildRpcScoreTable(params: {
  endpoints: RpcEndpointConfig[];
  method: string;
  importance: RpcImportance;
  now: number;
  getHealth: (url: string) => RpcEndpointHealthView;
  getUsage: (url: string) => RpcEndpointUsageView;
}): RpcEndpointScoreBreakdown[] {
  return params.endpoints
    .map((endpoint) => scoreRpcEndpoint({
      endpoint,
      method: params.method,
      importance: params.importance,
      now: params.now,
      health: params.getHealth(endpoint.url),
      usage: params.getUsage(endpoint.url)
    }))
    .sort((a, b) => b.score - a.score);
}
