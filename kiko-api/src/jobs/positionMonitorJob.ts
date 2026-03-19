/**
 * Position Monitor Job
 * Periodically checks open positions for take profit / stop loss triggers
 */

import { checkPositionsForExits } from '../services/copytrade-v2/runtime/positionMonitor.js';
import prisma from '../db/prisma.js';
import { hasRecentEndUserActivity } from '../services/runtimeActivityService.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

// Check interval (ms)
const CHECK_INTERVAL = 60000; // 60 seconds
const IDLE_CHECK_INTERVAL = 10 * 60 * 1000; // 10 minutes

let isRunning = false;
let checkTimer: NodeJS.Timeout | null = null;

function scheduleNextRun(delayMs: number): void {
    if (!isRunning) return;
    checkTimer = setTimeout(runCheck, delayMs);
}

/**
 * Run position check
 */
async function runCheck(): Promise<void> {
    if (!isRunning) return;

    try {
        const openPositions = await prisma.position.count({
            where: { status: 'open' },
        });
        const recentActivity = hasRecentEndUserActivity();
        if (openPositions === 0 && !recentActivity) {
            logger.info(LogCode.SYS_INFO, 'Position monitor idle; deferring high-frequency polling', {
                nextRunMs: IDLE_CHECK_INTERVAL,
            });
            scheduleNextRun(IDLE_CHECK_INTERVAL);
            return;
        }
        logger.aggregate(LogCode.JOB_HEARTBEAT, 'Running position check');
        await checkPositionsForExits();
    } catch (error) {
        logger.error(LogCode.SYS_ERROR, 'Error checking positions', { error: error instanceof Error ? error.message : error });
    }

    // Schedule next check
    if (isRunning) {
        scheduleNextRun(CHECK_INTERVAL);
    }
}

/**
 * Start the position monitor job
 */
export function startPositionMonitor(): void {
    if (isRunning) {
        console.log('[PositionMonitor] Already running');
        return;
    }

    console.log('[PositionMonitor] Starting position monitor (every 60s)...');
    isRunning = true;

    // Start checking after initial delay
    checkTimer = setTimeout(runCheck, 5000);
}

/**
 * Stop the position monitor job
 */
export function stopPositionMonitor(): void {
    if (!isRunning) return;

    console.log('[PositionMonitor] Stopping position monitor...');
    isRunning = false;

    if (checkTimer) {
        clearTimeout(checkTimer);
        checkTimer = null;
    }
}

/**
 * Check if monitor is running
 */
export function isPositionMonitorRunning(): boolean {
    return isRunning;
}
