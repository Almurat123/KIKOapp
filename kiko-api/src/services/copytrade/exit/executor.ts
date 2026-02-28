import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import { MainSwapService } from '../../MainSwapService.js';
import { logOrderRuntimeSnapshot } from '../../order-runtime/sinks/logger.js';
import type { EvmExitExecutionResult, EvmExitSwapPlan, SellRoutePolicy } from './types.js';
import { createExitOrderRuntimeContext, mergeSwapResultIntoExitRuntime } from './runtime.js';

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
  return await MainSwapService.executeSwap({
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
      if (result.success && result.txHash) {
        return {
          success: true,
          txHash: result.txHash,
          runtimeContext: lastRuntime,
          isPartialSell: attempt.partial
        };
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

  return {
    success: false,
    error: lastError,
    runtimeContext: lastRuntime,
    isPartialSell: false
  };
}
