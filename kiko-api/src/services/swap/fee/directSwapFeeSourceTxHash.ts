type DirectSwapFeeSourceTxHashInput = {
  sourceTxHash?: string;
  executionContext?: {
    sourceTxHash?: string;
    contextSnapshot?: {
      sourceTxHash?: string;
    };
  };
};

export function resolveDirectSwapFeeSourceTxHash(
  request: DirectSwapFeeSourceTxHashInput,
  sourceTxHashOverride?: string
): string | undefined {
  const candidate =
    sourceTxHashOverride
    || request.sourceTxHash
    || request.executionContext?.sourceTxHash
    || request.executionContext?.contextSnapshot?.sourceTxHash
    || undefined;

  const normalized = String(candidate || '').trim().toLowerCase();
  return normalized || undefined;
}
