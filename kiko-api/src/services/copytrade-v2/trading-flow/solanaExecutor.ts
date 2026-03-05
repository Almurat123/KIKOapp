import { executeSwapViaPort } from '../../swap/swapExecutionPort.js';
import { getSolanaEmbeddedWalletAddress } from '../../privyWallet.js';
import type { MainSwapRequest } from '../../MainSwapService.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import type { CopytradeExecutionOutcome } from '../contracts/outcomes.js';
import type { CopytradeExecutionPort, CopytradeIngressSignal } from '../contracts/ports.js';
import type { CopytradeOrderAggregate } from '../contracts/aggregate.js';
import { resolveTradingContext } from './contextResolver.js';
import { resolveBuyAmountInHuman, resolveSellAmountInHuman } from './amountResolver.js';
import { mapSwapResultToOutcome, mapThrownErrorToOutcome } from './outcomeMapper.js';

function isSellDirection(order: CopytradeOrderAggregate): boolean {
  if (order.direction === 'sell') return true;
  return order.lifecycleState === 'EXIT_ARMED'
    || order.lifecycleState === 'EXIT_SUBMITTING'
    || order.lifecycleState === 'EXIT_ACCEPTED';
}

function resolveCtIssueHint(signal: CopytradeIngressSignal, order: CopytradeOrderAggregate): `CT-${string}` | undefined {
  const raw = String(signal.ctIssueHintId || order.metadata?.ctIssueHintId || '').trim().toUpperCase();
  if (!/^CT-\d{3}$/.test(raw)) return undefined;
  return raw as `CT-${string}`;
}

function resolveSolanaAmountRetryDelayMs(mode: CopytradeOrderAggregate['mode']): number {
  if (mode === 'turbo') return 650;
  if (mode === 'safety') return 2600;
  return 1400;
}

const SOLANA_MIN_SELL_AMOUNT_HUMAN = 0.000001;

export class SolanaTradingFlowExecutor implements CopytradeExecutionPort {
  async execute(signal: CopytradeIngressSignal, order: CopytradeOrderAggregate): Promise<CopytradeExecutionOutcome> {
    if (signal.chainId !== 900) {
      return {
        status: 'failed_terminal',
        reasonCode: 'failed_terminal',
        retryable: false,
        sourceTxHash: signal.swap?.txHash || null,
        metadata: {
          reason: 'solana_executor_received_non_solana_chain',
          chainId: signal.chainId,
        },
      };
    }

    const context = await resolveTradingContext(order);
    if (!context || !context.userId) {
      logger.warn(LogCode.WTC_TX_SKIPPED, '[CopyTradeV2][SolanaExecution] skipped before send: missing trading context', {
        orderId: order.id,
        chainId: signal.chainId,
        txHash: signal.swap?.txHash || undefined,
      });
      return {
        status: 'failed_terminal',
        reasonCode: 'validation_unroutable',
        retryable: false,
        sourceTxHash: signal.swap?.txHash || null,
        metadata: {
          reason: 'missing_trading_context',
          orderId: order.id,
        },
      };
    }

    const walletAddress = context.walletAddress || await getSolanaEmbeddedWalletAddress(context.userId) || '';
    if (!walletAddress) {
      logger.warn(LogCode.WTC_TX_SKIPPED, '[CopyTradeV2][SolanaExecution] skipped before send: missing solana wallet', {
        orderId: order.id,
        userId: context.userId,
        chainId: signal.chainId,
        txHash: signal.swap?.txHash || undefined,
      });
      return {
        status: 'failed_terminal',
        reasonCode: 'validation_unroutable',
        retryable: false,
        sourceTxHash: signal.swap?.txHash || null,
        metadata: {
          reason: 'missing_solana_wallet',
          orderId: order.id,
          userId: context.userId,
        },
      };
    }

    const sellDirection = isSellDirection(order);

    const sellResolution = sellDirection
      ? await resolveSellAmountInHuman({
          walletAddress,
          tokenIn: signal.swap.tokenIn,
          chainId: signal.chainId,
          context: {
            userId: context.userId,
            configId: order.configId || context.configId || null,
            targetWallet: order.targetWallet,
            mode: order.mode,
            sourceAmountIn: signal.swap.amountIn,
          },
        })
      : null;
    const amountInHuman = sellDirection
      ? sellResolution?.amountInHuman || null
      : (await resolveBuyAmountInHuman({
          tokenIn: signal.swap.tokenIn,
          chainId: signal.chainId,
          buyAmountUsd: context.buyAmountUsd,
        })).amountInHuman;
    const parsedSellAmount = Number(amountInHuman || 0);

    if (
      sellDirection
      && amountInHuman
      && Number.isFinite(parsedSellAmount)
      && parsedSellAmount > 0
      && parsedSellAmount < SOLANA_MIN_SELL_AMOUNT_HUMAN
    ) {
      logger.info(LogCode.WTC_TX_SKIPPED, '[CopyTradeV2][SolanaExecution] deferred before send: amount below min sell threshold', {
        orderId: order.id,
        chainId: signal.chainId,
        txHash: signal.swap?.txHash || undefined,
        sellDirection,
        amountInHuman,
        minSellAmount: SOLANA_MIN_SELL_AMOUNT_HUMAN,
        sellAmountFallbackSource: sellResolution?.source || null,
      });
      return {
        status: 'deferred',
        reasonCode: 'deferred_retry_later',
        retryable: true,
        sourceTxHash: signal.swap?.txHash || null,
        metadata: {
          reason: 'amount_below_min_sell_threshold',
          sellDirection,
          tokenIn: signal.swap.tokenIn,
          amountInHuman,
          minSellAmount: SOLANA_MIN_SELL_AMOUNT_HUMAN,
          sellAmountFallbackSource: sellResolution?.source || null,
          sellAmountFallbackMetadata: sellResolution?.metadata || null,
          retryDelayMs: resolveSolanaAmountRetryDelayMs(order.mode),
        },
      };
    }

    if (!amountInHuman || Number(amountInHuman) <= 0) {
      logger.info(LogCode.WTC_TX_SKIPPED, '[CopyTradeV2][SolanaExecution] skipped before send: amount resolution failed', {
        orderId: order.id,
        chainId: signal.chainId,
        txHash: signal.swap?.txHash || undefined,
        sellDirection,
        tokenIn: signal.swap.tokenIn,
        tokenOut: signal.swap.tokenOut,
        sellAmountFallbackSource: sellResolution?.source || null,
        sellAmountFallbackMetadata: sellResolution?.metadata || null,
      });
      return {
        status: 'deferred',
        reasonCode: 'deferred_retry_later',
        retryable: true,
        sourceTxHash: signal.swap?.txHash || null,
        metadata: {
          reason: 'amount_resolution_failed',
          sellDirection,
          tokenIn: signal.swap.tokenIn,
          sellAmountFallbackSource: sellResolution?.source || null,
          sellAmountFallbackMetadata: sellResolution?.metadata || null,
          retryDelayMs: resolveSolanaAmountRetryDelayMs(order.mode),
        },
      };
    }

    const request: MainSwapRequest = {
      userId: context.userId,
      walletAddress,
      chainId: signal.chainId,
      tokenIn: signal.swap.tokenIn,
      tokenOut: signal.swap.tokenOut,
      amountIn: amountInHuman,
      slippageBps: context.maxSlippageBps,
      mode: 'copytrade',
      requireConfirmedTx: order.mode !== 'turbo',
      userSettings: {
        ...context.userSettings,
      },
      executionContext: {
        sourceTxHash: signal.swap.txHash,
        sourceRouter: signal.swap.router,
        sourceTxInput: signal.swap.sourceTxInput,
        sourceTxValue: signal.swap.sourceTxValue,
        sourceTokenIn: signal.swap.tokenIn,
        sourceTokenOut: signal.swap.tokenOut,
        sourceAmountIn: signal.swap.amountIn,
        sourceAmountOut: signal.swap.amountOut,
        executionStep: sellDirection ? 'copytrade_exit_v2' : 'copytrade_buy_v2',
      },
    };

    try {
      const result = await executeSwapViaPort(request);
      const outcome = mapSwapResultToOutcome(result, {
        preferredIssueId: resolveCtIssueHint(signal, order),
        sourceTxHash: signal.swap?.txHash || null,
      });

      if (sellDirection && outcome.status === 'confirmed') {
        return {
          ...outcome,
          reasonCode: 'ok_exit_confirmed_closed',
        };
      }

      if (
        sellDirection
        && (outcome.status === 'submitted' || outcome.status === 'accepted')
        && outcome.reasonCode !== 'trading_execution_uncertain'
      ) {
        return {
          ...outcome,
          reasonCode: 'ok_exit_submitted',
        };
      }

      return outcome;
    } catch (error) {
      return mapThrownErrorToOutcome(error, {
        preferredIssueId: resolveCtIssueHint(signal, order),
        sourceTxHash: signal.swap?.txHash || null,
      });
    }
  }
}
