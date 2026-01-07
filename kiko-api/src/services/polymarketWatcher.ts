/**
 * Polymarket Watcher Service
 * Monitors target wallets for position changes and triggers copy trades
 */

import { getWalletPositions, PolymarketUserPosition, diffPositions } from './polymarketDataService.js';
import { handlePositionChange } from './polymarketExecutor.js';
import prisma from '../db/prisma.js';

// In-memory cache of target wallet positions
const positionCache = new Map<string, PolymarketUserPosition[]>();

// Callback handlers
type PositionChangeHandler = (event: PositionChangeEvent) => Promise<void>;
const handlers: PositionChangeHandler[] = [];

export interface PositionChangeEvent {
    type: 'OPENED' | 'CLOSED' | 'INCREASED' | 'DECREASED';
    targetWallet: string;
    position: PolymarketUserPosition;
    configIds: string[]; // Configs watching this wallet
}

/**
 * Register a handler for position changes
 */
export function onPositionChange(handler: PositionChangeHandler): void {
    handlers.push(handler);
}

/**
 * Emit position change event to all handlers
 */
async function emit(event: PositionChangeEvent): Promise<void> {
    for (const handler of handlers) {
        try {
            await handler(event);
        } catch (e) {
            console.error('[PolymarketWatcher] Handler error:', e);
        }
    }
}

/**
 * Get all active target wallets from configs
 */
async function getActiveTargetWallets(): Promise<Map<string, string[]>> {
    const configs = await prisma.polymarketCopyConfig.findMany({
        where: { status: 'active' },
        select: { targetWallet: true, id: true }
    });

    // Group configs by target wallet
    const walletToConfigs = new Map<string, string[]>();
    for (const config of configs) {
        const wallet = config.targetWallet.toLowerCase();
        const existing = walletToConfigs.get(wallet) || [];
        existing.push(config.id);
        walletToConfigs.set(wallet, existing);
    }

    return walletToConfigs;
}

/**
 * Poll a single wallet for position changes
 */
async function pollWallet(wallet: string, configIds: string[]): Promise<void> {
    const newPositions = await getWalletPositions(wallet);
    const oldPositions = positionCache.get(wallet) || [];

    // First poll - just cache, don't emit events
    if (oldPositions.length === 0 && newPositions.length > 0) {
        console.log(`[PolymarketWatcher] Initial snapshot for ${wallet.slice(0, 8)}...: ${newPositions.length} positions`);
        positionCache.set(wallet, newPositions);
        return;
    }

    // Compare positions
    const diff = diffPositions(oldPositions, newPositions);

    // Emit events for changes
    for (const pos of diff.opened) {
        console.log(`[PolymarketWatcher] 🟢 NEW POSITION: ${pos.title} (${pos.outcome}) by ${wallet.slice(0, 8)}...`);
        await emit({ type: 'OPENED', targetWallet: wallet, position: pos, configIds });
    }

    for (const pos of diff.closed) {
        console.log(`[PolymarketWatcher] 🔴 CLOSED POSITION: ${pos.title} (${pos.outcome}) by ${wallet.slice(0, 8)}...`);
        await emit({ type: 'CLOSED', targetWallet: wallet, position: pos, configIds });
    }

    for (const pos of diff.increased) {
        console.log(`[PolymarketWatcher] 🟡 INCREASED POSITION: ${pos.title} (${pos.outcome}) by ${wallet.slice(0, 8)}...`);
        await emit({ type: 'INCREASED', targetWallet: wallet, position: pos, configIds });
    }

    for (const pos of diff.decreased) {
        console.log(`[PolymarketWatcher] 🟠 DECREASED POSITION: ${pos.title} (${pos.outcome}) by ${wallet.slice(0, 8)}...`);
        await emit({ type: 'DECREASED', targetWallet: wallet, position: pos, configIds });
    }

    // Update cache
    positionCache.set(wallet, newPositions);
}

/**
 * Main polling loop
 */
let isRunning = false;
let pollIntervalMs = 5000; // 5 seconds to avoid rate limits

export async function startPolling(): Promise<void> {
    if (isRunning) return;
    isRunning = true;

    console.log('[PolymarketWatcher] Starting position watcher...');

    const poll = async () => {
        if (!isRunning) return;

        try {
            const walletToConfigs = await getActiveTargetWallets();

            if (walletToConfigs.size === 0) {
                // No active configs, wait and retry
            } else {
                // Poll each wallet sequentially to avoid rate limits
                for (const [wallet, configIds] of walletToConfigs) {
                    await pollWallet(wallet, configIds);
                    // Small delay between wallets
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
        } catch (e) {
            console.error('[PolymarketWatcher] Poll error:', e);
        }

        // Schedule next poll
        setTimeout(poll, pollIntervalMs);
    };

    poll();
}

export function stopPolling(): void {
    isRunning = false;
    console.log('[PolymarketWatcher] Stopped position watcher.');
}

/**
 * Clear position cache (useful for testing)
 */
export function clearCache(): void {
    positionCache.clear();
}

// Auto-register the executor handler
onPositionChange(async (event) => {
    await handlePositionChange(event.type, event.targetWallet, event.position, event.configIds);
});
