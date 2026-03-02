import type { DecodedSwap } from '../../txDecoder.js';
import { enqueueCopyTradeTask } from '../../copyTradeQueue.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import { markCopyTradeTaskEnqueued, type CopyTradeTimingSnapshot } from '../timing/copyTradeTimingModel.js';
import { emitCopyTradeTimingAudit } from '../timing/copyTradeTimingAudit.js';
import { tryMarkCopyTradeIngressEnqueued } from './copyTradeIngressState.js';

type DispatchParams = {
    chainId: number;
    txHash: string;
    targetWallet: string;
    swap: DecodedSwap;
    detectedAt?: number;
    timing?: CopyTradeTimingSnapshot;
    source: string;
};

export async function dispatchCopyTradeIfReady(params: DispatchParams): Promise<boolean> {
    const enqueuedAt = Date.now();
    const timing = markCopyTradeTaskEnqueued(params.timing, enqueuedAt);
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
        source: params.source,
        dispatcherAccepted: marked.accepted,
        ingressAlreadyEnqueuedAt: marked.state?.executionEnqueuedAt || null
    });
    if (!marked.accepted) {
        logger.info(LogCode.SYS_INFO, '[CopyTradeIngress] Fast dispatcher suppressed duplicate enqueue', {
            chainId: params.chainId,
            txHash: params.txHash,
            targetWallet: params.targetWallet,
            source: params.source,
            executionEnqueuedAt: marked.state?.executionEnqueuedAt || null
        });
        return false;
    }

    enqueueCopyTradeTask(params.targetWallet, params.swap, params.chainId, {
        detectedAt: timing.dispatchEligibleAt || timing.swapReadyAt || params.detectedAt,
        timing
    });
    return true;
}
