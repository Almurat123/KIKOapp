import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import type { DecodedSwap } from './txDecoder.js';
import { acquireLock, releaseLock, get as cacheGet, set as cacheSet } from '../cache/redis.js';
import { randomUUID } from 'node:crypto';
import { getPendingTxHint, markCopyTradeTxState } from './copyTradeTxStateService.js';

type QueueTask = {
    targetWallet: string;
    swap: DecodedSwap;
    chainId: number;
    detectedAt?: number;
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
                const alreadyDone = await cacheGet(doneKey).catch(() => null);
                if (alreadyDone) return;

                const lockKey = `${taskKey}:lock`;
                const lockValue = randomUUID();
                const claimed = await acquireLock(lockKey, COPYTRADE_TASK_LOCK_TTL_SECONDS, lockValue).catch(() => false);
                if (!claimed) return;

                const { handleSwapDetected } = await import('./autoTradeService.js');
                try {
                    const pendingHint = task.swap?.txHash
                        ? await getPendingTxHint(task.chainId, task.swap.txHash).catch(() => null)
                        : null;
                    const detectedAt = task.detectedAt || pendingHint?.detectedAt;

                    await markCopyTradeTxState(task.chainId, task.swap.txHash || 'nohash', 'executing', {
                        wallet: task.targetWallet
                    }).catch(() => { });
                    await handleSwapDetected(task.targetWallet, task.swap, task.chainId, { detectedAt });
                    await cacheSet(doneKey, '1', COPYTRADE_TASK_DEDUP_TTL_SECONDS).catch(() => { });
                    await markCopyTradeTxState(task.chainId, task.swap.txHash || 'nohash', 'executed', {
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
    context?: { detectedAt?: number }
): void {
    markCopyTradeTxState(chainId, swap?.txHash || 'nohash', 'task_enqueued', {
        wallet: targetWallet
    }).catch(() => { });
    queue.push({ targetWallet, swap, chainId, detectedAt: context?.detectedAt });
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
