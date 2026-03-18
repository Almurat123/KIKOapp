import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import type { RpcEndpointConfig } from '../../config/apiEndpoints.js';
import type { RpcImportance } from './types.js';
import { sortRpcEndpointsByScore } from './score.js';
import { isNonRetryableRpcErrorMessage, resolveRpcTimeoutMs } from './rpcSelection.js';
import {
  checkAndReserveCapacity,
  getEndpointHealthView,
  getEndpointUsageView,
  isCircuitOpen,
  maskEndpoint,
  recordAttempt,
  recordFailure,
  recordSuccess,
  recordUsageEnd,
  shouldLogAllRpcFailed,
} from './rpcState.js';

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

function filterEndpointsByMethod(endpoints: RpcEndpointConfig[], method: string): RpcEndpointConfig[] {
  const matches = endpoints.filter((endpoint) => endpoint.capabilities?.methods?.includes(method));
  return matches.length > 0 ? matches : endpoints;
}

function sortEndpointsByScore(endpoints: RpcEndpointConfig[], method: string, importance: RpcImportance): RpcEndpointConfig[] {
  return sortRpcEndpointsByScore({
    endpoints,
    method,
    importance,
    now: Date.now(),
    getHealth: getEndpointHealthView,
    getUsage: getEndpointUsageView,
  });
}

export async function callRpcCustom<T = any>(
  endpoints: RpcEndpointConfig[],
  method: string,
  params: any = [],
  options: { importance?: RpcImportance } = {}
): Promise<T> {
  if (!endpoints || endpoints.length === 0) {
    throw new Error('No RPC endpoints provided');
  }

  const normalized = endpoints.map((ep, idx) => ({
    name: ep.name || `Custom-${idx + 1}`,
    url: ep.url,
    priority: ep.priority ?? idx + 1,
    requiresAuth: ep.requiresAuth ?? false,
    type: ep.type ?? 'premium',
    limits: ep.limits,
    weight: ep.weight,
    capabilities: ep.capabilities,
  })) as RpcEndpointConfig[];

  const filtered = filterEndpointsByMethod(normalized, method);
  if (filtered.length === 0) {
    throw new Error(`No RPC endpoints support method ${method}`);
  }

  const request: RpcRequest = {
    jsonrpc: '2.0',
    id: Date.now(),
    method,
    params,
  };

  let lastError: Error | null = null;
  const effectiveImportance: RpcImportance = options.importance || 'normal';
  const requestTimeoutMs = resolveRpcTimeoutMs(method, { strategy: 'fast', importance: effectiveImportance });
  const sortedEndpoints = sortEndpointsByScore(filtered, method, effectiveImportance);

  for (let i = 0; i < sortedEndpoints.length; i++) {
    const endpoint = sortedEndpoints[i];
    if (!endpoint?.url) continue;

    if (isCircuitOpen(endpoint.url)) {
      logger.debug(LogCode.API_FETCH_FAILED, 'RPC circuit open, skipping endpoint', { endpoint: maskEndpoint(endpoint.url) });
      continue;
    }

    const capacity = checkAndReserveCapacity(endpoint, effectiveImportance);
    if (!capacity.ok) {
      logger.debug(LogCode.API_FETCH_FAILED, 'RPC capacity limited, skipping endpoint', {
        endpoint: maskEndpoint(endpoint.url),
        reason: capacity.reason,
      });
      continue;
    }

    const startTime = Date.now();
    try {
      recordAttempt(endpoint.url);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Encoding': 'gzip',
          Connection: 'keep-alive',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
        keepalive: true,
      }).finally(() => clearTimeout(timeout));

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as RpcResponse<T>;
      if (data.error) {
        throw new Error(`RPC Error: ${data.error.message}`);
      }
      if (data.result === undefined) {
        throw new Error('RPC returned undefined result');
      }

      const responseTime = Date.now() - startTime;
      recordSuccess(endpoint.url, responseTime);

      if (i > 0) {
        logger.debug(LogCode.API_FETCH_SUCCESS, 'RPC failover success', {
          endpoint: i + 1,
          total: sortedEndpoints.length,
          responseTime,
        });
      }

      return data.result;
    } catch (error: any) {
      lastError = error;

      if (isNonRetryableRpcErrorMessage(error?.message || '')) {
        throw error;
      }

      recordFailure(endpoint.url);

      if (i < 2) {
        logger.aggregate(LogCode.API_FETCH_FAILED, 'RPC endpoint failed', {
          endpoint: i + 1,
          total: sortedEndpoints.length,
          error: error.message,
          duration: Date.now() - startTime,
        });
      }

      if (i < sortedEndpoints.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        continue;
      }
    } finally {
      recordUsageEnd(endpoint.url);
    }
  }

  const failedLogKey = `custom:${method}`;
  if (shouldLogAllRpcFailed(failedLogKey)) {
    logger.error(LogCode.API_FETCH_FAILED, 'All RPC endpoints failed', {
      method,
      totalEndpoints: sortedEndpoints.length,
      lastError: lastError?.message,
    });
  } else {
    logger.debug(LogCode.API_FETCH_FAILED, 'All RPC endpoints failed (suppressed)', { method });
  }

  throw new Error(`All RPC endpoints failed. Last error: ${lastError?.message || 'Unknown'}`);
}
