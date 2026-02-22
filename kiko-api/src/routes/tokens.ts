/**
 * Token Data API Routes
 * Fast API calls with short-term caching (10-30 seconds)
 * 
 * Supported chains: eth, base, bsc, arbitrum
 */

import { FastifyInstance } from 'fastify';
import { searchTokens as searchGeckoTerminal, getTokenDetails as getGeckoTokenDetails, getCandlestickData as getGeckoCandlestickData, getTrendingTokens as getLiveTrendingTokens, type TrendingDuration } from '../services/geckoTerminal.js';
import { searchTokens as searchDexScreener, getTokenDetails as getDexTokenDetails, getTokenPairAddress, getCandlestickData as getDexCandlestickData, getTrendingTokensPremium } from '../services/dexscreener.js';
import { get, set } from '../cache/cacheClient.js';
import { getTrendingTokens, getLastUpdateTime as getTrendingUpdateTime, saveTrendingTokenCreator } from '../repositories/tokenRepository.js';
import { getSupportedChains, refreshSingleChain } from '../jobs/tokenDataJob.js';
import { env } from '../config/env.js';
import { fetchJson } from '../config/unifiedApiService.js';
import { batchRpcCall } from '../utils/batchRpcUtils.js';
import { AppError, handleExternalApiError } from '../middleware/errorHandler.js';
import { sanitizeString, validateNetwork, validateAddress, validateLimit, validateTimeframe } from '../utils/validation.js';
import { detectLaunchpadToken } from '../services/ai/launchpadDetector.js';
import * as tokenAnalysis from '../services/tokenAnalysis.js';
import { getHolderCount } from '../services/goPlus.js';
import { getTokenSecurity } from '../services/tokenSecurity.js';
import { validateTrendingTokenForListing } from '../services/trendingValidation.js';

const GECKO_TERMINAL_BASE_URL = 'https://api.geckoterminal.com/api/v2';

// Short-term cache TTL
const TOKEN_CACHE_TTL = env.cacheConfig.defaultTtl;

// Supported trending durations
const SUPPORTED_DURATIONS: TrendingDuration[] = ['5m', '1h', '6h', '24h'];

// Supported chains for trending tokens
const SUPPORTED_CHAINS_INFO = [
  { id: 'eth', name: 'Ethereum', network: 'eth' },
  { id: 'base', name: 'Base', network: 'base' },
  { id: 'bsc', name: 'BNB Smart Chain', network: 'bsc' },
  { id: 'arbitrum', name: 'Arbitrum', network: 'arbitrum' },
  { id: 'solana', name: 'Solana', network: 'solana' },
  { id: 'optimism', name: 'Optimism', network: 'optimism' },
  { id: 'polygon', name: 'Polygon', network: 'polygon' },
];

function chainFromId(chainId?: number): string | undefined {
  if (!Number.isFinite(chainId || NaN)) return undefined;
  switch (Number(chainId)) {
    case 1: return 'eth';
    case 10: return 'optimism';
    case 56: return 'bsc';
    case 137: return 'polygon';
    case 42161: return 'arbitrum';
    case 8453: return 'base';
    case 900: return 'solana';
    case 101: return 'solana';
    default: return undefined;
  }
}

const SEARCH_ALLOWED_NETWORKS = [
  'eth', 'ethereum',
  'base',
  'bsc', 'binance-smart-chain',
  'arbitrum',
  'optimism',
  'polygon',
  'avax', 'avalanche',
  'fantom',
  'solana',
];

const TRENDING_LIVE_CACHE_VERSION = 'v2';

function sanitizeTrendingPayload(chain: string, rows: any[]): any[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter((token) => validateTrendingTokenForListing(chain, token).ok);
}

function stripLaunchMultiples(rows: any[]): any[] {
  return rows;
}

function hasLaunchpadOrCreatorMetadata(rows: any[]): boolean {
  if (!Array.isArray(rows)) return false;
  return rows.some((row) => {
    if (!row || typeof row !== 'object') return false;
    return Boolean(
      (row as any).launchpad
      || (row as any).creatorAddress
      || (row as any).creatorUrl
      || (row as any).creatorLabel
    );
  });
}

function tokenMetaCacheKey(chain: string, address: string): string {
  return `token:meta:v2:${chain}:${address.toLowerCase()}`;
}

function tokenMetaLegacyCacheKey(chain: string, address: string): string {
  return `token:meta:v1:${chain}:${address.toLowerCase()}`;
}

function initialPoolCacheKey(chain: string, address: string): string {
  return `token:initial_pool:v2:${chain}:${address.toLowerCase()}`;
}

async function hydrateTrendingMetadata(chain: string, rows: any[]): Promise<any[]> {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  await Promise.all(rows.map(async (row) => {
    try {
      if (!row || typeof row !== 'object') return;
      const address = typeof row.address === 'string' ? row.address : '';
      if (!address) return;

      let raw = await get(tokenMetaCacheKey(chain, address));
      if (!raw) raw = await get(tokenMetaLegacyCacheKey(chain, address));
      if (raw) {
        const meta = JSON.parse(raw) as { creatorAddress?: string; creatorUrl?: string; creatorLabel?: string; launchMultiple?: number; cacheVersion?: number };
        if (meta?.creatorAddress && !row.creatorAddress) row.creatorAddress = meta.creatorAddress;
        if (meta?.creatorUrl && !row.creatorUrl) row.creatorUrl = meta.creatorUrl;
        if (meta?.creatorLabel && !row.creatorLabel) row.creatorLabel = meta.creatorLabel;
      }
      const initialPoolRaw = await get(initialPoolCacheKey(chain, address));
      if (initialPoolRaw) {
        const initialPool = JSON.parse(initialPoolRaw) as {
          initialPoolAddress?: string;
          initialPoolCreatedAt?: string;
          initialLiquidityUsd?: number;
          source?: string;
          capturedAt?: number;
        };
        if (initialPool?.initialPoolAddress) row.initialPoolAddress = initialPool.initialPoolAddress;
        if (initialPool?.initialPoolCreatedAt) row.initialPoolCreatedAt = initialPool.initialPoolCreatedAt;
        if (Number.isFinite(Number(initialPool?.initialLiquidityUsd || 0)) && Number(initialPool?.initialLiquidityUsd || 0) > 0) {
          row.initialLiquidityUsd = Number(initialPool?.initialLiquidityUsd);
        }
        if (initialPool?.source) row.initialPoolSource = initialPool.source;
      }
    } catch {
      // best-effort hydration only
    }
  }));

  return rows;
}

export async function tokenRoutes(fastify: FastifyInstance) {
  const REFRESH_WAIT_TIMEOUT_MS = Math.max(
    5000,
    Number(process.env.TRENDING_REFRESH_WAIT_TIMEOUT_MS || '25000')
  );
  async function refreshWithTimeout(chain: string, force: boolean): Promise<boolean | null> {
    const timeout = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), REFRESH_WAIT_TIMEOUT_MS);
    });
    const task = refreshSingleChain(chain, force)
      .then((ok) => ok)
      .catch(() => false);
    return Promise.race([task, timeout]);
  }

  // GET /api/tokens/chains - Get list of supported chains
  fastify.get('/chains', async (request, reply) => {
    return reply.send({
      success: true,
      data: SUPPORTED_CHAINS_INFO,
      count: SUPPORTED_CHAINS_INFO.length,
    });
  });

  // GET /api/tokens/trending/live - Get trending tokens (DATABASE-FIRST)
  // Reads from Redis cache or PostgreSQL. NEVER calls external API directly.
  // Data is populated by background job (tokenDataJob.ts) every 5 minutes.
  fastify.get('/trending/live', async (request, reply) => {
    try {
      const { chain = 'eth', duration = '24h', limit = '50' } = request.query as {
        chain?: string;
        duration?: string;
        limit?: string;
        strict?: string;
      };
      // Keep trending/live stable and fast: never force DB-only read from request params.
      const strictMode = false;

      // Validate duration
      const validDuration = SUPPORTED_DURATIONS.includes(duration as TrendingDuration)
        ? duration as TrendingDuration
        : '24h';

      const tokenLimit = Math.min(parseInt(limit, 10) || 50, 100);

      // Step 1: PostgreSQL database (populated by background job)
      let dbTokens = await getTrendingTokens(chain, tokenLimit, {
        bypassMemoryCache: strictMode,
        lightweight: true,
      });
      stripLaunchMultiples(dbTokens);
      if (dbTokens.length > 0) {
        return reply.send({
          success: true,
          data: dbTokens,
          count: dbTokens.length,
          duration: validDuration,
          chain: chain,
          cached: false,
          source: 'database',
        });
      }

      // Step 2: Database is empty or stale - refresh once and return DB results
      const lastUpdate = await getTrendingUpdateTime(chain);
      const isStale = !lastUpdate || (Date.now() - lastUpdate.getTime()) > 10 * 60 * 1000;
      if (isStale) {
        // Do not block request path on full-chain refresh.
        // Kick off background refresh and return current DB state.
        void refreshSingleChain(chain).catch(() => undefined);
        dbTokens = await getTrendingTokens(chain, tokenLimit, {
          bypassMemoryCache: strictMode,
          lightweight: true,
        });
        stripLaunchMultiples(dbTokens);
      }

      if (dbTokens.length > 0) {
        return reply.send({
          success: true,
          data: dbTokens,
          count: dbTokens.length,
          duration: validDuration,
          chain: chain,
          cached: false,
          source: 'database',
        });
      }

      // Step 3: Still empty
      return reply.send({
        success: true,
        data: [],
        count: 0,
        duration: validDuration,
        chain: chain,
        cached: false,
        source: 'empty',
        message: 'Data is being prepared. Please refresh in a few seconds.',
      });
    } catch (error) {
      throw handleExternalApiError(error as Error, 'Token Data');
    }
  });


  // GET /api/tokens/trending/all - Get trending tokens from all chains
  fastify.get('/trending/all', async (request, reply) => {
    try {
      const { limit = '20' } = request.query as { limit?: string };
      const tokenLimit = Math.min(parseInt(limit, 10) || 20, 50);

      // Fetch tokens from all chains in parallel
      const chainPromises = SUPPORTED_CHAINS_INFO.map(async (chain) => {
        const tokens = await getTrendingTokens(chain.id, tokenLimit, {
          lightweight: true,
        });
        return {
          chain: chain.id,
          chainName: chain.name,
          tokens: tokens,
          count: tokens.length,
        };
      });

      const results = await Promise.all(chainPromises);

      // Calculate total count
      const totalCount = results.reduce((sum, r) => sum + r.count, 0);

      return reply.send({
        success: true,
        data: results,
        totalCount: totalCount,
        chains: SUPPORTED_CHAINS_INFO.length,
      });
    } catch (error) {
      throw error;
    }
  });

  // GET /api/tokens/trending?chain=eth
  fastify.get('/trending', async (request, reply) => {
    try {
      const { chain = 'eth' } = request.query as { chain?: string };

      // Get trending tokens from database/cache
      let tokens = await getTrendingTokens(chain, 50);
      if (tokens.length === 0) {
        await refreshSingleChain(chain);
        tokens = await getTrendingTokens(chain, 50);
      }

      return reply.send({
        success: true,
        data: tokens,
        count: tokens.length,
      });
    } catch (error) {
      throw error;
    }
  });

  // POST /api/tokens/trending/refresh - Manually trigger refresh for a specific chain
  fastify.post('/trending/refresh', async (request, reply) => {
    try {
      const body = (request.body || {}) as { chain?: string };
      const query = (request.query || {}) as { chain?: string; wait?: string | boolean };
      const chain = (query.chain || body.chain || 'eth').toLowerCase();
      const force = String((query as any).force || (body as any).force || 'true').toLowerCase() === 'true';
      const wait = String((query as any).wait || (body as any).wait || 'false').toLowerCase() === 'true';

      // Validate chain
      const supportedChains = getSupportedChains();
      if (!supportedChains.includes(chain)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid chain',
          message: `Chain "${chain}" is not supported. Supported chains: ${supportedChains.join(', ')}`,
        });
      }

      // Default mode is async trigger, so this endpoint never hits request timeout.
      if (!wait) {
        void refreshSingleChain(chain, force).catch(() => undefined);
        return reply.status(202).send({
          success: true,
          accepted: true,
          message: `Refresh triggered for ${chain}`,
          chain,
          wait: false,
        });
      }

      // Optional blocking mode for debugging (bounded by timeout).
      const success = await refreshWithTimeout(chain, force);
      if (success === null) {
        return reply.status(202).send({
          success: true,
          accepted: true,
          message: `Refresh still running for ${chain}; timed out waiting at ${REFRESH_WAIT_TIMEOUT_MS}ms`,
          chain,
          wait: true,
          timeoutMs: REFRESH_WAIT_TIMEOUT_MS,
        });
      }

      if (!success) {
        return reply.status(409).send({
          success: false,
          error: 'Refresh skipped or failed',
          message: `No DB update was written for chain: ${chain}. Another refresh may be in progress or upstream data was unavailable.`,
          chain,
        });
      }

      // Get the refreshed tokens count
      const tokens = await getTrendingTokens(chain, 50);

      return reply.send({
        success: true,
        message: `Refreshed trending tokens for ${chain}`,
        count: tokens.length,
        chain: chain,
      });
    } catch (error) {
      throw error;
    }
  });

  // GET /api/tokens/search?q=query&network=eth
  // Also supports: /api/tokens/search?query=query&chain=eth (for compatibility)
  fastify.get('/search', async (request, reply) => {
    try {
      const queryParams = request.query as { q?: string; query?: string; network?: string; chain?: string };
      // Support both 'q' and 'query' parameter names, and 'network' and 'chain'
      const searchQuery = queryParams.q || queryParams.query || '';
      const networkParam = queryParams.network || queryParams.chain;

      const sanitizedQuery = sanitizeString(searchQuery, 120);
      const safeNetwork = networkParam ? validateNetwork(networkParam, SEARCH_ALLOWED_NETWORKS) : undefined;

      if (!sanitizedQuery) {
        throw new AppError(400, 'Query parameter "q" or "query" is required', 'VALIDATION_ERROR');
      }

      // Check cache
      const cacheKey = `token:search:${sanitizedQuery}:${safeNetwork || 'all'}`;
      const cached = await get(cacheKey);
      if (cached) {
        return reply.send({
          success: true,
          data: JSON.parse(cached),
          cached: true,
        });
      }

      // Try Gecko Terminal first, then DexScreener
      let results = [];
      if (safeNetwork) {
        results = await searchGeckoTerminal(sanitizedQuery, safeNetwork);
      } else {
        // Try both APIs
        const [geckoResults, dexscreenerResults] = await Promise.all([
          searchGeckoTerminal(sanitizedQuery),
          searchDexScreener(sanitizedQuery),
        ]);

        // Convert DexScreener results to match TokenSearchResult format
        const formattedDexResults = dexscreenerResults.map(token => ({
          address: token.address,
          name: token.name,
          symbol: token.symbol,
          network: token.network,
          price: token.price,
          priceChange24h: token.priceChange24h,
          volume24h: token.volume24h,
          liquidity: token.liquidity,
          fdv: token.fdv,
          poolAddress: token.poolAddress,
          socials: token.socials,
          websites: token.websites,
        }));

        results = [...geckoResults, ...formattedDexResults];
      }

      // Cache results
      await set(cacheKey, JSON.stringify(results), TOKEN_CACHE_TTL);

      return reply.send({
        success: true,
        data: results,
        cached: false,
      });
    } catch (error) {
      throw handleExternalApiError(error as Error, 'Token Search');
    }
  });

  // GET /api/tokens/:network/:address
  fastify.get('/:network/:address', async (request, reply) => {
    try {
      const { network, address } = request.params as { network: string; address: string };

      // Check cache
      const cacheKey = `token:details:${network}:${address}`;
      const cached = await get(cacheKey);
      if (cached) {
        return reply.send({
          success: true,
          data: JSON.parse(cached),
          cached: true,
        });
      }

      // Try Gecko Terminal first for price/volume data
      let token = await getGeckoTokenDetails(network, address);

      // ALWAYS fetch from DexScreener for social links (more reliable source)
      const chainIdMap: Record<string, string> = {
        'eth': 'ethereum',
        'bsc': 'bsc',
        'solana': 'solana',
        'base': 'base',
        'arbitrum': 'arbitrum',
        'optimism': 'optimism',
        'polygon': 'polygon',
        'avax': 'avalanche',
        'fantom': 'fantom',
      };
      const chainId = chainIdMap[network] || network;

      try {
        const dexToken = await getDexTokenDetails(chainId, address);

        if (dexToken) {
          const dexTokenAny = dexToken as any;
          // Convert DexScreener format to TokenSearchResult format
          const dexResult = {
            address: dexToken.address,
            name: dexToken.name,
            symbol: dexToken.symbol,
            network: dexToken.network,
            price: dexToken.price,
            priceChange24h: dexToken.priceChange24h,
            volume24h: dexToken.volume24h,
            liquidity: dexToken.liquidity,
            fdv: dexToken.fdv,
            socials: dexToken.socials,
            websites: dexToken.websites,
            imageUrl: dexToken.imageUrl,
            poolAddress: dexToken.poolAddress,
            poolId: dexTokenAny.poolId,
            pairCreatedAt: dexTokenAny.pairCreatedAt,
          };

          if (!token) {
            token = dexResult;
          } else {
            // ALWAYS use DexScreener socials/websites (overwrite GeckoTerminal)
            if (dexResult.socials && dexResult.socials.length > 0) token.socials = dexResult.socials;
            if (dexResult.websites && dexResult.websites.length > 0) token.websites = dexResult.websites;
            if (!token.imageUrl && dexResult.imageUrl) token.imageUrl = dexResult.imageUrl;
            if (!token.poolAddress && dexResult.poolAddress) token.poolAddress = dexResult.poolAddress;
            if (!token.poolId && dexResult.poolId) token.poolId = dexResult.poolId;
            if (!(token as any).pairCreatedAt && dexResult.pairCreatedAt) (token as any).pairCreatedAt = dexResult.pairCreatedAt;
          }
        }
      } catch (e) {
        console.warn('[TokenDetails] Failed to fetch/enrich from DexScreener:', e);
      }

      // Fetch holder count (Enrichment)
      if (token) {
        try {
          const holders = await getHolderCount(network, address);
          if (holders) {
            token.holders = holders;
          }
        } catch (e) {
          console.warn('[TokenDetails] Failed to fetch holders from GoPlus:', e);
        }
      }

      if (!token) {
        throw new AppError(404, `Token ${address} not found on ${network}`, 'NOT_FOUND');
      }

      // Cache result
      await set(cacheKey, JSON.stringify(token), TOKEN_CACHE_TTL);

      return reply.send({
        success: true,
        data: token,
        cached: false,
      });
    } catch (error) {
      throw handleExternalApiError(error as Error, 'Token Details');
    }
  });

  // GET /api/tokens/:network/:address/chart?timeframe=h1&limit=500
  fastify.get('/:network/:address/chart', async (request, reply) => {
    const { network, address } = request.params as { network: string; address: string };
    const query = request.query as { timeframe?: string; limit?: string };
    const timeframe = query.timeframe || 'h1';
    const limit = query.limit || '500';

    // Validate inputs
    try {
      validateNetwork(network);
      validateAddress(address, 'address');
      validateTimeframe(timeframe);
      const limitNum = validateLimit(limit, 1000, 1);
    } catch (validationError: any) {
      return reply.status(400).send({
        success: false,
        error: 'Validation error',
        message: validationError.message || 'Invalid request parameters',
      });
    }

    // Check cache first (short TTL for chart data - 30 seconds)
    const cacheKey = `chart:${network}:${address}:${timeframe}:${limit}`;
    try {
      const cached = await get(cacheKey);
      if (cached) {
        return reply.send({
          success: true,
          data: cached,
          cached: true,
        });
      }
    } catch (cacheError: any) {
      // Cache error is not critical, continue with API call
    }

    // Network mapping (used in multiple places)
    const networkMap: Record<string, string> = {
      'sol': 'solana', 'solana': 'solana',
      'eth': 'eth', 'ethereum': 'eth',
      'bsc': 'bsc', 'base': 'base',
      'arbitrum': 'arbitrum', 'optimism': 'optimism',
      'polygon': 'polygon',
      'avax': 'avalanche', 'avalanche': 'avalanche',
      'fantom': 'fantom',
    };

    try {
      // Step 1: Get token details to extract pool address (most reliable method)
      let pairAddress: string | null = null;
      let poolId: string | null = null;
      let tokenDetails: any = null;

      try {
        tokenDetails = await getGeckoTokenDetails(network, address);

        if (tokenDetails) {
          if (tokenDetails.poolAddress) {
            pairAddress = tokenDetails.poolAddress;
            poolId = tokenDetails.poolId || null;
          } else if (tokenDetails.poolId) {
            poolId = tokenDetails.poolId;
            // Extract pool address from pool ID
            if (poolId && poolId.includes('_')) {
              const parts = poolId.split('_');
              if (parts.length >= 2) {
                pairAddress = parts.slice(1).join('_');
              }
            }
          }
        }
      } catch (detailError: any) {
        // Silently continue to next method
      }

      // Step 2: If we don't have pool address, fetch pools directly from Gecko Terminal
      if (!pairAddress) {
        try {
          const geckoNetwork = networkMap[network.toLowerCase()] || network.toLowerCase();
          const poolsUrl = `${GECKO_TERMINAL_BASE_URL}/networks/${geckoNetwork}/tokens/${address}/pools`;

          const poolsResponse = await fetchJson({
            url: poolsUrl,
            headers: { 'Accept': 'application/json' },
          });

          if (!poolsResponse.data || !Array.isArray(poolsResponse.data) || poolsResponse.data.length === 0) {
            throw new Error(`No pools found for token ${address} on ${network}`);
          }

          // Sort by liquidity (descending)
          const sortedPools = poolsResponse.data.sort((a: any, b: any) => {
            const liquidityA = parseFloat(a.attributes?.reserve_in_usd || '0');
            const liquidityB = parseFloat(b.attributes?.reserve_in_usd || '0');
            return liquidityB - liquidityA;
          });

          const bestPool = sortedPools[0] as any;
          const poolAttributes = bestPool.attributes || {};
          poolId = bestPool.id;

          // Extract pool address with priority: attributes.address > poolId split > poolId
          if (poolAttributes.address) {
            pairAddress = poolAttributes.address;
          } else if (poolId && poolId.includes('_')) {
            const parts = poolId.split('_');
            if (parts.length >= 2) {
              pairAddress = parts.slice(1).join('_');
            }
          } else if (poolId) {
            pairAddress = poolId;
          }
        } catch (poolError: any) {
          // Continue to try DexScreener as fallback
        }
      }

      // Step 2b: If still no pool address, try DexScreener as fallback
      if (!pairAddress) {
        try {
          const dexPairAddress = await getTokenPairAddress(network, address);
          if (dexPairAddress) {
            pairAddress = dexPairAddress;
          }
        } catch (dexError: any) {
          // Silently continue
        }
      }

      // Step 3: Validate we have a pool address
      if (!pairAddress) {
        // Return empty array in standard format to allow frontend to show "no data" message
        return reply.send({
          success: true,
          data: [],
        });
      }

      // Step 4: Fetch candlestick data
      const limitNum = Math.min(Math.max(parseInt(limit, 10) || 500, 1), 1000);

      // Try Gecko Terminal first
      let chartData: any[] = [];
      let geckoError: any = null;
      let dataSource = 'none';

      try {
        chartData = await getGeckoCandlestickData(
          network,
          pairAddress,
          timeframe,
          limitNum
        );
        if (chartData && chartData.length > 0) {
          dataSource = 'gecko';
        }
      } catch (error: any) {
        geckoError = error;
      }

      // If Gecko Terminal returns empty data or network/timeout error, try DexScreener as fallback
      if (!chartData || chartData.length === 0) {
        const shouldFallback = !geckoError || geckoError.type === 'network' || geckoError.type === 'timeout';

        if (shouldFallback) {
          try {
            const dexData = await getDexCandlestickData(
              network,
              pairAddress,
              timeframe,
              limitNum
            );
            if (dexData && Array.isArray(dexData) && dexData.length > 0) {
              chartData = dexData;
              dataSource = 'dexscreener';
            }
          } catch (dexError: any) {
            // fallback failure: return Gecko result if any, else empty data
          }
        }
      }

      // Cache successful results (30 seconds TTL for chart data)
      if (chartData && chartData.length > 0) {
        try {
          await set(cacheKey, JSON.stringify(chartData), 30);
        } catch {
          // Cache error is not critical
        }
      }

      // Return data in standard format
      return reply.send({
        success: true,
        data: chartData || [],
        source: dataSource,
      });

    } catch (error: any) {
      console.error(`[ChartAPI] Error:`, error.message);
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: error.message || 'Failed to fetch chart data',
      });
    }
  });

  // GET /api/tokens/:network/:address/transactions?limit=50&type=all
  // NOTE: This endpoint currently returns mock data
  // TODO: Implement real transaction fetching from DexScreener, Gecko Terminal, or chain data
  fastify.get('/:network/:address/transactions', async (request, reply) => {
    try {
      const { network, address } = request.params as { network: string; address: string };
      const { limit = '50', type = 'all' } = request.query as { limit?: string; type?: string };

      // Validate inputs
      validateNetwork(network);
      validateAddress(address, 'address');
      const limitNum = validateLimit(limit, 100, 50);

      // Validate type
      if (type && !['all', 'buy', 'sell'].includes(type)) {
        throw new AppError(400, 'Invalid type. Must be "all", "buy", or "sell"', 'VALIDATION_ERROR');
      }

      // Return empty array with note that this is not yet implemented
      // In production, this would fetch from DexScreener, Gecko Terminal, or chain data
      return reply.send({
        success: true,
        data: [],
        count: 0,
        message: 'Transaction data not yet implemented. This endpoint will fetch real data in a future update.',
      });
    } catch (error) {
      throw error;
    }
  });

  // GET /api/tokens/rpc-info - Securely proxy RPC calls for token metadata
  fastify.get('/rpc-info', async (request, reply) => {
    try {
      const { address, chainId } = request.query as {
        address: string;
        chainId: string;
      };

      if (!address || !chainId) {
        return reply.status(400).send({
          success: false,
          error: 'Missing address or chainId',
        });
      }

      // Validate address
      if (!validateAddress(address)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid address',
        });
      }

      const chainIdNum = parseInt(chainId, 10);
      const supportedChains = new Set([1, 8453, 42161, 56, 137, 10]);
      if (!supportedChains.has(chainIdNum)) {
        return reply.status(400).send({
          success: false,
          error: 'Unsupported chain',
        });
      }

      // Construct batched RPC calls
      const calls = [
        // name()
        {
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [{ to: address, data: '0x06fdde03' }, 'latest'],
          id: 1,
        },
        // symbol()
        {
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [{ to: address, data: '0x95d89b41' }, 'latest'],
          id: 2,
        },
        // decimals()
        {
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [{ to: address, data: '0x313ce567' }, 'latest'],
          id: 3,
        },
      ];

      const chainSlugMap: Record<number, string> = {
        1: 'eth',
        8453: 'base',
        42161: 'arbitrum',
        56: 'bsc',
        137: 'polygon',
        10: 'optimism',
      };
      const chainSlug = chainSlugMap[chainIdNum];
      if (!chainSlug) {
        return reply.status(400).send({
          success: false,
          error: 'Unsupported chain',
        });
      }

      const results = await batchRpcCall<string>(chainSlug, calls);

      // Helper to decode RPC string result
      const decodeString = (hex: string) => {
        if (!hex || hex === '0x') return '';
        try {
          // simple decode, assuming standard ABI encoding
          const str = Buffer.from(hex.slice(2), 'hex').toString('utf8');
          // removing length prefix and null bytes roughly
          return str.replace(/[\x00-\x1F\x7F-\x9F]/g, '').replace(/^\s+|\s+$/g, '').replace(/[^a-zA-Z0-9\s\-\.]/g, '');
        } catch { return ''; }
      };

      // Better decoding logic strictly for ABI strings
      const abiDecodeString = (hex?: string) => {
        if (!hex || hex === '0x' || hex.length < 130) return '';
        try {
          // Skip offset (32 bytes) + length (32 bytes)
          const dataSection = hex.slice(130);
          const str = Buffer.from(dataSection, 'hex').toString('utf8');
          return str.replace(/\0/g, '');
        } catch { return ''; }
      };

      const decodeDecimals = (hex?: string) => {
        if (!hex || hex === '0x') return 18;
        return parseInt(hex, 16);
      };

      const nameHex = results.find(r => r.id === 1)?.result ?? '0x';
      const symbolHex = results.find(r => r.id === 2)?.result ?? '0x';
      const decimalsHex = results.find(r => r.id === 3)?.result ?? '0x';

      const name = abiDecodeString(nameHex) || 'Unknown';
      const symbol = abiDecodeString(symbolHex) || 'UNKNOWN';
      const decimals = decodeDecimals(decimalsHex);

      return reply.send({
        success: true,
        data: {
          name,
          symbol,
          decimals,
          address,
          chainId: chainIdNum
        }
      });

    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Internal Server Error',
      });
    }
  });

  // GET /api/tokens/launchpad/detect - Detect launchpad token by address
  fastify.get('/launchpad/detect', async (request, reply) => {
    try {
      const { address, chainId } = request.query as {
        address?: string;
        chainId?: string;
      };

      if (!address) {
        return reply.status(400).send({
          success: false,
          error: 'Address parameter is required',
        });
      }

      // Validate address format
      if (!validateAddress(address)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid address format',
        });
      }

      const parsedChainId = chainId ? parseInt(chainId, 10) : undefined;
      console.log(`[TokenRoutes] Detecting launchpad token: ${address}, chainId: ${parsedChainId}`);
      const result = await detectLaunchpadToken(address, parsedChainId);

      if (!result) {
        console.log(`[TokenRoutes] Token ${address} not found on any launchpad platform`);
        return reply.send({
          success: true,
          data: null,
          message: 'Token not found on any launchpad platform',
        });
      }

      console.log(`[TokenRoutes] Found launchpad token: ${result.provider} for ${address}`);

      try {
        const chain = chainFromId(parsedChainId || result.chainId);
        const data = (result as any)?.data || {};
        const creatorAddress = data.creatorAddress || data.creator || data.creator_address || data.userAddress || data.user_address || data.msg_sender || undefined;
        const creatorUrl = data.creatorUrl || data.creator_url || undefined;
        const creatorLabel = data.creatorLabel || data.creator_label || undefined;
        if (chain && (creatorAddress || creatorUrl || creatorLabel)) {
          await saveTrendingTokenCreator(chain, address, { creatorAddress, creatorUrl, creatorLabel });
        }
      } catch {
        // best-effort only
      }

      return reply.send({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('[TokenRoutes] Launchpad detection error:', error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Internal Server Error',
      });
    }
  });

  // GET /api/tokens/:network/:address/early-buyers
  fastify.get('/:network/:address/early-buyers', async (request, reply) => {
    try {
      const { network, address } = request.params as { network: string; address: string };
      const { limit = '10' } = request.query as { limit?: string };

      const limitNum = validateLimit(limit, 50, 10);

      // Check cache (5m TTL)
      const cacheKey = `token:early-buyers:${network}:${address}:${limitNum}`;
      const cached = await get(cacheKey);
      if (cached) {
        return reply.send({
          success: true,
          data: JSON.parse(cached),
          cached: true
        });
      }

      console.log(`[TokenRoutes] Fetching early buyers for ${address} on ${network} (limit: ${limitNum})`);
      const buyers = await tokenAnalysis.getEarlyBuyers(address, network, limitNum);

      // Cache the result
      await set(cacheKey, JSON.stringify(buyers), 300);

      return reply.send({
        success: true,
        data: buyers,
        count: buyers.length,
        cached: false
      });
    } catch (error: any) {
      console.error('[TokenRoutes] Error in early-buyers route:', error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Internal Server Error'
      });
    }
  });

  // Token Security Check Route
  fastify.get('/security/:chain/:address', async (request, reply) => {
    try {
      const { chain, address } = request.params as { chain: string; address: string };

      // Validate inputs
      if (!chain || !address) {
        return reply.status(400).send({
          success: false,
          error: 'Missing required parameters: chain and address'
        });
      }

      // Check cache first (5 minute TTL)
      const cacheKey = `token:security:${chain}:${address.toLowerCase()}`;
      const cached = await get(cacheKey);
      if (cached) {
        return reply.send({
          success: true,
          data: JSON.parse(cached),
          cached: true
        });
      }

      // Fetch security data
      const securityData = await getTokenSecurity(address, chain);

      if (!securityData) {
        return reply.status(404).send({
          success: false,
          error: 'Unable to fetch security data for this token'
        });
      }

      // Cache for 5 minutes
      await set(cacheKey, JSON.stringify(securityData), 300);

      return reply.send({
        success: true,
        data: securityData,
        cached: false
      });
    } catch (error: any) {
      console.error('[TokenRoutes] Error in security route:', error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Internal Server Error'
      });
    }
  });
}
