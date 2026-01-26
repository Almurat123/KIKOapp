/**
 * Exponential Backoff + Retry Utility
 * Implements Alchemy's recommended retry strategy for 429 errors
 * 
 * Reference: https://alchemy.com/docs/reference/throughput.mdx
 * - 429 errors = rate limited
 * - Use exponential backoff: 2^n * 100ms
 * - Max retries: 5 (total wait: ~3 seconds)
 */

import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

export interface RetryConfig {
  maxRetries?: number;
  initialDelayMs?: number;
  backoffMultiplier?: number;
  maxDelayMs?: number;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 5,
  initialDelayMs: 100,
  backoffMultiplier: 2,
  maxDelayMs: 30000, // 30 seconds max
};

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute function with exponential backoff retry
 * 
 * @param fn Function to retry
 * @param config Retry configuration
 * @param context Additional context for logging
 * @returns Result of function call
 */
export async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {},
  context: Record<string, any> = {}
): Promise<T> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  for (let attempt = 0; attempt <= cfg.maxRetries!; attempt++) {
    try {
      const result = await fn();
      
      // Log retry success if we had to retry
      if (attempt > 0) {
        logger.info(LogCode.API_FETCH_SUCCESS, 'Retry successful', {
          ...context,
          attempt: attempt + 1,
          totalAttempts: cfg.maxRetries! + 1,
        });
      }
      
      return result;
    } catch (error: any) {
      const isLastAttempt = attempt === cfg.maxRetries;
      const statusCode = error?.status || error?.statusCode;
      const is429 = statusCode === 429; // Rate limited
      const is5xx = statusCode >= 500; // Server error
      const isRetryable = is429 || is5xx;

      if (!isRetryable || isLastAttempt) {
        // Not retryable or max retries exceeded
        logger.error(LogCode.API_FETCH_FAILED, `Request failed after ${attempt + 1} attempts`, {
          ...context,
          statusCode,
          isRetryable,
          error: error.message,
        });
        throw error;
      }

      // Calculate exponential backoff
      const delayMs = Math.min(
        cfg.initialDelayMs! * Math.pow(cfg.backoffMultiplier!, attempt),
        cfg.maxDelayMs!
      );

      // Add jitter (±10%) to prevent thundering herd
      const jitter = delayMs * 0.1 * (Math.random() * 2 - 1);
      const actualDelayMs = Math.max(0, delayMs + jitter);

      logger.warn(LogCode.API_FETCH_FAILED, `Rate limited (429), retrying with backoff`, {
        ...context,
        attempt: attempt + 1,
        delayMs: Math.round(actualDelayMs),
        totalRetries: cfg.maxRetries,
      });

      await sleep(actualDelayMs);
    }
  }

  throw new Error('Should not reach here');
}

/**
 * Wrap fetch call with automatic retry
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryConfig?: RetryConfig
): Promise<Response> {
  return withExponentialBackoff(
    () => fetch(url, options),
    retryConfig,
    { url: url.split('/').slice(0, 3).join('/') } // Log only domain
  );
}
