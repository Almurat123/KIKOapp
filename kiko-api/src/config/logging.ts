/**
 * Centralized Logging Configuration
 * Redirects noisy API logs to files instead of console
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_DIR = path.join(__dirname, '../../../logs');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Log file paths
const API_CALLS_LOG = path.join(LOG_DIR, 'api-calls.log');
const ERRORS_LOG = path.join(LOG_DIR, 'errors.log');
const DEBUG_LOG = path.join(LOG_DIR, 'debug.log');

// File write streams (append mode)
let apiCallsStream: fs.WriteStream | null = null;
let errorsStream: fs.WriteStream | null = null;
let debugStream: fs.WriteStream | null = null;

// Initialize streams
export function initializeLogging() {
    apiCallsStream = fs.createWriteStream(API_CALLS_LOG, { flags: 'a' });
    errorsStream = fs.createWriteStream(ERRORS_LOG, { flags: 'a' });
    debugStream = fs.createWriteStream(DEBUG_LOG, { flags: 'a' });
    
    console.log(`[Logging] API calls redirected to: ${API_CALLS_LOG}`);
    console.log(`[Logging] Errors redirected to: ${ERRORS_LOG}`);
    console.log(`[Logging] Debug logs redirected to: ${DEBUG_LOG}`);
}

// Close streams on shutdown
export function closeLogging() {
    apiCallsStream?.end();
    errorsStream?.end();
    debugStream?.end();
}

/**
 * Log API calls to file instead of console
 * Use this for DexScreener, GeckoTerminal, and other noisy APIs
 */
export function logApiCall(service: string, endpoint: string, status?: number, duration?: number) {
    const timestamp = new Date().toISOString();
    const message = `[${timestamp}] ${service} | ${endpoint} | ${status || 'N/A'} | ${duration || 0}ms\n`;
    
    if (apiCallsStream) {
        apiCallsStream.write(message);
    }
    
    // Only log errors to console
    if (status && status >= 400) {
        console.warn(`[API Error] ${service}: ${endpoint} - ${status}`);
    }
}

/**
 * Log errors to file
 */
export function logError(service: string, error: Error | string, context?: any) {
    const timestamp = new Date().toISOString();
    const errorMessage = error instanceof Error ? error.message : error;
    const stack = error instanceof Error ? error.stack : '';
    const contextStr = context ? JSON.stringify(context) : '';
    
    const message = `[${timestamp}] ${service} | ${errorMessage}\n${stack}\n${contextStr}\n---\n`;
    
    if (errorsStream) {
        errorsStream.write(message);
    }
    
    // Always log errors to console
    console.error(`[${service}] ${errorMessage}`);
}

/**
 * Log debug information to file
 * Use this for "No pairs found", rate limits, etc.
 */
export function logDebug(service: string, message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const dataStr = data ? JSON.stringify(data) : '';
    const logMessage = `[${timestamp}] ${service} | ${message} | ${dataStr}\n`;
    
    if (debugStream) {
        debugStream.write(logMessage);
    }
    
    // Don't log to console unless it's important
    if (process.env.NODE_ENV === 'development' && process.env.DEBUG === 'true') {
        console.log(`[DEBUG] ${service}: ${message}`);
    }
}

/**
 * Rotate log files daily
 */
export function rotateLogs() {
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    const rotateFile = (logPath: string) => {
        if (fs.existsSync(logPath)) {
            const stats = fs.statSync(logPath);
            const fileSizeMB = stats.size / (1024 * 1024);
            
            // Rotate if file > 10MB
            if (fileSizeMB > 10) {
                const rotatedPath = logPath.replace('.log', `-${timestamp}.log`);
                fs.renameSync(logPath, rotatedPath);
                console.log(`[Logging] Rotated ${logPath} to ${rotatedPath}`);
            }
        }
    };
    
    rotateFile(API_CALLS_LOG);
    rotateFile(ERRORS_LOG);
    rotateFile(DEBUG_LOG);
}

// Auto-rotate logs daily
setInterval(rotateLogs, 24 * 60 * 60 * 1000);

export default {
    initializeLogging,
    closeLogging,
    logApiCall,
    logError,
    logDebug,
    rotateLogs
};
