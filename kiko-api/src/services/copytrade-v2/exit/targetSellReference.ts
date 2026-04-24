export interface MirrorSellSourceAnchor {
  sourceTxHash?: string;
  sourceTokenIn: string;
  sourceTokenOut: string;
  sourceAmountIn: string;
  sourceAmountOut: string;
  reasonCode: 'target_sell_reference_ready';
}

function parsePositiveBigInt(value: unknown): bigint {
  const raw = String(value ?? '').trim();
  if (!raw || !/^\d+$/.test(raw)) return 0n;
  try {
    const parsed = BigInt(raw);
    return parsed > 0n ? parsed : 0n;
  } catch {
    return 0n;
  }
}

export function buildMirrorSellSourceAnchor(input: {
  sourceTxHash?: string | null;
  tokenIn?: string | null;
  tokenOut?: string | null;
  amountIn?: string | number | bigint | null;
  amountOut?: string | number | bigint | null;
}): MirrorSellSourceAnchor | null {
  const sourceTokenIn = String(input.tokenIn || '').trim();
  const sourceTokenOut = String(input.tokenOut || '').trim();
  const sourceAmountIn = parsePositiveBigInt(input.amountIn);
  const sourceAmountOut = parsePositiveBigInt(input.amountOut);
  if (!sourceTokenIn || !sourceTokenOut || sourceAmountIn <= 0n || sourceAmountOut <= 0n) {
    return null;
  }

  const sourceTxHash = String(input.sourceTxHash || '').trim();
  return {
    sourceTxHash: sourceTxHash || undefined,
    sourceTokenIn,
    sourceTokenOut,
    sourceAmountIn: sourceAmountIn.toString(),
    sourceAmountOut: sourceAmountOut.toString(),
    reasonCode: 'target_sell_reference_ready',
  };
}

export function coerceMirrorSellSourceAnchor(value: unknown): MirrorSellSourceAnchor | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  return buildMirrorSellSourceAnchor({
    sourceTxHash: record.sourceTxHash as string | undefined,
    tokenIn: record.sourceTokenIn as string | undefined,
    tokenOut: record.sourceTokenOut as string | undefined,
    amountIn: record.sourceAmountIn as string | undefined,
    amountOut: record.sourceAmountOut as string | undefined,
  });
}
