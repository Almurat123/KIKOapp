import { emitCopytradeDomainAudit } from '../audit/copytradeDomainAudit.js';
import { persistPendingExitFinalityState } from './persistence.js';

export async function handlePendingExitFinality(params: {
  settledExitResult: {
    finalityState: string;
    txHash?: string | null;
    allTxHashes?: string[];
    finalityReasonCode?: string;
    error?: string;
  };
  runtimeContext: unknown;
  userId: string;
  chainId: number;
  tokenAddress: string;
  targetWallet?: string | null;
  exitReason: string;
  positions: Array<any>;
}): Promise<boolean> {
  if (params.settledExitResult.finalityState !== 'pending_visibility' || !params.settledExitResult.txHash) {
    return false;
  }

  emitCopytradeDomainAudit('exit_finality_pending', {
    runtimeContext: params.runtimeContext as any,
    extra: {
      userId: params.userId,
      chainId: params.chainId,
      tokenAddress: params.tokenAddress,
      targetWallet: params.targetWallet || null,
      executionTxHash: params.settledExitResult.txHash,
      canonicalTxHash: params.settledExitResult.txHash || params.settledExitResult.allTxHashes?.[0] || null,
      allTxHashes: params.settledExitResult.allTxHashes || [],
      adjudicatedState: params.settledExitResult.finalityState,
      adjudicatedReason: params.settledExitResult.finalityReasonCode || params.settledExitResult.error || null,
    },
  });

  await persistPendingExitFinalityState({
    positions: params.positions as any,
    targetWallet: params.targetWallet,
    exitReason: params.exitReason,
    reasonCode: `exit_finality_${params.settledExitResult.finalityState}:${params.settledExitResult.finalityReasonCode || 'unknown'}`,
    txHash: params.settledExitResult.txHash,
  });

  return true;
}