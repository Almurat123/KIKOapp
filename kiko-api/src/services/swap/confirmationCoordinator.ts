import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import { callRpc, getTransactionByHash, getTransactionReceipt } from '../rpcManager.js';
import { sendTransaction } from '../privyWallet.js';
import { resolveTxFinalState } from '../order-runtime/adjudicator/finalState.js';
import { reportReceiptSeen, reportTxByHashSeen } from '../order-runtime/adjudicator/service.js';

export type ConfirmationKind = 'confirmed_success' | 'confirmed_failed' | 'timeout' | 'uncertain';

export interface ConfirmationOutcome {
    success: boolean;
    kind: ConfirmationKind;
    reason?: string;
    receipt?: any | null;
    visible?: boolean;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isReceiptSuccess(receipt: any): boolean {
    const status = receipt?.status;
    return status === 1 || status === '0x1' || status === 1n;
}

async function resolveReceiptOutcome(chainId: number, txHash: string): Promise<ConfirmationOutcome | null> {
    const receipt = await getTransactionReceipt(chainId, txHash).catch(() => null);
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

export async function waitForTransactionConfirmation(params: {
    txHash: string;
    chainId: number;
    dexName: string;
    timeoutMs?: number;
    pollMs?: number;
}): Promise<ConfirmationOutcome> {
    const { txHash, chainId } = params;
    const timeoutMs = Math.max(500, Number(params.timeoutMs ?? 60000));
    const pollMs = Math.max(250, Number(params.pollMs ?? 2000));
    const startedAt = Date.now();
    let sawVisibility = false;

    logger.info(LogCode.SYS_INFO, `[ConfirmWait] Waiting for confirmation: ${txHash} on ${chainId}`);

    while (Date.now() - startedAt < timeoutMs) {
        const finalState = resolveTxFinalState({ chainId, txHash });
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

        const tx = await getTransactionByHash(chainId, txHash).catch(() => null);
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

        await sleep(pollMs);
    }

    const finalState = resolveTxFinalState({ chainId, txHash });
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

    const trailingTx = await getTransactionByHash(chainId, txHash).catch(() => null);
    const visible = sawVisibility || Boolean(trailingTx?.hash) || finalState.visible || finalState.accepted;
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

export function scheduleSpeedUp(params: {
    txHash: string;
    chainId: number;
    userId: string;
    accessToken: string;
    speedUpAfterMs: number;
    speedUpBumpBps?: number;
    mevProtection?: boolean;
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
    const {
        txHash,
        chainId,
        userId,
        accessToken,
        speedUpAfterMs,
        speedUpBumpBps,
        mevProtection,
        tx
    } = params;

    setTimeout(async () => {
        try {
            const finalState = resolveTxFinalState({ chainId, txHash });
            if (finalState.terminal) return;

            const receipt = await getTransactionReceipt(chainId, txHash).catch(() => null);
            if (receipt) return;

            const pendingTx = await getTransactionByHash(chainId, txHash).catch(() => null);
            const nonceHex = pendingTx?.nonce;
            if (!nonceHex) {
                logger.warn(LogCode.SYS_INFO, 'SpeedUp skipped: pending tx nonce not found', { txHash, chainId });
                return;
            }
            const sender = String(pendingTx?.from || '').toLowerCase();
            if (sender) {
                const latestNonceHex = await callRpc<string>(
                    chainId,
                    'eth_getTransactionCount',
                    [sender, 'latest'],
                    { strategy: 'fast', importance: 'critical' }
                ).catch(() => null);
                if (latestNonceHex) {
                    const latestNonce = BigInt(latestNonceHex);
                    const targetNonce = BigInt(nonceHex);
                    if (latestNonce > targetNonce) {
                        logger.info(LogCode.SYS_INFO, 'SpeedUp skipped: nonce already consumed on-chain', {
                            txHash,
                            chainId,
                            sender,
                            targetNonce: targetNonce.toString(),
                            latestNonce: latestNonce.toString()
                        });
                        return;
                    }
                }
            }

            const bumpBps = BigInt(speedUpBumpBps ?? 12000);
            const bump = (value: bigint) => (value * bumpBps) / 10000n;

            let maxFeePerGas = tx.maxFeePerGas ? BigInt(tx.maxFeePerGas) : undefined;
            let maxPriorityFeePerGas = tx.maxPriorityFeePerGas ? BigInt(tx.maxPriorityFeePerGas) : undefined;
            let gasPrice = tx.gasPrice ? BigInt(tx.gasPrice) : undefined;

            if (!maxFeePerGas && !maxPriorityFeePerGas && !gasPrice) {
                try {
                    const block = await callRpc<any>(chainId, 'eth_getBlockByNumber', ['latest', false], { strategy: 'fast', importance: 'critical' });
                    const baseFeePerGas = block?.baseFeePerGas ? BigInt(block.baseFeePerGas) : null;
                    const priorityHex = await callRpc<string>(chainId, 'eth_maxPriorityFeePerGas', [], { strategy: 'fast', importance: 'critical' });
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

            const speedUpProfile = tx.chainId === 8453 ? 'base-sniper' : tx.chainId === 56 ? 'bsc-sniper' : undefined;
            await sendTransaction(userId, accessToken, {
                to: tx.to,
                data: tx.data,
                value: tx.value,
                chainId: tx.chainId,
                gas: tx.gas,
                gasPrice: gasPrice?.toString(),
                maxFeePerGas: maxFeePerGas?.toString(),
                maxPriorityFeePerGas: maxPriorityFeePerGas?.toString(),
                nonce: BigInt(nonceHex).toString(),
                txPurpose: 'speedup',
                mevProtection: mevProtection === true,
                ...(speedUpProfile ? { executionProfile: speedUpProfile } : {})
            });

            logger.info(LogCode.EXE_TX_BROADCAST, 'SpeedUp replacement tx sent', {
                txHash,
                chainId,
                replacementNonce: BigInt(nonceHex).toString()
            });
        } catch (err: any) {
            logger.warn(LogCode.SYS_ERROR, 'SpeedUp replacement failed', { txHash, chainId, error: err.message });
        }
    }, speedUpAfterMs);
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
            let sessionId = 'legacy_session_id';
            if (messageId) {
                const { getMessage } = await import('../../repositories/chatRepository.js');
                const msg = await getMessage(messageId);
                if (msg) sessionId = msg.sessionId;
            }
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
            let sessionId = 'legacy_session_id';
            if (messageId) {
                const { getMessage } = await import('../../repositories/chatRepository.js');
                const msg = await getMessage(messageId);
                if (msg) sessionId = msg.sessionId;
            }
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
