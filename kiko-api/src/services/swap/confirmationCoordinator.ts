import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import {
    acquireLock as cacheAcquireLock,
    getJson as cacheGetJson,
    releaseLock as cacheReleaseLock,
    setJson as cacheSetJson,
} from '../../cache/cacheClient.js';
import { callRpc, getTransactionByHash, getTransactionReceipt } from '../rpcManager.js';
import { sendTransaction } from '../privyWallet.js';
import { setOrderMetadata } from '../order-runtime/context.js';
import { hydrateSharedAdjudicatedSnapshot } from '../order-runtime/adjudicator/service.js';
import { resolveTxFinalState } from '../order-runtime/adjudicator/finalState.js';
import { reportReceiptSeen, reportTxByHashSeen } from '../order-runtime/adjudicator/service.js';
import type { OrderRuntimeContext } from '../order-runtime/types.js';
import { waitForSolanaTransactionConfirmation } from '../solana/confirmation/solanaConfirmationCoordinator.js';
import { waitForReplacementVisibility } from './replacementVisibilityGate.js';

export type ConfirmationKind = 'confirmed_success' | 'confirmed_failed' | 'timeout' | 'uncertain';

export interface ConfirmationOutcome {
    success: boolean;
    kind: ConfirmationKind;
    reason?: string;
    receipt?: any | null;
    visible?: boolean;
}

const confirmationInflight = new Map<string, Promise<ConfirmationOutcome>>();
const CONFIRMATION_RESULT_TTL_SEC = Math.max(30, Number(process.env.COPYTRADE_CONFIRMATION_RESULT_TTL_SEC || '300'));
const CONFIRMATION_UNCERTAIN_TTL_SEC = Math.max(5, Number(process.env.COPYTRADE_CONFIRMATION_UNCERTAIN_TTL_SEC || '15'));
const CONFIRMATION_LOCK_WAIT_POLL_MS = Math.max(250, Number(process.env.COPYTRADE_CONFIRMATION_LOCK_WAIT_POLL_MS || '1000'));

const confirmationDeps = {
    cacheAcquireLock,
    cacheGetJson,
    cacheReleaseLock,
    cacheSetJson,
    getTransactionByHash,
    getTransactionReceipt,
    hydrateSharedAdjudicatedSnapshot,
    resolveTxFinalState,
    sleep,
    setTimeout: globalThis.setTimeout.bind(globalThis),
    sendTransaction,
    callRpc,
    waitForReplacementVisibility,
};

function buildConfirmationInflightKey(chainId: number, txHash: string): string {
    return `${chainId}:${String(txHash || '').toLowerCase()}`;
}

function buildConfirmationCacheKey(chainId: number, txHash: string): string {
    return `copytrade:confirmation_outcome:${chainId}:${String(txHash || '').toLowerCase()}`;
}

function buildConfirmationLockKey(chainId: number, txHash: string): string {
    return `copytrade:confirmation_lock:${chainId}:${String(txHash || '').toLowerCase()}`;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isReceiptSuccess(receipt: any): boolean {
    const status = receipt?.status;
    return status === 1 || status === '0x1' || status === 1n;
}

async function resolveReceiptOutcome(chainId: number, txHash: string): Promise<ConfirmationOutcome | null> {
    const receipt = await confirmationDeps.getTransactionReceipt(chainId, txHash).catch(() => null);
    if (!receipt) return null;

    const success = isReceiptSuccess(receipt);
    reportReceiptSeen({
        chainId,
        txHash,
        success,
        blockNumber: receipt?.blockNumber ? String(receipt.blockNumber) : undefined,
        source: 'rpc_receipt'
    });

    if (success) {
        logger.info(LogCode.EXE_TX_CONFIRMED, `[ConfirmWait] Transaction confirmed: ${txHash}`);
        return { success: true, kind: 'confirmed_success', receipt, visible: true };
    }

    const reason = String(receipt?.revertReason || receipt?.reason || receipt?.status || 'transaction_reverted');
    logger.error(LogCode.EXE_TX_REVERTED, `[ConfirmWait] Transaction REVERTED: ${txHash}`, { reason });
    return { success: false, kind: 'confirmed_failed', reason, receipt, visible: true };
}

function sanitizeConfirmationOutcome(outcome: ConfirmationOutcome): ConfirmationOutcome {
    return {
        success: outcome.success,
        kind: outcome.kind,
        reason: outcome.reason,
        visible: outcome.visible,
        receipt: null,
    };
}

async function getCachedConfirmationOutcome(
    chainId: number,
    txHash: string,
    options?: { includeUncertain?: boolean }
): Promise<ConfirmationOutcome | null> {
    const cached = await confirmationDeps.cacheGetJson<ConfirmationOutcome>(buildConfirmationCacheKey(chainId, txHash)).catch(() => null);
    if (!cached) return null;
    const sanitized = sanitizeConfirmationOutcome(cached);
    if (options?.includeUncertain === false && (sanitized.kind === 'uncertain' || sanitized.kind === 'timeout')) {
        return null;
    }
    return sanitized;
}

async function persistConfirmationOutcome(chainId: number, txHash: string, outcome: ConfirmationOutcome): Promise<void> {
    const ttlSec = outcome.kind === 'confirmed_success' || outcome.kind === 'confirmed_failed'
        ? CONFIRMATION_RESULT_TTL_SEC
        : CONFIRMATION_UNCERTAIN_TTL_SEC;
    await confirmationDeps.cacheSetJson(buildConfirmationCacheKey(chainId, txHash), sanitizeConfirmationOutcome(outcome), ttlSec).catch(() => { });
}

async function waitForSharedCachedOutcome(params: {
    chainId: number;
    txHash: string;
    deadlineMs: number;
    includeUncertain?: boolean;
}): Promise<ConfirmationOutcome | null> {
    while (Date.now() < params.deadlineMs) {
        const cached = await getCachedConfirmationOutcome(params.chainId, params.txHash, {
            includeUncertain: params.includeUncertain,
        });
        if (cached) return cached;
        await confirmationDeps.sleep(CONFIRMATION_LOCK_WAIT_POLL_MS);
    }
    return getCachedConfirmationOutcome(params.chainId, params.txHash, {
        includeUncertain: params.includeUncertain,
    });
}

export async function waitForTransactionConfirmation(params: {
    txHash: string;
    chainId: number;
    dexName: string;
    timeoutMs?: number;
    pollMs?: number;
    forceRefresh?: boolean;
    allowCachedUncertain?: boolean;
}): Promise<ConfirmationOutcome> {
    const inflightKey = buildConfirmationInflightKey(params.chainId, params.txHash);
    const deadlineMs = Date.now() + Math.max(500, Number(params.timeoutMs ?? 60000));
    const includeUncertain = params.allowCachedUncertain !== false;
    const cached = params.forceRefresh
        ? null
        : await getCachedConfirmationOutcome(params.chainId, params.txHash, { includeUncertain });
    if (cached) {
        logger.info(LogCode.SYS_INFO, '[ConfirmWait] Reusing cached confirmation outcome', {
            chainId: params.chainId,
            txHash: params.txHash,
            dexName: params.dexName,
            kind: cached.kind,
        });
        return cached;
    }
    await confirmationDeps.hydrateSharedAdjudicatedSnapshot({
        chainId: params.chainId,
        txHash: params.txHash,
    }).catch(() => null);
    const existing = confirmationInflight.get(inflightKey);
    if (existing) {
        logger.info(LogCode.SYS_INFO, '[ConfirmWait] Reusing inflight confirmation promise', {
            chainId: params.chainId,
            txHash: params.txHash,
            dexName: params.dexName
        });
        return await existing;
    }

    const task = (async () => {
        const lockKey = buildConfirmationLockKey(params.chainId, params.txHash);
        const lockValue = `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
        const lockTtlSec = Math.max(5, Math.ceil(Math.max(500, Number(params.timeoutMs ?? 60000)) / 1000) + 5);
        const acquired = await confirmationDeps.cacheAcquireLock(lockKey, lockTtlSec, lockValue).catch(() => false);

        if (!acquired) {
            logger.info(LogCode.SYS_INFO, '[ConfirmWait] Waiting on distributed confirmation lock', {
                chainId: params.chainId,
                txHash: params.txHash,
                dexName: params.dexName,
            });
            const shared = await waitForSharedCachedOutcome({
                chainId: params.chainId,
                txHash: params.txHash,
                deadlineMs,
                includeUncertain,
            });
            if (shared) return shared;
            logger.warn(LogCode.SYS_INFO, '[ConfirmWait] Shared confirmation wait timed out without cached outcome', {
                chainId: params.chainId,
                txHash: params.txHash,
            });
            return {
                success: false,
                kind: 'uncertain',
                reason: 'shared_confirmation_timeout',
                visible: true,
                receipt: null,
            } satisfies ConfirmationOutcome;
        }

        try {
            const remainingTimeoutMs = Math.max(500, deadlineMs - Date.now());
            const outcome = await waitForTransactionConfirmationUncached({
                ...params,
                timeoutMs: remainingTimeoutMs,
            });
            await persistConfirmationOutcome(params.chainId, params.txHash, outcome);
            return outcome;
        } finally {
            await confirmationDeps.cacheReleaseLock(lockKey, lockValue).catch(() => { });
        }
    })()
        .finally(() => {
            const current = confirmationInflight.get(inflightKey);
            if (current === task) {
                confirmationInflight.delete(inflightKey);
            }
        });
    confirmationInflight.set(inflightKey, task);
    return await task;
}

async function waitForTransactionConfirmationUncached(params: {
    txHash: string;
    chainId: number;
    dexName: string;
    timeoutMs?: number;
    pollMs?: number;
}): Promise<ConfirmationOutcome> {
    const { txHash, chainId } = params;
    if (chainId === 900) {
        return await waitForSolanaTransactionConfirmation({
            txHash,
            chainId,
            timeoutMs: params.timeoutMs,
            pollMs: params.pollMs
        });
    }
    const timeoutMs = Math.max(500, Number(params.timeoutMs ?? 60000));
    const pollMs = Math.max(250, Number(params.pollMs ?? 2000));
    const startedAt = Date.now();
    let sawVisibility = false;

    logger.info(LogCode.SYS_INFO, `[ConfirmWait] Waiting for confirmation: ${txHash} on ${chainId}`);

    while (Date.now() - startedAt < timeoutMs) {
        const finalState = confirmationDeps.resolveTxFinalState({ chainId, txHash });
        if (finalState.success) {
            logger.info(LogCode.EXE_TX_CONFIRMED, `[ConfirmWait] Transaction confirmed: ${txHash}`);
            return { success: true, kind: 'confirmed_success', visible: true };
        }
        if (finalState.failed) {
            const reason = finalState.reasonCode || 'transaction_reverted';
            logger.error(LogCode.EXE_TX_REVERTED, `[ConfirmWait] Transaction REVERTED: ${txHash}`, { reason });
            return { success: false, kind: 'confirmed_failed', reason, visible: finalState.visible };
        }

        const receiptOutcome = await resolveReceiptOutcome(chainId, txHash);
        if (receiptOutcome) return receiptOutcome;

        const alreadyVisible = sawVisibility || finalState.visible || finalState.accepted;
        if (!alreadyVisible) {
            const tx = await confirmationDeps.getTransactionByHash(chainId, txHash).catch(() => null);
            if (tx?.hash) {
                sawVisibility = true;
                reportTxByHashSeen({
                    chainId,
                    txHash,
                    from: tx.from || undefined,
                    blockNumber: tx.blockNumber || undefined,
                    source: 'rpc_tx'
                });
            }
        }

        await confirmationDeps.sleep(pollMs);
    }

    const finalState = confirmationDeps.resolveTxFinalState({ chainId, txHash });
    if (finalState.success) {
        logger.info(LogCode.EXE_TX_CONFIRMED, `[ConfirmWait] Transaction confirmed: ${txHash}`);
        return { success: true, kind: 'confirmed_success', visible: true };
    }
    if (finalState.failed) {
        const reason = finalState.reasonCode || 'transaction_reverted';
        logger.error(LogCode.EXE_TX_REVERTED, `[ConfirmWait] Transaction REVERTED: ${txHash}`, { reason });
        return { success: false, kind: 'confirmed_failed', reason, visible: finalState.visible };
    }

    const trailingReceipt = await resolveReceiptOutcome(chainId, txHash);
    if (trailingReceipt) return trailingReceipt;

    let trailingVisible = sawVisibility || finalState.visible || finalState.accepted;
    if (!trailingVisible) {
        const trailingTx = await confirmationDeps.getTransactionByHash(chainId, txHash).catch(() => null);
        trailingVisible = Boolean(trailingTx?.hash);
    }
    const visible = trailingVisible;
    const reason = visible ? 'tx_broadcast_unconfirmed' : 'Transaction confirmation timeout';
    logger.warn(LogCode.SYS_INFO, `[ConfirmWait] Timeout waiting for ${txHash} confirmation`, {
        chainId,
        visible,
        reason
    });
    return {
        success: false,
        kind: visible ? 'uncertain' : 'timeout',
        reason,
        visible
    };
}

export const __confirmationCoordinatorTest = {
    setHooks(hooks: Partial<typeof confirmationDeps>): void {
        Object.assign(confirmationDeps, hooks);
    },
    resetHooks(): void {
        confirmationDeps.cacheAcquireLock = cacheAcquireLock;
        confirmationDeps.cacheGetJson = cacheGetJson;
        confirmationDeps.cacheReleaseLock = cacheReleaseLock;
        confirmationDeps.cacheSetJson = cacheSetJson;
        confirmationDeps.getTransactionByHash = getTransactionByHash;
        confirmationDeps.getTransactionReceipt = getTransactionReceipt;
        confirmationDeps.resolveTxFinalState = resolveTxFinalState;
        confirmationDeps.sleep = sleep;
        confirmationDeps.setTimeout = globalThis.setTimeout.bind(globalThis);
        confirmationDeps.sendTransaction = sendTransaction;
        confirmationDeps.callRpc = callRpc;
        confirmationDeps.waitForReplacementVisibility = waitForReplacementVisibility;
        confirmationInflight.clear();
    }
};

export function scheduleSpeedUp(params: {
    txHash: string;
    chainId: number;
    userId: string;
    accessToken: string;
    speedUpAfterMs: number;
    speedUpBumpBps?: number;
    replacementScheduleMs?: number[];
    replacementBumpBps?: number[];
    mevProtection?: boolean;
    runtimeContext?: OrderRuntimeContext;
    replacementAttempt?: number;
    tx: {
        to: string;
        data: string;
        value: string;
        chainId: number;
        gas?: string;
        maxFeePerGas?: string;
        maxPriorityFeePerGas?: string;
        gasPrice?: string;
    };
}): void {
    const replacementAttempt = Math.max(0, Number(params.replacementAttempt ?? 0));
    const scheduleMs = params.replacementScheduleMs?.[replacementAttempt] ?? params.speedUpAfterMs;
    const bumpBpsForAttempt = params.replacementBumpBps?.[replacementAttempt] ?? params.speedUpBumpBps;
    if (!scheduleMs || scheduleMs <= 0) {
        return;
    }

    confirmationDeps.setTimeout(async () => {
        try {
            const finalState = resolveTxFinalState({ chainId: params.chainId, txHash: params.txHash });
            if (finalState.terminal) return;

            const receipt = await confirmationDeps.getTransactionReceipt(params.chainId, params.txHash).catch(() => null);
            if (receipt) return;

            const pendingTx = await confirmationDeps.getTransactionByHash(params.chainId, params.txHash).catch(() => null);
            const nonceHex = pendingTx?.nonce;
            if (!nonceHex) {
                logger.warn(LogCode.SYS_INFO, 'SpeedUp skipped: pending tx nonce not found', { txHash: params.txHash, chainId: params.chainId });
                return;
            }
            const sender = String(pendingTx?.from || '').toLowerCase();
            if (sender) {
                const latestNonceHex = await confirmationDeps.callRpc<string>(
                    params.chainId,
                    'eth_getTransactionCount',
                    [sender, 'latest'],
                    { strategy: 'fast', importance: 'critical' }
                ).catch(() => null);
                if (latestNonceHex) {
                    const latestNonce = BigInt(latestNonceHex);
                    const targetNonce = BigInt(nonceHex);
                    if (latestNonce > targetNonce) {
                        logger.info(LogCode.SYS_INFO, 'SpeedUp skipped: nonce already consumed on-chain', {
                            txHash: params.txHash,
                            chainId: params.chainId,
                            sender,
                            targetNonce: targetNonce.toString(),
                            latestNonce: latestNonce.toString()
                        });
                        return;
                    }
                }
            }

            const bumpBps = BigInt(bumpBpsForAttempt ?? 12000);
            const bump = (value: bigint) => (value * bumpBps) / 10000n;

            let maxFeePerGas = params.tx.maxFeePerGas ? BigInt(params.tx.maxFeePerGas) : undefined;
            let maxPriorityFeePerGas = params.tx.maxPriorityFeePerGas ? BigInt(params.tx.maxPriorityFeePerGas) : undefined;
            let gasPrice = params.tx.gasPrice ? BigInt(params.tx.gasPrice) : undefined;

            if (!maxFeePerGas && !maxPriorityFeePerGas && !gasPrice) {
                try {
                    const block = await confirmationDeps.callRpc<any>(params.chainId, 'eth_getBlockByNumber', ['latest', false], { strategy: 'fast', importance: 'critical' });
                    const baseFeePerGas = block?.baseFeePerGas ? BigInt(block.baseFeePerGas) : null;
                    const priorityHex = await confirmationDeps.callRpc<string>(params.chainId, 'eth_maxPriorityFeePerGas', [], { strategy: 'fast', importance: 'critical' });
                    const priorityFee = priorityHex ? BigInt(priorityHex) : null;
                    if (priorityFee) maxPriorityFeePerGas = priorityFee;
                    if (baseFeePerGas && priorityFee) maxFeePerGas = baseFeePerGas * 2n + priorityFee;
                } catch {
                    // ignore
                }
            }

            if (maxFeePerGas) maxFeePerGas = bump(maxFeePerGas);
            if (maxPriorityFeePerGas) maxPriorityFeePerGas = bump(maxPriorityFeePerGas);
            if (gasPrice) gasPrice = bump(gasPrice);

            if (params.runtimeContext) {
                setOrderMetadata(params.runtimeContext, {
                    replacementAttempt: replacementAttempt + 1,
                });
            }

            const speedUpProfile = params.tx.chainId === 8453 ? 'base-sniper' : params.tx.chainId === 56 ? 'bsc-sniper' : undefined;
            const replacementTxHash = await confirmationDeps.sendTransaction(params.userId, params.accessToken, {
                to: params.tx.to,
                data: params.tx.data,
                value: params.tx.value,
                chainId: params.tx.chainId,
                gas: params.tx.gas,
                gasPrice: gasPrice?.toString(),
                maxFeePerGas: maxFeePerGas?.toString(),
                maxPriorityFeePerGas: maxPriorityFeePerGas?.toString(),
                nonce: BigInt(nonceHex).toString(),
                txPurpose: 'speedup',
                mevProtection: params.mevProtection === true,
                runtimeContext: params.runtimeContext,
                ...(speedUpProfile ? { executionProfile: speedUpProfile } : {})
            });
            const replacementVisibility = await confirmationDeps.waitForReplacementVisibility({
                chainId: params.chainId,
                replacementTxHash,
                sender: sender || undefined,
                targetNonce: BigInt(nonceHex),
            });

            if (replacementVisibility.visible) {
                reportTxByHashSeen({
                    chainId: params.chainId,
                    txHash: replacementTxHash,
                    from: sender || undefined,
                    source: 'rpc_tx'
                });
                logger.info(LogCode.EXE_TX_BROADCAST, 'SpeedUp replacement tx visible', {
                    txHash: params.txHash,
                    chainId: params.chainId,
                    replacementTxHash,
                    replacementNonce: BigInt(nonceHex).toString(),
                    replacementAttempt: replacementAttempt + 1,
                    reasonCode: replacementVisibility.reasonCode,
                    ...replacementVisibility.metrics,
                });
                return;
            }

            logger.warn(LogCode.SYS_INFO, 'SpeedUp replacement attempted but not visible', {
                txHash: params.txHash,
                chainId: params.chainId,
                replacementTxHash,
                replacementNonce: BigInt(nonceHex).toString(),
                replacementAttempt: replacementAttempt + 1,
                reasonCode: replacementVisibility.reasonCode,
                ...replacementVisibility.metrics,
            });
            if (params.replacementScheduleMs?.[replacementAttempt + 1]) {
                scheduleSpeedUp({
                    ...params,
                    txHash: replacementTxHash,
                    replacementAttempt: replacementAttempt + 1,
                });
            }
        } catch (err: any) {
            logger.warn(LogCode.SYS_ERROR, 'SpeedUp replacement failed', {
                txHash: params.txHash,
                chainId: params.chainId,
                replacementAttempt: replacementAttempt + 1,
                error: err.message
            });
        }
    }, scheduleMs);
}

export async function monitorEvmTransaction(params: {
    txHash: string;
    chainId: number;
    dexName: string;
    expectedAmountOut: string;
    userId: string;
    messageId?: string;
}): Promise<void> {
    const { txHash, chainId, dexName, userId, messageId } = params;
    logger.info(LogCode.SYS_INFO, `[Monitor] Started tracking ${txHash} on ${chainId} (${dexName})`);

    const updateTransactionMessage = async (update: {
        status: 'success' | 'failed';
        txHash: string;
        message?: string;
        errorMessage?: string;
        isLoading?: boolean;
    }): Promise<string> => {
        let sessionId = 'legacy_session_id';
        if (!messageId) return sessionId;
        try {
            const { getMessage, updateMessage } = await import('../../repositories/chatRepository.js');
            const msg = await getMessage(messageId);
            if (!msg) return sessionId;
            sessionId = msg.sessionId || sessionId;
            const currentData = typeof msg.data === 'object' && msg.data ? msg.data : {};
            await updateMessage(messageId, {
                data: {
                    ...currentData,
                    status: update.status,
                    txHash: update.txHash,
                    message: update.message ?? currentData.message,
                    errorMessage: update.errorMessage,
                    error: update.errorMessage,
                    isLoading: update.isLoading ?? false,
                    completedAt: Date.now(),
                },
                transactionStatus: update.status,
                transactionHash: update.txHash,
                status: 'complete',
            });
        } catch (err) {
            logger.warn(LogCode.SYS_ERROR, '[Monitor] Failed to persist transaction card terminal state', {
                messageId,
                txHash,
                error: (err as Error)?.message || String(err),
            });
        }
        return sessionId;
    };

    const confirmed = await waitForTransactionConfirmation({
        txHash,
        chainId,
        dexName,
        timeoutMs: 120000,
        pollMs: 3000
    });

    if (confirmed.kind === 'confirmed_success') {
        logger.info(LogCode.EXE_TX_CONFIRMED, `[Monitor] Transaction confirmed: ${txHash}`, { dex: dexName });
        try {
            const { chatWS } = await import('../../services/chatWebSocket.js');
            const sessionId = await updateTransactionMessage({
                status: 'success',
                txHash,
                message: '✅ Transaction confirmed!',
                isLoading: false,
            });
            chatWS.broadcastToUser(userId, {
                type: 'transaction_complete',
                sessionId,
                data: {
                    messageId,
                    txHash,
                    status: 'success',
                    message: '✅ Transaction confirmed!'
                }
            });
        } catch {
            // ignore
        }
        return;
    }

    if (confirmed.kind === 'confirmed_failed') {
        logger.error(LogCode.EXE_TX_REVERTED, `[Monitor] Transaction REVERTED: ${txHash}`, {
            reason: confirmed.reason || 'transaction_reverted',
            dex: dexName
        });
        try {
            const { chatWS } = await import('../../services/chatWebSocket.js');
            const sessionId = await updateTransactionMessage({
                status: 'failed',
                txHash,
                errorMessage: confirmed.reason || 'transaction_reverted',
                isLoading: false,
            });
            chatWS.broadcastToUser(userId, {
                type: 'transaction_complete',
                sessionId,
                data: {
                    messageId,
                    txHash,
                    status: 'failed',
                    errorMessage: confirmed.reason || 'transaction_reverted'
                }
            });
        } catch {
            // ignore
        }
        return;
    }

    logger.warn(LogCode.SYS_INFO, `[Monitor] Confirmation window ended without terminal state`, {
        txHash,
        chainId,
        kind: confirmed.kind,
        reason: confirmed.reason
    });
}

export async function waitForReceipt(chainId: number, txHash: string, timeoutMs: number): Promise<any | null> {
    const outcome = await waitForTransactionConfirmation({
        txHash,
        chainId,
        dexName: 'unknown',
        timeoutMs,
        pollMs: 2000
    });
    if (outcome.kind !== 'confirmed_success') {
        return outcome.receipt || null;
    }
    return outcome.receipt || await getTransactionReceipt(chainId, txHash).catch(() => null);
}
