import { FastifyInstance } from 'fastify';
import {
    addFavorite,
    removeFavorite,
    getUserFavorites,
    isFavorite,
    addTokenRule,
    getUserRules,
    TokenRule
} from '../repositories/favoriteRepository.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

export async function favoriteRoutes(fastify: FastifyInstance) {

    // GET /api/favorites - Get all favorites for the user
    fastify.get('/', { preHandler: requireAuth }, async (request, reply) => {
        const userId = (request as any).user?.sub;
        if (!userId) {
            throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
        }

        const favorites = await getUserFavorites(userId);
        return { success: true, data: favorites };
    });

    // POST /api/favorites - Add a favorite
    fastify.post('/', { preHandler: requireAuth }, async (request, reply) => {
        const userId = (request as any).user?.sub;
        if (!userId) {
            throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
        }

        const { chain = 'eth', address } = request.body as { chain: string; address: string };

        if (!address) {
            throw new AppError(400, 'Address is required', 'VALIDATION_ERROR');
        }

        const result = await addFavorite(userId, chain, address);
        return { success: result };
    });

    // DELETE /api/favorites/:address - Remove a favorite
    fastify.delete('/:address', { preHandler: requireAuth }, async (request, reply) => {
        const userId = (request as any).user?.sub;
        if (!userId) {
            throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
        }

        const { address } = request.params as { address: string };
        const { chain = 'eth' } = request.query as { chain: string };

        const result = await removeFavorite(userId, chain, address);
        return { success: result };
    });

    // GET /api/favorites/check - Check if specific token is favorite
    fastify.get('/check', { preHandler: requireAuth }, async (request, reply) => {
        const userId = (request as any).user?.sub;
        if (!userId) {
            throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
        }

        const { chain = 'eth', address } = request.query as { chain: string; address: string };

        if (!address) {
            throw new AppError(400, 'Address is required', 'VALIDATION_ERROR');
        }

        const isFav = await isFavorite(userId, chain, address);
        // Return in consistent format that fetchApi expects: { success, data: { ... } }
        return { success: true, data: { isFavorite: isFav } };
    });

    // --- Rules ---

    // GET /api/favorites/rules - Get all rules
    fastify.get('/rules', { preHandler: requireAuth }, async (request, reply) => {
        const userId = (request as any).user?.sub;
        if (!userId) {
            throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
        }

        const rules = await getUserRules(userId);
        return { success: true, data: rules };
    });

    // POST /api/favorites/rules - Add a new rule
    fastify.post('/rules', { preHandler: requireAuth }, async (request, reply) => {
        const userId = (request as any).user?.sub;
        if (!userId) {
            throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');
        }

        const body = request.body as any;

        const rule: TokenRule = {
            userId,
            chain: body.chain || 'eth',
            address: body.address,
            ruleType: body.ruleType, // e.g. 'PRICE_DROP_PERCENT'
            conditionValue: body.conditionValue, // e.g. 30
            action: body.action || 'NOTIFY', // e.g. 'BUY'
            isActive: true
        };

        if (!rule.address || !rule.ruleType || rule.conditionValue === undefined) {
            throw new AppError(400, 'Missing required fields', 'VALIDATION_ERROR');
        }

        const newRule = await addTokenRule(rule);
        return { success: true, data: newRule };
    });
}
