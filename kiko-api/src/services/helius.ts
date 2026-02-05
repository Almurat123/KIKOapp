/**
 * Helius API Service for Solana
 * Provides transaction history and enhanced RPC features
 * Docs: https://docs.helius.dev/
 */

import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import * as unifiedApiService from '../config/unifiedApiService.js';
import { callRpc } from './rpcManager.js';

const HELIUS_API_KEY = env.apiKeys.helius || process.env.HELIUS_API_KEY || '';
const HELIUS_BASE_URL = 'https://api.helius.xyz';
logger.debug(LogCode.SYS_STARTUP, 'Helius service module loaded');

export interface HeliusTransaction {
    signature: string;
    slot: number;
    timestamp: number;
    fee: number;
    feePayer: string;
    type: string;
    source: string;
    accountData?: any[];
    nativeTransfers?: Array<{
        fromUserAccount: string;
        toUserAccount: string;
        amount: number;
    }>;
    tokenTransfers?: Array<{
        fromUserAccount: string;
        toUserAccount: string;
        fromTokenAccount: string;
        toTokenAccount: string;
        tokenAmount: number;
        mint: string;
        tokenStandard: string;
    }>;
}

export interface HeliusTransactionsResponse {
    transactions: HeliusTransaction[];
    pagination?: {
        before?: string;
        after?: string;
    };
}

export interface HeliusFungibleTokenBalance {
    mint: string;
    balance: string;
    decimals: number;
    symbol: string;
    name: string;
    logo?: string;
}

/**
 * Get transaction history for a Solana address
 * @param address - Solana wallet address
 * @param limit - Number of transactions to fetch (default: 20, max: 100)
 * @param before - Signature to fetch transactions before
 */
export async function getAddressTransactions(
    address: string,
    limit: number = 20,
    before?: string
): Promise<HeliusTransactionsResponse> {
    if (!HELIUS_API_KEY) {
        logger.error(LogCode.SYS_ERROR, 'Helius API key not configured');
        return { transactions: [] };
    }

    try {
        const url = `${HELIUS_BASE_URL}/v0/addresses/${address}/transactions`;
        const params = new URLSearchParams({
            'api-key': HELIUS_API_KEY,
            limit: Math.min(limit, 100).toString(),
        });

        if (before) {
            params.append('before', before);
        }

        const data = await unifiedApiService.fetchJson<any>({
            url: `${url}?${params.toString()}`,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: 10000,
            endpointName: 'api.helius.xyz'
        });

        if (Array.isArray(data)) {
            return { transactions: data as HeliusTransaction[] };
        }

        if (data && Array.isArray(data.transactions)) {
            return data as HeliusTransactionsResponse;
        }

        logger.warn(LogCode.API_FETCH_FAILED, 'Helius response missing transactions array', {
            address: address.slice(0, 10),
        });
        return { transactions: [] };
    } catch (error: any) {
        logger.error(LogCode.API_FETCH_FAILED, 'Error fetching address transactions from Helius', { error: error.message });
        return { transactions: [] };
    }
}

/**
 * Get fungible token balances via Helius DAS (getAssetsByOwner)
 */
export async function getFungibleTokenBalances(
    address: string,
    limit: number = 200
): Promise<{ tokens: HeliusFungibleTokenBalance[]; nativeBalance?: number }> {
    if (!HELIUS_API_KEY) {
        logger.error(LogCode.SYS_ERROR, 'Helius API key not configured');
        return { tokens: [] };
    }

    const tokens: HeliusFungibleTokenBalance[] = [];
    let page = 1;
    const perPage = Math.min(limit, 100);
    let total = 0;
    let nativeBalance: number | undefined;

    try {
        do {
            const result = await callRpc<any>(
                'solana',
                'getAssetsByOwner',
                {
                    ownerAddress: address,
                    page,
                    limit: perPage,
                    options: { showFungible: true, showNativeBalance: true },
                },
                { strategy: 'fast', importance: 'critical' }
            );
            if (!result || !Array.isArray(result.items)) break;

            total = typeof result.total === 'number' ? result.total : total;
            if (typeof result.nativeBalance === 'number') {
                nativeBalance = result.nativeBalance;
            }

            for (const item of result.items) {
                if (item?.interface !== 'FungibleToken') continue;
                const tokenInfo = item?.token_info;
                const balance = tokenInfo?.balance;
                const decimals = typeof tokenInfo?.decimals === 'number' ? tokenInfo.decimals : 0;
                if (balance === undefined || balance === null || balance === 0) continue;

                tokens.push({
                    mint: item.id,
                    balance: String(balance),
                    decimals,
                    symbol: item?.content?.metadata?.symbol || 'UNKNOWN',
                    name: item?.content?.metadata?.name || 'Unknown Token',
                    logo: item?.content?.links?.image,
                });
            }

            page += 1;
        } while (tokens.length < limit && page * perPage < total);

        return { tokens, nativeBalance };
    } catch (error: any) {
        logger.error(LogCode.API_FETCH_FAILED, 'Helius DAS token balances failed', {
            error: error.message,
        });
        return { tokens: [] };
    }
}

/**
 * Get parsed transaction details
 * @param signature - Transaction signature
 */
export async function getTransaction(signature: string): Promise<HeliusTransaction | null> {
    if (!HELIUS_API_KEY) {
        logger.error(LogCode.SYS_ERROR, 'Helius API key not configured');
        return null;
    }

    try {
        const url = `${HELIUS_BASE_URL}/v0/transactions`;
        const params = new URLSearchParams({
            'api-key': HELIUS_API_KEY,
        });

        const data = await unifiedApiService.fetchJson<any[]>({
            url: `${url}?${params.toString()}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                transactions: [signature],
            }),
            timeout: 10000,
            endpointName: 'api.helius.xyz'
        });
        return data[0] || null;
    } catch (error: any) {
        logger.error(LogCode.API_FETCH_FAILED, 'Error fetching transaction from Helius', { error: error.message, signature: signature.slice(0, 10) });
        return null;
    }
}

/**
 * Get multiple parsed transactions in a single batch API call
 * @param signatures - Array of transaction signatures (max 100)
 */
export async function getTransactionsBatch(signatures: string[]): Promise<HeliusTransaction[]> {
    if (!HELIUS_API_KEY) {
        logger.error(LogCode.SYS_ERROR, 'Helius API key not configured');
        return [];
    }

    if (signatures.length === 0) return [];

    try {
        const url = `${HELIUS_BASE_URL}/v0/transactions`;
        const params = new URLSearchParams({
            'api-key': HELIUS_API_KEY,
        });

        // Helius supports up to 100 transactions per batch
        const batchSize = Math.min(signatures.length, 100);
        logger.debug(LogCode.API_FETCH_SUCCESS, 'Batch parsing transactions via Helius', { count: batchSize });

        const data = await unifiedApiService.fetchJson<HeliusTransaction[]>({
            url: `${url}?${params.toString()}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                transactions: signatures.slice(0, 100),
            }),
            timeout: 30000,
            endpointName: 'api.helius.xyz'
        });
        logger.info(LogCode.API_FETCH_SUCCESS, 'Helius batch parsed successfully', { count: data.length });
        return data;
    } catch (error: any) {
        logger.error(LogCode.API_FETCH_FAILED, 'Error batch fetching transactions from Helius', { error: error.message });
        return [];
    }
}

/**
 * Check if Helius is configured
 */
export function isHeliusConfigured(): boolean {
    return !!HELIUS_API_KEY && HELIUS_API_KEY.length > 0;
}

/**
 * Get the EARLIEST transactions for a Solana address (oldest-first)
 * Uses Helius enhanced API with chronological sorting
 * @param address - Solana mint or wallet address
 * @param limit - Number of transactions to fetch (default: 100)
 */
export async function getEarliestTransactionsForAddress(
    address: string,
    limit: number = 100
): Promise<HeliusTransaction[]> {
    if (!HELIUS_API_KEY) {
        logger.error(LogCode.SYS_ERROR, 'Helius API key not configured');
        return [];
    }

    try {
        // Helius Enhanced Transactions API with chronological sorting
        const url = `${HELIUS_BASE_URL}/v0/addresses/${address}/transactions`;
        const params = new URLSearchParams({
            'api-key': HELIUS_API_KEY,
            'limit': Math.min(limit, 100).toString(),
            'type': 'TRANSFER', // Focus on token transfers
        });

        logger.debug(LogCode.API_FETCH_SUCCESS, 'Fetching earliest transactions from Helius', { address: address.slice(0, 10) });

        const data = await unifiedApiService.fetchJson<HeliusTransaction[]>({
            url: `${url}?${params.toString()}`,
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000,
            endpointName: 'api.helius.xyz'
        });

        // Sort by timestamp ascending (oldest first)
        const sorted = data.sort((a, b) => a.timestamp - b.timestamp);

        logger.info(LogCode.API_FETCH_SUCCESS, 'Helius earliest transactions fetched', {
            count: sorted.length,
            oldest: sorted[0]?.timestamp ? new Date(sorted[0].timestamp * 1000).toISOString() : 'N/A'
        });

        return sorted;
    } catch (error: any) {
        logger.error(LogCode.API_FETCH_FAILED, 'Error fetching earliest transactions from Helius', { error: error.message });
        return [];
    }
}
/**
 * Get largest token accounts for a given mint
 * @param mint - Solana token mint address
 */
export async function getTokenLargestAccounts(mint: string): Promise<any[]> {
    if (!HELIUS_API_KEY) {
        logger.error(LogCode.SYS_ERROR, 'Helius API key not configured');
        return [];
    }

    try {
        const data = await callRpc<any>('solana', 'getTokenLargestAccounts', [mint], { strategy: 'cheap' });
        return data?.value || [];
    } catch (error: any) {
        logger.error(LogCode.API_FETCH_FAILED, 'Error fetching largest token accounts from Helius', { error: error.message, mint });
        return [];
    }
}

/**
 * Get owners for multiple token accounts in a single batch
 * @param accountAddresses - Array of token account addresses
 */
export async function getAccountOwnersBatch(accountAddresses: string[]): Promise<Record<string, string>> {
    if (!HELIUS_API_KEY || accountAddresses.length === 0) return {};

    try {
        const results: Record<string, string> = {};
        const chunkSize = 20;
        for (let i = 0; i < accountAddresses.length; i += chunkSize) {
            const batch = accountAddresses.slice(i, i + chunkSize);
            const responses = await Promise.all(batch.map(addr =>
                callRpc<any>('solana', 'getAccountInfo', [addr, { encoding: 'jsonParsed' }], { strategy: 'cheap' })
                    .then(res => ({ addr, res }))
                    .catch(() => ({ addr, res: null }))
            ));
            responses.forEach(({ addr, res }) => {
                const owner = res?.value?.data?.parsed?.info?.owner;
                if (owner) {
                    results[addr] = owner;
                }
            });
        }

        return results;
    } catch (error: any) {
        logger.error(LogCode.API_FETCH_FAILED, 'Error fetching account owners batch from Helius', { error: error.message });
        return {};
    }
}

export interface HeliusAsset {
    id: string;
    symbol: string;
    name: string;
    decimals: number;
    logo?: string;
}

/**
 * Get multiple assets (tokens, NFTs) by ID (mint address) via Helius DAS API
 * Limit: 1000 IDs per call
 */
export async function getAssetBatch(ids: string[]): Promise<HeliusAsset[]> {
    if (!HELIUS_API_KEY || ids.length === 0) return [];

    try {
        const result = await callRpc<any>(
            'solana',
            'getAssetBatch',
            { ids: ids.slice(0, 1000) },
            { strategy: 'fast', importance: 'critical' }
        );

        if (result && Array.isArray(result)) {
            return result.map((item: any) => ({
                id: item.id,
                symbol: item.content?.metadata?.symbol || 'UNKNOWN',
                name: item.content?.metadata?.name || 'Unknown Asset',
                decimals: item.token_info?.decimals || 0,
                logo: item.content?.links?.image
            }));
        }
        return [];
    } catch (error: any) {
        logger.error(LogCode.API_FETCH_FAILED, 'Helius DAS getAssetBatch failed', { error: error.message });
        return [];
    }
}
