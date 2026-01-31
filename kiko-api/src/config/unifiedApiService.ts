/**
 * Unified API Service
 * Central service for all external API calls with:
 * - Automatic failover
 * - Rate limiting
 * - Circuit breaker
 * - Request caching
 * - Health monitoring
 */

import { logger } from '../utils/logger.js';
import { LogCode } from './logRegistry.js';
import {
  getRpcEndpoints,
  DEXSCREENER_CONFIG,
  GECKOTERMINAL_CONFIG,
  KYBERSWAP_CONFIG,
  ZEROX_CONFIG,
  ETHERSCAN_CONFIG,
  ROUTESCAN_CONFIG,
  BLOCKSCOUT_CONFIG,
  SOLSCAN_CONFIG,
  MORALIS_CONFIG,
  getEndpointName,
  type RpcEndpointConfig
} from './apiEndpoints.js';

// ============================================================================
// HEALTH TRACKING
// ============================================================================

interface EndpointHealth {
  url: string;
  consecutiveFailures: number;
  lastFailureTime: number;
  circuitOpen: boolean;
  avgResponseTime: number;
  successCount: number;
  totalAttempts: number;
}

const endpointHealthMap = new Map<string, EndpointHealth>();

function getOrCreateHealth(url: string): EndpointHealth {
  if (!endpointHealthMap.has(url)) {
    endpointHealthMap.set(url, {
      url,
      consecutiveFailures: 0,
      lastFailureTime: 0,
      circuitOpen: false,
      avgResponseTime: 0,
      successCount: 0,
      totalAttempts: 0,
    });
  }
  return endpointHealthMap.get(url)!;
}

function recordSuccess(url: string, responseTime: number) {
  const health = getOrCreateHealth(url);
  health.consecutiveFailures = 0;
  health.circuitOpen = false;
  health.successCount++;
  health.totalAttempts++;

  // Update rolling average
  if (health.avgResponseTime === 0) {
    health.avgResponseTime = responseTime;
  } else {
    health.avgResponseTime = (health.avgResponseTime * 0.8) + (responseTime * 0.2);
  }
}

function recordFailure(url: string) {
  const health = getOrCreateHealth(url);
  health.consecutiveFailures++;
  health.lastFailureTime = Date.now();
  health.totalAttempts++;

  // Open circuit breaker after 3 consecutive failures
  if (health.consecutiveFailures >= 3) {
    health.circuitOpen = true;
    logger.warn(LogCode.SYS_ERROR, 'Circuit breaker opened for endpoint', {
      url: url.substring(0, 50),
      failures: health.consecutiveFailures
    });
  }
}

function isCircuitOpen(url: string): boolean {
  const health = getOrCreateHealth(url);

  // Reset circuit if enough time has passed (30 seconds)
  if (health.circuitOpen && Date.now() - health.lastFailureTime > 30000) {
    health.circuitOpen = false;
    health.consecutiveFailures = 0;
    logger.info(LogCode.SYS_INFO, 'Circuit breaker reset for endpoint', {
      url: url.substring(0, 50)
    });
  }

  return health.circuitOpen;
}

// ============================================================================
// GENERIC FETCH SERVICE
// ============================================================================

export interface FetchJsonOptions extends RequestInit {
  url: string;
  endpointName?: string; // For logging/metrics
  requestTimeout?: number; // ms, default 10000
  /** @deprecated Use requestTimeout instead */
  timeout?: number;
  suppressError?: boolean; // If true, don't log errors (for expected failures)
  retry?: {
    retries: number;
    factor?: number; // default 2
    minTimeout?: number; // ms, default 1000
    maxTimeout?: number; // ms, default 5000
    randomize?: boolean;
  };
}

/**
 * Generic fetch wrapper with retries, timeout, and better error handling
 * Used by zeroEx, tokenService, etc.
 */
export async function fetchJson<T = any>(options: FetchJsonOptions): Promise<T> {
  const {
    url,
    endpointName = 'api',
    requestTimeout: configuredTimeout = 10000,
    timeout: legacyTimeout,
    suppressError = false,
    retry = { retries: 0 },
    ...fetchOptions
  } = options;

  const requestTimeout = legacyTimeout ?? configuredTimeout;

  const maxRetries = retry.retries || 0;
  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeout);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          ...fetchOptions.headers
        }
      });

      clearTimeout(timeout);

      // Handle 429 Rate Limit specifically
      if (response.status === 429) {
        throw new Error('429 Rate Limit Exceeded');
      }

      if (!response.ok) {
        // Try to get error text
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      // Check for empty body if we expect JSON
      const text = await response.text();
      if (!text) return {} as T;

      try {
        return JSON.parse(text) as T;
      } catch (parseError) {
        throw new Error(`Invalid JSON response: ${text.substring(0, 50)}...`);
      }

    } catch (error: any) {
      clearTimeout(timeout);
      lastError = error;

      // Don't retry if max retries reached or if it's a 4xx error (except 429)
      const isRateLimit = error.message.includes('429');
      const isClientError = error.message.match(/HTTP 4\d\d/) && !isRateLimit;

      if (attempt >= maxRetries || (isClientError && !isRateLimit)) {
        break;
      }

      // Calculate backoff
      const baseDelay = retry.minTimeout || 1000;
      const factor = retry.factor || 2;
      const delay = Math.min(
        retry.maxTimeout || 5000,
        baseDelay * Math.pow(factor, attempt)
      );

      logger.warn(LogCode.API_FETCH_FAILED, `${endpointName} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms`, {
        error: error.message,
        url: url.substring(0, 60)
      });

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // Final failure
  if (!suppressError) {
    logger.error(LogCode.API_FETCH_FAILED, `${endpointName} failed after ${maxRetries + 1} attempts`, {
      error: lastError?.message,
      url: url.substring(0, 60)
    });
  }

  throw lastError;
}

// ============================================================================
// RPC SERVICE
// ============================================================================

interface RpcRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params: any[];
}

interface RpcResponse<T = any> {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
  };
}

/**
 * Execute RPC call with automatic failover across multiple endpoints
 */
export async function callRpc<T = any>(
  chainSlug: string,
  method: string,
  params: any[] = [],
  primaryUrl?: string
): Promise<T> {
  const endpoints = getRpcEndpoints(chainSlug, primaryUrl);

  if (endpoints.length === 0) {
    throw new Error(`No RPC endpoints configured for chain: ${chainSlug}`);
  }

  const request: RpcRequest = {
    jsonrpc: '2.0',
    id: Date.now(),
    method,
    params,
  };

  let lastError: any = null;
  let attemptCount = 0;

  for (const endpoint of endpoints) {
    // Skip if circuit breaker is open
    if (isCircuitOpen(endpoint.url)) {
      continue;
    }

    attemptCount++;

    try {
      const startTime = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // ✅ 10s timeout (Alchemy needs more time)

      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Encoding': 'gzip', // ✅ Enable gzip compression (75% speedup for large responses)
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: RpcResponse<T> = await response.json();

      if (data.error) {
        throw new Error(`RPC Error: ${data.error.message}`);
      }

      if (!data.result && data.result !== null && data.result !== false && data.result !== 0) {
        throw new Error('No result in RPC response');
      }

      // Success!
      const responseTime = Date.now() - startTime;
      recordSuccess(endpoint.url, responseTime);

      if (attemptCount > 1) {
        logger.info(LogCode.SYS_INFO, `[RPC] Failover success on endpoint ${attemptCount}/${endpoints.length} for ${chainSlug}`, {
          endpoint: endpoint.name
        });
      }

      return data.result as T;

    } catch (error: any) {
      recordFailure(endpoint.url);
      lastError = error;

      const errorMsg = error.message || String(error);
      logger.warn(LogCode.API_FETCH_FAILED, `[RPC] Endpoint ${attemptCount}/${endpoints.length} failed for ${chainSlug}: ${errorMsg}`, {
        endpoint: endpoint.name,
        method
      });

      // Continue to next endpoint
      continue;
    }
  }

  // All endpoints failed
  throw new Error(
    `All RPC endpoints failed for ${chainSlug}. Last error: ${lastError?.message || lastError}`
  );
}

// ============================================================================
// DEXSCREENER SERVICE
// ============================================================================

let dexscreenerBackoffUntil = 0;

export type ApiPriority = 'normal' | 'high'; // high = Copy Trade, skip rate limits

export async function callDexScreener(
  endpoint: string,
  options: RequestInit = {},
  priority: ApiPriority = 'normal'
): Promise<any> {
  // Check rate limit backoff (high priority skips this check for Copy Trade)
  if (priority !== 'high' && Date.now() < dexscreenerBackoffUntil) {
    const waitTime = Math.ceil((dexscreenerBackoffUntil - Date.now()) / 1000);
    throw new Error(`DexScreener rate limit active (${waitTime}s remaining)`);
  }

  const url = `${DEXSCREENER_CONFIG.baseUrl}${endpoint}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEXSCREENER_CONFIG.timeout.rest);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    clearTimeout(timeout);

    // Handle rate limiting
    if (response.status === 429) {
      const backoffMs = 60000; // 1 minute backoff
      dexscreenerBackoffUntil = Date.now() + backoffMs;
      logger.warn(LogCode.API_RATE_LIMIT, 'DexScreener rate limit hit', { backoffMs, priority });
      throw new Error('Rate limit hit, backing off for 60s');
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();

  } catch (error: any) {
    logger.error(LogCode.API_FETCH_FAILED, 'DexScreener API error', {
      endpoint,
      error: error.message,
      priority
    });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================================
// GECKOTERMINAL SERVICE
// ============================================================================

let geckoTerminalBackoffUntil = 0;

/**
 * Token Bucket Rate Limiter for GeckoTerminal
 * Controls request rate to stay within 30 req/min limit
 */
class GeckoTokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second

  constructor(maxTokens: number, refillRatePerMinute: number) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRatePerMinute / 60;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens < 1) {
      const waitTime = Math.ceil((1 - this.tokens) / this.refillRate * 1000);
      logger.debug(LogCode.API_RATE_LIMIT, `GeckoTerminal rate limit: waiting ${waitTime}ms`);
      await new Promise(r => setTimeout(r, waitTime));
      this.refill();
    }
    this.tokens -= 1;
  }

  private refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }
}

// Token bucket: 10 burst capacity, 25 req/min refill (留有余量 vs 30 req/min limit)
const geckoTerminalBucket = new GeckoTokenBucket(10, 25);

export async function callGeckoTerminal(
  endpoint: string,
  options: RequestInit = {},
  retries: number = GECKOTERMINAL_CONFIG.retry.maxRetries,
  priority: ApiPriority = 'normal'
): Promise<any> {
  // Check global backoff first (high priority skips this for Copy Trade)
  if (priority !== 'high' && Date.now() < geckoTerminalBackoffUntil) {
    const waitTime = Math.ceil((geckoTerminalBackoffUntil - Date.now()) / 1000);
    throw new Error(`GeckoTerminal backoff active (${waitTime}s remaining)`);
  }

  // Acquire token from bucket (high priority skips wait for Copy Trade critical path)
  if (priority !== 'high') {
    await geckoTerminalBucket.acquire();
  }

  const url = `${GECKOTERMINAL_CONFIG.baseUrl}${endpoint}`;
  let lastError: any = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), GECKOTERMINAL_CONFIG.timeout.default);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeout);

      // Handle rate limiting with backoff (60 seconds to respect 30 req/min limit)
      if (response.status === 429) {
        const backoffMs = 60000; // 60 seconds (doubled from 30s for better recovery)
        geckoTerminalBackoffUntil = Date.now() + backoffMs;
        logger.warn(LogCode.API_RATE_LIMIT, 'GeckoTerminal 429 triggered backoff', { backoffMs });
        throw new Error(`Rate limit hit, backing off for ${backoffMs}ms`);
      }

      // Retry on server errors
      if (response.status >= 500 && attempt < retries) {
        const delay = GECKOTERMINAL_CONFIG.retry.baseDelayMs * Math.pow(2, attempt);
        logger.warn(LogCode.API_FETCH_FAILED, `GeckoTerminal ${response.status}, retrying...`, {
          attempt: attempt + 1,
          delayMs: delay
        });
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();

    } catch (error: any) {
      lastError = error;

      // Don't retry on timeout or network errors beyond max retries
      if (attempt >= retries) {
        break;
      }

      const delay = GECKOTERMINAL_CONFIG.retry.baseDelayMs * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  logger.error(LogCode.API_FETCH_FAILED, 'GeckoTerminal API error after retries', {
    endpoint,
    error: lastError?.message
  });
  throw lastError;
}

// ============================================================================
// UTILITY: GET ENDPOINT HEALTH STATS
// ============================================================================

export function getEndpointHealthStats(): Array<{
  url: string;
  name: string;
  successRate: number;
  avgResponseTime: number;
  circuitOpen: boolean;
  consecutiveFailures: number;
}> {
  const stats: Array<any> = [];

  for (const [url, health] of endpointHealthMap.entries()) {
    const successRate = health.totalAttempts > 0
      ? (health.successCount / health.totalAttempts) * 100
      : 0;

    stats.push({
      url: url.substring(0, 60),
      name: getEndpointName(url),
      successRate: Math.round(successRate * 100) / 100,
      avgResponseTime: Math.round(health.avgResponseTime),
      circuitOpen: health.circuitOpen,
      consecutiveFailures: health.consecutiveFailures,
    });
  }

  return stats.sort((a, b) => b.successRate - a.successRate);
}

// Export for backward compatibility
export {
  getRpcEndpoints,
  DEXSCREENER_CONFIG,
  GECKOTERMINAL_CONFIG,
  ETHERSCAN_CONFIG,
  ROUTESCAN_CONFIG,
  BLOCKSCOUT_CONFIG,
  SOLSCAN_CONFIG,
  MORALIS_CONFIG
};
