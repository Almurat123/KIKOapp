const MAX_AUTO_EXIT_ABSOLUTE_PNL_PCT = Math.max(
  100,
  Number(process.env.COPYTRADE_MAX_AUTO_EXIT_ABSOLUTE_PNL_PCT || '100000'),
);

const MAX_AUTO_EXIT_PRICE_MULTIPLIER = Math.max(
  2,
  Number(process.env.COPYTRADE_MAX_AUTO_EXIT_PRICE_MULTIPLIER || '1000'),
);

export type AutoExitPriceGuardResult =
  | {
      allowed: true;
      reasonCode: 'AUTO_EXIT_PRICE_OK';
      metrics: {
        entryPrice: number;
        currentPrice: number;
        profitLossPct: number;
        priceMultiplier: number;
        maxAbsolutePnlPct: number;
        maxPriceMultiplier: number;
      };
    }
  | {
      allowed: false;
      reasonCode:
        | 'AUTO_EXIT_INVALID_ENTRY_PRICE'
        | 'AUTO_EXIT_ANOMALOUS_PNL'
        | 'AUTO_EXIT_ANOMALOUS_PRICE_MULTIPLIER';
      metrics: {
        entryPrice: number;
        currentPrice: number;
        profitLossPct: number;
        priceMultiplier: number;
        maxAbsolutePnlPct: number;
        maxPriceMultiplier: number;
      };
    };

export function evaluateAutoExitPriceGuard(input: {
  entryPrice: number;
  currentPrice: number;
  profitLossPct: number;
}): AutoExitPriceGuardResult {
  const entryPrice = Number(input.entryPrice);
  const currentPrice = Number(input.currentPrice);
  const profitLossPct = Number(input.profitLossPct);
  const priceMultiplier = entryPrice > 0 ? currentPrice / entryPrice : Number.POSITIVE_INFINITY;
  const metrics = {
    entryPrice,
    currentPrice,
    profitLossPct,
    priceMultiplier,
    maxAbsolutePnlPct: MAX_AUTO_EXIT_ABSOLUTE_PNL_PCT,
    maxPriceMultiplier: MAX_AUTO_EXIT_PRICE_MULTIPLIER,
  };

  if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
    return {
      allowed: false,
      reasonCode: 'AUTO_EXIT_INVALID_ENTRY_PRICE',
      metrics,
    };
  }

  if (!Number.isFinite(profitLossPct) || Math.abs(profitLossPct) > MAX_AUTO_EXIT_ABSOLUTE_PNL_PCT) {
    return {
      allowed: false,
      reasonCode: 'AUTO_EXIT_ANOMALOUS_PNL',
      metrics,
    };
  }

  if (!Number.isFinite(priceMultiplier) || priceMultiplier > MAX_AUTO_EXIT_PRICE_MULTIPLIER) {
    return {
      allowed: false,
      reasonCode: 'AUTO_EXIT_ANOMALOUS_PRICE_MULTIPLIER',
      metrics,
    };
  }

  return {
    allowed: true,
    reasonCode: 'AUTO_EXIT_PRICE_OK',
    metrics,
  };
}
