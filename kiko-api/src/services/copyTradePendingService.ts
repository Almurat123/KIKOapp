import { callRpc, callRpcCustom } from './rpcManager.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { markCopyTradeTxState, markPendingPredecodedSwap, markPendingTxHint } from './copyTradeTxStateService.js';
import { normalizeAddress } from '../utils/address.js';
import { fetchTransactionReceipt } from './watcherService.js';
import { parseSwapTransaction } from './txDecoder.js';
import { getVerifiedFreeEndpoints, RpcEndpointConfig } from '../config/apiEndpoints.js';
import { buildSwapExecutionContext } from './copytrade-v2/context/contextBuilder.js';
import { putContext } from './copytrade-v2/context/contextStore.js';
import { recordSuccessSample } from './copytrade-v2/planner/sampleLibrary.js';
import { getChainConfig } from '../config/chainConfig.js';
import { reportReceiptSeen, reportWebhookSeen } from './order-runtime/adjudicator/service.js';
import { normalizeTxIdentity } from '../utils/txIdentity.js';
import {
    buildCopyTradeFirstSeenTiming,
    markCopyTradeSwapReady,
    markCopyTradeTaskEnqueued
} from './copytrade-v2/timing/copyTradeTimingModel.js';
import { emitCopyTradeTimingAudit } from './copytrade-v2/timing/copyTradeTimingAudit.js';
import {
    markCopyTradeIngressFirstSeen,
    markCopyTradeIngressSwapReady
} from './copytrade-v2/ingress/copyTradeIngressState.js';
import { dispatchCopyTradeIfReady } from './copytrade-v2/ingress/copyTradeFastDispatcher.js';
import {
    getTrackedWalletSet,
    refreshTrackedWalletSnapshot
} from './copytrade-v2/ingress/trackedWalletSnapshot.js';
import { prioritizeCopyTradePendingChains } from './copytrade-v2/eth/ethSignalPolicy.js';
import { buildEthAwarePendingPollPlan } from './copytrade-v2/eth/ethPendingIngressPolicy.js';
import { inferEthPendingSwapIntent } from './copytrade-v2/eth/ethPendingSwapIntent.js';
import { buildEthPendingPredecodedSwap } from './copytrade-v2/eth/ethPendingPredecodedSwap.js';
import { normalizeWallet } from './copytrade-v2/runtime/chainIdentityNormalizer.js';

const ENABLED = (process.env.COPYTRADE_PENDING_WATCH_ENABLED || 'true') === 'true';
const REFRESH_WALLETS_MS = Number(process.env.COPYTRADE_PENDING_WALLET_REFRESH_MS || 10000);
const POLL_INTERVAL_MS = Number(process.env.COPYTRADE_PENDING_POLL_MS || 1500);
const LOCAL_DEDUP_TTL_MS = Number(process.env.COPYTRADE_PENDING_DEDUP_TTL_MS || 60_000);
const PREFETCH_ENABLED = (process.env.COPYTRADE_PENDING_PREFETCH_ENABLED || 'true') === 'true';
const PREFETCH_MAX_WAIT_MS = Number(process.env.COPYTRADE_PENDING_PREFETCH_MAX_WAIT_MS || 500);
const PREFETCH_POLL_MS = Number(process.env.COPYTRADE_PENDING_PREFETCH_POLL_MS || 250);
const PREFETCH_MAX_INFLIGHT = Number(process.env.COPYTRADE_PENDING_PREFETCH_MAX_INFLIGHT || 2);
const PENDING_RPC_MODE = String(process.env.COPYTRADE_PENDING_RPC_MODE || 'free').trim().toLowerCase(); // free | auto
const EVM_SIGNAL_BINDING = 'tx_from_only';
let running = false;
let tickInFlight = false;
let refreshTimer: NodeJS.Timeout | null = null;
let pollTimer: NodeJS.Timeout | null = null;
let chainIndex = 0;

const seenPendingLocal = new Map<string, number>();
const prefetchInFlight = new Set<string>();

const CHAIN_SLUG_BY_ID: Record<number, string> = {
    1: 'eth',
    8453: 'base',
    56: 'bsc',
    137: 'polygon',
    42161: 'arbitrum',
    10: 'optimism'
};

function inferExecutionSide(chainId: number, tokenIn: string, tokenOut: string): 'buy' | 'sell' {
    const chain = getChainConfig(chainId);
    const wrappedNative = String(chain?.wrappedNativeAddress || '').toLowerCase();
    const stableTokens = new Set((chain?.stablecoins || []).map((x) => String(x).toLowerCase()));
    const isCashLike = (value?: string): boolean => {
        const v = String(value || '').toLowerCase();
        return v === 'eth'
            || v === 'bnb'
            || v === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
            || v === wrappedNative
            || stableTokens.has(v);
    };
    return isCashLike(tokenIn) && !isCashLike(tokenOut) ? 'buy' : 'sell';
}

function pendingDedupKey(chainId: number, txHash: string): string {
    return `${chainId}:${normalizeTxIdentity(chainId, txHash)}`;
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
    const normalizedTargetWallet = normalizeWallet(chainId, targetWallet);
    const warmKey = `${chainId}:${normalizeTxIdentity(chainId, txHash)}:${normalizedTargetWallet}`;
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
                reportWebhookSeen({
                    chainId,
                    txHash,
                    source: 'pending_prefetch',
                    matchedWallet: targetWallet
                });
                reportReceiptSeen({
                    chainId,
                    txHash,
                    success: true,
                    blockNumber: receipt.blockNumber || undefined,
                    source: 'pending_prefetch'
                });
                const swap = await parseSwapTransaction(
                    txSkeleton,
                    { logs: receipt.logs || [], status },
                    chainId,
                    targetWallet
                );
                if (!swap) return;
                const timing = markCopyTradeTaskEnqueued(
                    markCopyTradeSwapReady(
                        buildCopyTradeFirstSeenTiming(start, 'pending_prefetch'),
                        Date.now(),
                        'pending_prefetch'
                    ),
                    Date.now()
                );
                emitCopyTradeTimingAudit('pending_prefetch_enqueued', timing, {
                    chainId,
                    txHash: txHash.slice(0, 12),
                    wallet: targetWallet.slice(0, 10),
                    dex: swap.dexName || null
                });
                await markCopyTradeIngressSwapReady(chainId, txHash, timing.swapReadyAt || Date.now(), 'pending_prefetch').catch(() => { });

                await markPendingPredecodedSwap(chainId, txHash, targetWallet, swap, start).catch(() => { });
                const ctx = buildSwapExecutionContext({
                    tx: txSkeleton,
                    receipt: { logs: receipt.logs || [] },
                    decodedSwap: swap,
                    chainId,
                    targetWallet,
                    detectedAt: timing.dispatchEligibleAt || timing.swapReadyAt || start
                });
                await putContext(ctx).catch(() => { });
                await recordSuccessSample({
                    chainId,
                    side: inferExecutionSide(chainId, swap.tokenIn, swap.tokenOut),
                    txHash,
                    wallet: targetWallet,
                    tokenIn: String(swap.tokenIn || '').toLowerCase(),
                    tokenOut: String(swap.tokenOut || '').toLowerCase(),
                    amountIn: String(swap.amountIn || '0'),
                    amountOut: String(swap.amountOut || '0'),
                    router: String(swap.router || txSkeleton.to || '').toLowerCase(),
                    selector: String(txSkeleton.input || '').slice(0, 10).toLowerCase(),
                    commandMetaJson: JSON.stringify({
                        source: 'pending_prefetch',
                        dexName: swap.dexName || null
                    })
                }).catch(() => { });
                await dispatchCopyTradeIfReady({
                    chainId,
                    txHash,
                    targetWallet,
                    swap,
                    sourceTxFrom: txSkeleton.from || undefined,
                    detectedAt: timing.dispatchEligibleAt || timing.swapReadyAt || start,
                    timing,
                    source: 'pending_prefetch'
                });
                await markCopyTradeTxState(chainId, txHash, 'swap_decoded', {
                    source: 'pending_prefetch',
                    wallet: targetWallet,
                    dex: swap.dexName,
                    prepareMs: Date.now() - start,
                    dispatchEligibleAt: timing.dispatchEligibleAt || null,
                    firstSeenAt: timing.firstSeenAt || null
                }).catch(() => { });
                logger.info(LogCode.SYS_INFO, '[CopyTradePending] Prefetched confirmed swap from pending path', {
                    chainId,
                    txHash: txHash.slice(0, 12),
                    wallet: targetWallet.slice(0, 10),
                    ms: Date.now() - start,
                    action: 'enqueued_copytrade_early'
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

async function pollOneChainPending(chainId: number): Promise<void> {
    const tracked = getTrackedWalletSet(chainId);
    if (!tracked || tracked.size === 0) return;

    const block = await (async () => {
        if (PENDING_RPC_MODE === 'free') {
            const slug = CHAIN_SLUG_BY_ID[chainId];
            const free = slug ? getVerifiedFreeEndpoints(slug) : [];
            if (free.length > 0) {
                const freeEndpoints: RpcEndpointConfig[] = free.map((ep, i) => ({
                    name: ep.name,
                    url: ep.url,
                    priority: i + 1,
                    requiresAuth: false,
                    type: 'public'
                }));
                return callRpcCustom<any>(freeEndpoints, 'eth_getBlockByNumber', ['pending', true], {
                    importance: 'normal'
                }).catch(() => null);
            }
        }
        return callRpc<any>(chainId, 'eth_getBlockByNumber', ['pending', true], {
            strategy: 'cheap',
            importance: 'normal'
        }).catch(() => null);
    })();

    const txs = Array.isArray(block?.transactions) ? block.transactions : [];
    if (!txs.length) return;

    for (const tx of txs) {
        const txHash = normalizeTxIdentity(chainId, String(tx?.hash || '')) || '';
        if (!txHash) continue;

        const fromAddress = normalizeAddress(String(tx?.from || ''));
        // Security hardening: EVM signal binding is strictly tx.from-only.
        const matchedWallet = tracked.has(fromAddress) ? fromAddress : '';
        if (!matchedWallet) continue;

        const dedupKey = pendingDedupKey(chainId, txHash);
        if (seenPendingLocal.has(dedupKey)) continue;
        const detectedAt = Date.now();
        seenPendingLocal.set(dedupKey, detectedAt);

        await Promise.allSettled([
            markPendingTxHint(chainId, txHash, matchedWallet),
            markCopyTradeIngressFirstSeen(chainId, txHash, detectedAt, 'pending_block'),
            markCopyTradeTxState(chainId, txHash, 'pending_seen', { source: 'pending_block', wallet: matchedWallet })
        ]);
        const pendingIntent = inferEthPendingSwapIntent({
            chainId,
            matchedWallet,
            tx,
        });
        if (pendingIntent) {
            await markCopyTradeTxState(chainId, txHash, 'pending_seen', {
                source: 'pending_block',
                wallet: matchedWallet,
                side: pendingIntent.side,
                selector: pendingIntent.selector,
                router: pendingIntent.router,
                dexName: pendingIntent.dexName,
                nativeValueWei: pendingIntent.nativeValueWei,
                reasonCode: pendingIntent.reasonCode,
            }).catch(() => { });
            logger.info(LogCode.SYS_INFO, '[CopyTradePending] Pending swap intent detected', {
                chainId,
                txHash: txHash.slice(0, 12),
                wallet: matchedWallet.slice(0, 10),
                side: pendingIntent.side,
                selector: pendingIntent.selector,
                dexName: pendingIntent.dexName,
                reasonCode: pendingIntent.reasonCode,
            });
        }

        const predecodedSwap = buildEthPendingPredecodedSwap({
            chainId,
            matchedWallet,
            txHash,
            tx,
        });
        if (predecodedSwap) {
            await markPendingPredecodedSwap(
                chainId,
                txHash,
                matchedWallet,
                predecodedSwap,
                detectedAt,
                'pending_calldata_predecoded'
            ).catch(() => { });
            await markCopyTradeTxState(chainId, txHash, 'pending_seen', {
                source: 'pending_calldata_predecoded',
                wallet: matchedWallet,
                side: inferExecutionSide(chainId, predecodedSwap.tokenIn, predecodedSwap.tokenOut),
                dex: predecodedSwap.dexName,
                selector: predecodedSwap.sourceSelector,
                dispatched: false,
                provisional: true
            }).catch(() => { });
            logger.info(LogCode.SYS_INFO, '[CopyTradePending] Pending calldata predecoded swap detected (awaiting confirmed receipt)', {
                chainId,
                txHash: txHash.slice(0, 12),
                wallet: matchedWallet.slice(0, 10),
                selector: predecodedSwap.sourceSelector,
                dex: predecodedSwap.dexName || null,
                dispatched: false
            });
        }
        void warmConfirmedSwapFromPending(chainId, txHash, matchedWallet, tx);
    }
}

async function tick(): Promise<void> {
    if (!running) return;
    if (tickInFlight) return;
    tickInFlight = true;
    cleanupLocalDedup();
    try {
        const chains = prioritizeCopyTradePendingChains(CHAIN_SLUG_BY_ID
            ? Object.keys(CHAIN_SLUG_BY_ID).map((value) => Number(value)).filter((chainId) => !!getTrackedWalletSet(chainId))
            : []);
        if (chains.length === 0) return;

        const plan = buildEthAwarePendingPollPlan({
            chainIds: chains,
            cursor: chainIndex
        });
        chainIndex = plan.nextCursor;
        for (const chainId of plan.chainIdsToPoll) {
            await pollOneChainPending(chainId);
        }
    } finally {
        tickInFlight = false;
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

    await refreshTrackedWalletSnapshot().catch((err: any) => {
        logger.warn(LogCode.SYS_INFO, '[CopyTradePending] Initial wallet refresh failed', {
            error: err?.message || String(err)
        });
    });

    refreshTimer = setInterval(() => {
        refreshTrackedWalletSnapshot().catch(() => { });
    }, REFRESH_WALLETS_MS);

    pollTimer = setInterval(() => {
        tick().catch(() => { });
    }, POLL_INTERVAL_MS);

    logger.info(LogCode.SYS_STARTUP, '[CopyTradePending] Pending watcher started', {
        pollIntervalMs: POLL_INTERVAL_MS,
        refreshWalletsMs: REFRESH_WALLETS_MS,
        rpcMode: PENDING_RPC_MODE,
        evmSignalBinding: EVM_SIGNAL_BINDING
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
