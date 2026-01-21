import { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

export async function zoraRoutes(fastify: FastifyInstance) {
    /**
     * POST /api/zora/sniper/start
     * @deprecated Global service is now auto-started. This endpoint is no-op.
     */
    fastify.post('/sniper/start', { preHandler: requireAuth }, async (request, reply) => {
        // No-op: Service is now global and runs automatically
        return { success: true, message: 'Global Zora Detector is active' };
    });

    /**
     * POST /api/zora/sniper/stop
     * @deprecated Global service cannot be stopped by individual users.
     */
    fastify.post('/sniper/stop', { preHandler: requireAuth }, async (request, reply) => {
        // No-op
        return { success: true, message: 'Global Zora Detector cannot be stopped' };
    });

    /**
     * POST /api/zora/swap
     * @deprecated Auto-buy functionality has been removed.
     */
    fastify.post('/swap', { preHandler: requireAuth }, async (request, reply) => {
        throw new AppError(400, 'Auto-buy functionality has been removed from Zora integration', 'FEATURE_REMOVED');
    });
}
