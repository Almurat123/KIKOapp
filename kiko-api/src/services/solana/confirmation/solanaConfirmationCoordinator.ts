import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import { resolveTxFinalState } from '../../order-runtime/adjudicator/finalState.js';
import { reportReceiptSeen, reportRpcUncertain, reportTxByHashSeen } from '../../order-runtime/adjudicator/service.js';
import { getSolanaSignatureObservation } from './solanaConfirmationRpc.js';
import type { SolanaConfirmationOutcome } from './types.js';

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForSolanaTransactionConfirmation(params: {
    txHash: string;
    chainId: number;
    timeoutMs?: number;
    pollMs?: number;
}): Promise<SolanaConfirmationOutcome> {
    const { txHash, chainId } = params;
    const timeoutMs = Math.max(500, Number(params.timeoutMs ?? 60000));
    const pollMs = Math.max(250, Number(params.pollMs ?? 1500));
    const startedAt = Date.now();
    let sawVisibility = false;

    logger.info(LogCode.SYS_INFO, `[SolConfirmWait] Waiting for confirmation: ${txHash} on ${chainId}`);

    while (Date.now() - startedAt < timeoutMs) {
        const finalState = resolveTxFinalState({ chainId, txHash });
        if (finalState.success) {
            logger.info(LogCode.EXE_TX_CONFIRMED, `[SolConfirmWait] Transaction confirmed: ${txHash}`);
            return { success: true, kind: 'confirmed_success', visible: true };
        }
        if (finalState.failed) {
            const reason = finalState.reasonCode || 'transaction_failed';
            logger.error(LogCode.EXE_TX_REVERTED, `[SolConfirmWait] Transaction failed: ${txHash}`, { reason });
            return { success: false, kind: 'confirmed_failed', reason, visible: finalState.visible };
        }

        try {
            const observation = await getSolanaSignatureObservation(txHash);
            if (observation.found) {
                sawVisibility = true;
                reportTxByHashSeen({
                    chainId,
                    txHash,
                    blockNumber: observation.slot != null ? String(observation.slot) : undefined,
                source: 'rpc_tx'
                });
            }

            if (observation.failed) {
                reportReceiptSeen({
                    chainId,
                    txHash,
                    success: false,
                    blockNumber: observation.slot != null ? String(observation.slot) : undefined,
                    rpcError: observation.reason,
                source: 'rpc_receipt'
                });
                logger.error(LogCode.EXE_TX_REVERTED, `[SolConfirmWait] Transaction failed: ${txHash}`, {
                    reason: observation.reason
                });
                return {
                    success: false,
                    kind: 'confirmed_failed',
                    reason: observation.reason || 'transaction_failed',
                    visible: true,
                    slot: observation.slot
                };
            }

            if (observation.confirmed) {
                reportReceiptSeen({
                    chainId,
                    txHash,
                    success: true,
                    blockNumber: observation.slot != null ? String(observation.slot) : undefined,
                source: 'rpc_receipt'
                });
                logger.info(LogCode.EXE_TX_CONFIRMED, `[SolConfirmWait] Transaction confirmed: ${txHash}`);
                return {
                    success: true,
                    kind: 'confirmed_success',
                    visible: true,
                    slot: observation.slot
                };
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            reportRpcUncertain({ chainId, txHash, error: message });
            logger.warn(LogCode.SYS_INFO, '[SolConfirmWait] Signature status probe failed', {
                txHash,
                chainId,
                error: message
            });
        }

        await sleep(pollMs);
    }

    const finalState = resolveTxFinalState({ chainId, txHash });
    if (finalState.success) {
        logger.info(LogCode.EXE_TX_CONFIRMED, `[SolConfirmWait] Transaction confirmed: ${txHash}`);
        return { success: true, kind: 'confirmed_success', visible: true };
    }
    if (finalState.failed) {
        const reason = finalState.reasonCode || 'transaction_failed';
        logger.error(LogCode.EXE_TX_REVERTED, `[SolConfirmWait] Transaction failed: ${txHash}`, { reason });
        return { success: false, kind: 'confirmed_failed', reason, visible: finalState.visible };
    }

    const visible = sawVisibility || finalState.visible || finalState.accepted;
    const reason = visible ? 'signature_observed_unconfirmed' : 'Transaction confirmation timeout';
    reportRpcUncertain({ chainId, txHash, error: reason });
    logger.warn(LogCode.SYS_INFO, `[SolConfirmWait] Timeout waiting for ${txHash} confirmation`, {
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
