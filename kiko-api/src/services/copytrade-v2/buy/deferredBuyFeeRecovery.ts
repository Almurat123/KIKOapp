import { LogCode } from '../../../config/logRegistry.js';
import { logger } from '../../../utils/logger.js';
import {
  collectDirectSwapFeeFromSettlement,
  type DirectSwapFeeSettlement,
} from '../../swap/fee/directSwapFeeCollector.js';
import { isTransactionQueueBusy } from '../../privyWallet.js';
import { hasActiveMirrorSellIntentForUserChain } from '../exit/positionExitIntentStore.js';

const DEFERRED_FEE_RETRY_DELAYS_MS = [3_000, 5_000, 10_000, 20_000, 30_000, 60_000, 120_000];

type TimerHandle = ReturnType<typeof setTimeout>;

export interface DeferredBuyFeeRecoveryParams {
  userId: string;
  chainId: number;
  tokenAddress: string;
  txHash: string;
  recoverySource: 'initial_wait' | 'late_recovery';
  settlement: DirectSwapFeeSettlement;
}

interface DeferredBuyFeeRecoveryDeps {
  hasActiveMirrorSellIntentForUserChain?: typeof hasActiveMirrorSellIntentForUserChain;
  isTransactionQueueBusy?: typeof isTransactionQueueBusy;
  collectDirectSwapFeeFromSettlement?: typeof collectDirectSwapFeeFromSettlement;
  setTimeoutFn?: (fn: () => void, delayMs: number) => TimerHandle;
  clearTimeoutFn?: (handle: TimerHandle) => void;
  computeRetryDelayMs?: (attempt: number) => number;
}

interface DeferredBuyFeeRecoveryState {
  timer?: TimerHandle;
  attempt: number;
  running: boolean;
}

function normalizeHash(value: string | undefined | null): string {
  return String(value || '').trim().toLowerCase();
}

function buildRecoveryKey(params: DeferredBuyFeeRecoveryParams): string {
  const sourceTxHash = normalizeHash(params.settlement.sourceTxHash);
  return [
    params.userId,
    params.chainId,
    sourceTxHash || normalizeHash(params.txHash),
    params.settlement.normalizedTokenOut.toLowerCase(),
  ].join(':');
}

function defaultRetryDelayMs(attempt: number): number {
  return DEFERRED_FEE_RETRY_DELAYS_MS[Math.min(attempt, DEFERRED_FEE_RETRY_DELAYS_MS.length - 1)] ?? 120_000;
}

export function createDeferredBuyFeeRecoveryScheduler(deps: DeferredBuyFeeRecoveryDeps = {}) {
  const queryActiveMirrorSellIntent = deps.hasActiveMirrorSellIntentForUserChain || hasActiveMirrorSellIntentForUserChain;
  const queryTransactionQueueBusy = deps.isTransactionQueueBusy || isTransactionQueueBusy;
  const recoverFee = deps.collectDirectSwapFeeFromSettlement || collectDirectSwapFeeFromSettlement;
  const setTimeoutFn = deps.setTimeoutFn || setTimeout;
  const clearTimeoutFn = deps.clearTimeoutFn || clearTimeout;
  const computeRetryDelayMs = deps.computeRetryDelayMs || defaultRetryDelayMs;
  const scheduled = new Map<string, DeferredBuyFeeRecoveryState>();

  const clearScheduled = (key: string): void => {
    const state = scheduled.get(key);
    if (state?.timer) clearTimeoutFn(state.timer);
    scheduled.delete(key);
  };

  const runAttempt = async (key: string, params: DeferredBuyFeeRecoveryParams): Promise<void> => {
    const state = scheduled.get(key);
    if (!state) return;

    state.running = true;
    state.timer = undefined;

    try {
      const hasActiveMirrorSell = await queryActiveMirrorSellIntent({
        userId: params.userId,
        chainId: params.chainId,
      });
      const queueBusy = queryTransactionQueueBusy(params.userId, params.chainId);

      if (hasActiveMirrorSell || queueBusy) {
        const nextAttempt = state.attempt + 1;
        state.attempt = nextAttempt;
        state.running = false;
        const delayMs = computeRetryDelayMs(nextAttempt - 1);
        state.timer = setTimeoutFn(() => {
          void runAttempt(key, params);
        }, delayMs);
        state.timer?.unref?.();
        logger.info(LogCode.SYS_INFO, '[CopyTradeBuyFeeRecovery] Deferred while wallet exit lane is busy', {
          userId: params.userId,
          chainId: params.chainId,
          token: params.tokenAddress,
          txHash: params.txHash,
          recoverySource: params.recoverySource,
          hasActiveMirrorSell,
          queueBusy,
          attempt: nextAttempt,
          delayMs,
        });
        return;
      }

      await recoverFee({
        userId: params.userId,
        settlement: {
          ...params.settlement,
          deferred: false,
          reasonCode: 'confirmed_success_recovery',
        },
        trace: (msg: string) => `[CopyTradeBuyFeeRecovery] ${msg}`,
      });
      clearScheduled(key);
    } catch (error: any) {
      const nextAttempt = state.attempt + 1;
      state.attempt = nextAttempt;
      state.running = false;
      const delayMs = computeRetryDelayMs(nextAttempt - 1);
      state.timer = setTimeoutFn(() => {
        void runAttempt(key, params);
      }, delayMs);
      state.timer?.unref?.();
      logger.warn(LogCode.SYS_ERROR, 'Deferred direct swap fee recovery failed, scheduling retry', {
        userId: params.userId,
        chainId: params.chainId,
        token: params.tokenAddress,
        txHash: params.txHash,
        recoverySource: params.recoverySource,
        attempt: nextAttempt,
        delayMs,
        error: error?.message || String(error),
      });
    }
  };

  const scheduleDeferredBuyFeeRecovery = (params: DeferredBuyFeeRecoveryParams): boolean => {
    if (!params.settlement?.deferred) return false;
    const key = buildRecoveryKey(params);
    if (scheduled.has(key)) return false;
    scheduled.set(key, { attempt: 0, running: false });
    const timer = setTimeoutFn(() => {
      void runAttempt(key, params);
    }, 0);
    timer?.unref?.();
    const state = scheduled.get(key);
    if (state) state.timer = timer;
    return true;
  };

  const resetForTests = (): void => {
    for (const key of Array.from(scheduled.keys())) {
      clearScheduled(key);
    }
  };

  const pendingCount = (): number => scheduled.size;

  return {
    scheduleDeferredBuyFeeRecovery,
    resetForTests,
    pendingCount,
  };
}

const defaultDeferredBuyFeeRecoveryScheduler = createDeferredBuyFeeRecoveryScheduler();

export const scheduleDeferredBuyFeeRecovery =
  defaultDeferredBuyFeeRecoveryScheduler.scheduleDeferredBuyFeeRecovery;

export function __resetDeferredBuyFeeRecoverySchedulerForTests(): void {
  defaultDeferredBuyFeeRecoveryScheduler.resetForTests();
}
