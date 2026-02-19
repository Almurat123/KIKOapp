import type { DirectSwapHint, HintedSourcePool } from './directSwapTypes.js';
import type { SelectedV4Pool } from './v4ExecutionPlan.js';
import {
  resolveHintedPoolFromSwapSupply,
  resolveHintedV4PoolFromSwapSupply
} from './directSwap/supplyParser.js';

export async function resolveHintedPoolFromSourceTx(
  tokenIn: string,
  tokenOut: string,
  chainId: number,
  hint?: DirectSwapHint
): Promise<HintedSourcePool | null> {
  return await resolveHintedPoolFromSwapSupply({ tokenIn, tokenOut, chainId, hint });
}

export async function resolveHintedV4PoolFromSourceTx(
  tokenIn: string,
  tokenOut: string,
  chainId: number,
  hint?: DirectSwapHint
): Promise<SelectedV4Pool | null> {
  return await resolveHintedV4PoolFromSwapSupply({ tokenIn, tokenOut, chainId, hint });
}
