export type MirrorSellRatioResult = {
  applied: boolean;
  sellAmountRaw: bigint;
  ratioBps: number;
  reasonCode:
    | 'MIRROR_RATIO_APPLIED'
    | 'MIRROR_RATIO_INVALID_INPUT'
    | 'MIRROR_RATIO_NO_TARGET_BUY_BASE'
    | 'MIRROR_RATIO_TARGET_SELL_EMPTY';
};

function clampRatioBps(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 10_000) return 10_000;
  return Math.floor(value);
}

export function computeMirrorSellProportionalAmountRaw(params: {
  baseSellAmountRaw: bigint;
  targetSellAmountRaw: bigint;
  targetBuyBaseRaw: bigint;
}): MirrorSellRatioResult {
  const base = params.baseSellAmountRaw;
  const targetSell = params.targetSellAmountRaw;
  const targetBuyBase = params.targetBuyBaseRaw;

  if (base <= 0n || targetSell < 0n || targetBuyBase < 0n) {
    return {
      applied: false,
      sellAmountRaw: base > 0n ? base : 0n,
      ratioBps: 0,
      reasonCode: 'MIRROR_RATIO_INVALID_INPUT',
    };
  }
  if (targetSell === 0n) {
    return {
      applied: true,
      sellAmountRaw: 0n,
      ratioBps: 0,
      reasonCode: 'MIRROR_RATIO_TARGET_SELL_EMPTY',
    };
  }
  if (targetBuyBase <= 0n) {
    return {
      applied: false,
      sellAmountRaw: base,
      ratioBps: 0,
      reasonCode: 'MIRROR_RATIO_NO_TARGET_BUY_BASE',
    };
  }

  if (targetSell >= targetBuyBase) {
    return {
      applied: true,
      sellAmountRaw: base,
      ratioBps: 10_000,
      reasonCode: 'MIRROR_RATIO_APPLIED',
    };
  }

  let scaled = (base * targetSell) / targetBuyBase;
  if (scaled <= 0n && base > 0n) {
    // Preserve liveness for very small partial sells.
    scaled = 1n;
  }
  if (scaled > base) scaled = base;

  const ratioBpsRaw = Number((targetSell * 10_000n) / targetBuyBase);
  return {
    applied: true,
    sellAmountRaw: scaled,
    ratioBps: clampRatioBps(ratioBpsRaw),
    reasonCode: 'MIRROR_RATIO_APPLIED',
  };
}

