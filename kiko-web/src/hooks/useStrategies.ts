import { useState, useEffect, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { getConfigs, updateConfigStatus, deleteConfig, updateConfig, type CopyTradeConfig } from '../services/copyTradeApi';
import { toast } from 'sonner';

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
  type: 'auto_buy' | 'auto_sell' | 'dca' | 'custom' | 'copy_trade';
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
}

const STORAGE_KEY = 'kiko-strategies-v2';
const MAX_STRATEGIES = 200;

// Helper function to create demo strategies
const createDemoStrategies = (): TradingStrategy[] => [
  {
    id: 'demo-1',
    name: 'Auto Buy DEGEN',
    type: 'auto_buy',
    tokenIn: 'USDC',
    tokenOut: 'DEGEN',
    chain: 'base',
    chainId: 8453,
    triggerCondition: 'Price drops 30%',
    executionAmount: '100',
    amountAsset: 'USDC',
    limits: {
      maxUsdPerDay: '500',
      maxTradesPerDay: 5,
      cooldown: '1h',
    },
    status: 'active',
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000,
    conversationId: 'demo-conv-1',
    executionHistory: [],
    trigger: {
      type: 'price_drop_pct',
      value: 30,
      window_s: 300,
    },
    slippage_bps: 50,
  },
];

export const useStrategies = () => {
  const [strategies, setStrategies] = useState<TradingStrategy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { ready, authenticated } = usePrivy();

  // Fetch from LocalStorage and Real API
  const fetchAllStrategies = useCallback(async () => {
    // Wait for Privy to initialize
    if (!ready) return;

    setIsLoading(true);
    const allStrategies: TradingStrategy[] = [];

    // 1. Load Local Mock/Demo Strategies
    // 1. Load Local Mock/Demo Strategies
    // try {
    //   const saved = localStorage.getItem(STORAGE_KEY);
    //   if (saved) {
    //     const parsed = JSON.parse(saved);
    //     if (Array.isArray(parsed)) {
    //       // STRICTLY filter out any 'copy_trade' types from local storage
    //       // Copy trades must only come from the backend to avoid "ghosts"
    //       const localStrats = parsed
    //         .filter((s: any) => s.type !== 'copy_trade')
    //         .map((s: any) => ({ ...s, id: String(s.id) }));
    //       allStrategies.push(...localStrats);
    //     }
    //   } 
    // } catch (e) {
    //   console.warn('Failed to load local strategies', e);
    // }

    // 2. Load Real Copy Trade Configs (ONLY if authenticated)
    if (authenticated) {
      try {
        const configs = await getConfigs();
        const mappedConfigs: TradingStrategy[] = configs.map(config => ({
          id: config.id,
          name: `Follow ${config.targetWallet.slice(0, 6)}...${config.targetWallet.slice(-4)}`,
          type: 'copy_trade',
          tokenIn: 'ETH', // Usually buying with ETH
          tokenOut: 'ANY',
          chain: config.chainId === 8453 ? 'base' : 'eth',
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
          executionHistory: [], // TODO: fetch positions and map to history
          copyTradeConfig: config
        }));

        // Remove any local strategies that conflict with real ones (unlikely given ID format)
        // or just merge
        allStrategies.push(...mappedConfigs);

      } catch (error) {
        console.warn('[useStrategies] Failed to fetch copy trade configs:', error);
      }
    }

    // Sort by createdAt desc
    allStrategies.sort((a, b) => b.createdAt - a.createdAt);

    // SAFETY: Filter out any copy_trade strategies that don't have valid copyTradeConfig
    // These are "ghost" cards caused by localStorage corruption or bugs
    const validStrategies = allStrategies.filter(s => {
      if (s.type === 'copy_trade') {
        const hasValidConfig = s.copyTradeConfig &&
          s.copyTradeConfig.targetWallet &&
          s.copyTradeConfig.targetWallet !== '0x0000000000000000000000000000000000000000';
        if (!hasValidConfig) {
          console.warn('[useStrategies] Filtering out invalid copy_trade strategy:', s.id);
          return false;
        }
      }
      return true;
    });

    setStrategies(validStrategies);
    setIsLoading(false);
  }, [ready, authenticated]);

  useEffect(() => {
    fetchAllStrategies();
  }, [fetchAllStrategies]);

  // Persist local strategies (filter out copy_trade types)
  useEffect(() => {
    const localOnly = strategies.filter(s => s.type !== 'copy_trade');
    if (localOnly.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(localOnly));
    }
  }, [strategies]);

  const createStrategy = useCallback((strategy: Omit<TradingStrategy, 'id' | 'createdAt' | 'updatedAt' | 'executionHistory'>): string => {
    const newStrategy: TradingStrategy = {
      ...strategy,
      id: `strategy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      executionHistory: [],
    };
    setStrategies(prev => [newStrategy, ...prev]);
    return newStrategy.id;
  }, []);

  const updateStrategy = useCallback(async (id: string, updates: Partial<TradingStrategy>) => {
    // Optimistic update
    setStrategies(prev =>
      prev.map(strat =>
        strat.id === id
          ? { ...strat, ...updates, updatedAt: Date.now() }
          : strat
      )
    );

    // API Update for Copy Trade
    const strategy = strategies.find(s => s.id === id);
    if (strategy?.type === 'copy_trade' && updates.copyTradeConfig) {
      try {
        await updateConfig(id, updates.copyTradeConfig);
      } catch (error) {
        console.error('[useStrategies] Failed to update remote config:', error);
        // Revert by refetching
        fetchAllStrategies();
      }
    }
  }, [strategies, fetchAllStrategies]);

  const deleteStrategy = useCallback(async (id: string) => {
    const strategy = strategies.find(s => s.id === id);
    if (!strategy) return;

    // Optimistic update
    const previousStrategies = [...strategies];
    setStrategies(prev => prev.filter(strat => strat.id !== id));

    if (strategy.type === 'copy_trade') {
      try {
        await deleteConfig(id);
      } catch (error) {
        console.error('Failed to delete cloud strategy', error);
        // Revert on failure
        setStrategies(previousStrategies);
        toast.error('Failed to delete strategy. Please try again.');
      }
    }
  }, [strategies]);

  const toggleStrategyStatus = useCallback(async (id: string) => {
    const strategy = strategies.find(s => s.id === id);
    if (!strategy) return;

    const newStatus = strategy.status === 'active' ? 'paused' : 'active';
    const previousStrategies = [...strategies];

    // Optimistic update
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
        console.error('Failed to update cloud strategy status', error);
        // Revert on failure
        setStrategies(previousStrategies);
        toast.error('Failed to update strategy status. Please try again.');
      }
    }
  }, [strategies]);

  const addExecutionRecord = useCallback((id: string, record: Omit<ExecutionRecord, 'id'>) => {
    // Local only
  }, []);

  const getStrategy = useCallback((id: string) => {
    return strategies.find(s => s.id === id);
  }, [strategies]);

  const clearAllStrategies = useCallback(() => {
    setStrategies([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    strategies,
    isLoading,
    createStrategy,
    updateStrategy,
    deleteStrategy,
    toggleStrategyStatus,
    addExecutionRecord,
    getStrategy,
    clearAllStrategies,
    refreshUserStrategies: fetchAllStrategies, // Export refresh
  };
};

