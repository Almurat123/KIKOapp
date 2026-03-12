import { FastifyInstance } from 'fastify';
import prisma from '../db/prisma.js';
import {
    claimTxProcessingLockDistributed,
    fetchTransaction,
    fetchTransactionReceipt,
    isTxProcessedDistributed,
    markTxAsProcessedDistributed,
    releaseTxProcessingLockDistributed
} from '../services/watcherService.js';
import { normalizeAddress } from '../utils/address.js';
import { buildTxIdentityKey, normalizeTxIdentity } from '../utils/txIdentity.js';
import { parseSwapTransaction, decodeSwapFromLogs } from '../services/txDecoder.js';
import { env } from '../config/env.js';
import crypto from 'node:crypto';
import { getPendingPredecodedSwap, getPendingTxHint, markCopyTradeTxState } from '../services/copyTradeTxStateService.js';
import {
    enqueueAlchemyWebhookEvent,
    ensureAlchemyWebhookInboxTable,
    processAlchemyWebhookInboxEventById,
    startAlchemyWebhookInboxWorker
} from '../services/alchemyWebhookInboxService.js';
import { persistSwapExecutionContext } from '../services/copytrade-v2/context/swapContextPersistence.js';
import { getAdjudicatedSnapshot, reportReceiptSeen, reportWebhookSeen } from '../services/order-runtime/adjudicator/service.js';
import { normalizeSolanaWebhookItem } from '../services/solana/webhookNormalizer.js';
import { resolveSolanaTrackedWallets } from '../services/solana/trackedWalletResolver.js';
import { processSolanaWebhookTx } from '../services/solana/solanaWebhookHandler.js';
import {
    buildCopyTradeFirstSeenTiming,
    markCopyTradeSwapReady,
    markCopyTradeTaskEnqueued,
    mergeCopyTradeTimingSnapshots
} from '../services/copytrade-v2/timing/copyTradeTimingModel.js';
import {
    buildWebhookDecodeDispatchTiming,
    buildWebhookDecodeReadyTiming
} from '../services/copytrade-v2/timing/webhookDispatchTiming.js';
import {
    getCopyTradeIngressState,
    markCopyTradeIngressConfirmed,
    markCopyTradeIngressFirstSeen,
    markCopyTradeIngressSwapReady
} from '../services/copytrade-v2/ingress/copyTradeIngressState.js';
import { dispatchCopyTradeIfReady } from '../services/copytrade-v2/ingress/copyTradeFastDispatcher.js';
import {
    refreshTrackedWalletSnapshot,
    resolveTrackedWalletsFromSnapshot
} from '../services/copytrade-v2/ingress/trackedWalletSnapshot.js';
import {
    getPendingPredecodeSource,
    isPendingPredecodeTrusted
} from '../services/copytrade-v2/ingress/pendingPredecodeTrustPolicy.js';
import {
    buildActivityCashHint,
    buildTxSkeletonFromAlchemyActivity,
    decodeSwapFromActivities,
    pickBestActivity,
    shouldForceFullTxRepair,
    type ActivityCashHint
} from './webhook/evmWebhookDecode.js';
import { logWebhookTiming, resolveDetectedAt, resolveReceiptBlockTimestampMs, safeSecretEquals, waitMs, withTimeout } from './webhookHelpers.js';
import { queueWebhookBatch, type WebhookBatchContext } from './webhookBatching.js';
import { emitCopytradeDomainAudit } from '../services/copytrade-v2/audit/copytradeDomainAudit.js';
import {
    ensureCopytradeIngressTraceTable,
    recordCopytradeIngressTrace,
} from '../services/copytrade-v2/ingress/ingressTraceStore.js';

interface ProcessTxBody {
    wallet: string;
    txHash: string;
    network: string;
    sourceTxFrom?: string;
}
const NETWORK_TO_CHAIN_ID: Record<string, number> = {
    'ETH_MAINNET': 1,
    'BASE_MAINNET': 8453,
    'BNB_MAINNET': 56,          // Alchemy's network name for BSC
    'BNB_SMART_CHAIN_MAINNET': 56,
    'BSC_MAINNET': 56,          // Alias
    'SOLANA_MAINNET': 900,      // Solana
    'SOL_MAINNET': 900,         // Alias
    'SOLANA_MAINNET_SOLANA': 900, // Common Solana alias
    'SOLANA_MAINNET_NETWORK': 900,
    'SOLANA': 900,              // Short alias
    'SOL': 900,                 // Short alias
};

const IS_PRODUCTION = env.nodeEnv === 'production' || env.nodeEnv === 'prod';
let lastMissingAlchemySecretWarnAt = 0;
const WEBHOOK_FETCH_PARSE_BUDGET_MS = Math.max(250, Number(process.env.COPYTRADE_WEBHOOK_FETCH_PARSE_BUDGET_MS || 900));
const WEBHOOK_FULL_TX_TIMEOUT_MS = Math.max(120, Number(process.env.COPYTRADE_WEBHOOK_FULL_TX_TIMEOUT_MS || 450));
const WEBHOOK_PARSE_TIMEOUT_MS = Math.max(120, Number(process.env.COPYTRADE_WEBHOOK_PARSE_TIMEOUT_MS || 350));
const WEBHOOK_BATCH_WINDOW_MS = Math.max(300, Math.min(800, Number(process.env.COPYTRADE_WEBHOOK_BATCH_WINDOW_MS || 500)));
const WEBHOOK_LOCAL_TX_INFLIGHT_TTL_MS = Math.max(1000, Number(process.env.COPYTRADE_WEBHOOK_LOCAL_TX_INFLIGHT_TTL_MS || 20_000));
const COPYTRADE_DETECTED_AT_STALE_MS = Math.max(1000, Number(process.env.COPYTRADE_DETECTED_AT_STALE_MS || 4000));
const WEBHOOK_RECEIPT_RECOVERY_DELAYS_MS = String(process.env.COPYTRADE_WEBHOOK_RECEIPT_RECOVERY_DELAYS_MS || '1200,3000,7000')
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isFinite(v) && v > 0);
const localTxInflight = new Map<string, number>();
const receiptRecoveryInflight = new Set<string>();
const EVM_ADDRESS_REGEX = /0x[a-fA-F0-9]{40}/g;

const webhookBatchByTxHash = new Map<string, WebhookBatchContext>();
let resolveEvmSourceTxFromForTest: ((chainId: number, txHash: string) => Promise<string> | string) | null = null;
let scheduleReceiptRecoveryForTest: ((chainId: number, txHash: string, trackedWallets: string[], detectedAt?: number) => void) | null = null;

function normalizeTxHash(chainId: number, txHash: string): string {
    return normalizeTxIdentity(chainId, txHash) || '';
}

function localInflightKey(chainId: number, txHash: string): string {
    return buildTxIdentityKey(chainId, txHash) || `${chainId}:`;
}

function tryClaimLocalInflight(chainId: number, txHash: string): boolean {
    const now = Date.now();
    for (const [key, ts] of localTxInflight) {
        if (now - ts > WEBHOOK_LOCAL_TX_INFLIGHT_TTL_MS) localTxInflight.delete(key);
    }
    const key = localInflightKey(chainId, txHash);
    if (localTxInflight.has(key)) return false;
    localTxInflight.set(key, now);
    return true;
}

function releaseLocalInflight(chainId: number, txHash: string): void {
    localTxInflight.delete(localInflightKey(chainId, txHash));
}

function collectEvmActivityCandidates(activities: any[]): string[] {
    const addresses = new Set<string>();
    const add = (value: any) => {
        const normalized = normalizeAddress(String(value || ''));
        if (normalized) addresses.add(normalized);
    };

    for (const activity of activities) {
        add(activity?.fromAddress);
        add(activity?.toAddress);
        add(activity?.address);
        add(activity?.walletAddress);
        add(activity?.owner);
        add(activity?.sender);
        add(activity?.recipient);
        add(activity?.from);
        add(activity?.to);
        add(activity?.contractAddress);
        add(activity?.rawContract?.address);

        // Fallback: collect any embedded EVM addresses from payload fields.
        const serialized = JSON.stringify(activity || {});
        const matches = serialized.match(EVM_ADDRESS_REGEX) || [];
        for (const match of matches) add(match);
    }

    return Array.from(addresses);
}

async function resolveEvmSourceTxFrom(chainId: number, txHash: string): Promise<string> {
    if (resolveEvmSourceTxFromForTest) {
        const resolved = await resolveEvmSourceTxFromForTest(chainId, txHash);
        return normalizeAddress(String(resolved || ''));
    }
    try {
        const tx = await withTimeout(fetchTransaction(txHash, chainId), WEBHOOK_FULL_TX_TIMEOUT_MS, 'tx_from_resolve');
        const from = normalizeAddress(String(tx?.from || ''));
        if (from) return from;
    } catch {
        // no-op
    }
    return '';
}

export const __webhookTest = {
    setResolveEvmSourceTxFromForTest(fn: ((chainId: number, txHash: string) => Promise<string> | string) | null): void {
        resolveEvmSourceTxFromForTest = fn;
    },
    setScheduleReceiptRecoveryForTest(fn: ((chainId: number, txHash: string, trackedWallets: string[], detectedAt?: number) => void) | null): void {
        scheduleReceiptRecoveryForTest = fn;
    },
    isRecoverableProcessTxFetchTimeout(error: unknown): boolean {
        return isRecoverableProcessTxFetchTimeout(error);
    },
    handleProcessTxFetchTimeout(params: {
        chainId: number;
        txHash: string;
        wallet: string;
        detectedAt?: number;
    }): { success: true; skipped: true; reason: 'receipt_recovery_scheduled' } {
        return handleProcessTxFetchTimeout(params);
    },
    handleEvmDecodedWithoutSwaps(params: {
        chainId: number;
        txHash: string;
        trackedWallets: string[];
        detectedAt?: number;
    }): void {
        handleEvmDecodedWithoutSwaps(params);
    },
    resetForTest(): void {
        resolveEvmSourceTxFromForTest = null;
        scheduleReceiptRecoveryForTest = null;
    }
};

async function attemptReceiptRecovery(
    chainId: number,
    txHash: string,
    trackedWallets: string[],
    detectedAt?: number
): Promise<{ recovered: boolean; swaps: number; reason?: string }> {
    const receipt = await fetchTransactionReceipt(txHash, chainId);
    if (!receipt) return { recovered: false, swaps: 0, reason: 'receipt_missing' };

    const status = Number.parseInt(String(receipt.status || '0x0'), 16);
    if (status !== 1) {
        await markTxAsProcessedDistributed(txHash, chainId).catch(() => { });
        return { recovered: false, swaps: 0, reason: `receipt_status_${status}` };
    }

    const fullTx = await fetchTransaction(txHash, chainId);
    if (!fullTx) return { recovered: false, swaps: 0, reason: 'tx_missing' };
    const sourceBlockTimestampMs = await resolveReceiptBlockTimestampMs(chainId, receipt).catch(() => undefined);

    let swaps = 0;
    for (const trackedTarget of trackedWallets) {
        const swap = await parseSwapTransaction(
            {
                hash: txHash,
                from: fullTx.from,
                to: fullTx.to,
                input: fullTx.input,
                value: fullTx.value
            },
            {
                logs: receipt.logs || [],
                status
            },
            chainId,
            trackedTarget
        ).catch(() => null);

        if (!swap) continue;
        await markCopyTradeIngressSwapReady(chainId, txHash, Date.now(), 'receipt_recovery').catch(() => { });
        swaps += 1;
        console.log(`[Webhook] ✅ Recovery swap detected for tracked wallet ${trackedTarget.slice(0, 10)}:`, {
            tokenIn: swap.tokenIn,
            tokenOut: swap.tokenOut,
            dex: swap.dexName,
            source: 'receipt_recovery'
        });
        await markCopyTradeTxState(chainId, txHash, 'swap_decoded', {
            wallet: trackedTarget,
            dex: swap.dexName,
            source: 'receipt_recovery'
        }).catch(() => { });
        await persistSwapExecutionContext({
            chainId,
            txHash,
            txFrom: fullTx.from,
            txTo: fullTx.to,
            txInput: fullTx.input,
            txValue: fullTx.value,
            receiptLogs: receipt.logs || [],
            swap,
            targetWallet: trackedTarget
        });
        // Recovery path can be delayed by receipt availability; use current time to avoid
        // false "copytrade delay exceeded" skips in turbo mode.
        await dispatchCopyTradeIfReady({
            chainId,
            txHash,
            targetWallet: trackedTarget,
            swap,
            sourceTxFrom: normalizeAddress(String(fullTx.from || '')) || undefined,
            sourceBlockTimestampMs,
            detectedAt: Date.now(),
            timing: markCopyTradeTaskEnqueued(
                markCopyTradeSwapReady(
                    buildCopyTradeFirstSeenTiming(Date.now(), 'receipt_recovery'),
                    Date.now(),
                    'receipt_recovery'
                ),
                Date.now()
            ),
            source: 'receipt_recovery'
        });
    }

    await markTxAsProcessedDistributed(txHash, chainId).catch(() => { });
    return { recovered: swaps > 0, swaps, reason: swaps > 0 ? undefined : 'no_swap' };
}

function scheduleReceiptRecovery(
    chainId: number,
    txHash: string,
    trackedWallets: string[],
    detectedAt?: number
): void {
    if (scheduleReceiptRecoveryForTest) {
        scheduleReceiptRecoveryForTest(chainId, txHash, trackedWallets, detectedAt);
        return;
    }
    if (!trackedWallets.length) return;
    const key = buildTxIdentityKey(chainId, txHash) || `${chainId}:`;
    if (receiptRecoveryInflight.has(key)) return;
    receiptRecoveryInflight.add(key);

    void (async () => {
        try {
            for (const delay of WEBHOOK_RECEIPT_RECOVERY_DELAYS_MS) {
                await waitMs(delay);
                if (await isTxProcessedDistributed(txHash, chainId).catch(() => false)) {
                    return;
                }
                const result = await attemptReceiptRecovery(chainId, txHash, trackedWallets, detectedAt);
                if (result.recovered) {
                    console.log(`[Webhook] Receipt recovery succeeded: tx=${txHash.slice(0, 12)} swaps=${result.swaps} delayMs=${delay}`);
                    return;
                }
            }
            console.warn(`[Webhook] Receipt recovery exhausted: tx=${txHash.slice(0, 12)} delays=${WEBHOOK_RECEIPT_RECOVERY_DELAYS_MS.join(',')}`);
        } catch (err: any) {
            console.warn(`[Webhook] Receipt recovery error: tx=${txHash.slice(0, 12)} err=${err?.message || String(err)}`);
        } finally {
            receiptRecoveryInflight.delete(key);
        }
    })();
}

function handleEvmDecodedWithoutSwaps(params: {
    chainId: number;
    txHash: string;
    trackedWallets: string[];
    detectedAt?: number;
}): void {
    scheduleReceiptRecovery(params.chainId, params.txHash, params.trackedWallets, params.detectedAt);
    console.log(`[Webhook] Tx decoded with no swaps; leaving unprocessed for potential follow-up payload: ${params.txHash}`);
}

function isRecoverableProcessTxFetchTimeout(error: unknown): boolean {
    const message = String((error as any)?.message || error || '');
    return message.startsWith('timeout_receipt_fetch_') || message.startsWith('timeout_tx_fetch_');
}

function handleProcessTxFetchTimeout(params: {
    chainId: number;
    txHash: string;
    wallet: string;
    detectedAt?: number;
}): { success: true; skipped: true; reason: 'receipt_recovery_scheduled' } {
    scheduleReceiptRecovery(params.chainId, params.txHash, [params.wallet], params.detectedAt);
    return { success: true, skipped: true, reason: 'receipt_recovery_scheduled' };
}


function parseAlchemyNetworkFromRawBody(rawBody: string): string | undefined {
    try {
        const payload = JSON.parse(rawBody);
        const evmNetwork = payload?.event?.network;
        const solNetwork = payload?.event?.event?.network || payload?.event?.network;
        return evmNetwork || solNetwork || payload?.network;
    } catch {
        return undefined;
    }
}

function extractAlchemyNetwork(payload: any): string | undefined {
    const evmNetwork = payload?.event?.network;
    const solNetwork = payload?.event?.event?.network || payload?.event?.network;
    return evmNetwork || solNetwork || payload?.network;
}

function selectAlchemySecretsForNetwork(rawNetwork?: string): string[] {
    const network = String(rawNetwork || '').toUpperCase();
    const secrets: string[] = [];

    if (!network) {
        if (env.security.alchemyWebhookSecretEth) secrets.push(env.security.alchemyWebhookSecretEth);
        if (env.security.alchemyWebhookSecretBase) secrets.push(env.security.alchemyWebhookSecretBase);
        if (env.security.alchemyWebhookSecretBsc) secrets.push(env.security.alchemyWebhookSecretBsc);
        if (env.security.alchemyWebhookSecretSol) secrets.push(env.security.alchemyWebhookSecretSol);
    } else if (network.includes('ETH')) {
        if (env.security.alchemyWebhookSecretEth) secrets.push(env.security.alchemyWebhookSecretEth);
    } else if (network.includes('BASE')) {
        if (env.security.alchemyWebhookSecretBase) secrets.push(env.security.alchemyWebhookSecretBase);
    } else if (network.includes('BSC') || network.includes('BNB')) {
        if (env.security.alchemyWebhookSecretBsc) secrets.push(env.security.alchemyWebhookSecretBsc);
    } else if (network.includes('SOL')) {
        if (env.security.alchemyWebhookSecretSol) secrets.push(env.security.alchemyWebhookSecretSol);
    }

    // Legacy/global fallback for compatibility
    if (env.security.alchemyWebhookSecret) secrets.push(env.security.alchemyWebhookSecret);

    return [...new Set(secrets.filter(Boolean))];
}

async function queueAlchemyWebhookBatch(payload: any): Promise<void> {
    await queueWebhookBatch({
        payload,
        batchWindowMs: WEBHOOK_BATCH_WINDOW_MS,
        batchMap: webhookBatchByTxHash,
        processPayload: processAlchemyWebhookPayload,
        shouldFastTrack: async (contexts) => {
            const chainIds = [...new Set(contexts.map((ctx) => ctx.chainId))];
            await Promise.all(chainIds.map((chainId) => refreshTrackedWalletSnapshot().catch(() => null)));
            const ingressSnapshots = await Promise.all(
                contexts.map((ctx) => getCopyTradeIngressState(ctx.chainId, ctx.txHash).catch(() => null))
            );
            const trackedHit = contexts.some((ctx) => {
                const payloadCandidates = collectEvmActivityCandidates(
                    Array.isArray(payload?.event?.activity) ? payload.event.activity : (payload?.event?.activity ? [payload.event.activity] : [])
                );
                return resolveTrackedWalletsFromSnapshot(ctx.chainId, payloadCandidates).length > 0;
            });
            return trackedHit || ingressSnapshots.some((snapshot) => snapshot?.firstSeenAt || snapshot?.swapReadyAt);
        },
        resolveChainId: (network) => NETWORK_TO_CHAIN_ID[String(network || '').toUpperCase()] || NETWORK_TO_CHAIN_ID[String(network || '')],
        normalizeTxHash
    });
}

async function processAlchemyWebhookPayload(payload: any): Promise<void> {
    let current = payload;
    let network = undefined;
    let eventData = undefined;

    for (let i = 0; i < 5; i++) {
        if (current.network) network = current.network;
        if (current.event && typeof current.event === 'object') {
            current = current.event;
            continue;
        }
        eventData = current;
        break;
    }

    const chainId = NETWORK_TO_CHAIN_ID[network] || (network ? NETWORK_TO_CHAIN_ID[network.toUpperCase()] : undefined);
    if (!chainId) {
        console.warn(`[Webhook] Unknown network: ${network}. Payload snippet: ${JSON.stringify(payload).slice(0, 200)}`);
        return;
    }

    let items: any[] = [];
    let isSolanaItems = false;

    if (eventData?.activity) {
        const rawActivities = Array.isArray(eventData.activity) ? eventData.activity : [eventData.activity];
        const groupedByTx = new Map<string, any[]>();
        for (const activity of rawActivities) {
            const hash = String(activity?.hash || '').toLowerCase();
            if (!hash) continue;
            const list = groupedByTx.get(hash) || [];
            list.push(activity);
            groupedByTx.set(hash, list);
        }
        items = Array.from(groupedByTx.entries()).map(([hash, activities]) => ({
            hash,
            activities,
            sample: pickBestActivity(activities),
        }));
        if (items.length > 0 && items.length !== rawActivities.length) {
            console.log(`[Webhook] Grouped EVM activities from ${rawActivities.length} to ${items.length} tx groups`);
        }
        console.log(`[Webhook] Processing as EVM activity groups (${items.length} tx groups)`);
    } else if (eventData?.transaction) {
        items = Array.isArray(eventData.transaction) ? eventData.transaction : [eventData.transaction];
        isSolanaItems = true;
        console.log(`[Webhook] Processing as Solana transaction (${items.length} items)`);
    } else {
        console.log(`[Webhook] No recognizable activity or transaction array in eventData`);
    }

    const payloadTxDedup = new Set<string>();
    const processItem = async (item: any) => {
        const itemStart = Date.now();
        let txHash = '';
        let candidates: string[] = [];
        let signerCandidates: string[] = [];
        let sourceTxFrom = '';
        let receiptMs = 0;
        let fullTxMs = 0;
        let parseSkeletonMs = 0;
        let parseFullMs = 0;
        let deferredBindingOutcome: 'resolved' | 'missing' | null = null;
        let swapsDetected = 0;
        let usedPredecoded = 0;

        if (isSolanaItems) {
            const normalized = normalizeSolanaWebhookItem(item);
            txHash = normalized.txHash;
            candidates = normalized.candidateAddresses;
            signerCandidates = normalized.signerAddresses;

            if (candidates.length === 0) {
                const solTx = Array.isArray(item?.transaction) ? item.transaction[0] : item?.transaction;
                const solMsg = Array.isArray(solTx?.message) ? solTx.message[0] : solTx?.message;
                console.log(`[Webhook] Solana candidate extraction debug: signature=${txHash}, item keys=${Object.keys(item)}, solTx keys=${solTx ? Object.keys(solTx) : 'null'}, solMsg keys=${solMsg ? Object.keys(solMsg) : 'null'}`);
            }
        } else {
            txHash = String(item?.hash || '');
            const evmActivities: any[] = Array.isArray(item?.activities) && item.activities.length
                ? item.activities
                : (item ? [item] : []);
            candidates = collectEvmActivityCandidates(evmActivities);
        }

        txHash = normalizeTxHash(chainId, txHash);
        if (!txHash) return;
        if (payloadTxDedup.has(txHash)) return;
        payloadTxDedup.add(txHash);
        if (!tryClaimLocalInflight(chainId, txHash)) {
            console.log(`[Webhook] Tx already local in-flight: ${txHash}`);
            return;
        }

        if (await isTxProcessedDistributed(txHash, chainId)) {
            console.log(`[Webhook] Tx already in processedTxs cache: ${txHash}`);
            releaseLocalInflight(chainId, txHash);
            return;
        }
        const txLockValue = await claimTxProcessingLockDistributed(txHash, chainId);
        if (!txLockValue) {
            console.log(`[Webhook] Tx already in-flight: ${txHash}`);
            releaseLocalInflight(chainId, txHash);
            return;
        }
        if (!isSolanaItems) {
            sourceTxFrom = await resolveEvmSourceTxFrom(chainId, txHash);
            if (sourceTxFrom) {
                candidates = [sourceTxFrom];
            } else {
                console.warn(`[Webhook] Delaying tx_from_only binding for tx ${txHash}: source tx.from unavailable at ingress`, {
                    chainId,
                    provisionalCandidateCount: candidates.length,
                });
                emitCopytradeDomainAudit('evm_tx_from_binding_deferred', {
                    extra: {
                        chainId,
                        txHash,
                        provisionalCandidateCount: candidates.length,
                        provisionalCandidatesSample: candidates.slice(0, 5),
                        reasonCode: 'tx_from_only_binding_deferred_ingress'
                    }
                });
            }
        }
        // Fire-and-forget: don't await state marking on the critical path
        markCopyTradeTxState(chainId, txHash, 'confirmed_seen', { source: 'alchemy_webhook' }).catch(() => { });
        markCopyTradeIngressFirstSeen(chainId, txHash, Date.now(), 'alchemy_webhook').catch(() => { });
        markCopyTradeIngressConfirmed(chainId, txHash, Date.now(), 'alchemy_webhook').catch(() => { });
        reportWebhookSeen({
            chainId,
            txHash,
            source: 'alchemy_webhook',
            matchedWallet: sourceTxFrom || candidates[0] || undefined
        });

        try {
            const trackedWalletsFromSnapshot = resolveTrackedWalletsFromSnapshot(chainId, candidates);
            const [pendingHint, trackedWalletRows] = await Promise.all([
                getPendingTxHint(chainId, txHash).catch(() => null),
                trackedWalletsFromSnapshot.length > 0
                    ? Promise.resolve(trackedWalletsFromSnapshot.map((address) => ({ address })))
                    : prisma.trackedWallet.findMany({
                        where: {
                            address: { in: candidates, mode: 'insensitive' },
                            chainId,
                            activeConfigs: { gt: 0 }
                        },
                        select: { address: true }
                    })
            ]);
            if (!isSolanaItems) {
                const pendingTargetWallet = normalizeAddress(String(pendingHint?.targetWallet || ''));
                if (pendingTargetWallet && sourceTxFrom && pendingTargetWallet !== sourceTxFrom) {
                    emitCopytradeDomainAudit('signal_wallet_mismatch', {
                        extra: {
                            chainId,
                            txHash,
                            sourceTxFrom,
                            pendingTargetWallet,
                            reasonCode: 'pending_hint_source_wallet_mismatch'
                        }
                    });
                    console.error('[Webhook] Signal wallet mismatch detected; dropping tx', {
                        chainId,
                        txHash,
                        sourceTxFrom,
                        pendingTargetWallet
                    });
                    return;
                }
            }
            const adjudicatedSnapshot = getAdjudicatedSnapshot({ chainId, txHash });
            const isBoundSelfOrderWebhook = Boolean(adjudicatedSnapshot?.orderId);

            if (isBoundSelfOrderWebhook) {
                await markTxAsProcessedDistributed(txHash, chainId);
                markCopyTradeTxState(chainId, txHash, 'confirmed_seen', {
                    source: 'alchemy_webhook_self_order',
                    orderId: adjudicatedSnapshot?.orderId || null
                }).catch(() => { });
                console.log(
                    `[Webhook] Self-order tx observed via adjudicator: ${txHash} (orderId=${adjudicatedSnapshot?.orderId || 'unknown'})`
                );
                logWebhookTiming('alchemy', txHash, {
                    wallets: 0,
                    swaps: 0,
                    predecoded: 0,
                    selfOrder: true,
                    totalMs: Date.now() - itemStart
                });
                return;
            }

            if (chainId === 900) {
                try {
                    const resolved = await resolveSolanaTrackedWallets({
                        chainId,
                        txHash,
                        rawCandidates: candidates,
                        rawSignerCandidates: signerCandidates,
                        pendingTargetWallet: pendingHint?.targetWallet,
                        preResolvedTrackedWallets: trackedWalletRows
                    });
                    emitCopytradeDomainAudit('solana_target_resolution_observed', {
                        extra: {
                            chainId,
                            txHash,
                            reasonCode: resolved.reasonCode,
                            rawCandidateCount: candidates.length,
                            rawSignerCandidateCount: signerCandidates.length,
                            resolvedCandidateCount: resolved.candidateAddresses.length,
                            trackedWalletCount: resolved.trackedWallets.length,
                            parsedTxAvailable: Boolean(resolved.parsedTx),
                            usedPendingHintFallback: resolved.reasonCode === 'pending_hint_fallback',
                        }
                    });

                    if (resolved.trackedWallets.length === 0) {
                        console.log(
                            `[Webhook] Ignore Solana tx ${txHash}: ${resolved.reasonCode} (candidates=${resolved.candidateAddresses.join(', ') || 'none'})`
                        );
                        return;
                    }

                    console.log(
                        `[Webhook] Found ${resolved.trackedWallets.length} tracked wallets for Solana tx ${txHash} via ${resolved.reasonCode}`
                    );
                    const solanaTrackedWalletCount = resolved.trackedWallets.length;
                    swapsDetected = await processSolanaWebhookTx({
                        chainId,
                        txHash,
                        trackedWallets: resolved.trackedWallets,
                        parsedTx: resolved.parsedTx,
                        detectedAt: itemStart
                    });
                    if (swapsDetected > 0) {
                        await markTxAsProcessedDistributed(txHash, chainId);
                    } else {
                        console.log(`[Webhook] Solana tx decoded with no swaps; leaving unprocessed for retry: ${txHash}`);
                    }
                    logWebhookTiming('alchemy', txHash, {
                        wallets: solanaTrackedWalletCount,
                        swaps: swapsDetected,
                        predecoded: 0,
                        solana: true,
                        totalMs: Date.now() - itemStart
                    });
                } catch (err) {
                    console.error(`[Webhook] Error processing Solana tx ${txHash}:`, err);
                    throw err;
                }
                return;
            }

            const trackedWallets = trackedWalletRows.length > 0
                ? trackedWalletRows
                : (pendingHint?.targetWallet
                    ? [{ address: pendingHint.targetWallet }]
                    : []);
            const trackedWalletAddresses = trackedWallets
                .map((entry) => normalizeAddress(String(entry?.address || '')))
                .filter(Boolean);

            if (trackedWallets.length === 0) {
                await recordCopytradeIngressTrace({
                    chainId,
                    txHash,
                    eventType: 'no_tracked_wallets',
                    source: 'alchemy_webhook',
                    payload: {
                        candidates: candidates.slice(0, 8),
                    },
                }).catch(() => undefined);
                console.log(
                    `[Webhook] Ignore tx ${txHash}: no tracked wallets (from/to ${candidates.join(', ')})`
                );
                return;
            }

            console.log(`[Webhook] Found ${trackedWallets.length} tracked wallets for tx ${txHash}`);
            await recordCopytradeIngressTrace({
                chainId,
                txHash,
                eventType: 'tracked_wallets_resolved',
                source: 'alchemy_webhook',
                payload: {
                    trackedWalletCount: trackedWallets.length,
                    trackedWalletSample: trackedWallets.map((w) => w.address).slice(0, 5),
                },
            }).catch(() => undefined);

            const evmActivities: any[] = isSolanaItems
                ? []
                : (Array.isArray(item?.activities) && item.activities.length
                    ? item.activities
                    : (item ? [item] : []));
            const txSkeletonRaw = buildTxSkeletonFromAlchemyActivity(evmActivities, txHash);
            const txSkeleton = {
                ...txSkeletonRaw,
                from: sourceTxFrom || txSkeletonRaw.from
            };
            const predecodedRows = await Promise.all(
                trackedWallets.map(async (walletRecord) => ({
                    wallet: walletRecord.address,
                    predecoded: await getPendingPredecodedSwap(chainId, txHash, walletRecord.address).catch(() => null)
                }))
            );
            const predecodedByWallet = new Map(
                predecodedRows
                    .filter((r) => !!r.predecoded?.swap)
                    .map((r) => [r.wallet.toLowerCase(), r.predecoded!])
            );
            const trustedPredecodedByWallet = new Map(
                predecodedRows
                    .filter((r) => !!r.predecoded?.swap && isPendingPredecodeTrusted(r.predecoded))
                    .map((r) => [r.wallet.toLowerCase(), r.predecoded!])
            );

            const decodeStart = Date.now();
            const decodeDeadline = decodeStart + WEBHOOK_FETCH_PARSE_BUDGET_MS;
            let receipt: any = null;
            const allWalletsHaveTrustedPredecoded = trustedPredecodedByWallet.size === trackedWallets.length && trackedWallets.length > 0;
            if (!allWalletsHaveTrustedPredecoded) {
                const fetchReceiptWithRetry = async () => {
                    const maxAttempts = Math.max(1, Number(process.env.COPYTRADE_WEBHOOK_RECEIPT_MAX_ATTEMPTS || 2));
                    const baseDelayMs = Math.max(40, Number(process.env.COPYTRADE_WEBHOOK_RECEIPT_RETRY_BASE_MS || 120));
                    let current: any = null;
                    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                        if (Date.now() > decodeDeadline) break;
                        const remaining = Math.max(120, Math.min(WEBHOOK_FULL_TX_TIMEOUT_MS, decodeDeadline - Date.now()));
                        current = await withTimeout(fetchTransactionReceipt(txHash, chainId), remaining, 'receipt_fetch').catch(() => null);
                        if (current) break;
                        if (attempt < maxAttempts && Date.now() < decodeDeadline) {
                            await new Promise((resolve) => setTimeout(resolve, baseDelayMs * attempt));
                        }
                    }
                    return { receipt: current, attempts: maxAttempts };
                };
                const receiptStart = Date.now();
                const fetched = await fetchReceiptWithRetry();
                receiptMs = Date.now() - receiptStart;
                receipt = fetched.receipt;
                if (receipt?.transactionHash) {
                    reportReceiptSeen({
                        chainId,
                        txHash,
                        success: parseInt(String(receipt.status || '0x0'), 16) === 1,
                        blockNumber: receipt.blockNumber || undefined,
                        source: 'alchemy_webhook'
                    });
                }
                if (!receipt) {
                    if (trustedPredecodedByWallet.size === 0) {
                        console.warn(`[Webhook] Could not fetch receipt after retries: ${txHash.slice(0, 16)}`, {
                            receiptMissing: true,
                            attempts: fetched.attempts
                        });
                        scheduleReceiptRecovery(
                            chainId,
                            txHash,
                            trackedWallets.map((w) => w.address),
                            pendingHint?.detectedAt
                        );
                        return;
                    }
                    console.warn(`[Webhook] Receipt missing, continuing only with trusted predecode swaps: ${txHash.slice(0, 16)}`, {
                        cachedWallets: predecodedByWallet.size,
                        trustedCachedWallets: trustedPredecodedByWallet.size,
                        trackedWallets: trackedWallets.length
                    });
                }
            }
            const sourceBlockTimestampMs = receipt
                ? await resolveReceiptBlockTimestampMs(chainId, receipt).catch(() => undefined)
                : undefined;

            let fullTxPromise: Promise<any | null> | null = null;
            const bindingWasDeferredAtIngress = !isSolanaItems && !sourceTxFrom;
            const fetchFullTxOnce = () => {
                if (!fullTxPromise) {
                    const fullTxStart = Date.now();
                    const remaining = Math.max(120, Math.min(WEBHOOK_FULL_TX_TIMEOUT_MS, decodeDeadline - Date.now()));
                    fullTxPromise = withTimeout(fetchTransaction(txHash, chainId), remaining, 'tx_fetch')
                        .catch(() => null)
                        .finally(() => { fullTxMs = Date.now() - fullTxStart; });
                }
                return fullTxPromise;
            };
            const emitDeferredBindingResolved = (resolvedFrom: string, resolutionSource: string): void => {
                if (!bindingWasDeferredAtIngress || deferredBindingOutcome) return;
                deferredBindingOutcome = 'resolved';
                emitCopytradeDomainAudit('evm_tx_from_binding_resolved', {
                    extra: {
                        chainId,
                        txHash,
                        sourceTxFrom: resolvedFrom,
                        resolutionSource,
                        provisionalCandidateCount: candidates.length,
                        reasonCode: 'tx_from_only_binding_resolved'
                    }
                });
            };
            const emitDeferredBindingMissingFinal = (): void => {
                if (!bindingWasDeferredAtIngress || deferredBindingOutcome) return;
                deferredBindingOutcome = 'missing';
                emitCopytradeDomainAudit('evm_tx_from_binding_missing_final', {
                    extra: {
                        chainId,
                        txHash,
                        provisionalCandidateCount: candidates.length,
                        reasonCode: 'tx_from_only_binding_missing_final'
                    }
                });
            };

            await Promise.allSettled(trackedWallets.map(async (walletRecord) => {
                const trackedTarget = walletRecord.address;
                const normalizedTrackedTarget = normalizeAddress(trackedTarget) || trackedTarget.toLowerCase();
                if (!isSolanaItems && sourceTxFrom && normalizedTrackedTarget !== sourceTxFrom) {
                    return;
                }
                const cached = predecodedByWallet.get(trackedTarget.toLowerCase());
                const cachedTrusted = isPendingPredecodeTrusted(cached);
                const useCachedSwap = cachedTrusted && Boolean(cached?.swap);
                let swap = useCachedSwap ? (cached?.swap || null) : null;
                let swapSource: 'webhook_cached_predecoded' | 'webhook_decode' = useCachedSwap
                    ? 'webhook_cached_predecoded'
                    : 'webhook_decode';
                let resolvedTxForContext = txSkeleton;
                let activityCashHint: ActivityCashHint | null = null;
                if (useCachedSwap) {
                    usedPredecoded += 1;
                } else if (cached?.swap && !cachedTrusted) {
                    console.warn('[Webhook] Ignoring untrusted pending predecoded swap until receipt-confirmed decode', {
                        chainId,
                        txHash,
                        wallet: trackedTarget,
                        predecodedSource: getPendingPredecodeSource(cached),
                        reasonCode: 'pending_predecoded_unconfirmed_blocked'
                    });
                }

                if (!swap && receipt) {
                    const parseSkeletonStart = Date.now();
                    swap = await withTimeout(parseSwapTransaction(
                        txSkeleton,
                        {
                            logs: receipt.logs,
                            status: parseInt(receipt.status, 16),
                        },
                        chainId,
                        trackedTarget
                    ), WEBHOOK_PARSE_TIMEOUT_MS, 'parse_skeleton').catch(() => null);
                    parseSkeletonMs += Date.now() - parseSkeletonStart;

                    if (Date.now() < decodeDeadline) {
                        activityCashHint = await buildActivityCashHint(evmActivities, trackedTarget, chainId).catch(() => null);
                    }

                    const shouldAttemptFullTxFallback = !useCachedSwap && (
                        !swap
                        || shouldForceFullTxRepair({
                            chainId,
                            swap,
                            cashHint: activityCashHint,
                            hasCachedSwap: useCachedSwap
                        })
                    );

                    if (shouldAttemptFullTxFallback && Date.now() < decodeDeadline) {
                        const fullTx = await fetchFullTxOnce();
                        if (fullTx) {
                            const parseFullStart = Date.now();
                            const reparsed = await withTimeout(parseSwapTransaction(
                                {
                                    hash: txHash,
                                    from: fullTx.from,
                                    to: fullTx.to,
                                    input: fullTx.input,
                                    value: fullTx.value,
                                },
                                {
                                    logs: receipt.logs,
                                    status: parseInt(receipt.status, 16),
                                },
                                chainId,
                                trackedTarget
                            ), WEBHOOK_PARSE_TIMEOUT_MS, 'parse_fulltx').catch(() => null);
                            parseFullMs += Date.now() - parseFullStart;
                            if (reparsed) {
                                swap = reparsed;
                                swapSource = 'webhook_decode';
                                resolvedTxForContext = {
                                    hash: txHash,
                                    from: fullTx.from,
                                    to: fullTx.to,
                                    input: fullTx.input,
                                    value: fullTx.value,
                                };
                            }
                        }
                    }
                }

                // Cash-leg fallback: when parseSwapTransaction fails (no V2/V3/V4 Swap events),
                // use ERC20 Transfer events + cash flow from Alchemy activities to detect swaps.
                // This is more universal than requiring DEX-specific pool events.
                if (!swap && receipt) {
                    const cashHint = activityCashHint || await buildActivityCashHint(evmActivities, trackedTarget, chainId).catch(() => null);
                    if (cashHint && ((cashHint.cashSpentUsd || 0) > 0 || (cashHint.cashReceivedUsd || 0) > 0)) {
                        const transferSwap = decodeSwapFromLogs(
                            receipt.logs,
                            trackedTarget.toLowerCase(),
                            resolvedTxForContext.value
                        );
                        if (transferSwap && transferSwap.tokenIn !== transferSwap.tokenOut) {
                            transferSwap.txHash = txHash;
                            transferSwap.router = resolvedTxForContext.to || '';
                            transferSwap.dexName = 'Cash-Leg Fallback';
                            transferSwap.cashLegHint = cashHint;
                            swap = transferSwap;
                            swapSource = 'webhook_decode';
                            console.log(`[Webhook] Cash-leg fallback decoded swap for ${trackedTarget}: ${txHash.slice(0, 16)}`, {
                                tokenIn: transferSwap.tokenIn?.slice(0, 10),
                                tokenOut: transferSwap.tokenOut?.slice(0, 10),
                                cashSpentUsd: cashHint.cashSpentUsd,
                                cashReceivedUsd: cashHint.cashReceivedUsd
                            });
                        }
                    }
                }
                if (!swap) {
                    const activitySwap = await decodeSwapFromActivities(evmActivities, trackedTarget, chainId).catch(() => null);
                    if (activitySwap && activitySwap.tokenIn !== activitySwap.tokenOut) {
                        activitySwap.txHash = txHash;
                        activitySwap.router = resolvedTxForContext.to || '';
                        swap = activitySwap;
                        swapSource = 'webhook_decode';
                        console.log(`[Webhook] Activity fallback decoded swap for ${trackedTarget}: ${txHash.slice(0, 16)}`, {
                            tokenIn: activitySwap.tokenIn?.slice(0, 10),
                            tokenOut: activitySwap.tokenOut?.slice(0, 10),
                            dex: activitySwap.dexName
                        });
                    }
                }
                if (!isSolanaItems) {
                    const contextFrom = normalizeAddress(String(resolvedTxForContext.from || '')) || '';
                    const skeletonFrom = normalizeAddress(String(txSkeletonRaw.from || '')) || '';
                    const cachedSourceFrom = normalizeAddress(String(sourceTxFrom || '')) || '';
                    let effectiveSourceTxFrom = contextFrom || skeletonFrom || cachedSourceFrom;
                    let resolutionSource = contextFrom
                        ? 'resolved_tx_context'
                        : (skeletonFrom
                            ? 'tx_skeleton'
                            : (cachedSourceFrom ? 'cached_resolve' : ''));
                    if (!effectiveSourceTxFrom) {
                        effectiveSourceTxFrom = await resolveEvmSourceTxFrom(chainId, txHash);
                        resolutionSource = effectiveSourceTxFrom ? 'fetch_transaction' : '';
                    }
                    if (!effectiveSourceTxFrom) {
                        emitDeferredBindingMissingFinal();
                        await recordCopytradeIngressTrace({
                            chainId,
                            txHash,
                            targetWallet: trackedTarget,
                            eventType: 'missing_source_tx_from_final',
                            source: 'alchemy_webhook',
                        }).catch(() => undefined);
                        console.error(`[Webhook] Ignore tx ${txHash}: missing source tx.from after deferred tx_from_only binding`);
                        return;
                    }
                    emitDeferredBindingResolved(effectiveSourceTxFrom, resolutionSource || 'unknown');
                    sourceTxFrom = effectiveSourceTxFrom;
                    if (normalizedTrackedTarget !== effectiveSourceTxFrom) {
                        if (!swap) {
                            emitCopytradeDomainAudit('signal_wallet_mismatch', {
                                extra: {
                                    chainId,
                                    txHash,
                                    sourceTxFrom: effectiveSourceTxFrom,
                                    pendingTargetWallet: normalizedTrackedTarget,
                                    reasonCode: 'webhook_candidate_source_wallet_mismatch'
                                }
                            });
                            console.error('[Webhook] Candidate wallet mismatch detected after deferred tx_from_only binding; dropping wallet', {
                                chainId,
                                txHash,
                                sourceTxFrom: effectiveSourceTxFrom,
                                candidateWallet: normalizedTrackedTarget
                            });
                            return;
                        }
                        console.warn('[Webhook] Candidate wallet mismatch tolerated because swap decoded for tracked wallet', {
                            chainId,
                            txHash,
                            sourceTxFrom: effectiveSourceTxFrom,
                            candidateWallet: normalizedTrackedTarget,
                            tokenIn: swap.tokenIn,
                            tokenOut: swap.tokenOut
                        });
                    }
                }
                if (!swap) return;
                swapsDetected += 1;
                activityCashHint = activityCashHint || await buildActivityCashHint(evmActivities, trackedTarget, chainId).catch(() => null);
                if (activityCashHint) {
                    swap.cashLegHint = activityCashHint;
                }
                // Fire-and-forget: state marking + context persistence are not on the critical path
                markCopyTradeTxState(chainId, txHash, 'swap_decoded', {
                    wallet: trackedTarget,
                    dex: swap.dexName,
                    source: swapSource === 'webhook_cached_predecoded' ? 'pending_prefetch' : 'webhook_decode'
                }).catch(() => { });
                await recordCopytradeIngressTrace({
                    chainId,
                    txHash,
                    targetWallet: trackedTarget,
                    eventType: 'swap_decoded',
                    source: swapSource,
                    payload: {
                        tokenIn: swap.tokenIn,
                        tokenOut: swap.tokenOut,
                        dex: swap.dexName || null,
                        sourceTxFrom: sourceTxFrom || null,
                    },
                }).catch(() => undefined);
                const decodeTiming = buildWebhookDecodeReadyTiming({
                    swapSource,
                    cachedTiming: cached?.timing,
                    pendingHintTiming: pendingHint?.timing,
                    nowMs: Date.now()
                });

                persistSwapExecutionContext({
                    chainId,
                    txHash,
                    txFrom: resolvedTxForContext.from,
                    txTo: resolvedTxForContext.to,
                    txInput: resolvedTxForContext.input,
                    txValue: resolvedTxForContext.value,
                    receiptLogs: receipt?.logs || [],
                    swap,
                    targetWallet: trackedTarget,
                    detectedAt: decodeTiming.dispatchEligibleAt || decodeTiming.swapReadyAt || Date.now()
                }).catch(() => { });

                // When we decoded from receipt in this request (no cached predecoded), use now as detectedAt
                // so delay is measured from "swap ready + enqueued", not from an older pending hint
                // that was never trusted enough to dispatch the trade.
                const timing = buildWebhookDecodeDispatchTiming({
                    swapSource,
                    cachedTiming: cached?.timing,
                    pendingHintTiming: pendingHint?.timing,
                    nowMs: Date.now()
                });
                const detectedAt = timing.dispatchEligibleAt || timing.swapReadyAt || Date.now();
                await markCopyTradeIngressSwapReady(
                    chainId,
                    txHash,
                    timing.swapReadyAt || Date.now(),
                    swapSource
                ).catch(() => { });
                const accepted = await dispatchCopyTradeIfReady({
                    chainId,
                    txHash,
                    targetWallet: trackedTarget,
                    swap,
                    sourceTxFrom: sourceTxFrom || undefined,
                    sourceBlockTimestampMs,
                    detectedAt,
                    timing,
                    source: swapSource
                });
                await recordCopytradeIngressTrace({
                    chainId,
                    txHash,
                    targetWallet: trackedTarget,
                    eventType: accepted ? 'dispatch_enqueued' : 'dispatch_suppressed',
                    source: swapSource,
                    payload: {
                        sourceTxFrom: sourceTxFrom || null,
                    },
                }).catch(() => undefined);
            }));
            if (swapsDetected > 0) {
                await markTxAsProcessedDistributed(txHash, chainId);
            } else {
                handleEvmDecodedWithoutSwaps({
                    chainId,
                    txHash,
                    trackedWallets: trackedWalletAddresses,
                    detectedAt: Date.now(),
                });
            }
            logWebhookTiming('alchemy', txHash, {
                wallets: trackedWallets.length,
                swaps: swapsDetected,
                predecoded: usedPredecoded,
                receiptMs: receiptMs || undefined,
                parseSkeletonMs: parseSkeletonMs || undefined,
                fullTxMs: fullTxMs || undefined,
                parseFullMs: parseFullMs || undefined,
                totalMs: Date.now() - itemStart
            });
        } finally {
            await releaseTxProcessingLockDistributed(txHash, chainId, txLockValue);
            releaseLocalInflight(chainId, txHash);
        }
    };

    const BATCH_SIZE = 5;
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(batch.map(processItem));
        const rejected = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
        if (rejected) {
            throw rejected.reason;
        }
    }
}

export default async function webhookRoutes(fastify: FastifyInstance) {
    await ensureAlchemyWebhookInboxTable().catch((err) => {
        console.error('[Webhook] Failed to ensure webhook inbox table:', err);
    });
    await ensureCopytradeIngressTraceTable().catch((err) => {
        console.error('[Webhook] Failed to ensure ingress trace table:', err);
    });
    const disableInboxWorker = (process.env.COPYTRADE_DISABLE_WEBHOOK_INBOX_WORKER || '').toLowerCase() === 'true';
    if (!disableInboxWorker) {
        startAlchemyWebhookInboxWorker(async (payload) => {
            await queueAlchemyWebhookBatch(payload);
        }, { intervalMs: 4000, batchSize: 8, maxAttempts: 20 });
    }

    fastify.post<{ Body: ProcessTxBody }>('/process-tx', async (request, reply) => {
        const internalSecret = env.security.internalWebhookSecret;
        if (!internalSecret) {
            if (IS_PRODUCTION) {
                console.error('[Webhook] INTERNAL_WEBHOOK_SECRET is required in production');
                return reply.status(503).send({ error: 'Webhook is not configured securely' });
            }
            console.warn('[Webhook] INTERNAL_WEBHOOK_SECRET is missing (development mode only)');
        } else {
            const providedSecret = request.headers['x-internal-secret'];
            if (!safeSecretEquals(providedSecret, internalSecret)) {
                console.warn(`[Webhook] Unauthorized access attempt to /process-tx from ${request.ip}`);
                return reply.status(401).send({ error: 'Unauthorized' });
            }
        }

        const { wallet, txHash, network, sourceTxFrom: requestedSourceTxFrom } = request.body;
        if (!wallet || !txHash || !network) {
            return reply.status(400).send({ error: 'wallet, txHash, and network are required' });
        }

        // Try direct lookup or uppercase lookup
        const chainId = NETWORK_TO_CHAIN_ID[network] || NETWORK_TO_CHAIN_ID[network.toUpperCase()];
        if (!chainId) {
            console.warn(`[Webhook] Unknown network: ${network}`);
            return reply.status(400).send({ error: `Unknown network: ${network}` });
        }
        const txHashNormalized = normalizeTxHash(chainId, txHash);
        let ingressSourceTxFrom: string | undefined = normalizeAddress(wallet) || undefined;
        if (chainId !== 900) {
            const normalizedWallet = normalizeAddress(wallet);
            if (!normalizedWallet) {
                return reply.status(400).send({ error: 'Invalid EVM wallet address' });
            }
            const requestedNormalizedSourceTxFrom = normalizeAddress(requestedSourceTxFrom);
            let walletBindingMismatch = false;
            let sourceTxFrom = await resolveEvmSourceTxFrom(chainId, txHashNormalized);
            if (!sourceTxFrom && requestedNormalizedSourceTxFrom) {
                sourceTxFrom = requestedNormalizedSourceTxFrom;
                console.warn('[Webhook] /process-tx using provided sourceTxFrom override after tx.from lookup miss', {
                    chainId,
                    txHash: txHashNormalized,
                    requestedSourceTxFrom: requestedNormalizedSourceTxFrom,
                    wallet: normalizedWallet
                });
            }
            if (!sourceTxFrom) {
                console.error(`[Webhook] Ignore /process-tx ${txHashNormalized}: missing source tx.from under tx_from_only binding`);
                return reply.send({ success: true, skipped: true, reason: 'missing_source_tx_from' });
            }
            if (sourceTxFrom !== normalizedWallet) {
                walletBindingMismatch = true;
            }
            ingressSourceTxFrom = sourceTxFrom;
            (request as any).__walletBindingMismatch = walletBindingMismatch;
        }

        if (!tryClaimLocalInflight(chainId, txHashNormalized)) {
            return reply.send({ success: true, skipped: true, reason: 'local_inflight_dedupe' });
        }
        console.log(`[Webhook] Processing tx from Go service: wallet=${wallet}, tx=${txHashNormalized}, chain=${chainId}`);

        let txLockValue: string | null = null;
        try {
            const t0 = Date.now();
            let tClaim = 0;
            let tExisting = 0;
            let tPredecoded = 0;
            let tReceipt = 0;
            let tParseSkeleton = 0;
            let tFullTx = 0;
            let tParseFull = 0;
            let tEnqueue = 0;
            txLockValue = await claimTxProcessingLockDistributed(txHashNormalized, chainId);
            tClaim = Date.now() - t0;
            if (!txLockValue) {
                return reply.send({ success: true, skipped: true, reason: 'already_processing_or_processed' });
            }
            if (await isTxProcessedDistributed(txHashNormalized, chainId)) {
                return reply.send({ success: true, skipped: true, reason: 'already_processed_cache' });
            }

            // Check if already processed
            const existingPosition = await prisma.position.findFirst({
                where: {
                    chainId,
                    OR: [
                        { leaderTxHash: txHashNormalized },
                        { entryTxHash: txHashNormalized }
                    ]
                }
            });
            tExisting = Date.now() - t0 - tClaim;
            if (existingPosition) {
                console.log(`[Webhook] Tx already processed: ${txHashNormalized}`);
                await markTxAsProcessedDistributed(txHashNormalized, chainId);
                return reply.send({ success: true, skipped: true, reason: 'already_processed' });
            }

            const predecodedStart = Date.now();
            const predecoded = await getPendingPredecodedSwap(chainId, txHashNormalized, wallet).catch(() => null);
            const predecodedSource = getPendingPredecodeSource(predecoded);
            const predecodedTrusted = isPendingPredecodeTrusted(predecoded);
            tPredecoded = Date.now() - predecodedStart;
            if (predecoded?.swap && predecodedTrusted) {
                const enqueueStart = Date.now();
                await markCopyTradeTxState(chainId, txHashNormalized, 'swap_decoded', {
                    wallet,
                    dex: predecoded.swap.dexName,
                    source: 'pending_prefetch'
                }).catch(() => { });
                const pendingHint = await getPendingTxHint(chainId, txHashNormalized).catch(() => null);
                await persistSwapExecutionContext({
                    chainId,
                    txHash: txHashNormalized,
                    txInput: predecoded.swap.sourceTxInput,
                    txValue: predecoded.swap.sourceTxValue,
                    swap: predecoded.swap,
                    targetWallet: wallet,
                    detectedAt: (() => {
                        const timing = markCopyTradeSwapReady(
                            mergeCopyTradeTimingSnapshots(predecoded.timing, pendingHint?.timing),
                            Date.now(),
                            'process_tx_pending_prefetch'
                        );
                        return timing.dispatchEligibleAt || timing.swapReadyAt || resolveDetectedAt(COPYTRADE_DETECTED_AT_STALE_MS, predecoded.detectedAt, pendingHint?.detectedAt);
                    })()
                });
                const timing = markCopyTradeTaskEnqueued(
                    markCopyTradeSwapReady(
                        mergeCopyTradeTimingSnapshots(predecoded.timing, pendingHint?.timing),
                        Date.now(),
                        'process_tx_pending_prefetch'
                    ),
                    Date.now()
                );
                await markCopyTradeIngressFirstSeen(
                    chainId,
                    txHashNormalized,
                    timing.firstSeenAt || Date.now(),
                    'process_tx_pending_prefetch'
                ).catch(() => { });
                await markCopyTradeIngressSwapReady(
                    chainId,
                    txHashNormalized,
                    timing.swapReadyAt || Date.now(),
                    'process_tx_pending_prefetch'
                ).catch(() => { });
                await dispatchCopyTradeIfReady({
                    chainId,
                    txHash: txHashNormalized,
                    targetWallet: wallet,
                    swap: predecoded.swap,
                    sourceTxFrom: ingressSourceTxFrom,
                    detectedAt: timing.dispatchEligibleAt || timing.swapReadyAt || resolveDetectedAt(COPYTRADE_DETECTED_AT_STALE_MS, predecoded.detectedAt, pendingHint?.detectedAt),
                    timing,
                    source: 'process_tx_pending_prefetch'
                });
                await markTxAsProcessedDistributed(txHashNormalized, chainId);
                tEnqueue = Date.now() - enqueueStart;
                logWebhookTiming('process-tx', txHashNormalized, {
                    path: 'pending_prefetch',
                    claimMs: tClaim,
                    existingMs: tExisting,
                    predecodedMs: tPredecoded,
                    enqueueMs: tEnqueue,
                    totalMs: Date.now() - t0
                });
                return reply.send({ success: true, swap: { tokenIn: predecoded.swap.tokenIn, tokenOut: predecoded.swap.tokenOut } });
            } else if (predecoded?.swap) {
                await markCopyTradeTxState(chainId, txHashNormalized, 'pending_seen', {
                    wallet,
                    source: 'process_tx_pending_predecoded_blocked',
                    reasonCode: 'pending_predecoded_unconfirmed_blocked',
                    predecodedSource
                }).catch(() => { });
                console.warn('[Webhook] Blocked untrusted pending predecoded swap on /process-tx; waiting for receipt decode', {
                    chainId,
                    txHash: txHashNormalized,
                    wallet,
                    predecodedSource
                });
            }

            const budgetStart = Date.now();
            // Fetch receipt first (cheaper + enough for most swap decodes), fetch full tx only on demand.
            const receiptStart = Date.now();
            const receipt = await withTimeout(
                fetchTransactionReceipt(txHashNormalized, chainId),
                WEBHOOK_FETCH_PARSE_BUDGET_MS,
                'receipt_fetch'
            );
            const sourceBlockTimestampMs = receipt
                ? await resolveReceiptBlockTimestampMs(chainId, receipt).catch(() => undefined)
                : undefined;
            tReceipt = Date.now() - receiptStart;
            if (!receipt) {
                if (predecoded?.swap && !predecodedTrusted) {
                    return reply.send({ success: true, skipped: true, reason: 'awaiting_receipt_confirmation' });
                }
                console.warn(`[Webhook] Could not fetch tx/receipt: ${txHashNormalized.slice(0, 16)}`);
                return reply.status(404).send({ error: 'Transaction not found' });
            }
            reportWebhookSeen({
                chainId,
                txHash: txHashNormalized,
                source: 'alchemy_webhook',
                matchedWallet: ingressSourceTxFrom || wallet
            });
            reportReceiptSeen({
                chainId,
                txHash: txHashNormalized,
                success: parseInt(String(receipt.status || '0x0'), 16) === 1,
                blockNumber: receipt.blockNumber || undefined,
                source: 'alchemy_webhook'
            });

            // Parse as swap
            const parseSkeletonStart = Date.now();
            let swap = await parseSwapTransaction(
                {
                    hash: txHashNormalized,
                    from: '',
                    to: '',
                    input: '0x',
                    value: '0x0',
                },
                {
                    logs: receipt.logs,
                    status: parseInt(receipt.status, 16),
                },
                chainId,
                wallet
            );
            tParseSkeleton = Date.now() - parseSkeletonStart;

            if (!swap && Date.now() - budgetStart < WEBHOOK_FETCH_PARSE_BUDGET_MS) {
                const remaining = Math.max(120, Math.min(WEBHOOK_FULL_TX_TIMEOUT_MS, WEBHOOK_FETCH_PARSE_BUDGET_MS - (Date.now() - budgetStart)));
                const fullTxStart = Date.now();
                const tx = await withTimeout(fetchTransaction(txHashNormalized, chainId), remaining, 'tx_fetch').catch(() => null);
                tFullTx = Date.now() - fullTxStart;
                if (tx) {
                    const parseFullStart = Date.now();
                    swap = await parseSwapTransaction(
                        {
                            hash: txHashNormalized,
                            from: tx.from,
                            to: tx.to,
                            input: tx.input,
                            value: tx.value,
                        },
                        {
                            logs: receipt.logs,
                            status: parseInt(receipt.status, 16),
                        },
                        chainId,
                        wallet
                    );
                    tParseFull = Date.now() - parseFullStart;
                }
            }

            if (!swap) {
                const activitySwap = await decodeSwapFromActivities(Array.isArray((request.body as any)?.activities) ? (request.body as any).activities : [], wallet, chainId).catch(() => null);
                if (activitySwap && activitySwap.tokenIn !== activitySwap.tokenOut) {
                    swap = activitySwap;
                }
            }

            const walletBindingMismatch = Boolean((request as any).__walletBindingMismatch);
            if (walletBindingMismatch && !swap) {
                emitCopytradeDomainAudit('signal_wallet_mismatch', {
                    extra: {
                        chainId,
                        txHash: txHashNormalized,
                        sourceTxFrom: ingressSourceTxFrom,
                        pendingTargetWallet: normalizeAddress(wallet),
                        reasonCode: 'process_tx_wallet_source_mismatch'
                    }
                });
                console.error('[Webhook] /process-tx wallet mismatch detected; dropping tx', {
                    chainId,
                    txHash: txHashNormalized,
                    sourceTxFrom: ingressSourceTxFrom,
                    wallet: normalizeAddress(wallet)
                });
                return reply.send({ success: true, skipped: true, reason: 'signal_wallet_mismatch' });
            }

            if (!swap) {
                console.log(`[Webhook] Not a swap tx: ${txHashNormalized.slice(0, 16)}`);
                await markTxAsProcessedDistributed(txHashNormalized, chainId);
                return reply.send({ success: true, skipped: true, reason: 'not_a_swap' });
            }

            if (walletBindingMismatch) {
                console.warn('[Webhook] /process-tx wallet mismatch tolerated because swap decoded for wallet', {
                    chainId,
                    txHash: txHashNormalized,
                    sourceTxFrom: ingressSourceTxFrom,
                    wallet: normalizeAddress(wallet),
                    tokenIn: swap.tokenIn,
                    tokenOut: swap.tokenOut
                });
            }

            console.log(`[Webhook] ✅ Swap detected:`, {
                wallet: wallet.slice(0, 10),
                tokenIn: swap.tokenIn,
                tokenOut: swap.tokenOut,
                dex: swap.dexName,
            });
            await markCopyTradeTxState(chainId, txHashNormalized, 'swap_decoded', {
                wallet,
                dex: swap.dexName,
                source: 'internal_process_tx'
            }).catch(() => { });
            const pendingHint = await getPendingTxHint(chainId, txHashNormalized).catch(() => null);
            await persistSwapExecutionContext({
                chainId,
                txHash: txHashNormalized,
                txInput: swap.sourceTxInput,
                txValue: swap.sourceTxValue,
                swap,
                targetWallet: wallet,
                receiptLogs: receipt.logs || [],
                detectedAt: (() => {
                    const timing = markCopyTradeSwapReady(
                        mergeCopyTradeTimingSnapshots(
                            pendingHint?.timing,
                            buildCopyTradeFirstSeenTiming(Date.now(), 'internal_process_tx')
                        ),
                        Date.now(),
                        'internal_process_tx'
                    );
                    return timing.dispatchEligibleAt || timing.swapReadyAt || resolveDetectedAt(COPYTRADE_DETECTED_AT_STALE_MS, pendingHint?.detectedAt);
                })()
            });

            // Enqueue copy trade for async execution
            const enqueueStart = Date.now();
            const timing = markCopyTradeTaskEnqueued(
                markCopyTradeSwapReady(
                    mergeCopyTradeTimingSnapshots(
                        pendingHint?.timing,
                        buildCopyTradeFirstSeenTiming(Date.now(), 'internal_process_tx')
                    ),
                    Date.now(),
                    'internal_process_tx'
                    ),
                    Date.now()
                );
            await markCopyTradeIngressFirstSeen(
                chainId,
                txHashNormalized,
                timing.firstSeenAt || Date.now(),
                'internal_process_tx'
            ).catch(() => { });
            await markCopyTradeIngressSwapReady(
                chainId,
                txHashNormalized,
                timing.swapReadyAt || Date.now(),
                'internal_process_tx'
            ).catch(() => { });
            await dispatchCopyTradeIfReady({
                chainId,
                txHash: txHashNormalized,
                targetWallet: wallet,
                swap,
                sourceTxFrom: ingressSourceTxFrom,
                sourceBlockTimestampMs,
                detectedAt: timing.dispatchEligibleAt || timing.swapReadyAt || resolveDetectedAt(COPYTRADE_DETECTED_AT_STALE_MS, pendingHint?.detectedAt),
                timing,
                source: 'internal_process_tx'
            });
            await markTxAsProcessedDistributed(txHashNormalized, chainId);
            tEnqueue = Date.now() - enqueueStart;
            logWebhookTiming('process-tx', txHashNormalized, {
                path: 'receipt_decode',
                claimMs: tClaim,
                existingMs: tExisting,
                predecodedMs: tPredecoded,
                receiptMs: tReceipt,
                parseSkeletonMs: tParseSkeleton,
                fullTxMs: tFullTx || undefined,
                parseFullMs: tParseFull || undefined,
                enqueueMs: tEnqueue,
                totalMs: Date.now() - t0
            });

            return reply.send({ success: true, swap: { tokenIn: swap.tokenIn, tokenOut: swap.tokenOut } });
        } catch (error: any) {
            if (isRecoverableProcessTxFetchTimeout(error)) {
                console.warn('[Webhook] /process-tx timed out on critical fetch; scheduling receipt recovery', {
                    chainId,
                    txHash: txHashNormalized,
                    wallet,
                    error: String(error?.message || error || ''),
                });
                await markCopyTradeTxState(chainId, txHashNormalized, 'pending_seen', {
                    wallet,
                    source: 'process_tx_timeout_recovery',
                    reasonCode: 'process_tx_fetch_timeout_recovery',
                }).catch(() => { });
                return reply.send(handleProcessTxFetchTimeout({
                    chainId,
                    txHash: txHashNormalized,
                    wallet,
                }));
            }
            console.error(`[Webhook] Error processing tx:`, error);
            return reply.status(500).send({ error: 'Failed to process transaction' });
        } finally {
            if (txLockValue) {
                await releaseTxProcessingLockDistributed(txHashNormalized, chainId, txLockValue);
            }
            releaseLocalInflight(chainId, txHashNormalized);
        }
    });

    fastify.get('/health', async (request, reply) => {
        return reply.send({ status: 'ok', service: 'webhook' });
    });

    fastify.get('/sync-solana', async (request, reply) => {
        if (env.nodeEnv !== 'development') {
            return reply.status(403).send({ error: 'Forbidden in production' });
        }

        const { addAddressToWebhook } = await import('../services/alchemyWebhookService.js');
        const configs = await prisma.copyTradeConfig.findMany({
            where: { chainId: 900 }
        });

        const results = [];
        for (const config of configs) {
            // 1. Ensure it's in TrackedWallet table (used for filtering in webhook handler)
            await prisma.trackedWallet.upsert({
                where: {
                    address_chainId: {
                        address: config.targetWallet,
                        chainId: 900
                    }
                },
                update: {},
                create: {
                    address: config.targetWallet,
                    chainId: 900
                }
            });

            // 2. Add to Alchemy Webhook
            const success = await addAddressToWebhook(config.targetWallet, 900);
            results.push({ wallet: config.targetWallet, success, tracked: true });
        }

        return reply.send({
            message: `Synced ${configs.length} Solana wallets and ensured they are tracked`,
            details: results
        });
    });

    /**
     * POST /api/webhook/alchemy
     * Direct endpoint for Alchemy Address Activity webhooks
     */
    fastify.post('/alchemy', { config: { rawBody: true } }, async (request, reply) => {
        // 1. Signature Verification for Alchemy
        const content = (request as any).rawBody;
        const payloadForNetwork = request.body as any;
        const parsedNetwork = content
            ? parseAlchemyNetworkFromRawBody(content)
            : extractAlchemyNetwork(payloadForNetwork);
        const alchemySecrets = selectAlchemySecretsForNetwork(parsedNetwork);

        if (alchemySecrets.length === 0) {
            const now = Date.now();
            if (IS_PRODUCTION && !env.security.allowUnsignedAlchemyWebhook) {
                if (now - lastMissingAlchemySecretWarnAt > 60_000) {
                    lastMissingAlchemySecretWarnAt = now;
                    console.error('[Webhook] Alchemy webhook signing key missing in production; rejecting /alchemy webhook requests');
                }
                return reply.status(503).send({ error: 'Alchemy webhook secret not configured' });
            }
            if (now - lastMissingAlchemySecretWarnAt > 60_000) {
                lastMissingAlchemySecretWarnAt = now;
                console.warn('[Webhook] Alchemy webhook signing key missing; accepting unsigned /alchemy webhook requests');
            }
        } else {
            const signature = request.headers['x-alchemy-signature'] as string;
            if (!signature) {
                console.warn(`[Webhook] Missing Alchemy signature from ${request.ip}`);
                return reply.status(401).send({ error: 'Missing signature' });
            }
            if (!content) {
                if (IS_PRODUCTION && !env.security.allowUnsignedAlchemyWebhook) {
                    console.error('[Webhook] rawBody missing on /alchemy while signature verification is required');
                    return reply.status(503).send({ error: 'Webhook raw body unavailable for signature verification' });
                }
                console.warn('[Webhook] rawBody missing on /alchemy; skipping signature verification due to unsigned mode');
            }

            let signatureValid = false;
            if (content) {
                for (const secret of alchemySecrets) {
                    const hmac = crypto.createHmac('sha256', secret);
                    hmac.update(content);
                    const digest = hmac.digest('hex');
                    if (safeSecretEquals(signature, digest)) {
                        signatureValid = true;
                        break;
                    }
                }
            } else {
                signatureValid = env.security.allowUnsignedAlchemyWebhook;
            }

            if (!signatureValid) {
                console.warn(`[Webhook] Invalid Alchemy signature. Got ${signature?.slice?.(0, 12) || 'unknown'}...`);
                return reply.status(401).send({ error: 'Invalid signature' });
            }
        }

        const payload = request.body as any;
        const rawNetwork = extractAlchemyNetwork(payload) || 'unknown';
        const sampleActivity = payload?.event?.activity?.[0] || payload?.event?.activity;
        const sampleTx =
            payload?.event?.transaction?.[0] ||
            payload?.event?.transaction ||
            payload?.event?.event?.transaction?.[0] ||
            payload?.event?.event?.transaction;
        const sampleHash = sampleActivity?.hash || sampleTx?.signature || 'n/a';
        const sampleCategory = sampleActivity?.category || 'n/a';
        const sampleAsset = sampleActivity?.asset || sampleActivity?.rawContract?.address || 'n/a';
        console.log(
            `[Webhook] Alchemy payload: network=${rawNetwork} hash=${String(sampleHash)} category=${sampleCategory} asset=${sampleAsset}`
        );

        // Handle Alchemy test ping (no event data)
        if (!payload?.event || payload?.type === 'GRAPHQL') {
            reply.send({ success: true });
            console.log(`[Webhook] Alchemy test ping or non-activity webhook, ignoring`);
            return;
        }

        const payloadHashSource = content && String(content).length > 0
            ? String(content)
            : JSON.stringify(payload || {});
        const payloadHash = crypto.createHash('sha256').update(payloadHashSource).digest('hex');

        let inboxEventId: number | null = null;
        try {
            const queued = await enqueueAlchemyWebhookEvent({
                payloadHash,
                network: rawNetwork,
                txHash: String(sampleHash || ''),
                payload,
            });
            inboxEventId = queued.id;
            await recordCopytradeIngressTrace({
                chainId: NETWORK_TO_CHAIN_ID[String(rawNetwork || '').toUpperCase()] || 0,
                txHash: String(sampleHash || 'unknown'),
                eventType: 'alchemy_webhook_received',
                source: 'alchemy_webhook',
                payload: {
                    inboxEventId,
                    status: queued.status,
                    payloadHash,
                    network: rawNetwork,
                    category: sampleCategory,
                    asset: sampleAsset,
                },
            }).catch(() => undefined);
        } catch (err: any) {
            console.error(`[Webhook] Failed to enqueue Alchemy webhook event:`, err?.message || String(err));
        }

        // Respond immediately with 200 (Alchemy expects this)
        reply.send({ success: true });

        // Process asynchronously; prefer inbox row so failures get retried by worker.
        setImmediate(async () => {
            try {
                if (inboxEventId) {
                    const accepted = await processAlchemyWebhookInboxEventById(inboxEventId, queueAlchemyWebhookBatch);
                    if (!accepted) {
                        // Already in progress/processed by another worker.
                        return;
                    }
                    return;
                }
                await queueAlchemyWebhookBatch(payload);
            } catch (error) {
                console.error(`[Webhook] Error processing Alchemy webhook:`, error);
            }
        });
    });

}
