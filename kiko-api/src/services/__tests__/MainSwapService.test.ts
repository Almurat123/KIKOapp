import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MainSwapService,
  __testOnly,
  buildUserFacingSwapError,
  inferSwapReasonCode,
  shouldDeferAcceptedCopytradeBuyFeeCollection,
  txLifecycleFromExecutionFinality,
  verifyNativeBalancePrecheck,
} from '../MainSwapService.js';
import { createOrderRuntimeContext, markOrderFallbackResult, markOrderFallbackStarted } from '../order-runtime/context.js';
import { fourMemeSwapService } from '../fourMemeSwapService.js';

test('verifyNativeBalancePrecheck bypasses transient RPC auth failures', async () => {
  let bypassed: string | null = null;

  await verifyNativeBalancePrecheck({
    chainId: 56,
    walletAddress: '0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B',
    amountIn: '0.001',
    gasReserve: '0.003',
    getNativeBalanceFn: async () => {
      throw new Error('All RPC endpoints failed for BNB Smart Chain. Last error: HTTP 401: Unauthorized');
    },
    onBypass: (error) => {
      bypassed = String((error as Error).message || error);
    },
  });

  assert.match(bypassed || '', /HTTP 401: Unauthorized/);
});

test('verifyNativeBalancePrecheck still rejects true insufficient native balance', async () => {
  await assert.rejects(
    () => verifyNativeBalancePrecheck({
      chainId: 56,
      walletAddress: '0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B',
      amountIn: '0.01',
      gasReserve: '0.003',
      getNativeBalanceFn: async () => '0x0',
    }),
    /insufficient_native_balance_precheck/
  );
});

test('swap error mapping classifies rpc pool failures explicitly', () => {
  const message = 'All RPC endpoints failed for BNB Smart Chain. Last error: HTTP 401: Unauthorized';
  assert.equal(inferSwapReasonCode(message), 'rpc_unavailable');
  assert.equal(
    buildUserFacingSwapError(message),
    'Trade execution RPC is temporarily unavailable on this chain. Please retry shortly.'
  );
});

test('txLifecycleFromExecutionFinality maps confirmed executor success into tx lifecycle evidence', () => {
  const lifecycle = txLifecycleFromExecutionFinality({
    finalityState: 'confirmed_success',
    txHash: '0xabc',
    chainId: 56,
  });

  assert.equal(lifecycle?.status, 'confirmed_success');
  assert.equal(lifecycle?.txHash, '0xabc');
  assert.equal(lifecycle?.chainId, 56);
});

test('shouldDeferAcceptedCopytradeBuyFeeCollection defers turbo buy fees until tx becomes visible', () => {
  assert.equal(shouldDeferAcceptedCopytradeBuyFeeCollection({
    isTurboCopytrade: true,
    mode: 'copytrade',
    isBuyDirection: true,
    chainId: 8453,
    txHash: '0xabc',
    lifecycle: {
      status: 'broadcasted_unseen',
      txHash: '0xabc',
      attempts: 1,
      chainId: 8453,
    },
  }), true);

  assert.equal(shouldDeferAcceptedCopytradeBuyFeeCollection({
    isTurboCopytrade: true,
    mode: 'copytrade',
    isBuyDirection: true,
    chainId: 8453,
    txHash: '0xabc',
    lifecycle: {
      status: 'visible_pending',
      txHash: '0xabc',
      attempts: 1,
      chainId: 8453,
    },
  }), false);

  assert.equal(shouldDeferAcceptedCopytradeBuyFeeCollection({
    isTurboCopytrade: false,
    mode: 'copytrade',
    isBuyDirection: true,
    chainId: 8453,
    txHash: '0xabc',
    lifecycle: {
      status: 'broadcasted_unseen',
      txHash: '0xabc',
      attempts: 1,
      chainId: 8453,
    },
  }), false);
});

test('turbo copytrade fallback plan still allows aggregator fallback after internal hint pair mismatch', () => {
  const plan = __testOnly.resolveTurboCopytrade0xFallbackPlan({
    isTurboCopytrade: true,
    isBuyDirection: true,
    directFailureReason: 'route_failure',
    directFailureMessage: 'turbo_rescue_exhausted:pool_discovery_failed:hint_pool_pair_mismatch:pool_pair_mismatch',
    acceptedDirectEvidence: false,
    hasGuardContext: true,
    skipExternalFallback: false,
    skipNoLiquidity: false,
  });

  assert.equal(plan.shouldFallback, true);
  assert.equal(plan.reasonCode, 'route_failure');
});

test('order runtime can transfer ownership to fallback before any direct route state exists', () => {
  const ctx = createOrderRuntimeContext({
    userId: 'user-fallback',
    chainId: 8453,
    walletAddress: '0x1234567890123456789012345678901234567890',
    side: 'buy',
    mode: 'copytrade',
  });

  markOrderFallbackStarted(ctx, 'pending_visibility');
  markOrderFallbackResult(ctx, true);

  assert.equal(ctx.state, 'fallback_succeeded');
  assert.equal(ctx.fallbackUsed, true);
});

test('order runtime fallback takeover can recover from a stale failed state', () => {
  const ctx = createOrderRuntimeContext({
    userId: 'user-fallback-recover',
    chainId: 8453,
    walletAddress: '0x1234567890123456789012345678901234567890',
    side: 'buy',
    mode: 'copytrade',
  });

  ctx.state = 'failed';
  ctx.reasonCode = 'pending_visibility';

  markOrderFallbackStarted(ctx, 'pending_visibility');
  markOrderFallbackResult(ctx, true);

  assert.equal(ctx.state, 'fallback_succeeded');
  assert.equal(ctx.fallbackUsed, true);
});

test('MainSwapService routes fourmeme launchpad buy through specialized executor', async () => {
  const originalFastSwap = fourMemeSwapService.fastSwap;

  fourMemeSwapService.fastSwap = async () => '0xfourmeme-specialized';

  try {
    const result = await MainSwapService.executeSwap({
      userId: 'did:privy:user-fourmeme',
      walletAddress: '0x1234567890123456789012345678901234567890',
      accessToken: '',
      tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      tokenOut: '0xd6eb45a72735cf1a896702d71f2df115c07affff',
      amountIn: '0.001',
      chainId: 56,
      slippageBps: 300,
      mode: 'fast-swap',
      launchpadProvider: 'fourmeme',
    });

    assert.equal(result.success, true);
    assert.equal(result.txHash, '0xfourmeme-specialized');
    assert.equal(result.metadata.provider, 'fourmeme');
    assert.equal(result.metadata.launchpad, 'fourmeme');
  } finally {
    fourMemeSwapService.fastSwap = originalFastSwap;
  }
});
