import { fetchJson } from '../config/unifiedApiService.js';
import { LogCode } from '../config/logRegistry.js';
import { logger } from '../utils/logger.js';
import * as scanApi from './scanApi.js';
import {
  convertToWalletTransactions,
  type AssetTransfer,
  type WalletTransaction,
} from './alchemy.js';

const ALCHEMY_WALLET_TX_NETWORKS: Record<string, string> = {
  eth: 'eth-mainnet',
  ethereum: 'eth-mainnet',
  base: 'base-mainnet',
  arbitrum: 'arb-mainnet',
  optimism: 'opt-mainnet',
  polygon: 'polygon-mainnet',
  bsc: 'bnb-mainnet',
};

function getWalletTxAlchemyApiKey(): string {
  return String(process.env.ALCHEMY_WALLET_TX_API_KEY || '').trim();
}

function getWalletTxAlchemyUrl(chain: string): string {
  const network = ALCHEMY_WALLET_TX_NETWORKS[String(chain || 'eth').toLowerCase()] || ALCHEMY_WALLET_TX_NETWORKS.eth;
  return `https://${network}.g.alchemy.com/v2/${getWalletTxAlchemyApiKey()}`;
}

function filterWalletTransactions(transactions: WalletTransaction[]): WalletTransaction[] {
  return transactions.filter((tx) => {
    if (!tx.tokenAddress) return true;

    const symbol = tx.tokenSymbol || '';
    const suspiciousPatterns = [
      'visit', 'claim', 'reward', 'airdrop', 'bonus',
      'http', 'www', '.com', 'free', 'winner', 'unknown',
      'lp token', 'liquidity pool',
    ];

    if (!symbol || symbol.length > 12) return false;
    const lowerSymbol = symbol.toLowerCase();
    return !suspiciousPatterns.some((pattern) => lowerSymbol.includes(pattern));
  });
}

function dedupeAndLimitTransfers(transfers: AssetTransfer[], maxCount: number): AssetTransfer[] {
  const seen = new Set<string>();
  const uniqueTransfers = transfers
    .sort((a, b) => parseInt(b.blockNum, 16) - parseInt(a.blockNum, 16))
    .filter((transfer) => {
      const key = `${transfer.hash}-${transfer.from}-${transfer.to}-${transfer.asset || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return uniqueTransfers.slice(0, maxCount);
}

async function fetchWalletTransfersFromDedicatedAlchemy(
  address: string,
  chain: string,
  limit: number,
): Promise<AssetTransfer[] | null> {
  const apiKey = getWalletTxAlchemyApiKey();
  if (!apiKey) {
    logger.warn(LogCode.API_AUTH_FAILED, 'ALCHEMY_WALLET_TX_API_KEY missing for wallet transaction history', { chain });
    return null;
  }

  const url = getWalletTxAlchemyUrl(chain);
  const requestHeaders = {
    'Content-Type': 'application/json',
    'Accept-Encoding': 'gzip',
    'Connection': 'keep-alive',
  };

  try {
    const [incomingData, outgoingData] = await Promise.all([
      fetchJson<{ result?: { transfers?: AssetTransfer[] } }>({
        url,
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify({
          id: 1,
          jsonrpc: '2.0',
          method: 'alchemy_getAssetTransfers',
          params: [{
            fromBlock: '0x0',
            toBlock: 'latest',
            toAddress: address,
            category: ['external', 'erc20'],
            maxCount: `0x${limit.toString(16)}`,
            order: 'desc',
            excludeZeroValue: true,
            withMetadata: true,
          }],
        }),
        requestTimeout: 10000,
        keepalive: true,
      }),
      fetchJson<{ result?: { transfers?: AssetTransfer[] } }>({
        url,
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify({
          id: 2,
          jsonrpc: '2.0',
          method: 'alchemy_getAssetTransfers',
          params: [{
            fromBlock: '0x0',
            toBlock: 'latest',
            fromAddress: address,
            category: ['external', 'erc20'],
            maxCount: `0x${limit.toString(16)}`,
            order: 'desc',
            excludeZeroValue: true,
            withMetadata: true,
          }],
        }),
        requestTimeout: 10000,
        keepalive: true,
      }),
    ]);

    const transfers = [
      ...(incomingData.result?.transfers || []),
      ...(outgoingData.result?.transfers || []),
    ];

    return dedupeAndLimitTransfers(transfers, limit);
  } catch (error: any) {
    logger.error(LogCode.API_FETCH_FAILED, 'Dedicated Alchemy wallet history fetch failed', {
      chain,
      address: address.slice(0, 10),
      error: error.message,
    });
    return null;
  }
}

async function fetchWalletTransfersFromScan(
  address: string,
  chain: string,
  limit: number,
): Promise<WalletTransaction[]> {
  const [nativeTxs, tokenTxs] = await Promise.all([
    scanApi.getEvmTransactions(address, chain, 1, limit).catch((error: any) => {
      logger.warn(LogCode.API_FETCH_FAILED, 'ScanAPI native wallet history fetch failed', { chain, error: error.message });
      return [];
    }),
    scanApi.getEvmTokenTransfers(address, chain, 1, limit).catch((error: any) => {
      logger.warn(LogCode.API_FETCH_FAILED, 'ScanAPI token wallet history fetch failed', { chain, error: error.message });
      return [];
    }),
  ]);

  return [...nativeTxs, ...tokenTxs]
    .sort((a, b) => new Date(b.blockTimestamp).getTime() - new Date(a.blockTimestamp).getTime())
    .slice(0, limit);
}

export async function getWalletTransactionsForWalletPage(
  address: string,
  options: { chain?: string; limit?: number } = {},
): Promise<WalletTransaction[]> {
  const chain = options.chain || 'eth';
  const limit = options.limit || 50;
  const alchemyTransfers = await fetchWalletTransfersFromDedicatedAlchemy(address, chain, limit);

  if (alchemyTransfers && alchemyTransfers.length > 0) {
    return filterWalletTransactions(convertToWalletTransactions(alchemyTransfers, address, chain));
  }

  if (alchemyTransfers && alchemyTransfers.length === 0) {
    logger.info(LogCode.API_FETCH_SUCCESS, 'Dedicated wallet history Alchemy returned no transfers; using Scan fallback', {
      chain,
      address: address.slice(0, 10),
    });
  }

  return filterWalletTransactions(await fetchWalletTransfersFromScan(address, chain, limit));
}
