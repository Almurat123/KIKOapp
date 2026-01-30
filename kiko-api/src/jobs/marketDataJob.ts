/**
 * Market Data Refresh Job
 * Runs daily to fetch and store market data
 * 
 * Data Sources:
 * - CoinGecko: Market cap, volume, BTC dominance
 * - Etherscan: ETH gas price (free API, high rate limit)
 * - DeFiLlama: TVL data
 * - Dune Analytics: Chain metrics (only refreshed every 24h to save credits)
 * - Alternative.me: Fear & Greed Index
 * - Binance: Open Interest
 */

import cron from 'node-cron';
import { getMarketOverview as fetchMarketOverview, getTrendingTokens as fetchTrendingTokens } from '../services/coingecko.js';
import { getChainsData as fetchChainsData, getProtocolsData as fetchProtocolsData, getDerivativesOpenInterest, getStablecoinsCirculating } from '../services/defillama.js';
import { getVolatilityIndices } from '../services/deribit.js';

import { getGasLevel } from '../services/gasLevel.js';
import { getEthGasPriceFormatted } from '../services/etherscan.js';
import { saveMarketOverview, getMarketOverview, saveTrends, getLastUpdateTime as getMarketUpdateTime } from '../repositories/marketRepository.js';
import { saveChainsData, getLastUpdateTime as getChainUpdateTime } from '../repositories/chainRepository.js';
import { saveProtocolsData, getLastUpdateTime as getProtocolUpdateTime } from '../repositories/protocolRepository.js';
import { env } from '../config/env.js';

/**
 * Calculate Altcoin Season Index (simplified)
 * Altcoin Season = % of top 50 coins outperforming BTC in last 90 days
 */
function calculateAltcoinSeasonIndex(bitcoinDominance: number): number {
  // Simplified calculation: lower BTC dominance = higher altcoin season
  // 0-25% = BTC Season, 25-75% = Neutral, 75-100% = Alt Season
  const normalized = ((100 - bitcoinDominance) / 100) * 100;
  return Math.max(0, Math.min(100, normalized));
}

const REFRESH_24H_MS = 23.5 * 60 * 60 * 1000; // 23.5 hours to allow for slight timing drift
const REFRESH_5M_MS = 4.5 * 60 * 1000; // 4.5 minutes 

/**
 * Refresh market overview data
 */
export async function refreshMarketOverview(force = false): Promise<void> {
  try {
    // Check if data is already fresh in SQL
    if (!force) {
      const lastUpdate = await getMarketUpdateTime('overview');
      if (lastUpdate && (Date.now() - lastUpdate.getTime()) < REFRESH_24H_MS) {
        console.log('[MarketJob] Overview is fresh, skipping API call');
        return;
      }
    }
    // 1. Fetch ETH gas price first (priority)
    const etherscanGas = await getEthGasPriceFormatted(env.apiKeys.etherscan).catch(() => undefined);

    // 2. Fetch other market data, passing etherscanGas to getGasLevel
    const [marketData, fearGreed, stablecoinsMcap, previousOverview, openInterest, gasLevel, volatility] = await Promise.all([
      fetchMarketOverview(env.apiKeys.coingecko).catch(() => {
        return { globalMarketCap: 0, volume24h: 0, bitcoinDominance: 0, activeUsers: undefined, ethGasPrice: undefined };
      }),
      Promise.resolve({ value: 50, classification: 'Neutral' }),
      getStablecoinsCirculating().catch(() => 0),
      getMarketOverview().catch(() => null), // Get previous for change calculation
      getDerivativesOpenInterest().catch(() => 0),
      getGasLevel(etherscanGas).catch(() => {
        return { averageGasLevel: undefined, status: undefined, chains: [] };
      }),
      getVolatilityIndices().catch(() => {
        console.log('[MarketJob] Deribit volatility fetch failed, using defaults');
        return null;
      }),
    ]);

    // Priority for ETH gas price: 1) Etherscan, 2) Chains data, 3) CoinGecko
    let ethGasPrice = etherscanGas;
    if (!ethGasPrice && gasLevel.chains && gasLevel.chains.length > 0) {
      const ethChain = gasLevel.chains.find((c: any) =>
        c.name?.toLowerCase() === 'ethereum' || c.chain?.toLowerCase() === 'ethereum'
      );
      if (ethChain && ethChain.gasPrice) {
        ethGasPrice = ethChain.gasPrice;
      }
    }
    if (!ethGasPrice) {
      ethGasPrice = marketData.ethGasPrice;
    }

    const altcoinSeasonIndex = calculateAltcoinSeasonIndex(marketData.bitcoinDominance);

    // Calculate Liquidity Stress Index based on volatility and open interest
    // Higher volatility + lower open interest = higher stress
    let liquidityStressIndex: number | undefined;
    let liquidityStressStatus: string | undefined;
    if (volatility?.bvix && volatility?.evix) {
      const avgVolatility = (volatility.bvix + volatility.evix) / 2;
      // Normalize to 0-100 scale (DVOL typically ranges from 20-100)
      liquidityStressIndex = Math.min(100, Math.max(0, (avgVolatility - 20) * 1.25));
      if (liquidityStressIndex < 30) {
        liquidityStressStatus = 'Low';
      } else if (liquidityStressIndex < 60) {
        liquidityStressStatus = 'Moderate';
      } else {
        liquidityStressStatus = 'High';
      }
    }

    // 3. Calculate 24h changes
    let btcDomChange24h: number | undefined;
    let mcapChange24h: number | undefined;

    if (previousOverview) {
      if (previousOverview.bitcoinDominance > 0) {
        btcDomChange24h = marketData.bitcoinDominance - previousOverview.bitcoinDominance;
      }
      if (previousOverview.globalMarketCap > 0) {
        mcapChange24h = ((marketData.globalMarketCap - previousOverview.globalMarketCap) / previousOverview.globalMarketCap) * 100;
      }
    }

    await saveMarketOverview({
      globalMarketCap: marketData.globalMarketCap,
      volume24h: marketData.volume24h,
      activeUsers: marketData.activeUsers,
      ethGasPrice,
      fearGreedIndex: fearGreed.value,
      fearGreedClassification: fearGreed.classification,
      bitcoinDominance: marketData.bitcoinDominance,
      altcoinSeasonIndex,
      globalOpenInterest: openInterest,
      gasLevel: gasLevel.averageGasLevel,
      gasLevelStatus: gasLevel.status,
      evix: volatility?.evix,
      liquidityStressIndex,
      liquidityStressStatus,
      stablecoinsMcap: stablecoinsMcap,
      btcDomChange24h,
      mcapChange24h,
    });

    console.log('[MarketJob] ✅ Overview refreshed successfully');
  } catch (error) {
    console.error('[MarketJob] ❌ Error in refreshMarketOverview:', error instanceof Error ? error.message : error);
  }
}

/**
 * Refresh chains data
 */
export async function refreshChainsData(force = false): Promise<void> {
  try {
    // 1. Fetch chain metrics from Dune Analytics
    console.log('[MarketJob] Fetching chain metrics from Dune...');
    const { fetchDuneChainMetrics, convertDuneMetricsToDefiLlamaFormat } = await import('../services/duneChainService.js');

    const duneMetrics = await fetchDuneChainMetrics();
    const convertedMetrics = convertDuneMetricsToDefiLlamaFormat(duneMetrics);

    console.log(`[MarketJob] Fetched metrics for ${convertedMetrics.size} chains from Dune`);

    // 2. Merge with DeFiLlama TVL data
    const chains = await fetchChainsData(convertedMetrics);
    await saveChainsData(chains);

    console.log(`[MarketJob] ✅ Chains refreshed successfully: ${chains.length} chains`);
  } catch (error) {
    console.error('[MarketJob] ❌ Error refreshing chains:', error instanceof Error ? error.message : error);
  }
}

export async function refreshProtocolsData(force = false): Promise<void> {
  try {
    // Check if data is already fresh in SQL
    if (!force) {
      const lastUpdate = await getProtocolUpdateTime();
      if (lastUpdate && (Date.now() - lastUpdate.getTime()) < REFRESH_24H_MS) {
        console.log('[MarketJob] Protocols are fresh, skipping API call');
        return;
      }
    }
    const protocols = await fetchProtocolsData();
    await saveProtocolsData(protocols);

    console.log(`[MarketJob] ✅ Protocols refreshed successfully: ${protocols.length} protocols`);
  } catch (error) {
    console.error('[MarketJob] ❌ Error refreshing protocols:', error instanceof Error ? error.message : error);
  }
}

/**
 * Refresh trending tokens data
 */
export async function refreshTrendingTokens(force = false): Promise<void> {
  try {
    // Check if data is already fresh in SQL
    if (!force) {
      const lastUpdate = await getMarketUpdateTime('trending');
      if (lastUpdate && (Date.now() - lastUpdate.getTime()) < REFRESH_5M_MS) {
        console.log('[MarketJob] Trending tokens are fresh, skipping API call');
        return;
      }
    }
    const trending = await fetchTrendingTokens(env.apiKeys.coingecko);
    const coins = trending.coins || [];

    // Transform CoinGecko trending data to our format
    const tokens = coins.map((item: any, idx: number) => ({
      chain: 'eth', // Default to eth for CG trending or detect from network
      address: item.item.id,
      name: item.item.name,
      symbol: item.item.symbol,
      network: item.item.network_slug || 'ethereum',
      imageUrl: item.item.large || item.item.thumb || item.item.small,
      price: item.item.data?.price,
      priceChange24h: item.item.data?.price_change_percentage_24h?.usd,
      rank: idx + 1
    }));


    await saveTrends(tokens);
    console.log(`[MarketJob] Trending tokens refreshed: ${tokens.length} tokens`);
  } catch (error) {
    console.error('[MarketJob] Error refreshing trending tokens:', error);
  }
}

/**
 * Initialize and start cron jobs
 */
export function startMarketDataJobs(): void {
  // Market overview: Every day at 2:00 AM
  cron.schedule('0 2 * * *', () => refreshMarketOverview(), {
    timezone: 'UTC',
  });

  // Chains data: Every day at 3:00 AM
  cron.schedule('0 3 * * *', () => refreshChainsData(), {
    timezone: 'UTC',
  });

  // Protocols data: Every day at 4:00 AM
  cron.schedule('0 4 * * *', () => refreshProtocolsData(), {
    timezone: 'UTC',
  });

  // Trending tokens: Every 5 minutes
  cron.schedule('*/5 * * * *', () => refreshTrendingTokens(), {
    timezone: 'UTC',
  });

  console.log('[MarketJob] Scheduled: Overview(2:00 UTC), Chains(3:00 UTC), Protocols(4:00 UTC), Trending(Every 5m)');

  // Run initial refresh on startup only if data is stale in SQL
  setTimeout(async () => {
    console.log('[MarketJob] Running startup staleness check...');
    await refreshMarketOverview();
    await refreshProtocolsData();
    await refreshTrendingTokens();
    // Chains refresh is heavy and uses Dune credits, we only run it if extremely stale (e.g. 24h)
    const lastChainUpdate = await getChainUpdateTime();
    if (!lastChainUpdate || (Date.now() - lastChainUpdate.getTime()) > 24 * 60 * 60 * 1000) {
      await refreshChainsData();
    }
  }, 5000); // Wait 5 seconds for services to be ready
}

