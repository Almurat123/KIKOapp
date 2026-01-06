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

export async function favoriteRoutes(fastify: FastifyInstance) {

    // GET /api/favorites - Get all favorites for the user
    fastify.get('/', async (request, reply) => {
        // In a real implementation with auth middleware, we'd get user from request.user
        // For now, we'll accept a userId query param or header for testing
        const userId = (request.query as any).userId || request.headers['x-user-id'] || 'demo-user';

        const favorites = await getUserFavorites(userId);
        return { success: true, data: favorites };
    });

    // POST /api/favorites - Add a favorite
    fastify.post('/', async (request, reply) => {
        const { chain = 'eth', address } = request.body as { chain: string; address: string };
        const userId = (request.query as any).userId || request.headers['x-user-id'] || 'demo-user';

        if (!address) {
            return reply.code(400).send({ success: false, error: 'Address is required' });
        }

        const result = await addFavorite(userId, chain, address);
        return { success: result };
    });

    // DELETE /api/favorites/:address - Remove a favorite
    fastify.delete('/:address', async (request, reply) => {
        const { address } = request.params as { address: string };
        const { chain = 'eth' } = request.query as { chain: string };
        const userId = (request.query as any).userId || request.headers['x-user-id'] || 'demo-user';

        const result = await removeFavorite(userId, chain, address);
        return { success: result };
    });

    // GET /api/favorites/check - Check if specific token is favorite
    fastify.get('/check', async (request, reply) => {
        const { chain = 'eth', address } = request.query as { chain: string; address: string };
        const userId = (request.query as any).userId || request.headers['x-user-id'] || 'demo-user';

        if (!address) {
            return reply.code(400).send({ success: false, error: 'Address is required' });
        }

        const isFav = await isFavorite(userId, chain, address);
        // Return in consistent format that fetchApi expects: { success, data: { ... } }
        return { success: true, data: { isFavorite: isFav } };
    });

    // --- Rules ---

    // GET /api/favorites/rules - Get all rules
    fastify.get('/rules', async (request, reply) => {
        const userId = (request.query as any).userId || request.headers['x-user-id'] || 'demo-user';
        const rules = await getUserRules(userId);
        return { success: true, data: rules };
    });

    // POST /api/favorites/rules - Add a new rule
    fastify.post('/rules', async (request, reply) => {
        const userId = (request.query as any).userId || request.headers['x-user-id'] || 'demo-user';
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
            return reply.code(400).send({ success: false, error: 'Missing required fields' });
        }

        const newRule = await addTokenRule(rule);
        return { success: true, data: newRule };
    });
}
