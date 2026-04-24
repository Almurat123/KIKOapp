import assert from 'node:assert/strict';
import test, { after } from 'node:test';

import prisma from '../../../db/prisma.js';
import type { MainSwapRequest } from '../../MainSwapService.js';
import { reportSendAccepted } from '../../order-runtime/adjudicator/service.js';
import { executeEvmCopytradeBuySubmissionFlow } from '../buy/evmBuySubmissionFlow.js';

after(async () => {
  await prisma.$disconnect().catch(() => {});
});

test('evm buy submission flow preserves unresolved turbo submissions for later recovery', async () => {
  let capturedRequest: MainSwapRequest | null = null;

  const result = await executeEvmCopytradeBuySubmissionFlow(
    {
      userId: 'user-1',
      configId: 'cfg-1',
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
  const submittedRequest = capturedRequest as MainSwapRequest;
  assert.equal(submittedRequest.userSettings?.disableTokenInfo, true);
  assert.match(submittedRequest.requestKey || '', /^[a-f0-9]{32}$/);
  assert.equal(submittedRequest.executionContext?.copytradeRequestKey, submittedRequest.requestKey);
  assert.equal(result.status, 'submitted_unresolved');
  assert.equal(result.reasonCode, 'direct_timeout');
  assert.equal(result.txLifecycleStatus, 'broadcasted_unseen');
});

test('evm buy submission flow does not preserve no-send-evidence turbo timeouts as unresolved submissions', async () => {
  const result = await executeEvmCopytradeBuySubmissionFlow(
    {
      userId: 'user-visibility-timeout',
      configId: 'cfg-visibility-timeout',
      privyUserId: 'did:privy:user-visibility-timeout',
      walletAddress: '0x1234567890123456789012345678901234567890',
      tokenToBuy: '0x9999999999999999999999999999999999999999',
      chainId: 8453,
      usdAmount: 10,
      nativePrice: 2000,
      baseSlippageBps: 300,
      executionMode: 'turbo',
      turboMode: true,
      fastSwapMode: true,
      checkTokenBeforeSwap: false,
      tokenInfo: { price: 0.01 },
      pendingPositionId: 'pending-vis-timeout',
    },
    {
      async buildCopytradeBuyPlannedArtifact() {
        return {
          executionContextBase: {
            sourceTxHash: '0xleader-visibility-timeout',
          },
          async getExecutionPlan() {
            return null;
          },
        } as any;
      },
      async executeSwapViaPort(request) {
        request.runtimeContext = {
          orderId: 'order-visibility-timeout',
          chainId: 8453,
          userId: 'did:privy:user-visibility-timeout',
          walletAddress: '0x1234567890123456789012345678901234567890',
          side: 'buy',
          mode: 'copytrade',
          state: 'created',
          reasonCode: 'visibility_timeout',
          relatedTxHashes: [],
          route: {},
          timing: { createdAt: Date.now() },
          attempts: [],
          fallbackUsed: true,
          metadata: { copytradePendingPositionId: 'pending-vis-timeout' },
          lastLifecycle: {
            status: 'dropped_timeout',
            chainId: 8453,
            attempts: 1,
          },
        };
        return {
          success: false,
          error: 'visibility_timeout',
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

  assert.equal(result.status, 'aborted');
  assert.equal(result.reasonCode, 'turbo_step1_failed');
});

test('evm buy submission flow preserves send-started copytrade buys instead of retrying another send', async () => {
  const result = await executeEvmCopytradeBuySubmissionFlow(
    {
      userId: 'user-send-started',
      configId: 'cfg-send-started',
      privyUserId: 'did:privy:user-send-started',
      walletAddress: '0x1234567890123456789012345678901234567890',
      tokenToBuy: '0x9999999999999999999999999999999999999999',
      chainId: 8453,
      usdAmount: 10,
      nativePrice: 2000,
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
            sourceTxHash: '0xleader-send-started',
          },
          async getExecutionPlan() {
            return null;
          },
        } as any;
      },
      async executeSwapViaPort(request) {
        request.runtimeContext = {
          orderId: 'order-send-started',
          chainId: 8453,
          userId: 'did:privy:user-send-started',
          walletAddress: '0x1234567890123456789012345678901234567890',
          side: 'buy',
          mode: 'copytrade',
          state: 'send_started',
          reasonCode: 'none',
          relatedTxHashes: [],
          route: {},
          timing: { createdAt: Date.now(), sendStartedAt: Date.now() },
          attempts: [{
            id: 'attempt-1',
            attempt: 1,
            channel: 'privy_sendtx',
            state: 'sending',
            startedAt: Date.now(),
            updatedAt: Date.now(),
          }],
          fallbackUsed: false,
          metadata: {},
        };
        return {
          success: false,
          error: 'copytrade_buy_send_inflight',
          runtimeContext: request.runtimeContext,
          metadata: {
            provider: 'direct-swap',
            mode: request.mode,
          },
        };
      },
      shouldAbortCopytradeBuyRetry() {
        return { shouldAbortRetry: false, reasonCode: 'none' };
      },
    },
  );

  assert.equal(result.status, 'submitted_unresolved');
  assert.equal(result.reasonCode, 'send_started');
  assert.equal(result.txLifecycleStatus, 'broadcasted_unseen');
});

test('evm buy submission flow adopts accepted evidence by orderId even when runtimeContext lacks canonical tx hash', async () => {
  const orderId = `order-accepted-by-id-${Date.now()}`;
  const acceptedTxHash = '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd';

  const result = await executeEvmCopytradeBuySubmissionFlow(
    {
      userId: 'user-accepted-by-id',
      configId: 'cfg-accepted-by-id',
      privyUserId: 'did:privy:user-accepted-by-id',
      walletAddress: '0x1234567890123456789012345678901234567890',
      tokenToBuy: '0x9999999999999999999999999999999999999999',
      chainId: 8453,
      usdAmount: 10,
      nativePrice: 2000,
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
            sourceTxHash: '0xleader-accepted-by-id',
          },
          async getExecutionPlan() {
            return null;
          },
        } as any;
      },
      async executeSwapViaPort(request) {
        request.runtimeContext = {
          orderId,
          chainId: 8453,
          userId: 'did:privy:user-accepted-by-id',
          walletAddress: '0x1234567890123456789012345678901234567890',
          side: 'buy',
          mode: 'copytrade',
          state: 'rpc_uncertain',
          reasonCode: 'pending_visibility',
          relatedTxHashes: [],
          route: {},
          timing: { createdAt: Date.now() },
          attempts: [],
          fallbackUsed: true,
          metadata: {},
        };
        reportSendAccepted({
          chainId: 8453,
          txHash: acceptedTxHash,
          orderId,
          source: 'privy_sendtx',
        });
        return {
          success: false,
          error: 'visibility_timeout',
          runtimeContext: request.runtimeContext,
          metadata: {
            provider: 'direct-swap',
            mode: request.mode,
          },
        };
      },
    },
  );

  assert.equal(result.status, 'submitted');
  assert.equal(result.txHash, acceptedTxHash);
  assert.equal(result.txLifecycleStatus, 'broadcasted_unseen');
});

test('evm buy submission flow carries fallback pricing guard context into turbo requests', async () => {
  let capturedRequest: MainSwapRequest | null = null;

  const result = await executeEvmCopytradeBuySubmissionFlow(
    {
      userId: 'user-2',
      configId: 'cfg-2',
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
      configId: 'cfg-3',
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
      configId: 'cfg-4',
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

test('evm buy submission flow passes canonical leader-buy identity to admission guard without a pending position id', async () => {
  let executeCalled = false;
  let capturedAdmissionArgs: Record<string, unknown> | null = null;

  const result = await executeEvmCopytradeBuySubmissionFlow(
    {
      userId: 'user-5',
      configId: 'cfg-5',
      privyUserId: 'did:privy:user-5',
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
    },
    {
      async buildCopytradeBuyPlannedArtifact() {
        return {
          executionContextBase: {
            sourceTxHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          },
          async getExecutionPlan() {
            return null;
          },
        } as any;
      },
      async evaluateCopytradeBuyAdmission(args) {
        capturedAdmissionArgs = args as any;
        return {
          blocked: true,
          reasonCode: 'buy_tx_already_accepted',
          acceptedTxHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
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
  assert.deepEqual(capturedAdmissionArgs, {
    pendingPositionId: undefined,
    userId: 'user-5',
    configId: 'cfg-5',
    chainId: 8453,
    tokenAddress: '0x9999999999999999999999999999999999999999',
    leaderBuyTxHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  });
});
