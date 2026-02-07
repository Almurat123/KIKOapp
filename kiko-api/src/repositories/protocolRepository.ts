/**
 * Protocol Data Repository
 * Handles database operations for DeFi protocols using Prisma
 */
import { prisma, withRetry } from '../db/prisma.js';
import { memoryCache, CACHE_KEYS, CACHE_TTL } from '../cache/memoryCache.js';
import { ProtocolData } from '../services/defillama.js';
import { Decimal } from 'decimal.js';

/**
 * Save protocols data to database and cache
 */
export async function saveProtocolsData(protocols: ProtocolData[]): Promise<void> {
  try {
    // Process in chunks to avoid connection drops on large datasets
    const chunkSize = 20;
    for (let i = 0; i < protocols.length; i += chunkSize) {
      const chunk = protocols.slice(i, i + chunkSize);

      await Promise.all(chunk.map(protocol => {
        const tvl = protocol.tvl !== undefined && protocol.tvl !== null ? Math.max(0, Number(protocol.tvl)) : null;
        const tvlChange1d = protocol.tvlChange1d !== undefined && protocol.tvlChange1d !== null ? Number(protocol.tvlChange1d) : null;
        const tvlChange7d = protocol.tvlChange7d !== undefined && protocol.tvlChange7d !== null ? Number(protocol.tvlChange7d) : null;
        const volume24h = protocol.volume24h !== undefined && protocol.volume24h !== null ? Math.max(0, Number(protocol.volume24h)) : null;
        const mcapTvlRatio = protocol.mcapTvlRatio !== undefined && protocol.mcapTvlRatio !== null ? Number(protocol.mcapTvlRatio) : null;

        return withRetry(() => prisma.protocolMetric.upsert({
          where: { name: protocol.name },
          update: {
            symbol: protocol.symbol,
            category: protocol.category,
            tvl: tvl !== null ? new Decimal(tvl) : null,
            tvlChange1d: tvlChange1d !== null ? new Decimal(tvlChange1d) : null,
            tvlChange7d: tvlChange7d !== null ? new Decimal(tvlChange7d) : null,
            volume24h: volume24h !== null ? new Decimal(volume24h) : null,
            chains: protocol.chains,
            mcapTvlRatio: mcapTvlRatio !== null ? new Decimal(mcapTvlRatio) : null,
            logoUrl: protocol.logoUrl,
            updatedAt: new Date(),
          },
          create: {
            name: protocol.name,
            symbol: protocol.symbol,
            category: protocol.category,
            tvl: tvl !== null ? new Decimal(tvl) : null,
            tvlChange1d: tvlChange1d !== null ? new Decimal(tvlChange1d) : null,
            tvlChange7d: tvlChange7d !== null ? new Decimal(tvlChange7d) : null,
            volume24h: volume24h !== null ? new Decimal(volume24h) : null,
            chains: protocol.chains,
            mcapTvlRatio: mcapTvlRatio !== null ? new Decimal(mcapTvlRatio) : null,
            logoUrl: protocol.logoUrl,
          },
        }));
      }));

      console.log(`Saved batch ${Math.floor(i / chunkSize) + 1}/${Math.ceil(protocols.length / chunkSize)}`);
    }

    // Update memory cache
    memoryCache.set(CACHE_KEYS.PROTOCOLS, protocols, CACHE_TTL.PROTOCOLS);

    console.log(`Saved ${protocols.length} protocols to database and memory cache`);
  } catch (error) {
    console.error('Error saving protocols data:', error);
    throw error;
  }
}

/**
 * Get protocols data from cache or database
 */
export async function getProtocolsData(): Promise<ProtocolData[]> {
  try {
    // Check memory cache first (instant)
    const cached = memoryCache.get<ProtocolData[]>(CACHE_KEYS.PROTOCOLS);
    if (cached && cached.length > 0) {
      return cached;
    }

    // Cache miss - load from PostgreSQL
    console.log('[ProtocolRepo] Memory cache miss, loading from PostgreSQL...');
    const result = await prisma.protocolMetric.findMany({
      orderBy: { tvl: 'desc' },
    });

    const data: ProtocolData[] = result.map((row) => ({
      name: row.name,
      symbol: row.symbol ?? '',
      category: row.category ?? '',
      tvl: row.tvl ? Number(row.tvl) : 0,
      tvlChange1d: row.tvlChange1d ? Number(row.tvlChange1d) : 0,
      tvlChange7d: row.tvlChange7d ? Number(row.tvlChange7d) : 0,
      volume24h: row.volume24h ? Number(row.volume24h) : undefined,
      chains: row.chains,
      mcapTvlRatio: row.mcapTvlRatio ? Number(row.mcapTvlRatio) : undefined,
      logoUrl: row.logoUrl ?? undefined,
    }));

    // Update memory cache
    if (data.length > 0) {
      memoryCache.set(CACHE_KEYS.PROTOCOLS, data, CACHE_TTL.PROTOCOLS);
      console.log(`[ProtocolRepo] Loaded ${data.length} protocols into memory cache`);
    }

    return data;
  } catch (error) {
    console.error('Error getting protocols data:', error);
    return [];
  }
}

/**
 * Get last update time for protocols data
 */
export async function getLastUpdateTime(): Promise<Date | null> {
  try {
    const row = await prisma.protocolMetric.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true }
    });
    return row?.updatedAt || null;
  } catch (error) {
    console.error('Error getting last update time for protocols:', error);
    return null;
  }
}
