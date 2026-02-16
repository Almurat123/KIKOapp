import { logger } from '../utils/logger.js';
import { LogCode, LogRole } from '../config/logRegistry.js';
import { get as cacheGet, set as cacheSet, del as cacheDel } from '../cache/cacheClient.js';

export type SwapState =
    | 'IDLE'              // No swap in progress
    | 'QUOTE_PENDING'     // Getting quote
    | 'QUOTE_READY'       // Quote obtained
    | 'APPROVAL_PENDING'  // Approval transaction sent
    | 'APPROVAL_CONFIRMED'// Approval confirmed
    | 'SWAP_PENDING'      // Swap transaction sent
    | 'SWAP_CONFIRMED'    // Swap confirmed
    | 'COMPLETED'         // All done
    | 'FAILED';           // Terminal failure

export interface SwapStateData {
    state: SwapState;
    userId: string;
    sessionId: string;
    taskId: string;

    // Transaction context
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    chainId: number;

    // Cached data
    quote?: any;
    approvalTxHash?: string;
    swapTxHash?: string;

    // Timestamps
    startedAt: number;
    updatedAt: number;

    // Error tracking
    retryCount: number;
    lastError?: string;
}

class SwapStateManagerClass {
    private states: Map<string, SwapStateData> = new Map();
    private readonly ttlSeconds = 10 * 60;
    private redisKey(taskId: string): string {
        return `swap:state:${taskId}`;
    }

    /**
     * Initialize a new swap transaction
     */
    initSwap(params: {
        userId: string;
        sessionId: string;
        taskId: string;
        tokenIn: string;
        tokenOut: string;
        amountIn: string;
        chainId: number;
    }): SwapStateData {
        const key = this.getKey(params.taskId);

        const state: SwapStateData = {
            state: 'IDLE',
            ...params,
            startedAt: Date.now(),
            updatedAt: Date.now(),
            retryCount: 0
        };

        this.states.set(key, state);
        cacheSet(this.redisKey(key), JSON.stringify(state), this.ttlSeconds).catch(() => { });
        logger.debug(LogCode.AI_INTENT_PARSED, `[SwapStateManager] Initialized swap`, {
            taskId: key,
            state: state.state,
            role: LogRole.METRIC
        });
        return state;
    }

    /**
     * Update swap state
     */
    updateState(taskId: string, newState: SwapState, data?: Partial<SwapStateData>): SwapStateData | null {
        const key = this.getKey(taskId);
        const current = this.states.get(key);

        if (!current) {
            logger.warn(LogCode.AI_INTENT_FAILED, `[SwapStateManager] No state found for ${taskId}`, { role: LogRole.EVENT });
            return null;
        }

        const updated: SwapStateData = {
            ...current,
            ...data,
            state: newState,
            updatedAt: Date.now()
        };

        this.states.set(key, updated);
        cacheSet(this.redisKey(key), JSON.stringify(updated), this.ttlSeconds).catch(() => { });
        logger.info(LogCode.AI_INTENT_PARSED, `[SwapStateManager] State transition`, {
            taskId,
            from: current.state,
            to: newState,
            duration: Date.now() - current.startedAt,
            role: LogRole.METRIC
        });

        return updated;
    }

    /**
     * Get current state
     */
    getState(taskId: string): SwapStateData | null {
        const key = this.getKey(taskId);
        const local = this.states.get(key) || null;
        if (local) return local;

        // best-effort async hydration for next call
        cacheGet(this.redisKey(key))
            .then((raw) => {
                if (!raw) return;
                try {
                    const parsed = JSON.parse(raw) as SwapStateData;
                    this.states.set(key, parsed);
                } catch {
                    // ignore parse errors
                }
            })
            .catch(() => { });
        return null;
    }

    /**
     * Check if can retry
     */
    canRetry(taskId: string, maxRetries: number = 3): boolean {
        const state = this.getState(taskId);
        if (!state) return false;

        return state.retryCount < maxRetries && state.state !== 'COMPLETED';
    }

    /**
     * Increment retry counter
     */
    incrementRetry(taskId: string): void {
        const key = this.getKey(taskId);
        const current = this.states.get(key);

        if (current) {
            current.retryCount++;
            current.updatedAt = Date.now();
            this.states.set(key, current);
        }
    }

    /**
     * Mark as failed
     */
    markFailed(taskId: string, error: string): SwapStateData | null {
        return this.updateState(taskId, 'FAILED', { lastError: error });
    }

    /**
     * Mark as completed
     */
    markCompleted(taskId: string, txHash: string): SwapStateData | null {
        return this.updateState(taskId, 'COMPLETED', { swapTxHash: txHash });
    }

    /**
     * Clean up old states (> 10 minutes)
     */
    cleanup(): void {
        const now = Date.now();
        const maxAge = 10 * 60 * 1000; // 10 minutes

        for (const [key, state] of this.states.entries()) {
            if (now - state.updatedAt > maxAge) {
                this.states.delete(key);
                cacheDel(this.redisKey(key)).catch(() => { });
                logger.debug(LogCode.SYS_INFO, `[SwapStateManager] Cleaned up old state`, {
                    taskId: key,
                    role: LogRole.EVENT
                });
            }
        }
    }

    private getKey(taskId: string): string {
        return `swap:${taskId}`;
    }
}

export const SwapStateManager = new SwapStateManagerClass();

// Cleanup every 5 minutes
setInterval(() => {
    SwapStateManager.cleanup();
}, 5 * 60 * 1000);
