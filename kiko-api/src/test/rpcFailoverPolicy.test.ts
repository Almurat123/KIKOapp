import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import type { RpcEndpointConfig } from '../config/apiEndpoints.js';
import {
  classifyFailoverReason,
  extendCheapBudgetToIncludePremiumFallback,
  isRateLimitedFailure,
  shouldSkipFailoverDelay,
  summarizeTopFailoverReasons,
} from '../services/rpc/failoverPolicy.js';

function endpoint(type: 'premium' | 'public_free' | 'fallback', priority: number): RpcEndpointConfig {
  return {
    name: `${type}-${priority}`,
    url: `https://${type}-${priority}.rpc`,
    priority,
    requiresAuth: type === 'premium',
    type,
  };
}

describe('rpc failover policy', () => {
  test('cheap budget extends until first premium endpoint', () => {
    const sortedEndpoints: RpcEndpointConfig[] = [
      endpoint('public_free', 1),
      endpoint('public_free', 2),
      endpoint('premium', 3),
      endpoint('premium', 4),
    ];
    const budget = extendCheapBudgetToIncludePremiumFallback({
      strategy: 'cheap',
      sortedEndpoints,
      endpointBudget: 2,
      forceExhaustiveFailover: false,
    });
    assert.equal(budget, 3);
  });

  test('fast budget is unchanged by cheap fallback rule', () => {
    const sortedEndpoints: RpcEndpointConfig[] = [
      endpoint('public_free', 1),
      endpoint('premium', 2),
    ];
    const budget = extendCheapBudgetToIncludePremiumFallback({
      strategy: 'fast',
      sortedEndpoints,
      endpointBudget: 1,
      forceExhaustiveFailover: false,
    });
    assert.equal(budget, 1);
  });

  test('rate-limit errors skip delay and classify correctly', () => {
    assert.equal(isRateLimitedFailure('HTTP 429: Too Many Requests'), true);
    assert.equal(shouldSkipFailoverDelay('capacity_limited:rps'), true);
    assert.equal(classifyFailoverReason('HTTP 429: Too Many Requests'), 'rate_limited');
  });

  test('summarizes top failure reasons', () => {
    const summary = summarizeTopFailoverReasons(new Map<string, number>([
      ['rate_limited', 5],
      ['timeout', 2],
      ['rpc_error', 1],
    ]));
    assert.deepEqual(summary, [
      { reason: 'rate_limited', count: 5 },
      { reason: 'timeout', count: 2 },
      { reason: 'rpc_error', count: 1 },
    ]);
  });
});
