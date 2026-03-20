import { LogCode } from '../../../config/logRegistry.js';
import { logger } from '../../../utils/logger.js';
import type { ConfirmationOutcome } from '../../swap/confirmationCoordinator.js';
import type { OrderRuntimeContext } from '../../order-runtime/types.js';
import { waitForCopytradeBuyConfirmation } from './buyConfirmationPolicy.js';
import { scheduleLateBuyConfirmationRecovery } from './lateBuyConfirmationRecovery.js';
import type { BuyConfirmationTransitionResult } from './buyConfirmationTransition.js';
import { observeCanonicalOrderState, scheduleCanonicalOrderObservation } from '../orders/canonicalOrderObserver.js';

export async function runCopytradeBuyConfirmationFlow(params: {
  chainId: number;
  txHash: string;
  tokenAddress: string;
  timeoutMs: number;
  pollMs: number;
  txHashes?: string[];
  orderId?: string | null;
  runtimeContext?: OrderRuntimeContext | null;
  onTransition: (
    confirmation: ConfirmationOutcome,
    recoverySource: 'initial_wait' | 'late_recovery',
  ) => Promise<BuyConfirmationTransitionResult>;
  lateRecoveryTimeoutMs?: number;
  lateRecoveryPollMs?: number;
}, deps?: {
  waitForCopytradeBuyConfirmation?: typeof waitForCopytradeBuyConfirmation;
  observeCanonicalOrderState?: typeof observeCanonicalOrderState;
  scheduleCanonicalOrderObservation?: typeof scheduleCanonicalOrderObservation;
  scheduleLateBuyConfirmationRecovery?: typeof scheduleLateBuyConfirmationRecovery;
}): Promise<'completed' | 'scheduled_late_recovery' | 'confirmation_unavailable'> {
  const waitForConfirmation = deps?.waitForCopytradeBuyConfirmation || waitForCopytradeBuyConfirmation;
  const observeOrder = deps?.observeCanonicalOrderState || observeCanonicalOrderState;
  const scheduleObservation = deps?.scheduleCanonicalOrderObservation || scheduleCanonicalOrderObservation;
  const scheduleLateRecovery = deps?.scheduleLateBuyConfirmationRecovery || scheduleLateBuyConfirmationRecovery;
  const orderId = params.orderId || params.runtimeContext?.orderId || null;

  const observation = orderId
    ? await observeOrder({
        orderId,
        kind: 'buy',
        chainId: params.chainId,
        txHashes: params.txHashes,
        timeoutMs: params.timeoutMs,
        pollMs: params.pollMs,
      }).catch(() => null)
    : null;

  if (!observation && !orderId) {
    const confirmation = await waitForConfirmation({
      chainId: params.chainId,
      txHash: params.txHash,
      timeoutMs: params.timeoutMs,
      pollMs: params.pollMs,
      txHashes: params.txHashes,
      orderId: params.orderId,
      runtimeContext: params.runtimeContext,
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
        txHashes: params.txHashes,
        orderId: params.orderId,
        runtimeContext: params.runtimeContext,
        timeoutMs: params.lateRecoveryTimeoutMs,
        pollMs: params.lateRecoveryPollMs,
        onResolved: async () => undefined,
      });
      return 'scheduled_late_recovery';
    }
    return 'completed';
  }

  if (!observation) {
    logger.warn(LogCode.SYS_ERROR, '[CopyTradeBuyConfirm] Confirmation wait failed', {
      chainId: params.chainId,
      token: params.tokenAddress,
      txHash: params.txHash,
    });
    if (orderId) {
      await scheduleObservation({
        orderId,
        kind: 'buy',
        txHash: params.txHash,
        delayMs: params.lateRecoveryPollMs,
        reasonCode: 'confirmation_unavailable',
      }).catch(() => null);
    }
    return 'confirmation_unavailable';
  }

  const confirmation = observation.confirmation;
  if (confirmation.kind !== 'confirmed_success' && confirmation.kind !== 'confirmed_failed') {
    if (orderId) {
      await scheduleObservation({
        orderId,
        kind: 'buy',
        txHash: confirmation.resolvedTxHash || params.txHash,
        delayMs: params.lateRecoveryPollMs,
        reasonCode: observation.reasonCode,
      }).catch(() => null);
    }
    scheduleLateRecovery({
      chainId: params.chainId,
      txHash: confirmation.resolvedTxHash || params.txHash,
      tokenAddress: params.tokenAddress,
      txHashes: params.txHashes,
      orderId: params.orderId,
      runtimeContext: params.runtimeContext,
      timeoutMs: params.lateRecoveryTimeoutMs,
      pollMs: params.lateRecoveryPollMs,
      onResolved: async () => undefined,
    });
    return 'scheduled_late_recovery';
  }

  const transitionResult = await params.onTransition(confirmation, 'initial_wait');
  if (transitionResult === 'deferred') {
    scheduleLateRecovery({
      chainId: params.chainId,
      txHash: params.txHash,
      tokenAddress: params.tokenAddress,
      txHashes: params.txHashes,
      orderId: params.orderId,
      runtimeContext: params.runtimeContext,
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
  txHashes?: string[];
  orderId?: string | null;
  runtimeContext?: OrderRuntimeContext | null;
  onTransition: (
    confirmation: ConfirmationOutcome,
    recoverySource: 'initial_wait' | 'late_recovery',
  ) => Promise<BuyConfirmationTransitionResult>;
  lateRecoveryTimeoutMs?: number;
  lateRecoveryPollMs?: number;
}, deps?: {
  setTimeout?: (handler: () => void, timeoutMs: number) => unknown;
  waitForCopytradeBuyConfirmation?: typeof waitForCopytradeBuyConfirmation;
  observeCanonicalOrderState?: typeof observeCanonicalOrderState;
  scheduleCanonicalOrderObservation?: typeof scheduleCanonicalOrderObservation;
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
      txHashes: params.txHashes,
      orderId: params.orderId,
      runtimeContext: params.runtimeContext,
      onTransition: params.onTransition,
      lateRecoveryTimeoutMs: params.lateRecoveryTimeoutMs,
      lateRecoveryPollMs: params.lateRecoveryPollMs,
    }, {
      waitForCopytradeBuyConfirmation: deps?.waitForCopytradeBuyConfirmation,
      observeCanonicalOrderState: deps?.observeCanonicalOrderState,
      scheduleCanonicalOrderObservation: deps?.scheduleCanonicalOrderObservation,
      scheduleLateBuyConfirmationRecovery: deps?.scheduleLateBuyConfirmationRecovery,
    });
  }, params.delayMs);
}
