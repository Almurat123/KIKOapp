import { FastifyInstance } from 'fastify';
import { walletService } from '../services/walletService.js';

export async function walletRoutes(fastify: FastifyInstance) {
    // Get all monitored wallets
    fastify.get('/', async (request, reply) => {
        try {
            const user = (request as any).user;
            const wallets = await walletService.getMonitoredWallets(user.sub);
            return reply.send(wallets);
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Failed to fetch wallets' });
        }
    });

    // Monitor a new wallet
    fastify.post('/', async (request, reply) => {
        try {
            const { address, name, tags } = request.body as { address: string; name: string; tags?: string[] };

            if (!address || !name) {
                return reply.status(400).send({ error: 'Address and name are required' });
            }

            const user = (request as any).user;
            const wallet = await walletService.monitorWallet({
                userId: user.sub,
                address,
                alias: name,
                labels: tags || []
            });
            return reply.status(201).send(wallet);
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Failed to add wallet' });
        }
    });

    // Stop monitoring a wallet
    fastify.delete('/:address', async (request, reply) => {
        try {
            const { address } = request.params as { address: string };
            const user = (request as any).user;
            await walletService.stopMonitoring(parseInt(address), user.sub);
            return reply.status(204).send();
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Failed to remove wallet' });
        }
    });

    // Get wallet details
    fastify.get('/:address', async (request, reply) => {
        try {
            const { address } = request.params as { address: string };
            const user = (request as any).user;
            const details = await walletService.getWalletDetails(user.sub, address);

            if (!details.wallet) {
                return reply.status(404).send({ error: 'Wallet not found' });
            }

            return reply.send(details);
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Failed to fetch wallet details' });
        }
    });

    // Get wallet balance (Real-time from Alchemy/RPC)
    fastify.get('/:address/balance', async (request, reply) => {
        try {
            const { address } = request.params as { address: string };
            const { chain } = request.query as { chain?: string };

            // Note: Balance fetch doesn't strictly require user auth if address is public, 
            // but we keep it authenticated for consistency and rate limiting context
            const balance = await walletService.getWalletBalance(address, chain || 'eth');
            return reply.send(balance);
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Failed to fetch wallet balance' });
        }
    });

    // Get wallet transactions (Real-time from Alchemy/RPC)
    fastify.get('/:address/transactions', async (request, reply) => {
        try {
            const { address } = request.params as { address: string };
            const { chain, limit } = request.query as { chain?: string; limit?: string };

            const transactions = await walletService.getWalletTransactions(address, {
                chain: chain || 'eth',
                limit: limit ? parseInt(limit) : 25
            });
            return reply.send(transactions);
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ error: 'Failed to fetch transactions' });
        }
    });
}
