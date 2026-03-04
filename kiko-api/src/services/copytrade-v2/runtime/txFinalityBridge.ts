import { LogCode } from '../../../config/logRegistry.js';
import { logger } from '../../../utils/logger.js';
import { waitForTransactionConfirmation } from '../../swap/confirmationCoordinator.js';
import type { CopytradeReasonCode } from '../contracts/lifecycle.js';
import type { CopytradeTxFinalityEvent } from '../contracts/outcomes.js';
import { normalizeTxHash } from './chainIdentityNormalizer.js';

type FinalityIntent = 'buy' | 'exit';

export interface TxFinalityWatchRequest {
  orderId: string;
  chainId: number;
  txHash: string;
  sourceTxHash?: string | null;
  dexName?: string | null;
  intent: FinalityIntent;
}

export interface TxFinalityBridgeDeps {
  onFinalityEvent: (event: CopytradeTxFinalityEvent) => Promise<void>;
}

const inflightFinalityWatches = new Map<string, Promise<void>>();

function buildWatchKey(params: TxFinalityWatchRequest): string {
  return `${params.orderId}:${params.chainId}:${normalizeTxHash(params.chainId, params.txHash)}`;
}

function resolveSuccessReason(intent: FinalityIntent): CopytradeReasonCode {
  return intent === 'exit' ? 'ok_exit_confirmed_closed' : 'ok_buy_confirmed_open';
}

function resolveFailedReason(): CopytradeReasonCode {
  return 'failed_terminal';
}

function resolveTimeoutReason(): CopytradeReasonCode {
  return 'deferred_confirmation_pending';
}

export class CopytradeTxFinalityBridge {
  constructor(private readonly deps: TxFinalityBridgeDeps) {}

  watch(params: TxFinalityWatchRequest): void {
    const txHash = normalizeTxHash(params.chainId, params.txHash);
    if (!txHash) return;

    const key = buildWatchKey({ ...params, txHash });
    const existing = inflightFinalityWatches.get(key);
    if (existing) return;

    const task = this.watchOnce({ ...params, txHash })
      .catch((error) => {
        logger.warn(LogCode.SYS_ERROR, '[CopyTradeV2][FinalityBridge] watch failed', {
          orderId: params.orderId,
          chainId: params.chainId,
          txHash,
          error: String((error as any)?.message || error || 'unknown_error').slice(0, 240),
        });
      })
      .finally(() => {
        const current = inflightFinalityWatches.get(key);
        if (current === task) inflightFinalityWatches.delete(key);
      });

    inflightFinalityWatches.set(key, task);
  }

  private async watchOnce(params: TxFinalityWatchRequest & { txHash: string }): Promise<void> {
    const outcome = await waitForTransactionConfirmation({
      txHash: params.txHash,
      chainId: params.chainId,
      dexName: params.dexName || 'copytrade-v2',
      timeoutMs: Number(process.env.COPYTRADE_FINALITY_TIMEOUT_MS || 120000),
      pollMs: Number(process.env.COPYTRADE_FINALITY_POLL_MS || 2500),
    });

    let event: CopytradeTxFinalityEvent;
    if (outcome.kind === 'confirmed_success') {
      event = {
        orderId: params.orderId,
        chainId: params.chainId,
        txHash: params.txHash,
        sourceTxHash: params.sourceTxHash || null,
        kind: 'confirmed_success',
        reasonCode: resolveSuccessReason(params.intent),
        observedAt: new Date(),
      };
    } else if (outcome.kind === 'confirmed_failed') {
      event = {
        orderId: params.orderId,
        chainId: params.chainId,
        txHash: params.txHash,
        sourceTxHash: params.sourceTxHash || null,
        kind: 'confirmed_failed',
        reasonCode: resolveFailedReason(),
        observedAt: new Date(),
      };
    } else {
      event = {
        orderId: params.orderId,
        chainId: params.chainId,
        txHash: params.txHash,
        sourceTxHash: params.sourceTxHash || null,
        kind: 'timeout_uncertain',
        reasonCode: resolveTimeoutReason(),
        observedAt: new Date(),
      };
    }

    await this.deps.onFinalityEvent(event);
  }
}
