import prisma from '../db/prisma.js';
import { callRpc } from './rpcManager.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { markCopyTradeTxState, markPendingPredecodedSwap, markPendingTxHint } from './copyTradeTxStateService.js';
import { normalizeAddress } from '../utils/address.js';
import { fetchTransactionReceipt } from './watcherService.js';
import { parseSwapTransaction } from './txDecoder.js';

const ENABLED = (process.env.COPYTRADE_PENDING_WATCH_ENABLED || 'true') === 'true';
const REFRESH_WALLETS_MS = Number(process.env.COPYTRADE_PENDING_WALLET_REFRESH_MS || 10000);
const POLL_INTERVAL_MS = Number(process.env.COPYTRADE_PENDING_POLL_MS || 450);
const EVM_CHAIN_IDS = [1, 8453, 56, 137, 42161, 10];
const LOCAL_DEDUP_TTL_MS = Number(process.env.COPYTRADE_PENDING_DEDUP_TTL_MS || 60_000);
const PREFETCH_ENABLED = (process.env.COPYTRADE_PENDING_PREFETCH_ENABLED || 'true') === 'true';
const PREFETCH_MAX_WAIT_MS = Number(process.env.COPYTRADE_PENDING_PREFETCH_MAX_WAIT_MS || 1600);
const PREFETCH_POLL_MS = Number(process.env.COPYTRADE_PENDING_PREFETCH_POLL_MS || 120);
const PREFETCH_MAX_INFLIGHT = Number(process.env.COPYTRADE_PENDING_PREFETCH_MAX_INFLIGHT || 16);

let running = false;
let refreshTimer: NodeJS.Timeout | null = null;
let pollTimer: NodeJS.Timeout | null = null;
let chainIndex = 0;

const trackedByChain = new Map<number, Set<string>>();
const seenPendingLocal = new Map<string, number>();
const prefetchInFlight = new Set<string>();

function pendingDedupKey(chainId: number, txHash: string): string {
    return `${chainId}:${txHash.toLowerCase()}`;
}

function cleanupLocalDedup(): void {
    const now = Date.now();
    for (const [key, ts] of seenPendingLocal) {
        if (now - ts > LOCAL_DEDUP_TTL_MS) seenPendingLocal.delete(key);
    }
}

function buildTxSkeletonFromPending(tx: any, txHash: string): {
    hash: string;
    from: string;
    to: string;
    input: string;
    value: string;
} {
    const from = normalizeAddress(String(tx?.from || ''));
    const to = normalizeAddress(String(tx?.to || ''));
    const input = typeof tx?.input === 'string' && tx.input.startsWith('0x') ? tx.input : '0x';
    const value = typeof tx?.value === 'string'
        ? tx.value
        : (typeof tx?.value === 'bigint' ? `0x${tx.value.toString(16)}` : '0x0');
    return { hash: txHash, from, to, input, value };
}

async function warmConfirmedSwapFromPending(
    chainId: number,
    txHash: string,
    targetWallet: string,
    tx: any
): Promise<void> {
    if (!PREFETCH_ENABLED) return;
    const warmKey = `${chainId}:${txHash.toLowerCase()}:${targetWallet.toLowerCase()}`;
    if (prefetchInFlight.has(warmKey)) return;
    if (prefetchInFlight.size >= PREFETCH_MAX_INFLIGHT) return;
    prefetchInFlight.add(warmKey);
    const start = Date.now();
    try {
        const txSkeleton = buildTxSkeletonFromPending(tx, txHash);
        while (Date.now() - start < PREFETCH_MAX_WAIT_MS) {
            const receipt = await fetchTransactionReceipt(txHash, chainId);
            if (receipt) {
                const status = parseInt(String(receipt.status || '0x0'), 16);
                if (status !== 1) return;
                const swap = await parseSwapTransaction(
                    txSkeleton,
                    { logs: receipt.logs || [], status },
                    chainId,
                    targetWallet
                );
                if (!swap) return;

                await markPendingPredecodedSwap(chainId, txHash, targetWallet, swap, start).catch(() => { });
                await markCopyTradeTxState(chainId, txHash, 'swap_decoded', {
                    source: 'pending_prefetch',
                    wallet: targetWallet,
                    dex: swap.dexName,
                    prepareMs: Date.now() - start
                }).catch(() => { });
                logger.info(LogCode.SYS_INFO, '[CopyTradePending] Prefetched confirmed swap from pending path', {
                    chainId,
                    txHash: txHash.slice(0, 12),
                    wallet: targetWallet.slice(0, 10),
                    ms: Date.now() - start
                });
                return;
            }
            await new Promise((resolve) => setTimeout(resolve, PREFETCH_POLL_MS));
        }
    } catch {
        // no-op
    } finally {
        prefetchInFlight.delete(warmKey);
    }
}

async function refreshTrackedWallets(): Promise<void> {
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

    logger.info(LogCode.SYS_INFO, '[CopyTradePending] Tracked wallet snapshot refreshed', {
        chains: Array.from(trackedByChain.keys()),
        totalWallets: rows.length
    });
}

async function pollOneChainPending(chainId: number): Promise<void> {
    const tracked = trackedByChain.get(chainId);
    if (!tracked || tracked.size === 0) return;

    const block = await callRpc<any>(chainId, 'eth_getBlockByNumber', ['pending', true], {
        strategy: 'fast',
        importance: 'critical'
    }).catch(() => null);

    const txs = Array.isArray(block?.transactions) ? block.transactions : [];
    if (!txs.length) return;

    for (const tx of txs) {
        const txHash = String(tx?.hash || '').toLowerCase();
        if (!txHash) continue;

        const fromAddr = normalizeAddress(String(tx?.from || ''));
        const toAddr = normalizeAddress(String(tx?.to || ''));
        const matchedWallet = tracked.has(fromAddr) ? fromAddr : tracked.has(toAddr) ? toAddr : '';
        if (!matchedWallet) continue;

        const dedupKey = pendingDedupKey(chainId, txHash);
        if (seenPendingLocal.has(dedupKey)) continue;
        seenPendingLocal.set(dedupKey, Date.now());

        await Promise.allSettled([
            markPendingTxHint(chainId, txHash, matchedWallet),
            markCopyTradeTxState(chainId, txHash, 'pending_seen', { source: 'pending_block', wallet: matchedWallet })
        ]);
        void warmConfirmedSwapFromPending(chainId, txHash, matchedWallet, tx);
    }
}

async function tick(): Promise<void> {
    if (!running) return;
    cleanupLocalDedup();
    const chains = Array.from(trackedByChain.keys());
    if (chains.length > 0) {
        const chainId = chains[chainIndex % chains.length];
        chainIndex += 1;
        await pollOneChainPending(chainId).catch(() => { });
    }
}

export async function startCopyTradePendingWatcher(): Promise<void> {
    if (running || !ENABLED) {
        if (!ENABLED) {
            logger.info(LogCode.SYS_INFO, '[CopyTradePending] Pending watcher disabled');
        }
        return;
    }
    running = true;

    await refreshTrackedWallets().catch((err: any) => {
        logger.warn(LogCode.SYS_INFO, '[CopyTradePending] Initial wallet refresh failed', {
            error: err?.message || String(err)
        });
    });

    refreshTimer = setInterval(() => {
        refreshTrackedWallets().catch(() => { });
    }, REFRESH_WALLETS_MS);

    pollTimer = setInterval(() => {
        tick().catch(() => { });
    }, POLL_INTERVAL_MS);

    logger.info(LogCode.SYS_STARTUP, '[CopyTradePending] Pending watcher started', {
        pollIntervalMs: POLL_INTERVAL_MS,
        refreshWalletsMs: REFRESH_WALLETS_MS
    });
}

export function stopCopyTradePendingWatcher(): void {
    running = false;
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
    logger.info(LogCode.SYS_SHUTDOWN, '[CopyTradePending] Pending watcher stopped');
}
