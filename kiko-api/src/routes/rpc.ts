/**
 * RPC Proxy Routes
 * Proxies RPC calls using unified API service with automatic failover
 */

import { FastifyInstance } from 'fastify';
import { callRpc } from '../config/unifiedApiService.js';

export async function rpcRoutes(fastify: FastifyInstance) {

    /**
     * POST /api/rpc/evm
     * Proxy EVM RPC calls using unified service with automatic failover
     */
    fastify.post('/evm', async (request, reply) => {
        try {
            const payload = request.body as any;
            const queryChainId = (request.query as any)?.chainId;
            const headerChainId = (request.headers as any)?.['x-chain-id'];
            const chainId = payload.chainId || (payload[0]?.chainId) || queryChainId || headerChainId;
            const method = payload.method || payload[0]?.method;
            const params = payload.params || payload[0]?.params || [];

            if (!chainId) {
                return reply.status(400).send({ error: 'chainId is required' });
            }

            // Use unified RPC service with automatic failover
            const result = await callRpc(chainId, method, params);
            return reply.send({ result, id: payload.id || 1, jsonrpc: '2.0' });
        } catch (error: any) {
            console.error('[RPC Proxy] EVM error:', error);
            return reply.status(500).send({ error: 'RPC request failed', message: error.message });
        }
    });

    /**
     * POST /api/rpc/solana
     * Proxy Solana RPC calls using unified service
     */
    fastify.post('/solana', async (request, reply) => {
        try {
            const payload = request.body as any;
            const method = payload.method || payload[0]?.method;
            const params = payload.params || [];

            // Use unified RPC service (Solana chain)
            const result = await callRpc('solana', method, params);
            return reply.send({ result, id: payload.id || 1, jsonrpc: '2.0' });
        } catch (error: any) {
            console.error('[RPC Proxy] Solana error:', error);
            return reply.status(500).send({ error: 'RPC request failed', message: error.message });
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

            // Process each call in parallel
            const results = await Promise.all(
                calls.map((call: any) => 
                    callRpc(chainId, call.method, call.params || [])
                        .catch((err: any) => ({ error: err.message }))
                )
            );

            return reply.send(results);
        } catch (error: any) {
            console.error('[RPC Proxy] Batch error:', error);
            return reply.status(500).send({ error: 'Batch RPC request failed', message: error.message });
        }
    });
}
