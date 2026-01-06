/**
 * Market Data Repository
 * Handles database operations for market data using Prisma
 */
import { prisma, withRetry } from '../lib/prisma.js';
import { memoryCache, CACHE_KEYS, CACHE_TTL } from '../cache/memoryCache.js';
import { Decimal } from 'decimal.js';

export interface MarketOverview {
  globalMarketCap: number;
  volume24h: number;
  activeUsers?: number;
  ethGasPrice?: string;
  fearGreedIndex: number;
  fearGreedClassification: string;
  bitcoinDominance: number;
  altcoinSeasonIndex?: number;
  globalOpenInterest?: number;
  gasLevel?: number;
  gasLevelStatus?: string;
  bvix?: number;
  evix?: number;
  liquidityStressIndex?: number;
  liquidityStressStatus?: string;
}

export interface TrendingTokenData {
  chain: string;
  address: string;
  name: string;
  symbol: string;
  network: string;
  imageUrl?: string;
  price?: number;
  priceChange5m?: number;
  priceChange1h?: number;
  priceChange6h?: number;
  priceChange24h?: number;
  volume24h?: number;
  liquidity?: number;
  fdv?: number;
  rank?: number;
}

/**
 * Save market overview to database and cache
 */
export async function saveMarketOverview(data: MarketOverview): Promise<void> {
  try {
    // Save to database (using Prisma create)
    // We keep all history for now, getMarketOverview will fetch latest
    await withRetry(() => prisma.marketOverview.create({
      data: {
        globalMarketCap: new Decimal(data.globalMarketCap),
        volume24h: new Decimal(data.volume24h),
        activeUsers: data.activeUsers ? BigInt(data.activeUsers) : null,
        ethGasPrice: data.ethGasPrice,
        fearGreedIndex: data.fearGreedIndex,
        fearGreedClassification: data.fearGreedClassification,
        bitcoinDominance: new Decimal(data.bitcoinDominance),
        altcoinSeasonIndex: data.altcoinSeasonIndex ? new Decimal(data.altcoinSeasonIndex) : null,
        globalOpenInterest: data.globalOpenInterest ? new Decimal(data.globalOpenInterest) : null,
        gasLevel: data.gasLevel ? new Decimal(data.gasLevel) : null,
        gasLevelStatus: data.gasLevelStatus,
        bvix: data.bvix ? new Decimal(data.bvix) : null,
        evix: data.evix ? new Decimal(data.evix) : null,
        liquidityStressIndex: data.liquidityStressIndex ? new Decimal(data.liquidityStressIndex) : null,
        liquidityStressStatus: data.liquidityStressStatus,
        updatedAt: new Date(),
      }
    }));

    // Update memory cache (instant access for subsequent requests)
    memoryCache.set(CACHE_KEYS.MARKET_OVERVIEW, data, CACHE_TTL.MARKET_OVERVIEW);

    console.log('Market overview saved to database and memory cache');
  } catch (error) {
    console.error('Error saving market overview:', error);
    throw error;
  }
}

/**
 * Get latest market overview from cache or database
 */
export async function getMarketOverview(): Promise<MarketOverview | null> {
  try {
    // Check memory cache first (instant)
    const cached = memoryCache.get<MarketOverview>(CACHE_KEYS.MARKET_OVERVIEW);
    if (cached) {
      return cached;
    }

    // Cache miss - load from PostgreSQL
    console.log('[MarketRepo] Memory cache miss, loading from PostgreSQL...');
    const row = await prisma.marketOverview.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    if (!row) {
      return null;
    }

    const data: MarketOverview = {
      globalMarketCap: Number(row.globalMarketCap),
      volume24h: Number(row.volume24h),
      activeUsers: row.activeUsers ? Number(row.activeUsers) : undefined,
      ethGasPrice: row.ethGasPrice ?? undefined,
      fearGreedIndex: row.fearGreedIndex ?? 0,
      fearGreedClassification: row.fearGreedClassification ?? '',
      bitcoinDominance: Number(row.bitcoinDominance),
      altcoinSeasonIndex: row.altcoinSeasonIndex ? Number(row.altcoinSeasonIndex) : undefined,
      globalOpenInterest: row.globalOpenInterest ? Number(row.globalOpenInterest) : undefined,
      gasLevel: row.gasLevel ? Number(row.gasLevel) : undefined,
      gasLevelStatus: row.gasLevelStatus ?? undefined,
      bvix: row.bvix ? Number(row.bvix) : undefined,
      evix: row.evix ? Number(row.evix) : undefined,
      liquidityStressIndex: row.liquidityStressIndex ? Number(row.liquidityStressIndex) : undefined,
      liquidityStressStatus: row.liquidityStressStatus ?? undefined,
    };

    // Update memory cache for future requests
    memoryCache.set(CACHE_KEYS.MARKET_OVERVIEW, data, CACHE_TTL.MARKET_OVERVIEW);
    console.log('[MarketRepo] Loaded market overview into memory cache');

    return data;
  } catch (error) {
    console.error('Error getting market overview:', error);
    return null;
  }
}

/**
 * Save trending tokens to database or update existing ones
 */
export async function saveTrends(tokens: TrendingTokenData[]): Promise<void> {
  try {
    for (const token of tokens) {
      await prisma.trendingToken.upsert({
        where: {
          chain_address: {
            chain: token.chain,
            address: token.address
          }
        },
        update: {
          name: token.name,
          symbol: token.symbol,
          network: token.network,
          imageUrl: token.imageUrl || null,
          price: token.price ? new Decimal(token.price) : null,
          priceChange24h: token.priceChange24h ? new Decimal(token.priceChange24h) : null,
          rank: token.rank,
          updatedAt: new Date()
        },
        create: {
          chain: token.chain,
          address: token.address,
          name: token.name,
          symbol: token.symbol,
          network: token.network,
          imageUrl: token.imageUrl || null,
          price: token.price ? new Decimal(token.price) : null,
          priceChange24h: token.priceChange24h ? new Decimal(token.priceChange24h) : null,
          rank: token.rank
        }
      });
    }
    console.log(`Saved ${tokens.length} trending tokens to database via Prisma`);
  } catch (error) {
    console.error('Error saving trending tokens:', error);
  }
}

/**
 * Get trending tokens from database
 */
export async function getTrendingTokens(): Promise<any[]> {
  try {
    const rows = await prisma.trendingToken.findMany({
      orderBy: [{ rank: 'asc' }, { updatedAt: 'desc' }],
      take: 20
    });

    // Map back to format expected by frontend
    return rows.map(r => ({
      id: r.id,
      chain: r.chain,
      address: r.address,
      name: r.name,
      symbol: r.symbol,
      image: r.imageUrl,
      price: r.price ? Number(r.price) : null,
      price_change_percentage_24h: r.priceChange24h ? Number(r.priceChange24h) : null,
      rank: r.rank
    }));
  } catch (error) {
    console.error('Error getting trending tokens:', error);
    return [];
  }
}

/**
 * Get last update time for market data types
 */
export async function getLastUpdateTime(type: 'overview' | 'trending'): Promise<Date | null> {
  try {
    if (type === 'overview') {
      const row = await prisma.marketOverview.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true }
      });
      return row?.updatedAt || null;
    } else {
      const row = await prisma.trendingToken.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true }
      });
      return row?.updatedAt || null;
    }
  } catch (error) {
    console.error(`Error getting last update time for ${type}:`, error);
    return null;
  }
}
export async function getGlobalMarketOverview() {
  return getMarketOverview();
}

export async function getTopProtocols(limit: number = 10) {
  return prisma.protocolMetric.findMany({
    take: limit,
    orderBy: { tvl: 'desc' }
  });
}

export async function getChainMetrics() {
  return prisma.chainMetric.findMany({
    orderBy: { tvl: 'desc' }
  });
}
