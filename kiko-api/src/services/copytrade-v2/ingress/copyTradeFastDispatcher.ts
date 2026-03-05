import type { DecodedSwap } from '../../txDecoder.js';
import { enqueueCopyTradeTask } from '../../copyTradeQueue.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import { markCopyTradeTaskEnqueued, mergeCopyTradeTimingSnapshots, type CopyTradeTimingSnapshot } from '../timing/copyTradeTimingModel.js';
import { emitCopyTradeTimingAudit } from '../timing/copyTradeTimingAudit.js';
import { tryMarkCopyTradeIngressEnqueued } from './copyTradeIngressState.js';
import { evaluateCopytradeTargetAllowlist } from './targetAllowlist.js';
import { emitCopytradeDomainAudit } from '../audit/copytradeDomainAudit.js';

type DispatchParams = {
    chainId: number;
    txHash: string;
    targetWallet: string;
    swap: DecodedSwap;
    sourceTxFrom?: string;
    detectedAt?: number;
    timing?: CopyTradeTimingSnapshot;
    source: string;
};

export async function dispatchCopyTradeIfReady(params: DispatchParams): Promise<boolean> {
    const allowlist = evaluateCopytradeTargetAllowlist(params.chainId, params.targetWallet);
    if (!allowlist.allowed) {
        logger.warn(LogCode.WTC_TX_SKIPPED, '[CopyTradeIngress] target signal rejected by allowlist', {
            chainId: params.chainId,
            txHash: params.txHash,
            targetWallet: params.targetWallet,
            source: params.source,
            reasonCode: allowlist.reasonCode,
            envKey: allowlist.envKey,
            configuredCount: allowlist.configuredCount
        });
        emitCopytradeDomainAudit('target_not_allowlisted', {
            extra: {
                chainId: params.chainId,
                txHash: params.txHash,
                targetWallet: params.targetWallet,
                source: params.source,
                reasonCode: allowlist.reasonCode,
                envKey: allowlist.envKey,
                configuredCount: allowlist.configuredCount
            }
        });
        return false;
    }

    const enqueuedAt = Date.now();
    const timing = markCopyTradeTaskEnqueued(
        mergeCopyTradeTimingSnapshots(params.timing, { chainId: params.chainId }),
        enqueuedAt
    );
    const marked = await tryMarkCopyTradeIngressEnqueued(
        params.chainId,
        params.txHash,
        enqueuedAt,
        params.source
    );
    emitCopyTradeTimingAudit('fast_dispatch_decision', timing, {
        chainId: params.chainId,
        txHash: params.txHash,
        targetWallet: params.targetWallet,
        sourceTxFrom: params.sourceTxFrom || null,
        source: params.source,
        dispatcherAccepted: marked.accepted,
        ingressAlreadyEnqueuedAt: marked.state?.executionEnqueuedAt || null
    });
    if (!marked.accepted) {
        logger.info(LogCode.SYS_INFO, '[CopyTradeIngress] Fast dispatcher suppressed duplicate enqueue', {
            chainId: params.chainId,
            txHash: params.txHash,
            targetWallet: params.targetWallet,
            sourceTxFrom: params.sourceTxFrom || null,
            source: params.source,
            executionEnqueuedAt: marked.state?.executionEnqueuedAt || null
        });
        return false;
    }

    enqueueCopyTradeTask(params.targetWallet, params.swap, params.chainId, {
        detectedAt: timing.dispatchEligibleAt || timing.swapReadyAt || params.detectedAt,
        timing,
        sourceTxFrom: params.sourceTxFrom,
        source: params.source
    });
    return true;
}
