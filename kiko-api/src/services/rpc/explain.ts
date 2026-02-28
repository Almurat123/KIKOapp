import type { RpcEndpointConfig } from '../../config/apiEndpoints.js';
import type { RpcEndpointScoreBreakdown, RpcImportance, RpcLane, RpcStrategyUpgradeDecision } from './types.js';

export interface RpcSelectionExplainSnapshot {
  method: string;
  importance: RpcImportance;
  lane: RpcLane;
  strategy: 'fast' | 'cheap';
  upgradedToFast: boolean;
  upgradeReasons: string[];
  selectedEndpoints: string[];
  topScores: Array<{
    endpoint: string;
    type: RpcEndpointConfig['type'];
    score: number;
    reasons: string[];
  }>;
}

function maskEndpoint(url: string): string {
  return url.replace(/[a-zA-Z0-9]{32,}/g, '***');
}

export function buildRpcSelectionExplain(params: {
  method: string;
  importance: RpcImportance;
  strategy: 'fast' | 'cheap';
  scores: RpcEndpointScoreBreakdown[];
  selectedEndpoints: RpcEndpointConfig[];
  upgradeDecision?: RpcStrategyUpgradeDecision;
}): RpcSelectionExplainSnapshot {
  return {
    method: params.method,
    importance: params.importance,
    lane: params.upgradeDecision?.lane || params.scores[0]?.lane || 'background',
    strategy: params.strategy,
    upgradedToFast: Boolean(params.upgradeDecision?.upgrade),
    upgradeReasons: params.upgradeDecision?.reasons || [],
    selectedEndpoints: params.selectedEndpoints.map((endpoint) => maskEndpoint(endpoint.url)),
    topScores: params.scores.slice(0, 5).map((row) => ({
      endpoint: maskEndpoint(row.endpoint.url),
      type: row.endpoint.type,
      score: Number(row.score.toFixed(3)),
      reasons: row.reasons.slice(0, 8)
    }))
  };
}
