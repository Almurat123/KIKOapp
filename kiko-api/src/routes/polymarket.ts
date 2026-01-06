/**
 * Polymarket Prediction Market API Routes (Fastify)
 */
import { FastifyPluginAsync } from 'fastify';
import {
    getTrendingEvents,
    getEventDetails,
    getTrendingMarkets,
    searchEvents
} from '../services/polymarket.js';

export const polymarketRoutes: FastifyPluginAsync = async (fastify) => {
    /**
     * GET /api/polymarket/events/trending
     * Get trending prediction events sorted by volume
     */
    fastify.get('/events/trending', async (request, reply) => {
        try {
            const { limit } = request.query as { limit?: string };
            const limitNum = Math.min(parseInt(limit || '10'), 20);
            const data = await getTrendingEvents(limitNum);
            return { success: true, data };
        } catch (error) {
            console.error('[Polymarket] Error fetching trending events:', error);
            return reply.status(500).send({ success: false, error: 'Failed to fetch trending events' });
        }
    });

    /**
     * GET /api/polymarket/events/search
     * Search events by keyword
     * Note: Must be defined BEFORE /events/:id to avoid route conflict
     */
    fastify.get('/events/search', async (request, reply) => {
        try {
            const { q, query, limit } = request.query as { q?: string; query?: string; limit?: string };
            const searchQuery = q || query || '';
            const limitNum = Math.min(parseInt(limit || '10'), 20);

            if (!searchQuery) {
                return reply.status(400).send({ success: false, error: 'Query parameter (q or query) required' });
            }

            const data = await searchEvents(searchQuery, limitNum);
            return { success: true, data };
        } catch (error) {
            console.error('[Polymarket] Error searching events:', error);
            return reply.status(500).send({ success: false, error: 'Failed to search events' });
        }
    });

    /**
     * GET /api/polymarket/events/:id
     * Get event details with all markets and probabilities
     */
    fastify.get('/events/:id', async (request, reply) => {
        try {
            const { id } = request.params as { id: string };
            const data = await getEventDetails(id);
            return { success: true, data };
        } catch (error) {
            console.error('[Polymarket] Error fetching event details:', error);
            return reply.status(500).send({ success: false, error: 'Failed to fetch event details' });
        }
    });

    /**
     * GET /api/polymarket/markets/trending
     * Get trending individual markets sorted by 24h volume
     */
    fastify.get('/markets/trending', async (request, reply) => {
        try {
            const { limit } = request.query as { limit?: string };
            const limitNum = Math.min(parseInt(limit || '10'), 20);
            const data = await getTrendingMarkets(limitNum);
            return { success: true, data };
        } catch (error) {
            console.error('[Polymarket] Error fetching trending markets:', error);
            return reply.status(500).send({ success: false, error: 'Failed to fetch trending markets' });
        }
    });

    // ============ TRADING SETUP ENDPOINTS ============

    /**
     * GET /api/polymarket/trading/readiness
     * Check if user is ready to trade on Polymarket
     * Requires: JWT auth
     */
    fastify.get('/trading/readiness', async (request, reply) => {
        try {
            const user = (request as any).user;
            if (!user?.privyDid) {
                return reply.status(401).send({ success: false, error: 'Authentication required' });
            }

            const { checkTradingReadiness } = await import('../services/polymarketApprovalService.js');
            const readiness = await checkTradingReadiness(user.privyDid);

            return {
                success: true,
                data: readiness
            };
        } catch (error: any) {
            console.error('[Polymarket] Error checking readiness:', error);
            return reply.status(500).send({ success: false, error: error.message });
        }
    });

    /**
     * POST /api/polymarket/trading/credentials
     * Generate or retrieve API credentials for the user
     * Requires: JWT auth
     */
    fastify.post('/trading/credentials', async (request, reply) => {
        try {
            const user = (request as any).user;
            if (!user?.privyDid) {
                return reply.status(401).send({ success: false, error: 'Authentication required' });
            }

            const { createOrDeriveCredentials } = await import('../services/polymarketCredService.js');
            const result = await createOrDeriveCredentials(user.privyDid);

            if (!result.success) {
                return reply.status(400).send({ success: false, error: result.error });
            }

            return {
                success: true,
                data: {
                    hasCredentials: true,
                    apiKey: result.credentials?.apiKey // Only return key, not secret
                }
            };
        } catch (error: any) {
            console.error('[Polymarket] Error generating credentials:', error);
            return reply.status(500).send({ success: false, error: error.message });
        }
    });

    /**
     * GET /api/polymarket/trading/approvals
     * Get required approval transactions for the user
     * Requires: JWT auth
     */
    fastify.get('/trading/approvals', async (request, reply) => {
        try {
            const user = (request as any).user;
            if (!user?.privyDid) {
                return reply.status(401).send({ success: false, error: 'Authentication required' });
            }

            const { getCredentials } = await import('../services/polymarketCredService.js');
            const { getRequiredApprovals, POLYMARKET_CONTRACTS } = await import('../services/polymarketApprovalService.js');

            const creds = await getCredentials(user.privyDid);
            if (!creds) {
                return reply.status(400).send({
                    success: false,
                    error: 'No credentials found. Call POST /trading/credentials first.'
                });
            }

            const approvals = await getRequiredApprovals(creds.walletAddress);

            return {
                success: true,
                data: {
                    walletAddress: creds.walletAddress,
                    needsUsdcApproval: approvals.needsUsdcApproval,
                    needsCtfApproval: approvals.needsCtfApproval,
                    usdcBalance: approvals.usdcBalance,
                    transactions: approvals.transactions,
                    contracts: {
                        usdc: POLYMARKET_CONTRACTS.USDC,
                        ctfExchange: POLYMARKET_CONTRACTS.CTF_EXCHANGE,
                        ctf: POLYMARKET_CONTRACTS.CTF
                    }
                }
            };
        } catch (error: any) {
            console.error('[Polymarket] Error getting approvals:', error);
            return reply.status(500).send({ success: false, error: error.message });
        }
    });

    /**
     * GET /api/polymarket/trading/wallet
     * Get user's Polymarket wallet address (their Privy wallet)
     * Requires: JWT auth
     */
    fastify.get('/trading/wallet', async (request, reply) => {
        try {
            const user = (request as any).user;
            if (!user?.privyDid) {
                return reply.status(401).send({ success: false, error: 'Authentication required' });
            }

            const { getCredentials } = await import('../services/polymarketCredService.js');
            const creds = await getCredentials(user.privyDid);

            if (creds) {
                return {
                    success: true,
                    data: {
                        walletAddress: creds.walletAddress,
                        hasCredentials: true
                    }
                };
            }

            // No credentials yet, get wallet from Privy
            const { getPolymarketWallet } = await import('../services/polymarketCredService.js');
            const wallet = await getPolymarketWallet(user.privyDid);

            return {
                success: true,
                data: {
                    walletAddress: wallet,
                    hasCredentials: false
                }
            };
        } catch (error: any) {
            console.error('[Polymarket] Error getting wallet:', error);
            return reply.status(500).send({ success: false, error: error.message });
        }
    });
};
