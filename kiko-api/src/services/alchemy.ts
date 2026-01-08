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
  console.log(`[Alchemy] API Key loaded: ${key ? (key.slice(0, 5) + '...') : 'MISSING'}`);
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
}

export interface WalletBalance {
  ethBalance: string;
  ethBalanceFormatted: number;
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
        console.error('[Alchemy] No API key configured! Set ALCHEMY_API_KEY environment variable.');
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
        console.log(`[Alchemy] Fetching asset transfers for contractAddresses:`, contractAddresses);
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
        console.log(`[Alchemy] Request body:`, JSON.stringify(requestBody));

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        if (!response.ok) {
          const err = await response.text();
          console.error(`[Alchemy] API error: ${response.status} ${err}`);
          return null;
        }
        const data = await response.json() as { result?: { transfers: AssetTransfer[] }, error?: any };
        if (data.error) {
          console.error(`[Alchemy] RPC Error:`, JSON.stringify(data.error));
        }
        console.log(`[Alchemy] Received ${data.result?.transfers?.length || 0} transfers`);
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
        console.error(`[Alchemy] Failed to fetch asset transfers: ${incomingResponse.statusText || outgoingResponse.statusText}`);
        return null;
      }

      const incomingData = await incomingResponse.json() as { result?: { transfers: AssetTransfer[] } };
      const outgoingData = await outgoingResponse.json() as { result?: { transfers: AssetTransfer[] } };

      const incomingTransfers: AssetTransfer[] = incomingData.result?.transfers || [];
      const outgoingTransfers: AssetTransfer[] = outgoingData.result?.transfers || [];

      return [...incomingTransfers, ...outgoingTransfers];
    } catch (e: any) {
      console.error('[Alchemy] Error fetching asset transfers:', e.message);
      return null;
    }
  };

  const tryScanApi = async () => {
    // If no address, Scan API (Etherscan) usually can't do generic tokentx without it
    if (!address) {
      console.warn(`[Alchemy] Scan API requires a wallet address. Skipping.`);
      return [];
    }
    // Use Etherscan-compatible Scan API for EVM history
    console.log(`[Alchemy] Using Scan API for ${chain} history...`);

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
  if (address) {
    transfers = await tryScanApi();
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
    '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f', // SushiSwap Router
    '0x1111111254fb6c44bac0bed2854e76f90643097d', // 1inch Router
    '0xdef1c0ded9bec7f1a1670819833240f027b25eff', // 0x Exchange Proxy
  ],
  'base': [
    '0x2626664c2603336e57b271c5c0b26f421741e481', // Uniswap V3 Router (Base)
    '0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43', // Aerodrome Router
  ],
  'arbitrum': [
    '0xe592427a0aece92de3edee1f18e0157c05861564', // Uniswap V3 Router
    '0x1111111254fb6c44bac0bed2854e76f90643097d', // 1inch Router
  ],
  'optimism': [
    '0xe592427a0aece92de3edee1f18e0157c05861564', // Uniswap V3 Router
  ],
  'polygon': [
    '0x1b02da8cb0d097eb8d57a175b88c7d8b47997506', // SushiSwap Router
    '0xa5e0829caced8ffdd4de3c43696c57f7d7a678ff', // QuickSwap Router
  ],
  'bsc': [
    '0x10ed43c718714eb63d5aa57b78b54704e256024e', // PancakeSwap V2 Router
    '0x13f4ea83d0bd40e75c8222255bc855a974568dd4', // PancakeSwap V3 Router
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
      console.log(`[Alchemy] No SPL token account found for mint ${mintAddress.slice(0, 10)}...`);
      return 0;
    }

    // Get the first matching token account
    const tokenAccount = result.value[0];
    const info = tokenAccount.account.data.parsed.info;
    const uiAmount = parseFloat(info.tokenAmount.uiAmountString) || 0;

    console.log(`[Alchemy] Direct SPL balance for ${mintAddress.slice(0, 10)}...: ${uiAmount}`);
    return uiAmount;
  } catch (error: any) {
    console.error(`[Alchemy] Error fetching Solana token balance:`, error.message);
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
    console.log(`[ENS] Resolved ${ensName} -> ${address}`);
    return address;
  } catch (error: any) {
    console.error(`[ENS] Failed to resolve ${ensName}:`, error.message);
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
        console.warn('[Solana] Helius history failed, trying Solscan...', err.message);
      }
    }

    // Try Solscan as backup
    if (solscan.isConfigured()) {
      console.log(`[Solana] Trying Solscan backup for ${address}...`);
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
        console.warn('[Solana] Solscan fallback failed:', err.message);
      }
    }

    // Fallback to basic RPC if Helius not configured
    console.warn('[Solana] Helius not configured, using basic RPC (limited data)');
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

      console.log(`[Solana] Fetching prices for ${tokensToFetch.length} tokens...`);

      await Promise.allSettled(
        tokensToFetch.map(async (addr) => {
          try {
            const details = await dexscreener.getTokenDetails('solana', addr);
            if (details && details.price > 0) {
              priceMap.set(addr, details.price);
              console.log(`[Solana] Price for ${details.symbol || addr}: $${details.price}`);
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
  } catch (error) {
    console.error('[Solana] Transaction history error:', error);
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

  console.log(`[Alchemy] getWalletTransactions starting for ${address} on ${chain}, limit: ${limit}`);
  const isSolana = chain.toLowerCase() === 'solana' || chain.toLowerCase() === 'sol';

  if (isSolana) {
    const solTxs = await getSolanaTransactions(address, limit);
    console.log(`[Alchemy] getSolanaTransactions returned ${solTxs.length} txs`);
    return solTxs;
  }

  // Use Scan API for EVM chains (Etherscan/RouteScan/Blockscout)
  try {
    const scanApi = await import('./scanApi.js');

    // Fetch both native and token transactions in parallel
    const [nativeTxs, tokenTxs] = await Promise.all([
      scanApi.getEvmTransactions(address, chain, 1, limit).catch(err => {
        console.warn(`[Alchemy] Failed to fetch EVM native txs: ${err.message}`);
        return [];
      }),
      scanApi.getEvmTokenTransfers(address, chain, 1, limit).catch(err => {
        console.warn(`[Alchemy] Failed to fetch EVM token transfers: ${err.message}`);
        return [];
      })
    ]);

    // Merge and Deduplicate
    // Strategy: Create a map of txHash -> Transaction. 
    // If a collision occurs (same hash), prioritize Token Transfer if the native one looks like a generic call (0 value or just gas).

    const txMap = new Map<string, WalletTransaction>();

    // 1. Add Native Txs first
    for (const tx of nativeTxs) {
      txMap.set(tx.txHash, tx);
    }

    // 2. Overlay Token Txs (Prioritize them for display info)
    for (const tx of tokenTxs) {
      // If we already have this hash from native...
      if (txMap.has(tx.txHash)) {
        const existing = txMap.get(tx.txHash)!;
        // If the existing native tx has 0 value, it's likely just the wrapper for this token transfer.
        // We overwrite it with the token tx which has the useful symbol/amount.
        if (existing.amount === '0' || existing.amount === '0.0') {
          txMap.set(tx.txHash, tx);
        } else {
          // If native tx has value (e.g. swap ETH -> Token), we might want to keep both or merge?
          // For a simple list, let's keep the Token one as it's usually what the user cares about (the asset moved).
          // Or, strictly, a swap is ONE transaction. Showing the token part is usually better than "0 ETH".
          txMap.set(tx.txHash, tx);
        }
      } else {
        // New transaction (only token transfer, no native found - rare but possible if internal)
        txMap.set(tx.txHash, tx);
      }
    }

    // Convert back to array
    const mergedTxs = Array.from(txMap.values());

    // Sort by timestamp descending
    mergedTxs.sort((a, b) => b.blockTimestamp.getTime() - a.blockTimestamp.getTime());

    // Slice to limit
    const finalTxs = mergedTxs.slice(0, limit);

    // Enrich EVM transactions with price data
    const tokenAddresses = [...new Set(
      finalTxs
        .filter(tx => tx.tokenAddress && tx.tokenSymbol !== 'ETH' && tx.tokenSymbol !== 'BNB')
        .map(tx => tx.tokenAddress!)
    )];

    if (tokenAddresses.length > 0) {
      const priceMap = new Map<string, number>();
      const tokensToFetch = tokenAddresses.slice(0, 5); // Limit to avoid timeout

      console.log(`[EVM] Fetching prices for ${tokensToFetch.length} tokens on ${chain}...`);

      await Promise.allSettled(
        tokensToFetch.map(async (addr) => {
          try {
            const details = await dexscreener.getTokenDetails(chain, addr);
            if (details && details.price > 0) {
              priceMap.set(addr.toLowerCase(), details.price);
              console.log(`[EVM] Price for ${details.symbol || addr}: $${details.price}`);
            }
          } catch (e) {
            // Ignore price fetch errors
          }
        })
      );

      // Enrich transactions with valueUsd
      for (const tx of finalTxs) {
        const amount = parseFloat(tx.amount) || 0;
        if (amount > 0 && tx.tokenAddress && priceMap.has(tx.tokenAddress.toLowerCase())) {
          tx.valueUsd = amount * priceMap.get(tx.tokenAddress.toLowerCase())!;
        }
      }
    }

    return finalTxs;

  } catch (error) {
    console.warn(`[Alchemy] ScanAPI failed for ${chain}, falling back to legacy asset transfers:`, error);

    // Fallback to legacy Alchemy Asset Transfers
    const transfers = await getAssetTransfers(address, chain, {
      maxCount: limit,
      category: ['external', 'erc20'],
      order: 'desc',
    });

    return convertToWalletTransactions(transfers, address, chain);
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
  } catch (e) {
    console.error(`[Alchemy] Error fetching metadata for ${address} on ${chain}:`, e);
  }
  return null;
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
    } catch (e) {
      console.warn(`[Alchemy] Failed to fetch Coinbase price for ${symbol}`, e);
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
  } catch (e) {
    console.warn('[Alchemy] Failed to fetch native prices from DexScreener, using fallbacks', e);
  }

  // Overwrite with Coinbase prices (more reliable for native assets)
  const coinbasePrices = await fetchCoinbasePrices();
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

    // 1. Fetch EVM Portfolio
    if (evmNetworks.length > 0) {
      const url = `https://api.g.alchemy.com/data/v1/${apiKey}/assets/tokens/balances/by-address`;
      const body = {
        addresses: [{ address, networks: evmNetworks }],
        withMetadata: true,
        withPrices: true,
        includeNativeTokens: true
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
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
            if (network === 'matic-mainnet') chainKey = 'polygon';

            let ethBalance = '0';
            let ethBalanceFormatted = 0;
            let ethPrice = NATIVE_PRICES[chainKey] || 0;
            const tokens: TokenBalance[] = [];
            const tokensToEnrich: any[] = [];

            networkGroups[network].forEach((t: any) => {
              const isNative = t.tokenAddress === null;
              const hexBalance = t.tokenBalance || '0x0';
              const balanceBigInt = BigInt(hexBalance);

              if (balanceBigInt === 0n) return;

              if (isNative) {
                ethBalance = hexBalance;
                const decimals = t.decimals || 18;
                ethBalanceFormatted = Number(balanceBigInt) / (10 ** decimals);
                ethPrice = t.price || NATIVE_PRICES[chainKey] || 0;
              } else {
                const tempToken = {
                  contractAddress: t.tokenAddress,
                  tokenBalance: hexBalance,
                  symbol: t.symbol || 'UNKNOWN',
                  name: t.name || 'Unknown Token',
                  decimals: t.decimals || 18,
                  logo: t.metadata?.logo || ''
                };
                tokens.push(tempToken);
                tokensToEnrich.push(tempToken);
              }
            });

            results[chainKey] = { ethBalance, ethBalanceFormatted, ethPrice, tokens } as any;

            // Enrich metadata for top 10 tokens per chain
            if (tokensToEnrich.length > 0) {
              const chainName = chainKey;
              await Promise.allSettled(
                tokensToEnrich.slice(0, 10).map(async (token) => {
                  try {
                    const details = await dexscreener.getTokenDetails(chainName, token.contractAddress);
                    if (details) {
                      token.symbol = details.symbol || token.symbol;
                      token.name = details.name || token.name;
                      token.decimals = details.decimals || token.decimals;
                      token.logo = details.imageUrl || token.logo;
                      token.price = details.price; // Store price from DexScreener
                      (token as any)._enriched = true;
                    }
                    // Recalculate balance with possibly new decimals
                    const balBigInt = BigInt(token.tokenBalance.startsWith('0x') ? token.tokenBalance : '0x0');
                    token.tokenBalance = (Number(balBigInt) / (10 ** token.decimals)).toString();
                  } catch (e) { }
                })
              );

              // SPAM FILTER: Discard tokens without price data AND no Alchemy metadata/enrichment
              results[chainKey].tokens = results[chainKey].tokens.filter(tk => {
                const hasPrice = tk.price && parseFloat(tk.price.toString()) > 0;
                const hasMeta = tk.symbol !== 'UNKNOWN';
                const enriched = (tk as any)._enriched;

                // Keep if it has price OR is legitimate metadata + low value/new (maybe?)
                // User said: "those without price should be filtered out"
                return hasPrice;
              });
            }
          }
        }
      } else {
        console.error(`[Alchemy Portfolio] EVM API Error: ${response.status}`);
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
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(body)
        });
        if (response.ok) {
          const json = await response.json();
          if (json.data && Array.isArray(json.data.tokens)) {
            let ethBalance = '0';
            let ethBalanceFormatted = 0;
            let ethPrice = NATIVE_PRICES.solana || 0;
            const tokens: TokenBalance[] = [];
            const tokensToEnrich: any[] = [];

            json.data.tokens.forEach((t: any) => {
              const isNative = t.tokenAddress === null;
              const hexBalance = t.tokenBalance || '0x0';
              const balanceBigInt = BigInt(hexBalance);

              if (balanceBigInt === 0n) return;

              if (isNative) {
                ethBalance = hexBalance;
                ethBalanceFormatted = Number(balanceBigInt) / (10 ** (t.decimals || 9));
                ethPrice = t.price || NATIVE_PRICES.solana || 0;
              } else {
                const tempToken = {
                  contractAddress: t.tokenAddress,
                  tokenBalance: hexBalance,
                  symbol: t.symbol || 'UNKNOWN',
                  name: t.name || 'Unknown Token',
                  decimals: t.decimals || 9,
                  logo: t.metadata?.logo || ''
                };
                tokens.push(tempToken);
                tokensToEnrich.push(tempToken);
              }
            });
            results.solana = { ethBalance, ethBalanceFormatted, ethPrice, tokens } as any;

            // Enrich metadata for top 10 tokens per chain
            if (tokensToEnrich.length > 0) {
              await Promise.allSettled(
                tokensToEnrich.slice(0, 10).map(async (token) => {
                  try {
                    const details = await dexscreener.getTokenDetails('solana', token.contractAddress);
                    if (details) {
                      token.symbol = details.symbol || token.symbol;
                      token.name = details.name || token.name;
                      token.decimals = details.decimals || token.decimals;
                      token.logo = details.imageUrl || token.logo;
                      (token as any)._enriched = true;
                    }
                    // Recalculate balance with possibly new decimals
                    const balBigInt = BigInt(token.tokenBalance.startsWith('0x') ? token.tokenBalance : '0x0');
                    token.tokenBalance = (Number(balBigInt) / (10 ** token.decimals)).toString();
                  } catch (e) { }
                })
              );

              // SPAM FILTER: Solana
              results.solana.tokens = results.solana.tokens.filter(tk => {
                const hasMeta = tk.symbol !== 'UNKNOWN';
                const enriched = (tk as any)._enriched;
                return hasMeta || enriched;
              });
            }
          }
        }
      } catch (e) {
        console.error('[Alchemy Portfolio] Solana fetch failed:', e);
      }
    }

    // Ensure all requested chains have at least empty values
    chains.forEach(c => {
      if (!results[c]) {
        const defaultPrice = NATIVE_PRICES[c.toLowerCase()] || 0;
        results[c] = { ethBalance: '0', ethBalanceFormatted: 0, ethPrice: defaultPrice, tokens: [] } as any;
      }
    });

    return results;
  } catch (error) {
    console.error('[Alchemy Portfolio] Critical Error:', error);
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
