/**
 * Social Data API Routes
 * 
 * Data Sources:
 * 1. Snapchain Hub (Primary) - Direct Farcaster data via Hub API
 * 2. Local Storage (Cache) - Database/Redis cache
 * 
 * Note: Only returns casts from the last 24 hours
 */

import { FastifyInstance } from 'fastify';
import { getTrendingCasts, searchCasts, hybridSearchCasts } from '../repositories/socialRepository.js';
import { getQualityUsersStats } from '../repositories/qualityUsersRepository.js';
import { env } from '../config/env.js';
import snapchainService from '../services/snapchainService.js';
import { ogpService } from '../services/ogpService.js';
import { handleDatabaseError, handleExternalApiError } from '../middleware/errorHandler.js';

export async function socialRoutes(fastify: FastifyInstance) {
  // GET /api/social/trending
  // Returns data from the last 24 hours only
  // To refresh data, use POST /api/social/refresh
  fastify.get('/trending', async (request, reply) => {
    try {
      const query = request.query as { limit?: string, timeRange?: 'trending' | '24h' | '7d' | '30d' };
      const limit = query.limit ? parseInt(query.limit, 10) : 50;
      const timeRange = query.timeRange || 'trending';

      // Always get data from local storage (database/cache)
      const trendingCasts = await getTrendingCasts(limit, timeRange);

      return reply.send({
        success: true,
        data: trendingCasts,
        count: trendingCasts.length,
      });
    } catch (error) {
      throw handleDatabaseError(error as Error);
    }
  });

  // GET /api/social/search
  // Hybrid search: local DB first, Neynar API as supplement
  fastify.get('/search', async (request, reply) => {
    try {
      const query = request.query as { q?: string, query?: string, limit?: string, neynar?: string };
      const searchQuery = query.q || query.query;
      const limit = query.limit ? parseInt(query.limit, 10) : 20;
      const useNeynar = query.neynar !== 'false'; // Default to true

      if (!searchQuery || searchQuery.trim().length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'Search query required',
          message: 'Please provide a search query using the "q" or "query" parameter',
        });
      }

      // Use hybrid search (local + Neynar)
      const casts = await hybridSearchCasts(searchQuery, Math.min(limit, 50), useNeynar);

      return reply.send({
        success: true,
        query: searchQuery,
        casts: casts,
        count: casts.length,
        sources: {
          local: casts.filter((c: any) => !c.source || c.source !== 'neynar').length,
          neynar: casts.filter((c: any) => c.source === 'neynar').length
        }
      });
    } catch (error) {
      throw handleDatabaseError(error as Error);
    }
  });

  // POST /api/social/refresh - Manually trigger data refresh
  // This endpoint:
  // 1. Fetches data from Snapchain Hub
  // 2. Saves to database/cache
  // 3. Returns the updated data
  fastify.post('/refresh', async (request, reply) => {
    try {
      const { refreshTrendingCasts } = await import('../jobs/socialDataJob.js');

      // Fetch from API and save to database/cache
      await refreshTrendingCasts();

      // Get updated data from local storage
      const trendingCasts = await getTrendingCasts(50);

      return reply.send({
        success: true,
        message: 'Trending casts refreshed successfully',
        data: trendingCasts,
        count: trendingCasts.length,
      });
    } catch (error) {
      // Even if refresh fails, try to return existing data from storage
      try {
        const existingCasts = await getTrendingCasts(50);
        return reply.send({
          success: false,
          error: 'Refresh failed, returning existing data',
          message: (error as Error).message || 'Failed to refresh trending casts',
          data: existingCasts,
          count: existingCasts.length,
        });
      } catch (storageError) {
        throw handleExternalApiError(error as Error, 'Social Data Refresh');
      }
    }
  });

  // GET /api/social/ogp - Fetch OGP metadata for a URL
  fastify.get('/ogp', async (request, reply) => {
    try {
      const { url } = request.query as { url: string };
      if (!url) {
        return reply.status(400).send({ error: 'URL is required' });
      }

      const metadata = await ogpService.fetchOGP(decodedUrl(url));
      return reply.send({ success: true, data: metadata });
    } catch (error) {
      // Silent fail or minimal error
      return reply.send({ success: false, data: null });
    }
  });

  // Helper to decode just in case specific chars are issues, but standard handling should suffice.
  // Actually fastify decode params automatically? Yes.
  // But let's verify.

  function decodedUrl(u: string) { return u; }

  // GET /api/social/health
  fastify.get('/health', async (request, reply) => {
    try {
      // Check Snapchain Hub status
      let snapchainStatus = 'unknown';
      let hubInfo = null;
      try {
        hubInfo = await snapchainService.getHubInfo();
        snapchainStatus = 'online';
      } catch (e) {
        snapchainStatus = 'offline';
      }

      return reply.send({
        success: true,
        dataSources: {
          snapchain: {
            status: snapchainStatus,
            hubUrl: process.env.SNAPCHAIN_HUB_URL || 'https://hub.merv.fun',
            version: hubInfo?.version,
            messages: hubInfo?.dbStats?.numMessages,
            users: hubInfo?.dbStats?.numFidRegistrations,
          },
        },
        primarySource: 'Snapchain Hub',
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: error.message,
      });
    }
  });

  // ===== SNAPCHAIN ENDPOINTS (Primary Data Source) =====

  // GET /api/social/snapchain/trending
  // DEPRECATED: Direct Snapchain access is disabled to enforce "Save-then-Display" pattern.
  // Social data must be fetched via background jobs, saved to DB, and served via /api/social/trending
  fastify.get('/snapchain/trending', async (request, reply) => {
    return reply.status(400).send({
      success: false,
      error: 'Deprecated Endpoint',
      message: 'Direct Snapchain access is disabled. Use /api/social/trending to fetch data from local storage.',
      deprecated: true
    });
  });

  // GET /api/social/snapchain/user/:fid
  // Fetch user data and casts by FID
  fastify.get('/snapchain/user/:fid', async (request, reply) => {
    try {
      const { fid } = request.params as { fid: string };
      const fidNum = parseInt(fid, 10);

      if (isNaN(fidNum) || fidNum < 1) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid FID',
          message: 'FID must be a positive integer',
        });
      }


      const [userData, casts] = await Promise.all([
        snapchainService.getUserDataByFid(fidNum),
        snapchainService.getCastsByFid(fidNum, 20),
      ]);

      // Get reactions for top casts
      const castsWithReactions = await Promise.all(
        casts.slice(0, 10).map(async (cast) => {
          const reactions = await snapchainService.getReactionsByCast(fidNum, cast.hash);
          return {
            ...cast,
            timestamp: snapchainService.farcasterToUnixTimestamp(cast.timestamp),
            reactions,
          };
        })
      );

      return reply.send({
        success: true,
        source: 'snapchain',
        user: userData,
        casts: castsWithReactions,
        totalCasts: casts.length,
      });
    } catch (error) {
      throw handleExternalApiError(error as Error, 'Snapchain');
    }
  });

  // GET /api/social/snapchain/hub/info
  // Get Snapchain Hub status
  fastify.get('/snapchain/hub/info', async (request, reply) => {
    try {
      const info = await snapchainService.getHubInfo();
      return reply.send({
        success: true,
        data: info,
      });
    } catch (error) {
      throw handleExternalApiError(error as Error, 'Snapchain');
    }
  });

  // GET /api/social/quality-users/stats
  // Get statistics about quality users (followers distribution)
  fastify.get('/quality-users/stats', async (request, reply) => {
    try {
      const stats = await getQualityUsersStats();

      return reply.send({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      console.error('[SocialRoute] Error getting quality users stats:', error);
      return reply.status(500).send({
        success: false,
        error: 'Database error',
        message: error.message,
      });
    }
  });
}

