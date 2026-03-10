import { LogCode } from '../../../config/logRegistry.js';
import { logger } from '../../../utils/logger.js';
import {
  preheatSellApprovalForToken,
  type SellApprovalPreheatParams,
  type SellApprovalPreheatResult,
} from '../../sellApprovalPreheater.js';
import { isTransactionQueueBusy } from '../../privyWallet.js';
import { hasActiveMirrorSellIntentForUserChainAndToken } from '../exit/positionExitIntentStore.js';

const DEFERRED_APPROVAL_RETRY_DELAYS_MS = [2_000, 5_000, 10_000, 20_000, 30_000, 60_000];

type TimerHandle = ReturnType<typeof setTimeout>;

interface DeferredApprovalPreheatState {
  timer?: TimerHandle;
  attempt: number;
}

export interface DeferredSellApprovalPreheatParams extends SellApprovalPreheatParams {
  trigger: 'buy_confirmation' | 'mirror_sell_release';
}

interface DeferredSellApprovalPreheatDeps {
  preheatSellApprovalForToken?: typeof preheatSellApprovalForToken;
  hasActiveMirrorSellIntentForUserChainAndToken?: typeof hasActiveMirrorSellIntentForUserChainAndToken;
  isTransactionQueueBusy?: typeof isTransactionQueueBusy;
  setTimeoutFn?: (fn: () => void, delayMs: number) => TimerHandle;
  clearTimeoutFn?: (handle: TimerHandle) => void;
  computeRetryDelayMs?: (attempt: number) => number;
}

function buildApprovalKey(params: DeferredSellApprovalPreheatParams): string {
  return [
    params.userId,
    params.chainId,
    String(params.tokenAddress || '').trim().toLowerCase(),
  ].join(':');
}

function defaultRetryDelayMs(attempt: number): number {
  return DEFERRED_APPROVAL_RETRY_DELAYS_MS[Math.min(attempt, DEFERRED_APPROVAL_RETRY_DELAYS_MS.length - 1)] ?? 60_000;
}

export function createDeferredSellApprovalPreheatScheduler(deps: DeferredSellApprovalPreheatDeps = {}) {
  const runPreheat = deps.preheatSellApprovalForToken || preheatSellApprovalForToken;
  const hasActiveMirrorSell = deps.hasActiveMirrorSellIntentForUserChainAndToken || hasActiveMirrorSellIntentForUserChainAndToken;
  const queueBusy = deps.isTransactionQueueBusy || isTransactionQueueBusy;
  const setTimeoutFn = deps.setTimeoutFn || setTimeout;
  const clearTimeoutFn = deps.clearTimeoutFn || clearTimeout;
  const computeRetryDelayMs = deps.computeRetryDelayMs || defaultRetryDelayMs;
  const scheduled = new Map<string, DeferredApprovalPreheatState>();

  const clearScheduled = (key: string): void => {
    const state = scheduled.get(key);
    if (state?.timer) clearTimeoutFn(state.timer);
    scheduled.delete(key);
  };

  const runAttempt = async (key: string, params: DeferredSellApprovalPreheatParams): Promise<void> => {
    const state = scheduled.get(key);
    if (!state) return;

    const urgentApproval = await hasActiveMirrorSell({
      userId: params.userId,
      chainId: params.chainId,
      tokenAddress: params.tokenAddress,
    }).catch(() => false);

    const result = await runPreheat(params, {
      queueBehavior: urgentApproval ? 'allow_queue' : 'skip_if_busy',
      txPurpose: urgentApproval ? 'approval' : 'preheat',
    }).catch((error: any): SellApprovalPreheatResult => ({
      status: 'deferred',
      reasonCode: String(error?.message || error || 'approval_preheat_error'),
    }));

    if (result.status !== 'deferred') {
      clearScheduled(key);
      return;
    }

    const attempt = state.attempt + 1;
    state.attempt = attempt;
    const delayMs = computeRetryDelayMs(attempt - 1);
    state.timer = setTimeoutFn(() => {
      void runAttempt(key, params);
    }, delayMs);
    state.timer?.unref?.();
    logger.info(LogCode.SYS_INFO, '[SellApprovalPreheat] Deferred retry scheduled', {
      userId: params.userId,
      chainId: params.chainId,
      token: params.tokenAddress,
      trigger: params.trigger,
      urgentApproval,
      queueBusy: queueBusy(params.userId, params.chainId),
      attempt,
      delayMs,
      reasonCode: result.reasonCode,
    });
  };

  const scheduleDeferredSellApprovalPreheat = (params: DeferredSellApprovalPreheatParams): boolean => {
    const key = buildApprovalKey(params);
    if (scheduled.has(key)) return false;
    scheduled.set(key, { attempt: 0 });
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

  return {
    scheduleDeferredSellApprovalPreheat,
    resetForTests,
  };
}

const defaultDeferredSellApprovalPreheatScheduler = createDeferredSellApprovalPreheatScheduler();

export const scheduleDeferredSellApprovalPreheat =
  defaultDeferredSellApprovalPreheatScheduler.scheduleDeferredSellApprovalPreheat;

export function __resetDeferredSellApprovalPreheatSchedulerForTests(): void {
  defaultDeferredSellApprovalPreheatScheduler.resetForTests();
}
