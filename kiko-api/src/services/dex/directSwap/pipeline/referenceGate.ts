export function computeMinReasonable(referenceQuote: bigint, deviationBps: number): bigint {
  if (referenceQuote <= 0n) return 0n;
  const safeBps = Math.min(Math.max(Number(deviationBps || 0), 0), 5000);
  return referenceQuote * BigInt(10000 - safeBps) / 10000n;
}

export function capReferenceQuoteByMaxInput(params: {
  referenceQuote: bigint;
  amountInWei: bigint;
  multiplier?: bigint;
}): { quote: bigint; capped: boolean } {
  const multiplier = params.multiplier ?? 1_000_000n;
  const maxReasonable = params.amountInWei * multiplier;
  if (params.referenceQuote > maxReasonable) {
    return { quote: 0n, capped: true };
  }
  return { quote: params.referenceQuote, capped: false };
}
