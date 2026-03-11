export type EntryDeviationCurrentPriceSource =
  | 'market_oracle_price'
  | 'local_quote_price'
  | 'reference_unavailable';

export function resolveEntryDeviationCurrentPrice(params: {
  referencePrice?: number | null;
  referencePriceSource?: EntryDeviationCurrentPriceSource | null;
  fallbackDexPrice?: number | null;
}): {
  currentPrice: number;
  currentPriceSource: EntryDeviationCurrentPriceSource;
} {
  const referencePrice = Number(params.referencePrice || 0);
  if (Number.isFinite(referencePrice) && referencePrice > 0) {
    return {
      currentPrice: referencePrice,
      currentPriceSource: params.referencePriceSource === 'local_quote_price'
        ? 'local_quote_price'
        : 'market_oracle_price',
    };
  }

  const fallbackDexPrice = Number(params.fallbackDexPrice || 0);
  if (Number.isFinite(fallbackDexPrice) && fallbackDexPrice > 0) {
    return {
      currentPrice: fallbackDexPrice,
      currentPriceSource: 'market_oracle_price',
    };
  }

  return {
    currentPrice: 0,
    currentPriceSource: 'reference_unavailable',
  };
}
