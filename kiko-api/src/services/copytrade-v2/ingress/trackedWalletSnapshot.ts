import prisma from '../../../db/prisma.js';
import { normalizeAddress } from '../../../utils/address.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';

const EVM_CHAIN_IDS = [1, 8453, 56, 137, 42161, 10];
const SNAPSHOT_LOG_WINDOW_MS = Number(process.env.COPYTRADE_PENDING_REFRESH_LOG_WINDOW_MS || 180_000);

const trackedByChain = new Map<number, Set<string>>();
let lastRefreshAt = 0;
let refreshPromise: Promise<void> | null = null;

export async function refreshTrackedWalletSnapshot(): Promise<void> {
    if (refreshPromise) return refreshPromise;
    refreshPromise = (async () => {
        const rows = await prisma.trackedWallet.findMany({
            where: {
                activeConfigs: { gt: 0 },
                chainId: { in: EVM_CHAIN_IDS }
            },
            select: {
                address: true,
                chainId: true
            }
        });

        const next = new Map<number, Set<string>>();
        for (const row of rows) {
            const addr = normalizeAddress(row.address);
            if (!addr.startsWith('0x')) continue;
            if (!next.has(row.chainId)) next.set(row.chainId, new Set());
            next.get(row.chainId)!.add(addr);
        }
        trackedByChain.clear();
        for (const [chainId, set] of next) trackedByChain.set(chainId, set);
        lastRefreshAt = Date.now();
        logger.throttled(LogCode.SYS_INFO, '[CopyTradeTrackedWallets] Snapshot refreshed', {
            chains: Array.from(trackedByChain.keys()),
            totalWallets: rows.length
        }, SNAPSHOT_LOG_WINDOW_MS);
    })().finally(() => {
        refreshPromise = null;
    });
    return refreshPromise;
}

export function getTrackedWalletSet(chainId: number): Set<string> | undefined {
    return trackedByChain.get(chainId);
}

export function getTrackedWalletSnapshotStats() {
    return {
        chains: trackedByChain.size,
        lastRefreshAt
    };
}

export function resolveTrackedWalletsFromSnapshot(chainId: number, candidates: string[]): string[] {
    const tracked = trackedByChain.get(chainId);
    if (!tracked || candidates.length === 0) return [];
    const matched: string[] = [];
    for (const candidate of candidates) {
        const normalized = normalizeAddress(candidate);
        if (!normalized.startsWith('0x')) continue;
        if (tracked.has(normalized)) matched.push(normalized);
    }
    return Array.from(new Set(matched));
}
