import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import type { ConfirmationOutcome } from '../../swap/confirmationCoordinator.js';
import { waitForCopytradeBuyConfirmation } from './buyConfirmationPolicy.js';

const DEFAULT_RECOVERY_TIMEOUT_MS = Math.max(30_000, Number(process.env.COPYTRADE_BUY_LATE_RECOVERY_TIMEOUT_MS || '180000'));
const DEFAULT_RECOVERY_POLL_MS = Math.max(1_000, Number(process.env.COPYTRADE_BUY_LATE_RECOVERY_POLL_MS || '5000'));

const inflightRecoveries = new Map<string, Promise<void>>();

function buildRecoveryKey(chainId: number, txHash: string): string {
  return `${chainId}:${String(txHash || '').toLowerCase()}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function probeBuyConfirmation(params: {
  chainId: number;
  txHash: string;
  timeoutMs: number;
  pollMs: number;
}): Promise<ConfirmationOutcome | null> {
  const confirmation = await waitForCopytradeBuyConfirmation({
    chainId: params.chainId,
    txHash: params.txHash,
    timeoutMs: params.timeoutMs,
    pollMs: params.pollMs,
  }).catch(() => null);
  if (!confirmation) return null;
  if (confirmation.kind === 'confirmed_success' || confirmation.kind === 'confirmed_failed') {
    return confirmation;
  }
  return null;
}

export function scheduleLateBuyConfirmationRecovery(params: {
  chainId: number;
  txHash: string;
  tokenAddress: string;
  onResolved: (confirmation: ConfirmationOutcome) => Promise<void>;
  timeoutMs?: number;
  pollMs?: number;
}, deps?: {
  probeBuyConfirmation?: (params: { chainId: number; txHash: string; timeoutMs: number; pollMs: number; }) => Promise<ConfirmationOutcome | null>;
  sleep?: (ms: number) => Promise<void>;
}): void {
  const recoveryKey = buildRecoveryKey(params.chainId, params.txHash);
  if (inflightRecoveries.has(recoveryKey)) {
    return;
  }

  const timeoutMs = Math.max(100, Number(params.timeoutMs ?? DEFAULT_RECOVERY_TIMEOUT_MS));
  const pollMs = Math.max(10, Number(params.pollMs ?? DEFAULT_RECOVERY_POLL_MS));

  const task = (async () => {
    logger.info(LogCode.SYS_INFO, '[CopyTradeBuyConfirm] Late confirmation recovery started', {
      chainId: params.chainId,
      txHash: params.txHash,
      token: params.tokenAddress,
      timeoutMs,
      pollMs,
      reasonCode: 'BUY_CONFIRMATION_LATE_RECOVERY_STARTED'
    });

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const remainingTimeoutMs = Math.max(pollMs, deadline - Date.now());
      const confirmation = await (deps?.probeBuyConfirmation || probeBuyConfirmation)({
        chainId: params.chainId,
        txHash: params.txHash,
        timeoutMs: remainingTimeoutMs,
        pollMs,
      });
      if (confirmation) {
        logger.info(LogCode.SYS_INFO, '[CopyTradeBuyConfirm] Late confirmation resolved', {
          chainId: params.chainId,
          txHash: params.txHash,
          token: params.tokenAddress,
          kind: confirmation.kind,
          reasonCode: confirmation.kind === 'confirmed_success'
            ? 'BUY_CONFIRMATION_LATE_RECOVERY_CONFIRMED'
            : 'BUY_CONFIRMATION_LATE_RECOVERY_FAILED'
        });
        await params.onResolved(confirmation);
        return;
      }
      await (deps?.sleep || sleep)(pollMs);
    }

    logger.warn(LogCode.SYS_INFO, '[CopyTradeBuyConfirm] Late confirmation recovery exhausted', {
      chainId: params.chainId,
      txHash: params.txHash,
      token: params.tokenAddress,
      timeoutMs,
      reasonCode: 'BUY_CONFIRMATION_LATE_RECOVERY_EXHAUSTED'
    });
  })().finally(() => {
    inflightRecoveries.delete(recoveryKey);
  });

  inflightRecoveries.set(recoveryKey, task);
}
