import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import type { DecodedSwap } from './txDecoder.js';

type QueueTask = {
    targetWallet: string;
    swap: DecodedSwap;
    chainId: number;
};

const queue: QueueTask[] = [];
let inFlight = 0;

const MAX_CONCURRENCY = Number(process.env.COPYTRADE_QUEUE_CONCURRENCY || 20);

function processQueue(): void {
    while (inFlight < MAX_CONCURRENCY && queue.length > 0) {
        const task = queue.shift();
        if (!task) return;

        inFlight += 1;
        Promise.resolve()
            .then(async () => {
                const { handleSwapDetected } = await import('./autoTradeService.js');
                await handleSwapDetected(task.targetWallet, task.swap, task.chainId);
            })
            .catch((err: any) => {
                logger.error(LogCode.SYS_ERROR, 'Copytrade task failed', {
                    error: err?.message || String(err),
                    wallet: task.targetWallet,
                    chainId: task.chainId,
                    txHash: task.swap?.txHash,
                });
            })
            .finally(() => {
                inFlight -= 1;
                if (queue.length > 0) {
                    setImmediate(processQueue);
                }
            });
    }
}

export function enqueueCopyTradeTask(targetWallet: string, swap: DecodedSwap, chainId: number): void {
    queue.push({ targetWallet, swap, chainId });
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
