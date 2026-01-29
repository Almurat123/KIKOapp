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
import { logger } from './utils/logger.js';
import { LogCode } from './config/logRegistry.js';
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
import { aiRoutes } from './routes/ai.js';
import { imageRoutes } from './routes/images.js';
import { initAutoTradeService, stopAutoTradeService } from './services/autoTradeService.js';
import { tokenAlertService } from './services/tokenAlertService.js';
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
import { zoraAlertService } from './services/zoraAlertService.js';
import fastifyRawBody from 'fastify-raw-body';
import helmet from '@fastify/helmet';
import { tracingHook } from './middleware/tracing.js';

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

// Register raw body plugin (disabled globally, enabled per route)
fastify.register(fastifyRawBody, {
    global: false,
    encoding: 'utf8',
    runFirst: true
});

// Register security headers
fastify.register(helmet, {
    // Disable default CORP header to avoid overriding per-route image proxy headers
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: [
                "'self'",
                "wss:",
                "https:",
                "https://*.privy.io",
                "https://auth.privy.io",
                "https://api.gopluslabs.io",
                "https://*.alchemy.com",
                "https://*.helius-rpc.com"
            ],
            frameAncestors: ["'none'"],
            upgradeInsecureRequests: [],
        },
    },
});

// Register error handler
fastify.setErrorHandler(errorHandler);
fastify.setNotFoundHandler(notFoundHandler);

import { redactUrl } from './utils/sanitizer.js';

// Debug logging hook - only in development
if (env.nodeEnv === 'development') {
    fastify.addHook('onRequest', async (request) => {
        logger.debug(LogCode.SYS_INFO, `onRequest: ${request.method} ${redactUrl(request.url)}`);
    });

    fastify.addHook('onResponse', async (request, reply) => {
        logger.debug(LogCode.SYS_INFO, `onResponse: ${request.method} ${redactUrl(request.url)} -> ${reply.statusCode}`);
    });
}

// Register tracing middleware (must be first)
fastify.addHook('onRequest', tracingHook);

// Register rate limiter for all routes
fastify.addHook('onRequest', rateLimiter);

// Register App Key validation for all API routes
import { requireAppKey } from './middleware/apiKey.js';
import { requireAllowedOrigin } from './middleware/originRestriction.js';
import { verifyRequestSignature } from './middleware/requestSigning.js';
fastify.addHook('preHandler', async (request, reply) => {
    // Skip security checks for these paths:
    // - /health: health check
    // - /api/chat/ws: WebSocket (uses JWT token in URL)
    // - /api/webhook/: server-to-server webhooks (have HMAC verification)
    const skipPaths = ['/health', '/api/chat/ws', '/api/webhook/', '/webhook/', '/api/images'];
    if (skipPaths.some(p => request.url === p || request.url.startsWith(p))) {
        return;
    }
    // Validate origin/referer first
    await requireAllowedOrigin(request, reply);
    // Then validate app key
    await requireAppKey(request, reply);
    // Optional: Verify request signature (if configured)
    // Only for sensitive endpoints like swap/trade operations
    const sensitiveEndpoints = ['/api/swap/', '/api/trade/', '/api/wallet/'];
    if (sensitiveEndpoints.some(p => request.url.startsWith(p))) {
        await verifyRequestSignature(request, reply);
    }
});

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
    logger.info(LogCode.SYS_STARTUP, 'Serving static files from:', { path: publicPath });
} else {
    logger.warn(LogCode.SYS_STARTUP, 'Public folder not found - skipping static file serving', { path: publicPath });
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
    fastify.register(webhookRoutes, {
        prefix: '/api/webhook',
        config: { rawBody: true } // Enable raw body for webhook routes
    });
    fastify.register(newsRoutes, { prefix: '/api/news' });
    fastify.register(polymarketRoutes, { prefix: '/api/polymarket' });
    fastify.register(zoraRoutes, { prefix: '/api/zora' });
    fastify.register(rpcRoutes, { prefix: '/api/rpc' });
    fastify.register(zoraProxyRoutes, { prefix: '/api/zora-proxy' });
    fastify.register(imageRoutes, { prefix: '/api/images' });
    fastify.register(aiRoutes, { prefix: '/api/ai' });
    registerUserRoutes(fastify); // User settings routes
});

// Start server
async function start() {
    try {
        // Initialize services
        logger.info(LogCode.SYS_STARTUP, 'Initializing services...', {
            env: env.nodeEnv,
            port: env.port,
            database: env.databaseUrl ? 'configured' : 'missing',
            privy: isPrivyConfigured() ? '✅ Configured' : '❌ Not Configured'
        });

        // Test database connection
        logger.debug(LogCode.SYS_STARTUP, 'Testing database connection...');
        const dbConnected = await testConnection();
        if (!dbConnected) {
            logger.error(LogCode.SYS_ERROR, 'Database connection failed, but continuing...');
        } else {
            logger.info(LogCode.SYS_DB_CONNECTED, 'Database connection successful');

            // Initialize Data Retention
            await initializePolicies();
            // Run cleanup asynchronously
            runCleanup().catch(err => logger.error(LogCode.SYS_ERROR, 'Initial cleanup failed', { error: err.message }));
        }

        // Initialize Redis
        logger.debug(LogCode.SYS_STARTUP, 'Initializing Redis...');
        try {
            await initRedis();
            logger.info(LogCode.SYS_REDIS_CONNECTED, 'Redis initialized');
        } catch (redisError: any) {
            logger.error(LogCode.SYS_ERROR, 'Redis initialization failed, but continuing...', { error: redisError.message });
        }

        // START SERVER FIRST
        logger.info(LogCode.SYS_STARTUP, `Starting server on port ${env.port}...`);
        await fastify.listen({ port: env.port, host: '0.0.0.0' });
        logger.info(LogCode.SYS_STARTUP, 'Server listening', {
            url: `http://localhost:${env.port}`,
            health: `http://localhost:${env.port}/health`
        });

        // Now start background services
        logger.debug(LogCode.SYS_STARTUP, 'Starting background jobs...');
        try {
            startMarketDataJobs();
            startTokenDataJobs();
            startSocialDataJobs();
            logger.info(LogCode.SYS_STARTUP, 'Background jobs started');
        } catch (jobError: any) {
            logger.error(LogCode.SYS_ERROR, 'Some background jobs failed to start', { error: jobError.message });
        }

        // Start auto trade service
        logger.debug(LogCode.SYS_STARTUP, 'Starting auto trade service...');
        try {
            initAutoTradeService();
            logger.info(LogCode.SYS_STARTUP, 'Auto trade service started');
        } catch (autoTradeError: any) {
            logger.error(LogCode.SYS_ERROR, 'Auto trade service failed to start', { error: autoTradeError.message });
        }

        // Start position monitor (TP/SL checking)
        logger.debug(LogCode.SYS_STARTUP, 'Starting position monitor...');
        try {
            startPositionMonitor();
            logger.info(LogCode.SYS_STARTUP, 'Position monitor started');
        } catch (posMonError: any) {
            logger.error(LogCode.SYS_ERROR, 'Position monitor failed to start', { error: posMonError.message });
        }

        // Start token alert service
        logger.debug(LogCode.SYS_STARTUP, 'Starting token alert service...');
        try {
            tokenAlertService.start();
            logger.info(LogCode.SYS_STARTUP, 'Token alert service started');
        } catch (alertError: any) {
            logger.error(LogCode.SYS_ERROR, 'Token alert service failed to start', { error: alertError.message });
        }


        // Start Chat Worker
        logger.debug(LogCode.SYS_STARTUP, 'Starting chat worker...');
        try {
            chatWorker.start();
            logger.info(LogCode.SYS_STARTUP, 'Chat worker started');
        } catch (chatWorkerError: any) {
            logger.error(LogCode.SYS_ERROR, 'Chat worker failed to start', { error: chatWorkerError.message });
        }

        // Start Global Zora Alpha Detector (separate from zoraSniperService)
        try {
            zoraAlertService.start();
        } catch (zoraError: any) {
            logger.error(LogCode.SYS_ERROR, 'Global Zora Alpha Detector failed to start', { error: zoraError.message });
        }

        logger.info(LogCode.SYS_STARTUP, '🎉 All services initialized!');
    } catch (error: any) {
        logger.error(LogCode.SYS_ERROR, 'Error starting server', { error: error.message || error });
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    logger.info(LogCode.SYS_SHUTDOWN, 'SIGTERM received, shutting down gracefully...');
    await stopAutoTradeService();
    if (prisma) await (prisma as any).$disconnect();
    await fastify.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info(LogCode.SYS_SHUTDOWN, 'SIGINT received, shutting down gracefully...');
    await stopAutoTradeService();
    if (prisma) await (prisma as any).$disconnect();
    await fastify.close();
    process.exit(0);
});

start();
