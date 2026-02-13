import { LogCode } from '../../config/logRegistry.js';
import { logger } from '../../utils/logger.js';

type TaskLike = { id: string };

type ClaimRepo<T extends TaskLike> = {
    claimQueuedTasks: (limit: number) => Promise<T[]>;
};

export async function processClaimedTasks<T extends TaskLike>(params: {
    repo: ClaimRepo<T>;
    runningTasks: Set<string>;
    maxConcurrentTasks: number;
    claimLimit: number;
    runTask: (task: T) => Promise<void>;
}): Promise<void> {
    const { repo, runningTasks, maxConcurrentTasks, claimLimit, runTask } = params;
    const queuedTasks = await repo.claimQueuedTasks(claimLimit);

    for (const task of queuedTasks) {
        if (runningTasks.has(task.id)) continue;
        if (runningTasks.size >= maxConcurrentTasks) {
            logger.debug(LogCode.SYS_INFO, 'ChatWorker: concurrency limit reached', {
                maxConcurrentTasks,
                running: runningTasks.size,
            });
            break;
        }

        runningTasks.add(task.id);
        runTask(task)
            .catch((err: any) => {
                console.error(`[ChatWorker] Fatal error in task ${task.id}:`, err);
            })
            .finally(() => {
                runningTasks.delete(task.id);
            });
    }
}

