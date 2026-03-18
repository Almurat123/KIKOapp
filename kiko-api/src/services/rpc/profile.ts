import type { RpcPurpose } from './purpose.js';
import type { RpcImportance } from './types.js';

export interface RpcCallProfile {
  purpose: RpcPurpose;
  strategy?: 'fast' | 'cheap';
  importance?: RpcImportance;
  latencyBudgetMs?: number;
}

export interface ResolvedRpcCallProfile {
  purpose: RpcPurpose;
  strategy: 'fast' | 'cheap';
  importance: RpcImportance;
  latencyBudgetMs?: number;
}

export const TRADE_METADATA_PROFILE: Readonly<RpcCallProfile> = {
  purpose: 'trade_execution',
  strategy: 'fast',
  importance: 'critical',
  latencyBudgetMs: 900,
};

export const TRADE_QUOTE_PROFILE: Readonly<RpcCallProfile> = {
  purpose: 'trade_execution',
  strategy: 'fast',
  importance: 'critical',
  latencyBudgetMs: 1200,
};

export const TRADE_VISIBILITY_PROFILE: Readonly<RpcCallProfile> = {
  purpose: 'tx_visibility',
  strategy: 'fast',
  importance: 'critical',
  latencyBudgetMs: 1500,
};

export function resolveRpcCallProfile(
  profile: RpcCallProfile | undefined,
  fallback: {
    purpose: RpcPurpose;
    strategy?: 'fast' | 'cheap';
    importance?: RpcImportance;
  }
): ResolvedRpcCallProfile {
  return {
    purpose: profile?.purpose || fallback.purpose,
    strategy: profile?.strategy || fallback.strategy || 'cheap',
    importance: profile?.importance || fallback.importance || 'normal',
    latencyBudgetMs: profile?.latencyBudgetMs,
  };
}
