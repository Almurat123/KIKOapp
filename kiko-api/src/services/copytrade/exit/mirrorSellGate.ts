export type MirrorSellGatePositionLike = {
  id: string;
  status?: string | null;
};

export type MirrorSellGateResult =
  | {
      allowed: false;
      reasonCode: 'MIRROR_SELL_NO_ATTRIBUTED_EXPOSURE';
      metrics: {
        matchedPositionCount: number;
        pendingPositionCount: number;
        openPositionCount: number;
      };
    }
  | {
      allowed: true;
      reasonCode:
        | 'MIRROR_SELL_ALLOWED_OPEN_EXPOSURE'
        | 'MIRROR_SELL_ALLOWED_PENDING_EXPOSURE'
        | 'MIRROR_SELL_ALLOWED_MIXED_EXPOSURE';
      metrics: {
        matchedPositionCount: number;
        pendingPositionCount: number;
        openPositionCount: number;
      };
    };

export function evaluateMirrorSellGate<T extends MirrorSellGatePositionLike>(positions: T[]): MirrorSellGateResult {
  const matchedPositionCount = positions.length;
  const openPositionCount = positions.filter((position) => String(position.status || '') === 'open').length;
  const pendingPositionCount = matchedPositionCount - openPositionCount;

  if (matchedPositionCount <= 0) {
    return {
      allowed: false,
      reasonCode: 'MIRROR_SELL_NO_ATTRIBUTED_EXPOSURE',
      metrics: {
        matchedPositionCount,
        pendingPositionCount,
        openPositionCount,
      },
    };
  }

  if (openPositionCount > 0 && pendingPositionCount > 0) {
    return {
      allowed: true,
      reasonCode: 'MIRROR_SELL_ALLOWED_MIXED_EXPOSURE',
      metrics: {
        matchedPositionCount,
        pendingPositionCount,
        openPositionCount,
      },
    };
  }

  if (openPositionCount > 0) {
    return {
      allowed: true,
      reasonCode: 'MIRROR_SELL_ALLOWED_OPEN_EXPOSURE',
      metrics: {
        matchedPositionCount,
        pendingPositionCount,
        openPositionCount,
      },
    };
  }

  return {
    allowed: true,
    reasonCode: 'MIRROR_SELL_ALLOWED_PENDING_EXPOSURE',
    metrics: {
      matchedPositionCount,
      pendingPositionCount,
      openPositionCount,
    },
  };
}

