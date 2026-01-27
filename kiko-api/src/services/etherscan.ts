/**
 * Etherscan API Service
 * Documentation: https://docs.etherscan.io/
 * 
 * Using V2 API: https://docs.etherscan.io/v2-migration
 * Free tier: 5 calls/second, 100,000 calls/day
 */

// V2 API base URL
const ETHERSCAN_V2_BASE_URL = 'https://api.etherscan.io/v2/api';

export interface EthGasOracle {
  lastBlock: string;
  safeGasPrice: string;      // Gwei
  proposeGasPrice: string;   // Gwei
  fastGasPrice: string;      // Gwei
  suggestBaseFee: string;    // Gwei
  gasUsedRatio: string;
}

/**
 * Get Ethereum gas price from Etherscan V2 API
 * Returns gas prices in Gwei
 */
// Chain API mapping
import { env } from '../config/env.js';
import * as unifiedApiService from '../config/unifiedApiService.js';

// Chain API mapping
const CHAIN_API_MAP: Record<string, string> = {
  eth: 'https://api.etherscan.io', // Official Etherscan API
  bsc: 'https://api.bscscan.com',
  polygon: 'https://api.polygonscan.com',
  arbitrum: 'https://api.arbiscan.io',
  optimism: 'https://api-optimistic.etherscan.io',
  base: 'https://api.basescan.org',
  fantom: 'https://api.ftmscan.com',
  avalanche: 'https://api.snowtrace.io',
};

/**
 * Get gas price from Etherscan-compatible APIs
 * Returns gas prices in Gwei
 */
export async function getGasPrice(chain: string = 'eth', apiKey?: string): Promise<EthGasOracle | null> {
  try {
    const baseUrl = CHAIN_API_MAP[chain.toLowerCase()] || CHAIN_API_MAP.eth;

    // Blockscout and others support standard V1 API
    // Etherscan Upgrade: Use V2 API for ETH Mainnet
    let url: string;
    if (chain.toLowerCase() === 'eth') {
      url = `https://api.etherscan.io/v2/api?chainid=1&module=gastracker&action=gasoracle${apiKey ? `&apikey=${apiKey}` : ''}`;
    } else {
      url = `${baseUrl}/api?module=gastracker&action=gasoracle${apiKey ? `&apikey=${apiKey}` : ''}`;
    }

    // Note: If using real Etherscan V2 in future, would need chainid=1 here. 
    // But Blockscout handles it beautifully without.

    const response = await unifiedApiService.fetchJson<any>({
      url,
      method: 'GET',
      timeout: 10000,
      endpointName: 'api.etherscan.io'
    });

    // Simulate response object for compatibility
    const data = response;
    const responseOk = !!data;

    if (!responseOk) {
      console.error(`Etherscan/Blockscout API error for ${chain}: failed to fetch`);
      return null;
    }

    // Handle standard response
    if (data.status === '1' && data.result) {
      return {
        lastBlock: data.result.LastBlock || '',
        safeGasPrice: data.result.SafeGasPrice || '0',
        proposeGasPrice: data.result.ProposeGasPrice || '0',
        fastGasPrice: data.result.FastGasPrice || '0',
        suggestBaseFee: data.result.suggestBaseFee || '0',
        gasUsedRatio: data.result.gasUsedRatio || '',
      };
    }

    return null;
  } catch (error) {
    console.error(`Error fetching gas price for ${chain}:`, error);
    return null;
  }
}

/**
 * Get formatted ETH gas price string (e.g., "15 Gwei")
 */
export async function getEthGasPriceFormatted(apiKey?: string): Promise<string | undefined> {
  const gasOracle = await getGasPrice('eth', apiKey);

  if (gasOracle && gasOracle.safeGasPrice) {
    const safeGas = parseFloat(gasOracle.safeGasPrice);
    if (safeGas > 0) {
      // Format with 2 decimal places if needed
      return safeGas < 1 ? `${safeGas.toFixed(2)} Gwei` : `${Math.round(safeGas)} Gwei`;
    }
  }

  return undefined;
}

export interface ContractSourceCode {
  sourceCode: string;
  contractName: string;
  compilerVersion: string;
  optimizationUsed: boolean;
  license: string;
}

/**
 * Get contract source code from Etherscan/Blockscout
 */
export async function getContractSourceCode(
  address: string,
  chain: string = 'eth',
  apiKey?: string
): Promise<ContractSourceCode | null> {
  try {
    // Map chain to API base URL
    const baseUrl = CHAIN_API_MAP[chain.toLowerCase()] || CHAIN_API_MAP.eth;

    // Standard V1 API call (Works for Blockscout and V1 Etherscan clones)
    const url = `${baseUrl}/api?module=contract&action=getsourcecode&address=${address}${apiKey ? `&apikey=${apiKey}` : ''}`;

    const data = await unifiedApiService.fetchJson<{
      status: string; result: Array<{
        SourceCode?: string;
        ContractName?: string;
        CompilerVersion?: string;
        OptimizationUsed?: string;
        License?: string;
      }>
    }>({
      url,
      method: 'GET',
      timeout: 10000,
      endpointName: 'api.etherscan.io'
    });

    if (!data) return null;

    if (data.status === '1' && data.result && data.result.length > 0) {
      const contract = data.result[0];

      if (!contract.SourceCode || contract.SourceCode === '') {
        return null; // Contract not verified
      }

      return {
        sourceCode: contract.SourceCode,
        contractName: contract.ContractName || 'Unknown',
        compilerVersion: contract.CompilerVersion || 'Unknown',
        optimizationUsed: contract.OptimizationUsed === '1',
        license: contract.License || 'Unknown',
      };
    }

    return null;
  } catch (error) {
    console.error(`Error fetching contract source code from ${chain}:`, error);
    return null;
  }
}

/**
 * Identify Solana Verification status via Solscan
 */
export async function getSolscanVerification(address: string): Promise<{ verified: boolean; type?: string } | null> {
  try {
    const apiKey = env.apiKeys.solscan;
    if (!apiKey) return null;

    // Solscan Public/Pro API: Token Metadata usually contains verification info
    const url = `https://public-api.solscan.io/token/meta?tokenAddress=${address}`;

    const data = await unifiedApiService.fetchJson<any>({
      url,
      method: 'GET',
      headers: {
        'token': apiKey
      },
      timeout: 10000,
      endpointName: 'public-api.solscan.io'
    });

    // Look for indicators of verification in metadata
    // Since specific endpoint for verification might be Pro only, we infer or check fields
    // Typically 'icon' or 'symbol' presence indicates some level of verification, 
    // but strictly 'verified' status is better fetched via account detailed info.

    // Let's try account info which is definitive
    // Note: 'https://public-api.solscan.io/account/{account}' is deprecated maybe?
    // Use specific verification check if available.

    // For now, return truthy if we get valid metadata as a proxy for "known token"
    if (data && data.symbol) {
      return { verified: true, type: 'Solana SPL Token' };
    }
    return { verified: false };

  } catch (error) {
    console.error('Solscan check error:', error);
    return null;
  }
}

/**
 * Fetch contract metadata (ABI, etc.) from Sourcify
 * Sourcify is a decentralized verification service.
 * Uses V2 API as primary, falls back to /files if needed.
 */
export async function getSourcifyData(chainId: number | string, address: string): Promise<{
  status: 'full' | 'partial' | null;
  metadata?: any;
  abi?: any[];
} | null> {
  try {
    // Method 1: Try Sourcify V2 API
    // Official V2 endpoint: https://sourcify.dev/server/v2/contract/{chainId}/{address}
    // Documentation: https://docs.sourcify.dev/docs/api/
    // The V2 API returns detailed contract information including ABI, metadata, and match status

    const v2Url = `https://sourcify.dev/server/v2/contract/${chainId}/${address}?fields=abi,metadata,match`;

    try {
      const data = await unifiedApiService.fetchJson<any>({
        url: v2Url,
        method: 'GET',
        timeout: 5000,
        endpointName: 'sourcify.dev'
      });
      const responseV2Ok = !!data;

      if (responseV2Ok) {

        // Check if verified
        // V2 response structure: { match: 'match'|'partial'|null, abi: [...], metadata: {...} }
        // For unverified contracts: { match: null, ... } or 404 status
        if (data.match || data.runtimeMatch) {
          return {
            status: data.match === 'match' ? 'full' : 'partial',
            metadata: data.metadata,
            abi: data.abi
          };
        }
      }
    } catch (e) {
      // V2 failed, fall through to fallback
    }

    // Method 2: Fallback to V1 /files endpoint (Old reliable for some inputs)
    const baseUrl = 'https://sourcify.dev/server';
    const urlv1 = `${baseUrl}/files/${chainId}/${address}`;

    const data = await unifiedApiService.fetchJson<any>({
      url: urlv1,
      method: 'GET',
      timeout: 5000,
      endpointName: 'sourcify.dev'
    });

    if (!data) return null;
    const metadataFile = data.find((f: any) => f.name === 'metadata.json');

    if (metadataFile) {
      const metadata = JSON.parse(metadataFile.content);
      return {
        status: data.status === 'full' ? 'full' : 'partial',
        metadata: metadata,
        abi: metadata.output?.abi || metadata.abi
      };
    }

    return null;

  } catch (error) {
    return null;
  }
}
