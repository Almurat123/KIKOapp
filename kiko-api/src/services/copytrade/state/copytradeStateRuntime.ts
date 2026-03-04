import { resolveCopytradeLedger } from '../ledger/copytradeLedgerService.js';
import { syncCopytradeLedgerFromLegacy } from '../ledger/copytradeLedgerRepository.js';
import { handleCopytradeStateEvent } from './copytradeStateMachine.js';
import type {
  CopytradeDomainEvent,
  CopytradeLifecycleState,
  CopytradeTransitionDecision,
} from './copytradeStateTypes.js';

function deriveLifecycleState(input: {
  lifecyclePhase?: string | null;
  openPositionCount?: number | null;
  targetFullExitVerified?: boolean;
}): CopytradeLifecycleState {
  if (input.targetFullExitVerified) {
    return 'FOLLOWER_EXIT_ARMED';
  }
  switch (input.lifecyclePhase) {
    case 'open_only':
      return 'FOLLOWER_OPEN';
    case 'pending_only':
      return 'FOLLOWER_BUY_AWAITING_CONFIRMATION';
    case 'mixed':
      return 'FOLLOWER_EXIT_ARMED';
    case 'closed_only':
      return input.openPositionCount && input.openPositionCount > 0
        ? 'FOLLOWER_CLOSED'
        : 'FOLLOWER_CLOSED_BEFORE_OPEN';
    default:
      return 'TARGET_BUY_DETECTED';
  }
}

export async function applyCopytradeStateEvent(params: {
  event: CopytradeDomainEvent;
  chainId: number;
  tokenAddress: string;
  targetWallet?: string | null;
  positionIds?: string[];
  targetFullExitVerified?: boolean;
  lastExecutionState?: string | null;
  lastExecutionReasonCode?: string | null;
  followerBuyTxHash?: string | null;
  followerExitTxHash?: string | null;
  targetSellTxHash?: string | null;
  closedAt?: Date | null;
}): Promise<CopytradeTransitionDecision> {
  const positionIds = params.positionIds?.filter(Boolean) || [];
  const ledger = positionIds.length > 0
    ? await resolveCopytradeLedger({
        chainId: params.chainId,
        tokenAddress: params.tokenAddress,
        targetWallet: params.targetWallet,
        positionIds,
      }).catch(() => null)
    : null;

  const decision = handleCopytradeStateEvent(
    {
      currentState: deriveLifecycleState({
        lifecyclePhase: ledger?.lifecyclePhase,
        openPositionCount: ledger?.metrics.openPositionCount,
        targetFullExitVerified: params.targetFullExitVerified ?? false,
      }),
      openPositionCount: ledger?.metrics.openPositionCount ?? 0,
      targetFullExitVerified: params.targetFullExitVerified ?? false,
    },
    params.event,
  );

  if (positionIds.length > 0) {
    for (const positionId of positionIds) {
      await syncCopytradeLedgerFromLegacy({
        positionId,
        targetWallet: params.targetWallet,
        lifecycleState: decision.nextState,
        targetFullExitVerified: params.targetFullExitVerified,
        lastExecutionState: params.lastExecutionState,
        lastExecutionReasonCode: params.lastExecutionReasonCode || decision.reasonCode,
        followerBuyTxHash: params.followerBuyTxHash,
        followerExitTxHash: params.followerExitTxHash,
        targetSellTxHash: params.targetSellTxHash,
        closedAt: params.closedAt,
      }).catch(() => null);
    }
  }

  return decision;
}
