/**
 * KIKO Backend API Server
 * Main entry point
 */

import 'dotenv/config';
import process from 'node:process';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { prisma } from './db/prisma.js';
import { env } from './config/env.js';
import { testConnection } from './db/connection.js';
import { initRedis } from './cache/redis.js';
import { startMarketDataJobs } from './jobs/marketDataJob.js';
import { startTokenDataJobs } from './jobs/tokenDataJob.js';

import { startSocialDataJobs } from './jobs/socialDataJob.js';
import { marketRoutes } from './routes/market.js';
import { tokenRoutes } from './routes/tokens.js';

import { socialRoutes } from './routes/social.js';
import { securityRoutes } from './routes/security.js';
import walletRoutes from './routes/wallets.js';
import { swapRoutes } from './routes/swap.js';
import { favoriteRoutes } from './routes/favorites.js';
import copyTradeRoutes from './routes/copyTrade.js';
import webhookRoutes from './routes/webhook.js';
import { newsRoutes } from './routes/news.js';
import { polymarketRoutes } from './routes/polymarket.js';
import { zoraRoutes } from './routes/zora.js';
import { rpcRoutes } from './routes/rpc.js';
import { zoraProxyRoutes } from './routes/zora-proxy.js';
import { initAutoTradeService } from './services/autoTradeService.js';
import { startPositionMonitor } from './jobs/positionMonitorJob.js';
import { isPrivyConfigured } from './services/privyWallet.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import websocket from '@fastify/websocket';
import { chatRoutes } from './routes/chat.js';
import { chatWSRoutes } from './services/chatWebSocket.js';
import { chatWorker } from './jobs/chatWorker.js';
import { registerUserRoutes } from './routes/users.js';
import { initializePolicies, runCleanup } from './services/dataRetentionService.js';

const fastify = Fastify({
    logger: true,
    requestTimeout: env.apiConfig.requestTimeout,
    connectionTimeout: env.apiConfig.requestTimeout,
    bodyLimit: env.apiConfig.maxRequestSize,
});

// Register CORS
const corsOrigins = env.corsOrigin.split(',').map(o => o.trim());
fastify.register(cors, {
    origin: corsOrigins,
    credentials: true,
});

// Register error handler
fastify.setErrorHandler(errorHandler);
fastify.setNotFoundHandler(notFoundHandler);

// Debug logging hook
fastify.addHook('onRequest', async (request, reply) => {
    console.log(`[DEBUG] onRequest: ${request.method} ${request.url}`);
});

fastify.addHook('onResponse', async (request, reply) => {
    console.log(`[DEBUG] onResponse: ${request.method} ${request.url} -> ${reply.statusCode}`);
});

// Register rate limiter for all routes
fastify.addHook('onRequest', rateLimiter);

import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';

// Register static file serving for public folder (news covers) - only if it exists
const publicPath = path.join(process.cwd(), 'public');
if (fs.existsSync(publicPath)) {
    fastify.register(fastifyStatic, {
        root: publicPath,
        prefix: '/', // effectively serves /public/news-covers as /news-covers
    });
    console.log('[Static] Serving static files from:', publicPath);
} else {
    console.log('[Static] Public folder not found at:', publicPath, '- skipping static file serving');
}

// Register WebSocket plugin
fastify.register(websocket);

// Health check endpoint
fastify.get('/health', async (request, reply) => {
    return reply.send({
        status: 'ok',
        timestamp: new Date().toISOString(),
    });
});

// Config endpoint for frontend Session Signers
fastify.get('/api/config/auth-key-id', async (request, reply) => {
    const PORT = (process as any).env.PORT || 3001;
    const authKeyId = (process as any).env.PRIVY_AUTHORIZATION_KEY_ID;
    if (!authKeyId) {
        return reply.status(500).send({ error: 'Authorization key not configured' });
    }
    // Return the raw cuid2 format ID (Session Signers expect this format)
    return reply.send({ authKeyId });
});

// Register routes
fastify.register(async (fastify) => {
    fastify.register(marketRoutes, { prefix: '/api/market' });
    fastify.register(tokenRoutes, { prefix: '/api/tokens' });

    fastify.register(socialRoutes, { prefix: '/api/social' });
    fastify.register(securityRoutes, { prefix: '/api/security' });
    fastify.register(walletRoutes, { prefix: '/api/wallets' });
    fastify.register(swapRoutes, { prefix: '/api/swap' });
    fastify.register(chatRoutes, { prefix: '/api/chat' });
    fastify.register(chatWSRoutes); // Handled as /api/chat/ws/:sessionId inside
    fastify.register(favoriteRoutes, { prefix: '/api/favorites' });
    fastify.register(copyTradeRoutes, { prefix: '/api/copy-trade' });
    fastify.register(webhookRoutes, { prefix: '/api/webhook' });
    fastify.register(newsRoutes, { prefix: '/api/news' });
    fastify.register(polymarketRoutes, { prefix: '/api/polymarket' });
    fastify.register(zoraRoutes, { prefix: '/api/zora' });
    fastify.register(rpcRoutes, { prefix: '/api/rpc' });
    fastify.register(zoraProxyRoutes, { prefix: '/api/zora-proxy' });
    registerUserRoutes(fastify); // User settings routes
});

// Start server
async function start() {
    try {
        // Initialize services
        console.log('Initializing services...');
        console.log(`Environment: ${env.nodeEnv}`);
        console.log(`Port: ${env.port}`);
        console.log(`Database URL: ${env.databaseUrl ? 'configured' : 'missing'}`);
        console.log(`Privy Server Auth: ${isPrivyConfigured() ? '✅ Configured' : '❌ Not Configured'}`);

        // Test database connection
        console.log('Testing database connection...');
        const dbConnected = await testConnection();
        if (!dbConnected) {
            console.warn('⚠️  Database connection failed, but continuing...');
            console.warn('⚠️  API will still start but database queries may fail');
        } else {
            console.log('✅ Database connection successful');

            // Initialize Data Retention
            await initializePolicies();
            // Run cleanup asynchronously
            runCleanup().catch(err => console.error('Initial cleanup failed:', err));
        }

        // Initialize Redis
        console.log('Initializing Redis...');
        try {
            await initRedis();
            console.log('✅ Redis initialized');
        } catch (redisError) {
            console.warn('⚠️  Redis initialization failed, but continuing...');
            console.warn('⚠️  Caching will be disabled');
        }

        // START SERVER FIRST - so health checks pass while background services init
        console.log(`Starting server on port ${env.port}...`);
        await fastify.listen({ port: env.port, host: '0.0.0.0' });
        console.log(`🚀 Server listening on http://localhost:${env.port}`);
        console.log(`📊 API endpoints available at http://localhost:${env.port}/api`);
        console.log(`🏥 Health check: http://localhost:${env.port}/health`);

        // Now start background services (after server is listening)
        console.log('Starting background jobs...');
        try {
            startMarketDataJobs();
            startTokenDataJobs();
            startSocialDataJobs();
            console.log('✅ Background jobs started');
        } catch (jobError) {
            console.warn('⚠️  Some background jobs failed to start:', jobError);
        }

        // Start auto trade service (copy trading)
        console.log('Starting auto trade service...');
        try {
            initAutoTradeService();
            console.log('✅ Auto trade service started');
        } catch (autoTradeError) {
            console.warn('⚠️  Auto trade service failed to start:', autoTradeError);
        }

        // Start position monitor (TP/SL checking)
        console.log('Starting position monitor...');
        try {
            startPositionMonitor();
            console.log('✅ Position monitor started');
        } catch (posMonError) {
            console.warn('⚠️  Position monitor failed to start:', posMonError);
        }

        // Start Chat Worker
        console.log('Starting chat worker...');
        try {
            chatWorker.start();
            console.log('✅ Chat worker started');
        } catch (chatWorkerError) {
            console.warn('⚠️  Chat worker failed to start:', chatWorkerError);
        }

        console.log('🎉 All services initialized!');
    } catch (error: any) {
        console.error('❌ Error starting server:', error);
        if (error.code === 'EADDRINUSE') {
            console.error(`❌ Port ${env.port} is already in use. Please stop the existing process or use a different port.`);
            console.error('   You can use: npm run kill-port');
        } else if (error.message?.includes('DATABASE_URL')) {
            console.error('❌ Database configuration error. Please check your DATABASE_URL environment variable.');
        } else {
            console.error('❌ Unknown error:', error.message || error);
        }
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    if (prisma) await (prisma as any).$disconnect();
    await fastify.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully...');
    if (prisma) await (prisma as any).$disconnect();
    await fastify.close();
    process.exit(0);
});

start();

