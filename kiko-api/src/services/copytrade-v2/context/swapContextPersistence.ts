import { buildSwapExecutionContext } from './contextBuilder.js';
import { putContext } from './contextStore.js';
import { setCachedSinglePoolWinnerHint } from '../../dex/directSwap/cache.js';

export async function persistSwapExecutionContext(params: {
  chainId: number;
  txHash: string;
  txFrom?: string;
  txTo?: string;
  txInput?: string;
  txValue?: string;
  receiptLogs?: Array<{ topics: string[]; address: string; data: string }>;
  swap: any;
  targetWallet?: string;
  detectedAt?: number;
}): Promise<void> {
  try {
    const explicitTxInput = shouldPreferExplicitTxField(params.txInput) ? params.txInput : undefined;
    const explicitTxValue = shouldPreferExplicitTxField(params.txValue) ? params.txValue : undefined;
    const ctx = buildSwapExecutionContext({
      tx: {
        hash: params.txHash,
        to: params.txTo || params.swap?.router || '',
        input: explicitTxInput || params.swap?.sourceTxInput || '0x',
        value: explicitTxValue || params.swap?.sourceTxValue || '0x0',
      },
      receipt: {
        logs: params.receiptLogs || [],
      },
      decodedSwap: params.swap,
      chainId: params.chainId,
      targetWallet: params.targetWallet,
      detectedAt: params.detectedAt,
    });
    await putContext(ctx);

    const hasUsableHint = ctx.resolvedPoolHint?.poolAddress
      || (ctx.resolvedPoolHint?.v4PoolKey?.currency0 && ctx.resolvedPoolHint?.v4PoolKey?.currency1);
    if (hasUsableHint && ctx.tokenIn && ctx.tokenOut && ctx.chainId) {
      await setCachedSinglePoolWinnerHint(
        ctx.chainId,
        ctx.tokenIn,
        ctx.tokenOut,
        ctx.resolvedPoolHint as NonNullable<typeof ctx.resolvedPoolHint>,
        300,
      ).catch(() => undefined);
    }
  } catch {
    // best-effort only
  }
}

function shouldPreferExplicitTxField(value?: string | null): boolean {
  const normalized = String(value || '').trim();
  return normalized.length > 0 && normalized !== '0x' && normalized !== '0x0';
}
