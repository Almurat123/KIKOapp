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
import { CopytradeOrderFlowOrchestrator } from '../order-flow/orchestrator.js';
import type { CopytradeMode } from '../contracts/modePolicy.js';
import { evaluateIngressGuards, resolveRuntimeControls } from './controls.js';

export interface HandleSwapContext {
  detectedAt?: number;
}

export class CopytradeV2Runtime {
  private readonly orderFlow: CopytradeOrderFlowOrchestrator;

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
  }

  private async resolveMode(targetWallet: string, chainId: number): Promise<CopytradeMode> {
    const config = await prisma.copyTradeConfig.findFirst({
      where: {
        targetWallet: String(targetWallet || '').trim().toLowerCase(),
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
