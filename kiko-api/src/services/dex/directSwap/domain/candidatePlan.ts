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
    return ['v4', 'v3', 'aerodrome', 'v2'];
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

export function buildTurboSinglePoolAttemptPlan(
  candidates: ResolvedPoolHint[],
  chainId: number,
  options?: {
    preferredFirst?: ResolvedPoolHint | null;
    maxAttempts?: number;
  }
): ResolvedPoolHint[] {
  if (candidates.length === 0) return [];
  const maxAttempts = Math.max(1, options?.maxAttempts || 2);
  const baseOrder: StrategyKind[] = ['v4', 'v3', 'aerodrome', 'v2'];
  const preferredFirst = options?.preferredFirst || null;
  let first = candidates[0];
  if (preferredFirst) {
    const preferred = candidates.find((candidate) => resolvedHintIdentity(candidate) === resolvedHintIdentity(preferredFirst));
    if (preferred) first = preferred;
  }
  if (chainId === 8453 && !preferredFirst) {
    const prioritized = baseOrder
      .map((kind) => candidates.find((candidate) => candidate.kind === kind))
      .find(Boolean);
    if (prioritized) first = prioritized;
  }
  const attempts: ResolvedPoolHint[] = [first];
  const used = new Set<string>([resolvedHintIdentity(first)]);

  const preferredKinds: StrategyKind[] = chainId === 8453
    ? ['v4', 'v3', 'aerodrome', 'v2']
    : first.kind === 'aerodrome'
      ? ['v4', 'v3', 'v2']
      : ['v4', 'v3', 'v2', 'aerodrome'];

  while (attempts.length < maxAttempts) {
    let next: ResolvedPoolHint | undefined;
    for (const kind of preferredKinds) {
      next = candidates.find((candidate) => candidate.kind === kind && !used.has(resolvedHintIdentity(candidate)));
      if (next) break;
    }
    if (!next) {
      next = candidates.find((candidate) => !used.has(resolvedHintIdentity(candidate)));
    }
    if (!next) break;
    attempts.push(next);
    used.add(resolvedHintIdentity(next));
  }

  return attempts.slice(0, maxAttempts);
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
