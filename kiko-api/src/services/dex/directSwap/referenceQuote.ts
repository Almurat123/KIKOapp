import type { ReferenceQuoteContext } from './types.js';

export interface ReferenceQuoteResult {
  amountOut: bigint;
  source: string;
}

export function pickBestReferenceQuote(candidates: ReferenceQuoteResult[]): ReferenceQuoteResult | null {
  let best: ReferenceQuoteResult | null = null;
  for (const candidate of candidates) {
    if (!best || candidate.amountOut > best.amountOut) best = candidate;
  }
  return best;
}

export function buildReferenceQuoteCacheKey(ctx: ReferenceQuoteContext): string {
  return [
    ctx.chainId,
    ctx.tokenIn.toLowerCase(),
    ctx.tokenOut.toLowerCase(),
    ctx.amountInWei.toString(),
    (ctx.recipient || '').toLowerCase(),
    ctx.enableZoraRoutes ? 'zora1' : 'zora0'
  ].join(':');
}
