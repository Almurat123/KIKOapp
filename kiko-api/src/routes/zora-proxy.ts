/**
 * Zora API Proxy Route
 * Proxies requests to Zora REST API to hide API key from frontend
 */

import { FastifyInstance } from 'fastify';

const ZORA_API_BASE = 'https://api-sdk.zora.engineering';

export async function zoraProxyRoutes(fastify: FastifyInstance) {
    const ZORA_API_KEY = process.env.ZORA_API_KEY || '';

    /**
     * GET /api/zora-proxy/coin
     * Proxy for Zora token details
     */
    fastify.get('/coin', async (request, reply) => {
        try {
            const { address, chain } = request.query as any;

            if (!address) {
                return reply.status(400).send({ error: 'address is required' });
            }

            const chainId = chain || '8453'; // Default to Base
            const url = `${ZORA_API_BASE}/coin?address=${address}&chain=${chainId}`;

            const headers: HeadersInit = {
                'Content-Type': 'application/json',
            };

            if (ZORA_API_KEY) {
                headers['api-key'] = ZORA_API_KEY;
            }

            const response = await fetch(url, {
                method: 'GET',
                headers,
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[Zora Proxy] API error: ${response.status} ${errorText}`);
                return reply.status(response.status).send({ error: 'Zora API error' });
            }

            const data = await response.json();
            return reply.send(data);
        } catch (error) {
            console.error('[Zora Proxy] Error:', error);
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });
}
