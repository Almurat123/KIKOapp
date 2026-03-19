import assert from 'node:assert/strict';
import test, { after } from 'node:test';

import prisma from '../../../db/prisma.js';
import type { MainSwapRequest } from '../../MainSwapService.js';
import { executeEvmCopytradeBuySubmissionFlow } from '../buy/evmBuySubmissionFlow.js';

after(async () => {
  await prisma.$disconnect().catch(() => {});
});

test('evm buy submission flow preserves unresolved turbo submissions for later recovery', async () => {
  let capturedRequest: MainSwapRequest | null = null;

  const result = await executeEvmCopytradeBuySubmissionFlow(
    {
      userId: 'user-1',
      privyUserId: 'did:privy:user-1',
      walletAddress: '0x1234567890123456789012345678901234567890',
      tokenToBuy: '0x9999999999999999999999999999999999999999',
      chainId: 56,
      usdAmount: 10,
      nativePrice: 200,
      baseSlippageBps: 300,
      executionMode: 'turbo',
      turboMode: true,
      fastSwapMode: true,
      checkTokenBeforeSwap: false,
      tokenInfo: { price: 0.01 },
    },
    {
      async buildCopytradeBuyPlannedArtifact() {
        return {
          executionContextBase: {
            sourceTxHash: '0xleader',
          },
          async getExecutionPlan() {
            return null;
          },
        } as any;
      },
      async executeSwapViaPort(request) {
        capturedRequest = request;
        request.runtimeContext = {
          orderId: 'order-1',
          chainId: 56,
          userId: 'did:privy:user-1',
          walletAddress: '0x1234567890123456789012345678901234567890',
          side: 'buy',
          mode: 'copytrade',
          state: 'rpc_uncertain',
          reasonCode: 'direct_timeout',
          relatedTxHashes: [],
          route: {},
          timing: { createdAt: Date.now() },
          attempts: [],
          fallbackUsed: false,
          metadata: {},
          lastLifecycle: {
            status: 'broadcasted_unseen',
            chainId: 56,
            txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            attempts: 1,
          },
        };
        return {
          success: false,
          error: 'Turbo direct timeout',
          runtimeContext: request.runtimeContext,
          txLifecycle: request.runtimeContext.lastLifecycle,
          metadata: {
            provider: 'direct-swap',
            mode: request.mode,
            txLifecycleStatus: request.runtimeContext.lastLifecycle?.status,
          },
        };
      },
      shouldAbortCopytradeBuyRetry() {
        return { shouldAbortRetry: false, reasonCode: 'none' };
      },
    },
  );

  assert.ok(capturedRequest);
  assert.equal(result.status, 'submitted_unresolved');
  assert.equal(result.reasonCode, 'direct_timeout');
  assert.equal(result.txLifecycleStatus, 'broadcasted_unseen');
});

test('evm buy submission flow carries fallback pricing guard context into turbo requests', async () => {
  let capturedRequest: MainSwapRequest | null = null;

  const result = await executeEvmCopytradeBuySubmissionFlow(
    {
      userId: 'user-2',
      privyUserId: 'did:privy:user-2',
      walletAddress: '0x1234567890123456789012345678901234567890',
      tokenToBuy: '0x9999999999999999999999999999999999999999',
      chainId: 56,
      usdAmount: 25,
      nativePrice: 250,
      baseSlippageBps: 400,
      executionMode: 'turbo',
      turboMode: true,
      fastSwapMode: true,
      checkTokenBeforeSwap: false,
      tokenInfo: { price: 0.02 },
      targetExecutionPrice: 0.5,
      entryDeviationReferencePrice: 0.45,
      entryDeviationReferenceSource: 'market_oracle_price',
      maxEntryDeviationBps: 1200,
      maxEntryDeviationSource: 'copytrade_policy',
      maxEntryDeviationReasonCode: 'turbo_default',
      maxEntryDeviationThresholdPolicy: 'fixed',
      maxEntryDeviationModeFloorBps: 800,
      allowFallbackEntryDeviationBypass: true,
    },
    {
      async buildCopytradeBuyPlannedArtifact() {
        return {
          executionContextBase: {
            sourceTxHash: '0xleader-2',
          },
          async getExecutionPlan() {
            return null;
          },
        } as any;
      },
      async executeSwapViaPort(request) {
        capturedRequest = request;
        return {
          success: true,
          txHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          amountOut: '1000',
          metadata: {
            provider: 'aggregator_fallback_0x_turbo',
            mode: request.mode,
          },
        };
      },
      shouldAbortCopytradeBuyRetry() {
        return { shouldAbortRetry: false, reasonCode: 'none' };
      },
    },
  );

  assert.equal(result.status, 'submitted');
  assert.ok(capturedRequest);
  const request = capturedRequest as MainSwapRequest;
  assert.deepEqual(request.executionContext?.copytradeFallbackPricingGuard, {
    stage: '0x_fallback',
    targetExecutionPrice: 0.5,
    referencePrice: 0.45,
    referencePriceSource: 'market_oracle_price',
    maxEntryDeviationBps: 1200,
    thresholdSource: 'copytrade_policy',
    thresholdReasonCode: 'turbo_default',
    thresholdPolicy: 'fixed',
    modeFloorBps: 800,
    inputValueUsd: 25,
    allowUnreliablePriceBypass: true,
  });
});

test('evm buy submission flow aborts before send when buy admission is preempted by target sell', async () => {
  let executeCalled = false;

  const result = await executeEvmCopytradeBuySubmissionFlow(
    {
      userId: 'user-3',
      privyUserId: 'did:privy:user-3',
      walletAddress: '0x1234567890123456789012345678901234567890',
      tokenToBuy: '0x9999999999999999999999999999999999999999',
      chainId: 8453,
      usdAmount: 15,
      nativePrice: 2500,
      baseSlippageBps: 300,
      executionMode: 'turbo',
      turboMode: true,
      fastSwapMode: true,
      checkTokenBeforeSwap: false,
      tokenInfo: { price: 0.03 },
      pendingPositionId: 'pos-preempted',
    },
    {
      async buildCopytradeBuyPlannedArtifact() {
        return {
          executionContextBase: {
            sourceTxHash: '0xleader-preempted',
          },
          async getExecutionPlan() {
            return null;
          },
        } as any;
      },
      async evaluateCopytradeBuyAdmission() {
        return {
          blocked: true,
          reasonCode: 'target_sell_preempted',
          targetSellTxHash: '0xsell',
        };
      },
      async executeSwapViaPort() {
        executeCalled = true;
        throw new Error('should_not_execute');
      },
    },
  );

  assert.equal(executeCalled, false);
  assert.deepEqual(result, {
    status: 'aborted',
    reasonCode: 'target_sell_preempted',
  });
});

test('evm buy submission flow aborts before send when a buy tx was already accepted', async () => {
  let executeCalled = false;

  const result = await executeEvmCopytradeBuySubmissionFlow(
    {
      userId: 'user-4',
      privyUserId: 'did:privy:user-4',
      walletAddress: '0x1234567890123456789012345678901234567890',
      tokenToBuy: '0x9999999999999999999999999999999999999999',
      chainId: 8453,
      usdAmount: 15,
      nativePrice: 2500,
      baseSlippageBps: 300,
      executionMode: 'turbo',
      turboMode: true,
      fastSwapMode: true,
      checkTokenBeforeSwap: false,
      tokenInfo: { price: 0.03 },
      pendingPositionId: 'pos-accepted',
    },
    {
      async buildCopytradeBuyPlannedArtifact() {
        return {
          executionContextBase: {
            sourceTxHash: '0xleader-accepted',
          },
          async getExecutionPlan() {
            return null;
          },
        } as any;
      },
      async evaluateCopytradeBuyAdmission() {
        return {
          blocked: true,
          reasonCode: 'buy_tx_already_accepted',
          acceptedTxHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        };
      },
      async executeSwapViaPort() {
        executeCalled = true;
        throw new Error('should_not_execute');
      },
    },
  );

  assert.equal(executeCalled, false);
  assert.deepEqual(result, {
    status: 'aborted',
    reasonCode: 'buy_tx_already_accepted',
  });
});
