/**
 * Test route for Judge Engine v3.5
 * Temporary endpoint for testing the multi-layer decision system
 */

import { FastifyInstance } from 'fastify';
import { runJudgeEngine } from '../services/judge/judgeEngine.js';
import { analyzeTradeOpportunity } from '../services/copyTradeAnalysisService.js';

export default async function testJudgeRoutes(fastify: FastifyInstance) {

    /**
     * POST /api/test-judge/analyze
     * Test the Judge Engine with a token
     */
    fastify.post('/analyze', async (request, reply) => {
        const { tokenAddress, chainId, userAmount } = request.body as {
            tokenAddress: string;
            chainId: number;
            userAmount?: number;
        };

        if (!tokenAddress || !chainId) {
            return reply.status(400).send({
                error: 'Missing required fields: tokenAddress, chainId',
            });
        }

        try {
            const result = await runJudgeEngine(
                tokenAddress,
                chainId,
                userAmount || 100,  // Default $100
                undefined  // No target wallet for manual test
            );

            return reply.send({
                success: true,
                data: result,
            });
        } catch (error: any) {
            console.error('[Test Judge] Error:', error);
            return reply.status(500).send({
                success: false,
                error: error.message,
                stack: error.stack,
            });
        }
    });

    /**
     * POST /api/test-judge/legacy
     * Test the legacy analyzeTradeOpportunity wrapper
     */
    fastify.post('/legacy', async (request, reply) => {
        const { tokenAddress, chainId, targetWallet, userAmount } = request.body as {
            tokenAddress: string;
            chainId: number;
            targetWallet?: string;
            userAmount?: number;
        };

        if (!tokenAddress || !chainId) {
            return reply.status(400).send({
                error: 'Missing required fields: tokenAddress, chainId',
            });
        }

        try {
            const result = await analyzeTradeOpportunity(
                tokenAddress,
                chainId,
                targetWallet || '0x0000000000000000000000000000000000000000',
                userAmount || 100
            );

            return reply.send({
                success: true,
                data: result,
            });
        } catch (error: any) {
            console.error('[Test Judge Legacy] Error:', error);
            return reply.status(500).send({
                success: false,
                error: error.message,
                stack: error.stack,
            });
        }
    });

    /**
     * GET /api/test-judge/health
     * Health check
     */
    fastify.get('/health', async (request, reply) => {
        return reply.send({
            success: true,
            message: 'Judge Engine test routes active',
            version: '3.5',
        });
    });
}
