/**
 * Batch RPC Request Helper
 * Implements Alchemy's batch request optimization
 * 
 * Reference: https://alchemy.com/docs/reference/batch-requests.mdx
 * 
 * Benefits:
 * - Reduces number of HTTP requests
 * - Faster response time (single round trip for multiple calls)
 * - Better rate limiting (counts as single request)
 * - Supported on: Ethereum, Polygon, Optimism, Arbitrum
 */

import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { callRpcBatch } from '../services/rpcManager.js';

export interface BatchRequest {
  jsonrpc: string; // Required for RpcRequest compatibility
  id: number;
  method: string;
  params: any[];
}

export interface BatchResult<T> {
  id: string | number;
  result?: T;
  error?: { code: number; message: string };
}

/**
 * Execute multiple RPC calls in a single batch request
 * Much more efficient than sequential calls!
 * 
 * @param chainName Chain identifier (eth, base, etc)
 * @param requests Array of RPC method calls
 * @returns Array of results in same order as requests
 */
export async function batchRpcCall<T = any>(
  chainName: string,
  requests: BatchRequest[]
): Promise<BatchResult<T>[]> {
  if (requests.length === 0) {
    return [];
  }

  // Log batch size to understand optimization impact
  if (requests.length > 1) {
    logger.debug(LogCode.SYS_INFO, 'Batch RPC request', {
      chain: chainName,
      batchSize: requests.length,
      methods: requests.map(r => r.method).join(', '),
    });
  }

  try {
    const results: BatchResult<T>[] = await callRpcBatch<T>(chainName, requests);

    if (requests.length > 1) {
      logger.info(LogCode.API_FETCH_SUCCESS, 'Batch RPC completed', {
        chain: chainName,
        batchSize: requests.length,
        success: results.filter(r => !r.error).length,
        failed: results.filter(r => r.error).length,
      });
    }

    return results;
  } catch (error: any) {
    logger.error(LogCode.API_FETCH_FAILED, 'Batch RPC failed', {
      chain: chainName,
      batchSize: requests.length,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Example: Get multiple token balances in a single batch call
 * 
 * Instead of:
 *   for (const token of tokens) {
 *     const balance = await eth_call(token);  // N separate requests!
 *   }
 * 
 * Do:
 *   const requests = tokens.map((token, i) => ({
 *     id: i,
 *     method: 'eth_call',
 *     params: [{ to: token, data: BALANCE_SELECTOR }, 'latest']
 *   }));
 *   const results = await batchRpcCall('eth', requests);
 */

/**
 * Helper: Get balance for multiple tokens in one batch
 */
export async function getMultipleTokenBalances(
  chainName: string,
  walletAddress: string,
  tokenAddresses: string[]
): Promise<Map<string, string>> {
  if (tokenAddresses.length === 0) {
    return new Map();
  }

  // ERC20 balanceOf selector (first 4 bytes of keccak256("balanceOf(address)"))
  const BALANCE_OF_SELECTOR = '0x70a08231';

  // Pad wallet address to 64 hex chars
  const paddedAddress = walletAddress.slice(2).padStart(64, '0');

  // Create batch requests
  const requests: any[] = tokenAddresses.map((token, i) => ({
    jsonrpc: '2.0',
    id: i,
    method: 'eth_call',
    params: [
      {
        to: token,
        data: BALANCE_OF_SELECTOR + paddedAddress,
      },
      'latest',
    ],
  }));

  const results = await batchRpcCall<string>(chainName, requests);

  // Map results back to token addresses
  const balances = new Map<string, string>();
  results.forEach((result, index) => {
    if (!result.error && result.result) {
      balances.set(tokenAddresses[index], result.result);
    }
  });

  return balances;
}
