import { getPendingNonce } from '../../privyWallet.js';
import { executeSwapViaPort } from '../../swap/swapExecutionPort.js';
import type { MainSwapRequest } from '../../MainSwapService.js';
import type { CopytradeExecutionOutcome } from '../contracts/outcomes.js';
import type { CopytradeExecutionPort, CopytradeIngressSignal } from '../contracts/ports.js';
import type { CopytradeOrderAggregate } from '../contracts/aggregate.js';
import { resolveTradingContext } from './contextResolver.js';
import { resolveBuyAmountInHuman, resolveSellAmountInHuman } from './amountResolver.js';
import { mapSwapResultToOutcome, mapThrownErrorToOutcome } from './outcomeMapper.js';
import { resolveNonceConflictDecision } from './nonceConflictPolicy.js';

function toExecutionMode(mode: CopytradeOrderAggregate['mode']): 'safe' | 'normal' | 'turbo' {
  if (mode === 'safety') return 'safe';
  if (mode === 'turbo') return 'turbo';
  return 'normal';
}

function isSellDirection(order: CopytradeOrderAggregate): boolean {
  if (order.direction === 'sell') return true;
  return order.lifecycleState === 'EXIT_ARMED'
    || order.lifecycleState === 'EXIT_SUBMITTING'
    || order.lifecycleState === 'EXIT_ACCEPTED';
}

function isExplicitTokenSwap(order: CopytradeOrderAggregate): boolean {
  return order.direction === 'token_swap' && order.metadata?.directionIsExplicitTokenSwap === true;
}

function buildDirectSwapHint(signal: CopytradeIngressSignal): MainSwapRequest['directSwapHint'] {
  if (!signal.swap) return undefined;
  return {
    sourceDexName: signal.swap.dexName,
    sourceRouter: signal.swap.router,
    sourceTxHash: signal.swap.txHash,
    sourceTokenIn: signal.swap.tokenIn,
    sourceTokenOut: signal.swap.tokenOut,
    sourceAmountIn: signal.swap.amountIn,
    sourceAmountOut: signal.swap.amountOut,
    routeHopCount: signal.swap.routeHopCount,
    routeHops: signal.swap.routeHops,
    canUseResolvedPoolFastPath: signal.swap.canUseResolvedPoolFastPath,
    resolvedPoolHint: signal.swap.resolvedPoolHint,
  };
}

function resolveCtIssueHint(signal: CopytradeIngressSignal, order: CopytradeOrderAggregate): `CT-${string}` | undefined {
  const raw = String(signal.ctIssueHintId || order.metadata?.ctIssueHintId || '').trim().toUpperCase();
  if (!/^CT-\d{3}$/.test(raw)) return undefined;
  return raw as `CT-${string}`;
}

export class EvmTradingFlowExecutor implements CopytradeExecutionPort {
  async execute(signal: CopytradeIngressSignal, order: CopytradeOrderAggregate): Promise<CopytradeExecutionOutcome> {
    if (signal.chainId === 900) {
      return {
        status: 'failed_terminal',
        reasonCode: 'failed_terminal',
        retryable: false,
        sourceTxHash: signal.swap?.txHash || null,
        metadata: {
          reason: 'evm_executor_received_solana_chain',
          chainId: signal.chainId,
        },
      };
    }

    const context = await resolveTradingContext(order);
    if (!context || !context.userId || !context.walletAddress) {
      return {
        status: 'failed_terminal',
        reasonCode: 'failed_terminal',
        retryable: false,
        sourceTxHash: signal.swap?.txHash || null,
        metadata: {
          reason: 'missing_trading_context',
          orderId: order.id,
        },
      };
    }

    if (!order.requestKey) {
      return {
        status: 'failed_terminal',
        reasonCode: 'request_key_missing',
        retryable: false,
        sourceTxHash: signal.swap?.txHash || null,
        metadata: {
          reason: 'copytrade_order_missing_request_key',
          orderId: order.id,
        },
      };
    }

    const sellDirection = isSellDirection(order);
    const tokenSwapDirection = isExplicitTokenSwap(order);

    const sellResolution = (sellDirection || tokenSwapDirection)
      ? await resolveSellAmountInHuman({
          walletAddress: context.walletAddress,
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
    const amountInHuman = (sellDirection || tokenSwapDirection)
      ? sellResolution?.amountInHuman || null
      : (await resolveBuyAmountInHuman({
          tokenIn: signal.swap.tokenIn,
          chainId: signal.chainId,
          buyAmountUsd: context.buyAmountUsd,
        })).amountInHuman;

    if (!amountInHuman || Number(amountInHuman) <= 0) {
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
        },
      };
    }

    const request: MainSwapRequest = {
      requestKey: order.requestKey,
      userId: context.userId,
      walletAddress: context.walletAddress,
      chainId: signal.chainId,
      tokenIn: signal.swap.tokenIn,
      tokenOut: signal.swap.tokenOut,
      amountIn: amountInHuman,
      slippageBps: context.maxSlippageBps,
      mode: 'copytrade',
      requireConfirmedTx: order.mode !== 'turbo',
      userSettings: {
        ...context.userSettings,
        copyTradeExecutionMode: context.executionMode || toExecutionMode(order.mode),
      },
      directSwapHint: buildDirectSwapHint(signal),
      executionContext: {
        copytradeRequestKey: order.requestKey,
        sourceTxHash: signal.swap.txHash,
        sourceRouter: signal.swap.router,
        sourceTxInput: signal.swap.sourceTxInput,
        sourceTxValue: signal.swap.sourceTxValue,
        sourceTokenIn: signal.swap.tokenIn,
        sourceTokenOut: signal.swap.tokenOut,
        sourceAmountIn: signal.swap.amountIn,
        sourceAmountOut: signal.swap.amountOut,
        executionStep: sellDirection
          ? 'copytrade_exit_v2'
          : tokenSwapDirection
            ? 'copytrade_token_swap_v2'
            : 'copytrade_buy_v2',
      },
      preWarmedNonce: getPendingNonce(signal.chainId, context.walletAddress),
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
      const nonceConflict = resolveNonceConflictDecision({
        error,
        chainId: signal.chainId,
        mode: order.mode,
      });
      if (nonceConflict.matched) {
        return {
          status: 'failed_retryable',
          reasonCode: 'trading_execution_failed',
          retryable: true,
          sourceTxHash: signal.swap?.txHash || null,
          lifecycleStatus: 'unknown',
          visibilityState: 'unknown',
          finalityHint: 'none',
          metadata: {
            hint: nonceConflict.hint,
            nonceConflict: true,
            nonceStrategy: nonceConflict.strategy,
            retryDelayMs: nonceConflict.retryDelayMs,
            chainId: signal.chainId,
            error: String((error as any)?.message || error || 'nonce_conflict').slice(0, 240),
          },
        };
      }

      return mapThrownErrorToOutcome(error, {
        preferredIssueId: resolveCtIssueHint(signal, order),
        sourceTxHash: signal.swap?.txHash || null,
      });
    }
  }
}
