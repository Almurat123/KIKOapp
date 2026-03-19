import { LogCode } from '../../../config/logRegistry.js';
import { logger } from '../../../utils/logger.js';
import type { DirectSwapHint, MainSwapRequest, MainSwapResult } from '../../MainSwapService.js';
import { executeSwapViaPort } from '../../swap/swapExecutionPort.js';
import type { DecodedSwap } from '../../txDecoder.js';
import type { OrderRuntimeContext } from '../../order-runtime/types.js';
import { buildOrderAuditFields } from '../../order-runtime/sinks/persistence.js';
import type { CopyTradeExecutionMode } from '../../copyTradeExecutionMode.js';
import { buildCopytradeBuyPlannedArtifact } from './plannedExecutionArtifact.js';
import { shouldAbortCopytradeBuyRetry } from './copytradeBuyRetryGuard.js';
import { resolveTxFinalState } from '../../order-runtime/adjudicator/finalState.js';
import { evaluateCopytradeBuyAdmission } from './buyAdmissionGuard.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function compactCopyTradeError(error: any): string {
  return String(error?.message || error || 'unknown_error').slice(0, 240);
}

function inferCopyTradeBugHint(error: any): string {
  const msg = compactCopyTradeError(error).toLowerCase();
  if (msg.includes('allowance') || msg.includes('approve')) return 'allowance_path';
  if (msg.includes('slippage') || msg.includes('price impact')) return 'slippage_price';
  if (msg.includes('nonce') || msg.includes('replacement')) return 'nonce_conflict';
  if (msg.includes('timeout') || msg.includes('rpc') || msg.includes('network')) return 'rpc_timeout';
  if (msg.includes('quote') || msg.includes('liquidity')) return 'quote_liquidity';
  if (msg.includes('revert')) return 'onchain_revert';
  return 'unknown';
}

export type EvmCopytradeBuySubmissionResult =
  | {
      status: 'submitted';
      txHash: string;
      attributedEntryAmountHuman?: string;
      txLifecycleStatus?: string;
      runtimeContext?: OrderRuntimeContext;
      swapMetadata?: MainSwapResult['metadata'];
    }
  | {
      status: 'submitted_unresolved';
      reasonCode: string;
      txLifecycleStatus?: string;
      runtimeContext?: OrderRuntimeContext;
      swapMetadata?: MainSwapResult['metadata'];
    }
  | {
      status: 'aborted';
      reasonCode: string;
    };

export async function executeEvmCopytradeBuySubmissionFlow(params: {
  userId: string;
  privyUserId: string;
  walletAddress: string;
  tokenToBuy: string;
  chainId: number;
  usdAmount: number;
  nativePrice: number;
  baseSlippageBps: number;
  executionMode: CopyTradeExecutionMode;
  turboMode: boolean;
  fastSwapMode: boolean;
  checkTokenBeforeSwap: boolean;
  tokenInfo: { price: number };
  swap?: DecodedSwap;
  feeBpsOverride?: number;
  directSwapHint?: DirectSwapHint;
  preWarmedNonce?: Promise<string | undefined>;
  refreshTokenInfoForRetry?: () => Promise<{ price?: number } | null>;
  targetExecutionPrice?: number;
  entryDeviationReferencePrice?: number;
  entryDeviationReferenceSource?: 'market_oracle_price' | 'local_quote_price' | 'reference_unavailable';
  maxEntryDeviationBps?: number;
  maxEntryDeviationSource?: string;
  maxEntryDeviationReasonCode?: string;
  maxEntryDeviationThresholdPolicy?: string;
  maxEntryDeviationModeFloorBps?: number | null;
  allowFallbackEntryDeviationBypass?: boolean;
  pendingPositionId?: string | null;
}, deps?: {
  buildCopytradeBuyPlannedArtifact?: typeof buildCopytradeBuyPlannedArtifact;
  executeSwapViaPort?: typeof executeSwapViaPort;
  shouldAbortCopytradeBuyRetry?: typeof shouldAbortCopytradeBuyRetry;
  evaluateCopytradeBuyAdmission?: typeof evaluateCopytradeBuyAdmission;
  sleep?: (ms: number) => Promise<void>;
}): Promise<EvmCopytradeBuySubmissionResult> {
  const artifactBuilder = deps?.buildCopytradeBuyPlannedArtifact || buildCopytradeBuyPlannedArtifact;
  const swapExecutor = deps?.executeSwapViaPort || executeSwapViaPort;
  const abortRetryGuard = deps?.shouldAbortCopytradeBuyRetry || shouldAbortCopytradeBuyRetry;
  const admissionGuard = deps?.evaluateCopytradeBuyAdmission || evaluateCopytradeBuyAdmission;
  const sleepFn = deps?.sleep || sleep;

  const baseAmount = params.usdAmount / params.nativePrice;
  const timingDetectedAt = Date.now();
  const plannedArtifact = await artifactBuilder({
    chainId: params.chainId,
    walletAddress: params.walletAddress,
    tokenIn: 'ETH',
    tokenOut: params.tokenToBuy,
    swap: params.swap,
  });

  const buildRequest = async (args: {
    amount: number;
    slippageBps: number;
    executionStep: 'buy_step_1' | 'buy_step_2' | 'buy_step_3';
    includePreWarmedNonce?: boolean;
  }): Promise<MainSwapRequest> => {
    const amountIn = args.amount.toFixed(18);
    const executionPlan = await plannedArtifact.getExecutionPlan(amountIn);
    return {
      userId: params.privyUserId,
      walletAddress: params.walletAddress,
      tokenIn: 'ETH',
      tokenOut: params.tokenToBuy,
      amountIn,
      chainId: params.chainId,
      slippageBps: args.slippageBps,
      mode: 'copytrade',
      feeBpsOverride: params.feeBpsOverride,
      directSwapHint: params.directSwapHint,
      executionContext: {
        ...plannedArtifact.executionContextBase,
        executionStep: args.executionStep,
        copytradeFallbackPricingGuard: params.turboMode ? {
          stage: '0x_fallback',
          targetExecutionPrice: params.targetExecutionPrice,
          referencePrice: params.entryDeviationReferencePrice,
          referencePriceSource: params.entryDeviationReferenceSource,
          maxEntryDeviationBps: params.maxEntryDeviationBps,
          thresholdSource: params.maxEntryDeviationSource,
          thresholdReasonCode: params.maxEntryDeviationReasonCode,
          thresholdPolicy: params.maxEntryDeviationThresholdPolicy,
          modeFloorBps: params.maxEntryDeviationModeFloorBps,
          inputValueUsd: params.usdAmount,
          allowUnreliablePriceBypass: params.allowFallbackEntryDeviationBypass,
        } : undefined,
        copytradePendingPositionId: params.pendingPositionId || undefined,
      },
      executionPlan,
      userSettings: {
        fastSwapMode: params.fastSwapMode,
        copyTradeExecutionMode: params.executionMode,
      },
      preWarmedNonce: args.includePreWarmedNonce ? params.preWarmedNonce : undefined,
    };
  };

  const adoptAcceptedResult = (request: MainSwapRequest | undefined, reasonCode: string): EvmCopytradeBuySubmissionResult | null => {
    const decision = abortRetryGuard({
      chainId: params.chainId,
      runtimeContext: request?.runtimeContext,
    });
    if (!decision.shouldAbortRetry || !decision.txHash) return null;
    logger.warn(LogCode.SYS_INFO, reasonCode, {
      userId: params.userId,
      token: params.tokenToBuy,
      txHash: decision.txHash,
      reasonCode: decision.reasonCode,
    });
    return {
      status: 'submitted',
      txHash: decision.txHash,
      txLifecycleStatus: request?.runtimeContext?.lastLifecycle?.status || 'broadcasted_unseen',
      runtimeContext: request?.runtimeContext,
    };
  };

  const adoptUnresolvedResult = (
    request: MainSwapRequest | undefined,
    failedResult: MainSwapResult | null | undefined,
    reasonCode: string,
  ): EvmCopytradeBuySubmissionResult | null => {
    const runtimeContext = failedResult?.runtimeContext || request?.runtimeContext;
    if (!runtimeContext) return null;
    const resolution = resolveTxFinalState({
      runtimeContext,
      lifecycle: failedResult?.txLifecycle || runtimeContext.lastLifecycle || null,
      chainId: params.chainId,
      txHash: runtimeContext.canonicalTxHash,
      orderId: runtimeContext.orderId,
    });
    if (resolution.failed || resolution.success) return null;
    const errorText = compactCopyTradeError(failedResult?.error || failedResult?.metadata?.txLifecycleStatus || reasonCode).toLowerCase();
    const looksUnresolved =
      errorText.includes('timeout')
      || errorText.includes('rpc')
      || errorText.includes('network')
      || resolution.state === 'rpc_uncertain'
      || resolution.state === 'send_accepted';
    if (!looksUnresolved) return null;
    logger.warn(LogCode.SYS_INFO, reasonCode, {
      userId: params.userId,
      token: params.tokenToBuy,
      chainId: params.chainId,
      runtimeState: runtimeContext.state,
      canonicalTxHash: runtimeContext.canonicalTxHash || null,
      resolutionState: resolution.state,
      resolutionReasonCode: resolution.reasonCode,
    });
    return {
      status: 'submitted_unresolved',
      reasonCode: resolution.reasonCode || 'submission_unresolved',
      txLifecycleStatus: failedResult?.txLifecycle?.status || failedResult?.metadata?.txLifecycleStatus || runtimeContext.lastLifecycle?.status || 'broadcasted_unseen',
      runtimeContext,
      swapMetadata: failedResult?.metadata,
    };
  };

  const abortIfBuyPreempted = async (stage: string): Promise<EvmCopytradeBuySubmissionResult | null> => {
    const admission = await admissionGuard({
      pendingPositionId: params.pendingPositionId,
    });
    if (!admission.blocked) return null;
    logger.warn(LogCode.SYS_INFO, `[CopyTradeBuyGuard] Buy submission aborted before ${stage}`, {
      userId: params.userId,
      token: params.tokenToBuy,
      chainId: params.chainId,
      pendingPositionId: params.pendingPositionId || null,
      reasonCode: admission.reasonCode,
      targetSellTxHash: admission.targetSellTxHash || null,
      acceptedTxHash: admission.acceptedTxHash || null,
    });
    return {
      status: 'aborted',
      reasonCode: admission.reasonCode,
    };
  };

  let attributedEntryAmountHuman: string | undefined;
  let txLifecycleStatus: string | undefined;
  let runtimeContext: OrderRuntimeContext | undefined;
  let swapMetadata: MainSwapResult['metadata'] | undefined;

  const step1Request = await buildRequest({
    amount: baseAmount,
    slippageBps: params.baseSlippageBps,
    executionStep: 'buy_step_1',
    includePreWarmedNonce: true,
  });

  try {
    const preemptedBeforeStep1 = await abortIfBuyPreempted('buy_step_1_send');
    if (preemptedBeforeStep1) return preemptedBeforeStep1;
    logger.info(LogCode.EXE_TX_BROADCAST, `Buy Step 1: 100% amount, ${params.baseSlippageBps / 100}% slippage`, {
      userId: params.userId,
      eth: baseAmount.toFixed(6),
      timingMs: Date.now() - timingDetectedAt,
    });
    const result1 = await swapExecutor(step1Request);
    if (!result1.success || !result1.txHash) {
      const adopted = adoptAcceptedResult(step1Request, 'Accepted buy tx already exists after Step 1 failure; aborting further buy retries');
      if (adopted) return adopted;
      const unresolved = adoptUnresolvedResult(step1Request, result1, 'Buy Step 1 entered unresolved submission state; preserving pending position');
      if (unresolved) return unresolved;
      throw new Error(result1.error);
    }
    attributedEntryAmountHuman = result1.amountOut || attributedEntryAmountHuman;
    txLifecycleStatus = result1.txLifecycle?.status || result1.metadata?.txLifecycleStatus;
    runtimeContext = result1.runtimeContext;
    swapMetadata = result1.metadata;
    logger.info(LogCode.EXE_TX_BROADCAST, '[CopyTradeTiming] buy step 1 success', {
      userId: params.userId,
      token: params.tokenToBuy,
      txHash: result1.txHash,
      txLifecycleStatus: txLifecycleStatus || 'unknown',
      ...buildOrderAuditFields(runtimeContext),
      timingMs: Date.now() - timingDetectedAt,
    });
    return {
      status: 'submitted',
      txHash: result1.txHash,
      attributedEntryAmountHuman,
      txLifecycleStatus,
      runtimeContext,
      swapMetadata,
    };
  } catch (buyErr1: any) {
    logger.warn(LogCode.EXE_TX_REVERTED, 'Buy Step 1 failed', {
      userId: params.userId,
      error: compactCopyTradeError(buyErr1),
      bugHint: inferCopyTradeBugHint(buyErr1),
      chainId: params.chainId,
      token: params.tokenToBuy,
    });
    if (params.turboMode) {
      logger.warn(LogCode.EXE_TX_REVERTED, 'Turbo mode: skip slow multi-step retries after step1 failure', {
        userId: params.userId,
        token: params.tokenToBuy,
        error: compactCopyTradeError(buyErr1),
        bugHint: inferCopyTradeBugHint(buyErr1),
      });
      return { status: 'aborted', reasonCode: 'turbo_step1_failed' };
    }
    if (params.checkTokenBeforeSwap) {
      logger.info(LogCode.EXE_QUOTE_FETCHED, 'Conservative Mode: Checking price stability before retry...', {
        userId: params.userId,
      });
      try {
        const freshInfo = await params.refreshTokenInfoForRetry?.();
        if (!freshInfo || !freshInfo.price || freshInfo.price <= 0) {
          logger.warn(LogCode.API_FETCH_FAILED, 'Conservative Mode: Failed to re-check price, aborting for safety', {
            userId: params.userId,
          });
          return { status: 'aborted', reasonCode: 'conservative_refresh_failed' };
        }
        const priceChange = freshInfo.price / params.tokenInfo.price;
        if (priceChange > 2.0) {
          logger.warn(LogCode.WTC_TX_SKIPPED, `Conservative Mode: Price spiked ${((priceChange - 1) * 100).toFixed(1)}%, aborting retry`, {
            userId: params.userId,
            oldPrice: params.tokenInfo.price,
            newPrice: freshInfo.price,
          });
          return { status: 'aborted', reasonCode: 'conservative_price_spike' };
        }
        params.tokenInfo.price = freshInfo.price;
      } catch {
        logger.warn(LogCode.API_FETCH_FAILED, 'Conservative Mode: Failed to re-check price, aborting for safety', {
          userId: params.userId,
        });
        return { status: 'aborted', reasonCode: 'conservative_refresh_failed' };
      }
    }
  }

  logger.info(LogCode.EXE_TX_BROADCAST, 'Aggressive Mode: Initiating retry sequence...', {
    userId: params.userId,
  });
  await sleepFn(500);

  const amount99 = baseAmount * 0.99;
  const slippage2 = Math.min(Math.floor(params.baseSlippageBps * 1.25), 2000);
  const step2Request = await buildRequest({
    amount: amount99,
    slippageBps: slippage2,
    executionStep: 'buy_step_2',
  });
  try {
    const preemptedBeforeStep2 = await abortIfBuyPreempted('buy_step_2_send');
    if (preemptedBeforeStep2) return preemptedBeforeStep2;
    logger.info(LogCode.EXE_TX_BROADCAST, `Buy Step 2: 99% amount, ${slippage2 / 100}% slippage`, {
      userId: params.userId,
      eth: amount99.toFixed(6),
    });
    const result2 = await swapExecutor(step2Request);
    if (!result2.success || !result2.txHash) throw new Error(result2.error);
    attributedEntryAmountHuman = result2.amountOut || attributedEntryAmountHuman;
    txLifecycleStatus = result2.txLifecycle?.status || result2.metadata?.txLifecycleStatus;
    runtimeContext = result2.runtimeContext;
    swapMetadata = result2.metadata;
    return {
      status: 'submitted',
      txHash: result2.txHash,
      attributedEntryAmountHuman,
      txLifecycleStatus,
      runtimeContext,
      swapMetadata,
    };
  } catch (buyErr2: any) {
    logger.warn(LogCode.EXE_TX_REVERTED, 'Buy Step 2 failed, retrying final step...', {
      userId: params.userId,
      error: compactCopyTradeError(buyErr2),
      bugHint: inferCopyTradeBugHint(buyErr2),
      chainId: params.chainId,
      token: params.tokenToBuy,
    });
    const adopted = adoptAcceptedResult(step2Request, 'Accepted buy tx already exists after Step 2 failure; aborting final buy retry');
    if (adopted) return adopted;
  }

  await sleepFn(500);

  const amount98 = baseAmount * 0.98;
  const slippage3 = Math.min(Math.floor(params.baseSlippageBps * 1.5), 2500);
  const step3Request = await buildRequest({
    amount: amount98,
    slippageBps: slippage3,
    executionStep: 'buy_step_3',
  });
  try {
    const preemptedBeforeStep3 = await abortIfBuyPreempted('buy_step_3_send');
    if (preemptedBeforeStep3) return preemptedBeforeStep3;
    logger.info(LogCode.EXE_TX_BROADCAST, `Buy Step 3: 98% amount, ${slippage3 / 100}% slippage`, {
      userId: params.userId,
      eth: amount98.toFixed(6),
    });
    const result3 = await swapExecutor(step3Request);
    if (!result3.success || !result3.txHash) throw new Error(result3.error);
    attributedEntryAmountHuman = result3.amountOut || attributedEntryAmountHuman;
    txLifecycleStatus = result3.txLifecycle?.status || result3.metadata?.txLifecycleStatus;
    runtimeContext = result3.runtimeContext;
    swapMetadata = result3.metadata;
    return {
      status: 'submitted',
      txHash: result3.txHash,
      attributedEntryAmountHuman,
      txLifecycleStatus,
      runtimeContext,
      swapMetadata,
    };
  } catch (buyErr3: any) {
    logger.error(LogCode.EXE_TX_REVERTED, 'All buy steps failed for token', {
      userId: params.userId,
      token: params.tokenToBuy,
      error: compactCopyTradeError(buyErr3),
      bugHint: inferCopyTradeBugHint(buyErr3),
      chainId: params.chainId,
    });
    return { status: 'aborted', reasonCode: 'all_buy_steps_failed' };
  }
}
