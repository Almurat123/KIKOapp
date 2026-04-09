import '../config/env.js';
import { PrismaClient } from '@prisma/client';

// Prevent multiple instances of Prisma Client in development
declare global {
    // eslint-disable-next-line no-var
    var prisma: PrismaClient | undefined;
}

const originalDbUrl = process.env.DATABASE_URL;
// Tuned connection settings: 20 connections is safer for shared RDS/Cloud DBs
const connectionLimit = 20;
const poolTimeout = 45; // Slightly lower timeout to catch issues faster
const connectionTimeout = 20;

const urlWithParams = originalDbUrl && !originalDbUrl.includes('connection_limit')
    ? `${originalDbUrl}${originalDbUrl.includes('?') ? '&' : '?'}connection_limit=${connectionLimit}&pool_timeout=${poolTimeout}&connect_timeout=${connectionTimeout}`
    : originalDbUrl;

// Force override environment variable
if (urlWithParams) {
    process.env.DATABASE_URL = urlWithParams;
}

console.log(`[Prisma] Initializing client (Pool: ${connectionLimit}, Timeout: ${poolTimeout}s, Connect: ${connectionTimeout}s)`);

export const prisma = global.prisma || new PrismaClient({
    log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
    ],
    datasources: {
        db: {
            url: urlWithParams
        }
    }
});

// Setup event-based logging for better production diagnostics
// @ts-ignore
prisma.$on('error', (e: any) => {
    console.error(`[Prisma-Error] ${e.message}`, { target: e.target, timestamp: new Date() });
});

// @ts-ignore
prisma.$on('warn', (e: any) => {
    console.warn(`[Prisma-Warn] ${e.message}`);
});

// Health check and auto-reconnect logic
async function checkDbConnection() {
    try {
        await prisma.$queryRaw`SELECT 1`;
        console.log('[Prisma] DB connection is healthy');
    } catch (error) {
        console.error('[Prisma] DB connection health check failed:', error);
    }
}

// Check connection on startup
checkDbConnection();

if (process.env.NODE_ENV !== 'production') {
    global.prisma = prisma;
}

/**
 * Utility to wrap Prisma calls with a retry mechanism
 * specifically for P1017 (Server has closed the connection) errors.
 */
export async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, delay = 500): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;
            // P1017: Server has closed the connection
            // We also check for generic "closed the connection" or "Closed, cause: None"
            if (
                error?.code === 'P1017' ||
                error?.message?.includes('closed the connection') ||
                error?.message?.includes('Closed, cause: None') ||
                error?.message?.includes('connection_limit')
            ) {
                console.warn(`[Prisma] Connection issue detected (${error.code || 'ECONNRESET'}), retry ${i + 1}/${maxRetries}...`);
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
                continue;
            }
            throw error; // If it's another error, don't retry
        }
    }
    throw lastError;
}

export default prisma;
