import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { walletService } from '../services/walletService.js';
import { requireAuth as authMiddleware } from '../middleware/auth.js';

export default async function walletRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
    // Add authentication to all wallet routes
    fastify.addHook('preHandler', authMiddleware);

    /**
     * Get all monitored wallets for the authenticated user
     */
    fastify.get('/', async (request: any, reply) => {
        try {
            const userId = request.user.sub || request.user.id;
            const wallets = await walletService.getMonitoredWallets(userId);

            return reply.send({
                success: true,
                data: wallets,
                count: wallets.length,
            });
        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({
                success: false,
                message: 'Failed to fetch wallets'
            });
        }
    });

    /**
     * Add a new wallet to monitor
     */
    fastify.post('/', async (request: any, reply) => {
        try {
            const userId = request.user.sub || request.user.id;
            const { address, alias, labels, chain } = request.body as any;

            if (!address) {
                return reply.status(400).send({
                    success: false,
                    message: 'Wallet address is required'
                });
            }

            const wallet = await walletService.monitorWallet({
                userId,
                address,
                alias: alias || address.substring(0, 6),
                labels: labels || [],
                chain: chain || 'eth'
            });

            return reply.status(201).send({
                success: true,
                data: wallet
            });
        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({
                success: false,
                message: error.message || 'Failed to add wallet'
            });
        }
    });

    /**
     * Remove a monitored wallet
     */
    fastify.delete('/:id', async (request: any, reply) => {
        try {
            const userId = request.user.sub || request.user.id;
            const { id } = request.params as any;

            const success = await walletService.stopMonitoring(parseInt(id), userId);

            if (!success) {
                return reply.status(404).send({
                    success: false,
                    message: 'Wallet not found or not owned by user'
                });
            }

            return reply.send({
                success: true,
                message: 'Wallet removed from monitoring'
            });
        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({
                success: false,
                message: 'Failed to remove wallet'
            });
        }
    });

    /**
     * Get transaction history for user's monitored wallets
     */
    fastify.get('/history', async (request: any, reply) => {
        try {
            const userId = request.user.sub || request.user.id;
            const { limit } = request.query as any;

            const history = await walletService.getHistory(userId, limit ? parseInt(limit) : 50);

            return reply.send({
                success: true,
                data: history
            });
        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({
                success: false,
                message: 'Failed to fetch transaction history'
            });
        }
    });

    /**
     * Get detailed report for a specific wallet
     */
    fastify.get('/:address', async (request: any, reply) => {
        try {
            const userId = request.user.sub || request.user.id;
            const { address } = request.params as any;

            const details = await walletService.getWalletDetails(userId, address);

            if (!details.wallet) {
                return reply.status(404).send({
                    success: false,
                    message: 'Wallet not found in your monitored list'
                });
            }

            return reply.send({
                success: true,
                data: details
            });
        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({
                success: false,
                message: 'Failed to fetch wallet details'
            });
        }
    });

    /**
     * Get real-time balance for a specific wallet
     */
    fastify.get('/:address/balance', async (request: any, reply) => {
        try {
            const userId = request.user.sub || request.user.id;
            const { address } = request.params as any;
            const { chain = 'eth' } = request.query as any;

            // Verify the address is monitored by the user or is their own wallet
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
