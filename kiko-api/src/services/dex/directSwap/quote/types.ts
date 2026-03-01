import type { DexFamily, DexStrategy } from '../../directSwapTypes.js';
import type { PoolInfo } from '../../poolInfo.js';
import type { SelectedV4Pool } from '../../v4ExecutionPlan.js';
import type { ResolvedPoolHint } from '../turbo.js';

export type QuotePolicyMode = 'turbo' | 'normal';

export type QuoteConfidence = 'quoted' | 'fallback' | 'unavailable';

export interface StrategyQuoteEstimate {
  key: string;
  strategy: DexStrategy;
  quotedOut: bigint;
  confidence: QuoteConfidence;
  pool?: PoolInfo | SelectedV4Pool | null;
}

export interface TurboCandidateQuote {
  key: string;
  candidate: ResolvedPoolHint;
  quotedOut: bigint;
  confidence: QuoteConfidence;
}

export type QuoteCapableStrategyKind = 'v4' | 'v3' | 'v2' | 'aerodrome';

export function buildStrategyQuoteKey(strategy: DexStrategy): string {
  return `${strategy.kind}:${String(strategy.dex || '').toLowerCase()}`;
}

export function buildResolvedHintQuoteKey(candidate: ResolvedPoolHint): string {
  return `${candidate.kind}:${String(candidate.dex || '').toLowerCase()}:${String(candidate.poolAddress || '').toLowerCase()}:${Number(candidate.fee || 0)}`;
}

export function isQuoteCapableStrategy(strategy: DexStrategy): strategy is DexStrategy & {
  kind: QuoteCapableStrategyKind;
  dex?: DexFamily;
} {
  return strategy.kind === 'v4' || strategy.kind === 'v3' || strategy.kind === 'v2' || strategy.kind === 'aerodrome';
}
