/**
 * Smart Balance Cache Service
 * Optimized RPC usage with intelligent caching and batch requests
 */

import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { getPortfolio, getEthBalance, TokenBalance } from './alchemy.js';

interface CachedBalance {
  balance: number;
  timestamp: number;
  decimals?: number;
}

interface ChainBalances {
  native: CachedBalance;
  tokens: Map<string, CachedBalance>;
  lastFullRefresh: number;
}

// Global cache: userId -> chainId -> balances
const balanceCache = new Map<string, Map<string, ChainBalances>>();

// Cache settings
const NATIVE_BALANCE_TTL = 30_000; // 30 seconds for native token
const TOKEN_BALANCE_TTL = 60_000; // 60 seconds for ERC20 tokens  
const FULL_REFRESH_TTL = 300_000; // 5 minutes for full portfolio refresh

/**
 * Get cached balance or fetch if needed
 * SMART: Only fetches what's missing, not the entire portfolio
 */
export async function getBalanceOptimized(
  userId: string,
  walletAddress: string,
  chainName: string,
  tokenAddress?: string // If provided, only fetch this token
): Promise<number> {
  const now = Date.now();
  const userCache = balanceCache.get(userId) || new Map();
  const chainCache = userCache.get(chainName);

  // If requesting native token (ETH, SOL, BNB)
  if (!tokenAddress || ['ETH', 'BNB', 'SOL'].includes(tokenAddress.toUpperCase())) {
    if (chainCache?.native && now - chainCache.native.timestamp < NATIVE_BALANCE_TTL) {
      logger.debug(LogCode.SYS_INFO, 'Native balance cache HIT', { userId, chain: chainName });
      return chainCache.native.balance;
    }

    // Fetch only native balance (lightweight RPC call)
    logger.debug(LogCode.SYS_INFO, 'Native balance cache MISS, fetching', { userId, chain: chainName });
    const rawBalance = await getEthBalance(walletAddress, chainName);
    const decimals = chainName === 'solana' ? 9 : 18;
    const balance = Number(rawBalance) / (10 ** decimals);

    // Update cache
    if (!chainCache) {
      userCache.set(chainName, {
        native: { balance, timestamp: now },
        tokens: new Map(),
        lastFullRefresh: 0
      });
      balanceCache.set(userId, userCache);
    } else {
      chainCache.native = { balance, timestamp: now };
    }

    return balance;
  }

  // Requesting specific token
  const tokenKey = tokenAddress.toLowerCase();
  if (chainCache?.tokens.has(tokenKey)) {
    const cached = chainCache.tokens.get(tokenKey)!;
    if (now - cached.timestamp < TOKEN_BALANCE_TTL) {
      logger.debug(LogCode.SYS_INFO, 'Token balance cache HIT', { 
        userId, 
        chain: chainName, 
        token: tokenAddress.slice(0, 8) 
      });
      return cached.balance;
    }
  }

  // Need to fetch - check if we should do full refresh
  const shouldFullRefresh = !chainCache || now - chainCache.lastFullRefresh > FULL_REFRESH_TTL;

  if (shouldFullRefresh) {
    logger.debug(LogCode.SYS_INFO, 'Full portfolio refresh needed', { userId, chain: chainName });
    
    // Fetch entire portfolio (all tokens)
    const portfolio = await getPortfolio(walletAddress, [chainName]);
    const chainData = portfolio[chainName];
    
    if (!chainData) return 0;

    // Update cache with all tokens
    const newChainCache: ChainBalances = {
      native: {
        balance: chainData.ethBalanceFormatted || 0,
        timestamp: now
      },
      tokens: new Map(),
      lastFullRefresh: now
    };

    chainData.tokens?.forEach((token: TokenBalance) => {
      const balance = parseFloat(token.tokenBalance || '0');
      newChainCache.tokens.set(token.contractAddress.toLowerCase(), {
        balance,
        timestamp: now,
        decimals: token.decimals
      });
    });

    userCache.set(chainName, newChainCache);
    balanceCache.set(userId, userCache);

    // Return requested token balance
    const found = newChainCache.tokens.get(tokenKey);
    return found?.balance || 0;
  }

  // Fetch only this specific token (lightweight)
  logger.debug(LogCode.SYS_INFO, 'Fetching single token balance', { 
    userId, 
    chain: chainName, 
    token: tokenAddress.slice(0, 8) 
  });

  // TODO: Implement single-token fetch using eth_call
  // For now, fall back to full refresh
  const portfolio = await getPortfolio(walletAddress, [chainName]);
  const chainData = portfolio[chainName];
  const token = chainData?.tokens?.find(t => 
    t.contractAddress.toLowerCase() === tokenKey
  );
  
  const balance = parseFloat(token?.tokenBalance || '0');
  
  // Cache it
  if (!chainCache) {
    userCache.set(chainName, {
      native: { balance: chainData?.ethBalanceFormatted || 0, timestamp: now },
      tokens: new Map([[tokenKey, { balance, timestamp: now, decimals: token?.decimals }]]),
      lastFullRefresh: 0
    });
    balanceCache.set(userId, userCache);
  } else {
    chainCache.tokens.set(tokenKey, { balance, timestamp: now, decimals: token?.decimals });
  }

  return balance;
}

/**
 * Pre-warm cache when user logs in
 */
export async function prewarmUserBalances(
  userId: string,
  walletAddress: string,
  chains: string[] = ['base', 'eth', 'arbitrum']
): Promise<void> {
  logger.info(LogCode.SYS_INFO, 'Pre-warming balance cache', { userId, chains });
  
  try {
    const portfolio = await getPortfolio(walletAddress, chains);
    const now = Date.now();
    const userCache = new Map<string, ChainBalances>();

    for (const chain of chains) {
      const chainData = portfolio[chain];
      if (!chainData) continue;

      const chainCache: ChainBalances = {
        native: {
          balance: chainData.ethBalanceFormatted || 0,
          timestamp: now
        },
        tokens: new Map(),
        lastFullRefresh: now
      };

      chainData.tokens?.forEach((token: TokenBalance) => {
        const balance = parseFloat(token.tokenBalance || '0');
        chainCache.tokens.set(token.contractAddress.toLowerCase(), {
          balance,
          timestamp: now,
          decimals: token.decimals
        });
      });

      userCache.set(chain, chainCache);
    }

    balanceCache.set(userId, userCache);
    logger.info(LogCode.SYS_INFO, 'Balance cache pre-warmed successfully', { 
      userId, 
      chains, 
      tokenCount: Array.from(userCache.values()).reduce((sum, c) => sum + c.tokens.size, 0)
    });
  } catch (error: any) {
    logger.error(LogCode.SYS_ERROR, 'Balance pre-warm failed', { 
      userId, 
      error: error.message 
    });
  }
}

/**
 * Invalidate cache for user (e.g., after a swap)
 */
export function invalidateUserCache(userId: string, chainName?: string): void {
  if (!chainName) {
    balanceCache.delete(userId);
    logger.debug(LogCode.SYS_INFO, 'Invalidated all balance cache', { userId });
  } else {
    const userCache = balanceCache.get(userId);
    if (userCache) {
      userCache.delete(chainName);
      logger.debug(LogCode.SYS_INFO, 'Invalidated chain balance cache', { userId, chain: chainName });
    }
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  const stats = {
    totalUsers: balanceCache.size,
    totalChains: 0,
    totalTokens: 0
  };

  balanceCache.forEach(userCache => {
    stats.totalChains += userCache.size;
    userCache.forEach(chainCache => {
      stats.totalTokens += chainCache.tokens.size;
    });
  });

  return stats;
}
