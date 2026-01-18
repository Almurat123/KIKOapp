import { FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { logStorage } from '../utils/logger.js';

/**
 * Tracing Middleware (Fastify Hook)
 * 
 * Generates a unique Trace ID (correlation ID) for every request.
 * Propagates the ID via response headers and wraps the request in AsyncLocalStorage.
 */
export async function tracingHook(request: FastifyRequest, reply: FastifyReply) {
    // 1. Get existing Trace ID from header or generate a new one
    const traceId = (request.headers['x-trace-id'] as string) || uuidv4();

    // 2. Attach to request object for easy access
    (request as any).traceId = traceId;

    // 3. Set on response header for client-side tracking
    reply.header('x-trace-id', traceId);

    // 4. Wrap request processing in logStorage for automatic tracking in logger.ts
    // Note: Fastify hooks are tricky with SyncLocalStorage.run()
    // We use a trick by running the store and letting it persist for the remainder of the request
    logStorage.enterWith({ traceId });
}
