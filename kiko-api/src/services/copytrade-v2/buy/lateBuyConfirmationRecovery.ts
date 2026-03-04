import { getTransactionReceipt } from '../../rpcManager.js';
import { resolveTxFinalState } from '../../order-runtime/adjudicator/finalState.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import type { ConfirmationOutcome } from '../../swap/confirmationCoordinator.js';

const DEFAULT_RECOVERY_TIMEOUT_MS = Math.max(30_000, Number(process.env.COPYTRADE_BUY_LATE_RECOVERY_TIMEOUT_MS || '180000'));
const DEFAULT_RECOVERY_POLL_MS = Math.max(1_000, Number(process.env.COPYTRADE_BUY_LATE_RECOVERY_POLL_MS || '5000'));

const inflightRecoveries = new Map<string, Promise<void>>();

function buildRecoveryKey(chainId: number, txHash: string): string {
  return `${chainId}:${String(txHash || '').toLowerCase()}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function probeBuyConfirmation(chainId: number, txHash: string): Promise<ConfirmationOutcome | null> {
  const finalState = resolveTxFinalState({ chainId, txHash });
  if (finalState.success) {
    return { success: true, kind: 'confirmed_success', visible: true };
  }
  if (finalState.failed) {
    return {
      success: false,
      kind: 'confirmed_failed',
      reason: finalState.reasonCode || 'transaction_reverted',
      visible: finalState.visible
    };
  }

  const receipt = await getTransactionReceipt(chainId, txHash).catch(() => null);
  if (!receipt) return null;

  const success = receipt?.status === 1 || receipt?.status === '0x1' || receipt?.status === 1n;
  if (success) {
    return { success: true, kind: 'confirmed_success', visible: true, receipt };
  }
  return {
    success: false,
    kind: 'confirmed_failed',
    reason: String(receipt?.revertReason || receipt?.reason || receipt?.status || 'transaction_reverted'),
    visible: true,
    receipt
  };
}

export function scheduleLateBuyConfirmationRecovery(params: {
  chainId: number;
  txHash: string;
  tokenAddress: string;
  onResolved: (confirmation: ConfirmationOutcome) => Promise<void>;
  timeoutMs?: number;
  pollMs?: number;
}, deps?: {
  probeBuyConfirmation?: (chainId: number, txHash: string) => Promise<ConfirmationOutcome | null>;
  sleep?: (ms: number) => Promise<void>;
}): void {
  const recoveryKey = buildRecoveryKey(params.chainId, params.txHash);
  if (inflightRecoveries.has(recoveryKey)) {
    return;
  }

  const timeoutMs = Math.max(5_000, Number(params.timeoutMs ?? DEFAULT_RECOVERY_TIMEOUT_MS));
  const pollMs = Math.max(1_000, Number(params.pollMs ?? DEFAULT_RECOVERY_POLL_MS));

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
      const confirmation = await (deps?.probeBuyConfirmation || probeBuyConfirmation)(params.chainId, params.txHash);
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
