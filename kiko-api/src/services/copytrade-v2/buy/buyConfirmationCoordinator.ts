import { LogCode } from '../../../config/logRegistry.js';
import { logger } from '../../../utils/logger.js';
import type { ConfirmationOutcome } from '../../swap/confirmationCoordinator.js';
import { waitForCopytradeBuyConfirmation } from './buyConfirmationPolicy.js';
import { scheduleLateBuyConfirmationRecovery } from './lateBuyConfirmationRecovery.js';
import type { BuyConfirmationTransitionResult } from './buyConfirmationTransition.js';

export async function runCopytradeBuyConfirmationFlow(params: {
  chainId: number;
  txHash: string;
  tokenAddress: string;
  timeoutMs: number;
  pollMs: number;
  onTransition: (
    confirmation: ConfirmationOutcome,
    recoverySource: 'initial_wait' | 'late_recovery',
  ) => Promise<BuyConfirmationTransitionResult>;
  lateRecoveryTimeoutMs?: number;
  lateRecoveryPollMs?: number;
}, deps?: {
  waitForCopytradeBuyConfirmation?: typeof waitForCopytradeBuyConfirmation;
  scheduleLateBuyConfirmationRecovery?: typeof scheduleLateBuyConfirmationRecovery;
}): Promise<'completed' | 'scheduled_late_recovery' | 'confirmation_unavailable'> {
  const waitForConfirmation = deps?.waitForCopytradeBuyConfirmation || waitForCopytradeBuyConfirmation;
  const scheduleLateRecovery = deps?.scheduleLateBuyConfirmationRecovery || scheduleLateBuyConfirmationRecovery;

  const confirmation = await waitForConfirmation({
    chainId: params.chainId,
    txHash: params.txHash,
    timeoutMs: params.timeoutMs,
    pollMs: params.pollMs,
  }).catch(() => null);

  if (!confirmation) {
    logger.warn(LogCode.SYS_ERROR, '[CopyTradeBuyConfirm] Confirmation wait failed', {
      chainId: params.chainId,
      token: params.tokenAddress,
      txHash: params.txHash,
    });
    return 'confirmation_unavailable';
  }

  const transitionResult = await params.onTransition(confirmation, 'initial_wait');
  if (transitionResult === 'deferred') {
    scheduleLateRecovery({
      chainId: params.chainId,
      txHash: params.txHash,
      tokenAddress: params.tokenAddress,
      timeoutMs: params.lateRecoveryTimeoutMs,
      pollMs: params.lateRecoveryPollMs,
      onResolved: async (lateConfirmation) => {
        await params.onTransition(lateConfirmation, 'late_recovery');
      },
    });
    return 'scheduled_late_recovery';
  }

  return 'completed';
}

export function scheduleCopytradeBuyConfirmationFlow(params: {
  chainId: number;
  txHash: string;
  tokenAddress: string;
  delayMs: number;
  timeoutMs: number;
  pollMs: number;
  onTransition: (
    confirmation: ConfirmationOutcome,
    recoverySource: 'initial_wait' | 'late_recovery',
  ) => Promise<BuyConfirmationTransitionResult>;
  lateRecoveryTimeoutMs?: number;
  lateRecoveryPollMs?: number;
}, deps?: {
  setTimeout?: (handler: () => void, timeoutMs: number) => unknown;
  waitForCopytradeBuyConfirmation?: typeof waitForCopytradeBuyConfirmation;
  scheduleLateBuyConfirmationRecovery?: typeof scheduleLateBuyConfirmationRecovery;
}): void {
  const scheduleFn = deps?.setTimeout || setTimeout;
  scheduleFn(() => {
    void runCopytradeBuyConfirmationFlow({
      chainId: params.chainId,
      txHash: params.txHash,
      tokenAddress: params.tokenAddress,
      timeoutMs: params.timeoutMs,
      pollMs: params.pollMs,
      onTransition: params.onTransition,
      lateRecoveryTimeoutMs: params.lateRecoveryTimeoutMs,
      lateRecoveryPollMs: params.lateRecoveryPollMs,
    }, {
      waitForCopytradeBuyConfirmation: deps?.waitForCopytradeBuyConfirmation,
      scheduleLateBuyConfirmationRecovery: deps?.scheduleLateBuyConfirmationRecovery,
    });
  }, params.delayMs);
}