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
import { installConsoleInterception, logger } from './utils/logger.js';
import { LogCode } from './config/logRegistry.js';
import { testConnection } from './db/connection.js';
import { initRedis } from './cache/cacheClient.js';
import { startMarketDataJobs } from './jobs/marketDataJob.js';
import { startTokenDataJobs } from './jobs/tokenDataJob.js';

import { startSocialDataJobs } from './jobs/socialDataJob.js';
import { startBillingJobs } from './jobs/billingJob.js';
import { startContextLearningJob } from './jobs/contextLearningJob.js';
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
import copyTradeSimulationRoutes from './routes/copyTradeSimulation.js';
import { zoraProxyRoutes } from './routes/zora-proxy.js';
import { aiRoutes } from './routes/ai.js';
import { internalToolsRoutes } from './routes/internalTools.js';
import { imageRoutes } from './routes/images.js';
import { billingRoutes } from './routes/billing.js';
import { initAutoTradeService, stopAutoTradeService } from './services/autoTradeService.js';
import { tokenAlertService } from './services/tokenAlertService.js';
import { startPositionMonitor } from './jobs/positionMonitorJob.js';
import { startPositionExitIntentWorker, stopPositionExitIntentWorker } from './services/copytrade-v2/exit/positionExitIntentWorker.js';
import { startEvmMissedTradeRecovery } from './services/copytrade-v2/ingress/evmMissedTradeRecovery.js';
import { isPrivyConfigured } from './services/privyWallet.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import websocket from '@fastify/websocket';
import { chatRoutes } from './routes/chat.js';
import { chatWSRoutes } from './services/chatWebSocket.js';
import { chatWorker } from './jobs/chatWorker.js';
import { registerUserRoutes } from './routes/users.js';
import { initializePolicies, runCleanup, startDataRetentionScheduler, stopDataRetentionScheduler } from './services/dataRetentionService.js';
import { zoraAlertService } from './services/zoraAlertService.js';
import { startPolling as startPolymarketWatcher, stopPolling as stopPolymarketWatcher } from './services/polymarketWatcher.js';
import fastifyRawBody from 'fastify-raw-body';
import helmet from '@fastify/helmet';
import { tracingHook } from './middleware/tracing.js';
import { startRpcBenchmarkSampling } from './services/rpcManager.js';
import { startNativePriceRefresh } from './services/onChainPriceService.js';
import { requireAuth } from './middleware/auth.js';
import { markEndUserActivity } from './services/runtimeActivityService.js';

const fastify = Fastify({
    logger: {
        level: env.logLevel || 'info',
    },
    disableRequestLogging: true,
    requestTimeout: env.apiConfig.requestTimeout,
    connectionTimeout: env.apiConfig.requestTimeout,
    bodyLimit: env.apiConfig.maxRequestSize,
});

// Capture stray console logs into the structured logger in production (or when LOG_INTERCEPT_CONSOLE=true)
installConsoleInterception();

// Register CORS
const corsOrigins = env.corsOrigin
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
const corsOriginsSet = new Set(corsOrigins);

function isAllowedCorsOrigin(origin?: string): boolean {
    if (!origin) {
        return true;
    }
    const normalized = origin.replace(/\/+$/, '');
    if (corsOriginsSet.has(normalized)) {
        return true;
    }
    try {
        const parsed = new URL(normalized);
        const host = parsed.hostname.toLowerCase();
        if (host === 'kikoapp.app' || host.endsWith('.kikoapp.app')) {
            return true;
        }
        if (env.nodeEnv !== 'production' && (host === 'localhost' || host === '127.0.0.1')) {
            return true;
        }
    } catch {
        return false;
    }
    return false;
}

fastify.register(cors, {
    origin: (origin, cb) => {
        cb(null, isAllowedCorsOrigin(origin));
    },
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
                HELIUS_CONNECT_SRC
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

// Build metadata (for deployments)
const buildSha = process.env.BUILD_SHA || process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT || 'unknown';
const publicVersion = process.env.APP_VERSION || 'current';
logger.info(LogCode.SYS_STARTUP, 'Build SHA', { buildSha });

// Register tracing middleware (must be first)
fastify.addHook('onRequest', tracingHook);

// Track recent end-user traffic so non-critical background jobs can sleep while idle.
fastify.addHook('onRequest', async (request) => {
    const url = request.url || '';
    if (
        url === '/health' ||
        url.startsWith('/health?') ||
        url.startsWith('/api/webhook')
    ) {
        return;
    }
    markEndUserActivity();
});

// Add unified response metadata for API-style envelopes.
fastify.addHook('preSerialization', async (request, _reply, payload) => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return payload;
    }
    if (Buffer.isBuffer(payload)) {
        return payload;
    }

    const data = payload as Record<string, unknown>;
    const looksLikeApiEnvelope =
        Object.prototype.hasOwnProperty.call(data, 'success') ||
        Object.prototype.hasOwnProperty.call(data, 'error') ||
        Object.prototype.hasOwnProperty.call(data, 'message');

    // Do not alter protocol payloads such as JSON-RPC.
    if (!looksLikeApiEnvelope || Object.prototype.hasOwnProperty.call(data, 'jsonrpc')) {
        return payload;
    }

    if (!Object.prototype.hasOwnProperty.call(data, 'meta')) {
        const traceId = ((request as any).traceId as string | undefined) || request.id;
        data.meta = {
            requestId: traceId,
            timestamp: new Date().toISOString(),
            version: publicVersion,
        };
    }

    return data;
});

// Register rate limiter for all routes
fastify.addHook('onRequest', rateLimiter);

// Register App Key validation for all API routes
import { requireAppKey } from './middleware/apiKey.js';
import { requireAllowedOrigin } from './middleware/originRestriction.js';
import { verifyRequestSignature } from './middleware/requestSigning.js';
fastify.addHook('preHandler', async (request, reply) => {
    // Always allow browser CORS preflight to reach @fastify/cors handler.
    // Preflight does not carry app credentials like X-App-Key.
    if (request.method === 'OPTIONS') {
        return;
    }

    // Skip security checks for these paths:
    // - /health: health check
    // - /api/chat/ws: WebSocket (uses JWT token in URL)
    // - /api/webhook/: server-to-server webhooks (have HMAC verification)
    const skipPaths = ['/health', '/api/chat/ws', '/v2/chat/ws', '/api/webhook/', '/webhook/', '/api/images', '/internal/tools/'];
    if (skipPaths.some(p => request.url === p || request.url.startsWith(p))) {
        return;
    }
    const sensitiveEndpoints = ['/api/swap/', '/api/trade/', '/api/wallet/', '/api/copy-trade/config'];
    const isSensitive = sensitiveEndpoints.some(p => request.url.startsWith(p));
    const hasSignature = !!(request.headers['x-signature'] && request.headers['x-timestamp']);

    // If signed internal request, verify signature first and bypass origin/app key
    if (isSensitive && hasSignature) {
        await verifyRequestSignature(request, reply);
        return;
    }

    // Validate origin/referer first
    await requireAllowedOrigin(request, reply);
    // Then validate app key
    await requireAppKey(request, reply);
    // Browser requests are not signed (no frontend secrets).
    // If signature headers are present, they are already verified above.
});

import fastifyStatic from '@fastify/static';
import { HELIUS_CONNECT_SRC } from './config/apiEndpoints.js';
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
fastify.get('/api/config/auth-key-id', { preHandler: requireAuth }, async (request, reply) => {
    const pickEnv = (...keys: string[]) => {
        for (const key of keys) {
            const value = (process as any).env[key];
            if (typeof value === 'string' && value.trim().length > 0) {
                return value.trim();
            }
        }
        return undefined;
    };

    const authKeyId = (process as any).env.PRIVY_AUTHORIZATION_KEY_ID;
    if (!authKeyId) {
        return reply.status(500).send({ error: 'Authorization key not configured' });
    }
    const autoTradePolicyEthereum = pickEnv(
        'PRIVY_POLICY_ID_AUTOTRADE_EVM',
        'PRIVY_POLICY_ID_EVM_AUTOTRADE',
        'PRIVY_POLICY_ID_AUTOTRADE_ETHEREUM',
        'PRIVY_POLICY_ID_ETHEREUM_AUTOTRADE',
        'PRIVY_POLICY_ID_AUTOTRADE'
    );
    const autoTradePolicySolana = pickEnv(
        'PRIVY_POLICY_ID_AUTOTRADE_SOLANA',
        'PRIVY_POLICY_ID_SOLANA_AUTOTRADE',
        'PRIVY_POLICY_ID_SOL_AUTOTRADE',
        'PRIVY_POLICY_ID_AUTOTRADE_SOL',
        'PRIVY_POLICY_ID_AUTOTRADE'
    );
    const billingPolicyEthereum = pickEnv(
        'PRIVY_POLICY_ID_BILLING_EVM',
        'PRIVY_POLICY_ID_EVM_BILLING',
        'PRIVY_POLICY_ID_BILLING_ETHEREUM',
        'PRIVY_POLICY_ID_ETHEREUM_BILLING',
        'PRIVY_POLICY_ID_BILLING'
    );
    // Return the raw cuid2 format ID (Session Signers expect this format)
    return reply.send({
        authKeyId,
        policies: {
            autoTrading: {
                ethereum: autoTradePolicyEthereum,
                solana: autoTradePolicySolana,
            },
            billing: {
                ethereum: billingPolicyEthereum,
            }
        }
    });
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
    fastify.register(copyTradeSimulationRoutes, { prefix: '/api/copy-trade' });
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
    fastify.register(billingRoutes, { prefix: '/api/billing' });
    fastify.register(aiRoutes, { prefix: '/api/ai' });
    fastify.register(internalToolsRoutes);
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
            privy: isPrivyConfigured() ? '✅ Configured' : '❌ Not Configured',
            webhookSecurity: {
                alchemySecretConfigured: Boolean(env.security.alchemyWebhookSecret),
                alchemySecretEthConfigured: Boolean(env.security.alchemyWebhookSecretEth),
                alchemySecretBaseConfigured: Boolean(env.security.alchemyWebhookSecretBase),
                alchemySecretBscConfigured: Boolean(env.security.alchemyWebhookSecretBsc),
                alchemySecretSolConfigured: Boolean(env.security.alchemyWebhookSecretSol),
                internalSecretConfigured: Boolean(env.security.internalWebhookSecret),
                allowUnsignedAlchemyWebhook: env.security.allowUnsignedAlchemyWebhook
            }
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
            startDataRetentionScheduler();
        }

        // Initialize Redis
        logger.debug(LogCode.SYS_STARTUP, 'Initializing Redis...');
        try {
            const redisConnected = await initRedis();
            if (redisConnected) {
                logger.info(LogCode.SYS_REDIS_CONNECTED, 'Redis initialized');
            } else {
                logger.warn(LogCode.SYS_ERROR, 'Redis not connected, using DB cache fallback');
            }
        } catch (redisError: any) {
            logger.error(LogCode.SYS_ERROR, 'Redis initialization failed, but continuing...', { error: redisError.message });
        }

        // Start native token USD price refresh loop (Coinbase/CoinGecko/CMC + cache)
        try {
            startNativePriceRefresh();
            logger.info(LogCode.SYS_STARTUP, 'Native price refresh started');
        } catch (nativePriceError: any) {
            logger.error(LogCode.SYS_ERROR, 'Native price refresh failed to start', { error: nativePriceError.message });
        }

        // START SERVER FIRST
        logger.info(LogCode.SYS_STARTUP, `Starting server on port ${env.port}...`);
        await fastify.listen({ port: env.port, host: '0.0.0.0' });
        logger.info(LogCode.SYS_STARTUP, 'Server listening', {
            url: `http://localhost:${env.port}`,
            health: `http://localhost:${env.port}/health`
        });

        // Start RPC benchmark sampling (Base) to update health stats
        try {
            startRpcBenchmarkSampling();
            logger.info(LogCode.SYS_STARTUP, 'RPC benchmark sampling started');
        } catch (rpcBenchError: any) {
            logger.error(LogCode.SYS_ERROR, 'RPC benchmark sampling failed to start', { error: rpcBenchError.message });
        }

        // Now start background services
        logger.debug(LogCode.SYS_STARTUP, 'Starting background jobs...');
        try {
            startMarketDataJobs();
            startTokenDataJobs();
            startSocialDataJobs();
            startBillingJobs();
            startContextLearningJob();
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

        try {
            startEvmMissedTradeRecovery();
            logger.info(LogCode.SYS_STARTUP, 'EVM missed-trade recovery started');
        } catch (recoveryError: any) {
            logger.error(LogCode.SYS_ERROR, 'EVM missed-trade recovery failed to start', { error: recoveryError.message });
        }

        // Start position monitor (TP/SL checking)
        logger.debug(LogCode.SYS_STARTUP, 'Starting position monitor...');
        try {
            startPositionMonitor();
            logger.info(LogCode.SYS_STARTUP, 'Position monitor started');
        } catch (posMonError: any) {
            logger.error(LogCode.SYS_ERROR, 'Position monitor failed to start', { error: posMonError.message });
        }

        logger.debug(LogCode.SYS_STARTUP, 'Starting copytrade exit intent worker...');
        try {
            startPositionExitIntentWorker();
            logger.info(LogCode.SYS_STARTUP, 'Copytrade exit intent worker started');
        } catch (exitWorkerError: any) {
            logger.error(LogCode.SYS_ERROR, 'Copytrade exit intent worker failed to start', { error: exitWorkerError.message });
        }

        logger.debug(LogCode.SYS_STARTUP, 'Starting Polymarket copy watcher...');
        try {
            await startPolymarketWatcher();
            logger.info(LogCode.SYS_STARTUP, 'Polymarket copy watcher started');
        } catch (polymarketWatcherError: any) {
            logger.error(LogCode.SYS_ERROR, 'Polymarket copy watcher failed to start', { error: polymarketWatcherError.message });
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
    stopDataRetentionScheduler();
    stopPositionExitIntentWorker();
    stopPolymarketWatcher();
    await stopAutoTradeService();
    if (prisma) await (prisma as any).$disconnect();
    await fastify.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info(LogCode.SYS_SHUTDOWN, 'SIGINT received, shutting down gracefully...');
    stopDataRetentionScheduler();
    stopPositionExitIntentWorker();
    stopPolymarketWatcher();
    await stopAutoTradeService();
    if (prisma) await (prisma as any).$disconnect();
    await fastify.close();
    process.exit(0);
});

start();

// Global Error Handlers (Fix 7: Process Handlers)
// Prevent silent failures for unhandled promises or sync exceptions
process.on('unhandledRejection', (reason, promise) => {
    logger.error(LogCode.SYS_ERROR, 'Unhandled Rejection at:', {
        promise,
        reason: reason instanceof Error ? reason.message : reason
    });
    // In production, we might want to exit, but for now log and keep running
    // process.exit(1);
});

process.on('uncaughtException', (error) => {
    logger.error(LogCode.SYS_ERROR, 'Uncaught Exception:', {
        error: error.message,
        stack: error.stack
    });
    // Critical error - should restart process via PM2/Docker
    process.exit(1);
});
