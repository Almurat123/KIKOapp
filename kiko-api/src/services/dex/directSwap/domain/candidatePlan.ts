import type { PoolInfo } from '../../poolInfo.js';
import type { DirectSwapHint, StrategyKind } from '../../directSwapTypes.js';
import type { ResolvedPoolHint } from '../turbo.js';

export type TurboRescueStrategyKind = 'v4' | 'v3' | 'v2';
export type TurboRescueInternalStrategyKind = TurboRescueStrategyKind | 'aerodrome';

export function resolvedHintIdentity(hint: ResolvedPoolHint): string {
  return `${hint.kind}:${String(hint.dex || '').toLowerCase()}:${String(hint.poolAddress || '').toLowerCase()}:${Number(hint.fee || 0)}`;
}

export function buildTurboRescueOrder(chainId: number): TurboRescueInternalStrategyKind[] {
  if (chainId === 8453) {
    return ['v4', 'v3', 'v2', 'aerodrome'];
  }
  return ['v4', 'v3', 'aerodrome'];
}

export function matchesTurboRescueStrategy(pool: PoolInfo, strategy: TurboRescueInternalStrategyKind): boolean {
  const version = String(pool.version || '').toLowerCase();
  const dex = String(pool.dex || '').toLowerCase();
  if (strategy === 'aerodrome') {
    return version === 'aerodrome' || dex === 'aerodrome';
  }
  return version === strategy;
}

export function capTurboRescueCandidatePools(
  pools: PoolInfo[],
  order: TurboRescueInternalStrategyKind[],
  perKindLimit: number,
  totalLimit: number
): PoolInfo[] {
  if (pools.length <= totalLimit) return pools;
  const byKindCount = new Map<TurboRescueInternalStrategyKind, number>();
  const selected: PoolInfo[] = [];
  const selectedIds = new Set<string>();
  const makePoolId = (pool: PoolInfo) =>
    `${String(pool.version || '')}:${String(pool.dex || '')}:${String(pool.poolAddress || '')}`.toLowerCase();
  const safePerKindLimit = Math.max(1, perKindLimit);
  const safeTotalLimit = Math.max(1, totalLimit);

  for (const strategy of order) {
    for (const pool of pools) {
      if (!matchesTurboRescueStrategy(pool, strategy)) continue;
      const poolId = makePoolId(pool);
      if (selectedIds.has(poolId)) continue;
      const taken = byKindCount.get(strategy) || 0;
      if (taken >= safePerKindLimit) continue;
      selected.push(pool);
      selectedIds.add(poolId);
      byKindCount.set(strategy, taken + 1);
      if (selected.length >= safeTotalLimit) return selected;
    }
  }

  for (const pool of pools) {
    const poolId = makePoolId(pool);
    if (selectedIds.has(poolId)) continue;
    selected.push(pool);
    selectedIds.add(poolId);
    if (selected.length >= safeTotalLimit) break;
  }
  return selected;
}

export function buildTurboSinglePoolAttemptPlan(candidates: ResolvedPoolHint[], chainId: number): ResolvedPoolHint[] {
  if (candidates.length === 0) return [];
  const baseOrder: StrategyKind[] = ['v4', 'v3', 'v2', 'aerodrome'];
  let first = candidates[0];
  if (chainId === 8453) {
    const prioritized = baseOrder
      .map((kind) => candidates.find((candidate) => candidate.kind === kind))
      .find(Boolean);
    if (prioritized) first = prioritized;
  }
  const attempts: ResolvedPoolHint[] = [first];
  const used = new Set<string>([resolvedHintIdentity(first)]);

  const preferredSecondKinds: StrategyKind[] = chainId === 8453
    ? ['v4', 'v3', 'v2', 'aerodrome']
    : first.kind === 'aerodrome'
      ? ['v4', 'v3', 'v2']
      : ['v4', 'v3', 'v2', 'aerodrome'];

  let second: ResolvedPoolHint | undefined;
  for (const kind of preferredSecondKinds) {
    second = candidates.find((candidate) => candidate.kind === kind && !used.has(resolvedHintIdentity(candidate)));
    if (second) break;
  }
  if (!second && chainId !== 8453) {
    second = candidates.find((candidate) => !used.has(resolvedHintIdentity(candidate)));
  }
  if (second) attempts.push(second);

  return attempts.slice(0, 2);
}

export function isLikelyAerodromeHintTrustworthy(hint?: DirectSwapHint): boolean {
  if (!hint) return false;
  const sourceDex = String(hint.sourceDexName || '').toLowerCase();
  const preferredDex = String(hint.preferredDex || '').toLowerCase();
  const resolvedDex = String(hint.resolvedPoolHint?.dex || '').toLowerCase();
  const resolvedKind = String(hint.resolvedPoolHint?.kind || '').toLowerCase();
  const routeHops = Math.max(Number(hint.routeHopCount || 0), hint.routeHops?.length || 0);
  if (sourceDex.includes('aero') || sourceDex.includes('aerodrome')) return true;
  if (preferredDex === 'aerodrome') return true;
  if ((resolvedDex === 'aerodrome' || resolvedKind === 'aerodrome') && routeHops <= 1) return true;
  return false;
}
