/**
 * Webhook Routes
 * Receives notifications from Go webhook service and triggers copy trades
 */

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
import { parseSwapTransaction, decodeSwapFromLogs } from '../services/txDecoder.js';
import { env } from '../config/env.js';
import crypto from 'node:crypto';
import { getPendingPredecodedSwap, getPendingTxHint, markCopyTradeTxState } from '../services/copyTradeTxStateService.js';
import { getChainConfig } from '../config/chainConfig.js';
import { getCachedNativeTokenPriceUsd } from '../services/onChainPriceService.js';
import { ethers } from 'ethers';
import {
    enqueueAlchemyWebhookEvent,
    ensureAlchemyWebhookInboxTable,
    processAlchemyWebhookInboxEventById,
    startAlchemyWebhookInboxWorker
} from '../services/alchemyWebhookInboxService.js';
import { buildSwapExecutionContext } from '../services/copytrade/context/contextBuilder.js';
import { putContext } from '../services/copytrade/context/contextStore.js';

interface ProcessTxBody {
    wallet: string;
    txHash: string;
    network: string;
}

// Map Alchemy network names to chain IDs
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
const WEBHOOK_LOCAL_TX_INFLIGHT_TTL_MS = Math.max(1000, Number(process.env.COPYTRADE_WEBHOOK_LOCAL_TX_INFLIGHT_TTL_MS || 20_000));
const COPYTRADE_DETECTED_AT_STALE_MS = Math.max(1000, Number(process.env.COPYTRADE_DETECTED_AT_STALE_MS || 4000));
const WEBHOOK_RECEIPT_RECOVERY_DELAYS_MS = String(process.env.COPYTRADE_WEBHOOK_RECEIPT_RECOVERY_DELAYS_MS || '1200,3000,7000')
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isFinite(v) && v > 0);
const localTxInflight = new Map<string, number>();
const receiptRecoveryInflight = new Set<string>();
const NATIVE_TOKEN_PLACEHOLDER = normalizeAddress('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');
const EVM_ADDRESS_REGEX = /0x[a-fA-F0-9]{40}/g;

type ActivityCashHint = {
    cashSpentUsd?: number;
    cashReceivedUsd?: number;
    inferredTxType?: 'TARGET_BUY' | 'TARGET_SELL' | 'TARGET_TOKEN_SWAP';
};

function normalizeTxHash(txHash: string): string {
    return String(txHash || '').toLowerCase();
}

function localInflightKey(chainId: number, txHash: string): string {
    return `${chainId}:${normalizeTxHash(txHash)}`;
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

function logWebhookTiming(scope: string, txHash: string, timings: Record<string, number | string | boolean | undefined>): void {
    const printable = Object.entries(timings)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ');
    console.log(`[WebhookTiming][${scope}] tx=${txHash.slice(0, 12)} ${printable}`);
}

function resolveDetectedAt(...candidates: Array<number | undefined | null>): number {
    const now = Date.now();
    for (const candidate of candidates) {
        if (!Number.isFinite(candidate as number)) continue;
        const value = Number(candidate);
        if (value <= 0) continue;
        if (now - value <= COPYTRADE_DETECTED_AT_STALE_MS) {
            return value;
        }
    }
    return now;
}

function waitMs(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function persistSwapContext(params: {
    chainId: number;
    txHash: string;
    txFrom?: string;
    txTo?: string;
    txInput?: string;
    txValue?: string;
    receiptLogs?: Array<{ topics: string[]; address: string; data: string }>;
    swap: any;
    targetWallet?: string;
    detectedAt?: number;
}): Promise<void> {
    try {
        const ctx = buildSwapExecutionContext({
            tx: {
                hash: params.txHash,
                to: params.txTo || params.swap?.router || '',
                input: params.txInput || params.swap?.sourceTxInput || '0x',
                value: params.txValue || params.swap?.sourceTxValue || '0x0'
            },
            receipt: {
                logs: params.receiptLogs || []
            },
            decodedSwap: params.swap,
            chainId: params.chainId,
            targetWallet: params.targetWallet,
            detectedAt: params.detectedAt
        });
        await putContext(ctx);
    } catch {
        // best-effort only
    }
}

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

    let swaps = 0;
    const { enqueueCopyTradeTask } = await import('../services/copyTradeQueue.js');
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
        await persistSwapContext({
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
        enqueueCopyTradeTask(trackedTarget, swap, chainId, { detectedAt: Date.now() });
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
    if (!trackedWallets.length) return;
    const key = `${chainId}:${normalizeTxHash(txHash)}`;
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

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    let timer: NodeJS.Timeout | null = null;
    try {
        return await Promise.race([
            promise,
            new Promise<T>((_, reject) => {
                timer = setTimeout(() => reject(new Error(`timeout_${label}_${ms}ms`)), ms);
            })
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
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
        if (env.security.alchemyWebhookSecretBase) secrets.push(env.security.alchemyWebhookSecretBase);
        if (env.security.alchemyWebhookSecretBsc) secrets.push(env.security.alchemyWebhookSecretBsc);
        if (env.security.alchemyWebhookSecretSol) secrets.push(env.security.alchemyWebhookSecretSol);
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

function safeSecretEquals(provided: unknown, expected: string): boolean {
    if (typeof provided !== 'string') return false;
    const providedBuf = Buffer.from(provided);
    const expectedBuf = Buffer.from(expected);
    if (providedBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

function buildTxSkeletonFromAlchemyActivity(item: any, txHash: string): {
    hash: string;
    from: string;
    to: string;
    input: string;
    value: string;
} {
    const from = normalizeAddress(item?.fromAddress || '');
    const to = normalizeAddress(item?.toAddress || '');
    // Prefer raw contract value when available (wei-like string/hex in webhook payload)
    const rawValue = item?.rawContract?.rawValue;
    const value = typeof rawValue === 'string' && rawValue.length > 0 ? rawValue : '0';
    return {
        hash: txHash,
        from,
        to,
        input: '0x',
        value
    };
}

function parseFlexibleInt(raw: unknown, fallback: number): number {
    if (raw === null || raw === undefined) return fallback;
    const text = String(raw).trim();
    if (!text) return fallback;
    const parsed = text.startsWith('0x') ? Number.parseInt(text, 16) : Number.parseInt(text, 10);
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 36 ? parsed : fallback;
}

function parseFlexibleBigInt(raw: unknown): bigint | null {
    if (raw === null || raw === undefined) return null;
    const text = String(raw).trim();
    if (!text) return null;
    try {
        return BigInt(text);
    } catch {
        return null;
    }
}

function getActivityRawAmount(item: any, decimals: number): bigint | null {
    const fromRaw = parseFlexibleBigInt(item?.rawContract?.rawValue ?? item?.rawContract?.value);
    if (fromRaw && fromRaw > 0n) return fromRaw;

    const amountNum = Number(item?.value || 0);
    if (!Number.isFinite(amountNum) || amountNum <= 0) return null;
    try {
        return ethers.parseUnits(amountNum.toFixed(Math.min(8, decimals)), decimals);
    } catch {
        return null;
    }
}

function pickBestActivity(activities: any[]): any {
    if (!activities.length) return null;
    let best = activities[0];
    let bestScore = -1;
    for (const activity of activities) {
        const score = Number(!!activity?.rawContract?.address) + Number(!!activity?.fromAddress) + Number(!!activity?.toAddress);
        if (score >= bestScore) {
            best = activity;
            bestScore = score;
        }
    }
    return best;
}

async function buildActivityCashHint(activities: any[], walletAddressRaw: string, chainId: number): Promise<ActivityCashHint | null> {
    if (!activities.length) return null;
    const walletAddress = normalizeAddress(walletAddressRaw);
    const chainConfig = getChainConfig(chainId);
    const wrappedNative = normalizeAddress(chainConfig.wrappedNativeAddress);
    const stableSet = new Set(chainConfig.stablecoins.map((s) => normalizeAddress(s)));
    const cashSet = new Set<string>([NATIVE_TOKEN_PLACEHOLDER, wrappedNative, ...stableSet]);
    const nativePrice = Number(await getCachedNativeTokenPriceUsd(chainId).catch(() => 0));

    let cashSpentUsd = 0;
    let cashReceivedUsd = 0;
    let netCashUsd = 0;

    // Track native+WETH spent/received separately to avoid double-counting ETH wraps.
    // When a Universal Router tx wraps ETH→WETH, Alchemy emits both a native ETH activity
    // row AND a WETH transfer log — both from the wallet — for the same underlying amount.
    // We keep only the larger of the two so the real 0.5 ETH doesn't become 1.0 ETH.
    let nativeLikeSpentUsd = 0;
    let nativeLikeReceivedUsd = 0;

    for (const item of activities) {
        const from = normalizeAddress(item?.fromAddress || '');
        const to = normalizeAddress(item?.toAddress || '');
        const tokenAddress = normalizeAddress(item?.rawContract?.address || NATIVE_TOKEN_PLACEHOLDER);
        if (!cashSet.has(tokenAddress)) continue;
        const isNativeLike = tokenAddress === NATIVE_TOKEN_PLACEHOLDER || tokenAddress === wrappedNative;
        const decimals = parseFlexibleInt(item?.rawContract?.decimal, isNativeLike ? 18 : 6);
        const amountRaw = getActivityRawAmount(item, decimals);
        if (!amountRaw || amountRaw <= 0n) continue;

        let usd = 0;
        if (stableSet.has(tokenAddress)) {
            usd = Number(ethers.formatUnits(amountRaw, decimals));
        } else if (isNativeLike && nativePrice > 0) {
            usd = Number(ethers.formatUnits(amountRaw, 18)) * nativePrice;
        }
        if (!Number.isFinite(usd) || usd <= 0) continue;

        if (isNativeLike) {
            // Accumulate via max to deduplicate ETH + WETH wrap for the same leg
            if (from === walletAddress) nativeLikeSpentUsd = Math.max(nativeLikeSpentUsd, usd);
            if (to === walletAddress) nativeLikeReceivedUsd = Math.max(nativeLikeReceivedUsd, usd);
        } else {
            if (from === walletAddress) { cashSpentUsd += usd; netCashUsd -= usd; }
            if (to === walletAddress) { cashReceivedUsd += usd; netCashUsd += usd; }
        }
    }

    // Merge deduplicated native-like amounts
    if (nativeLikeSpentUsd > 0) { cashSpentUsd += nativeLikeSpentUsd; netCashUsd -= nativeLikeSpentUsd; }
    if (nativeLikeReceivedUsd > 0) { cashReceivedUsd += nativeLikeReceivedUsd; netCashUsd += nativeLikeReceivedUsd; }

    if (cashSpentUsd <= 0 && cashReceivedUsd <= 0) return null;
    // Use net cash flow to avoid misclassification when webhook bundles multiple
    // internal/external activity rows for one tx (gross in/out can both be large).
    const netAbs = Math.abs(netCashUsd);
    const turnover = cashSpentUsd + cashReceivedUsd;
    const hasDirectionalNet = netAbs > 0.01 && (turnover <= 0 || (netAbs / turnover) >= 0.2);
    const inferBuy = hasDirectionalNet && netCashUsd < 0;
    const inferSell = hasDirectionalNet && netCashUsd > 0;

    return {
        cashSpentUsd: cashSpentUsd > 0 ? cashSpentUsd : undefined,
        cashReceivedUsd: cashReceivedUsd > 0 ? cashReceivedUsd : undefined,
        inferredTxType: inferBuy ? 'TARGET_BUY' : inferSell ? 'TARGET_SELL' : 'TARGET_TOKEN_SWAP'
    };
}

async function processAlchemyWebhookPayload(payload: any): Promise<void> {
    // Alchemy Address Activity webhook structure:
    // EVM: payload.event.network, payload.event.activity
    // Solana: payload.event.event.network, payload.event.event.transaction
    let current = payload;
    let network = undefined;
    let eventData = undefined;

    // Max 5 levels of recursion to avoid infinite loops
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

    // Extract items to process (Activity or Transaction)
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
        let receiptMs = 0;
        let fullTxMs = 0;
        let parseSkeletonMs = 0;
        let parseFullMs = 0;
        let swapsDetected = 0;
        let usedPredecoded = 0;

        if (isSolanaItems) {
            txHash = item.signature;

            const solTx = Array.isArray(item.transaction) ? item.transaction[0] : item.transaction;
            if (!txHash && solTx?.signatures) {
                txHash = solTx.signatures[0];
            }

            const solMsg = Array.isArray(solTx?.message) ? solTx.message[0] : solTx?.message;
            const keys = solMsg?.account_keys || solMsg?.accountKeys || [];
            candidates = keys.map((k: any) => normalizeAddress(typeof k === 'string' ? k : k.pubkey || k.toString()));

            if (candidates.length === 0) {
                console.log(`[Webhook] Solana candidate extraction debug: signature=${txHash}, item keys=${Object.keys(item)}, solTx keys=${solTx ? Object.keys(solTx) : 'null'}, solMsg keys=${solMsg ? Object.keys(solMsg) : 'null'}`);
            }
        } else {
            txHash = String(item?.hash || '');
            const evmActivities: any[] = Array.isArray(item?.activities) && item.activities.length
                ? item.activities
                : (item ? [item] : []);
            candidates = collectEvmActivityCandidates(evmActivities);
        }

        txHash = normalizeTxHash(txHash);
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
        // Fire-and-forget: don't await state marking on the critical path
        markCopyTradeTxState(chainId, txHash, 'confirmed_seen', { source: 'alchemy_webhook' }).catch(() => { });

        try {
            // ⚡ Parallel: pendingHint (Redis) + trackedWallets (Prisma) concurrently (~100ms saved)
            const [pendingHint, trackedWallets] = await Promise.all([
                getPendingTxHint(chainId, txHash).catch(() => null),
                prisma.trackedWallet.findMany({
                    where: {
                        address: { in: candidates, mode: 'insensitive' },
                        chainId,
                        activeConfigs: { gt: 0 }
                    }
                })
            ]);

            if (trackedWallets.length === 0) {
                console.log(
                    `[Webhook] Ignore tx ${txHash}: no tracked wallets (from/to ${candidates.join(', ')})`
                );
                return;
            }

            console.log(`[Webhook] Found ${trackedWallets.length} tracked wallets for tx ${txHash}`);

            if (chainId === 900) {
                try {
                    const { getSolanaConnection } = await import('../services/rpcManager.js');
                    const { decodeSolanaSwap } = await import('../services/solanaDecoder.js');

                    let tx: any = null;
                    const strategies: Array<'fast' | 'cheap'> = ['fast', 'cheap'];
                    for (const strategy of strategies) {
                        try {
                            const connection = getSolanaConnection(strategy, 'critical');
                            tx = await connection.getParsedTransaction(txHash, {
                                maxSupportedTransactionVersion: 0,
                                commitment: 'confirmed'
                            });
                            if (tx) break;
                        } catch {
                            // try other endpoint
                        }
                    }
                    if (!tx) {
                        console.error(`[Webhook] Failed to fetch Solana tx details after trying all RPCs: ${txHash}`);
                        return;
                    }

                    await markTxAsProcessedDistributed(txHash, chainId);
                    const { handleSwapDetected } = await import('../services/autoTradeService.js');
                    await Promise.allSettled(trackedWallets.map(async (walletRecord) => {
                        const trackedTarget = walletRecord.address;
                        const swap = await decodeSolanaSwap(tx, trackedTarget);
                        if (swap) await handleSwapDetected(trackedTarget, swap, chainId);
                    }));
                } catch (err) {
                    console.error(`[Webhook] Error fetching Solana tx details:`, err);
                }
                return;
            }

            const evmActivities: any[] = isSolanaItems
                ? []
                : (Array.isArray(item?.activities) && item.activities.length
                    ? item.activities
                    : (item ? [item] : []));
            const txSkeleton = buildTxSkeletonFromAlchemyActivity(item?.sample || evmActivities[0] || item, txHash);
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

            const decodeStart = Date.now();
            const decodeDeadline = decodeStart + WEBHOOK_FETCH_PARSE_BUDGET_MS;
            let receipt: any = null;
            if (predecodedByWallet.size !== trackedWallets.length) {
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
                if (!receipt) {
                    if (predecodedByWallet.size === 0) {
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
                    console.warn(`[Webhook] Receipt missing, continuing with pending predecode only: ${txHash.slice(0, 16)}`, {
                        cachedWallets: predecodedByWallet.size,
                        trackedWallets: trackedWallets.length
                    });
                }
            }

            let fullTxPromise: Promise<any | null> | null = null;
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

            await Promise.allSettled(trackedWallets.map(async (walletRecord) => {
                const trackedTarget = walletRecord.address;
                const cached = predecodedByWallet.get(trackedTarget.toLowerCase());
                let swap = cached?.swap || null;
                if (cached?.swap) usedPredecoded += 1;

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

                    if (!swap) {
                        const skipFullTxFallback = Boolean(cached || pendingHint);
                        if (!skipFullTxFallback && Date.now() < decodeDeadline) {
                            const fullTx = await fetchFullTxOnce();
                            if (fullTx) {
                                const parseFullStart = Date.now();
                                swap = await withTimeout(parseSwapTransaction(
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
                            }
                        }
                    }
                }

                // Cash-leg fallback: when parseSwapTransaction fails (no V2/V3/V4 Swap events),
                // use ERC20 Transfer events + cash flow from Alchemy activities to detect swaps.
                // This is more universal than requiring DEX-specific pool events.
                if (!swap && receipt) {
                    const cashHint = await buildActivityCashHint(evmActivities, trackedTarget, chainId).catch(() => null);
                    if (cashHint && ((cashHint.cashSpentUsd || 0) > 0 || (cashHint.cashReceivedUsd || 0) > 0)) {
                        const transferSwap = decodeSwapFromLogs(
                            receipt.logs,
                            trackedTarget.toLowerCase(),
                            txSkeleton.value
                        );
                        if (transferSwap && transferSwap.tokenIn !== transferSwap.tokenOut) {
                            transferSwap.txHash = txHash;
                            transferSwap.router = txSkeleton.to || '';
                            transferSwap.dexName = 'Cash-Leg Fallback';
                            transferSwap.cashLegHint = cashHint;
                            swap = transferSwap;
                            console.log(`[Webhook] Cash-leg fallback decoded swap for ${trackedTarget}: ${txHash.slice(0, 16)}`, {
                                tokenIn: transferSwap.tokenIn?.slice(0, 10),
                                tokenOut: transferSwap.tokenOut?.slice(0, 10),
                                cashSpentUsd: cashHint.cashSpentUsd,
                                cashReceivedUsd: cashHint.cashReceivedUsd
                            });
                        }
                    }
                }
                if (!swap) return;
                swapsDetected += 1;
                const activityCashHint = await buildActivityCashHint(evmActivities, trackedTarget, chainId).catch(() => null);
                if (activityCashHint) {
                    swap.cashLegHint = activityCashHint;
                }
                // Fire-and-forget: state marking + context persistence are not on the critical path
                markCopyTradeTxState(chainId, txHash, 'swap_decoded', {
                    wallet: trackedTarget,
                    dex: swap.dexName,
                    source: cached ? 'pending_prefetch' : 'webhook_decode'
                }).catch(() => { });
                persistSwapContext({
                    chainId,
                    txHash,
                    txFrom: txSkeleton.from,
                    txTo: txSkeleton.to,
                    txInput: txSkeleton.input,
                    txValue: txSkeleton.value,
                    receiptLogs: receipt?.logs || [],
                    swap,
                    targetWallet: trackedTarget,
                    detectedAt: cached
                        ? resolveDetectedAt(cached.detectedAt, pendingHint?.detectedAt)
                        : Date.now()
                }).catch(() => { });

                const { enqueueCopyTradeTask } = await import('../services/copyTradeQueue.js');
                // When we decoded from receipt in this request (no cached predecoded), use now as detectedAt
                // so the turbo delay is measured from "swap ready + enqueued", not from an older pendingHint
                // (pending watcher may have set pendingHint seconds earlier, which would make delay exceed 2.5s)
                const detectedAt = cached
                    ? resolveDetectedAt(cached.detectedAt, pendingHint?.detectedAt)
                    : Date.now();
                enqueueCopyTradeTask(trackedTarget, swap, chainId, { detectedAt });
            }));
            if (swapsDetected > 0) {
                await markTxAsProcessedDistributed(txHash, chainId);
            } else {
                console.log(`[Webhook] Tx decoded with no swaps; leaving unprocessed for potential follow-up payload: ${txHash}`);
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
        await Promise.allSettled(batch.map(processItem));
    }
}

export default async function webhookRoutes(fastify: FastifyInstance) {
    await ensureAlchemyWebhookInboxTable().catch((err) => {
        console.error('[Webhook] Failed to ensure webhook inbox table:', err);
    });
    startAlchemyWebhookInboxWorker(async (payload) => {
        await processAlchemyWebhookPayload(payload);
    }, { intervalMs: 4000, batchSize: 8, maxAttempts: 20 });

    /**
     * POST /api/webhook/process-tx
     * Called by Go webhook service when Alchemy detects a transaction
     */
    fastify.post<{ Body: ProcessTxBody }>('/process-tx', async (request, reply) => {
        // 1. Verify internal secret if configured
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

        const { wallet, txHash, network } = request.body;
        const txHashNormalized = normalizeTxHash(txHash);

        if (!wallet || !txHashNormalized || !network) {
            return reply.status(400).send({ error: 'wallet, txHash, and network are required' });
        }

        // Try direct lookup or uppercase lookup
        const chainId = NETWORK_TO_CHAIN_ID[network] || NETWORK_TO_CHAIN_ID[network.toUpperCase()];
        if (!chainId) {
            console.warn(`[Webhook] Unknown network: ${network}`);
            return reply.status(400).send({ error: `Unknown network: ${network}` });
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
            tPredecoded = Date.now() - predecodedStart;
            if (predecoded?.swap) {
                const enqueueStart = Date.now();
                await markCopyTradeTxState(chainId, txHashNormalized, 'swap_decoded', {
                    wallet,
                    dex: predecoded.swap.dexName,
                    source: 'pending_prefetch'
                }).catch(() => { });
                const pendingHint = await getPendingTxHint(chainId, txHashNormalized).catch(() => null);
                await persistSwapContext({
                    chainId,
                    txHash: txHashNormalized,
                    txInput: predecoded.swap.sourceTxInput,
                    txValue: predecoded.swap.sourceTxValue,
                    swap: predecoded.swap,
                    targetWallet: wallet,
                    detectedAt: resolveDetectedAt(predecoded.detectedAt, pendingHint?.detectedAt)
                });
                const { enqueueCopyTradeTask } = await import('../services/copyTradeQueue.js');
                enqueueCopyTradeTask(wallet, predecoded.swap, chainId, {
                    detectedAt: resolveDetectedAt(predecoded.detectedAt, pendingHint?.detectedAt)
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
            }

            const budgetStart = Date.now();
            // Fetch receipt first (cheaper + enough for most swap decodes), fetch full tx only on demand.
            const receiptStart = Date.now();
            const receipt = await withTimeout(
                fetchTransactionReceipt(txHashNormalized, chainId),
                WEBHOOK_FETCH_PARSE_BUDGET_MS,
                'receipt_fetch'
            );
            tReceipt = Date.now() - receiptStart;
            if (!receipt) {
                console.warn(`[Webhook] Could not fetch tx/receipt: ${txHashNormalized.slice(0, 16)}`);
                return reply.status(404).send({ error: 'Transaction not found' });
            }

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
                console.log(`[Webhook] Not a swap tx: ${txHashNormalized.slice(0, 16)}`);
                await markTxAsProcessedDistributed(txHashNormalized, chainId);
                return reply.send({ success: true, skipped: true, reason: 'not_a_swap' });
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
            await persistSwapContext({
                chainId,
                txHash: txHashNormalized,
                txInput: swap.sourceTxInput,
                txValue: swap.sourceTxValue,
                swap,
                targetWallet: wallet,
                receiptLogs: receipt.logs || [],
                detectedAt: resolveDetectedAt(pendingHint?.detectedAt)
            });

            // Enqueue copy trade for async execution
            const enqueueStart = Date.now();
            const { enqueueCopyTradeTask } = await import('../services/copyTradeQueue.js');
            enqueueCopyTradeTask(wallet, swap, chainId, {
                detectedAt: resolveDetectedAt(pendingHint?.detectedAt)
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
            console.error(`[Webhook] Error processing tx:`, error);
            return reply.status(500).send({ error: 'Failed to process transaction' });
        } finally {
            if (txLockValue) {
                await releaseTxProcessingLockDistributed(txHashNormalized, chainId, txLockValue);
            }
            releaseLocalInflight(chainId, txHashNormalized);
        }
    });

    /**
     * GET /api/webhook/health
     * Health check for webhook endpoint
     */
    fastify.get('/health', async (request, reply) => {
        return reply.send({ status: 'ok', service: 'webhook' });
    });

    /**
     * GET /api/webhook/sync-solana
     * Force resync all Solana wallets from DB to Alchemy.
     * Use this when webhooks are missing or addresses were lowercased.
     */
    fastify.get('/sync-solana', async (request, reply) => {
        // Restrict to development or admin
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
        const sampleTx = payload?.event?.event?.transaction?.[0] || payload?.event?.event?.transaction;
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
        } catch (err: any) {
            console.error(`[Webhook] Failed to enqueue Alchemy webhook event:`, err?.message || String(err));
        }

        // Respond immediately with 200 (Alchemy expects this)
        reply.send({ success: true });

        // Process asynchronously; prefer inbox row so failures get retried by worker.
        setImmediate(async () => {
            try {
                if (inboxEventId) {
                    const accepted = await processAlchemyWebhookInboxEventById(inboxEventId, processAlchemyWebhookPayload);
                    if (!accepted) {
                        // Already in progress/processed by another worker.
                        return;
                    }
                    return;
                }
                await processAlchemyWebhookPayload(payload);
            } catch (error) {
                console.error(`[Webhook] Error processing Alchemy webhook:`, error);
            }
        });
    });

}
