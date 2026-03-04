import { executeSwapViaPort } from '../../swap/swapExecutionPort.js';
import { getSolanaEmbeddedWalletAddress } from '../../privyWallet.js';
import type { MainSwapRequest } from '../../MainSwapService.js';
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

export class SolanaTradingFlowExecutor implements CopytradeExecutionPort {
  async execute(signal: CopytradeIngressSignal, order: CopytradeOrderAggregate): Promise<CopytradeExecutionOutcome> {
    if (signal.chainId !== 900) {
      return {
        status: 'failed_terminal',
        reasonCode: 'failed_terminal',
        retryable: false,
        metadata: {
          reason: 'solana_executor_received_non_solana_chain',
          chainId: signal.chainId,
        },
      };
    }

    const context = await resolveTradingContext(order);
    if (!context || !context.userId) {
      return {
        status: 'failed_terminal',
        reasonCode: 'failed_terminal',
        retryable: false,
        metadata: {
          reason: 'missing_trading_context',
          orderId: order.id,
        },
      };
    }

    const walletAddress = context.walletAddress || await getSolanaEmbeddedWalletAddress(context.userId) || '';
    if (!walletAddress) {
      return {
        status: 'failed_terminal',
        reasonCode: 'failed_terminal',
        retryable: false,
        metadata: {
          reason: 'missing_solana_wallet',
          orderId: order.id,
          userId: context.userId,
        },
      };
    }

    const sellDirection = isSellDirection(order);

    const amountInHuman = sellDirection
      ? await resolveSellAmountInHuman({
          walletAddress,
          tokenIn: signal.swap.tokenIn,
          chainId: signal.chainId,
        })
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
        metadata: {
          reason: 'amount_resolution_failed',
          sellDirection,
          tokenIn: signal.swap.tokenIn,
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
      });

      if (sellDirection && outcome.status === 'confirmed') {
        return {
          ...outcome,
          reasonCode: 'ok_exit_confirmed_closed',
        };
      }

      if (sellDirection && (outcome.status === 'submitted' || outcome.status === 'accepted')) {
        return {
          ...outcome,
          reasonCode: 'ok_exit_submitted',
        };
      }

      return outcome;
    } catch (error) {
      return mapThrownErrorToOutcome(error, {
        preferredIssueId: resolveCtIssueHint(signal, order),
      });
    }
  }
}
