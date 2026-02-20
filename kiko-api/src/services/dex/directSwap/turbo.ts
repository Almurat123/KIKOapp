import type { DirectSwapHint, HintedSourcePool } from './types.js';

export type ResolvedPoolHint = NonNullable<DirectSwapHint['resolvedPoolHint']>;

export interface TurboResolverContext {
  chainId: number;
  tokenIn: string;
  tokenOut: string;
  amountInWei: bigint;
  hint?: DirectSwapHint;
  sourceHint?: HintedSourcePool | null;
  cachedWinnerHint?: ResolvedPoolHint | null;
  deadlineMs: number;
}

export interface TurboResolver {
  resolveCandidates(ctx: TurboResolverContext): Promise<ResolvedPoolHint[]>;
}

function resolvedHintKey(hint: ResolvedPoolHint): string {
  const poolAddress = String(hint.poolAddress || '').toLowerCase();
  const fee = Number(hint.fee || 0);
  const dex = String(hint.dex || '').toLowerCase();
  return `${hint.kind}:${dex}:${poolAddress}:${fee}`;
}

export function sourcePoolToResolvedHint(sourceHint: HintedSourcePool): ResolvedPoolHint {
  if (sourceHint.kind === 'v4') {
    return {
      kind: 'v4',
      dex: sourceHint.dex,
      poolAddress: sourceHint.pool.poolAddress,
      fee: sourceHint.pool.poolKey.fee,
      v4PoolKey: {
        currency0: sourceHint.pool.poolKey.currency0,
        currency1: sourceHint.pool.poolKey.currency1,
        hooks: sourceHint.pool.poolKey.hooks,
        poolManager: '',
        fee: sourceHint.pool.poolKey.fee,
        tickSpacing: sourceHint.pool.poolKey.tickSpacing
      }
    };
  }
  return {
    kind: sourceHint.kind,
    dex: sourceHint.dex,
    poolAddress: sourceHint.pool.poolAddress,
    fee: sourceHint.pool.fee || 0
  };
}

export function dedupeResolvedHints(hints: Array<ResolvedPoolHint | null | undefined>): ResolvedPoolHint[] {
  const deduped: ResolvedPoolHint[] = [];
  const seen = new Set<string>();
  for (const hint of hints) {
    if (!hint) continue;
    if (!hint.poolAddress) continue;
    const key = resolvedHintKey(hint);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(hint);
  }
  return deduped;
}

export const singlePoolTurboResolver: TurboResolver = {
  async resolveCandidates(ctx: TurboResolverContext): Promise<ResolvedPoolHint[]> {
    return dedupeResolvedHints([
      ctx.hint?.resolvedPoolHint,
      ctx.sourceHint ? sourcePoolToResolvedHint(ctx.sourceHint) : null,
      ctx.cachedWinnerHint
    ]);
  }
};

export function isTurboBudgetExceeded(startMs: number, budgetMs: number): boolean {
  return Date.now() - startMs >= budgetMs;
}

export function computeTurboDeadline(startMs: number, budgetMs: number): number {
  return startMs + budgetMs;
}
