import assert from 'node:assert/strict';
import test from 'node:test';

import { __testOnly } from '../MainSwapService.js';

test('turbo copytrade buy recoverable direct failures enable 0x fallback', () => {
  const plan = __testOnly.resolveTurboCopytrade0xFallbackPlan({
    isTurboCopytrade: true,
    isBuyDirection: true,
    directFailureReason: 'budget_timeout',
    directFailureMessage: 'timeout_turbo_budget_6500ms',
    acceptedDirectEvidence: false,
    hasGuardContext: true,
    skipExternalFallback: false,
    skipNoLiquidity: false,
  });

  assert.equal(plan.shouldFallback, true);
  assert.equal(plan.reasonCode, 'budget_timeout');
  assert.equal(plan.providerTag, 'aggregator_fallback_0x_turbo');
  assert.ok((plan.quoteTimeoutMs || 0) <= (plan.fallbackBudgetMs || 0));
});

test('turbo copytrade buy suppresses 0x fallback when guard context is missing', () => {
  const plan = __testOnly.resolveTurboCopytrade0xFallbackPlan({
    isTurboCopytrade: true,
    isBuyDirection: true,
    directFailureReason: 'route_failure',
    directFailureMessage: 'No suitable pool found',
    acceptedDirectEvidence: false,
    hasGuardContext: false,
    skipExternalFallback: false,
    skipNoLiquidity: false,
  });

  assert.equal(plan.shouldFallback, false);
  assert.equal(plan.reasonCode, 'missing_copytrade_guard_context');
});

test('turbo copytrade buy suppresses 0x fallback on non-recoverable validation failures', () => {
  const plan = __testOnly.resolveTurboCopytrade0xFallbackPlan({
    isTurboCopytrade: true,
    isBuyDirection: true,
    directFailureReason: 'route_failure',
    directFailureMessage: 'unsupported_v4_hook:before_swap_delta',
    acceptedDirectEvidence: false,
    hasGuardContext: true,
    skipExternalFallback: false,
    skipNoLiquidity: false,
  });

  assert.equal(plan.shouldFallback, false);
  assert.equal(plan.reasonCode, 'non_recoverable_validation');
});
