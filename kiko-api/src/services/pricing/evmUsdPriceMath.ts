export interface QuotePriceMathParams {
  buyAmount: string;
  sellAmount: string;
  buyTokenDecimals: number;
  sellTokenDecimals: number;
}

function toFinitePositiveInteger(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

export function computeUsdPriceFromQuote(params: QuotePriceMathParams): number {
  const buyAmount = Number(params.buyAmount || 0);
  const sellAmount = Number(params.sellAmount || 0);
  const buyTokenDecimals = toFinitePositiveInteger(params.buyTokenDecimals, 6);
  const sellTokenDecimals = toFinitePositiveInteger(params.sellTokenDecimals, 18);

  if (!Number.isFinite(buyAmount) || !Number.isFinite(sellAmount) || buyAmount <= 0 || sellAmount <= 0) {
    return 0;
  }

  const buyTokenHuman = buyAmount / Math.pow(10, buyTokenDecimals);
  const sellTokenHuman = sellAmount / Math.pow(10, sellTokenDecimals);
  if (!Number.isFinite(buyTokenHuman) || !Number.isFinite(sellTokenHuman) || buyTokenHuman <= 0 || sellTokenHuman <= 0) {
    return 0;
  }

  return buyTokenHuman / sellTokenHuman;
}
