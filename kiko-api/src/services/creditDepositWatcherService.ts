import { createHash } from 'node:crypto';
import prisma from '../db/prisma.js';
import { env } from '../config/env.js';
import { getAssetTransfers, type AssetTransfer } from './alchemy.js';
import { getBlockNumber } from './rpcManager.js';
import { ingestCreditDeposit, updateCreditDepositWatcherState } from './creditBillingService.js';
import { addAddressToWebhook } from './alchemyWebhookService.js';
import { normalizeAddress } from '../utils/address.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

type DepositWatchStats = Record<string, number>;
let reconciliationTimer: ReturnType<typeof setInterval> | null = null;

// CONTEXT MEMORY
// Updated: 2026-04-22
// Status: mixed
// Why: Base ERC-20 deposit ingestion now runs from both Alchemy webhooks and a
//      reconciliation poller, but both paths must still feed one idempotent
//      billing ingest path and respect confirmation thresholds.
// Debug Goal: keep deposit detection idempotent while computing confirmations
//             consistently enough that pending deposits do not get credited early.
// Search Tags: credit deposit watcher confirmations webhook reconcile
// Invariants:
// - Webhook and reconciliation both call `ingestCreditDeposit` with the same deposit identity.
// - Reconciliation may replay old transfers safely because deposit ingestion is idempotent.
// - If confirmation count is unknown, watcher must not invent a fully confirmed state.
// Failure Modes:
// - Treating every webhook transfer as fully confirmed will credit deposits too early.
// - Divergent webhook/poller confirmation math will cause deposits to flap between states.

function createStats(): DepositWatchStats {
    return {
        processed: 0,
        credited: 0,
        duplicate: 0,
        belowMinimum: 0,
        confirming: 0,
        unsupportedAsset: 0,
        unmatchedUser: 0,
        skipped: 0,
        errors: 0,
    };
}

function increment(stats: DepositWatchStats, key: keyof DepositWatchStats, by = 1): void {
    stats[key] = (stats[key] || 0) + by;
}

function isBaseNetwork(value?: string | null): boolean {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === 'base' || normalized === 'base-mainnet' || normalized === 'ethereum-base';
}

function supportedAssetByToken(tokenAddress?: string | null, assetSymbol?: string | null) {
    const normalizedToken = normalizeAddress(tokenAddress || '');
    const normalizedSymbol = String(assetSymbol || '').trim().toUpperCase();
    return env.credits.supportedAssets.find((asset) => {
        const assetToken = normalizeAddress(asset.tokenAddress || '');
        if (normalizedToken && assetToken && assetToken === normalizedToken) return true;
        return normalizedSymbol && asset.symbol === normalizedSymbol;
    }) || null;
}

function stableLogIndex(activity: any): number {
    const direct = Number(activity?.logIndex ?? activity?.log?.index ?? activity?.eventIndex ?? activity?.transactionIndex);
    if (Number.isInteger(direct) && direct >= 0) return direct;

    const uniqueId = String(
        activity?.uniqueId
        || activity?.id
        || `${activity?.hash || ''}:${activity?.rawContract?.address || ''}:${activity?.fromAddress || activity?.from || ''}:${activity?.toAddress || activity?.to || ''}:${activity?.rawContract?.value || activity?.value || ''}`,
    );
    const hex = createHash('sha256').update(uniqueId).digest('hex').slice(0, 8);
    return parseInt(hex, 16) >>> 0;
}

function parseBlockNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value));
    const raw = String(value || '').trim();
    if (!raw) return null;
    if (raw.startsWith('0x')) {
        const parsed = parseInt(raw, 16);
        return Number.isFinite(parsed) ? parsed : null;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : null;
}

function toHexBlock(block: number): string {
    return `0x${Math.max(0, Math.floor(block)).toString(16)}`;
}

function resolveAmountRaw(activity: any): string {
    const raw = activity?.rawContract?.value;
    if (raw !== undefined && raw !== null && String(raw).trim()) return String(raw).trim();
    const value = activity?.value;
    return String(value ?? '0').trim() || '0';
}

function resolveAmountHuman(activity: any): string {
    const value = activity?.value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    const raw = activity?.rawContract?.value;
    const decimals = Number(activity?.rawContract?.decimal);
    if (raw !== undefined && raw !== null && Number.isFinite(decimals)) {
        const rawBig = BigInt(String(raw || '0'));
        const scale = 10n ** BigInt(Math.max(0, decimals));
        const whole = rawBig / scale;
        const fraction = rawBig % scale;
        if (fraction === 0n) return whole.toString();
        const fractionText = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
        return `${whole.toString()}.${fractionText}`;
    }
    return String(value ?? '0');
}

export function resolveDepositConfirmations(activity: any, latestBlock?: number | null): number {
    const direct = Number(activity?.confirmations);
    if (Number.isFinite(direct) && direct >= 0) {
        return Math.max(0, Math.floor(direct));
    }

    const activityBlock = parseBlockNumber(activity?.blockNum || activity?.blockNumber);
    if (activityBlock === null) return 0;

    if (typeof latestBlock === 'number' && Number.isFinite(latestBlock) && latestBlock >= activityBlock) {
        return Math.max(0, Math.floor(latestBlock - activityBlock + 1));
    }

    return 1;
}

async function resolveUserIdFromSender(address?: string | null): Promise<string | null> {
    const normalized = normalizeAddress(address || '');
    if (!normalized) return null;
    const user = await prisma.user.findFirst({
        where: {
            walletAddress: {
                equals: normalized,
                mode: 'insensitive',
            },
        },
        select: { privyDid: true },
    });
    return user?.privyDid || null;
}

async function processDepositActivity(
    activity: any,
    source: 'webhook' | 'reconcile',
    stats: DepositWatchStats,
    latestBlock?: number | null,
): Promise<void> {
    const paymentAddress = normalizeAddress(env.credits.paymentAddress || '');
    const toAddress = normalizeAddress(activity?.toAddress || activity?.to || activity?.recipient || '');
    if (!paymentAddress || toAddress !== paymentAddress) {
        increment(stats, 'skipped');
        return;
    }
    const asset = supportedAssetByToken(activity?.rawContract?.address, activity?.asset);
    if (!asset) {
        increment(stats, 'unsupportedAsset');
        return;
    }
    const userId = await resolveUserIdFromSender(activity?.fromAddress || activity?.from || activity?.sender || activity?.walletAddress);
    if (!userId) {
        increment(stats, 'unmatchedUser');
        return;
    }

    increment(stats, 'processed');
    const result = await ingestCreditDeposit({
        userId,
        assetSymbol: asset.symbol,
        txHash: String(activity?.hash || '').trim().toLowerCase(),
        logIndex: stableLogIndex(activity),
        amountRaw: resolveAmountRaw(activity),
        amountHuman: resolveAmountHuman(activity),
        fromAddress: activity?.fromAddress || activity?.from || activity?.sender || null,
        toAddress: activity?.toAddress || activity?.to || activity?.recipient || null,
        tokenAddress: activity?.rawContract?.address || asset.tokenAddress || null,
        confirmations: resolveDepositConfirmations(activity, latestBlock),
        requiredConfirmations: asset.requiredConfirmations,
        metadata: {
            source,
            network: activity?.network || 'base-mainnet',
            category: activity?.category || null,
            blockNum: activity?.blockNum || null,
            uniqueId: activity?.uniqueId || null,
        },
    });

    if (result.status === 'credited') increment(stats, 'credited', result.depositIds.length || 1);
    else if (result.status === 'duplicate') increment(stats, 'duplicate');
    else if (result.status === 'below_minimum') increment(stats, 'belowMinimum');
    else if (result.status === 'confirming') increment(stats, 'confirming');
}

export async function processCreditDepositWebhookPayload(payload: any, network?: string | null) {
    const stats = createStats();
    if (!env.credits.enabled) return stats;
    if (!isBaseNetwork(network || payload?.event?.network || payload?.network)) return stats;

    const activities = Array.isArray(payload?.event?.activity)
        ? payload.event.activity
        : payload?.event?.activity
            ? [payload.event.activity]
            : [];

    for (const activity of activities) {
        try {
            await processDepositActivity(
                { ...activity, network: network || payload?.event?.network || payload?.network },
                'webhook',
                stats,
            );
        } catch (error: any) {
            increment(stats, 'errors');
            logger.error(LogCode.DB_TRANSACTION_FAILED, '[CreditDepositWebhook] failed to ingest deposit activity', {
                error: error?.message || String(error),
                hash: activity?.hash,
                asset: activity?.asset,
            });
        }
    }

    const maxBlock = activities
        .map((activity: any) => parseBlockNumber(activity?.blockNum || activity?.blockNumber))
        .filter((value: number | null): value is number => value !== null)
        .reduce((max: number, value: number) => Math.max(max, value), 0);

    await updateCreditDepositWatcherState({
        lastWebhookBlock: maxBlock > 0 ? toHexBlock(maxBlock) : undefined,
        touchedBy: 'webhook',
        statDeltas: stats,
    }).catch(() => undefined);

    return stats;
}

function normalizeIncomingTransfers(transfers: AssetTransfer[]): AssetTransfer[] {
    const paymentAddress = normalizeAddress(env.credits.paymentAddress || '');
    return transfers.filter((transfer) => {
        const toAddress = normalizeAddress(transfer.to);
        if (!paymentAddress || toAddress !== paymentAddress) return false;
        return Boolean(supportedAssetByToken(transfer.rawContract?.address, transfer.asset));
    });
}

export async function runCreditDepositReconciliation() {
    const stats = createStats();
    if (!env.credits.enabled || !env.credits.paymentAddress) {
        return {
            latestBlock: null,
            cursorBlock: null,
            stats,
        };
    }

    const latestBlock = await getBlockNumber(env.credits.chainId);
    const watcherKey = `credits:${env.credits.chainId}:${normalizeAddress(env.credits.paymentAddress)}`;
    const existing = await prisma.creditDepositWatcherState.findUnique({
        where: { watcherKey },
    });
    const overlap = Math.max(0, env.credits.reconciliationOverlapBlocks || 0);
    const backfill = Math.max(10, env.credits.reconciliationBackfillBlocks || 2000);
    const cursorNumber = parseBlockNumber(existing?.cursorBlock);
    const fromBlockNumber = cursorNumber !== null
        ? Math.max(0, cursorNumber - overlap)
        : Math.max(0, latestBlock - backfill);
    const transfers = await getAssetTransfers(
        normalizeAddress(env.credits.paymentAddress),
        'base',
        {
            fromBlock: toHexBlock(fromBlockNumber),
            toBlock: toHexBlock(latestBlock),
            maxCount: 500,
            order: 'asc',
            category: ['erc20'],
            contractAddresses: env.credits.supportedAssets
                .map((asset) => normalizeAddress(asset.tokenAddress || ''))
                .filter(Boolean),
            source: 'credit_deposit_reconcile',
        },
    );

    for (const transfer of normalizeIncomingTransfers(transfers || [])) {
        try {
            await processDepositActivity({
                ...transfer,
                fromAddress: transfer.from,
                toAddress: transfer.to,
                network: 'base-mainnet',
            }, 'reconcile', stats, latestBlock);
        } catch (error: any) {
            increment(stats, 'errors');
            logger.error(LogCode.DB_TRANSACTION_FAILED, '[CreditDepositReconcile] failed to ingest transfer', {
                error: error?.message || String(error),
                hash: transfer.hash,
                asset: transfer.asset,
            });
        }
    }

    const cursorBlock = toHexBlock(latestBlock);
    await updateCreditDepositWatcherState({
        cursorBlock,
        touchedBy: 'reconcile',
        statDeltas: stats,
    }).catch(() => undefined);

    return {
        latestBlock,
        cursorBlock,
        stats,
    };
}

export async function ensureCreditDepositWebhookRegistration(): Promise<boolean> {
    if (!env.credits.enabled || !env.credits.paymentAddress) return false;
    try {
        return await addAddressToWebhook(env.credits.paymentAddress, env.credits.chainId);
    } catch (error: any) {
        logger.error(LogCode.API_NOTIFY_FAILED, '[CreditDepositWatcher] failed to register payment address with Alchemy webhook', {
            error: error?.message || String(error),
            paymentAddress: env.credits.paymentAddress,
            chainId: env.credits.chainId,
        });
        return false;
    }
}

async function runScheduledReconciliation(reason: 'startup' | 'interval') {
    try {
        const result = await runCreditDepositReconciliation();
        logger.info(LogCode.SYS_INFO, '[CreditDepositWatcher] reconciliation completed', {
            reason,
            latestBlock: result.latestBlock,
            cursorBlock: result.cursorBlock,
            stats: result.stats,
        });
    } catch (error: any) {
        logger.error(LogCode.DB_TRANSACTION_FAILED, '[CreditDepositWatcher] reconciliation failed', {
            reason,
            error: error?.message || String(error),
        });
    }
}

export async function startCreditDepositWatcherService(): Promise<void> {
    if (!env.credits.enabled || !env.credits.paymentAddress) {
        logger.info(LogCode.SYS_INFO, '[CreditDepositWatcher] disabled: credits billing or payment address not configured');
        return;
    }

    await ensureCreditDepositWebhookRegistration();
    await runScheduledReconciliation('startup');

    if (reconciliationTimer) {
        clearInterval(reconciliationTimer);
        reconciliationTimer = null;
    }

    const intervalMs = Math.max(60_000, Number(env.credits.reconciliationIntervalMinutes || 5) * 60_000);
    reconciliationTimer = setInterval(() => {
        void runScheduledReconciliation('interval');
    }, intervalMs);

    logger.info(LogCode.SYS_STARTUP, '[CreditDepositWatcher] started', {
        paymentAddress: env.credits.paymentAddress,
        chainId: env.credits.chainId,
        intervalMinutes: env.credits.reconciliationIntervalMinutes,
    });
}

export function stopCreditDepositWatcherService(): void {
    if (reconciliationTimer) {
        clearInterval(reconciliationTimer);
        reconciliationTimer = null;
    }
}
