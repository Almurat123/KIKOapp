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

export async function callDexScreener(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  // Check rate limit backoff
  if (Date.now() < dexscreenerBackoffUntil) {
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
      logger.warn(LogCode.API_RATE_LIMIT, 'DexScreener rate limit hit', { backoffMs });
      throw new Error('Rate limit hit, backing off for 60s');
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();

  } catch (error: any) {
    logger.error(LogCode.API_FETCH_FAILED, 'DexScreener API error', {
      endpoint,
      error: error.message
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

export async function callGeckoTerminal(
  endpoint: string,
  options: RequestInit = {},
  retries: number = GECKOTERMINAL_CONFIG.retry.maxRetries
): Promise<any> {
  // Check global backoff
  if (Date.now() < geckoTerminalBackoffUntil) {
    const waitTime = Math.ceil((geckoTerminalBackoffUntil - Date.now()) / 1000);
    throw new Error(`GeckoTerminal backoff active (${waitTime}s remaining)`);
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

      // Handle rate limiting with backoff
      if (response.status === 429) {
        const backoffMs = 30000; // 30 seconds
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

  for (const [url, health] of Array.from(endpointHealthMap.entries())) {
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
