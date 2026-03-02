import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import type { DecodedSwap } from './txDecoder.js';
import { acquireLock, releaseLock, get as cacheGet, set as cacheSet } from '../cache/cacheClient.js';
import { randomUUID } from 'node:crypto';
import { getPendingTxHint, markCopyTradeTxState } from './copyTradeTxStateService.js';
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
};

const queue: QueueTask[] = [];
let inFlight = 0;

const MAX_CONCURRENCY = Number(process.env.COPYTRADE_QUEUE_CONCURRENCY || 20);
const COPYTRADE_TASK_LOCK_TTL_SECONDS = Number(process.env.COPYTRADE_TASK_LOCK_TTL_SECONDS || 120);
const COPYTRADE_TASK_DEDUP_TTL_SECONDS = Number(process.env.COPYTRADE_TASK_DEDUP_TTL_SECONDS || 300);

function getTaskKey(task: QueueTask): string {
    const txHash = (task.swap?.txHash || 'nohash').toLowerCase();
    return `copytrade:task:${task.chainId}:${task.targetWallet.toLowerCase()}:${txHash}`;
}

function processQueue(): void {
    while (inFlight < MAX_CONCURRENCY && queue.length > 0) {
        const task = queue.shift();
        if (!task) return;

        inFlight += 1;
        Promise.resolve()
            .then(async () => {
                const taskKey = getTaskKey(task);
                const doneKey = `${taskKey}:done`;
                const lockKey = `${taskKey}:lock`;
                const lockValue = randomUUID();

                // ⚡ Parallel: dedup check + lock acquisition + pending hint in one round-trip
                const [alreadyDone, claimed, pendingHint] = await Promise.all([
                    cacheGet(doneKey).catch(() => null),
                    acquireLock(lockKey, COPYTRADE_TASK_LOCK_TTL_SECONDS, lockValue).catch(() => false),
                    task.swap?.txHash
                        ? getPendingTxHint(task.chainId, task.swap.txHash).catch(() => null)
                        : Promise.resolve(null)
                ]);
                if (alreadyDone) {
                    if (claimed) await releaseLock(lockKey, lockValue).catch(() => { });
                    return;
                }
                if (!claimed) return;

                const { handleSwapDetected } = await import('./autoTradeService.js');
                try {
                    const timing = markCopyTradeTaskEnqueued(mergeCopyTradeTimingSnapshots(
                        task.timing,
                        pendingHint?.timing
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
                    cacheSet(doneKey, '1', COPYTRADE_TASK_DEDUP_TTL_SECONDS).catch(() => { });
                    markCopyTradeTxState(task.chainId, task.swap.txHash || 'nohash', 'executed', {
                        wallet: task.targetWallet
                    }).catch(() => { });
                } finally {
                    await releaseLock(lockKey, lockValue).catch(() => { });
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
    context?: { detectedAt?: number; timing?: CopyTradeTimingSnapshot }
): void {
    markCopyTradeTxState(chainId, swap?.txHash || 'nohash', 'task_enqueued', {
        wallet: targetWallet
    }).catch(() => { });
    queue.push({
        targetWallet,
        swap,
        chainId,
        detectedAt: context?.detectedAt,
        timing: markCopyTradeTaskEnqueued(context?.timing)
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
