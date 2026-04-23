/**
 * Unified Error Handling Middleware for Fastify
 * Provides consistent error responses and logging
 */

import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { applyCorsResponseHeaders } from './corsPolicy.js';

/**
 * Custom error class for API errors
 */
export class AppError extends Error {
    public statusCode: number;
    public code: string;
    public logCode: LogCode;
    public isOperational: boolean;

    constructor(statusCode: number, message: string, code = 'APP_ERROR', logCode = LogCode.SYS_STARTUP, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.logCode = logCode;
        this.isOperational = isOperational;
        Object.setPrototypeOf(this, AppError.prototype);
    }
}

/**
 * Get request ID from request (if available)
 */
function getRequestId(request: any) {
    return request.id || undefined;
}

import { redact, redactUrl } from '../utils/sanitizer.js';
import { scrubObject } from '../utils/scrubber.js';

/**
 * Log error with context
 */
function logError(error: any, request: any) {
    const requestId = getRequestId(request);
    const method = request.method;
    const url = redactUrl(request.url); // Sanitize request URL
    const ip = request.ip;

    const errorInfo = scrubObject({
        requestId,
        method,
        url,
        ip,
        error: {
            message: error.message,
            name: error.name,
            code: error.code,
            statusCode: error.statusCode || 500,
            stack: env.nodeEnv === 'development' ? error.stack : undefined,
        },
    });

    if (error.isOperational === false || error.statusCode === 500) {
        logger.error(LogCode.SYS_ERROR, 'Unhandled API error', errorInfo);
    } else {
        logger.warn(LogCode.SYS_ERROR, 'Operational API error', errorInfo);
    }
}

/**
 * Format error response
 */
function formatErrorResponse(error: any, request: any, isDevelopment = false) {
    const requestId = getRequestId(request);
    const apiError = error as AppError;
    const fastifyError = error as any;

    const statusCode = fastifyError.statusCode || apiError.statusCode || 500;
    const code = apiError.code || fastifyError.code || 'INTERNAL_ERROR';

    // Don't expose internal errors in production
    let message = error.message;
    if (!isDevelopment && statusCode === 500 && !apiError.isOperational) {
        message = 'Internal server error';
    }

    const response: any = {
        success: false,
        error: message,
        code,
        requestId,
        timestamp: new Date().toISOString(),
    };

    // Only include stack trace in development
    if (isDevelopment && error.stack) {
        response.stack = error.stack;
    }

    return response;
}

/**
 * Error handler middleware
 */
export async function errorHandler(error: any, request: any, reply: any) {
    // Log the error
    logError(error, request);

    // Format error response
    const isDevelopment = env.nodeEnv === 'development';
    const response = formatErrorResponse(error, request, isDevelopment);

    // Determine status code
    const statusCode = error.statusCode || 500;

    // Send error response
    applyCorsResponseHeaders(request, reply);
    reply.status(statusCode).send(response);
}

/**
 * Not found handler
 */
export async function notFoundHandler(request: any, reply: any) {
    const requestId = getRequestId(request);
    applyCorsResponseHeaders(request, reply);
    reply.status(404).send({
        success: false,
        error: 'Route not found',
        code: 'NOT_FOUND',
        requestId,
        timestamp: new Date().toISOString(),
        path: request.url,
    });
}

/**
 * Validation error handler
 */
export function handleValidationError(error: any) {
    const validationErrors = error.validation || [];
    const messages = validationErrors.map((err: any) => `${err.instancePath || ''} ${err.message || ''}`.trim()).join(', ');

    return new AppError(400, messages || 'Validation error', 'VALIDATION_ERROR', LogCode.SYS_STARTUP, true);
}

/**
 * Database error handler
 */
export function handleDatabaseError(error: any) {
    // Don't expose database errors in production
    const isDevelopment = env.nodeEnv === 'development';

    // Check for common database errors
    if (error.message.includes('timeout')) {
        return new AppError(504, 'Database request timeout', 'DB_TIMEOUT', LogCode.SYS_STARTUP, true);
    }
    if (error.message.includes('connection')) {
        return new AppError(503, 'Database connection error', 'DB_CONNECTION_ERROR', LogCode.SYS_STARTUP, true);
    }
    if (error.message.includes('duplicate key')) {
        return new AppError(409, 'Resource already exists', 'DUPLICATE_KEY', LogCode.SYS_STARTUP, true);
    }

    return new AppError(500, isDevelopment ? error.message : 'Database error', 'DB_ERROR', LogCode.SYS_STARTUP, false);
}

/**
 * External API error handler
 */
export function handleExternalApiError(error: any, serviceName: string) {
    const isDevelopment = env.nodeEnv === 'development';

    if (error.message.includes('timeout')) {
        return new AppError(504, `${serviceName} service timeout`, 'EXTERNAL_API_TIMEOUT', LogCode.SYS_STARTUP, true);
    }
    if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
        return new AppError(503, `${serviceName} service unavailable`, 'EXTERNAL_API_UNAVAILABLE', LogCode.SYS_STARTUP, true);
    }

    return new AppError(
        502,
        isDevelopment
            ? `${serviceName} error: ${error.message}`
            : `${serviceName} service error`,
        'EXTERNAL_API_ERROR',
        LogCode.SYS_STARTUP,
        true
    );
}
