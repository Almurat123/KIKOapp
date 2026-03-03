import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import type { DecodedSwap } from './txDecoder.js';
import { getPendingTxHint, markCopyTradeTxState } from './copyTradeTxStateService.js';
import { resolveCopyTradeQueuePriority } from './copytrade/eth/ethBuyFastPath.js';
import {
    evaluateCopyTradeDelay,
    markCopyTradeTaskEnqueued,
    mergeCopyTradeTimingSnapshots,
    type CopyTradeTimingSnapshot
} from './copytrade/timing/copyTradeTimingModel.js';
import { emitCopyTradeTimingAudit } from './copytrade/timing/copyTradeTimingAudit.js';

type QueueTask = {
    targetWallet: string;
    swap: DecodedSwap;
    chainId: number;
    detectedAt?: number;
    timing?: CopyTradeTimingSnapshot;
    source?: string;
    priority: number;
    sequence: number;
};

const queue: QueueTask[] = [];
let inFlight = 0;
let localSequence = 0;
const localDone = new Map<string, number>();

const MAX_CONCURRENCY = Number(process.env.COPYTRADE_QUEUE_CONCURRENCY || 20);
const COPYTRADE_TASK_DEDUP_TTL_SECONDS = Number(process.env.COPYTRADE_TASK_DEDUP_TTL_SECONDS || 300);

function getTaskKey(task: QueueTask): string {
    const txHash = (task.swap?.txHash || 'nohash').toLowerCase();
    return `copytrade:task:${task.chainId}:${task.targetWallet.toLowerCase()}:${txHash}`;
}

function isLocallyDone(taskKey: string): boolean {
    const expiresAt = localDone.get(taskKey);
    if (!expiresAt) return false;
    if (expiresAt <= Date.now()) {
        localDone.delete(taskKey);
        return false;
    }
    return true;
}

function markLocallyDone(taskKey: string): void {
    localDone.set(taskKey, Date.now() + COPYTRADE_TASK_DEDUP_TTL_SECONDS * 1000);
}

function processQueue(): void {
    while (inFlight < MAX_CONCURRENCY && queue.length > 0) {
        const task = queue.shift();
        if (!task) return;

        const taskKey = getTaskKey(task);
        if (isLocallyDone(taskKey)) {
            continue;
        }
        inFlight += 1;
        Promise.resolve()
            .then(async () => {
                const pendingHint = task.swap?.txHash
                    ? await getPendingTxHint(task.chainId, task.swap.txHash).catch(() => null)
                    : null;
                const { handleSwapDetected } = await import('./autoTradeService.js');
                try {
                    const timing = markCopyTradeTaskEnqueued(mergeCopyTradeTimingSnapshots(
                        task.timing,
                        pendingHint?.timing,
                        { chainId: task.chainId }
                    ));
                    const detectedAt = timing.dispatchEligibleAt || timing.swapReadyAt || task.detectedAt || pendingHint?.detectedAt;
                    const queueDelay = evaluateCopyTradeDelay(timing, true, {
                        maxDelayMs: Number.MAX_SAFE_INTEGER,
                        hardMaxDelayMs: Number.MAX_SAFE_INTEGER
                    });
                    const queueDelayMs = queueDelay.delayMs > 0 ? queueDelay.delayMs : null;
                    emitCopyTradeTimingAudit('queue_dispatch', timing, {
                        chainId: task.chainId,
                        txHash: task.swap?.txHash || null,
                        targetWallet: task.targetWallet,
                        source: task.source || 'unknown',
                        queueDelayMs,
                        delayAnchor: queueDelay.delayAnchor,
                        inFlight,
                        queued: queue.length
                    });
                    if (queueDelayMs !== null && queueDelayMs > 500) {
                        logger.info(LogCode.SYS_INFO, '[CopyTradeTiming] queue dispatch delay', {
                            chainId: task.chainId,
                            txHash: task.swap?.txHash,
                            targetWallet: task.targetWallet,
                            source: task.source || 'unknown',
                            queueDelayMs,
                            delayAnchor: queueDelay.delayAnchor,
                            inFlight,
                            queued: queue.length
                        });
                    }

                    // Fire-and-forget: don't await state marking on the critical path
                    markCopyTradeTxState(task.chainId, task.swap.txHash || 'nohash', 'executing', {
                        wallet: task.targetWallet
                    }).catch(() => { });
                    await handleSwapDetected(task.targetWallet, task.swap, task.chainId, { detectedAt, timing });
                    // Post-execution bookkeeping: fire-and-forget
                    markLocallyDone(taskKey);
                    markCopyTradeTxState(task.chainId, task.swap.txHash || 'nohash', 'executed', {
                        wallet: task.targetWallet
                    }).catch(() => { });
                } catch (err) {
                    throw err;
                }
            })
            .catch((err: any) => {
                logger.error(LogCode.SYS_ERROR, 'Copytrade task failed', {
                    error: err?.message || String(err),
                    wallet: task.targetWallet,
                    chainId: task.chainId,
                    txHash: task.swap?.txHash,
                });
                markCopyTradeTxState(task.chainId, task.swap?.txHash || 'nohash', 'failed', {
                    wallet: task.targetWallet,
                    error: err?.message || String(err)
                }).catch(() => { });
            })
            .finally(() => {
                inFlight -= 1;
                if (queue.length > 0) {
                    setImmediate(processQueue);
                }
            });
    }
}

export function enqueueCopyTradeTask(
    targetWallet: string,
    swap: DecodedSwap,
    chainId: number,
    context?: { detectedAt?: number; timing?: CopyTradeTimingSnapshot; source?: string }
): void {
    markCopyTradeTxState(chainId, swap?.txHash || 'nohash', 'task_enqueued', {
        wallet: targetWallet
    }).catch(() => { });
    queue.push({
        targetWallet,
        swap,
        chainId,
        detectedAt: context?.detectedAt,
        source: context?.source,
        priority: resolveCopyTradeQueuePriority({ chainId, source: context?.source }),
        sequence: ++localSequence,
        timing: markCopyTradeTaskEnqueued(
            mergeCopyTradeTimingSnapshots(context?.timing, { chainId })
        )
    });
    queue.sort((left, right) => {
        if (right.priority !== left.priority) return right.priority - left.priority;
        return left.sequence - right.sequence;
    });
    if (inFlight < MAX_CONCURRENCY) {
        setImmediate(processQueue);
    }
}

export function getCopyTradeQueueStats() {
    return {
        inFlight,
        queued: queue.length,
        maxConcurrency: MAX_CONCURRENCY,
    };
}
