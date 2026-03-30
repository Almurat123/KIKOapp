import type { DecodedSwap } from '../../txDecoder.js';
import { enqueueCopyTradeTask } from '../../copyTradeQueue.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import { markCopyTradeTaskEnqueued, mergeCopyTradeTimingSnapshots, type CopyTradeTimingSnapshot } from '../timing/copyTradeTimingModel.js';
import { emitCopyTradeTimingAudit } from '../timing/copyTradeTimingAudit.js';
import { tryMarkCopyTradeIngressEnqueued } from './copyTradeIngressState.js';
import {
    getAdjudicatedSnapshot,
    hydrateSharedAdjudicatedSnapshot,
} from '../../order-runtime/adjudicator/service.js';

type DispatchParams = {
    chainId: number;
    txHash: string;
    targetWallet: string;
    swap: DecodedSwap;
    sourceTxFrom?: string;
    sourceBlockTimestampMs?: number;
    detectedAt?: number;
    timing?: CopyTradeTimingSnapshot;
    source: string;
};

type DispatchDeps = {
    enqueueCopyTradeTask?: typeof enqueueCopyTradeTask;
    tryMarkCopyTradeIngressEnqueued?: typeof tryMarkCopyTradeIngressEnqueued;
    getAdjudicatedSnapshot?: typeof getAdjudicatedSnapshot;
    hydrateSharedAdjudicatedSnapshot?: typeof hydrateSharedAdjudicatedSnapshot;
};

async function resolveSelfOrderSuppression(params: {
    chainId: number;
    txHash: string;
    deps?: DispatchDeps;
}) {
    const isLocalSentTx = (snapshot: any) =>
        Boolean(
            snapshot?.send?.accepted
            && (snapshot?.send?.source === 'privy_sendtx' || snapshot?.send?.source === 'raw_broadcast')
        );

    const readLocalSnapshot = params.deps?.getAdjudicatedSnapshot || getAdjudicatedSnapshot;
    const hydrateSharedSnapshot = params.deps?.hydrateSharedAdjudicatedSnapshot || hydrateSharedAdjudicatedSnapshot;
    const local = readLocalSnapshot({
        chainId: params.chainId,
        txHash: params.txHash,
    });
    if (local?.orderId || isLocalSentTx(local)) {
        return {
            suppressed: true,
            orderId: local?.orderId || null,
            source: local?.orderId ? 'local_adjudicated' : 'local_send_accepted',
        } as const;
    }
    const shared = await hydrateSharedSnapshot({
        chainId: params.chainId,
        txHash: params.txHash,
    }).catch(() => null);
    if (shared?.orderId || isLocalSentTx(shared)) {
        return {
            suppressed: true,
            orderId: shared?.orderId || null,
            source: shared?.orderId ? 'shared_adjudicated' : 'shared_send_accepted',
        } as const;
    }
    return {
        suppressed: false,
        orderId: null,
        source: null,
    } as const;
}

export async function dispatchCopyTradeIfReady(params: DispatchParams, deps?: DispatchDeps): Promise<boolean> {
    const enqueueTask = deps?.enqueueCopyTradeTask || enqueueCopyTradeTask;
    const markIngressEnqueued = deps?.tryMarkCopyTradeIngressEnqueued || tryMarkCopyTradeIngressEnqueued;
    const enqueuedAt = Date.now();
    const timing = markCopyTradeTaskEnqueued(
        mergeCopyTradeTimingSnapshots(params.timing, { chainId: params.chainId }),
        enqueuedAt
    );
    const selfOrder = await resolveSelfOrderSuppression({
        chainId: params.chainId,
        txHash: params.txHash,
        deps,
    });
    if (selfOrder.suppressed) {
        emitCopyTradeTimingAudit('fast_dispatch_decision', timing, {
            chainId: params.chainId,
            txHash: params.txHash,
            targetWallet: params.targetWallet,
            sourceTxFrom: params.sourceTxFrom || null,
            source: params.source,
            dispatcherAccepted: false,
            selfOrderSuppressed: true,
            selfOrderSource: selfOrder.source,
            selfOrderId: selfOrder.orderId,
            ingressAlreadyEnqueuedAt: null,
        });
        logger.info(LogCode.SYS_INFO, '[CopyTradeIngress] Suppressed self-order tx before enqueue', {
            chainId: params.chainId,
            txHash: params.txHash,
            targetWallet: params.targetWallet,
            sourceTxFrom: params.sourceTxFrom || null,
            source: params.source,
            orderId: selfOrder.orderId,
            reasonCode: 'self_order_adjudicated',
            suppressionSource: selfOrder.source,
        });
        return false;
    }
    const marked = await markIngressEnqueued(
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

    await enqueueTask(params.targetWallet, params.swap, params.chainId, {
        detectedAt: timing.dispatchEligibleAt || timing.swapReadyAt || params.detectedAt,
        timing,
        sourceTxFrom: params.sourceTxFrom,
        sourceBlockTimestampMs: params.sourceBlockTimestampMs,
        source: params.source,
        ingressAlreadyMarked: true
    });
    return true;
}
