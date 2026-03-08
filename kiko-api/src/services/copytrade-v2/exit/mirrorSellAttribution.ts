import { ethers } from 'ethers';
import {
  resolveAttributedPositionExitAmount,
  type AttributedPositionLike,
  isConfirmedAttributedPosition,
  type PositionAttributionReasonCode,
} from '../positions/positionAttribution.js';
import type { PendingAttributedPositionLotLike } from '../positions/pendingAttributedPositionLedger.js';

export interface MirrorSellAttributionResult<T extends AttributedPositionLike> {
  eligiblePositions: T[];
  pendingAttributedPositionIds: string[];
  pendingAttributedLotIds: string[];
  attributedAmountRaw: bigint;
  sellAmountRaw: bigint;
  reasonCode: PositionAttributionReasonCode;
  metrics: {
    openPositionCount: number;
    pendingPositionCount: number;
    pendingLotCount: number;
    onChainBalanceRaw: string;
    attributedAmountRaw: string;
    sellAmountRaw: string;
    hasExternalBalance: boolean;
  };
}

function parsePendingLotAmountRaw(lot: PendingAttributedPositionLotLike, decimals: number): bigint {
  const raw = String(lot.expectedAmountRaw || '').trim();
  if (raw && /^\d+$/.test(raw)) {
    return BigInt(raw);
  }
  const decimalAmount = String(lot.expectedAmountDec || '').trim();
  if (decimalAmount) {
    try {
      return ethers.parseUnits(decimalAmount, decimals);
    } catch {
      return 0n;
    }
  }
  return 0n;
}

export function resolveMirrorSellAttributedAmount<T extends AttributedPositionLike & { status?: string | null; id: string }>(params: {
  positions: T[];
  pendingLots: PendingAttributedPositionLotLike[];
  decimals: number;
  onChainBalanceRaw: bigint;
}): MirrorSellAttributionResult<T> {
  const openPositions = params.positions.filter((position) => String(position.status || '') === 'open');
  const pendingPositions = params.positions.filter((position) => String(position.status || '') !== 'open');
  const recoverablePendingPositions = pendingPositions.filter((position) => isConfirmedAttributedPosition(position));
  const baseAttribution = resolveAttributedPositionExitAmount({
    positions: params.positions,
    decimals: params.decimals,
    onChainBalanceRaw: params.onChainBalanceRaw,
    allowFullBalanceFallback: params.onChainBalanceRaw > 0n && recoverablePendingPositions.length > 0,
  });
  const attributedPositionIds = new Set(baseAttribution.eligiblePositions.map((position) => position.id));

  const pendingLotMap = new Map(params.pendingLots.map((lot) => [lot.positionId, lot]));
  const pendingEligible: T[] = [];
  const pendingAttributedLotIds: string[] = [];
  const pendingAttributedPositionIds: string[] = [];
  let pendingAttributedAmountRaw = 0n;
  for (const position of params.positions) {
    if (attributedPositionIds.has(position.id)) continue;
    const lot = pendingLotMap.get(position.id);
    if (!lot || !['armed', 'sell_armed'].includes(String(lot.status || ''))) continue;
    const lotAmountRaw = parsePendingLotAmountRaw(lot, params.decimals);
    if (lotAmountRaw <= 0n) continue;
    pendingAttributedAmountRaw += lotAmountRaw;
    pendingEligible.push(position);
    pendingAttributedLotIds.push(lot.id);
    pendingAttributedPositionIds.push(position.id);
  }

  const fullBalanceFallbackApplied = baseAttribution.reasonCode === 'FULL_BALANCE_FALLBACK' && baseAttribution.sellAmountRaw > 0n;
  const attributedAmountRaw = fullBalanceFallbackApplied
    ? params.onChainBalanceRaw
    : baseAttribution.attributedAmountRaw + pendingAttributedAmountRaw;
  if (attributedAmountRaw <= 0n) {
    return {
      eligiblePositions: baseAttribution.eligiblePositions as T[],
      pendingAttributedPositionIds,
      pendingAttributedLotIds,
      attributedAmountRaw,
      sellAmountRaw: 0n,
      reasonCode: params.pendingLots.length > 0 ? 'PENDING_EXPECTED_AMOUNT_UNAVAILABLE' : baseAttribution.reasonCode,
      metrics: {
        openPositionCount: openPositions.length,
        pendingPositionCount: pendingPositions.length,
        pendingLotCount: params.pendingLots.length,
        onChainBalanceRaw: params.onChainBalanceRaw.toString(),
        attributedAmountRaw: attributedAmountRaw.toString(),
        sellAmountRaw: '0',
        hasExternalBalance: false,
      },
    };
  }

  if (params.onChainBalanceRaw <= 0n) {
    return {
      eligiblePositions: [...(baseAttribution.eligiblePositions as T[]), ...pendingEligible],
      pendingAttributedPositionIds,
      pendingAttributedLotIds,
      attributedAmountRaw,
      sellAmountRaw: 0n,
      reasonCode: pendingAttributedAmountRaw > 0n ? 'PENDING_BALANCE_NOT_VISIBLE_YET' : baseAttribution.reasonCode,
      metrics: {
        openPositionCount: openPositions.length,
        pendingPositionCount: pendingPositions.length,
        pendingLotCount: params.pendingLots.length,
        onChainBalanceRaw: params.onChainBalanceRaw.toString(),
        attributedAmountRaw: attributedAmountRaw.toString(),
        sellAmountRaw: '0',
        hasExternalBalance: false,
      },
    };
  }

  const sellAmountRaw = fullBalanceFallbackApplied
    ? params.onChainBalanceRaw
    : params.onChainBalanceRaw < attributedAmountRaw
      ? params.onChainBalanceRaw
      : attributedAmountRaw;
  const hasExternalBalance = fullBalanceFallbackApplied
    ? false
    : params.onChainBalanceRaw > attributedAmountRaw && attributedAmountRaw > 0n;
  const reasonCode: PositionAttributionReasonCode = fullBalanceFallbackApplied
    ? 'FULL_BALANCE_FALLBACK'
    : params.onChainBalanceRaw < attributedAmountRaw
      ? 'PENDING_ATTRIBUTED_AMOUNT_CLAMPED_TO_ONCHAIN_BALANCE'
      : pendingAttributedAmountRaw > 0n
        ? 'PENDING_ATTRIBUTED_AMOUNT_RESOLVED'
        : baseAttribution.reasonCode;

  return {
    eligiblePositions: [...(baseAttribution.eligiblePositions as T[]), ...pendingEligible],
    pendingAttributedPositionIds,
    pendingAttributedLotIds,
    attributedAmountRaw,
    sellAmountRaw,
    reasonCode,
    metrics: {
      openPositionCount: openPositions.length,
      pendingPositionCount: pendingPositions.length,
      pendingLotCount: params.pendingLots.length,
      onChainBalanceRaw: params.onChainBalanceRaw.toString(),
      attributedAmountRaw: attributedAmountRaw.toString(),
      sellAmountRaw: sellAmountRaw.toString(),
      hasExternalBalance,
    },
  };
}
