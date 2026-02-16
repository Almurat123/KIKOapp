/**
 * Market Data API Routes
 * All endpoints read from local storage (Redis/DB)
 */

import { FastifyInstance } from 'fastify';
import { get, set } from '../cache/cacheClient.js';
import { getMarketOverview, getTrendingTokens as getTrendingFromDb, getLastUpdateTime as getMarketUpdateTime, saveTrends } from '../repositories/marketRepository.js';
import { getChainsData, getLastUpdateTime as getChainsUpdateTime } from '../repositories/chainRepository.js';
import { getProtocolsData, getLastUpdateTime as getProtocolsUpdateTime, saveProtocolsData } from '../repositories/protocolRepository.js';
import { getTrendingTokens, getTopGainers } from '../services/coingecko.js';
import { getProtocolsData as fetchProtocolsData } from '../services/defillama.js';
import { refreshChainsData, refreshMarketOverview } from '../jobs/marketDataJob.js';
import { env } from '../config/env.js';
import { AppError, handleExternalApiError } from '../middleware/errorHandler.js';

export async function marketRoutes(fastify: FastifyInstance) {
  // GET /api/market/overview
  fastify.get('/overview', async (request, reply) => {
    try {
      const data = await getMarketOverview();

      if (!data) {
        return reply.status(200).send({
          success: true,
          data: null,
          message: 'Market overview data not available. Data is being fetched. Please try again later.',
        });
      }

      return reply.send({
        success: true,
        data,
        updatedAt: data.updatedAt || new Date().toISOString(),
      });
    } catch (error) {
      throw error;
    }
  });

  // POST /api/market/refresh - Force refresh market overview data
  fastify.post('/refresh', async (request, reply) => {
    try {
      console.log('[MarketAPI] Force refresh triggered');
      await refreshMarketOverview(true); // force = true
      const data = await getMarketOverview();
      return reply.send({
        success: true,
        message: 'Market data refreshed successfully',
        data,
      });
    } catch (error) {
      throw error;
    }
  });

  // GET /api/market/chains
  // NOTE: This endpoint only reads from database/cache to avoid consuming Dune API credits.
  // Dune data is fetched by the background cron job (marketDataJob) which runs periodically.
  fastify.get('/chains', async (request, reply) => {
    try {
      // Read from cache/database only - Dune refresh happens via cron job
      let chains = await getChainsData();

      if (chains.length === 0) {
        // Cold start fallback for serverless/online envs without cron
        await refreshChainsData(true);
        chains = await getChainsData();
      } else {
        const lastUpdate = await getChainsUpdateTime();
        if (lastUpdate && (Date.now() - lastUpdate.getTime()) > 24 * 60 * 60 * 1000) {
          // Best-effort refresh if data is stale
          await refreshChainsData(true);
          chains = await getChainsData();
        }
      }

      return reply.send({
        success: true,
        data: chains,
        count: chains.length,
      });
    } catch (error) {
      throw error;
    }
  });

  // GET /api/market/protocols
  fastify.get('/protocols', async (request, reply) => {
    try {
      let protocols = await getProtocolsData();

      if (protocols.length === 0) {
        const fresh = await fetchProtocolsData();
        await saveProtocolsData(fresh);
        protocols = await getProtocolsData();
      } else {
        const lastUpdate = await getProtocolsUpdateTime();
        if (lastUpdate && (Date.now() - lastUpdate.getTime()) > 24 * 60 * 60 * 1000) {
          const fresh = await fetchProtocolsData();
          await saveProtocolsData(fresh);
          protocols = await getProtocolsData();
        }
      }

      return reply.send({
        success: true,
        data: protocols,
        count: protocols.length,
      });
    } catch (error) {
      throw error;
    }
  });

  // GET /api/market/trending
  fastify.get('/trending', async (request, reply) => {
    try {
      const TRENDING_STALE_MS = 5 * 60 * 1000;
      let coins = await getTrendingFromDb();

      if (coins.length === 0) {
        const trending = await getTrendingTokens(env.apiKeys.coingecko);
        const freshCoins = trending.coins || trending || [];

        const tokens = freshCoins.map((item: any, idx: number) => ({
          chain: 'eth',
          address: item.item?.id || item.id,
          name: item.item?.name || item.name,
          symbol: item.item?.symbol || item.symbol,
          network: item.item?.network_slug || 'ethereum',
          imageUrl: item.item?.large || item.item?.thumb || item.item?.small || item.large || item.thumb || item.small,
          price: item.item?.data?.price || item.data?.price,
          priceChange24h: item.item?.data?.price_change_percentage_24h?.usd || item.data?.price_change_percentage_24h?.usd,
          rank: idx + 1,
        }));

        await saveTrends(tokens);
        coins = await getTrendingFromDb();
      } else {
        const lastUpdate = await getMarketUpdateTime('trending');
        if (lastUpdate && (Date.now() - lastUpdate.getTime()) > TRENDING_STALE_MS) {
          const trending = await getTrendingTokens(env.apiKeys.coingecko);
          const freshCoins = trending.coins || trending || [];

          const tokens = freshCoins.map((item: any, idx: number) => ({
            chain: 'eth',
            address: item.item?.id || item.id,
            name: item.item?.name || item.name,
            symbol: item.item?.symbol || item.symbol,
            network: item.item?.network_slug || 'ethereum',
            imageUrl: item.item?.large || item.item?.thumb || item.item?.small || item.large || item.thumb || item.small,
            price: item.item?.data?.price || item.data?.price,
            priceChange24h: item.item?.data?.price_change_percentage_24h?.usd || item.data?.price_change_percentage_24h?.usd,
            rank: idx + 1,
          }));

          await saveTrends(tokens);
          coins = await getTrendingFromDb();
        }
      }

      return reply.send({
        success: true,
        data: coins,
      });
    } catch (error) {
      throw handleExternalApiError(error as Error, 'CoinGecko');
    }
  });

  // GET /api/market/gainers
  fastify.get('/gainers', async (request, reply) => {
    try {
      // This is real-time data, so we call API directly (with short cache)
      const gainers = await getTopGainers(env.apiKeys.coingecko, 10);

      return reply.send({
        success: true,
        data: gainers,
      });
    } catch (error) {
      throw handleExternalApiError(error as Error, 'CoinGecko');
    }
  });



  // GET /api/market/indicators
  // Returns VIX, DXY, Gold, Oil, EUR/USD
  // Previously used Yahoo Finance stub, now returns empty or cached market overview data if available
  fastify.get('/indicators', async (request, reply) => {
    try {
      // Logic removed as yahooFinance.ts service was deleted. 
      // Market overview tool handles this in a better way if needed.
      // For now, return empty data to prevent errors if frontend calls it.
      return reply.send({
        success: true,
        data: [],
        message: 'Market indicators service is currently disabled.'
      });
    } catch (error) {
      throw handleExternalApiError(error as Error, 'Market Indicators');
    }
  });

  // GET /api/market/gas/:chain
  // Get real-time gas prices for a blockchain network
  fastify.get('/gas/:chain', async (request, reply) => {
    try {
      const { chain } = request.params as { chain: string };
      const cacheKey = `gas:${chain}`;
      const CACHE_TTL = 30; // 30 seconds cache

      // Check cache
      const cached = await get(cacheKey);
      if (cached) {
        return reply.send({
          success: true,
          data: JSON.parse(cached),
          cached: true,
        });
      }

      // Import gas services
      const etherscan = await import('../services/etherscan.js');
      const infuraGas = await import('../services/infuraGas.js');

      // Try Infura first (if configured)
      if (infuraGas.isInfuraConfigured()) {
        const infuraData = await infuraGas.getInfuraGasFees(chain);
        if (infuraData) {
          const result = {
            source: 'Infura Gas API',
            chain: chain,
            baseFee: `${parseFloat(infuraData.estimatedBaseFee).toFixed(2)} Gwei`,
            low: {
              maxFee: `${parseFloat(infuraData.low.suggestedMaxFeePerGas).toFixed(2)} Gwei`,
              priorityFee: `${parseFloat(infuraData.low.suggestedMaxPriorityFeePerGas).toFixed(2)} Gwei`,
            },
            medium: {
              maxFee: `${parseFloat(infuraData.medium.suggestedMaxFeePerGas).toFixed(2)} Gwei`,
              priorityFee: `${parseFloat(infuraData.medium.suggestedMaxPriorityFeePerGas).toFixed(2)} Gwei`,
            },
            high: {
              maxFee: `${parseFloat(infuraData.high.suggestedMaxFeePerGas).toFixed(2)} Gwei`,
              priorityFee: `${parseFloat(infuraData.high.suggestedMaxPriorityFeePerGas).toFixed(2)} Gwei`,
            },
            networkCongestion: `${(infuraData.networkCongestion * 100).toFixed(2)}%`,
          };
          await set(cacheKey, JSON.stringify(result), CACHE_TTL);
          return reply.send({ success: true, data: result, cached: false });
        }
      }

      // Fallback to Etherscan
      const gasData = await etherscan.getGasPrice(chain);
      if (!gasData) {
        throw new AppError(404, `Gas price not available for chain: ${chain}`, 'NOT_FOUND');
      }

      const result = {
        source: 'Etherscan/Blockscan',
        chain: chain,
        safe: `${gasData.safeGasPrice} Gwei`,
        standard: `${gasData.proposeGasPrice} Gwei`,
        fast: `${gasData.fastGasPrice} Gwei`,
        baseFee: `${gasData.suggestBaseFee} Gwei`,
      };

      await set(cacheKey, JSON.stringify(result), CACHE_TTL);
      return reply.send({ success: true, data: result, cached: false });
    } catch (error) {
      throw handleExternalApiError(error as Error, 'Gas Price API');
    }
  });

  // GET /api/market/price/:symbol
  // Get real-time spot price for a cryptocurrency from Coinbase
  fastify.get('/price/:symbol', async (request, reply) => {
    try {
      const { symbol } = request.params as { symbol: string };

      if (!symbol) {
        throw new AppError(400, 'Symbol is required', 'VALIDATION_ERROR');
      }

      const cacheKey = `price:coinbase:${symbol.toUpperCase()}`;
      const CACHE_TTL = 30; // 30 seconds cache for real-time prices

      // Check cache
      const cached = await get(cacheKey);
      if (cached) {
        return reply.send({
          success: true,
          data: JSON.parse(cached),
          cached: true,
        });
      }

      // Import coinbase service
      const coinbase = await import('../services/coinbase.js');
      const result = await coinbase.searchCoinbasePrice(symbol);

      if (!result) {
        throw new AppError(404, `Price not found for ${symbol} on Coinbase`, 'NOT_FOUND');
      }

      const formattedResult = {
        symbol: result.symbol,
        price: `$${result.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`,
        priceRaw: result.price,
        currency: result.currency,
        source: 'Coinbase',
        timestamp: new Date().toISOString(),
      };

      await set(cacheKey, JSON.stringify(formattedResult), CACHE_TTL);
      return reply.send({ success: true, data: formattedResult, cached: false });
    } catch (error) {
      throw handleExternalApiError(error as Error, 'Coinbase');
    }
  });

  // GET /api/market/historical/:symbol/:date
  // Get historical price for a cryptocurrency on a specific date
  fastify.get('/historical/:symbol/:date', async (request, reply) => {
    try {
      const { symbol, date } = request.params as { symbol: string; date: string };

      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        throw new AppError(400, 'Invalid date format. Please use YYYY-MM-DD format', 'VALIDATION_ERROR');
      }

      const cacheKey = `historical:${symbol}:${date}`;
      const CACHE_TTL = 86400; // 24 hours cache

      // Check cache
      const cached = await get(cacheKey);
      if (cached) {
        return reply.send({
          success: true,
          data: JSON.parse(cached),
          cached: true,
        });
      }

      // Import coinbase service
      const coinbase = await import('../services/coinbase.js');
      const result = await coinbase.getHistoricalPrice(symbol, date);

      if (!result) {
        throw new AppError(404, `Historical price not found for ${symbol} on ${date}`, 'NOT_FOUND');
      }

      const formattedResult = {
        symbol: result.symbol,
        date: result.date,
        price: `$${result.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`,
        priceRaw: result.price,
        currency: result.currency,
        source: 'Coinbase',
      };

      await set(cacheKey, JSON.stringify(formattedResult), CACHE_TTL);
      return reply.send({ success: true, data: formattedResult, cached: false });
    } catch (error) {
      throw handleExternalApiError(error as Error, 'Coinbase');
    }
  });
}
