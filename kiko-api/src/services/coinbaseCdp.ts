/**
 * Coinbase CDP API Service
 * Documentation:
 * - EVM: https://docs.cdp.coinbase.com/api-reference/v2/rest-api/evm-token-balances/list-evm-token-balances
 * - Solana: https://docs.cdp.coinbase.com/api-reference/v2/rest-api/solana-token-balances/list-solana-token-balances
 */

import { env } from '../config/env.js';
import type { TokenBalance, WalletBalance } from './alchemy.js';

const COINBASE_CDP_API_BASE_URL = '/platform/v2';
const COINBASE_CDP_API_HOST = 'api.cdp.coinbase.com';

// Chain ID to Coinbase CDP network name mapping
// Supported networks: base, base-sepolia, ethereum
// According to: https://docs.cdp.coinbase.com/api-reference/v2/rest-api/evm-token-balances/list-evm-token-balances
const CHAIN_ID_MAP: Record<number, string> = {
  1: 'ethereum', // Ethereum Mainnet
  8453: 'base', // Base
  // Note: Only base, base-sepolia, and ethereum are supported by Coinbase CDP API
  // Other chains will default to ethereum (but may not have data)
};

// Get Coinbase CDP API key (should be KEY_NAME and KEY_SECRET)
const getCoinbaseCdpApiKeyId = (): string => {
  return process.env.COINBASE_CDP_API_KEY_ID || process.env.COINBASE_CDP_KEY_NAME || '';
};

const getCoinbaseCdpApiKeySecret = (): string => {
  return process.env.COINBASE_CDP_API_KEY_SECRET || process.env.COINBASE_CDP_KEY_SECRET || '';
};

// Generate JWT Bearer Token for Coinbase CDP API
// According to: https://docs.cdp.coinbase.com/api-reference/v2/authentication
async function generateCdpJwt(
  apiKeyId: string,
  apiKeySecret: string,
  requestMethod: string,
  requestHost: string,
  requestPath: string
): Promise<string> {
  try {
    // Use CDP SDK if available, otherwise generate manually
    try {
      const { generateJwt } = await import('@coinbase/cdp-sdk/auth');
      return await generateJwt({
        apiKeyId,
        apiKeySecret,
        requestMethod,
        requestHost,
        requestPath,
        expiresIn: 120, // 2 minutes
      });
    } catch {
      // Fallback to manual JWT generation if SDK not available
      // For now, we'll require the SDK to be installed
      throw new Error('@coinbase/cdp-sdk package is required. Install it with: npm install @coinbase/cdp-sdk');
    }
  } catch (error) {
    console.error('[CoinbaseCDP] Error generating JWT:', error);
    throw error;
  }
}

// ============ Types ============

interface CoinbaseEvmTokenBalance {
  amount: {
    amount: string;
    decimals: number;
  };
  token: {
    network: string;
    symbol?: string;
    name?: string;
    contractAddress: string;
  };
}

interface CoinbaseEvmTokenBalancesResponse {
  balances: CoinbaseEvmTokenBalance[];
  nextPageToken?: string;
}

interface CoinbaseSolanaTokenBalance {
  amount: {
    amount: string;
    decimals: number;
  };
  token: {
    symbol?: string;
    name?: string;
    mintAddress: string;
  };
}

interface CoinbaseSolanaTokenBalancesResponse {
  balances: CoinbaseSolanaTokenBalance[];
  nextPageToken?: string;
}

// ============ Helper Functions ============

/**
 * Check if a chain ID is supported by Coinbase CDP API
 */
export function isChainSupported(chainId: number): boolean {
  return !!CHAIN_ID_MAP[chainId];
}

/**
 * Convert chain ID to Coinbase CDP chain name
 */
function getChainName(chainId: number): string {
  return CHAIN_ID_MAP[chainId] || 'ethereum';
}

/**
 * Format token balance from raw amount and decimals
 */
function formatTokenBalance(rawBalance: string, decimals: number): string {
  try {
    const balance = BigInt(rawBalance);
    const divisor = BigInt(10 ** decimals);
    const whole = balance / divisor;
    const remainder = balance % divisor;
    const remainderStr = remainder.toString().padStart(decimals, '0');
    return `${whole}.${remainderStr}`;
  } catch (error) {
    console.error('[CoinbaseCDP] Error formatting balance:', error);
    return '0';
  }
}

// ============ API Functions ============

/**
 * Get EVM token balances for an address
 * @param address - Wallet address (0x format)
 * @param chainId - Chain ID (1 for Ethereum, 8453 for Base, etc.)
 */
export async function getEvmTokenBalances(
  address: string,
  chainId: number
): Promise<TokenBalance[]> {
  try {
    const apiKeyId = getCoinbaseCdpApiKeyId();
    const apiKeySecret = getCoinbaseCdpApiKeySecret();

    if (!apiKeyId || !apiKeySecret) {
      console.warn('[CoinbaseCDP] API key ID or Secret not configured. Need COINBASE_CDP_API_KEY_ID and COINBASE_CDP_API_KEY_SECRET');
      return [];
    }

    // Convert chain ID to network name for API
    // Supported networks: base, base-sepolia, ethereum
    const network = CHAIN_ID_MAP[chainId];

    if (!network) {
      console.warn(`[CoinbaseCDP] Chain ID ${chainId} is not supported by Coinbase CDP API. Supported: ethereum (1), base (8453)`);
      return [];
    }

    // Correct endpoint format: /platform/v2/evm/token-balances/{network}/{address}
    const requestPath = `${COINBASE_CDP_API_BASE_URL}/evm/token-balances/${network}/${address}`;
    const url = `https://${COINBASE_CDP_API_HOST}${requestPath}`;

    console.log(`[CoinbaseCDP] Fetching EVM token balances for chain ${chainId} (${network}): ${url}`);

    // Generate JWT Bearer Token
    const jwt = await generateCdpJwt(
      apiKeyId,
      apiKeySecret,
      'GET',
      COINBASE_CDP_API_HOST,
      requestPath
    );

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[CoinbaseCDP] API error for EVM balances:`,
        {
          chainId,
          network,
          url,
          status: response.status,
          statusText: response.statusText,
          errorText: errorText.substring(0, 500),
        }
      );
      return [];
    }

    const data = await response.json() as CoinbaseEvmTokenBalancesResponse;
    const balances = data.balances || [];

    console.log(`[CoinbaseCDP] EVM token balances response for ${address} on chain ${chainId} (${network}):`, {
      balancesCount: balances.length,
      balances: balances.slice(0, 5),
    });

    // DEBUG: Log USDC/stablecoin raw data to diagnose incorrect balance issues
    const stablecoins = balances.filter((b) =>
      b.token.symbol?.toUpperCase().includes('USD') ||
      b.token.symbol?.toUpperCase().includes('USDC')
    );
    if (stablecoins.length > 0) {
      console.log(`[CoinbaseCDP] DEBUG - Stablecoin raw data:`, stablecoins.map(s => ({
        symbol: s.token.symbol,
        name: s.token.name,
        contractAddress: s.token.contractAddress,
        rawAmount: s.amount.amount,
        decimals: s.amount.decimals,
      })));
    }

    // Convert to TokenBalance format
    const tokenBalances: TokenBalance[] = balances.map((balance) => {
      const decimals = balance.amount.decimals || 18;
      const rawAmount = balance.amount.amount || '0';
      const formattedBalance = formatTokenBalance(rawAmount, decimals);

      return {
        contractAddress: balance.token.contractAddress,
        tokenBalance: formattedBalance,
        symbol: balance.token.symbol,
        name: balance.token.name,
        decimals: decimals,
        logo: undefined, // Coinbase CDP API doesn't provide logo_url in this endpoint
      };
    });

    // Filter out zero balances
    const filtered = tokenBalances.filter((tb) => {
      const balance = parseFloat(tb.tokenBalance);
      return balance > 0;
    });

    console.log(`[CoinbaseCDP] Filtered EVM token balances: ${filtered.length} out of ${tokenBalances.length}`);
    return filtered;
  } catch (error) {
    console.error('[CoinbaseCDP] Error fetching EVM token balances:', error);
    return [];
  }
}

/**
 * Get Solana token balances for an address
 * @param address - Solana wallet address (Base58 format)
 * @param network - Network name: 'solana' or 'solana-devnet' (default: 'solana')
 */
export async function getSolanaTokenBalances(
  address: string,
  network: string = 'solana'
): Promise<TokenBalance[]> {
  try {
    const apiKeyId = getCoinbaseCdpApiKeyId();
    const apiKeySecret = getCoinbaseCdpApiKeySecret();

    if (!apiKeyId || !apiKeySecret) {
      console.warn('[CoinbaseCDP] API key ID or Secret not configured for Solana');
      return [];
    }

    // Correct endpoint format: /platform/v2/solana/token-balances/{network}/{address}
    const requestPath = `${COINBASE_CDP_API_BASE_URL}/solana/token-balances/${network}/${address}`;
    const url = `https://${COINBASE_CDP_API_HOST}${requestPath}`;

    console.log(`[CoinbaseCDP] Fetching Solana token balances: ${url}`);

    // Generate JWT Bearer Token
    const jwt = await generateCdpJwt(
      apiKeyId,
      apiKeySecret,
      'GET',
      COINBASE_CDP_API_HOST,
      requestPath
    );

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();

      // 500 errors are common for this beta endpoint, log as warn to indicate fallback will be used
      if (response.status >= 500) {
        console.warn(
          `[CoinbaseCDP] Solana API service unavailable (${response.status}). Falling back to Alchemy.`,
          { network, url: url.split('?')[0] }
        );
      } else {
        console.error(
          '[CoinbaseCDP] API error for Solana balances:',
          {
            network,
            url,
            status: response.status,
            statusText: response.statusText,
            errorText: errorText.substring(0, 500),
          }
        );
      }
      return [];
    }

    const data = await response.json() as CoinbaseSolanaTokenBalancesResponse;
    const balances = data.balances || [];

    console.log(`[CoinbaseCDP] Solana token balances response for ${address} on ${network}:`, {
      balancesCount: balances.length,
      balances: balances.slice(0, 5),
    });

    // Convert to TokenBalance format
    const tokenBalances: TokenBalance[] = balances.map((balance) => {
      const decimals = balance.amount.decimals || 9;
      const rawAmount = balance.amount.amount || '0';
      const formattedBalance = formatTokenBalance(rawAmount, decimals);

      return {
        contractAddress: balance.token.mintAddress,
        tokenBalance: formattedBalance,
        symbol: balance.token.symbol,
        name: balance.token.name,
        decimals: decimals,
        logo: undefined, // Coinbase CDP API doesn't provide logo_url in this endpoint
      };
    });

    // Filter out zero balances
    const filtered = tokenBalances.filter((tb) => {
      const balance = parseFloat(tb.tokenBalance);
      return balance > 0;
    });

    console.log(`[CoinbaseCDP] Filtered Solana token balances: ${filtered.length} out of ${tokenBalances.length}`);
    return filtered;
  } catch (error) {
    console.error('[CoinbaseCDP] Error fetching Solana token balances:', error);
    return [];
  }
}

/**
 * Get complete wallet balance (native + tokens) for EVM chains
 * Note: This function does not fetch native balance, only token balances
 * Native balance should be fetched separately using wagmi or other RPC methods
 */
export async function getEvmWalletBalance(
  address: string,
  chainId: number,
  nativeBalanceHex?: string
): Promise<WalletBalance> {
  const tokens = await getEvmTokenBalances(address, chainId);

  // Calculate native balance formatted
  let ethBalanceFormatted = 0;
  if (nativeBalanceHex) {
    try {
      const ethBalanceWei = BigInt(nativeBalanceHex);
      ethBalanceFormatted = Number(ethBalanceWei) / 1e18;
    } catch (error) {
      console.error('[CoinbaseCDP] Error parsing native balance:', error);
    }
  }

  return {
    ethBalance: nativeBalanceHex || '0x0',
    ethBalanceFormatted,
    tokens,
  };
}

/**
 * Get complete wallet balance for Solana
 * Note: This function does not fetch native SOL balance, only SPL token balances
 * Native SOL balance should be fetched separately using Solana RPC
 */
export async function getSolanaWalletBalance(
  address: string,
  nativeBalanceLamports?: string | bigint
): Promise<WalletBalance> {
  const tokens = await getSolanaTokenBalances(address);

  // Calculate native SOL balance formatted
  let ethBalanceFormatted = 0;
  if (nativeBalanceLamports) {
    try {
      const lamports = typeof nativeBalanceLamports === 'bigint'
        ? nativeBalanceLamports
        : BigInt(nativeBalanceLamports);
      ethBalanceFormatted = Number(lamports) / 1e9;
    } catch (error) {
      console.error('[CoinbaseCDP] Error parsing native SOL balance:', error);
    }
  }

  return {
    ethBalance: nativeBalanceLamports?.toString() || '0',
    ethBalanceFormatted,
    tokens,
  };
}

