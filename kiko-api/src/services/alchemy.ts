/**
 * Alchemy API Service
 * Fetches wallet transactions, balances, and token transfers
 * Now uses RPC Manager for failover and Helius for Solana history
 */

import { env } from '../config/env.js';
import * as rpcManager from './rpcManager.js';
import * as helius from './helius.js';
import * as scanApi from './scanApi.js';
import * as solscan from './solscan.js';
import * as dexscreener from './dexscreener.js';
import * as geckoTerminal from './geckoTerminal.js';
import { getSolanaTokenMetadata } from '../utils/solanaToken.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

// Alchemy network endpoints
const ALCHEMY_NETWORKS: Record<string, string> = {
  eth: 'eth-mainnet',
  base: 'base-mainnet',
  arbitrum: 'arb-mainnet',
  optimism: 'opt-mainnet',
  polygon: 'polygon-mainnet',
  bsc: 'bnb-mainnet',
  solana: 'solana-mainnet',
  sol: 'solana-mainnet',
};

// Known SPL Token Metadata Cache (to avoid "Unknown Token")
const SPL_TOKEN_METADATA: Record<string, { symbol: string; name: string; decimals: number }> = {
  'So11111111111111111111111111111111111111112': { symbol: 'WSOL', name: 'Wrapped SOL', decimals: 9 },
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', name: 'Tether USD', decimals: 6 },
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': { symbol: 'JUP', name: 'Jupiter', decimals: 6 },
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': { symbol: 'mSOL', name: 'Marinade Staked SOL', decimals: 9 },
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': { symbol: 'BONK', name: 'Bonk', decimals: 5 },
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3': { symbol: 'PYTH', name: 'Pyth Network', decimals: 6 },
  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': { symbol: 'ETH', name: 'Wrapped Ether (Wormhole)', decimals: 8 },
  'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1': { symbol: 'bSOL', name: 'BlazeStake Staked SOL', decimals: 9 },
  'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn': { symbol: 'jitoSOL', name: 'Jito Staked SOL', decimals: 9 },
  'RLBxxFkseAZ4RgJH3Sqn8jXxhmGoz9jWxDNJMh8pL7a': { symbol: 'RLB', name: 'Rollbit Coin', decimals: 2 },
  'WENWENvqqNya429ubCdR81ZmD69brwQaaBYY6p3LCpk': { symbol: 'WEN', name: 'Wen', decimals: 5 },
  'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof': { symbol: 'RNDR', name: 'Render Token', decimals: 8 },
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': { symbol: 'RAY', name: 'Raydium', decimals: 6 },
  'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE': { symbol: 'ORCA', name: 'Orca', decimals: 6 },
  'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt': { symbol: 'SRM', name: 'Serum', decimals: 6 },
  'MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey': { symbol: 'MNDE', name: 'Marinade', decimals: 9 },
  '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj': { symbol: 'stSOL', name: 'Lido Staked SOL', decimals: 9 },
  'AFbX8oGjGpmVFywbVouvhQSRmiW2aR1mohfahi4Y2AdB': { symbol: 'GST', name: 'Green Satoshi Token', decimals: 9 },
  'kinXdEcpDQeHPEuQnqmUgtYykqKGVFq6CeVX5iAHJq6': { symbol: 'KIN', name: 'Kin', decimals: 5 },
};

/**
 * Get SPL token symbol from mint address
 * Uses local cache first, then returns shortened address as fallback
 */
function getSplTokenSymbol(mint: string): string {
  const cached = SPL_TOKEN_METADATA[mint];
  if (cached) return cached.symbol;

  // Return shortened mint address as fallback (first 4 + last 4 chars)
  return mint.slice(0, 4) + '...' + mint.slice(-4);
}


// Get Alchemy API key
const getAlchemyApiKey = () => {
  const key = env.apiKeys.alchemy || process.env.ALCHEMY_API_KEY || '';
  // Security: API key logging removed to prevent exposure
  return key;
};

// Build RPC URL for a specific network
const getAlchemyUrl = (chain: string = 'eth') => {
  const chainLower = chain.toLowerCase();
  const network = ALCHEMY_NETWORKS[chainLower] || ALCHEMY_NETWORKS.eth;
  const apiKey = getAlchemyApiKey();
  return `https://${network}.g.alchemy.com/v2/${apiKey}`;
};

// ============ Types ============

export interface AssetTransfer {
  blockNum: string;
  hash: string;
  from: string;
  to: string;
  value: number | null;
  asset: string | null;
  category: 'external' | 'internal' | 'erc20' | 'erc721' | 'erc1155' | 'specialnft';
  rawContract: {
    value: string | null;
    address: string | null;
    decimal: string | null;
  };
  metadata?: {
    blockTimestamp: string;
  };
}

export interface WalletTransaction {
  txHash: string;
  txType: 'BUY' | 'SELL' | 'SWAP' | 'APPROVE' | 'TRANSFER_IN' | 'TRANSFER_OUT';
  fromAddress: string;
  toAddress: string;
  tokenSymbol: string | null;
  tokenAddress: string | null;
  tokenInSymbol?: string;
  tokenOutSymbol?: string;
  amount: string;
  valueUsd: number | null;
  blockNumber: number;
  blockTimestamp: Date;
  chain: string;
}

export interface TokenBalance {
  contractAddress: string;
  tokenBalance: string;
  symbol?: string;
  name?: string;
  decimals?: number;
  logo?: string;
  price?: number;
  valueUsd?: number;
}

export interface WalletBalance {
  ethBalance: string;
  ethBalanceFormatted: number;
  ethPrice?: number;
  tokens: TokenBalance[];
}

// Infura network endpoints
const INFURA_NETWORKS: Record<string, string> = {
  eth: 'mainnet',
  base: 'base-mainnet',
  arbitrum: 'arbitrum-mainnet',
  optimism: 'optimism-mainnet',
  polygon: 'polygon-mainnet',
};

// Get Infura API key
const getInfuraApiKey = () => {
  return process.env.INFURA_API_KEY || '';
};

// Build Infura RPC URL
const getInfuraUrl = (chain: string = 'eth') => {
  const chainLower = chain.toLowerCase();
  const network = INFURA_NETWORKS[chainLower];
  if (!network) return null;
  const apiKey = getInfuraApiKey();
  if (!apiKey) return null;
  return `https://${network}.infura.io/v3/${apiKey}`;
};

// ============ API Functions ============

/**
 * Fetch asset transfers (transactions) for a wallet address
 * Includes Infura fallback for EVM chains
 */
export async function getAssetTransfers(
  address: string | null,
  chain: string = 'eth',
  options: {
    fromBlock?: string;
    toBlock?: string;
    maxCount?: number;
    category?: ('external' | 'internal' | 'erc20' | 'erc721' | 'erc1155')[];
    order?: 'asc' | 'desc';
    contractAddresses?: string[];
  } = {}
): Promise<AssetTransfer[]> {
  const tryAlchemy = async () => {
    try {
      const url = getAlchemyUrl(chain);
      const apiKey = getAlchemyApiKey();

      if (!apiKey) {
        logger.error(LogCode.SYS_ERROR, 'Alchemy API key not configured');
        return null;
      }

      const {
        fromBlock = '0x0',
        toBlock = 'latest',
        maxCount = 100,
        category = ['external', 'erc20'],
        order = 'desc',
        contractAddresses = options.contractAddresses,
      } = options;

      // If we only have contractAddresses and no wallet address, we do one call
      if (!address && contractAddresses && contractAddresses.length > 0) {
        logger.debug(LogCode.API_FETCH_SUCCESS, 'Fetching asset transfers for contractAddresses', { count: contractAddresses.length });
        const requestBody = {
          id: 1,
          jsonrpc: '2.0',
          method: 'alchemy_getAssetTransfers',
          params: [{
            fromBlock,
            toBlock,
            contractAddresses,
            category,
            maxCount: `0x${maxCount.toString(16)}`,
            order,
            withMetadata: true,
          }],
        };
        logger.debug(LogCode.API_FETCH_SUCCESS, 'Alchemy request body', { method: 'alchemy_getAssetTransfers', id: 1 });

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        if (!response.ok) {
          const err = await response.text();
          logger.error(LogCode.API_FETCH_FAILED, 'Alchemy API error', { status: response.status, error: err.substring(0, 200) });
          return null;
        }
        const data = await response.json() as { result?: { transfers: AssetTransfer[] }, error?: any };
        if (data.error) {
          logger.error(LogCode.API_FETCH_FAILED, 'Alchemy RPC Error', { error: data.error });
        }
        logger.info(LogCode.API_FETCH_SUCCESS, 'Alchemy transfers received', { count: data.result?.transfers?.length || 0 });
        return data.result?.transfers || [];
      }

      // Otherwise, follow the original logic (incoming + outgoing for a wallet)
      if (!address) return [];

      // Fetch transfers TO the address (incoming)
      const incomingResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 1,
          jsonrpc: '2.0',
          method: 'alchemy_getAssetTransfers',
          params: [{
            fromBlock,
            toBlock,
            toAddress: address,
            category,
            contractAddresses,
            maxCount: `0x${maxCount.toString(16)}`,
            order,
            withMetadata: true,
          }],
        }),
      });

      // Fetch transfers FROM the address (outgoing)
      const outgoingResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 2,
          jsonrpc: '2.0',
          method: 'alchemy_getAssetTransfers',
          params: [{
            fromBlock,
            toBlock,
            fromAddress: address,
            category,
            contractAddresses,
            maxCount: `0x${maxCount.toString(16)}`,
            order,
            withMetadata: true,
          }],
        }),
      });

      if (!incomingResponse.ok || !outgoingResponse.ok) {
        logger.error(LogCode.API_FETCH_FAILED, 'Failed to fetch asset transfers from Alchemy', {
          incomingStatus: incomingResponse.status,
          outgoingStatus: outgoingResponse.status
        });
        return null;
      }

      const incomingData = await incomingResponse.json() as { result?: { transfers: AssetTransfer[] } };
      const outgoingData = await outgoingResponse.json() as { result?: { transfers: AssetTransfer[] } };

      const incomingTransfers: AssetTransfer[] = incomingData.result?.transfers || [];
      const outgoingTransfers: AssetTransfer[] = outgoingData.result?.transfers || [];

      return [...incomingTransfers, ...outgoingTransfers];
    } catch (e: any) {
      logger.error(LogCode.API_FETCH_FAILED, 'Error fetching asset transfers from Alchemy', { error: e.message });
      return null;
    }
  };

  const tryScanApi = async () => {
    // If no address, Scan API (Etherscan) usually can't do generic tokentx without it
    if (!address) {
      logger.warn(LogCode.API_FETCH_FAILED, 'Scan API requires a wallet address');
      return [];
    }
    // Use Etherscan-compatible Scan API for EVM history
    logger.debug(LogCode.API_FETCH_SUCCESS, 'Using Scan API for background history', { chain });

    // We need both native and token transfers to match Alchemy's getAssetTransfers behavior
    // 1. Get Native Transactions
    const nativeTxs = await scanApi.getEvmTransactions(address, chain, 1, options.maxCount || 50);

    // 2. Get Token Transfers (if requested in category)
    let tokenTxs: WalletTransaction[] = [];
    if (options.category?.includes('erc20')) {
      tokenTxs = await scanApi.getEvmTokenTransfers(address, chain, 1, options.maxCount || 50);
    }

    // Convert WalletTransaction back to AssetTransfer format (to match existing return type of this function)
    // or we should update calling code.
    // However, existing calling code expects AssetTransfer[] from this specific function.
    // Let's allow this function to remain for backward compat, but implement the conversion.

    const allTxs = [...nativeTxs, ...tokenTxs];

    return allTxs.map(tx => ({
      blockNum: `0x${tx.blockNumber.toString(16)}`,
      hash: tx.txHash,
      from: tx.fromAddress,
      to: tx.toAddress,
      value: parseFloat(tx.amount),
      asset: tx.tokenSymbol,
      category: tx.tokenAddress ? 'erc20' : 'external',
      rawContract: {
        value: null, // approximated
        address: tx.tokenAddress,
        decimal: null
      },
      metadata: {
        blockTimestamp: tx.blockTimestamp.toISOString()
      }
    } as AssetTransfer));
  };

  const isSolana = chain.toLowerCase() === 'solana' || chain.toLowerCase() === 'sol';
  if (isSolana) {
    // For Solana history, use standard RPC methods
    return []; // Handled in getWalletTransactions directly
  }


  // For EVM history, we prefer Scan API if we have a wallet address
  // But for contract-only searches (early buyers), we MUST use Alchemy
  let transfers: AssetTransfer[] = [];
  const wantsInternal = options.category?.includes('internal') === true;
  const wantsContractFilter = Array.isArray(options.contractAddresses) && options.contractAddresses.length > 0;
  const canUseScanApi = !!address && !wantsInternal && !wantsContractFilter;

  if (canUseScanApi) {
    try {
      transfers = await tryScanApi();
    } catch (e: any) {
      logger.warn(LogCode.API_FETCH_FAILED, 'Scan API failed, falling back to direct Alchemy', { error: e.message });
      transfers = [];
    }
  }

  // If Scan API didn't give results OR we don't have an address, use Alchemy
  if (!transfers || transfers.length === 0) {
    const alchemyTransfers = await tryAlchemy();
    if (alchemyTransfers) transfers = alchemyTransfers;
  }

  if (!transfers) return [];

  const { maxCount = 100, order = 'desc' } = options;

  // Combination and sorting logic
  transfers.sort((a, b) => {
    const blockA = parseInt(a.blockNum, 16);
    const blockB = parseInt(b.blockNum, 16);
    return order === 'desc' ? blockB - blockA : blockA - blockB;
  });

  // Remove duplicates
  const seen = new Set<string>();
  const uniqueTransfers = transfers.filter(t => {
    const key = `${t.hash}-${t.from}-${t.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return uniqueTransfers.slice(0, maxCount);
}

/**
 * Known DEX router addresses for detecting swap transactions
 * These are common DEX router contracts that handle swaps
 */
const KNOWN_DEX_ROUTERS: Record<string, string[]> = {
  'eth': [
    '0x7a250d5630b4cf539739df2c5dacb4c659f2488d', // Uniswap V2 Router
    '0xe592427a0aece92de3edee1f18e0157c05861564', // Uniswap V3 Router
    '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45', // Uniswap V3 Router 2
    '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f', // SushiSwap Router
    '0x1111111254fb6c44bac0bed2854e76f90643097d', // 1inch V5 Router
    '0x1111111254eeb25477b68fb85ed929f73a960582', // 1inch V4 Router
    '0xdef1c0ded9bec7f1a1670819833240f027b25eff', // 0x Exchange Proxy
    '0xdef189deaef76e379df891899eb5a00a94cbc250', // 0x Exchange Proxy (old)
    '0x881d40237659c251811cec9c364ef91dc08d300c', // Metamask Swap Router
    '0x6352a56caadc4f1e25cd6c75970fa768a3304e64', // OpenOcean Router
  ],
  'base': [
    '0x2626664c2603336e57b271c5c0b26f421741e481', // Uniswap V3 Router (Base)
    '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24', // BaseSwap Router
    '0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43', // Aerodrome Router
    '0x1111111254eeb25477b68fb85ed929f73a960582', // 1inch Router
    '0xdef1c0ded9bec7f1a1670819833240f027b25eff', // 0x Exchange Proxy
  ],
  'arbitrum': [
    '0xe592427a0aece92de3edee1f18e0157c05861564', // Uniswap V3 Router
    '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45', // Uniswap V3 Router 2
    '0x1111111254fb6c44bac0bed2854e76f90643097d', // 1inch Router
    '0x1111111254eeb25477b68fb85ed929f73a960582', // 1inch V4 Router
    '0xdef1c0ded9bec7f1a1670819833240f027b25eff', // 0x Exchange Proxy
    '0x1b02da8cb0d097eb8d57a175b88c7d8b47997506', // SushiSwap Router
  ],
  'optimism': [
    '0xe592427a0aece92de3edee1f18e0157c05861564', // Uniswap V3 Router
    '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45', // Uniswap V3 Router 2
    '0x1111111254eeb25477b68fb85ed929f73a960582', // 1inch Router
    '0xdef1c0ded9bec7f1a1670819833240f027b25eff', // 0x Exchange Proxy
  ],
  'polygon': [
    '0x1b02da8cb0d097eb8d57a175b88c7d8b47997506', // SushiSwap Router
    '0xa5e0829caced8ffdd4de3c43696c57f7d7a678ff', // QuickSwap Router
    '0xe592427a0aece92de3edee1f18e0157c05861564', // Uniswap V3 Router
    '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45', // Uniswap V3 Router 2
    '0x1111111254eeb25477b68fb85ed929f73a960582', // 1inch Router
    '0xdef1c0ded9bec7f1a1670819833240f027b25eff', // 0x Exchange Proxy
  ],
  'bsc': [
    '0x10ed43c718714eb63d5aa57b78b54704e256024e', // PancakeSwap V2 Router
    '0x13f4ea83d0bd40e75c8222255bc855a974568dd4', // PancakeSwap V3 Router
    '0x1b02da8cb0d097eb8d57a175b88c7d8b47997506', // SushiSwap Router
    '0x1111111254eeb25477b68fb85ed929f73a960582', // 1inch Router
    '0xdef1c0ded9bec7f1a1670819833240f027b25eff', // 0x Exchange Proxy
    '0x6352a56caadc4f1e25cd6c75970fa768a3304e64', // OpenOcean Router
  ],
};

/**
 * Check if an address is a known DEX router
 */
function isDexRouter(address: string, chain: string): boolean {
  const normalizedAddress = address.toLowerCase();
  const routers = KNOWN_DEX_ROUTERS[chain.toLowerCase()] || [];
  return routers.includes(normalizedAddress);
}

/**
 * Convert raw asset transfers to wallet transactions
 * FIXED: Properly distinguish between DEX swaps (BUY/SELL) and regular transfers (TRANSFER_IN/TRANSFER_OUT)
 */
export function convertToWalletTransactions(
  transfers: AssetTransfer[],
  walletAddress: string,
  chain: string = 'eth'
): WalletTransaction[] {
  const normalizedWallet = walletAddress.toLowerCase();

  return transfers.map(transfer => {
    const isIncoming = transfer.to.toLowerCase() === normalizedWallet;
    const isOutgoing = transfer.from.toLowerCase() === normalizedWallet;

    // Default to TRANSFER_IN for incoming, TRANSFER_OUT for outgoing
    let txType: WalletTransaction['txType'] = isIncoming ? 'TRANSFER_IN' : 'TRANSFER_OUT';

    // Only mark as BUY/SELL if this is a DEX transaction
    // DEX transactions are identified by:
    // 1. The from/to address is a known DEX router
    // 2. It's an ERC20 token transfer (not native ETH)
    if (transfer.category === 'erc20') {
      const fromIsDex = isDexRouter(transfer.from, chain);
      const toIsDex = isDexRouter(transfer.to, chain);

      // If either from or to is a DEX router, it's likely a swap
      if (fromIsDex || toIsDex) {
        if (isIncoming && !isOutgoing) {
          txType = 'BUY'; // Receiving tokens from DEX = buying
        } else if (isOutgoing && !isIncoming) {
          txType = 'SELL'; // Sending tokens to DEX = selling
        }
        // Note: If both from and to are DEX routers, or wallet is in the middle,
        // we keep it as TRANSFER_IN/TRANSFER_OUT to be safe
      }
      // Otherwise, it's a regular token transfer (TRANSFER_IN/TRANSFER_OUT)
    }

    const blockTimestamp = transfer.metadata?.blockTimestamp
      ? new Date(transfer.metadata.blockTimestamp)
      : new Date();

    return {
      txHash: transfer.hash,
      txType,
      fromAddress: transfer.from,
      toAddress: transfer.to,
      tokenSymbol: transfer.asset,
      tokenAddress: transfer.rawContract?.address || null,
      amount: transfer.value?.toString() || '0',
      valueUsd: null,
      blockNumber: parseInt(transfer.blockNum, 16),
      blockTimestamp,
      chain,
    };
  });
}




/**
 * Get balance for a specific Solana SPL token by mint address
 * This is a fallback when getTokenBalances doesn't return the token
 */
export async function getSolanaTokenBalance(walletAddress: string, mintAddress: string): Promise<number> {
  try {
    // Query token accounts by owner, filtered by specific mint
    const result = await rpcManager.callRpc('solana', 'getTokenAccountsByOwner', [
      walletAddress,
      { mint: mintAddress },  // Filter by specific mint address
      { encoding: 'jsonParsed' }
    ]) as { value: Array<{ account: { data: { parsed: { info: any } } } }> } | null;

    if (!result || !result.value || result.value.length === 0) {
      logger.info(LogCode.API_FETCH_SUCCESS, 'No SPL token account found for mint', { mint: mintAddress.slice(0, 10) });
      return 0;
    }

    // Get the first matching token account
    const tokenAccount = result.value[0];
    const info = tokenAccount.account.data.parsed.info;
    const uiAmount = parseFloat(info.tokenAmount.uiAmountString) || 0;

    logger.debug(LogCode.API_FETCH_SUCCESS, 'Direct SPL balance fetched', { mint: mintAddress.slice(0, 10), amount: uiAmount });
    return uiAmount;
  } catch (error: any) {
    logger.error(LogCode.API_FETCH_FAILED, 'Error fetching Solana token balance', { error: error.message, mint: mintAddress.slice(0, 10) });
    return 0;
  }
}

/**
 * Resolve ENS name for an address (reverse lookup)
 */
export async function resolveENSName(address: string): Promise<string | null> {
  try {
    const apiKey = getAlchemyApiKey();
    if (!apiKey) return null;
    const { JsonRpcProvider } = await import('ethers');
    const url = `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`;
    const provider = new JsonRpcProvider(url);
    return await provider.lookupAddress(address);
  } catch (error: any) {
    return null;
  }
}

/**
 * Resolve ENS name to address (forward lookup)
 * Converts names like "vitalik.eth" to "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
 */
export async function resolveENSAddress(ensName: string): Promise<string | null> {
  try {
    // Only process ENS names (ending with .eth)
    if (!ensName.endsWith('.eth')) return null;

    const apiKey = getAlchemyApiKey();
    if (!apiKey) return null;

    const { JsonRpcProvider } = await import('ethers');
    const url = `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`;
    const provider = new JsonRpcProvider(url);
    const address = await provider.resolveName(ensName);
    logger.info(LogCode.API_FETCH_SUCCESS, 'ENS name resolved to address', { ensName, address });
    return address;
  } catch (error: any) {
    logger.error(LogCode.API_FETCH_FAILED, 'Failed to resolve ENS name', { ensName, error: error.message });
    return null;
  }
}


/**
 * Get Solana transaction history using Helius API
 */
async function getSolanaTransactions(address: string, limit: number = 20): Promise<WalletTransaction[]> {
  try {
    // Use Helius if configured, otherwise fallback to basic RPC
    if (helius.isHeliusConfigured()) {
      try {
        const response = await helius.getAddressTransactions(address, limit);

        if (response.transactions && response.transactions.length > 0) {
          return response.transactions.map(tx => {
            // Determine transaction type based on Helius parsed data
            let txType: WalletTransaction['txType'] = 'TRANSFER_OUT';

            // Check if this is a swap
            if (tx.type && (tx.type.includes('SWAP') || tx.type.includes('swap'))) {
              txType = 'SWAP';
            } else if (tx.nativeTransfers && tx.nativeTransfers.length > 0) {
              // Check native transfers
              const transfer = tx.nativeTransfers[0];
              const isIncoming = transfer.toUserAccount.toLowerCase() === address.toLowerCase();
              txType = isIncoming ? 'TRANSFER_IN' : 'TRANSFER_OUT';
            } else if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
              // Check token transfers
              const transfer = tx.tokenTransfers[0];
              const isIncoming = transfer.toUserAccount.toLowerCase() === address.toLowerCase();
              txType = isIncoming ? 'BUY' : 'SELL';
            }

            // Get amount from transfers
            let amount = '0';
            let tokenSymbol = 'SOL';
            let tokenAddress: string | null = null;

            if (tx.nativeTransfers && tx.nativeTransfers.length > 0) {
              amount = (tx.nativeTransfers[0].amount / 1e9).toString();
            } else if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
              const transfer = tx.tokenTransfers[0];
              amount = transfer.tokenAmount.toString();
              tokenAddress = transfer.mint;
              // Token symbol would need additional lookup
            }

            return {
              txHash: tx.signature,
              txType,
              fromAddress: tx.feePayer,
              toAddress: address,
              tokenSymbol,
              tokenAddress,
              amount,
              valueUsd: null,
              blockNumber: tx.slot,
              blockTimestamp: new Date(tx.timestamp * 1000),
              chain: 'solana'
            };
          });
        }
      } catch (err: any) {
        logger.warn(LogCode.API_FETCH_FAILED, 'Solana Helius history failed, trying Solscan', { error: err.message });
      }
    }

    // Try Solscan as backup
    if (solscan.isConfigured()) {
      logger.debug(LogCode.API_FETCH_SUCCESS, 'Trying Solscan backup for Solana history', { address: address.slice(0, 10) });
      try {
        const res = await solscan.getAddressTransactions(address, limit);
        if (res.success && res.data && res.data.length > 0) {
          return res.data.map(tx => ({
            txHash: tx.tx_hash,
            txType: tx.signer.includes(address) ? 'TRANSFER_OUT' : 'TRANSFER_IN',
            fromAddress: tx.signer[0] || '',
            toAddress: address,
            tokenSymbol: 'SOL',
            tokenAddress: null,
            amount: '0',
            valueUsd: null,
            blockNumber: tx.slot,
            blockTimestamp: new Date(tx.block_time * 1000),
            chain: 'solana'
          }));
        }
      } catch (err: any) {
        logger.warn(LogCode.API_FETCH_FAILED, 'Solana Solscan fallback failed', { error: err.message });
      }
    }

    // Fallback to basic RPC if Helius not configured
    logger.warn(LogCode.API_FETCH_FAILED, 'Helius not configured for Solana history, using basic RPC');
    const url = getAlchemyUrl('solana');

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getSignaturesForAddress',
        params: [address, { limit }]
      })
    });

    if (!response.ok) return [];
    const data = await response.json() as { result?: Array<{ signature: string; slot: number; blockTime?: number }> };
    const signatures = data.result || [];

    // Fetch full transaction details
    const txPromises = signatures.map(async (sig) => {
      const txResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 1,
          jsonrpc: '2.0',
          method: 'getTransaction',
          params: [sig.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }]
        })
      });

      if (!txResponse.ok) return null;
      return txResponse.json();
    });

    const txResults = await Promise.all(txPromises);

    const transactions: WalletTransaction[] = [];

    for (const res of txResults) {
      const result = (res as any)?.result;
      if (!result) continue;

      const tx = result;
      const meta = tx.meta;
      const transaction = tx.transaction;

      let tokenSymbol = 'SOL';
      let amount = '0';
      let tokenAddress: string | null = null;
      let isTokenTransfer = false;

      // 1. Check Token Balance Changes (SPL Transfers)
      if (meta && meta.preTokenBalances && meta.postTokenBalances) {
        type TokenBalance = { accountIndex: number; mint: string; uiTokenAmount: { uiAmountString: string; amount: string; decimals: number }; owner: string };

        const preBalances = meta.preTokenBalances as TokenBalance[];
        const postBalances = meta.postTokenBalances as TokenBalance[];
        const changes = new Map<string, number>();
        const mints = new Set<string>();

        preBalances.forEach(b => {
          if (b.owner === address) {
            const val = parseFloat(b.uiTokenAmount.uiAmountString || '0');
            changes.set(b.mint, -val);
            mints.add(b.mint);
          }
        });

        postBalances.forEach(b => {
          if (b.owner === address) {
            const val = parseFloat(b.uiTokenAmount.uiAmountString || '0');
            const current = changes.get(b.mint) || 0;
            changes.set(b.mint, current + val);
            mints.add(b.mint);
          }
        });

        for (const mint of mints) {
          const change = changes.get(mint) || 0;
          if (Math.abs(change) > 0) {
            isTokenTransfer = true;
            amount = Math.abs(change).toString();
            tokenAddress = mint;
            tokenSymbol = getSplTokenSymbol(mint);

            break;
          }
        }
      }

      // Determine Signer (From Address)
      const accountKeys = transaction.message.accountKeys;
      // accountKeys can be string[] (parsed) or object[] depending on RPC version
      const signer = typeof accountKeys[0] === 'string' ? accountKeys[0] : accountKeys[0].pubkey;
      const isOutgoing = signer === address;

      // 2. If no token transfer, check Native SOL change
      if (!isTokenTransfer && meta && meta.preBalances && meta.postBalances) {
        // Flatten account keys to just strings for finding index
        const keys = accountKeys.map((k: any) => typeof k === 'string' ? k : k.pubkey);
        const userIndex = keys.findIndex((k: string) => k === address);

        if (userIndex !== -1) {
          const pre = meta.preBalances[userIndex];
          const post = meta.postBalances[userIndex];
          const changeLamports = post - pre;

          if (changeLamports !== 0) {
            amount = Math.abs(changeLamports / 1e9).toString();
            // This covers includes gas, so even sending 0 SOL will show gas cost. 
            // For now, accept it as better than nothing.
          }
        }
      }

      // Determine Tx Type
      let txType: WalletTransaction['txType'] = isOutgoing ? 'TRANSFER_OUT' : 'TRANSFER_IN';

      transactions.push({
        txHash: transaction.signatures[0],
        txType,
        fromAddress: signer,
        toAddress: isOutgoing ? 'Unknown' : address,
        tokenSymbol,
        tokenAddress,
        amount,
        valueUsd: null,
        blockNumber: tx.slot,
        blockTimestamp: tx.blockTime ? new Date(tx.blockTime * 1000) : new Date(),
        chain: 'solana'
      });
    }

    // Deduplicate transactions by txHash (in case of RPC returning duplicates)
    const uniqueTxs = Array.from(
      new Map(transactions.map(tx => [tx.txHash, tx])).values()
    );

    // Enrich transactions with price data (calculate valueUsd)
    // Collect unique token addresses that aren't native SOL
    const tokenAddresses = [...new Set(
      uniqueTxs
        .filter(tx => tx.tokenAddress && tx.tokenSymbol !== 'SOL')
        .map(tx => tx.tokenAddress!)
    )];

    // Batch fetch prices for all unique tokens (limit to 5 to avoid slow responses)
    const priceMap = new Map<string, number>();

    if (tokenAddresses.length > 0) {
      const tokensToFetch = tokenAddresses.slice(0, 5); // Limit to avoid timeout

      logger.debug(LogCode.API_FETCH_SUCCESS, 'Fetching Solana prices for history enrichment', { count: tokensToFetch.length });

      await Promise.allSettled(
        tokensToFetch.map(async (addr) => {
          try {
            const details = await dexscreener.getTokenDetails('solana', addr);
            if (details && details.price > 0) {
              priceMap.set(addr, details.price);
              logger.debug(LogCode.API_FETCH_SUCCESS, 'Solana history price fetched', { symbol: details.symbol || addr, price: details.price });
            }
          } catch (e) {
            // Ignore price fetch errors
          }
        })
      );
    }

    // Add SOL price (fetch once)
    try {
      const solDetails = await dexscreener.getTokenDetails('solana', 'So11111111111111111111111111111111111111112');
      if (solDetails && solDetails.price > 0) {
        priceMap.set('SOL', solDetails.price);
      }
    } catch (e) {
      // Use fallback
      priceMap.set('SOL', 150); // Rough fallback
    }

    // Enrich transactions with valueUsd
    for (const tx of uniqueTxs) {
      const amount = parseFloat(tx.amount) || 0;
      if (amount > 0) {
        if (tx.tokenSymbol === 'SOL' || !tx.tokenAddress) {
          const solPrice = priceMap.get('SOL') || 150;
          tx.valueUsd = amount * solPrice;
        } else if (tx.tokenAddress && priceMap.has(tx.tokenAddress)) {
          tx.valueUsd = amount * priceMap.get(tx.tokenAddress)!;
        }
      }
    }

    return uniqueTxs;
  } catch (error: any) {
    logger.error(LogCode.API_FETCH_FAILED, 'Solana transaction history error', { error: error.message });
    return [];
  }
}

/**
 * Get recent transactions for a wallet (formatted for feed display)
 */
export async function getWalletTransactions(
  address: string,
  chainOrOptions: string | { chain: string; limit?: number } = 'eth',
  limitArg: number = 50
): Promise<WalletTransaction[]> {
  // Normalize arguments
  let chain = 'eth';
  let limit = limitArg;

  if (typeof chainOrOptions === 'object') {
    chain = chainOrOptions.chain || 'eth';
    limit = chainOrOptions.limit || limitArg;
  } else {
    chain = chainOrOptions;
  }

  logger.debug(LogCode.API_FETCH_SUCCESS, 'Fetching wallet transactions', { address: address.slice(0, 10), chain, limit });
  const isSolana = chain.toLowerCase() === 'solana' || chain.toLowerCase() === 'sol';

  if (isSolana) {
    const solTxs = await getSolanaTransactions(address, limit);
    logger.info(LogCode.API_FETCH_SUCCESS, 'Solana transactions fetched', { count: solTxs.length });
    return solTxs;
  }

  // Use Alchemy's getAssetTransfers API for EVM chains (more accurate)
  try {
    logger.debug(LogCode.API_FETCH_SUCCESS, 'Using Alchemy Asset Transfers', { chain });

    // Fetch asset transfers using Alchemy API
    const transfers = await getAssetTransfers(address, chain, {
      maxCount: limit,
      category: ['external', 'erc20'],
      order: 'desc',
    });

    if (!transfers || transfers.length === 0) {
      logger.info(LogCode.API_FETCH_SUCCESS, 'No transfers found on Alchemy, trying ScanAPI fallback', { chain });
      throw new Error('No transfers from Alchemy, trying fallback');
    }

    // Data format debugging logs removed in favor of structured logging above

    // Convert to WalletTransaction format
    let transactions = convertToWalletTransactions(transfers, address, chain);

    // Converted transaction debugging logs removed

    // Filter out spam/scam tokens
    transactions = transactions.filter(tx => {
      // Keep native transfers
      if (!tx.tokenAddress) return true;

      const symbol = tx.tokenSymbol || '';
      const suspiciousPatterns = [
        'visit', 'claim', 'reward', 'airdrop', 'bonus',
        'http', 'www', '.com', 'free', 'winner', 'unknown'
      ];

      // Skip if symbol is suspicious
      if (!symbol || symbol.length > 20) return false;
      const lowerSymbol = symbol.toLowerCase();
      if (suspiciousPatterns.some(p => lowerSymbol.includes(p))) return false;

      return true;
    });

    logger.info(LogCode.API_FETCH_SUCCESS, 'Wallet transactions filtered and ready', { count: transactions.length });
    return transactions;

  } catch (error) {
    console.warn(`[Alchemy] getAssetTransfers failed, falling back to ScanAPI:`, error);

    // Fallback to Scan API only if Alchemy fails
    try {
      const scanApi = await import('./scanApi.js');

      // Fetch both native and token transactions in parallel
      const [nativeTxs, tokenTxs] = await Promise.all([
        scanApi.getEvmTransactions(address, chain, 1, limit).catch(err => {
          logger.warn(LogCode.API_FETCH_FAILED, 'ScanAPI fetch native txs failed', { error: err.message });
          return [];
        }),
        scanApi.getEvmTokenTransfers(address, chain, 1, limit).catch(err => {
          logger.warn(LogCode.API_FETCH_FAILED, 'ScanAPI fetch token transfers failed', { error: err.message });
          return [];
        })
      ]);

      // Merge and Deduplicate
      const txMap = new Map<string, WalletTransaction>();

      // 1. Add Native Txs first
      for (const tx of nativeTxs) {
        txMap.set(tx.txHash, tx);
      }

      // 2. Overlay Token Txs (Prioritize them for display info)
      for (const tx of tokenTxs) {
        if (txMap.has(tx.txHash)) {
          const existing = txMap.get(tx.txHash)!;
          if (existing.amount === '0' || existing.amount === '0.0') {
            txMap.set(tx.txHash, tx);
          } else {
            txMap.set(tx.txHash, tx);
          }
        } else {
          txMap.set(tx.txHash, tx);
        }
      }

      // Convert back to array
      const mergedTxs = Array.from(txMap.values());

      // Sort by timestamp descending
      mergedTxs.sort((a, b) => b.blockTimestamp.getTime() - a.blockTimestamp.getTime());

      // Slice to limit
      return mergedTxs.slice(0, limit);

    } catch (scanError: any) {
      logger.error(LogCode.API_FETCH_FAILED, 'Both Alchemy and ScanAPI failed for wallet transactions', { error: scanError.message });
      return [];
    }
  }
}

/**
 * Get transactions for multiple wallets (for feed)
 */
export async function getMultiWalletTransactions(
  addresses: string[],
  chain: string = 'eth',
  limitPerWallet: number = 20
): Promise<WalletTransaction[]> {
  const allTransactions: WalletTransaction[] = [];
  const batchSize = 5;
  for (let i = 0; i < addresses.length; i += batchSize) {
    const batch = addresses.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(addr => getWalletTransactions(addr, chain, limitPerWallet))
    );
    results.forEach(txs => allTransactions.push(...txs));
  }
  allTransactions.sort((a, b) =>
    b.blockTimestamp.getTime() - a.blockTimestamp.getTime()
  );
  return allTransactions;
}

/**
 * Get token metadata (name, symbol, decimals, logo)
 */
export async function getTokenMetadata(chain: string, address: string): Promise<any> {
  const url = getAlchemyUrl(chain);
  const body = {
    jsonrpc: '2.0',
    id: 1,
    method: 'alchemy_getTokenMetadata',
    params: [address]
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (response.ok) {
      const json = await response.json();
      return json.result;
    }
  } catch (e: any) {
    logger.error(LogCode.API_FETCH_FAILED, 'Error fetching token metadata from Alchemy', { error: e.message, address });
  }
  return null;
}

const STABLECOIN_SYMBOLS = new Set([
  'USDC',
  'USDBC',
  'USDT',
  'DAI',
  'FRAX',
  'TUSD',
  'FDUSD',
  'USDE',
  'USD',
]);

function getStablecoinPrice(symbol?: string): number | undefined {
  if (!symbol) return undefined;
  return STABLECOIN_SYMBOLS.has(symbol.toUpperCase()) ? 1 : undefined;
}

async function fetchSolanaTokenAccounts(address: string): Promise<TokenBalance[]> {
  try {
    const alchemyUrl = getAlchemyUrl('solana');
    const response = await fetch(alchemyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenAccountsByOwner',
        params: [
          address,
          { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
          { encoding: 'jsonParsed' },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Alchemy Solana RPC ${response.status}`);
    }

    const json = await response.json() as { result?: { value?: Array<{ account?: { data?: { parsed?: { info?: any } } } }> } };
    const result = json?.result;
    if (!result) {
      throw new Error('Alchemy Solana RPC missing result');
    }

    const accounts = result?.value || [];
    const tokens: TokenBalance[] = [];

    for (const entry of accounts) {
      const info = entry?.account?.data?.parsed?.info;
      const mint = info?.mint as string | undefined;
      const amountInfo = info?.tokenAmount;
      const uiAmountString = amountInfo?.uiAmountString as string | undefined;
      const decimals = typeof amountInfo?.decimals === 'number' ? amountInfo.decimals : 0;

      if (!mint || !uiAmountString || uiAmountString === '0') continue;

      const known = SPL_TOKEN_METADATA[mint];
      let symbol: string | undefined = known?.symbol;
      let name: string | undefined = known?.name;

      if (!symbol) {
        const meta = await getSolanaTokenMetadata(mint);
        symbol = meta?.symbol;
        name = meta?.name;
      }

      tokens.push({
        contractAddress: mint,
        tokenBalance: uiAmountString,
        symbol: symbol || 'UNKNOWN',
        name: name || 'Unknown Token',
        decimals,
      });
    }

    return tokens;
  } catch (error: any) {
    logger.warn(LogCode.API_FETCH_FAILED, 'Solana token account fallback failed', {
      error: error.message,
      address: address.slice(0, 10),
    });
    try {
      const result = await rpcManager.callRpc('solana', 'getTokenAccountsByOwner', [
        address,
        { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
        { encoding: 'jsonParsed' },
      ]) as { value?: Array<{ account?: { data?: { parsed?: { info?: any } } } }> };

      const accounts = result?.value || [];
      const tokens: TokenBalance[] = [];
      for (const entry of accounts) {
        const info = entry?.account?.data?.parsed?.info;
        const mint = info?.mint as string | undefined;
        const amountInfo = info?.tokenAmount;
        const uiAmountString = amountInfo?.uiAmountString as string | undefined;
        const decimals = typeof amountInfo?.decimals === 'number' ? amountInfo.decimals : 0;

        if (!mint || !uiAmountString || uiAmountString === '0') continue;

        const known = SPL_TOKEN_METADATA[mint];
        let symbol: string | undefined = known?.symbol;
        let name: string | undefined = known?.name;

        if (!symbol) {
          const meta = await getSolanaTokenMetadata(mint);
          symbol = meta?.symbol;
          name = meta?.name;
        }

        tokens.push({
          contractAddress: mint,
          tokenBalance: uiAmountString,
          symbol: symbol || 'UNKNOWN',
          name: name || 'Unknown Token',
          decimals,
        });
      }
      return tokens;
    } catch (rpcError: any) {
      logger.warn(LogCode.API_FETCH_FAILED, 'Solana token account RPC fallback failed', {
        error: rpcError.message,
        address: address.slice(0, 10),
      });
      return [];
    }
  }
}

const PRICE_CACHE_TTL_MS = 2 * 60 * 1000;
const MAX_FALLBACK_TOKENS = 20;
const MAX_PRICE_TOKENS_SOLANA = 25;
const SOL_BALANCE_CACHE_TTL_MS = 60 * 1000;
const PORTFOLIO_TIMEOUT_MS = 12_000;
const METADATA_TIMEOUT_MS = 6_000;
const PRICE_TIMEOUT_MS = 8_000;
const MAX_METADATA_TOKENS_EVM = 80;
const MAX_PRICE_TOKENS_EVM = 120;
const tokenPriceCache = new Map<string, { price: number; timestamp: number }>();
const tokenPriceInFlight = new Map<string, Promise<number | undefined>>();
const solanaBalanceCache = new Map<string, { tokens: TokenBalance[]; nativeBalance?: number; timestamp: number }>();

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function priceCacheKey(chain: string, address: string): string {
  return `${chain.toLowerCase()}:${address.toLowerCase()}`;
}

function getCachedTokenPrice(chain: string, address: string): number | undefined {
  const key = priceCacheKey(chain, address);
  const cached = tokenPriceCache.get(key);
  if (!cached) return undefined;
  if (Date.now() - cached.timestamp > PRICE_CACHE_TTL_MS) {
    tokenPriceCache.delete(key);
    return undefined;
  }
  return cached.price;
}

function setCachedTokenPrice(chain: string, address: string, price: number) {
  const key = priceCacheKey(chain, address);
  tokenPriceCache.set(key, { price, timestamp: Date.now() });
}

async function fetchAlchemyPricesByAddress(
  apiKey: string,
  network: string,
  addresses: string[]
): Promise<Record<string, number>> {
  if (!apiKey || addresses.length === 0) return {};
  const url = `https://api.g.alchemy.com/prices/v1/${apiKey}/tokens/by-address`;
  const body = {
    addresses: addresses.map(address => ({ network, address })),
  };

  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    }, PRICE_TIMEOUT_MS);

    if (!response.ok) return {};
    const json = await response.json();
    if (!Array.isArray(json?.data)) return {};

    const results: Record<string, number> = {};
    json.data.forEach((entry: any) => {
      const address = entry?.address?.toLowerCase();
      const prices = Array.isArray(entry?.prices) ? entry.prices : [];
      const usd = prices.find((p: any) => String(p?.currency || '').toUpperCase() === 'USD');
      const value = usd?.value ? parseFloat(usd.value) : undefined;
      if (address && typeof value === 'number' && !Number.isNaN(value) && value > 0) {
        results[address] = value;
      }
    });

    return results;
  } catch (e: any) {
    logger.warn(LogCode.API_FETCH_FAILED, 'Alchemy Prices API failed', {
      error: e.message,
      network,
    });
    return {};
  }
}

async function fetchFallbackTokenPrice(chain: string, address: string): Promise<number | undefined> {
  const cached = getCachedTokenPrice(chain, address);
  if (cached !== undefined) return cached;

  const key = priceCacheKey(chain, address);
  const inflight = tokenPriceInFlight.get(key);
  if (inflight) return inflight;

  const promise = (async () => {
    const ds = await dexscreener.getTokenDetails(chain, address);
    if (ds?.price && ds.price > 0) return ds.price;
    const gt = await geckoTerminal.getTokenDetails(chain, address);
    if (gt?.price && gt.price > 0) return gt.price;
    return undefined;
  })();

  tokenPriceInFlight.set(key, promise);
  const price = await promise;
  tokenPriceInFlight.delete(key);
  if (price !== undefined) {
    setCachedTokenPrice(chain, address, price);
  }
  return price;
}

async function fetchTokenPrices(
  apiKey: string,
  chain: string,
  network: string,
  addresses: string[]
): Promise<Record<string, number>> {
  const results: Record<string, number> = {};
  const normalized = addresses.map(addr => addr.toLowerCase());
  const missing: string[] = [];

  normalized.forEach((addr, index) => {
    const cached = getCachedTokenPrice(chain, addr);
    if (cached !== undefined) {
      results[addr] = cached;
    } else {
      missing.push(addresses[index]);
    }
  });

  if (missing.length === 0) return results;

  const batchSize = 25;
  for (let i = 0; i < missing.length; i += batchSize) {
    const batch = missing.slice(i, i + batchSize);
    const priceMap = await fetchAlchemyPricesByAddress(apiKey, network, batch);
    Object.entries(priceMap).forEach(([addr, price]) => {
      results[addr.toLowerCase()] = price;
      setCachedTokenPrice(chain, addr, price);
    });
  }

  const stillMissing = missing.filter(addr => results[addr.toLowerCase()] === undefined).slice(0, MAX_FALLBACK_TOKENS);
  const fallbackBatchSize = 5;
  for (let i = 0; i < stillMissing.length; i += fallbackBatchSize) {
    const batch = stillMissing.slice(i, i + fallbackBatchSize);
    const settled = await Promise.allSettled(
      batch.map(addr => fetchFallbackTokenPrice(chain, addr))
    );
    settled.forEach((entry, idx) => {
      if (entry.status === 'fulfilled' && entry.value !== undefined) {
        results[batch[idx].toLowerCase()] = entry.value;
      }
    });
  }

  return results;
}

const CHAIN_KEY_ALIASES: Record<string, string> = {
  'matic-mainnet': 'polygon',
  'sol': 'solana',
};

function normalizeChainKey(chain: string): string {
  const lower = chain.toLowerCase();
  return CHAIN_KEY_ALIASES[lower] || lower;
}

async function fetchEvmNativeBalance(
  chain: string,
  address: string
): Promise<{ balanceHex: string; balanceFormatted: number } | null> {
  try {
    const balanceHex = await rpcManager.getNativeBalance(address, chain);
    const balanceBigInt = BigInt(balanceHex);
    return {
      balanceHex,
      balanceFormatted: Number(balanceBigInt) / 1e18,
    };
  } catch (error: any) {
    logger.warn(LogCode.API_FETCH_FAILED, 'RPC native balance failed', {
      chain,
      error: error.message,
    });
  }

  const infuraUrl = getInfuraUrl(chain);
  if (!infuraUrl) return null;

  try {
    const response = await fetch(infuraUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBalance',
        params: [address, 'latest'],
      }),
    });

    if (!response.ok) return null;
    const json = await response.json();
    const balanceHex = json?.result;
    if (!balanceHex) return null;
    const balanceBigInt = BigInt(balanceHex);
    return {
      balanceHex,
      balanceFormatted: Number(balanceBigInt) / 1e18,
    };
  } catch (error: any) {
    logger.warn(LogCode.API_FETCH_FAILED, 'Infura native balance failed', {
      chain,
      error: error.message,
    });
    return null;
  }
}

async function getTokenMetadataBatch(
  chain: string,
  addresses: string[]
): Promise<Record<string, any>> {
  const uniqueAddresses = Array.from(
    new Set(addresses.map(addr => addr.toLowerCase()))
  );
  if (uniqueAddresses.length === 0) return {};

  const url = getAlchemyUrl(chain);
  const addressById = new Map<number, string>();
  const payload = uniqueAddresses.map((addr, index) => {
    const id = index + 1;
    addressById.set(id, addr);
    return {
      jsonrpc: '2.0',
      id,
      method: 'alchemy_getTokenMetadata',
      params: [addr],
    };
  });

  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }, METADATA_TIMEOUT_MS);

    if (!response.ok) return {};

    const json = await response.json();
    if (!Array.isArray(json)) return {};

    const results: Record<string, any> = {};
    json.forEach(entry => {
      const addr = addressById.get(entry?.id);
      if (addr && entry?.result) {
        results[addr] = entry.result;
      }
    });

    return results;
  } catch (e: any) {
    logger.error(LogCode.API_FETCH_FAILED, 'Batch token metadata fetch failed', {
      error: e.message,
      chain,
    });
    return {};
  }
}

/**
 * Get portfolio balances for a wallet across multiple networks using Alchemy Portfolio API
 */
/**
 * Fetch prices from Coinbase API for major native tokens
 */
async function fetchCoinbasePrices(): Promise<Partial<Record<string, number>>> {
  const mapping: Record<string, string> = {
    'ETH': 'eth',
    'SOL': 'solana',
    'BNB': 'bsc',
    'MATIC': 'polygon'
  };

  const results: Partial<Record<string, number>> = {};

  await Promise.allSettled(Object.keys(mapping).map(async (symbol) => {
    try {
      const res = await fetch(`https://api.coinbase.com/v2/prices/${symbol}-USD/spot`);
      if (res.ok) {
        const json = await res.json();
        const price = parseFloat(json.data.amount);
        const chainKey = mapping[symbol];
        results[chainKey] = price;

        // Map ETH price to L2s
        if (symbol === 'ETH') {
          results['base'] = price;
          results['arbitrum'] = price;
          results['optimism'] = price;
        }
      }
    } catch (e: any) {
      logger.warn(LogCode.API_FETCH_FAILED, 'Failed to fetch Coinbase price', { symbol, error: e.message });
    }
  }));

  return results;
}

/**
 * Fetch accurate prices for native tokens using DexScreener as fallback
 */
async function getNativePrices(): Promise<Record<string, number>> {
  const wrappers: Record<string, string> = {
    'eth': '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    'base': '0x4200000000000000000000000000000000000006',
    'arbitrum': '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
    'optimism': '0x4200000000000000000000000000000000000006',
    'polygon': '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270', // WMATIC
    'bsc': '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
    'solana': 'So11111111111111111111111111111111111111112'
  };

  const prices: Record<string, number> = {
    'eth': 3400,
    'base': 3400,
    'arbitrum': 3400,
    'optimism': 3400,
    'polygon': 0.13,
    'bsc': 650,
    'solana': 250
  };

  const dexPromise = (async () => {
    try {
      const addresses = Object.values(wrappers).join(',');
      const url = `https://api.dexscreener.com/latest/dex/tokens/${addresses}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.pairs && Array.isArray(data.pairs)) {
          for (const [key, addr] of Object.entries(wrappers)) {
            const pair = data.pairs.find((p: any) => p.baseToken?.address?.toLowerCase() === addr.toLowerCase());
            if (pair && pair.priceUsd) {
              prices[key] = parseFloat(pair.priceUsd);
            }
          }
        }
      }
    } catch (e: any) {
      logger.warn(LogCode.API_FETCH_FAILED, 'Failed to fetch native prices from DexScreener', { error: e.message });
    }
  })();

  const coinbasePromise = fetchCoinbasePrices();

  const [, coinbasePrices] = await Promise.allSettled([dexPromise, coinbasePromise])
    .then(results => {
      const coinbaseResult = results[1];
      return [
        results[0],
        coinbaseResult.status === 'fulfilled' ? coinbaseResult.value : {},
      ] as const;
    });

  return { ...prices, ...coinbasePrices } as Record<string, number>;
}

export async function getPortfolio(
  address: string,
  chains: string[] = ['eth', 'base', 'arbitrum', 'optimism', 'polygon', 'bsc', 'solana'],
  solanaAddress?: string
): Promise<Record<string, WalletBalance>> {
  try {
    const apiKey = getAlchemyApiKey();
    if (!apiKey) {
      throw new Error('Alchemy API key missing');
    }

    const networkMap: Record<string, string> = {
      'eth': 'eth-mainnet',
      'base': 'base-mainnet',
      'arbitrum': 'arb-mainnet',
      'optimism': 'opt-mainnet',
      'polygon': 'polygon-mainnet',
      'matic-mainnet': 'polygon-mainnet',
      'bsc': 'bnb-mainnet',
      'solana': 'solana-mainnet',
    };

    const NATIVE_PRICES = await getNativePrices();

    const targetNetworks = chains.map(c => networkMap[c.toLowerCase()]).filter(Boolean);
    const evmNetworks = targetNetworks.filter(n => n !== 'solana-mainnet');
    const results: Record<string, WalletBalance> = {};
    const parseTokenBalance = (balance: string | null | undefined): bigint => {
      if (!balance) return 0n;
      try {
        return BigInt(balance);
      } catch {
        return 0n;
      }
    };
    const formatTokenBalance = (rawBalance: bigint, decimals: number): string => {
      if (decimals <= 0) return rawBalance.toString();
      const divisor = 10n ** BigInt(decimals);
      const whole = rawBalance / divisor;
      const fraction = rawBalance % divisor;
      const fractionStr = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
      return fractionStr ? `${whole}.${fractionStr}` : whole.toString();
    };

    // 1. Fetch EVM Portfolio
    if (evmNetworks.length > 0) {
      const url = `https://api.g.alchemy.com/data/v1/${apiKey}/assets/tokens/balances/by-address`;
      const body = {
        addresses: [{ address, networks: evmNetworks }],
        withMetadata: true,
        withPrices: true,
        includeNativeTokens: true
      };

      let response: Response | null = null;
      try {
        response = await fetchWithTimeout(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(body)
        }, PORTFOLIO_TIMEOUT_MS);
      } catch (e: any) {
        logger.warn(LogCode.API_FETCH_FAILED, 'Alchemy Portfolio EVM API timeout', { error: e.message });
      }

      if (response && response.ok) {
        const json = await response.json();

        if (json.data && Array.isArray(json.data.tokens)) {
          const networkGroups: Record<string, any[]> = {};
          json.data.tokens.forEach((t: any) => {
            if (!networkGroups[t.network]) networkGroups[t.network] = [];
            networkGroups[t.network].push(t);
          });

          for (const network of Object.keys(networkGroups)) {
            // Map matic-mainnet or others back to our standard keys
            let chainKey = Object.keys(networkMap).find(key => networkMap[key] === network) || network;
            chainKey = normalizeChainKey(chainKey);

            const rawBalancesByAddress = new Map<string, bigint>();
            const metadataTargets = networkGroups[network]
              .filter((t: any) => t.tokenAddress)
              .filter((t: any) => !t.symbol || !t.name || typeof t.decimals !== 'number')
              .map((t: any) => t.tokenAddress as string)
              .slice(0, MAX_METADATA_TOKENS_EVM);
            const metadataByAddress = metadataTargets.length > 0
              ? await getTokenMetadataBatch(chainKey, metadataTargets)
              : {};

            let ethBalance = '0';
            let ethBalanceFormatted = 0;
            let ethPrice = NATIVE_PRICES[chainKey] || 0;
            const tokens: TokenBalance[] = [];

            networkGroups[network].forEach((t: any) => {
              const isNative = t.tokenAddress === null;
              const hexBalance = t.tokenBalance || '0';
              const balanceBigInt = parseTokenBalance(hexBalance);

              if (balanceBigInt === 0n) return;

              if (isNative) {
                ethBalance = hexBalance;
                const decimals = t.decimals || 18;
                ethBalanceFormatted = Number(balanceBigInt) / (10 ** decimals);
                ethPrice = t.price || NATIVE_PRICES[chainKey] || 0;
              } else {
                const tokenAddress = t.tokenAddress as string;
                const meta = metadataByAddress[tokenAddress.toLowerCase()];
                const decimals = typeof t.decimals === 'number' ? t.decimals : (meta?.decimals ?? 18);
                const symbol = t.symbol || meta?.symbol || 'UNKNOWN';
                const name = t.name || meta?.name || 'Unknown Token';
                const logo = t.metadata?.logo || meta?.logo || '';
                const formattedBalance = formatTokenBalance(balanceBigInt, decimals);
                const alchemyPrice = typeof t.price === 'number' ? t.price : undefined;
                const stablePrice = getStablecoinPrice(symbol);
                const tokenPrice = alchemyPrice ?? stablePrice;
                const tempToken = {
                  contractAddress: tokenAddress,
                  tokenBalance: formattedBalance,
                  symbol,
                  name,
                  decimals,
                  logo,
                  price: tokenPrice // Store Alchemy/stablecoin price if applicable
                };
                rawBalancesByAddress.set(tokenAddress.toLowerCase(), balanceBigInt);
                tokens.push(tempToken);
              }
            });

            results[chainKey] = { ethBalance, ethBalanceFormatted, ethPrice, tokens } as any;

            if (tokens.length > 0) {
              const tokensMissingPrice = tokens
                .filter(t => t.price === undefined)
                .sort((a, b) => {
                  const aBal = rawBalancesByAddress.get(a.contractAddress.toLowerCase()) || 0n;
                  const bBal = rawBalancesByAddress.get(b.contractAddress.toLowerCase()) || 0n;
                  return aBal > bBal ? -1 : aBal < bBal ? 1 : 0;
                })
                .slice(0, MAX_PRICE_TOKENS_EVM)
                .map(t => t.contractAddress);

              if (tokensMissingPrice.length > 0) {
                const priceMap = await fetchTokenPrices(apiKey, chainKey, network, tokensMissingPrice);
                tokens.forEach(token => {
                  const price = priceMap[token.contractAddress.toLowerCase()];
                  if (price !== undefined) {
                    token.price = price;
                  }
                });
              }

              tokens.forEach(token => {
                if (token.price !== undefined && token.valueUsd === undefined) {
                  const balance = parseFloat(token.tokenBalance || '0');
                  token.valueUsd = balance * token.price;
                }
              });

            }
          }
        }
      } else if (response) {
        logger.error(LogCode.API_FETCH_FAILED, 'Alchemy Portfolio EVM API error', { status: response.status });
      }
    }

    // 2. Fetch Solana Portfolio
    const solAddr = solanaAddress || (!address.startsWith('0x') ? address : null);
    if (chains.includes('solana') && !results.solana && solAddr) {
      try {
        const url = `https://api.g.alchemy.com/data/v1/${apiKey}/assets/tokens/balances/by-address`;
        const body = {
          addresses: [{ address: solAddr, networks: ['solana-mainnet'] }],
          withMetadata: true,
          withPrices: true,
          includeNativeTokens: true
        };
        let response: Response | null = null;
        try {
          response = await fetchWithTimeout(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(body)
          }, PORTFOLIO_TIMEOUT_MS);
        } catch (e: any) {
          logger.warn(LogCode.API_FETCH_FAILED, 'Alchemy Portfolio Solana timeout', { error: e.message });
        }
        if (response && response.ok) {
          const json = await response.json();
          if (json.data && Array.isArray(json.data.tokens)) {
            let ethBalance = '0';
            let ethBalanceFormatted = 0;
            let ethPrice = NATIVE_PRICES.solana || 0;
            const tokens: TokenBalance[] = [];

            json.data.tokens.forEach((t: any) => {
              const isNative = t.tokenAddress === null;
              const hexBalance = t.tokenBalance || '0';
              const balanceBigInt = parseTokenBalance(hexBalance);

              if (balanceBigInt === 0n) return;

              if (isNative) {
                ethBalance = hexBalance;
                ethBalanceFormatted = Number(balanceBigInt) / (10 ** (t.decimals || 9));
                ethPrice = t.price || NATIVE_PRICES.solana || 0;
              } else {
                const cachedMeta = SPL_TOKEN_METADATA[t.tokenAddress as string];
                const decimals = t.decimals ?? cachedMeta?.decimals ?? 9;
                const symbol = t.symbol || cachedMeta?.symbol || 'UNKNOWN';
                const name = t.name || cachedMeta?.name || 'Unknown Token';
                const stablePrice = getStablecoinPrice(symbol);
                const formattedBalance = formatTokenBalance(balanceBigInt, decimals);
                const tempToken = {
                  contractAddress: t.tokenAddress,
                  tokenBalance: formattedBalance,
                  symbol,
                  name,
                  decimals,
                  logo: t.metadata?.logo || '',
                  price: t.price || stablePrice || undefined
                };
                tokens.push(tempToken);
              }
            });
            if (tokens.length === 0) {
              if (helius.isHeliusConfigured()) {
                const cached = solanaBalanceCache.get(solAddr);
                if (cached && Date.now() - cached.timestamp < SOL_BALANCE_CACHE_TTL_MS) {
                  if (cached.nativeBalance && ethBalance === '0') {
                    ethBalance = `0x${cached.nativeBalance.toString(16)}`;
                    ethBalanceFormatted = cached.nativeBalance / 1e9;
                  }
                  tokens.push(...cached.tokens);
                } else {
                  const heliusBalances = await helius.getFungibleTokenBalances(solAddr, 200);
                  if (heliusBalances.nativeBalance && ethBalance === '0') {
                    ethBalance = `0x${heliusBalances.nativeBalance.toString(16)}`;
                    ethBalanceFormatted = heliusBalances.nativeBalance / 1e9;
                  }
                  heliusBalances.tokens.forEach(token => {
                    const formattedBalance = formatTokenBalance(BigInt(token.balance), token.decimals);
                    tokens.push({
                      contractAddress: token.mint,
                      tokenBalance: formattedBalance,
                      symbol: token.symbol,
                      name: token.name,
                      decimals: token.decimals,
                      logo: token.logo || '',
                    });
                  });
                  solanaBalanceCache.set(solAddr, {
                    tokens: [...tokens],
                    nativeBalance: heliusBalances.nativeBalance,
                    timestamp: Date.now(),
                  });
                }
              }
            }
            if (tokens.length === 0) {
              const fallbackTokens = await fetchSolanaTokenAccounts(solAddr);
              if (fallbackTokens.length > 0) {
                tokens.push(...fallbackTokens);
              }
            }
            results.solana = { ethBalance, ethBalanceFormatted, ethPrice, tokens } as any;

            if (tokens.length > 0) {
              const tokensMissingPrice = tokens
                .filter(t => t.price === undefined)
                .sort((a, b) => parseFloat(b.tokenBalance || '0') - parseFloat(a.tokenBalance || '0'))
                .slice(0, MAX_PRICE_TOKENS_SOLANA)
                .map(t => t.contractAddress);

              if (tokensMissingPrice.length > 0) {
                const priceMap = await fetchTokenPrices(apiKey, 'solana', 'solana-mainnet', tokensMissingPrice);
                tokens.forEach(token => {
                  const price = priceMap[token.contractAddress.toLowerCase()];
                  if (price !== undefined) {
                    token.price = price;
                  }
                });
              }

              tokens.forEach(token => {
                if (token.price !== undefined && token.valueUsd === undefined) {
                  const balance = parseFloat(token.tokenBalance || '0');
                  token.valueUsd = balance * token.price;
                }
              });

            }
          }
        } else if (response) {
          logger.error(LogCode.API_FETCH_FAILED, 'Alchemy Portfolio Solana API error', { status: response.status });
        }
      } catch (e: any) {
        logger.error(LogCode.API_FETCH_FAILED, 'Alchemy Portfolio Solana fetch failed', { error: e.message });
      }
    }

    // Ensure all requested chains have at least empty values
    for (const c of chains) {
      const chainKey = normalizeChainKey(c);
      if (!results[chainKey]) {
        const defaultPrice = NATIVE_PRICES[chainKey.toLowerCase()] || 0;
        if (chainKey !== 'solana') {
          const fallback = await fetchEvmNativeBalance(chainKey, address);
          if (fallback) {
            results[chainKey] = {
              ethBalance: fallback.balanceHex,
              ethBalanceFormatted: fallback.balanceFormatted,
              ethPrice: defaultPrice,
              tokens: [],
            } as any;
            continue;
          }
        }
        results[chainKey] = {
          ethBalance: '0',
          ethBalanceFormatted: 0,
          ethPrice: defaultPrice,
          tokens: [],
        } as any;
      }
    }

    return results;
  } catch (error: any) {
    logger.error(LogCode.API_FETCH_FAILED, 'Alchemy Portfolio critical error', { error: error.message });
    throw error;
  }
}

export async function getEthBalance(address: string, chain: string = 'eth'): Promise<string> {
  const portfolio = await getPortfolio(address, [chain]);
  return portfolio[chain]?.ethBalance || '0';
}

export async function getTokenBalances(address: string, chain: string = 'eth'): Promise<TokenBalance[]> {
  const portfolio = await getPortfolio(address, [chain]);
  return portfolio[chain]?.tokens || [];
}

export async function getWalletBalance(address: string, chain: string = 'eth'): Promise<WalletBalance> {
  const portfolio = await getPortfolio(address, [chain]);
  return portfolio[chain] || { ethBalance: '0', ethBalanceFormatted: 0, tokens: [] };
}

export async function getNativeBalances(
  address: string,
  chains: string[] = ['eth', 'base', 'arbitrum', 'optimism', 'polygon', 'bsc', 'solana'],
  solanaAddress?: string
): Promise<Record<string, WalletBalance>> {
  const NATIVE_PRICES = await getNativePrices();
  const solAddr = solanaAddress || (!address.startsWith('0x') ? address : null);
  const stablecoins: Record<string, Array<{ address: string; symbol: string; name: string; decimals: number }>> = {
    eth: [
      { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
      { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', name: 'Tether USD', decimals: 6 },
      { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 },
    ],
    base: [
      { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
    ],
    arbitrum: [
      { address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
      { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', symbol: 'USDT', name: 'Tether USD', decimals: 6 },
      { address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 },
    ],
    optimism: [
      { address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
      { address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', symbol: 'USDT', name: 'Tether USD', decimals: 6 },
      { address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 },
    ],
    polygon: [
      { address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
      { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', symbol: 'USDT', name: 'Tether USD', decimals: 6 },
      { address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 },
    ],
    bsc: [
      { address: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', symbol: 'USDC', name: 'USD Coin', decimals: 18 },
      { address: '0x55d398326f99059ff775485246999027b3197955', symbol: 'USDT', name: 'Tether USD', decimals: 18 },
      { address: '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 },
    ],
  };

  const readErc20Balance = async (chainKey: string, tokenAddress: string): Promise<bigint> => {
    try {
      const data = `0x70a08231${address.toLowerCase().replace('0x', '').padStart(64, '0')}`;
      const result = await rpcManager.callRpc<string>(chainKey, 'eth_call', [
        { to: tokenAddress, data },
        'latest',
      ]);
      return BigInt(result);
    } catch (error: any) {
      logger.warn(LogCode.API_FETCH_FAILED, 'Stablecoin balance fetch failed', {
        chain: chainKey,
        token: tokenAddress,
        error: error.message,
      });
      return 0n;
    }
  };

  const formatStableBalance = (raw: bigint, decimals: number): string => {
    if (decimals <= 0) return raw.toString();
    const divisor = 10n ** BigInt(decimals);
    const whole = raw / divisor;
    const fraction = raw % divisor;
    const fractionStr = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
    return fractionStr ? `${whole}.${fractionStr}` : whole.toString();
  };

  const entries = await Promise.all(chains.map(async (chain) => {
    const chainKey = normalizeChainKey(chain);
    try {
      if (chainKey === 'solana') {
        if (!solAddr) {
          return [chainKey, { ethBalance: '0', ethBalanceFormatted: 0, ethPrice: NATIVE_PRICES.solana || 0, tokens: [] } as any] as const;
        }
        const lamportsStr = await rpcManager.getNativeBalance(solAddr, 'solana');
        const lamports = BigInt(lamportsStr);
        const ethBalance = `0x${lamports.toString(16)}`;
        const ethBalanceFormatted = Number(lamports) / 1e9;
        return [chainKey, {
          ethBalance,
          ethBalanceFormatted,
          ethPrice: NATIVE_PRICES.solana || 0,
          tokens: [],
        } as any] as const;
      }

      const balanceHex = await rpcManager.getNativeBalance(address, chainKey);
      const balanceWei = BigInt(balanceHex);
      const ethBalanceFormatted = Number(balanceWei) / 1e18;
      const result: WalletBalance = {
        ethBalance: balanceHex,
        ethBalanceFormatted,
        ethPrice: NATIVE_PRICES[chainKey] || 0,
        tokens: [],
      };

      const stableList = stablecoins[chainKey] || [];
      if (stableList.length > 0) {
        const settled = await Promise.all(stableList.map(async (token) => {
          const raw = await readErc20Balance(chainKey, token.address);
          if (raw === 0n) return null;
          const formatted = formatStableBalance(raw, token.decimals);
          return {
            contractAddress: token.address,
            tokenBalance: formatted,
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals,
            price: 1,
            valueUsd: Number(formatted),
          } as TokenBalance;
        }));
        result.tokens = settled.filter(Boolean) as TokenBalance[];
      }

      return [chainKey, result] as const;
    } catch (error: any) {
      logger.warn(LogCode.API_FETCH_FAILED, 'Native balance fetch failed', { chain: chainKey, error: error.message });
      return [chainKey, {
        ethBalance: '0',
        ethBalanceFormatted: 0,
        ethPrice: NATIVE_PRICES[chainKey] || 0,
        tokens: [],
      } as any] as const;
    }
  }));

  return Object.fromEntries(entries);
}
