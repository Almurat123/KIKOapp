import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import type { TxEvidenceSnapshot } from './types.js';

export function logAdjudicatedSnapshot(label: string, snapshot: TxEvidenceSnapshot | null | undefined): void {
  if (!snapshot) return;
  logger.info(LogCode.SYS_INFO, label, {
    orderId: snapshot.orderId || null,
    chainId: snapshot.chainId,
    canonicalTxHash: snapshot.canonicalTxHash || null,
    allTxHashes: snapshot.allTxHashes,
    adjudicatedState: snapshot.adjudicated.state,
    adjudicatedReason: snapshot.adjudicated.reasonCode,
    final: snapshot.adjudicated.final,
    sendAccepted: snapshot.send.accepted,
    txByHashSeen: snapshot.txByHash.seen,
    receiptSeen: snapshot.receipt.seen,
    receiptSuccess: snapshot.receipt.success ?? null,
    webhookSeen: snapshot.webhook.seen
  });
}
