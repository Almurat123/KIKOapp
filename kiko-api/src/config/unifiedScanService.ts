/**
 * Unified Scan Service (Block Explorer APIs)
 * Handles all blockchain explorer API calls with automatic failover
 */

import { logger } from '../utils/logger.js';
import { LogCode } from './logRegistry.js';
import { fetchJson } from './unifiedApiService.js';
import {
  ETHERSCAN_CONFIG,
  ROUTESCAN_CONFIG,
  BLOCKSCOUT_CONFIG,
  SOLSCAN_CONFIG,
} from './apiEndpoints.js';

// ============================================================================
// SCAN PROVIDER HEALTH TRACKING
// ============================================================================

interface ScanProviderHealth {
  provider: string;
  consecutiveFailures: number;
  lastFailureTime: number;
  circuitOpen: boolean;
  totalAttempts: number;
  successCount: number;
}

const scanHealthMap = new Map<string, ScanProviderHealth>();

function getOrCreateScanHealth(provider: string): ScanProviderHealth {
  if (!scanHealthMap.has(provider)) {
    scanHealthMap.set(provider, {
      provider,
      consecutiveFailures: 0,
      lastFailureTime: 0,
      circuitOpen: false,
      totalAttempts: 0,
      successCount: 0,
    });
  }
  return scanHealthMap.get(provider)!;
}

function recordScanSuccess(provider: string) {
  const health = getOrCreateScanHealth(provider);
  health.consecutiveFailures = 0;
  health.circuitOpen = false;
  health.successCount++;
  health.totalAttempts++;
}

function recordScanFailure(provider: string) {
  const health = getOrCreateScanHealth(provider);
  health.consecutiveFailures++;
  health.lastFailureTime = Date.now();
  health.totalAttempts++;

  if (health.consecutiveFailures >= 3) {
    health.circuitOpen = true;
    logger.warn(LogCode.SYS_ERROR, `Scan circuit breaker opened: ${provider}`, {
      failures: health.consecutiveFailures,
    });
  }
}

function isScanCircuitOpen(provider: string): boolean {
  const health = getOrCreateScanHealth(provider);

  if (health.circuitOpen && Date.now() - health.lastFailureTime > 30000) {
    health.circuitOpen = false;
    health.consecutiveFailures = 0;
  }

  return health.circuitOpen;
}

// ============================================================================
// ETHERSCAN API
// ============================================================================

export async function callEtherscan(
  chainId: number,
  params: Record<string, any>
): Promise<any> {
  if (!ETHERSCAN_CONFIG.apiKey) {
    throw new Error('Etherscan API key not configured');
  }

  const url = `${ETHERSCAN_CONFIG.baseUrl}?chainid=${chainId}&apikey=${ETHERSCAN_CONFIG.apiKey}&${new URLSearchParams(
    params
  ).toString()}`;

  try {
    const data = await fetchJson({
      url,
      requestTimeout: ETHERSCAN_CONFIG.timeout,
      endpointName: 'etherscan',
      headers: { 'Content-Type': 'application/json' },
    });

    recordScanSuccess('etherscan');
    return data;
  } catch (error: any) {
    recordScanFailure('etherscan');
    logger.error(LogCode.API_FETCH_FAILED, 'Etherscan API error', {
      error: error.message,
      chainId,
    });
    throw error;
  }
}

// ============================================================================
// ROUTESCAN API
// ============================================================================

export async function callRoutescan(
  chain: string,
  params: Record<string, any>
): Promise<any> {
  if (!ROUTESCAN_CONFIG.apiKey) {
    throw new Error('RouteScan API key not configured');
  }

  const path = ROUTESCAN_CONFIG.chainMap[chain.toLowerCase()];
  if (!path) {
    throw new Error(`Unsupported chain for RouteScan: ${chain}`);
  }

  const url = `${ROUTESCAN_CONFIG.baseUrl}/${path}/evm/etherscan/api?apikey=${ROUTESCAN_CONFIG.apiKey}&${new URLSearchParams(
    params
  ).toString()}`;

  try {
    const data = await fetchJson({
      url,
      requestTimeout: ROUTESCAN_CONFIG.timeout,
      endpointName: 'routescan',
      headers: { 'Content-Type': 'application/json' },
    });

    recordScanSuccess('routescan');
    return data;
  } catch (error: any) {
    recordScanFailure('routescan');
    logger.error(LogCode.API_FETCH_FAILED, 'RouteScan API error', {
      error: error.message,
      chain,
    });
    throw error;
  }
}

// ============================================================================
// BLOCKSCOUT API
// ============================================================================

export async function callBlockscout(
  chain: string,
  params: Record<string, any>
): Promise<any> {
  if (!BLOCKSCOUT_CONFIG.apiKey) {
    throw new Error('Blockscout API key not configured');
  }

  const baseUrl = BLOCKSCOUT_CONFIG.chainUrls[chain.toLowerCase()];
  if (!baseUrl) {
    throw new Error(`Unsupported chain for Blockscout: ${chain}`);
  }

  const url = `${baseUrl}?apikey=${BLOCKSCOUT_CONFIG.apiKey}&${new URLSearchParams(
    params
  ).toString()}`;

  try {
    const data = await fetchJson({
      url,
      requestTimeout: BLOCKSCOUT_CONFIG.timeout,
      endpointName: 'blockscout',
      headers: { 'Content-Type': 'application/json' },
    });

    recordScanSuccess('blockscout');
    return data;
  } catch (error: any) {
    recordScanFailure('blockscout');
    logger.error(LogCode.API_FETCH_FAILED, 'Blockscout API error', {
      error: error.message,
      chain,
    });
    throw error;
  }
}

// ============================================================================
// SOLSCAN API
// ============================================================================

export async function callSolscan(
  endpoint: string,
  params?: Record<string, any>
): Promise<any> {
  if (!SOLSCAN_CONFIG.apiKey) {
    throw new Error('Solscan API key not configured');
  }

  const url = `${SOLSCAN_CONFIG.baseUrl}${endpoint}?${new URLSearchParams({
    ...params,
    token: SOLSCAN_CONFIG.apiKey,
  }).toString()}`;

  try {
    const data = await fetchJson({
      url,
      requestTimeout: SOLSCAN_CONFIG.timeout,
      endpointName: 'solscan',
      headers: { 'Content-Type': 'application/json' },
    });

    recordScanSuccess('solscan');
    return data;
  } catch (error: any) {
    recordScanFailure('solscan');
    logger.error(LogCode.API_FETCH_FAILED, 'Solscan API error', {
      error: error.message,
      endpoint,
    });
    throw error;
  }
}

// ============================================================================
// UNIFIED SCAN INTERFACE (with automatic failover)
// ============================================================================

/**
 * Get transaction list with automatic failover
 */
export async function getTransactionList(
  chainId: number,
  chain: string,
  address: string,
  startblock?: number,
  endblock?: number
): Promise<any> {
  const providers = [];

  // Add Etherscan if configured
  if (ETHERSCAN_CONFIG.apiKey && !isScanCircuitOpen('etherscan')) {
    providers.push({
      name: 'etherscan',
      fn: () =>
        callEtherscan(chainId, {
          module: 'account',
          action: 'txlist',
          address,
          startblock: startblock || 0,
          endblock: endblock || 99999999,
        }),
    });
  }

  // Add RouteScan if configured
  if (ROUTESCAN_CONFIG.apiKey && !isScanCircuitOpen('routescan')) {
    providers.push({
      name: 'routescan',
      fn: () =>
        callRoutescan(chain, {
          module: 'account',
          action: 'txlist',
          address,
          startblock: startblock || 0,
          endblock: endblock || 99999999,
        }),
    });
  }

  // Add Blockscout if configured
  if (BLOCKSCOUT_CONFIG.apiKey && !isScanCircuitOpen('blockscout')) {
    providers.push({
      name: 'blockscout',
      fn: () =>
        callBlockscout(chain, {
          module: 'account',
          action: 'txlist',
          address,
          startblock: startblock || 0,
          endblock: endblock || 99999999,
        }),
    });
  }

  let lastError: any = null;

  for (const provider of providers) {
    try {
      return await provider.fn();
    } catch (error: any) {
      lastError = error;
      continue;
    }
  }

  throw new Error(`All scan providers failed. Last error: ${lastError?.message}`);
}

/**
 * Get Solana transactions
 */
export async function getSolanaTransactions(
  address: string,
  limit: number = 50
): Promise<any> {
  if (!SOLSCAN_CONFIG.apiKey) {
    throw new Error('Solscan API key not configured');
  }

  return callSolscan('/transaction/list', {
    address,
    limit: Math.min(limit, 40),
  });
}

// ============================================================================
// HEALTH STATS
// ============================================================================

export function getScanHealthStats() {
  const stats: any[] = [];

  for (const [_, health] of scanHealthMap.entries()) {
    const successRate =
      health.totalAttempts > 0
        ? ((health.successCount / health.totalAttempts) * 100).toFixed(2)
        : 0;

    stats.push({
      provider: health.provider,
      successRate: parseFloat(successRate as string),
      totalAttempts: health.totalAttempts,
      consecutiveFailures: health.consecutiveFailures,
      circuitOpen: health.circuitOpen,
    });
  }

  return stats;
}
