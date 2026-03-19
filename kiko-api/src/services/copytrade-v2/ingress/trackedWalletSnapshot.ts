import prisma from '../../../db/prisma.js';
import { isSolanaAddress, normalizeAddress } from '../../../utils/address.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';

const EVM_CHAIN_IDS = [1, 8453, 56, 137, 42161, 10];
const SOLANA_CHAIN_ID = 900;
const SUPPORTED_CHAIN_IDS = [...EVM_CHAIN_IDS, SOLANA_CHAIN_ID];
const SNAPSHOT_LOG_WINDOW_MS = Number(process.env.COPYTRADE_PENDING_REFRESH_LOG_WINDOW_MS || 180_000);

const trackedByChain = new Map<number, Set<string>>();
let lastRefreshAt = 0;
let refreshPromise: Promise<void> | null = null;
let lastSnapshotSignature = '';

function resolveCandidateAddress(raw: unknown): string {
    if (typeof raw === 'string') return normalizeAddress(raw);
    if (!raw || typeof raw !== 'object') return normalizeAddress(String(raw || ''));

    const obj = raw as Record<string, unknown>;
    const pubkey = obj.pubkey as any;
    if (typeof pubkey === 'string') return normalizeAddress(pubkey);
    if (pubkey?.toBase58) return normalizeAddress(pubkey.toBase58());
    if (pubkey?.toString) return normalizeAddress(pubkey.toString());

    const toBase58 = (obj as any).toBase58;
    if (typeof toBase58 === 'function') return normalizeAddress(toBase58.call(raw));
    const toString = (obj as any).toString;
    if (typeof toString === 'function') return normalizeAddress(toString.call(raw));
    return normalizeAddress(String(raw));
}

function isAddressSupportedForChain(chainId: number, address: string): boolean {
    if (chainId === SOLANA_CHAIN_ID) return isSolanaAddress(address);
    if (EVM_CHAIN_IDS.includes(chainId)) return address.startsWith('0x');
    return false;
}

export async function refreshTrackedWalletSnapshot(): Promise<void> {
    if (refreshPromise) return refreshPromise;
    refreshPromise = (async () => {
        const rows = await prisma.trackedWallet.findMany({
            where: {
                activeConfigs: { gt: 0 },
                chainId: { in: SUPPORTED_CHAIN_IDS }
            },
            select: {
                address: true,
                chainId: true
            }
        });

        const next = new Map<number, Set<string>>();
        for (const row of rows) {
            const addr = normalizeAddress(row.address);
            if (!isAddressSupportedForChain(row.chainId, addr)) continue;
            if (!next.has(row.chainId)) next.set(row.chainId, new Set());
            next.get(row.chainId)!.add(addr);
        }
        trackedByChain.clear();
        for (const [chainId, set] of next) trackedByChain.set(chainId, set);
        lastRefreshAt = Date.now();
        const signature = JSON.stringify(
            [...trackedByChain.entries()]
                .sort((a, b) => a[0] - b[0])
                .map(([chainId, set]) => [chainId, [...set].sort()]),
        );
        if (signature !== lastSnapshotSignature) {
            lastSnapshotSignature = signature;
            logger.throttled(LogCode.SYS_INFO, '[CopyTradeTrackedWallets] Snapshot refreshed', {
                chains: Array.from(trackedByChain.keys()),
                totalWallets: rows.length
            }, SNAPSHOT_LOG_WINDOW_MS);
        } else {
            logger.debug(LogCode.SYS_INFO, '[CopyTradeTrackedWallets] Snapshot unchanged', {
                chains: Array.from(trackedByChain.keys()),
                totalWallets: rows.length,
            });
        }
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
        const normalized = resolveCandidateAddress(candidate);
        if (!isAddressSupportedForChain(chainId, normalized)) continue;
        if (tracked.has(normalized)) matched.push(normalized);
    }
    return Array.from(new Set(matched));
}

export function __setTrackedWalletSnapshotForTests(input: Record<number, string[]>): void {
    trackedByChain.clear();
    for (const [chain, addresses] of Object.entries(input)) {
        const chainId = Number(chain);
        if (!Number.isFinite(chainId)) continue;
        const normalized = addresses
            .map((address) => normalizeAddress(address))
            .filter((address) => isAddressSupportedForChain(chainId, address));
        trackedByChain.set(chainId, new Set(normalized));
    }
    lastRefreshAt = Date.now();
    lastSnapshotSignature = JSON.stringify(
        [...trackedByChain.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([chainId, set]) => [chainId, [...set].sort()]),
    );
}

export function __resetTrackedWalletSnapshotForTests(): void {
    trackedByChain.clear();
    lastRefreshAt = 0;
    lastSnapshotSignature = '';
}
