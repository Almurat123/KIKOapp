import type { PendingAttributedPositionLotLike } from '../positions/pendingAttributedPositionLedger.js';
import type { PositionExitReason } from './types.js';
import type { ExitSnapshotPosition } from './exitSnapshotTypes.js';
import {
  resolveExitExecutionContext,
  type ExitContextResolverDeps,
  type ResolvedExitExecutionContext,
} from './exitContextResolver.js';

export async function resolveRetryExitExecutionContext(
  params: {
    userId: string;
    chainId: number;
    tokenAddress: string;
    exitReason: PositionExitReason;
    position: ExitSnapshotPosition;
    pendingAttributedLots?: PendingAttributedPositionLotLike[];
  },
  deps?: ExitContextResolverDeps,
): Promise<ResolvedExitExecutionContext> {
  return resolveExitExecutionContext(
    {
      userId: params.userId,
      chainId: params.chainId,
      tokenAddress: params.tokenAddress,
      exitReason: params.exitReason,
      positions: [params.position],
      pendingAttributedLots: params.pendingAttributedLots,
    },
    deps,
  );
}
