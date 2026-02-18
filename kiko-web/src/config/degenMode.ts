/**
 * Degen Mode Configuration
 * Ultra-fast trading mode with aggressive settings
 */

export interface DegenModeConfig {
    enabled: boolean;
    quoteRefreshInterval: number; // milliseconds
    maxRetries: number;
    aggressiveSlippage: number; // percentage
    autoRetryOnFailure: boolean;
    instantRequoteOnFail: boolean;
}

/**
 * Default Degen Mode settings
 */
export const DEFAULT_DEGEN_CONFIG: DegenModeConfig = {
    enabled: false,
    quoteRefreshInterval: 250, // ultra fast in degen mode
    maxRetries: 3,
    aggressiveSlippage: 3.0, // 3% default
    autoRetryOnFailure: true,
    instantRequoteOnFail: true,
};

/**
 * Normal mode settings for comparison
 */
export const NORMAL_MODE_CONFIG = {
    quoteRefreshInterval: 600, // near real-time quote refresh for swap card UX
    maxRetries: 1,
    defaultSlippage: 0.5, // 0.5%
    autoRetryOnFailure: false,
    instantRequoteOnFail: false,
};

/**
 * Get quote refresh interval based on mode
 */
export function getQuoteRefreshInterval(degenMode: boolean): number {
    return degenMode
        ? DEFAULT_DEGEN_CONFIG.quoteRefreshInterval
        : NORMAL_MODE_CONFIG.quoteRefreshInterval;
}

/**
 * Get slippage for Degen mode
 */
export function getDegenSlippage(customSlippage?: number): number {
    return customSlippage || DEFAULT_DEGEN_CONFIG.aggressiveSlippage;
}

/**
 * Check if should auto-retry
 */
export function shouldAutoRetry(
    degenMode: boolean,
    retryCount: number,
    maxRetries: number = DEFAULT_DEGEN_CONFIG.maxRetries
): boolean {
    if (!degenMode) return false;
    return retryCount < maxRetries;
}

/**
 * Get retry delay (exponential backoff)
 */
export function getRetryDelay(retryCount: number, degenMode: boolean): number {
    if (!degenMode) return 0;

    // Exponential backoff: 100ms, 200ms, 400ms
    return Math.min(100 * Math.pow(2, retryCount), 1000);
}

/**
 * Degen mode performance metrics
 */
export interface DegenMetrics {
    totalTrades: number;
    successfulTrades: number;
    failedTrades: number;
    retriedTrades: number;
    averageQuoteTime: number; // ms
    averageExecutionTime: number; // ms
}

/**
 * Initialize metrics
 */
export function initDegenMetrics(): DegenMetrics {
    return {
        totalTrades: 0,
        successfulTrades: 0,
        failedTrades: 0,
        retriedTrades: 0,
        averageQuoteTime: 0,
        averageExecutionTime: 0,
    };
}

/**
 * Update metrics after trade
 */
export function updateDegenMetrics(
    metrics: DegenMetrics,
    success: boolean,
    retried: boolean,
    quoteTime: number,
    executionTime: number
): DegenMetrics {
    const newMetrics = { ...metrics };

    newMetrics.totalTrades++;
    if (success) {
        newMetrics.successfulTrades++;
    } else {
        newMetrics.failedTrades++;
    }

    if (retried) {
        newMetrics.retriedTrades++;
    }

    // Update averages
    const totalCount = newMetrics.totalTrades;
    newMetrics.averageQuoteTime =
        (metrics.averageQuoteTime * (totalCount - 1) + quoteTime) / totalCount;
    newMetrics.averageExecutionTime =
        (metrics.averageExecutionTime * (totalCount - 1) + executionTime) / totalCount;

    return newMetrics;
}
