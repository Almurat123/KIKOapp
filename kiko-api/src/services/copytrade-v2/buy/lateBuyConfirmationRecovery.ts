import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import type { ConfirmationOutcome } from '../../swap/confirmationCoordinator.js';
import type { OrderRuntimeContext } from '../../order-runtime/types.js';
import { scheduleCanonicalOrderObservation } from '../orders/canonicalOrderObserver.js';

const DEFAULT_RECOVERY_POLL_MS = Math.max(1_000, Number(process.env.COPYTRADE_BUY_LATE_RECOVERY_POLL_MS || '5000'));

export function scheduleLateBuyConfirmationRecovery(params: {
  chainId: number;
  txHash: string;
  tokenAddress: string;
  txHashes?: string[];
  orderId?: string | null;
  runtimeContext?: OrderRuntimeContext | null;
  onResolved: (confirmation: ConfirmationOutcome) => Promise<void>;
  timeoutMs?: number;
  pollMs?: number;
}, deps?: {
  scheduleCanonicalOrderObservation?: typeof scheduleCanonicalOrderObservation;
}): void {
  const orderId = String(params.orderId || params.runtimeContext?.orderId || '').trim();
  if (!orderId) {
    logger.warn(LogCode.SYS_INFO, '[CopyTradeBuyConfirm] Late confirmation recovery skipped without canonical order id', {
      chainId: params.chainId,
      txHash: params.txHash,
      token: params.tokenAddress,
      reasonCode: 'confirmation_unavailable',
    });
    return;
  }

  const scheduleObservation = deps?.scheduleCanonicalOrderObservation || scheduleCanonicalOrderObservation;

  void scheduleObservation({
    orderId,
    kind: 'buy',
    txHash: params.txHash,
    delayMs: Math.max(100, Number(params.pollMs ?? DEFAULT_RECOVERY_POLL_MS)),
    reasonCode: 'buy_awaiting_finality',
    metadataPatch: {
      recoveryTimeoutMs: Number(params.timeoutMs || 0) || null,
      recoveryPollMs: Number(params.pollMs ?? DEFAULT_RECOVERY_POLL_MS),
    },
  }).then(() => {
    logger.info(LogCode.SYS_INFO, '[CopyTradeBuyConfirm] Late confirmation recovery persisted to canonical order observation queue', {
      chainId: params.chainId,
      txHash: params.txHash,
      token: params.tokenAddress,
      orderId,
      reasonCode: 'buy_awaiting_finality',
    });
  }).catch((error: any) => {
    logger.error(LogCode.SYS_ERROR, '[CopyTradeBuyConfirm] Failed to persist late confirmation recovery', {
      chainId: params.chainId,
      txHash: params.txHash,
      token: params.tokenAddress,
      orderId,
      error: error?.message || String(error),
    });
  });
}
