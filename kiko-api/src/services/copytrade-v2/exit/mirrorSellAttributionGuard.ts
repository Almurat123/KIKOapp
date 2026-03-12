import type { PendingAttributedPositionLotLike } from '../positions/pendingAttributedPositionLedger.js';

export type MirrorSellAttributedPositionLike = {
  id: string;
  status?: string | null;
  configId?: string | null;
  leaderTxHash?: string | null;
};

function hasNonEmptyText(value: unknown): boolean {
  return String(value || '').trim().length > 0;
}

export function resolveEligibleMirrorSellPositions<T extends MirrorSellAttributedPositionLike>(params: {
  positions: T[];
  expectedConfigId?: string | null;
  pendingAttributedLots?: PendingAttributedPositionLotLike[];
  verifiedLedgerPositionIds?: Iterable<string>;
}): {
  eligiblePositions: T[];
  eligiblePendingAttributedLots: PendingAttributedPositionLotLike[];
  metrics: {
    sourceMatchedPositionCount: number;
    configScopedPositionCount: number;
    leaderLinkedPositionCount: number;
    verifiedLedgerPositionCount: number;
    blockedPositionCount: number;
  };
} {
  const expectedConfigId = String(params.expectedConfigId || '').trim();
  const verifiedIds = new Set<string>();
  for (const lot of params.pendingAttributedLots || []) {
    if (lot.positionId) verifiedIds.add(lot.positionId);
  }
  for (const positionId of params.verifiedLedgerPositionIds || []) {
    if (positionId) verifiedIds.add(positionId);
  }

  let configScopedPositionCount = 0;
  let leaderLinkedPositionCount = 0;
  let verifiedLedgerPositionCount = 0;

  const eligiblePositions = params.positions.filter((position) => {
    const configMatches = !expectedConfigId || !hasNonEmptyText(position.configId) || String(position.configId) === expectedConfigId;
    if (!configMatches) {
      return false;
    }

    configScopedPositionCount += 1;
    const leaderLinked = hasNonEmptyText(position.leaderTxHash);
    const ledgerLinked = verifiedIds.has(position.id);

    if (leaderLinked) leaderLinkedPositionCount += 1;
    if (ledgerLinked) verifiedLedgerPositionCount += 1;

    return leaderLinked || ledgerLinked;
  });

  const eligiblePositionIds = new Set(eligiblePositions.map((position) => position.id));
  const eligiblePendingAttributedLots = (params.pendingAttributedLots || []).filter((lot) => eligiblePositionIds.has(lot.positionId));

  return {
    eligiblePositions,
    eligiblePendingAttributedLots,
    metrics: {
      sourceMatchedPositionCount: params.positions.length,
      configScopedPositionCount,
      leaderLinkedPositionCount,
      verifiedLedgerPositionCount,
      blockedPositionCount: Math.max(0, params.positions.length - eligiblePositions.length),
    },
  };
}
