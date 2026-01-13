/**
 * Security Utilities
 * Provides safe error handling and response sanitization
 * to prevent information leakage to clients
 */

import { scrubObject } from './scrubber.js';

/**
 * Known safe error messages that can be shown to clients
 * Maps internal error patterns to user-friendly messages
 */
const SAFE_ERROR_MESSAGES: Record<string, string> = {
    // Network errors
    'ECONNREFUSED': 'Service temporarily unavailable',
    'ETIMEDOUT': 'Request timed out',
    'ENOTFOUND': 'External service unreachable',
    'ECONNRESET': 'Connection interrupted',
    'EPIPE': 'Connection lost',

    // Database errors
    'P2002': 'Resource already exists',
    'P2025': 'Resource not found',
    'P2003': 'Invalid reference',

    // Auth errors (can be more specific)
    'Unauthorized': 'Authentication required',
    'Access denied': 'Access denied',
    'Invalid token': 'Session expired',

    // Rate limiting
    '429': 'Too many requests, please try again later',
    'rate limit': 'Too many requests, please try again later',

    // Common validation (can be more specific)
    'required': 'Missing required field',
    'invalid': 'Invalid input',
};

/**
 * Error categories for logging purposes
 */
type ErrorCategory = 'auth' | 'validation' | 'network' | 'database' | 'external' | 'internal';

/**
 * Categorize an error for logging and metrics
 */
function categorizeError(error: any): ErrorCategory {
    const message = error?.message?.toLowerCase() || '';
    const code = error?.code?.toLowerCase() || '';

    if (message.includes('auth') || message.includes('token') || code === 'unauthorized') {
        return 'auth';
    }
    if (message.includes('required') || message.includes('invalid') || message.includes('validation')) {
        return 'validation';
    }
    if (code.startsWith('econn') || code === 'etimedout' || code === 'enotfound') {
        return 'network';
    }
    if (code.startsWith('p2') || message.includes('prisma') || message.includes('database')) {
        return 'database';
    }
    if (message.includes('api') || message.includes('service')) {
        return 'external';
    }
    return 'internal';
}

/**
 * Create a sanitized error response safe for client consumption
 * 
 * @param error - The original error object
 * @param context - Optional context for logging (not sent to client)
 * @returns Safe error response object
 */
export function sanitizedErrorResponse(
    error: any,
    context?: string
): { error: string; code?: string } {
    const errorMessage = error?.message || '';
    const errorCode = error?.code || '';

    // Log the full error internally (scrubbed)
    if (process.env.NODE_ENV !== 'test') {
        const category = categorizeError(error);
        console.error(`[Security] ${category.toUpperCase()} error${context ? ` in ${context}` : ''}:`,
            scrubObject({ message: errorMessage, code: errorCode, stack: error?.stack }));
    }

    // Check for known safe error patterns
    for (const [pattern, safeMessage] of Object.entries(SAFE_ERROR_MESSAGES)) {
        if (
            errorMessage.toLowerCase().includes(pattern.toLowerCase()) ||
            errorCode.toLowerCase().includes(pattern.toLowerCase())
        ) {
            return { error: safeMessage };
        }
    }

    // For unknown errors, return generic message
    // NEVER expose internal error details to client
    return { error: 'An unexpected error occurred' };
}

/**
 * Create a sanitized error response with optional error code
 * Useful for structured error handling in APIs
 */
export function sanitizedErrorWithCode(
    error: any,
    fallbackCode: string = 'INTERNAL_ERROR',
    context?: string
): { error: string; code: string } {
    const response = sanitizedErrorResponse(error, context);

    // Map error type to code
    let code = fallbackCode;
    const errorMessage = error?.message?.toLowerCase() || '';

    if (errorMessage.includes('not found') || error?.code === 'P2025') {
        code = 'NOT_FOUND';
    } else if (errorMessage.includes('auth') || errorMessage.includes('token')) {
        code = 'AUTH_ERROR';
    } else if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
        code = 'VALIDATION_ERROR';
    } else if (error?.code?.startsWith?.('ECONN') || error?.code === 'ETIMEDOUT') {
        code = 'NETWORK_ERROR';
    }

    return { ...response, code };
}

/**
 * Safely extract an error message for logging
 * Useful when you need to log errors but want to prevent leakage
 */
export function safeErrorMessage(error: any): string {
    if (!error) return 'Unknown error';

    const message = error?.message || String(error);

    // Scrub sensitive data from the message
    return scrubObject(message) as string;
}

/**
 * Check if an error should be retried
 * Useful for implementing retry logic
 */
export function isRetryableError(error: any): boolean {
    const code = error?.code || '';
    const message = error?.message?.toLowerCase() || '';

    const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE'];
    const retryablePatterns = ['timeout', 'temporarily unavailable', 'rate limit', '429', '503'];

    return (
        retryableCodes.includes(code) ||
        retryablePatterns.some(pattern => message.includes(pattern))
    );
}
