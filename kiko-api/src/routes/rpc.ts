/**
 * RPC Proxy Routes
 * Proxies RPC calls to Alchemy (EVM) and Helius (Solana) to hide API keys from frontend
 */

import { FastifyInstance } from 'fastify';

// Chain ID to Alchemy network mapping
const ALCHEMY_NETWORKS: Record<number, string> = {
    1: 'eth-mainnet',
    8453: 'base-mainnet',
    42161: 'arb-mainnet',
    137: 'polygon-mainnet',
    10: 'opt-mainnet',
};

export async function rpcRoutes(fastify: FastifyInstance) {
    // API Keys from environment
    const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || '';
    const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '';

    /**
     * POST /api/rpc/evm
     * Proxy EVM RPC calls through Alchemy
     */
    fastify.post('/evm', async (request, reply) => {
        try {
            const payload = request.body as any;
            const chainId = payload.chainId || (payload[0]?.chainId); // Handle potential batch
            const method = payload.method || payload[0]?.method;

            if (!chainId && !request.url.includes('batch')) {
                return reply.status(400).send({ error: 'chainId is required' });
            }

            if (!ALCHEMY_API_KEY) {
                return reply.status(500).send({ error: 'Alchemy API key not configured' });
            }

            const network = ALCHEMY_NETWORKS[chainId];
            if (!network) {
                // Fallback or error
                const publicRpcs: Record<number, string> = { 56: 'https://bsc-dataseed.bnbchain.org' };
                const publicRpc = publicRpcs[chainId];
                if (!publicRpc) return reply.status(400).send({ error: `Unsupported chainId: ${chainId}` });

                const response = await fetch(publicRpc, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload.method ? {
                        jsonrpc: '2.0',
                        id: payload.id || 1,
                        method: payload.method,
                        params: payload.params || []
                    } : payload),
                });

                const data = await response.json();
                return reply.send(data);
            }

            const alchemyUrl = `https://${network}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
            const response = await fetch(alchemyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload.method ? {
                    jsonrpc: '2.0',
                    id: payload.id || 1,
                    method: payload.method,
                    params: payload.params || []
                } : payload),
            });

            const data = await response.json();
            return reply.send(data);
        } catch (error) {
            console.error('[RPC Proxy] EVM error:', error);
            return reply.status(500).send({ error: 'RPC request failed' });
        }
    });

    /**
     * POST /api/rpc/solana
     * Proxy Solana RPC calls through Helius
     */
    fastify.post('/solana', async (request, reply) => {
        try {
            const payload = request.body as any;

            if (!HELIUS_API_KEY) {
                const publicRpc = 'https://api.mainnet-beta.solana.com';
                const response = await fetch(publicRpc, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload.method ? {
                        jsonrpc: '2.0',
                        id: payload.id || 1,
                        method: payload.method,
                        params: payload.params || []
                    } : payload),
                });

                const data = await response.json();
                return reply.send(data);
            }

            const heliusUrl = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
            const response = await fetch(heliusUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload.method ? {
                    jsonrpc: '2.0',
                    id: payload.id || 1,
                    method: payload.method,
                    params: payload.params || []
                } : payload),
            });

            const data = await response.json();
            return reply.send(data);
        } catch (error) {
            console.error('[RPC Proxy] Solana error:', error);
            return reply.status(500).send({ error: 'RPC request failed' });
        }
    });

    /**
     * POST /api/rpc/batch
     * Batch RPC calls for EVM chains
     */
    fastify.post('/batch', async (request, reply) => {
        try {
            const { chainId, calls } = request.body as any;

            if (!chainId || !Array.isArray(calls)) {
                return reply.status(400).send({ error: 'chainId and calls array are required' });
            }

            if (!ALCHEMY_API_KEY) {
                return reply.status(500).send({ error: 'Alchemy API key not configured' });
            }

            const network = ALCHEMY_NETWORKS[chainId];
            if (!network) {
                return reply.status(400).send({ error: `Unsupported chainId for batch: ${chainId}` });
            }

            const alchemyUrl = `https://${network}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
            const batchBody = calls.map((call: any, index: number) => ({
                jsonrpc: '2.0',
                method: call.method,
                params: call.params || [],
                id: index + 1,
            }));

            const response = await fetch(alchemyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(batchBody),
            });

            const data = await response.json();
            return reply.send(data);
        } catch (error) {
            console.error('[RPC Proxy] Batch error:', error);
            return reply.status(500).send({ error: 'Batch RPC request failed' });
        }
    });
}
