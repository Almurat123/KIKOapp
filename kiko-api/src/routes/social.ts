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
import { getTrendingCasts, getTrendingCastsWithCursor, searchCasts, hybridSearchCasts, getFarcasterProfile, checkUserFollowsKiko } from '../repositories/socialRepository.js';
import { getQualityUsersStats } from '../repositories/qualityUsersRepository.js';
import { env } from '../config/env.js';
import snapchainService from '../services/snapchainService.js';
import { ogpService } from '../services/ogpService.js';
import { handleDatabaseError, handleExternalApiError } from '../middleware/errorHandler.js';
import prisma from '../db/prisma.js';
import { getSocialDiscoveryJobStatus } from '../jobs/socialDataJob.js';

export async function socialRoutes(fastify: FastifyInstance) {
  // GET /api/social/trending
  // Returns data from the last 24 hours only
  // To refresh data, use POST /api/social/refresh
  fastify.get('/trending', async (request, reply) => {
    try {
      const query = request.query as { limit?: string, page?: string, timeRange?: 'trending' | '24h' | '7d' | '30d' };
      const limit = query.limit ? parseInt(query.limit, 10) : 50;
      const page = query.page ? parseInt(query.page, 10) : 1;
      const offset = (page - 1) * limit;
      const timeRange = query.timeRange || 'trending';

      // Always get data from local storage (database/cache)
      const trendingCasts = await getTrendingCasts(limit, timeRange, offset);

      return reply.send({
        success: true,
        data: trendingCasts,
        count: trendingCasts.length,
      });
    } catch (error) {
      throw handleDatabaseError(error as Error);
    }
  });

  // GET /api/social/trending/cursor - Twitter-style cursor-based pagination
  // Uses composite cursor (heatScore, timestamp, hash) for stable ordering
  fastify.get('/trending/cursor', async (request, reply) => {
    try {
      const query = request.query as { limit?: string, cursor?: string, timeRange?: 'trending' | '24h' | '7d' | '30d', sortBy?: 'trending' | 'newest' };
      const limit = query.limit ? parseInt(query.limit, 10) : 30;
      const cursor = query.cursor || undefined;
      const timeRange = query.timeRange || 'trending';
      const sortBy = query.sortBy || 'trending';

      const result = await getTrendingCastsWithCursor(limit, timeRange, cursor, sortBy);
      const payload = {
        casts: result.casts,
        count: result.casts.length,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      };

      return reply.send({
        success: true,
        data: payload,
        // Backward compatibility for older clients
        ...payload,
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
      const searchData = {
        query: searchQuery,
        casts,
        count: casts.length,
        sources: {
          local: casts.filter((c: any) => !c.source || c.source !== 'neynar').length,
          neynar: casts.filter((c: any) => c.source === 'neynar').length
        }
      };

      return reply.send({
        success: true,
        data: searchData,
        // Backward compatibility for older clients
        ...searchData
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
      const { runDiscoveryJob } = await import('../jobs/socialDataJob.js');

      // Fetch from API and save to database/cache
      await runDiscoveryJob(true);

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
        return reply.status(400).send({
          success: false,
          error: 'URL is required',
          message: 'Please provide a URL query parameter.',
        });
      }

      const metadata = await ogpService.fetchOGP(decodedUrl(url));
      reply.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
      return reply.send({ success: true, data: metadata });
    } catch (error) {
      // Silent fail or minimal error
      reply.header('Cache-Control', 'public, max-age=60');
      return reply.send({
        success: false,
        data: null,
        error: 'Failed to fetch OGP metadata',
      });
    }
  });

  // GET /api/social/tweet-oembed - Fetch Twitter oEmbed data for a tweet URL
  // Used for X post embed cards in chat citations
  fastify.get('/tweet-oembed', async (request, reply) => {
    try {
      const { url } = request.query as { url: string };
      if (!url) {
        return reply.status(400).send({
          success: false,
          error: 'Tweet URL is required',
        });
      }

      // Validate it's a Twitter/X URL
      if (!url.includes('twitter.com') && !url.includes('x.com')) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid Twitter/X URL',
        });
      }

      // Use Twitter's official oEmbed API
      const oEmbedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`;

      const response = await fetch(oEmbedUrl, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Twitter oEmbed API returned ${response.status}`);
      }

      const data = await response.json();
      return reply.send({
        success: true,
        data,
        // Backward compatibility for clients reading raw oEmbed fields
        ...data,
      });
    } catch (error) {
      console.error('[social] tweet-oembed error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch tweet data',
        message: (error as Error).message
      });
    }
  });

  // Helper to decode just in case specific chars are issues, but standard handling should suffice.
  // Actually fastify decode params automatically? Yes.
  // But let's verify.

  function decodedUrl(u: string) { return u; }

  // GET /api/social/health
  fastify.get('/health', async (request, reply) => {
    try {
      const jobStatus = getSocialDiscoveryJobStatus();
      const latestCast = await prisma.trendingCast.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { hash: true, timestamp: true, updatedAt: true }
      });
      const totalCasts = await prisma.trendingCast.count();

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
        status: jobStatus.status,
        dataSources: {
          snapchain: {
            status: snapchainStatus,
            hubUrl: process.env.SNAPCHAIN_HUB_URL || 'https://hub.merv.fun',
            version: hubInfo?.version,
            messages: hubInfo?.dbStats?.numMessages,
            users: hubInfo?.dbStats?.numFidRegistrations,
          },
        },
        discoveryJob: jobStatus,
        storage: {
          totalCasts,
          latestCastHash: latestCast?.hash || null,
          latestCastTimestamp: latestCast?.timestamp?.toISOString?.() || null,
          latestCastUpdatedAt: latestCast?.updatedAt?.toISOString?.() || null,
          minutesSinceLatestUpdate: latestCast?.updatedAt
            ? Math.floor((Date.now() - latestCast.updatedAt.getTime()) / 60000)
            : null,
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
  // Fetch user data and casts by FID (with DB cache layer)
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

      // === CACHE LAYER: Check DB cache first ===
      const { get, set } = await import('../cache/dbCache.js');
      const cacheKey = `user:fid:${fidNum}`;
      const cached = await get(cacheKey);

      if (cached) {
        const parsed = JSON.parse(cached);
        const responseData = {
          user: parsed.user,
          casts: parsed.casts,
          totalCasts: parsed.totalCasts,
        };
        return reply.send({
          success: true,
          source: 'cache',
          data: responseData,
          ...responseData,
        });
      }

      // === CACHE MISS: Fetch from Hub API ===
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

      const responseData = {
        user: userData,
        casts: castsWithReactions,
        totalCasts: casts.length,
      };

      // === SAVE TO CACHE (30 minutes TTL) ===
      await set(cacheKey, JSON.stringify(responseData), 1800);

      return reply.send({
        success: true,
        source: 'hub',
        data: responseData,
        ...responseData,
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

  // GET /api/social/profile/:username
  // Fetch a Farcaster profile by username (cached 24h)
  fastify.get('/profile/:username', async (request, reply) => {
    try {
      const { username } = request.params as { username: string };
      if (!username) {
        return reply.status(400).send({ success: false, error: 'Username is required' });
      }

      const profile = await getFarcasterProfile(username);

      if (!profile) {
        return reply.status(404).send({ success: false, error: 'Profile not found' });
      }

      return reply.send({
        success: true,
        data: profile
      });
    } catch (error) {
      throw handleDatabaseError(error as Error);
    }
  });

  // GET /api/social/is-following/:fid
  // Check if a user follows the Kiko account
  fastify.get('/is-following/:fid', async (request, reply) => {
    try {
      const { fid } = request.params as { fid: string };
      const fidNum = parseInt(fid, 10);

      if (isNaN(fidNum)) {
        return reply.status(400).send({ success: false, error: 'Invalid FID' });
      }

      const isFollowing = await checkUserFollowsKiko(fidNum);

      return reply.send({
        success: true,
        data: { isFollowing }
      });
    } catch (error) {
      throw handleDatabaseError(error as Error);
    }
  });
}
