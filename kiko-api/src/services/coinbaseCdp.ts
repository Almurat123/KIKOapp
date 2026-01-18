/**
 * Coinbase CDP API Service
 * Documentation:
 * - EVM: https://docs.cdp.coinbase.com/api-reference/v2/rest-api/evm-token-balances/list-evm-token-balances
 * - Solana: https://docs.cdp.coinbase.com/api-reference/v2/rest-api/solana-token-balances/list-solana-token-balances
 */

import { env } from '../config/env.js';
import type { TokenBalance, WalletBalance } from './alchemy.js';
import { logger } from '../utils/logger.js';
import { getSolanaTokenMetadata } from '../utils/solanaToken.js';
import { LogCode } from '../config/logRegistry.js';

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
  } catch (error: any) {
    logger.error(LogCode.SYS_ERROR, 'CoinbaseCDP: Error generating JWT', { error: error.message });
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
  } catch (error: any) {
    logger.error(LogCode.SYS_ERROR, 'CoinbaseCDP: Error formatting balance', { error: error.message });
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
      logger.warn(LogCode.SYS_INFO, 'CoinbaseCDP: API key not configured');
      return [];
    }

    // Convert chain ID to network name for API
    // Supported networks: base, base-sepolia, ethereum
    const network = CHAIN_ID_MAP[chainId];

    if (!network) {
      logger.warn(LogCode.SYS_INFO, 'CoinbaseCDP: Chain ID not supported', { chainId });
      return [];
    }

    // Correct endpoint format: /platform/v2/evm/token-balances/{network}/{address}
    const requestPath = `${COINBASE_CDP_API_BASE_URL}/evm/token-balances/${network}/${address}`;
    const url = `https://${COINBASE_CDP_API_HOST}${requestPath}`;

    logger.debug(LogCode.SYS_INFO, 'CoinbaseCDP: Fetching EVM balances', { chainId, network });

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
      logger.error(LogCode.API_FETCH_FAILED, 'CoinbaseCDP API error (EVM)', {
        chainId,
        network,
        status: response.status,
        error: errorText.substring(0, 500),
      });
      return [];
    }

    const data = await response.json() as CoinbaseEvmTokenBalancesResponse;
    const balances = data.balances || [];

    logger.debug(LogCode.SYS_INFO, 'CoinbaseCDP: Received EVM balances', { count: balances.length });

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

    logger.debug(LogCode.SYS_INFO, 'CoinbaseCDP: Filtered EVM balances', { count: filtered.length });
    return filtered;
  } catch (error: any) {
    logger.error(LogCode.SYS_ERROR, 'CoinbaseCDP: Error fetching EVM balances', { error: error.message });
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
      logger.warn(LogCode.SYS_INFO, 'CoinbaseCDP: API key not configured for Solana');
      return [];
    }

    // Correct endpoint format: /platform/v2/solana/token-balances/{network}/{address}
    const requestPath = `${COINBASE_CDP_API_BASE_URL}/solana/token-balances/${network}/${address}`;
    const url = `https://${COINBASE_CDP_API_HOST}${requestPath}`;

    logger.debug(LogCode.SYS_INFO, 'CoinbaseCDP: Fetching Solana balances', { network });

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
        logger.warn(LogCode.API_FETCH_FAILED, 'CoinbaseCDP: Solana API unavailable, falling back', { network, status: response.status });
      } else {
        logger.error(LogCode.API_FETCH_FAILED, 'CoinbaseCDP: Solana API error', {
          network,
          status: response.status,
          error: errorText.substring(0, 500),
        });
      }
      return [];
    }

    const data = await response.json() as CoinbaseSolanaTokenBalancesResponse;
    const balances = data.balances || [];

    logger.debug(LogCode.SYS_INFO, 'CoinbaseCDP: Received Solana balances', { count: balances.length });

    // Convert to TokenBalance format
    const tokenBalances: TokenBalance[] = await Promise.all(balances.map(async (balance) => {
      const mint = balance.token.mintAddress;
      let decimals = balance.amount.decimals;
      let symbol = balance.token.symbol;
      let name = balance.token.name;

      if (decimals === undefined || !symbol || !name) {
        const meta = await getSolanaTokenMetadata(mint);
        decimals = decimals ?? meta?.decimals;
        symbol = symbol || meta?.symbol;
        name = name || meta?.name;
      }

      const finalDecimals = decimals ?? 9;
      const rawAmount = balance.amount.amount || '0';
      const formattedBalance = formatTokenBalance(rawAmount, finalDecimals);

      return {
        contractAddress: mint,
        tokenBalance: formattedBalance,
        symbol: symbol || 'UNKNOWN',
        name: name || 'Unknown Token',
        decimals: finalDecimals,
        logo: undefined, // Coinbase CDP API doesn't provide logo_url in this endpoint
      };
    }));

    // Filter out zero balances
    const filtered = tokenBalances.filter((tb) => {
      const balance = parseFloat(tb.tokenBalance);
      return balance > 0;
    });

    logger.debug(LogCode.SYS_INFO, 'CoinbaseCDP: Filtered Solana balances', { count: filtered.length });
    return filtered;
  } catch (error: any) {
    logger.error(LogCode.SYS_ERROR, 'CoinbaseCDP: Error fetching Solana balances', { error: error.message });
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
    } catch (error: any) {
      logger.error(LogCode.SYS_ERROR, 'CoinbaseCDP: Error parsing native balance', { error: error.message });
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
    } catch (error: any) {
      logger.error(LogCode.SYS_ERROR, 'CoinbaseCDP: Error parsing native SOL balance', { error: error.message });
    }
  }

  return {
    ethBalance: nativeBalanceLamports?.toString() || '0',
    ethBalanceFormatted,
    tokens,
  };
}
