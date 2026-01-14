/**
 * Position Monitor Job
 * Periodically checks open positions for take profit / stop loss triggers
 */

import { checkPositionsForExits } from '../services/autoTradeService.js';

// Check interval (ms)
const CHECK_INTERVAL = 30000; // 30 seconds

let isRunning = false;
let checkTimer: NodeJS.Timeout | null = null;

/**
 * Run position check
 */
async function runCheck(): Promise<void> {
    if (!isRunning) return;

    try {
        console.log('[PositionMonitor] 🔄 Running position check...');
        await checkPositionsForExits();
    } catch (error) {
        console.error('[PositionMonitor] Error checking positions:', error);
    }

    // Schedule next check
    if (isRunning) {
        checkTimer = setTimeout(runCheck, CHECK_INTERVAL);
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

    console.log('[PositionMonitor] Starting position monitor (every 30s)...');
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
