import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import { logOrderRuntimeSnapshot } from '../../order-runtime/sinks/logger.js';
import { resolveTxFinalState } from '../../order-runtime/adjudicator/finalState.js';
import { snapshotOrderRuntime } from '../../order-runtime/context.js';
import type { EvmExitExecutionResult, EvmExitSwapPlan, SellRoutePolicy } from './types.js';
import { createExitOrderRuntimeContext, mergeSwapResultIntoExitRuntime } from './runtime.js';
import { submitCopytradeExit } from '../execution/copytradeExecutionFacade.js';

function compactError(error: unknown): string {
  const message = String((error as any)?.message || error || 'unknown_error').trim();
  return message.length > 240 ? `${message.slice(0, 237)}...` : message;
}

async function runExitSwapAttempt(
  plan: EvmExitSwapPlan,
  amountInHuman: string,
  slippageBps: number,
  executionStep: string,
  sellRoutePolicy: SellRoutePolicy,
  runtimeContext = plan.runtimeContext
) {
  const useDirectPrimary = sellRoutePolicy === 'direct_primary';
  const result = await submitCopytradeExit({
    userId: plan.userId,
    walletAddress: plan.walletAddress,
    tokenIn: plan.tokenAddress,
    tokenOut: 'ETH',
    amountIn: amountInHuman,
    chainId: plan.chainId,
    slippageBps,
    mode: 'copytrade',
    requireConfirmedTx: true,
    runtimeContext,
    executionContext: {
      executionStep,
      strictReplica: false,
      sellRoutePolicy
    },
    userSettings: {
      fastSwapMode: useDirectPrimary,
      copyTradeExecutionMode: plan.executionMode
    }
  });
  return result.swapResult;
}

function resolveAttemptFinality(params: {
  plan: EvmExitSwapPlan;
  txHash?: string | null;
  runtimeContext: EvmExitSwapPlan['runtimeContext'];
  txLifecycle?: any;
  error?: string;
}) {
  const snapshot = snapshotOrderRuntime(params.runtimeContext);
  const canonicalTxHash = String(
    snapshot.canonicalTxHash
      || params.txHash
      || '',
  ).trim();
  const allTxHashes = [...new Set(
    [
      ...snapshot.relatedTxHashes,
      canonicalTxHash,
    ].filter(Boolean),
  )];
  const finality = resolveTxFinalState({
    runtimeContext: params.runtimeContext,
    lifecycle: params.txLifecycle,
    chainId: params.plan.chainId,
    txHash: canonicalTxHash || undefined,
    orderId: snapshot.orderId,
  });
  const pendingByAdjudicator = finality.state === 'send_accepted'
    || finality.state === 'rpc_visible'
    || finality.state === 'chain_observed'
    || finality.state === 'rpc_uncertain';

  if (finality.state === 'confirmed_success') {
    return {
      finalityState: 'confirmed_success' as const,
      finalityReasonCode: finality.reasonCode || 'confirmed_success',
      txHash: canonicalTxHash || undefined,
      allTxHashes,
    };
  }
  if (finality.state === 'confirmed_failed') {
    return {
      finalityState: 'confirmed_failed' as const,
      finalityReasonCode: finality.reasonCode || 'confirmed_failed',
      txHash: canonicalTxHash || undefined,
      allTxHashes,
    };
  }
  if (pendingByAdjudicator || allTxHashes.length > 0) {
    return {
      finalityState: 'pending_visibility' as const,
      finalityReasonCode: finality.reasonCode || 'pending_visibility',
      txHash: canonicalTxHash || undefined,
      allTxHashes,
    };
  }
  return {
    finalityState: 'retryable_unresolved' as const,
    finalityReasonCode: params.error || finality.reasonCode || 'retryable_unresolved',
    txHash: undefined,
    allTxHashes,
  };
}

export async function executeEvmExitPlan(plan: EvmExitSwapPlan): Promise<EvmExitExecutionResult> {
  const attempts = [
    {
      amountInHuman: plan.amountInHuman,
      slippageBps: plan.initialSlippageBps,
      executionStep: 'sell_external_primary',
      partial: false,
      sellRoutePolicy: plan.sellRoutePolicy,
      runtimeContext: plan.runtimeContext
    },
    {
      amountInHuman: plan.retryAmountInHuman,
      slippageBps: plan.retrySlippageBps,
      executionStep: 'sell_external_retry',
      partial: true,
      sellRoutePolicy: plan.sellRoutePolicy,
      runtimeContext: createExitOrderRuntimeContext({
        userId: plan.userId,
        walletAddress: plan.walletAddress,
        chainId: plan.chainId,
        tokenAddress: plan.tokenAddress,
        exitReason: plan.exitReason,
        targetWallet: String(plan.runtimeContext.metadata.targetWallet || '') || undefined
      })
    },
    {
      amountInHuman: plan.retryAmountInHuman,
      slippageBps: plan.retrySlippageBps,
      executionStep: 'sell_direct_fallback',
      partial: true,
      sellRoutePolicy: 'direct_primary' as const,
      runtimeContext: createExitOrderRuntimeContext({
        userId: plan.userId,
        walletAddress: plan.walletAddress,
        chainId: plan.chainId,
        tokenAddress: plan.tokenAddress,
        exitReason: plan.exitReason,
        targetWallet: String(plan.runtimeContext.metadata.targetWallet || '') || undefined
      })
    }
  ];

  let lastError = 'unknown_exit_error';
  let lastRuntime = plan.runtimeContext;
  let lastFinality: EvmExitExecutionResult['finalityState'] = 'retryable_unresolved';
  let pendingOutcome: Omit<EvmExitExecutionResult, 'runtimeContext' | 'isPartialSell'> | null = null;

  for (let index = 0; index < attempts.length; index++) {
    const attempt = attempts[index];
    logger.info(LogCode.EXE_TX_BROADCAST, 'Mirror sell unified route attempt', {
      userId: plan.userId,
      tokenAddress: plan.tokenAddress,
      chainId: plan.chainId,
      attempt: index + 1,
      amountIn: attempt.amountInHuman,
      slippageBps: attempt.slippageBps,
      executionMode: plan.executionMode,
      sellRoutePolicy: attempt.sellRoutePolicy,
      executionStep: attempt.executionStep
    });

    try {
      const result = await runExitSwapAttempt(
        plan,
        attempt.amountInHuman,
        attempt.slippageBps,
        attempt.executionStep,
        attempt.sellRoutePolicy,
        attempt.runtimeContext
      );
      lastRuntime = mergeSwapResultIntoExitRuntime(attempt.runtimeContext, result);
      logOrderRuntimeSnapshot(lastRuntime, '[OrderRuntime] mirror-sell-attempt-finish');
      const finality = resolveAttemptFinality({
        plan,
        txHash: result.txHash,
        runtimeContext: lastRuntime,
        txLifecycle: result.txLifecycle,
        error: result.error || undefined,
      });
      if (finality.finalityState === 'confirmed_success' && finality.txHash) {
        return {
          success: true,
          finalityState: 'confirmed_success',
          finalityReasonCode: finality.finalityReasonCode,
          txHash: finality.txHash,
          allTxHashes: finality.allTxHashes,
          runtimeContext: lastRuntime,
          isPartialSell: attempt.partial
        };
      }
      lastFinality = finality.finalityState;
      if (finality.finalityState === 'pending_visibility') {
        pendingOutcome = {
          success: false,
          finalityState: 'pending_visibility',
          finalityReasonCode: finality.finalityReasonCode,
          txHash: finality.txHash,
          allTxHashes: finality.allTxHashes,
          error: result.error || 'exit_confirmation_pending',
        };
        break;
      }
      lastError = compactError(result.error || 'exit_swap_failed');
    } catch (error: any) {
      lastError = compactError(error);
      logger.warn(LogCode.EXE_TX_REVERTED, 'Unified mirror sell attempt failed', {
        userId: plan.userId,
        tokenAddress: plan.tokenAddress,
        chainId: plan.chainId,
        attempt: index + 1,
        error: lastError
      });
    }
  }

  if (pendingOutcome) {
    return {
      ...pendingOutcome,
      runtimeContext: lastRuntime,
      isPartialSell: false,
    };
  }

  return {
    success: false,
    finalityState: lastFinality,
    finalityReasonCode: lastError,
    error: lastError,
    runtimeContext: lastRuntime,
    isPartialSell: false
  };
}
