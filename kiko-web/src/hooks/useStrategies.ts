import { useState, useEffect, useCallback } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { getConfigs, updateConfigStatus, deleteConfig, updateConfig, getPositions, type CopyTradeConfig, CopyTradeApiError } from '../services/copyTradeApi';
import {
  deletePolymarketCopyConfig,
  getPolymarketCopyConfigs,
  type PolymarketCopyConfig,
  updatePolymarketCopyConfig
} from '../services/polymarketCopyApi';
import { createCopyTradeSignedPayload, signCopyTradeConfigIntent } from '../services/copyTradeSigning';
import { toast } from 'sonner';
import { resolveChainPresentation } from '../utils/chainPresentation';

// CONTEXT MEMORY
// Updated: 2026-04-10
// Author: Rowan
// Reason: Strategy loading was both fragile under 429s and too eager on route
//         remounts, which turned ordinary navigation into repeat burst reads.
// Goal: Preserve the best available strategy snapshot and reuse it briefly
//       across page switches so the strategy surface does not re-flood the backend.
// Owns: Merging local, copy-trade, and Polymarket strategy views into one list.
// Does Not Own: Backend retry policy, auth token lifecycles, or mutation semantics.
// Design Language:
// - Partial data is better than a full loading failure.
// - Never let one third-party source erase already recovered data from another.
// - Keep fallback behavior visible in logs, not hidden in silent catches.
// - Route remounts should reuse a recent merged snapshot before re-reading.
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/loading-resilience.md
// - /Users/almurat/KiKo/system-journal/owner-map/frontend-data-loading.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-08-rate-limit-loading-stall.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-navigation-burst-read-throttle.md

const STRATEGIES_CACHE_TTL_MS = 15_000;

interface StrategiesStatsSnapshot {
  totalExecutions: number;
  totalPnL: number;
}

interface StrategiesSnapshot {
  cacheKey: string;
  strategies: TradingStrategy[];
  stats: StrategiesStatsSnapshot;
  cachedAt: number;
}

let strategiesSnapshotCache: StrategiesSnapshot | null = null;
const strategiesInFlight = new Map<string, Promise<StrategiesSnapshot>>();

function hasFreshStrategiesSnapshot(cacheKey: string): boolean {
  return !!strategiesSnapshotCache
    && strategiesSnapshotCache.cacheKey === cacheKey
    && (Date.now() - strategiesSnapshotCache.cachedAt) < STRATEGIES_CACHE_TTL_MS;
}

function invalidateStrategiesSnapshot(cacheKey?: string) {
  if (!cacheKey) {
    strategiesSnapshotCache = null;
    strategiesInFlight.clear();
    return;
  }
  if (strategiesSnapshotCache?.cacheKey === cacheKey) {
    strategiesSnapshotCache = null;
  }
  strategiesInFlight.delete(cacheKey);
}

export interface ExecutionRecord {
  id: string;
  timestamp: number;
  amount: string;
  status: 'success' | 'failed' | 'pending';
  transactionHash?: string;
  error?: string;
}

export interface TradingStrategy {
  id: string;
  name: string;
  type: 'auto_buy' | 'auto_sell' | 'dca' | 'custom' | 'copy_trade' | 'polymarket_copy';
  tokenIn: string;
  tokenOut: string;
  chain: string;
  chainId?: number;
  triggerCondition: string;
  executionAmount: string;
  amountAsset: string;
  limits: {
    maxUsdPerDay: string;
    maxTradesPerDay: number;
    cooldown: string;
  };
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  createdAt: number;
  updatedAt: number;
  conversationId?: string;
  executionHistory: ExecutionRecord[];
  trigger?: {
    type: 'price_drop_pct' | 'price_rise_pct' | 'price_target' | 'time' | 'wallet_action';
    value?: number;
    window_s?: number;
    min_duration_s?: number;
    target_price?: string;
    wallet_address?: string;
  };
  slippage_bps?: number;
  allowance_mode?: 'one_shot' | 'unlimited';
  // Copy Trade specific fields
  copyTradeConfig?: CopyTradeConfig;
  // Polymarket Copy specific fields
  polymarketCopyConfig?: PolymarketCopyConfig;
}

const STORAGE_KEY = 'kiko-strategies-v2';

export const useStrategies = () => {
  const [strategies, setStrategies] = useState<TradingStrategy[]>([]);
  const [stats, setStats] = useState({ totalExecutions: 0, totalPnL: 0 }); // New stats state
  const [isLoading, setIsLoading] = useState(true);
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const strategiesCacheKey = authenticated ? `auth:${user?.id || 'unknown'}` : 'guest';

  useEffect(() => {
    if (isLoading) return;
    strategiesSnapshotCache = {
      cacheKey: strategiesCacheKey,
      strategies,
      stats,
      cachedAt: Date.now(),
    };
  }, [strategies, stats, isLoading, strategiesCacheKey]);

  // Fetch from LocalStorage and Real API
  const fetchAllStrategies = useCallback(async () => {
    // Wait for Privy to initialize
    if (!ready) return;

    if (hasFreshStrategiesSnapshot(strategiesCacheKey)) {
      setStrategies(strategiesSnapshotCache!.strategies);
      setStats(strategiesSnapshotCache!.stats);
      setIsLoading(false);
      return;
    }

    const inFlight = strategiesInFlight.get(strategiesCacheKey);
    if (inFlight) {
      setIsLoading(true);
      const snapshot = await inFlight;
      setStrategies(snapshot.strategies);
      setStats(snapshot.stats);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const request = (async (): Promise<StrategiesSnapshot> => {
      const allStrategies: TradingStrategy[] = [];
      let nextStats: StrategiesStatsSnapshot = { totalExecutions: 0, totalPnL: 0 };

      // 1. Load Local Mock/Demo Strategies
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const localStrats = parsed
              .filter((s: any) => s.type !== 'copy_trade')
              .map((s: any) => ({
                ...s,
                id: String(s.id),
                executionHistory: s.executionHistory || []
              }));
            allStrategies.push(...localStrats);
          }
        }
      } catch (e) {
        console.warn('Failed to load local strategies', e);
      }

      if (authenticated) {
        try {
          const [configsResult, positionsResult, polyConfigsResult] = await Promise.allSettled([
            getConfigs(),
            getPositions(),
            getPolymarketCopyConfigs(),
          ]);

          const configs = configsResult.status === 'fulfilled' ? configsResult.value : [];
          const positions = positionsResult.status === 'fulfilled' ? positionsResult.value : [];
          const polyConfigs = polyConfigsResult.status === 'fulfilled' ? polyConfigsResult.value : [];

          if (configsResult.status === 'rejected') {
            console.warn('[useStrategies] Copy trade configs failed; continuing with other sources:', configsResult.reason);
          }
          if (positionsResult.status === 'rejected') {
            console.warn('[useStrategies] Copy trade positions failed; continuing with other sources:', positionsResult.reason);
          }
          if (polyConfigsResult.status === 'rejected') {
            console.warn('[useStrategies] Polymarket copy configs failed; continuing with other sources:', polyConfigsResult.reason);
          }

          const totalExecutions = positions.filter((p: any) => p.status === 'open' || p.status === 'closed').length;
          const totalPnL = positions.reduce((acc: number, pos: any) => {
            if (pos.status === 'closed' && pos.realizedPnlUsd) {
              const pnl = Number(pos.realizedPnlUsd);
              const entry = Number(pos.entryUsdValue || 0);
              const maxPlausible = Math.max(entry * 10, 100000);
              if (!Number.isFinite(pnl) || Math.abs(pnl) > maxPlausible) return acc;
              return acc + pnl;
            }
            if (pos.status === 'open' && pos.entryUsdValue) {
              if (pos.currentPrice && pos.entryPrice && Number(pos.entryPrice) > 0) {
                const pct = ((Number(pos.currentPrice) - Number(pos.entryPrice)) / Number(pos.entryPrice)) * 100;
                const unrealizedPnl = (pct / 100) * Number(pos.entryUsdValue);
                if (Number.isFinite(unrealizedPnl)) return acc + unrealizedPnl;
              }
              if (pos.profitLossPct !== null && pos.profitLossPct !== undefined) {
                const unrealizedPnl = (Number(pos.profitLossPct) / 100) * Number(pos.entryUsdValue);
                if (Number.isFinite(unrealizedPnl)) return acc + unrealizedPnl;
              }
            }
            return acc;
          }, 0);

          const mappedConfigs: TradingStrategy[] = configs.map(config => {
            const chain = resolveChainPresentation(config.chainId);
            return ({
              id: config.id,
              name: `Follow ${config.targetWallet.slice(0, 6)}...${config.targetWallet.slice(-4)}`,
              type: 'copy_trade',
              tokenIn: 'ETH',
              tokenOut: 'ANY',
              chain: chain.slug,
              chainId: config.chainId,
              triggerCondition: 'Target buys token',
              executionAmount: config.buyAmountUsd.toString(),
              amountAsset: 'USD',
              limits: {
                maxUsdPerDay: 'Unlimited',
                maxTradesPerDay: 999,
                cooldown: '0s'
              },
              status: config.status,
              createdAt: new Date(config.createdAt).getTime(),
              updatedAt: new Date(config.updatedAt).getTime(),
              executionHistory: [],
              copyTradeConfig: config
            });
          });

          allStrategies.push(...mappedConfigs);

          const mappedPolyConfigs: TradingStrategy[] = polyConfigs.map(config => ({
            id: config.id,
            name: `Polymarket Copy ${config.targetWallet.slice(0, 6)}...${config.targetWallet.slice(-4)}`,
            type: 'polymarket_copy',
            tokenIn: 'USDC',
            tokenOut: 'POLY',
            chain: 'polygon',
            chainId: 137,
            triggerCondition: 'Target opens position',
            executionAmount: config.betSizeUsd.toString(),
            amountAsset: 'USD',
            limits: {
              maxUsdPerDay: 'Unlimited',
              maxTradesPerDay: config.maxOpenBets || 999,
              cooldown: '0s'
            },
            status: config.status,
            createdAt: new Date(config.createdAt).getTime(),
            updatedAt: new Date(config.updatedAt).getTime(),
            executionHistory: Array.from({
              length: config.executionStats?.executedTrades || 0
            }).map((_, index) => ({
              id: `${config.id}-${index}`,
              timestamp: config.executionStats?.lastCopiedAt ? new Date(config.executionStats.lastCopiedAt).getTime() : new Date(config.updatedAt).getTime(),
              amount: String(config.betSizeUsd),
              status: 'success' as const
            })),
            polymarketCopyConfig: config
          }));

          allStrategies.push(...mappedPolyConfigs);
          const polymarketExecutions = polyConfigs.reduce((sum, config) => sum + (config.executionStats?.executedTrades || 0), 0);
          nextStats = { totalExecutions: totalExecutions + polymarketExecutions, totalPnL };
        } catch (error) {
          console.warn('[useStrategies] Failed to fetch copy trade data:', error);
        }
      }

      allStrategies.sort((a, b) => b.createdAt - a.createdAt);

      const validStrategies = allStrategies.filter(s => {
        if (s.type === 'copy_trade') {
          const hasValidConfig = s.copyTradeConfig &&
            s.copyTradeConfig.targetWallet &&
            s.copyTradeConfig.targetWallet !== '0x0000000000000000000000000000000000000000';
          if (!hasValidConfig) return false;
        }
        if (s.type === 'polymarket_copy') {
          const hasValidConfig = s.polymarketCopyConfig &&
            s.polymarketCopyConfig.targetWallet &&
            s.polymarketCopyConfig.targetWallet !== '0x0000000000000000000000000000000000000000';
          if (!hasValidConfig) return false;
        }
        return true;
      });

      return {
        cacheKey: strategiesCacheKey,
        strategies: validStrategies,
        stats: nextStats,
        cachedAt: Date.now(),
      };
    })();

    strategiesInFlight.set(strategiesCacheKey, request);

    try {
      const snapshot = await request;
      strategiesSnapshotCache = snapshot;
      setStrategies(snapshot.strategies);
      setStats(snapshot.stats);
    } finally {
      strategiesInFlight.delete(strategiesCacheKey);
      setIsLoading(false);
    }
  }, [ready, authenticated, strategiesCacheKey]);

  useEffect(() => {
    fetchAllStrategies();
  }, [fetchAllStrategies]);

  // Persist local strategies (filter out copy_trade/polymarket_copy types)
  useEffect(() => {
    const localOnly = strategies.filter(s => s.type !== 'copy_trade' && s.type !== 'polymarket_copy');
    if (localOnly.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(localOnly));
    }
  }, [strategies]);

  const createStrategy = useCallback((strategy: Omit<TradingStrategy, 'id' | 'createdAt' | 'updatedAt' | 'executionHistory'>): string => {
    invalidateStrategiesSnapshot(strategiesCacheKey);
    const newStrategy: TradingStrategy = {
      ...strategy,
      id: `strategy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      executionHistory: [],
    };
    setStrategies(prev => [newStrategy, ...prev]);
    return newStrategy.id;
  }, [strategiesCacheKey]);

  const updateStrategy = useCallback(async (id: string, updates: Partial<TradingStrategy>) => {
    const previousStrategy = strategies.find(s => s.id === id);
    if (!previousStrategy) return;

    // Optimistic update
    invalidateStrategiesSnapshot(strategiesCacheKey);
    setStrategies(prev =>
      prev.map(strat =>
        strat.id === id
          ? { ...strat, ...updates, updatedAt: Date.now() }
          : strat
      )
    );

    // API Update for Copy Trade
    const strategy = previousStrategy;
    if (strategy?.type === 'copy_trade' && updates.copyTradeConfig) {
      try {
        const signerWallet = wallets.find((w: any) => w.walletClientType === 'privy' && w.chainId?.includes?.('eip155'));
        const signerAddress = signerWallet?.address || '';
        if (!signerWallet || !signerAddress || !user?.id) {
          throw new Error('SIGNATURE_REQUIRED: EVM embedded wallet is required to update copy trade config');
        }

        const currentConfig = strategy.copyTradeConfig || ({} as CopyTradeConfig);
        const mergedConfig = { ...currentConfig, ...updates.copyTradeConfig };
        const payload = createCopyTradeSignedPayload({
          action: 'update',
          userId: user.id,
          signerAddress,
          nonce: Number(currentConfig.signedNonce || 0) + 1,
          configId: id,
          source: mergedConfig,
        });
        const signature = await signCopyTradeConfigIntent({
          wallet: signerWallet,
          signerAddress,
          payload,
        });

        const updatedConfig = await updateConfig(id, {
          signedPayload: payload as unknown as Record<string, unknown>,
          signature,
          signerAddress,
          nonce: payload.nonce,
          expiresAt: payload.expiresAtMs,
        });
        setStrategies(prev => prev.map(strat => (
          strat.id === id
            ? { ...strat, copyTradeConfig: updatedConfig, updatedAt: Date.now() }
            : strat
        )));
      } catch (error) {
        console.error('[useStrategies] Failed to update remote config:', error);
        setStrategies(prev => prev.map(strat => (
          strat.id === id ? previousStrategy : strat
        )));
        if (error instanceof CopyTradeApiError) {
          if (error.code === 'SIGNATURE_REQUIRED') toast.error('Signature required. Please sign in your Privy wallet.');
          else if (error.code === 'SIGNATURE_INVALID') toast.error('Signature invalid. Please retry signing.');
          else if (error.code === 'CONFIG_STALE_NONCE') toast.error('Config is stale. Please refresh and retry.');
          else if (error.code === 'CONFIG_EXPIRED') toast.error('Signature expired. Please sign again.');
          else toast.error(error.message || 'Failed to update strategy');
        } else {
          toast.error(error instanceof Error ? error.message : 'Failed to update strategy');
        }
        throw error;
      }
    } else if (strategy?.type === 'polymarket_copy' && updates.polymarketCopyConfig) {
      try {
        const updatedConfig = await updatePolymarketCopyConfig(id, updates.polymarketCopyConfig);
        setStrategies(prev => prev.map(strat => (
          strat.id === id
            ? {
                ...strat,
                polymarketCopyConfig: updatedConfig,
                status: updatedConfig.status,
                executionHistory: Array.from({
                  length: updatedConfig.executionStats?.executedTrades || 0
                }).map((_, index) => ({
                  id: `${updatedConfig.id}-${index}`,
                  timestamp: updatedConfig.executionStats?.lastCopiedAt ? new Date(updatedConfig.executionStats.lastCopiedAt).getTime() : Date.now(),
                  amount: String(updatedConfig.betSizeUsd),
                  status: 'success' as const
                })),
                updatedAt: Date.now()
              }
            : strat
        )));
      } catch (error) {
        console.error('[useStrategies] Failed to update polymarket config:', error);
        setStrategies(prev => prev.map(strat => (
          strat.id === id ? previousStrategy : strat
        )));
        toast.error(error instanceof Error ? error.message : 'Failed to update Polymarket strategy');
        throw error;
      }
    }
  }, [strategies, fetchAllStrategies, wallets, user, strategiesCacheKey]);

  const deleteStrategy = useCallback(async (id: string) => {
    const strategy = strategies.find(s => s.id === id);
    if (!strategy) return;

    if (strategy.type === 'copy_trade') {
      try {
        invalidateStrategiesSnapshot(strategiesCacheKey);
        const signerWallet = wallets.find((w: any) => w.walletClientType === 'privy' && w.chainId?.includes?.('eip155'));
        const signerAddress = signerWallet?.address || '';
        if (!signerWallet || !signerAddress || !user?.id || !strategy.copyTradeConfig) {
          throw new Error('SIGNATURE_REQUIRED: EVM embedded wallet is required to delete copy trade config');
        }

        const payload = createCopyTradeSignedPayload({
          action: 'delete',
          userId: user.id,
          signerAddress,
          nonce: Number(strategy.copyTradeConfig.signedNonce || 0) + 1,
          configId: id,
          source: strategy.copyTradeConfig,
        });
        const signature = await signCopyTradeConfigIntent({
          wallet: signerWallet,
          signerAddress,
          payload,
        });

        await deleteConfig(id, {
          signedPayload: payload as unknown as Record<string, unknown>,
          signature,
          signerAddress,
          nonce: payload.nonce,
          expiresAt: payload.expiresAtMs,
        });

        setStrategies(prev => prev.filter(strat => strat.id !== id));
      } catch (error) {
        if (error instanceof CopyTradeApiError) {
          if (error.code === 'SIGNATURE_REQUIRED') toast.error('Signature required. Please sign in your Privy wallet.');
          else if (error.code === 'SIGNATURE_INVALID') toast.error('Signature invalid. Please retry signing.');
          else if (error.code === 'CONFIG_STALE_NONCE') toast.error('Config is stale. Please refresh and retry.');
          else if (error.code === 'CONFIG_EXPIRED') toast.error('Signature expired. Please sign again.');
          else toast.error(error.message || 'Failed to delete strategy');
        } else {
          toast.error(error instanceof Error ? error.message : 'Failed to delete strategy. Please try again.');
        }
      }
      return;
    }

    if (strategy.type === 'polymarket_copy') {
      try {
        invalidateStrategiesSnapshot(strategiesCacheKey);
        await deletePolymarketCopyConfig(id);
        setStrategies(prev => prev.filter(strat => strat.id !== id));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to delete Polymarket strategy. Please try again.');
      }
      return;
    }

    // Non-copy-trade local strategies: remove immediately
    invalidateStrategiesSnapshot(strategiesCacheKey);
    setStrategies(prev => prev.filter(strat => strat.id !== id));
  }, [strategies, wallets, user, strategiesCacheKey]);

  const toggleStrategyStatus = useCallback(async (id: string) => {
    const strategy = strategies.find(s => s.id === id);
    if (!strategy) return;

    const newStatus = strategy.status === 'active' ? 'paused' : 'active';
    const previousStrategies = [...strategies];

    // Optimistic update
    invalidateStrategiesSnapshot(strategiesCacheKey);
    setStrategies(prev =>
      prev.map(strat => {
        if (strat.id === id) {
          return { ...strat, status: newStatus, updatedAt: Date.now() };
        }
        return strat;
      })
    );

    if (strategy.type === 'copy_trade') {
      try {
        await updateConfigStatus(id, newStatus);
      } catch (error) {
        setStrategies(previousStrategies);
        toast.error('Failed to update strategy status. Please try again.');
      }
    } else if (strategy.type === 'polymarket_copy') {
      try {
        const updatedConfig = await updatePolymarketCopyConfig(id, { status: newStatus as 'active' | 'paused' });
        setStrategies(prev => prev.map(strat => (
          strat.id === id
            ? { ...strat, polymarketCopyConfig: updatedConfig, status: updatedConfig.status, updatedAt: Date.now() }
            : strat
        )));
      } catch (error) {
        setStrategies(previousStrategies);
        toast.error('Failed to update Polymarket strategy status. Please try again.');
      }
    }
  }, [strategies, strategiesCacheKey]);

  const addExecutionRecord = useCallback(() => {
    // Local only
  }, []);

  const getStrategy = useCallback((id: string) => {
    return strategies.find(s => s.id === id);
  }, [strategies]);

  const clearAllStrategies = useCallback(() => {
    invalidateStrategiesSnapshot(strategiesCacheKey);
    setStrategies([]);
    localStorage.removeItem(STORAGE_KEY);
  }, [strategiesCacheKey]);

  return {
    strategies,
    stats, // Export stats
    isLoading,
    createStrategy,
    updateStrategy,
    deleteStrategy,
    toggleStrategyStatus,
    addExecutionRecord,
    getStrategy,
    clearAllStrategies,
    refreshUserStrategies: fetchAllStrategies,
  };
};
