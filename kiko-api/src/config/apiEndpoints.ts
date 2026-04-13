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
  type: 'premium' | 'public_free' | 'fallback';
  limits?: RpcEndpointLimits;
  weight?: number; // Optional weight for selection (higher = preferred)
  capabilities?: RpcEndpointCapabilities; // Optional method capability hints
}

export type RpcExecutionLane = 'cheap' | 'critical';

export interface RpcEndpointLimits {
  rps?: number; // Requests per second
  rpm?: number; // Requests per minute
  maxInFlight?: number; // Max concurrent in-flight requests
}

export interface RpcEndpointCapabilities {
  // Methods that require this endpoint (e.g., Helius DAS)
  methods?: string[];
}

export const HELIUS_CONNECT_SRC = 'https://*.helius-rpc.com';

const DEFAULT_PUBLIC_RPS = parseInt(process.env.RPC_PUBLIC_RPS || '5', 10);
const DEFAULT_PUBLIC_RPM = parseInt(process.env.RPC_PUBLIC_RPM || '300', 10);
const DEFAULT_PUBLIC_MAX_INFLIGHT = parseInt(process.env.RPC_PUBLIC_MAX_INFLIGHT || '50', 10);

const DEFAULT_PREMIUM_RPS = parseInt(process.env.RPC_PREMIUM_RPS || '50', 10);
const DEFAULT_PREMIUM_RPM = parseInt(process.env.RPC_PREMIUM_RPM || '3000', 10);
const DEFAULT_PREMIUM_MAX_INFLIGHT = parseInt(process.env.RPC_PREMIUM_MAX_INFLIGHT || '150', 10);

const DEFAULT_FALLBACK_RPS = parseInt(process.env.RPC_FALLBACK_RPS || '2', 10);
const DEFAULT_FALLBACK_RPM = parseInt(process.env.RPC_FALLBACK_RPM || '120', 10);
const DEFAULT_FALLBACK_MAX_INFLIGHT = parseInt(process.env.RPC_FALLBACK_MAX_INFLIGHT || '25', 10);

function getDefaultLimits(type: RpcEndpointConfig['type']): RpcEndpointLimits {
  if (type === 'premium') {
    return { rps: DEFAULT_PREMIUM_RPS, rpm: DEFAULT_PREMIUM_RPM, maxInFlight: DEFAULT_PREMIUM_MAX_INFLIGHT };
  }
  if (type === 'fallback') {
    return { rps: DEFAULT_FALLBACK_RPS, rpm: DEFAULT_FALLBACK_RPM, maxInFlight: DEFAULT_FALLBACK_MAX_INFLIGHT };
  }
  return { rps: DEFAULT_PUBLIC_RPS, rpm: DEFAULT_PUBLIC_RPM, maxInFlight: DEFAULT_PUBLIC_MAX_INFLIGHT };
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
  if (chainSlug === 'base') {
    return getBasePreferredEndpoints(primaryUrl);
  }
  if (chainSlug === 'solana') {
    return getSolanaEndpoints(primaryUrl, 'cheap');
  }

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
      type: 'public_free',
      limits: getDefaultLimits('public_free')
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
      type: 'premium',
      limits: getDefaultLimits('premium')
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
        type: 'premium',
        limits: getDefaultLimits('premium')
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
      type: 'premium',
      limits: getDefaultLimits('premium')
    });
  }

  return endpoints.sort((a, b) => a.priority - b.priority);
}

export function getRpcEndpointsWithStrategy(
  chainSlug: string,
  strategy: 'fast' | 'cheap' = 'cheap',
  primaryUrl?: string
): RpcEndpointConfig[] {
  return getRpcEndpointsForLane(chainSlug, strategy === 'fast' ? 'critical' : 'cheap', primaryUrl);
}

export function getRpcEndpointsForLane(
  chainSlug: string,
  lane: RpcExecutionLane = 'cheap',
  primaryUrl?: string
): RpcEndpointConfig[] {
  if (lane === 'cheap') {
    if (chainSlug === 'solana') {
      return getSolanaEndpoints(primaryUrl, 'cheap');
    }
    if (chainSlug === 'base') {
      return getBaseCheapEndpoints(primaryUrl);
    }
    if (chainSlug === 'bsc') {
      return getBscCheapEndpoints(primaryUrl);
    }
    return getRpcEndpoints(chainSlug, primaryUrl);
  }

  const preferPremiumDefault = 'true';
  const onlyPremiumDefault = chainSlug === 'eth' ? 'true' : 'false';
  const preferPremium = (process.env.RPC_FAST_PREFER_PREMIUM || preferPremiumDefault).toLowerCase() === 'true';
  const onlyPremium = (process.env.RPC_FAST_ONLY_PREMIUM || onlyPremiumDefault).toLowerCase() === 'true';
  const override = getFastOverride(chainSlug);
  if (override.length > 0) {
    return override;
  }
  if (chainSlug === 'solana') {
    return getSolanaEndpoints(primaryUrl, 'fast');
  }
  if (chainSlug === 'base') {
    const list = getBasePreferredEndpoints(primaryUrl);
    const ordered = preferPremium ? prioritizePremium(list) : list;
    if (onlyPremium) {
      const premium = ordered.filter(e => e.type === 'premium');
      return premium.length > 0 ? premium : ordered;
    }
    return ordered;
  }
	if (chainSlug === 'bsc') {
	  const list = getBscPreferredEndpoints(primaryUrl);
	  const ordered = preferPremium ? prioritizePremium(list) : list;
	  if (onlyPremium) {
	    const premium = ordered.filter(e => e.type === 'premium');
	    return premium.length > 0 ? premium : ordered;
	  }
	  return ordered;
	}

	const list = getGenericCriticalEndpoints(chainSlug, primaryUrl);
	const ordered = preferPremium ? prioritizePremium(list) : list;
	if (onlyPremium) {
	  const premium = ordered.filter(e => e.type === 'premium');
	  return premium.length > 0 ? premium : ordered;
	}
  return ordered;
}

function getBscPreferredEndpoints(primaryUrl?: string): RpcEndpointConfig[] {
  const endpoints: RpcEndpointConfig[] = [];
  let priority = 1;
  const push = (name: string, url?: string, requiresAuth = false, type: 'premium' | 'public_free' | 'fallback' = 'public_free') => {
    if (!url) return;
    endpoints.push({ name, url, priority: priority++, requiresAuth, type, limits: getDefaultLimits(type) });
  };

  if (primaryUrl) push('Primary', primaryUrl, true, 'premium');
  if (env.apiKeys.alchemy) push('Alchemy', getAlchemyUrl('bsc') || undefined, true, 'premium');
  if (env.apiKeys.ankr) push('Ankr', `https://rpc.ankr.com/bsc/${env.apiKeys.ankr}`, true, 'premium');

  push('PublicNode', 'https://bsc-rpc.publicnode.com', false, 'public_free');
  push('Binance Dataseed', 'https://bsc-dataseed.binance.org', false, 'public_free');
  push('DRPC', 'https://bsc.drpc.org', false, 'public_free');

  const seen = new Set<string>();
  return endpoints.filter(ep => {
    if (seen.has(ep.url)) return false;
    seen.add(ep.url);
    return true;
  });
}

function getBscCheapEndpoints(primaryUrl?: string): RpcEndpointConfig[] {
  const endpoints: RpcEndpointConfig[] = [];
  let priority = 1;
  const push = (name: string, url?: string, requiresAuth = false, type: 'premium' | 'public_free' | 'fallback' = 'public_free') => {
    if (!url) return;
    endpoints.push({ name, url, priority: priority++, requiresAuth, type, limits: getDefaultLimits(type) });
  };

  push('PublicNode', 'https://bsc-rpc.publicnode.com', false, 'public_free');
  push('Binance Dataseed', 'https://bsc-dataseed.binance.org', false, 'public_free');
  push('DRPC', 'https://bsc.drpc.org', false, 'public_free');

  if (primaryUrl) push('Primary', primaryUrl, true, 'premium');
  if (env.apiKeys.alchemy) push('Alchemy', getAlchemyUrl('bsc') || undefined, true, 'premium');
  if (env.apiKeys.ankr) push('Ankr', `https://rpc.ankr.com/bsc/${env.apiKeys.ankr}`, true, 'premium');

  const seen = new Set<string>();
  return endpoints.filter(ep => {
    if (seen.has(ep.url)) return false;
    seen.add(ep.url);
    return true;
  });
}

function prioritizePremium(endpoints: RpcEndpointConfig[]): RpcEndpointConfig[] {
  const premium = endpoints.filter(e => e.type === 'premium');
  const rest = endpoints.filter(e => e.type !== 'premium');
  const ordered = [...premium, ...rest];
  return ordered.map((ep, idx) => ({ ...ep, priority: idx + 1 }));
}

function getGenericCriticalEndpoints(chainSlug: string, primaryUrl?: string): RpcEndpointConfig[] {
  const endpoints: RpcEndpointConfig[] = [];
  let priority = 1;
  const push = (name: string, url?: string, requiresAuth = false, type: 'premium' | 'public_free' | 'fallback' = 'public_free') => {
    if (!url) return;
    endpoints.push({ name, url, priority: priority++, requiresAuth, type, limits: getDefaultLimits(type) });
  };

  if (primaryUrl) {
    push('Primary', primaryUrl, true, 'premium');
  }

  const alchemyUrl = getAlchemyUrl(chainSlug);
  if (env.apiKeys.alchemy && alchemyUrl && alchemyUrl !== primaryUrl) {
    push('Alchemy', alchemyUrl, true, 'premium');
  }

  if (env.apiKeys.ankr) {
    push('Ankr', `https://rpc.ankr.com/${chainSlug}/${env.apiKeys.ankr}`, true, 'premium');
  }

  const freeEndpoints = getVerifiedFreeEndpoints(chainSlug);
  freeEndpoints.forEach((ep) => {
    push(ep.name, ep.url, false, 'public_free');
  });

  const seen = new Set<string>();
  return endpoints.filter(ep => {
    if (seen.has(ep.url)) return false;
    seen.add(ep.url);
    return true;
  });
}

function getFastOverride(chainSlug: string): RpcEndpointConfig[] {
  const key = `RPC_FAST_OVERRIDE_${chainSlug.toUpperCase()}`;
  const raw = (process.env as Record<string, string | undefined>)[key];
  if (!raw) return [];
  const urls = raw.split(',').map(s => s.trim()).filter(Boolean);
  return urls.map((url, idx) => ({
    name: `Override-${idx + 1}`,
    url,
    priority: idx + 1,
    requiresAuth: true,
    type: 'premium',
    limits: getDefaultLimits('premium')
  }));
}

function getBasePreferredEndpoints(primaryUrl?: string): RpcEndpointConfig[] {
  const endpoints: RpcEndpointConfig[] = [];
  let priority = 1;

  const push = (name: string, url?: string, requiresAuth = false, type: 'premium' | 'public_free' | 'fallback' = 'public_free') => {
    if (!url) return;
    endpoints.push({ name, url, priority: priority++, requiresAuth, type, limits: getDefaultLimits(type) });
  };

  // Preferred order (most stable)
  // Alchemy/Primary -> DRPC -> PublicNode -> Base Official -> Coinbase -> Ankr -> Infura
  if (env.apiKeys.alchemy) {
    push('Alchemy', getAlchemyUrl('base') || undefined, true, 'premium');
  }

  if (primaryUrl) {
    push('Primary', primaryUrl, true, 'premium');
  }

  push('DRPC', 'https://base.drpc.org', false, 'public_free');
  push('PublicNode', 'https://base-rpc.publicnode.com', false, 'public_free');
  push('Base Official', 'https://mainnet.base.org', false, 'public_free');
  push('Coinbase', 'https://api.developer.coinbase.com/rpc/v1/base/ilSV6rJjgR0WwRdvqjG5cL07exQrmr8t', true, 'premium');

  if (env.apiKeys.ankr) {
    push('Ankr', `https://rpc.ankr.com/base/${env.apiKeys.ankr}`, true, 'premium');
  }

  if (env.apiKeys.infura) {
    push('Infura', `https://base-mainnet.infura.io/v3/${env.apiKeys.infura}`, true, 'premium');
  }

  // Deduplicate by URL (preserve priority)
  const seen = new Set<string>();
  return endpoints.filter(ep => {
    if (seen.has(ep.url)) return false;
    seen.add(ep.url);
    return true;
  });
}

function getBaseCheapEndpoints(primaryUrl?: string): RpcEndpointConfig[] {
  const endpoints: RpcEndpointConfig[] = [];
  let priority = 1;

  const push = (name: string, url?: string, requiresAuth = false, type: 'premium' | 'public_free' | 'fallback' = 'public_free') => {
    if (!url) return;
    endpoints.push({ name, url, priority: priority++, requiresAuth, type, limits: getDefaultLimits(type) });
  };

  // Cheap-first order: stable public endpoints -> premium fallbacks
  push('DRPC', 'https://base.drpc.org', false, 'public_free');
  push('PublicNode', 'https://base-rpc.publicnode.com', false, 'public_free');
  push('Base Official', 'https://mainnet.base.org', false, 'public_free');

  if (primaryUrl) {
    push('Primary', primaryUrl, true, 'premium');
  }

  if (env.apiKeys.alchemy) {
    push('Alchemy', getAlchemyUrl('base') || undefined, true, 'premium');
  }

  if (env.apiKeys.ankr) {
    push('Ankr', `https://rpc.ankr.com/base/${env.apiKeys.ankr}`, true, 'premium');
  }

  if (env.apiKeys.infura) {
    push('Infura', `https://base-mainnet.infura.io/v3/${env.apiKeys.infura}`, true, 'premium');
  }

  const seen = new Set<string>();
  return endpoints.filter(ep => {
    if (seen.has(ep.url)) return false;
    seen.add(ep.url);
    return true;
  });
}

function getSolanaEndpoints(primaryUrl?: string, strategy: 'fast' | 'cheap' = 'cheap'): RpcEndpointConfig[] {
  const endpoints: RpcEndpointConfig[] = [];
  let priority = 1;

  const push = (
    name: string,
    url?: string,
    requiresAuth = false,
    type: 'premium' | 'public_free' | 'fallback' = 'public_free',
    capabilities?: RpcEndpointCapabilities
  ) => {
    if (!url) return;
    endpoints.push({
      name,
      url,
      priority: priority++,
      requiresAuth,
      type,
      limits: getDefaultLimits(type),
      capabilities
    });
  };

  const premiumFirst = strategy === 'fast';

  if (premiumFirst) {
    // fast/critical: paid nodes first for lowest latency on copytrade/sniper paths
    if (primaryUrl) {
      push('Primary', primaryUrl, true, 'premium');
    }
    if (env.apiKeys.helius) {
      push(
        'Helius',
        `https://mainnet.helius-rpc.com/?api-key=${env.apiKeys.helius}`,
        true,
        'premium',
        { methods: ['getAsset', 'getAssetsByOwner', 'getAssetBatch'] }
      );
    }
    if (env.apiKeys.alchemy) {
      push('Alchemy', `https://solana-mainnet.g.alchemy.com/v2/${env.apiKeys.alchemy}`, true, 'premium');
    }
    // Public as backup
    push('PublicNode', 'https://solana-rpc.publicnode.com', false, 'public_free');
    push('Ankr Public', 'https://rpc.ankr.com/solana', false, 'public_free');
    push('Solana Official', 'https://api.mainnet-beta.solana.com', false, 'public_free');
    push('DRPC', 'https://solana.drpc.org', false, 'fallback');
  } else {
    // cheap: public nodes first to conserve paid quota
    push('PublicNode', 'https://solana-rpc.publicnode.com', false, 'public_free');
    push('Ankr Public', 'https://rpc.ankr.com/solana', false, 'public_free');
    push('Solana Official', 'https://api.mainnet-beta.solana.com', false, 'public_free');
    push('DRPC', 'https://solana.drpc.org', false, 'fallback');
    if (primaryUrl) {
      push('Primary', primaryUrl, true, 'premium');
    }
    if (env.apiKeys.alchemy) {
      push('Alchemy', `https://solana-mainnet.g.alchemy.com/v2/${env.apiKeys.alchemy}`, true, 'premium');
    }
    if (env.apiKeys.helius) {
      push(
        'Helius',
        `https://mainnet.helius-rpc.com/?api-key=${env.apiKeys.helius}`,
        true,
        'premium',
        { methods: ['getAsset', 'getAssetsByOwner', 'getAssetBatch'] }
      );
    }
  }

  const seen = new Set<string>();
  return endpoints.filter(ep => {
    if (seen.has(ep.url)) return false;
    seen.add(ep.url);
    return true;
  });
}

export function getFlashbotsEndpoints(): RpcEndpointConfig[] {
  const limits = getDefaultLimits('premium');
  return [
    {
      name: 'Flashbots Protect',
      url: 'https://rpc.flashbots.net',
      priority: 1,
      requiresAuth: false,
      type: 'premium',
      limits
    },
    {
      name: 'Flashbots Protect Fast',
      url: 'https://rpc.flashbots.net/fast',
      priority: 2,
      requiresAuth: false,
      type: 'premium',
      limits
    }
  ];
}

/**
 * 获取经过验证的免费 RPC 节点
 * 基于 2026-02-02 生产环境测试结果
 */
export function getVerifiedFreeEndpoints(chainSlug: string): { name: string; url: string }[] {
  const endpoints: Record<string, { name: string; url: string }[]> = {
    // ETH: diversify public reads to avoid single-endpoint exhaustion.
    'eth': [
      { name: 'DRPC', url: 'https://eth.drpc.org' },
      { name: 'LlamaRPC', url: 'https://eth.llamarpc.com' },
      { name: '1RPC', url: 'https://1rpc.io/eth' },
      { name: 'MEV Blocker', url: 'https://rpc.mevblocker.io' },
      { name: 'PublicNode', url: 'https://ethereum-rpc.publicnode.com' },
    ],

    // Base: DRPC/PublicNode are generally more stable than rate-limited public endpoints
    'base': [
      { name: 'DRPC', url: 'https://base.drpc.org' },
      { name: 'PublicNode', url: 'https://base-rpc.publicnode.com' },
      { name: 'Base Official', url: 'https://mainnet.base.org' },
    ],

    // BSC: PublicNode/Defibit are more stable under load than binance dataseed
    'bsc': [
      { name: 'PublicNode', url: 'https://bsc-rpc.publicnode.com' },
      { name: 'Defibit-1', url: 'https://bsc-dataseed1.defibit.io' },
      { name: 'Binance Official', url: 'https://bsc-dataseed.binance.org' },
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

    // Solana: Public endpoints
    'solana': [
      { name: 'PublicNode', url: 'https://solana-rpc.publicnode.com' },
      { name: 'Solana Official', url: 'https://api.mainnet-beta.solana.com' },
      { name: 'DRPC', url: 'https://solana.drpc.org' },
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
  'bsc': 'bnb-mainnet',
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
    topGainers: '/erc20/{address}/top-gainers',
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

export function getRpcUrlsArrayWithStrategy(
  chainSlug: string,
  strategy: 'fast' | 'cheap' = 'cheap',
  primaryUrl?: string
): string[] {
  return getRpcEndpointsWithStrategy(chainSlug, strategy, primaryUrl).map(e => e.url);
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
