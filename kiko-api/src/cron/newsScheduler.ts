/**
 * News Scheduler Stub
 * News functionality is currently disabled
 */

export function startNewsScheduler(): void {
    console.log('[NewsScheduler] News scheduler disabled');
}

// Alias for backwards compatibility
export const initNewsScheduler = startNewsScheduler;

export function stopNewsScheduler(): void {
    // No-op
}
