import type { DecodedSwap } from '../../txDecoder.js';
import { resolveExecutionModeFromConfig } from '../../copyTradeExecutionMode.js';
import prisma from '../../../db/prisma.js';
import { LogCode } from '../../../config/logRegistry.js';
import { logger } from '../../../utils/logger.js';
import { DefaultCopytradeModeResolver, resolveSignalMode } from '../policies/modePolicyResolver.js';
import { PrismaCopytradeOrderRepository } from '../data-flow/orderRepository.js';
import { PrismaCopytradeEventStore } from '../data-flow/eventStore.js';
import { PrismaCopytradeExecutionRecorder } from '../data-flow/executionRecorder.js';
import { InMemoryCopytradeRetryScheduler } from '../data-flow/retryScheduler.js';
import { LoggerObservabilitySink } from '../observability/loggerSink.js';
import { ChainRoutedTradingFlowExecutor } from '../trading-flow/routerExecutor.js';
import { CopytradeOrderFlowOrchestrator, type CopytradeOrderFlowResult } from '../order-flow/orchestrator.js';
import type { CopytradeOrderAggregate } from '../contracts/aggregate.js';
import type { CopytradeReasonCode } from '../contracts/lifecycle.js';
import type { CopytradeMode } from '../contracts/modePolicy.js';
import type { CopytradeExecutionOutcome, CopytradeTxFinalityEvent } from '../contracts/outcomes.js';
import type { CopytradeNotificationEvent } from '../contracts/notifications.js';
import { evaluateIngressGuards, resolveRuntimeControls } from './controls.js';
import { normalizeWallet } from './chainIdentityNormalizer.js';
import { CopytradeTxFinalityBridge } from './txFinalityBridge.js';
import { CopytradeBuyPositionBridge } from './buyPositionBridge.js';
import {
  CopytradeNotificationPublisher,
  logNotificationPublishFailure,
} from '../notifications/copytradeNotificationPublisher.js';

export interface HandleSwapContext {
  detectedAt?: number;
}

function buildNotificationEventFromOrder(params: {
  order: CopytradeOrderAggregate;
  skipped: boolean;
  reasonCode: CopytradeReasonCode;
  outcome?: CopytradeExecutionOutcome;
}): CopytradeNotificationEvent | null {
  const { order, skipped, reasonCode, outcome } = params;
  const txHash = outcome?.txHash || null;
  const errorMessage = typeof outcome?.metadata?.error === 'string'
    ? outcome.metadata.error
    : null;

  if (skipped) {
    return {
      type: 'SKIPPED',
      order,
      reasonCode,
      txHash,
      sourceTxHash: outcome?.sourceTxHash || order.txHash,
      error: errorMessage,
    };
  }

  if (
    order.lifecycleState === 'FAILED_TERMINAL'
    || order.lifecycleState === 'FAILED_RETRYABLE'
    || outcome?.status === 'failed_terminal'
    || outcome?.status === 'failed_retryable'
  ) {
    return {
      type: 'EXECUTION_FAILED',
      order,
      reasonCode,
      txHash,
      sourceTxHash: outcome?.sourceTxHash || order.txHash,
      error: errorMessage || reasonCode,
    };
  }

  if (order.lifecycleState === 'BUY_ACCEPTED') {
    return {
      type: 'BUY_ACCEPTED',
      order,
      reasonCode,
      txHash,
      sourceTxHash: outcome?.sourceTxHash || order.txHash,
    };
  }

  if (
    order.lifecycleState === 'BUY_CONFIRMED_OPEN'
    || (
      order.lifecycleState === 'EXIT_ARMED'
      && outcome?.reasonCode === 'ok_buy_confirmed_open'
    )
  ) {
    return {
      type: 'BUY_CONFIRMED_OPEN',
      order,
      reasonCode,
      txHash,
      sourceTxHash: outcome?.sourceTxHash || order.txHash,
    };
  }

  if (order.lifecycleState === 'EXIT_ACCEPTED') {
    return {
      type: 'EXIT_SUBMITTED',
      order,
      reasonCode,
      txHash,
      sourceTxHash: outcome?.sourceTxHash || order.txHash,
    };
  }

  if (order.lifecycleState === 'EXIT_CONFIRMED_CLOSED') {
    return {
      type: 'EXIT_CONFIRMED_CLOSED',
      order,
      reasonCode,
      txHash,
      sourceTxHash: outcome?.sourceTxHash || order.txHash,
    };
  }

  return null;
}

export class CopytradeV2Runtime {
  private readonly orderFlow: CopytradeOrderFlowOrchestrator;
  private readonly finalityBridge: CopytradeTxFinalityBridge;
  private readonly buyPositionBridge: CopytradeBuyPositionBridge;
  private readonly notificationPublisher: CopytradeNotificationPublisher;

  constructor() {
    const observability = new LoggerObservabilitySink();
    const modeResolver = new DefaultCopytradeModeResolver();
    this.orderFlow = new CopytradeOrderFlowOrchestrator({
      orderRepo: new PrismaCopytradeOrderRepository(),
      eventStore: new PrismaCopytradeEventStore(),
      executionPort: new ChainRoutedTradingFlowExecutor(),
      executionRecorder: new PrismaCopytradeExecutionRecorder(),
      modeResolver,
      retryScheduler: new InMemoryCopytradeRetryScheduler(observability),
      observability,
    });
    this.finalityBridge = new CopytradeTxFinalityBridge({
      onFinalityEvent: async (event) => {
        await this.handleTxFinalityEvent(event);
      },
    });
    this.buyPositionBridge = new CopytradeBuyPositionBridge();
    this.notificationPublisher = new CopytradeNotificationPublisher();
  }

  async handleSwapDetected(
    targetWallet: string,
    swap: DecodedSwap,
    chainId: number,
    context?: HandleSwapContext,
  ): Promise<void> {
    const controls = resolveRuntimeControls();
    const guard = evaluateIngressGuards({ controls, chainId, swap });
    if (!guard.allowed) {
      logger.warn(LogCode.SYS_INFO, '[CopyTradeV2] ingress blocked by runtime controls', {
        chainId,
        targetWallet,
        txHash: swap?.txHash || undefined,
        reason: guard.reason,
        controls,
      });
      return;
    }

    const mode = controls.forceMode || await this.resolveMode(targetWallet, chainId);
    const result = await this.orderFlow.processSignal({
      targetWallet,
      swap,
      chainId,
      detectedAt: context?.detectedAt,
      mode,
    });
    const executionStatus = result.executionOutcome?.status || null;
    const executionReasonCode = result.executionOutcome?.reasonCode || null;
    const executionTxHash = result.executionOutcome?.txHash || null;
    const executionSkipReason = typeof result.executionOutcome?.metadata?.reason === 'string'
      ? result.executionOutcome.metadata.reason
      : null;

    logger.info(LogCode.SYS_INFO, '[CopyTradeV2] order processed', {
      orderId: result.order.id,
      chainId,
      mode: result.mode,
      skipped: result.skipped,
      lifecycleState: result.order.lifecycleState,
      reasonCode: result.reasonCode,
      executionStatus,
      executionReasonCode,
      executionTxHash,
      executionSkipReason,
      txHash: swap?.txHash || undefined,
      targetWallet,
    });

    if (chainId === 900 && executionStatus && !executionTxHash) {
      logger.warn(LogCode.WTC_TX_SKIPPED, '[CopyTradeV2] Solana order processed without execution tx hash', {
        orderId: result.order.id,
        lifecycleState: result.order.lifecycleState,
        reasonCode: result.reasonCode,
        executionStatus,
        executionReasonCode,
        executionSkipReason,
        sourceTxHash: swap?.txHash || null,
        targetWallet,
      });
    }

    await this.handlePrimaryResult(result, swap);
  }

  private async handlePrimaryResult(result: CopytradeOrderFlowResult, swap: DecodedSwap): Promise<void> {
    let order = result.order;

    order = await this.syncBuyPositionForPrimaryResult(order, result.executionOutcome);

    const notificationEvent = buildNotificationEventFromOrder({
      order,
      skipped: result.skipped,
      reasonCode: result.reasonCode,
      outcome: result.executionOutcome,
    });
    if (notificationEvent) {
      await this.publishNotification(notificationEvent);
    }

    const executionTxHash = String(result.executionOutcome?.txHash || '').trim();
    const pendingFinality = Boolean(
      executionTxHash
      && (
        result.executionOutcome?.status === 'accepted'
        || result.executionOutcome?.status === 'submitted'
      ),
    );
    if (!pendingFinality) return;

    const intent = order.lifecycleState.startsWith('EXIT_') ? 'exit' : 'buy';
    this.finalityBridge.watch({
      orderId: order.id,
      chainId: order.chainId,
      txHash: executionTxHash,
      sourceTxHash: result.executionOutcome?.sourceTxHash || swap?.txHash || null,
      dexName: swap?.dexName || 'copytrade-v2',
      intent,
    });
  }

  private async handleTxFinalityEvent(event: CopytradeTxFinalityEvent): Promise<void> {
    const applied = await this.orderFlow.processTxFinalityEvent(event);
    if (!applied.order) return;

    const orderAfter = await this.syncBuyPositionForFinality(applied.order, event);
    const notificationEvent = buildNotificationEventFromOrder({
      order: orderAfter,
      skipped: false,
      reasonCode: applied.reasonCode || event.reasonCode,
      outcome: {
        status: event.kind === 'confirmed_success'
          ? 'confirmed'
          : event.kind === 'timeout_uncertain'
            ? 'deferred'
            : 'failed_terminal',
        reasonCode: applied.reasonCode || event.reasonCode,
        retryable: event.kind === 'timeout_uncertain',
        sourceTxHash: event.sourceTxHash || orderAfter.txHash,
        txHash: event.txHash,
        lifecycleStatus: event.kind === 'confirmed_success'
          ? 'confirmed_success'
          : event.kind === 'confirmed_failed'
            ? 'confirmed_failed'
            : 'dropped_timeout',
        visibilityState: event.kind === 'timeout_uncertain' ? 'visible' : 'confirmed',
        finalityHint: event.kind,
      },
    });
    if (notificationEvent) {
      await this.publishNotification(notificationEvent);
    }
  }

  private async syncBuyPositionForPrimaryResult(
    order: CopytradeOrderAggregate,
    outcome?: CopytradeExecutionOutcome,
  ): Promise<CopytradeOrderAggregate> {
    if (order.direction === 'sell') return order;

    let patchedOrder = order;
    if (order.lifecycleState === 'BUY_ACCEPTED') {
      const pending = await this.buyPositionBridge.ensurePending(order, outcome);
      if (pending.positionId) {
        const patched = await this.orderFlow.patchOrderMetadata(order.id, {
          ...(order.metadata || {}),
          buyPositionId: pending.positionId,
          executionTxHash: outcome?.txHash || null,
        });
        if (patched) patchedOrder = patched;
      }
      return patchedOrder;
    }

    if (order.lifecycleState === 'BUY_CONFIRMED_OPEN' || order.lifecycleState === 'EXIT_ARMED') {
      await this.buyPositionBridge.promoteOpen(order, outcome);
      return patchedOrder;
    }

    if (order.lifecycleState === 'FAILED_TERMINAL' || order.lifecycleState === 'FAILED_RETRYABLE') {
      await this.buyPositionBridge.markFailed(order);
      return patchedOrder;
    }

    return patchedOrder;
  }

  private async syncBuyPositionForFinality(
    order: CopytradeOrderAggregate,
    event: CopytradeTxFinalityEvent,
  ): Promise<CopytradeOrderAggregate> {
    if (order.direction === 'sell') return order;

    if (event.kind === 'confirmed_success') {
      await this.buyPositionBridge.promoteOpen(order, {
        status: 'confirmed',
        reasonCode: 'ok_buy_confirmed_open',
        retryable: false,
        sourceTxHash: event.sourceTxHash || order.txHash,
        txHash: event.txHash,
        lifecycleStatus: 'confirmed_success',
        visibilityState: 'confirmed',
        finalityHint: 'confirmed_success',
      });
      return order;
    }

    if (event.kind === 'confirmed_failed') {
      await this.buyPositionBridge.markFailed(order);
      return order;
    }

    await this.buyPositionBridge.ensurePending(order, {
      status: 'deferred',
      reasonCode: 'deferred_confirmation_pending',
      retryable: true,
      sourceTxHash: event.sourceTxHash || order.txHash,
      txHash: event.txHash,
      lifecycleStatus: 'dropped_timeout',
      visibilityState: 'visible',
      finalityHint: 'timeout_uncertain',
    });
    return order;
  }

  private async publishNotification(event: CopytradeNotificationEvent): Promise<void> {
    try {
      await this.notificationPublisher.publish(event);
    } catch (error) {
      logNotificationPublishFailure(error, event);
    }
  }

  private async resolveMode(targetWallet: string, chainId: number): Promise<CopytradeMode> {
    const normalizedTargetWallet = normalizeWallet(chainId, targetWallet);
    const config = await prisma.copyTradeConfig.findFirst({
      where: {
        targetWallet: normalizedTargetWallet,
        chainId,
        status: 'active',
      },
      select: {
        executionMode: true,
        disableTokenInfo: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    const resolved = resolveExecutionModeFromConfig({
      requested: config?.executionMode,
      legacyDisableTokenInfo: config?.disableTokenInfo,
      fallback: 'normal',
    });

    if (resolved.mode === 'safe') return resolveSignalMode('safety');
    return resolveSignalMode(resolved.mode);
  }
}
