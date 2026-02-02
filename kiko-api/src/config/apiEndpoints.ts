/**
 * Unified API Endpoints Configuration
 * Central management for all external API endpoints
 * 
 * This file manages:
 * - RPC endpoints (Alchemy, Infura, Ankr, public nodes)
 * - DexScreener API
 * - GeckoTerminal API
 * - Other third-party services
 */

import { env } from './env.js';

// ============================================================================
// RPC ENDPOINTS CONFIGURATION
// ============================================================================

export interface RpcEndpointConfig {
  name: string;
  url: string;
  priority: number; // Lower is higher priority (1 = first choice)
  requiresAuth: boolean;
  type: 'premium' | 'public' | 'fallback';
}

/**
 * Build RPC endpoint list for a specific chain
 * @param chainSlug - Chain identifier (e.g., 'eth', 'base', 'bsc')
 * @param primaryUrl - Primary RPC URL from environment
 * @returns Ordered list of RPC endpoints with priority
 * 
 * 优先级策略 (成本优化 - 2026-02-02 验证通过):
 *   1-2: 免费公共节点 - 首选 (已验证可靠)
 *   3-4: 付费节点 (Alchemy) - 备用 (高可靠性保证)
 */
export function getRpcEndpoints(chainSlug: string, primaryUrl?: string): RpcEndpointConfig[] {
  const endpoints: RpcEndpointConfig[] = [];

  // ============================================
  // 1. 免费公共节点优先 (已验证可靠性 95%+)
  // ============================================

  // 获取经过验证的免费节点
  const freeEndpoints = getVerifiedFreeEndpoints(chainSlug);
  freeEndpoints.forEach((ep, index) => {
    endpoints.push({
      name: ep.name,
      url: ep.url,
      priority: index + 1,
      requiresAuth: false,
      type: 'public'
    });
  });

  // ============================================
  // 2. 付费节点作为备用 (高可靠性保证)
  // ============================================

  const basePriority = freeEndpoints.length;

  // Primary Provider (Alchemy/Infura from ENV)
  if (primaryUrl) {
    endpoints.push({
      name: 'Primary',
      url: primaryUrl,
      priority: basePriority + 1,
      requiresAuth: true,
      type: 'premium'
    });
  }

  // Alchemy (if API key available and no primary)
  if (env.apiKeys.alchemy && !primaryUrl) {
    const alchemyUrl = getAlchemyUrl(chainSlug);
    if (alchemyUrl) {
      endpoints.push({
        name: 'Alchemy',
        url: alchemyUrl,
        priority: basePriority + 2,
        requiresAuth: true,
        type: 'premium'
      });
    }
  }

  // Ankr (final backup)
  if (env.apiKeys.ankr) {
    endpoints.push({
      name: 'Ankr',
      url: `https://rpc.ankr.com/${chainSlug}/${env.apiKeys.ankr}`,
      priority: basePriority + 3,
      requiresAuth: true,
      type: 'premium'
    });
  }

  return endpoints.sort((a, b) => a.priority - b.priority);
}

/**
 * 获取经过验证的免费 RPC 节点
 * 基于 2026-02-02 生产环境测试结果
 */
function getVerifiedFreeEndpoints(chainSlug: string): { name: string; url: string }[] {
  const endpoints: Record<string, { name: string; url: string }[]> = {
    // ETH: PublicNode 100% 成功率
    'eth': [
      { name: 'PublicNode', url: 'https://ethereum-rpc.publicnode.com' },
      { name: 'DRPC', url: 'https://eth.drpc.org' },
    ],

    // Base: Official + Coinbase + PublicNode 都很稳定
    'base': [
      { name: 'Base Official', url: 'https://mainnet.base.org' },
      { name: 'Coinbase', url: 'https://api.developer.coinbase.com/rpc/v1/base/ilSV6rJjgR0WwRdvqjG5cL07exQrmr8t' },
      { name: 'PublicNode', url: 'https://base-rpc.publicnode.com' },
      { name: 'DRPC', url: 'https://base.drpc.org' },
    ],

    // BSC: Binance Official + Defibit 5/5 并发测试通过
    'bsc': [
      { name: 'Binance Official', url: 'https://bsc-dataseed.binance.org' },
      { name: 'Defibit-1', url: 'https://bsc-dataseed1.defibit.io' },
      { name: 'PublicNode', url: 'https://bsc-rpc.publicnode.com' },
    ],

    // Polygon: PublicNode 100% 成功率
    'polygon': [
      { name: 'PublicNode', url: 'https://polygon-bor-rpc.publicnode.com' },
      { name: 'DRPC', url: 'https://polygon.drpc.org' },
    ],

    // Arbitrum: PublicNode 100% 成功率
    'arbitrum': [
      { name: 'PublicNode', url: 'https://arbitrum-one-rpc.publicnode.com' },
      { name: 'DRPC', url: 'https://arbitrum.drpc.org' },
    ],

    // Optimism: PublicNode 100% 成功率
    'optimism': [
      { name: 'PublicNode', url: 'https://optimism-rpc.publicnode.com' },
      { name: 'DRPC', url: 'https://optimism.drpc.org' },
    ],
  };

  return endpoints[chainSlug] || [];
}




/**
 * Get Alchemy URL for a specific chain
 */
function getAlchemyUrl(chainSlug: string): string | null {
  const network = ALCHEMY_NETWORK_MAP[chainSlug];
  if (!network || !env.apiKeys.alchemy) return null;
  return `https://${network}.g.alchemy.com/v2/${env.apiKeys.alchemy}`;
}

const ALCHEMY_NETWORK_MAP: Record<string, string> = {
  'eth': 'eth-mainnet',
  'base': 'base-mainnet',
  'polygon': 'polygon-mainnet',
  'arbitrum': 'arb-mainnet',
  'optimism': 'opt-mainnet',
};

// ============================================================================
// DEXSCREENER API CONFIGURATION
// ============================================================================

export const DEXSCREENER_CONFIG = {
  baseUrl: 'https://api.dexscreener.com/latest/dex',
  tokenProfilesUrl: 'https://api.dexscreener.com/token-profiles/latest/v1',
  tokenBoostsUrl: 'https://api.dexscreener.com/token-boosts/top/v1',
  websocketUrl: 'wss://io.dexscreener.com/dex/screener/v5/pairs',

  // Rate limiting
  rateLimit: {
    requestsPerMinute: 300, // Free tier limit
    backoffMs: 1000, // Base backoff on rate limit
  },

  // Timeouts
  timeout: {
    rest: 10000, // 10 seconds for REST API
    websocket: 30000, // 30 seconds for WebSocket
  },

  // Chain mappings (DexScreener uses specific naming)
  chainMap: {
    'eth': 'ethereum',
    'ethereum': 'ethereum',
    'bsc': 'bsc',
    'base': 'base',
    'arbitrum': 'arbitrum',
    'optimism': 'optimism',
    'polygon': 'polygon',
    'avalanche': 'avalanche',
    'solana': 'solana',
  } as Record<string, string>,

  // Network reverse mapping
  networkMap: {
    'ethereum': 'eth',
    'bsc': 'bsc',
    'base': 'base',
    'arbitrum': 'arbitrum',
    'optimism': 'optimism',
    'polygon': 'polygon',
    'avalanche': 'avax',
    'solana': 'solana',
  } as Record<string, string>,
} as const;

// ============================================================================
// GECKOTERMINAL API CONFIGURATION
// ============================================================================

export const GECKOTERMINAL_CONFIG = {
  baseUrl: 'https://api.geckoterminal.com/api/v2',

  // Rate limiting
  rateLimit: {
    requestsPerMinute: 30, // Conservative limit for free tier
    burstRequests: 10, // Max burst requests
    backoffMs: 2000, // Base backoff on rate limit
  },

  // Timeouts
  timeout: {
    default: 30000, // 30 seconds
    search: 15000, // 15 seconds for search queries
  },

  // Retry configuration
  retry: {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
  },

  // Circuit breaker
  circuitBreaker: {
    failureThreshold: 5, // Open circuit after 5 failures
    resetTimeoutMs: 60000, // Reset after 60 seconds
  },

  // Network mappings (GeckoTerminal uses specific naming)
  networkMap: {
    'ethereum': 'eth',
    'eth': 'eth',
    'bsc': 'bsc',
    'base': 'base',
    'arbitrum': 'arbitrum',
    'optimism': 'optimism',
    'polygon': 'polygon-pos',
    'avalanche': 'avax',
    'solana': 'solana',
  } as Record<string, string>,
} as const;

// ============================================================================
// OTHER THIRD-PARTY API CONFIGURATIONS
// ============================================================================

export const KYBERSWAP_CONFIG = {
  baseUrl: 'https://aggregator-api.kyberswap.com',
  clientId: 'kiko-app',

  timeout: 10000, // 10 seconds

  // Chain naming for KyberSwap
  chainMap: {
    1: 'ethereum',
    56: 'bsc',
    137: 'polygon',
    10: 'optimism',
    42161: 'arbitrum',
    8453: 'base',
    43114: 'avalanche',
    250: 'fantom',
    59144: 'linea',
  } as Record<number, string>,
} as const;

export const ZEROX_CONFIG = {
  // 0x API endpoints by chain
  baseUrls: {
    1: 'https://api.0x.org',
    8453: 'https://base.api.0x.org',
    56: 'https://bsc.api.0x.org',
    137: 'https://polygon.api.0x.org',
    42161: 'https://arbitrum.api.0x.org',
    10: 'https://optimism.api.0x.org',
    43114: 'https://avalanche.api.0x.org',
  } as Record<number, string>,

  apiKey: env.apiKeys.zeroEx || '',
  timeout: 10000, // 10 seconds
} as const;

export const INFURA_GAS_CONFIG = {
  baseUrl: 'https://gas.api.infura.io',
  apiKey: env.apiKeys.infuraGas || '',
  timeout: 5000, // 5 seconds
} as const;

// ============================================================================
// BLOCKCHAIN EXPLORER APIS
// ============================================================================

/**
 * Etherscan V2 API (unified for all EVM chains)
 * https://docs.etherscan.io/v2/
 */
export const ETHERSCAN_CONFIG = {
  baseUrl: 'https://api.etherscan.io/v2/api',
  apiKey: env.apiKeys.etherscan || '',

  timeout: 10000, // 10 seconds
  rateLimit: {
    requestsPerSecond: 5, // Free tier: 5 req/sec
    backoffMs: 200,
  },

  // V2 API: Single URL works for all chains via chainId parameter
  // Example: https://api.etherscan.io/v2/api?chainid=1&...
  // Legacy V1 endpoints for chains without V2 support:
  legacyUrls: {
    'ethereum': 'https://api.etherscan.io/api',
    'base': 'https://api.basescan.org/api',
    'polygon': 'https://api.polygonscan.com/api',
    'arbitrum': 'https://api.arbiscan.io/api',
    'optimism': 'https://api-optimistic.etherscan.io/api',
    'bsc': 'https://api.bscscan.com/api',
  } as Record<string, string>,
} as const;

/**
 * RouteScan API (Multi-chain explorer)
 * Free tier, supports many L2s
 */
export const ROUTESCAN_CONFIG = {
  baseUrl: 'https://api.routescan.io/v2/network',
  apiKey: env.apiKeys.routescan || '',

  timeout: 10000, // 10 seconds

  chainMap: {
    'ethereum': 'mainnet/evm/1/etherscan',
    'eth': 'mainnet/evm/1/etherscan',
    'base': 'base/evm/8453/etherscan',
    'polygon': 'polygon/evm/137/etherscan',
    'arbitrum': 'arbitrum/evm/42161/etherscan',
    'optimism': 'optimism/evm/10/etherscan',
    'bsc': 'bnb/evm/56/etherscan',
    'linea': 'linea/evm/59144/etherscan',
    'avalanche': 'avalanche/evm/43114/etherscan',
  } as Record<string, string>,
} as const;

/**
 * Blockscout API (Multi-chain explorer)
 * Free tier, Etherscan V1 compatible
 */
export const BLOCKSCOUT_CONFIG = {
  baseUrl: 'https://blockscout.com/api',
  apiKey: env.apiKeys.blockscout || '',

  timeout: 10000, // 10 seconds

  chainUrls: {
    'ethereum': 'https://eth.blockscout.com/api',
    'base': 'https://base.blockscout.com/api',
    'polygon': 'https://polygon.blockscout.com/api',
    'bsc': 'https://bsc.blockscout.com/api',
    'arbitrum': 'https://arbitrum.blockscout.com/api',
    'optimism': 'https://optimism.blockscout.com/api',
    'linea': 'https://linea.blockscout.com/api',
    'avalanche': 'https://snowtrace.io/api',
  } as Record<string, string>,
} as const;

/**
 * Solscan API (Solana explorer)
 * Paid tier required, best for Solana data
 */
export const SOLSCAN_CONFIG = {
  baseUrl: 'https://pro-api.solscan.io/v2.0',
  apiKey: env.apiKeys.solscan || '',

  timeout: 15000, // 15 seconds for Solana
  rateLimit: {
    requestsPerSecond: 2,
    backoffMs: 500,
  },

  endpoints: {
    transactions: '/transaction/list',
    tokenTransfers: '/token/transfer',
    accountInfo: '/account/info',
  } as Record<string, string>,
} as const;

/**
 * Moralis API (Token balances and PNL)
 * Supports EVM chains for wallet data
 */
export const MORALIS_CONFIG = {
  baseUrl: 'https://deep-index.moralis.io/api/v2.2',
  apiKey: env.apiKeys.moralis || '',

  timeout: 30000, // 30 seconds for PNL queries

  supportedChains: [1, 137, 8453], // Eth, Polygon, Base

  endpoints: {
    profitability: '/wallets/{address}/profitability',
    tokenBalances: '/wallets/{address}/tokens',
    transactions: '/wallets/{address}/transactions',
  } as Record<string, string>,
} as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get all RPC URLs for a chain (for backward compatibility)
 */
export function getRpcUrlsArray(chainSlug: string, primaryUrl?: string): string[] {
  return getRpcEndpoints(chainSlug, primaryUrl).map(e => e.url);
}

/**
 * Validate and normalize chain identifier
 */
export function normalizeChainSlug(chain: string): string {
  const normalized = chain.toLowerCase().trim();

  // Handle common aliases
  const aliases: Record<string, string> = {
    'ethereum': 'eth',
    'binance': 'bsc',
    'bnb': 'bsc',
    'polygon-pos': 'polygon',
    'arb': 'arbitrum',
    'op': 'optimism',
    'avax': 'avalanche',
    'sol': 'solana',
  };

  return aliases[normalized] || normalized;
}

/**
 * Check if API requires authentication
 */
export function requiresAuthentication(url: string): boolean {
  return url.includes('alchemy.com') ||
    url.includes('infura.io') ||
    url.includes('ankr.com') ||
    url.includes('helius') ||
    url.includes('quicknode');
}

/**
 * Get endpoint name from URL
 */
export function getEndpointName(url: string): string {
  if (url.includes('alchemy.com')) return 'Alchemy';
  if (url.includes('infura.io')) return 'Infura';
  if (url.includes('ankr.com')) return 'Ankr';
  if (url.includes('drpc.org')) return 'DRPC';
  if (url.includes('publicnode.com')) return 'PublicNode';
  if (url.includes('helius')) return 'Helius';
  if (url.includes('quicknode')) return 'QuickNode';
  return 'Custom';
}
