import { FastifyInstance } from 'fastify';
import { getPortfolio } from '../services/zapperService.js';
import { AppError } from '../middleware/errorHandler.js';

export async function zapperRoutes(fastify: FastifyInstance) {
    // GET /api/zapper/portfolio?address=0x...
    fastify.get('/portfolio', async (request, reply) => {
        try {
            const { address } = request.query as { address: string };

            if (!address) {
                throw new AppError(400, 'Address is required', 'VALIDATION_ERROR');
            }

            const data = await getPortfolio(address);

            if (!data) {
                // Did it fail or just empty? Service returns null on error/config missing.
                // We can return success: false or just data: null with message.
                return reply.status(502).send({
                    success: false,
                    error: 'Failed to fetch Zapper data or service unavailable',
                });
            }

            return reply.send({
                success: true,
                data,
            });

        } catch (error) {
            if (error instanceof AppError) throw error;
            throw new AppError(500, 'Internal Server Error', 'INTERNAL_ERROR');
        }
    });
}
