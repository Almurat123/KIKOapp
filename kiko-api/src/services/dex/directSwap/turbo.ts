import type { DirectSwapHint, DirectSwapResult } from './types.js';

export interface TurboResolverContext {
  chainId: number;
  tokenIn: string;
  tokenOut: string;
  amountInWei: bigint;
  hint?: DirectSwapHint;
  deadlineMs: number;
}

export interface TurboResolver {
  tryResolve(ctx: TurboResolverContext): Promise<DirectSwapResult | null>;
}

export const passthroughTurboResolver: TurboResolver = {
  async tryResolve(): Promise<DirectSwapResult | null> {
    return null;
  }
};

export function isTurboBudgetExceeded(startMs: number, budgetMs: number): boolean {
  return Date.now() - startMs >= budgetMs;
}

export function computeTurboDeadline(startMs: number, budgetMs: number): number {
  return startMs + budgetMs;
}
