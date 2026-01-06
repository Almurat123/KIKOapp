/**
 * Market Data API Routes
 * All endpoints read from local storage (Redis/DB)
 */

import { FastifyInstance } from 'fastify';
import { get, set } from '../cache/redis.js';
import { getMarketOverview } from '../repositories/marketRepository.js';
import { getChainsData } from '../repositories/chainRepository.js';
import { getProtocolsData } from '../repositories/protocolRepository.js';
import { getTrendingTokens, getTopGainers } from '../services/coingecko.js';
import { getChainMetricsFromDune } from '../services/dune.js';
import { getChainsData as fetchChainsData, getProtocolHistoricalTvl, getProtocolDetails } from '../services/defillama.js';
import { getKeyMarketIndicators } from '../services/yahooFinance.js';
import { env } from '../config/env.js';
import { AppError, handleExternalApiError } from '../middleware/errorHandler.js';
import { validateLimit } from '../utils/validation.js';

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
        updatedAt: new Date().toISOString(),
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
      const chains = await getChainsData();

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
      const protocols = await getProtocolsData();

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
      // This is real-time data, so we call API directly (with short cache)
      const trending = await getTrendingTokens(env.apiKeys.coingecko);

      // Return coins array from trending response
      const coins = trending.coins || trending || [];

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

  // GET /api/market/protocol/:name
  fastify.get('/protocol/:name', async (request, reply) => {
    try {
      const { name } = request.params as { name: string };

      if (!name) {
        throw new AppError(400, 'Protocol name is required', 'VALIDATION_ERROR');
      }

      // Fetch protocol details from DeFiLlama
      const details = await getProtocolDetails(name);

      if (!details) {
        return reply.status(404).send({
          success: false,
          error: 'Protocol not found',
        });
      }

      return reply.send({
        success: true,
        data: details,
      });
    } catch (error) {
      throw handleExternalApiError(error as Error, 'DeFiLlama');
    }
  });

  // GET /api/market/protocol/:name/history
  fastify.get('/protocol/:name/history', async (request, reply) => {
    try {
      const { name } = request.params as { name: string };

      if (!name) {
        throw new AppError(400, 'Protocol name is required', 'VALIDATION_ERROR');
      }

      // Fetch historical TVL data from DeFiLlama
      const history = await getProtocolHistoricalTvl(name);

      return reply.send({
        success: true,
        data: history,
        count: history.length,
      });
    } catch (error) {
      throw handleExternalApiError(error as Error, 'DeFiLlama');
    }
  });

  // GET /api/market/indicators
  // Returns VIX, DXY, Gold, Oil, EUR/USD from Yahoo Finance
  fastify.get('/indicators', async (request, reply) => {
    try {
      const cacheKey = 'market:indicators';
      const CACHE_TTL = 300; // 5 minutes cache

      // Check cache
      const cached = await get(cacheKey);
      if (cached) {
        return reply.send({
          success: true,
          data: JSON.parse(cached),
          cached: true,
        });
      }

      // Fetch from Yahoo Finance
      const indicators = await getKeyMarketIndicators();

      // Transform to frontend format
      const formattedIndicators = [];

      if (indicators.vix) {
        formattedIndicators.push({
          id: 'VIX',
          name: 'VIX',
          fullName: 'CBOE Volatility Index',
          value: indicators.vix.regularMarketPrice,
          change: indicators.vix.regularMarketChange,
          changePercent: indicators.vix.regularMarketChangePercent,
          previousClose: indicators.vix.regularMarketPreviousClose,
          timestamp: new Date(indicators.vix.regularMarketTime * 1000).toISOString(),
          source: 'Yahoo Finance',
          category: 'volatility',
        });
      }

      if (indicators.dxy) {
        formattedIndicators.push({
          id: 'DXY',
          name: 'DXY',
          fullName: 'US Dollar Index',
          value: indicators.dxy.regularMarketPrice,
          change: indicators.dxy.regularMarketChange,
          changePercent: indicators.dxy.regularMarketChangePercent,
          previousClose: indicators.dxy.regularMarketPreviousClose,
          timestamp: new Date(indicators.dxy.regularMarketTime * 1000).toISOString(),
          source: 'Yahoo Finance',
          category: 'currency',
        });
      }

      if (indicators.gold) {
        formattedIndicators.push({
          id: 'GOLD',
          name: 'Gold',
          fullName: 'Gold Futures',
          value: indicators.gold.regularMarketPrice,
          change: indicators.gold.regularMarketChange,
          changePercent: indicators.gold.regularMarketChangePercent,
          previousClose: indicators.gold.regularMarketPreviousClose,
          timestamp: new Date(indicators.gold.regularMarketTime * 1000).toISOString(),
          source: 'Yahoo Finance',
          category: 'commodity',
        });
      }

      if (indicators.oil) {
        formattedIndicators.push({
          id: 'OIL',
          name: 'Crude Oil',
          fullName: 'WTI Crude Oil Futures',
          value: indicators.oil.regularMarketPrice,
          change: indicators.oil.regularMarketChange,
          changePercent: indicators.oil.regularMarketChangePercent,
          previousClose: indicators.oil.regularMarketPreviousClose,
          timestamp: new Date(indicators.oil.regularMarketTime * 1000).toISOString(),
          source: 'Yahoo Finance',
          category: 'commodity',
        });
      }

      if (indicators.eurusd) {
        formattedIndicators.push({
          id: 'EURUSD',
          name: 'EUR/USD',
          fullName: 'Euro / US Dollar',
          value: indicators.eurusd.regularMarketPrice,
          change: indicators.eurusd.regularMarketChange,
          changePercent: indicators.eurusd.regularMarketChangePercent,
          previousClose: indicators.eurusd.regularMarketPreviousClose,
          timestamp: new Date(indicators.eurusd.regularMarketTime * 1000).toISOString(),
          source: 'Yahoo Finance',
          category: 'currency',
        });
      }

      // Cache the result
      if (formattedIndicators.length > 0) {
        await set(cacheKey, JSON.stringify(formattedIndicators), CACHE_TTL);
      }

      return reply.send({
        success: true,
        data: formattedIndicators,
        cached: false,
      });
    } catch (error) {
      console.error('[Market] Error fetching indicators:', error);
      throw handleExternalApiError(error as Error, 'Yahoo Finance');
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

