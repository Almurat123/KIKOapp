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
import { requireAuth } from '../middleware/auth.js';
import prisma from '../db/prisma.js';

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
     * GET /api/polymarket/copy/configs
     * List Polymarket copy trade configs for the authenticated user
     */
    fastify.get('/copy/configs', { preHandler: requireAuth }, async (request, reply) => {
        try {
            const user = (request as any).user;
            const privyDid = user?.sub || user?.privyDid;
            if (!privyDid) {
                return reply.status(401).send({ success: false, error: 'Authentication required' });
            }

            const dbUser = await prisma.user.findUnique({
                where: { privyDid }
            });

            if (!dbUser) {
                return { success: true, configs: [] };
            }

            const configs = await prisma.polymarketCopyConfig.findMany({
                where: { userId: dbUser.privyDid },
                orderBy: { createdAt: 'desc' }
            });

            return { success: true, configs };
        } catch (error) {
            console.error('[Polymarket] Error fetching copy configs:', error);
            return reply.status(500).send({ success: false, error: 'Failed to fetch copy configs' });
        }
    });

    /**
     * GET /api/polymarket/trading/readiness
     * Check if user is ready to trade on Polymarket
     * Requires: JWT auth
     */
    fastify.get('/trading/readiness', { preHandler: requireAuth }, async (request, reply) => {
        try {
            const user = (request as any).user;
            const privyDid = user?.sub || user?.privyDid;
            if (!privyDid) {
                return reply.status(401).send({ success: false, error: 'Authentication required' });
            }

            const { checkTradingReadiness } = await import('../services/polymarketApprovalService.js');
            const readiness = await checkTradingReadiness(privyDid);

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
    fastify.post('/trading/credentials', { preHandler: requireAuth }, async (request, reply) => {
        try {
            const user = (request as any).user;
            const privyDid = user?.sub || user?.privyDid;
            if (!privyDid) {
                return reply.status(401).send({ success: false, error: 'Authentication required' });
            }

            const { createOrDeriveCredentials } = await import('../services/polymarketCredService.js');
            const result = await createOrDeriveCredentials(privyDid);

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
     * POST /api/polymarket/trading/credentials/revoke
     * Revoke (delete) user's Polymarket API credentials
     * Requires: JWT auth
     */
    fastify.post('/trading/credentials/revoke', { preHandler: requireAuth }, async (request, reply) => {
        try {
            const user = (request as any).user;
            const privyDid = user?.sub || user?.privyDid;
            if (!privyDid) {
                return reply.status(401).send({ success: false, error: 'Authentication required' });
            }

            const { deleteCredentials } = await import('../services/polymarketCredService.js');
            const deleted = await deleteCredentials(privyDid);

            if (!deleted) {
                return reply.status(500).send({ success: false, error: 'Failed to revoke Polymarket credentials' });
            }

            return {
                success: true,
                data: {
                    revoked: true
                }
            };
        } catch (error: any) {
            console.error('[Polymarket] Error revoking credentials:', error);
            return reply.status(500).send({ success: false, error: error.message });
        }
    });

    /**
     * GET /api/polymarket/trading/approvals
     * Get required approval transactions for the user
     * Requires: JWT auth
     */
    fastify.get('/trading/approvals', { preHandler: requireAuth }, async (request, reply) => {
        try {
            const user = (request as any).user;
            const privyDid = user?.sub || user?.privyDid;
            if (!privyDid) {
                return reply.status(401).send({ success: false, error: 'Authentication required' });
            }

            const { getCredentials } = await import('../services/polymarketCredService.js');
            const { getRequiredApprovals, POLYMARKET_CONTRACTS } = await import('../services/polymarketApprovalService.js');

            const creds = await getCredentials(privyDid);
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
                        negRiskExchange: POLYMARKET_CONTRACTS.NEG_RISK_CTF_EXCHANGE,
                        negRiskAdapter: POLYMARKET_CONTRACTS.NEG_RISK_ADAPTER,
                        ctf: POLYMARKET_CONTRACTS.CTF
                    }
                }
            };
        } catch (error: any) {
            console.error('[Polymarket] Error getting approvals:', error);
            return reply.status(500).send({ success: false, error: error.message });
        }
    });

    fastify.post('/trading/approvals/execute', { preHandler: requireAuth }, async (request, reply) => {
        try {
            const user = (request as any).user;
            const privyDid = user?.sub || user?.privyDid;
            if (!privyDid) {
                return reply.status(401).send({ success: false, error: 'Authentication required' });
            }

            const authorization = request.headers.authorization || '';
            const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
            const { executeRequiredApprovals } = await import('../services/polymarketApprovalService.js');
            const result = await executeRequiredApprovals({ userId: privyDid, accessToken });

            return {
                success: true,
                data: result
            };
        } catch (error: any) {
            console.error('[Polymarket] Error executing approvals:', error);
            return reply.status(500).send({ success: false, error: error.message });
        }
    });

    /**
     * GET /api/polymarket/trading/wallet
     * Get user's Polymarket wallet address (their Privy wallet)
     * Requires: JWT auth
     */
    fastify.get('/trading/wallet', { preHandler: requireAuth }, async (request, reply) => {
        try {
            const user = (request as any).user;
            const privyDid = user?.sub || user?.privyDid;
            if (!privyDid) {
                return reply.status(401).send({ success: false, error: 'Authentication required' });
            }

            const { getCredentials } = await import('../services/polymarketCredService.js');
            const creds = await getCredentials(privyDid);

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
            const wallet = await getPolymarketWallet(privyDid);

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
    /**
     * GET /api/polymarket/trading/positions
     * Get user's open positions on Polymarket
     * Requires: JWT auth
     */
    fastify.get('/trading/positions', { preHandler: requireAuth }, async (request, reply) => {
        try {
            const user = (request as any).user;
            const privyDid = user?.sub || user?.privyDid;
            if (!privyDid) {
                return reply.status(401).send({ success: false, error: 'Authentication required' });
            }

            // Get wallet address (either from creds or direct from Privy)
            const { getCredentials, getPolymarketWallet } = await import('../services/polymarketCredService.js');
            const creds = await getCredentials(privyDid);

            let walletAddress: string | undefined = creds?.walletAddress;
            if (!walletAddress) {
                walletAddress = await getPolymarketWallet(privyDid) ?? undefined;
            }

            if (!walletAddress) {
                return reply.status(400).send({ success: false, error: 'Could not resolve Polymarket wallet address' });
            }

            const { getWalletPositions } = await import('../services/polymarketDataService.js');
            const positions = await getWalletPositions(walletAddress);

            return {
                success: true,
                data: positions
            };
        } catch (error: any) {
            console.error('[Polymarket] Error fetching positions:', error);
            return reply.status(500).send({
                success: false,
                error: error.message || 'Internal server error',
                path: '/trading/positions'
            });
        }
    });

    /**
     * GET /api/polymarket/trading/history
     * Get user's trade history on Polymarket
     * Requires: JWT auth
     */
    fastify.get('/trading/history', { preHandler: requireAuth }, async (request, reply) => {
        try {
            const user = (request as any).user;
            const privyDid = user?.sub || user?.privyDid;
            if (!privyDid) {
                return reply.status(401).send({ success: false, error: 'Authentication required' });
            }

            // Get wallet address (either from creds or direct from Privy)
            const { getCredentials, getPolymarketWallet } = await import('../services/polymarketCredService.js');
            const creds = await getCredentials(privyDid);

            let walletAddress: string | undefined = creds?.walletAddress;
            if (!walletAddress) {
                walletAddress = await getPolymarketWallet(privyDid) ?? undefined;
            }

            if (!walletAddress) {
                return reply.status(400).send({ success: false, error: 'Could not resolve Polymarket wallet address' });
            }

            const { getWalletTrades } = await import('../services/polymarketDataService.js');
            const trades = await getWalletTrades(walletAddress);

            return {
                success: true,
                data: trades
            };
        } catch (error: any) {
            console.error('[Polymarket] Error fetching history:', error);
            return reply.status(500).send({
                success: false,
                error: error.message || 'Internal server error',
                path: '/trading/history'
            });
        }
    });

    /**
     * GET /api/polymarket/trading/orders
     * Get user's open limit orders on Polymarket
     * Requires: JWT auth
     */
    fastify.get('/trading/orders', { preHandler: requireAuth }, async (request, reply) => {
        try {
            const user = (request as any).user;
            const privyDid = user?.sub || user?.privyDid;
            if (!privyDid) {
                return reply.status(401).send({ success: false, error: 'Authentication required' });
            }

            const { getCredentials, getPolymarketWallet } = await import('../services/polymarketCredService.js');
            const creds = await getCredentials(privyDid);

            let walletAddress: string | undefined = creds?.walletAddress;
            if (!walletAddress) {
                walletAddress = await getPolymarketWallet(privyDid) ?? undefined;
            }

            if (!walletAddress) {
                return reply.status(400).send({ success: false, error: 'Could not resolve Polymarket wallet address' });
            }

            const { getOpenOrdersForUser } = await import('../services/polymarketDataService.js');
            const orders = await getOpenOrdersForUser(privyDid, walletAddress);

            return {
                success: true,
                data: orders
            };
        } catch (error: any) {
            console.error('[Polymarket] Error fetching open orders:', error);
            return reply.status(500).send({
                success: false,
                error: error.message || 'Internal server error',
                path: '/trading/orders'
            });
        }
    });

    /**
     * POST /api/polymarket/trading/order/cancel
     * Cancel an open limit order
     * Requires: JWT auth
     */
    fastify.post('/trading/order/cancel', { preHandler: requireAuth }, async (request, reply) => {
        try {
            const user = (request as any).user;
            const privyDid = user?.sub || user?.privyDid;
            if (!privyDid) {
                return reply.status(401).send({ success: false, error: 'Authentication required' });
            }

            const { orderId } = request.body as { orderId: string };
            if (!orderId) {
                return reply.status(400).send({ success: false, error: 'orderId is required' });
            }

            const { cancelOrder } = await import('../services/polymarketExecutor.js');
            const result = await cancelOrder({ orderId, userId: privyDid });

            return {
                success: result.success,
                error: result.error
            };
        } catch (error: any) {
            console.error('[Polymarket] Error canceling order:', error);
            return reply.status(500).send({ success: false, error: error.message });
        }
    });

    /**
     * POST /api/polymarket/trading/position/close
     * Close (sell) an active position
     * Requires: JWT auth
     */
    fastify.post('/trading/position/close', { preHandler: requireAuth }, async (request, reply) => {
        try {
            const user = (request as any).user;
            const privyDid = user?.sub || user?.privyDid;
            if (!privyDid) {
                return reply.status(401).send({ success: false, error: 'Authentication required' });
            }

            const { positionId, currentPrice, shares } = request.body as {
                positionId: string;
                currentPrice?: number;
                shares?: number;
            };
            if (!positionId) {
                return reply.status(400).send({ success: false, error: 'positionId is required' });
            }

            const { closePosition } = await import('../services/polymarketExecutor.js');
            const result = await closePosition({
                userId: privyDid,
                positionId,
                currentPrice,
                shares
            });

            return {
                success: result.success,
                orderId: result.orderId,
                error: result.error
            };
        } catch (error: any) {
            console.error('[Polymarket] Error closing position:', error);
            return reply.status(500).send({ success: false, error: error.message });
        }
    });
};
