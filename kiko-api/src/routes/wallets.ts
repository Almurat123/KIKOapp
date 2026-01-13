import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { walletService } from '../services/walletService.js';
import { requireAuth as authMiddleware } from '../middleware/auth.js';

export default async function walletRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
    // Add authentication to all wallet routes
    fastify.addHook('preHandler', authMiddleware);

    /**
     * Get real-time balance for a specific wallet
     */
    fastify.get('/:address/balance', async (request: any, reply) => {
        try {
            const userId = request.user.sub || request.user.id;
            const { address } = request.params as any;
            const { chain = 'eth' } = request.query as any;

            // Verify the address is the user's own wallet
            const hasAccess = await walletService.verifyAccess(userId, address);
            if (!hasAccess) {
                return reply.status(403).send({
                    success: false,
                    message: 'Access denied'
                });
            }

            const balance = await walletService.getWalletBalance(address, chain);

            return reply.send({
                success: true,
                data: balance
            });
        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({
                success: false,
                message: 'Failed to fetch wallet balance'
            });
        }
    });

    /**
     * Get real-time balance for all supported chains
     */
    fastify.get('/:address/all-balances', async (request: any, reply) => {
        try {
            const userId = request.user.sub || request.user.id;
            const { address } = request.params as any;
            const { solanaAddress } = request.query as any;

            // Verify ownership/monitoring
            const hasAccess = await walletService.verifyAccess(userId, address);
            if (!hasAccess) {
                return reply.status(403).send({
                    success: false,
                    message: 'Access denied'
                });
            }

            const balances = await walletService.getAllChainBalances(address, solanaAddress);

            return reply.send({
                success: true,
                data: balances
            });
        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({
                success: false,
                message: 'Failed to fetch all-chain balances'
            });
        }
    });

    /**
     * Get real-time transactions for a specific wallet
     */
    fastify.get('/:address/transactions', async (request: any, reply) => {
        try {
            const userId = request.user.sub || request.user.id;
            const { address } = request.params as any;
            const { chain = 'eth', limit = 50 } = request.query as any;

            // Verify ownership/monitoring
            const hasAccess = await walletService.verifyAccess(userId, address);
            if (!hasAccess) {
                return reply.status(403).send({
                    success: false,
                    message: 'Access denied'
                });
            }

            const transactions = await walletService.getWalletTransactions(address, {
                chain,
                limit: parseInt(limit)
            });

            console.log(`[WalletRoutes] Returning ${transactions.length} transactions for ${address}`);

            return reply.send({
                success: true,
                data: transactions
            });
        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({
                success: false,
                message: 'Failed to fetch wallet transactions'
            });
        }
    });
}
