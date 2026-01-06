/**
 * Helius API Service for Solana
 * Provides transaction history and enhanced RPC features
 * Docs: https://docs.helius.dev/
 */

import { env } from '../config/env.js';

const HELIUS_API_KEY = env.apiKeys.helius || process.env.HELIUS_API_KEY || '';
const HELIUS_BASE_URL = 'https://api.helius.xyz';
console.log('[Helius] Service module loaded');

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
        console.warn('[Helius] No API key configured. Set HELIUS_API_KEY environment variable.');
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

        const response = await fetch(`${url}?${params.toString()}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Helius] API error: ${response.status}`, errorText);
            return { transactions: [] };
        }

        const data = await response.json();
        return data as HeliusTransactionsResponse;
    } catch (error: any) {
        console.error('[Helius] Error fetching address transactions:', error.message);
        return { transactions: [] };
    }
}

/**
 * Get parsed transaction details
 * @param signature - Transaction signature
 */
export async function getTransaction(signature: string): Promise<HeliusTransaction | null> {
    if (!HELIUS_API_KEY) {
        console.warn('[Helius] No API key configured.');
        return null;
    }

    try {
        const url = `${HELIUS_BASE_URL}/v0/transactions`;
        const params = new URLSearchParams({
            'api-key': HELIUS_API_KEY,
        });

        const response = await fetch(`${url}?${params.toString()}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                transactions: [signature],
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Helius] API error: ${response.status}`, errorText);
            return null;
        }

        const data = await response.json() as any[];
        return data[0] || null;
    } catch (error: any) {
        console.error('[Helius] Error fetching transaction:', error.message);
        return null;
    }
}

/**
 * Get multiple parsed transactions in a single batch API call
 * @param signatures - Array of transaction signatures (max 100)
 */
export async function getTransactionsBatch(signatures: string[]): Promise<HeliusTransaction[]> {
    if (!HELIUS_API_KEY) {
        console.warn('[Helius] No API key configured.');
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

        console.log(`[Helius] Batch parsing ${batchSize} transactions...`);

        const response = await fetch(`${url}?${params.toString()}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                transactions: signatures.slice(0, 100),
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Helius] Batch API error: ${response.status}`, errorText);
            return [];
        }

        const data = await response.json() as HeliusTransaction[];
        console.log(`[Helius] Batch parsed ${data.length} transactions successfully`);
        return data;
    } catch (error: any) {
        console.error('[Helius] Error batch fetching transactions:', error.message);
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
        console.warn('[Helius] No API key configured.');
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

        console.log(`[Helius] Fetching earliest transactions for ${address}...`);

        const response = await fetch(`${url}?${params.toString()}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Helius] API error: ${response.status}`, errorText);
            return [];
        }

        const data = await response.json() as HeliusTransaction[];

        // Sort by timestamp ascending (oldest first)
        const sorted = data.sort((a, b) => a.timestamp - b.timestamp);

        console.log(`[Helius] Got ${sorted.length} transactions, oldest: ${sorted[0]?.timestamp ? new Date(sorted[0].timestamp * 1000).toISOString() : 'N/A'}`);

        return sorted;
    } catch (error: any) {
        console.error('[Helius] Error fetching earliest transactions:', error.message);
        return [];
    }
}
/**
 * Get largest token accounts for a given mint
 * @param mint - Solana token mint address
 */
export async function getTokenLargestAccounts(mint: string): Promise<any[]> {
    if (!HELIUS_API_KEY) {
        console.warn('[Helius] No API key configured.');
        return [];
    }

    try {
        const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
        const response = await fetch(HELIUS_RPC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'getTokenLargestAccounts',
                params: [mint]
            })
        });

        if (!response.ok) {
            console.error(`[Helius] RPC error: ${response.status}`);
            return [];
        }

        const data = await response.json() as any;
        return data.result?.value || [];
    } catch (error: any) {
        console.error('[Helius] Error fetching largest token accounts:', error.message);
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
        const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

        // Batch requests for each account
        const batchRequests = accountAddresses.map((addr, idx) => ({
            jsonrpc: '2.0',
            id: idx + 1,
            method: 'getAccountInfo',
            params: [addr, { encoding: 'jsonParsed' }]
        }));

        const response = await fetch(HELIUS_RPC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(batchRequests)
        });

        if (!response.ok) return {};

        const data = await response.json();
        console.log(`[Helius] getAccountOwnersBatch: received response type: ${typeof data}, isArray: ${Array.isArray(data)}`);
        if (Array.isArray(data)) {
            console.log(`[Helius] getAccountOwnersBatch: received ${data.length} responses`);
        } else {
            console.log('[Helius] getAccountOwnersBatch: response is NOT an array:', JSON.stringify(data).slice(0, 200));
        }
        const results: Record<string, string> = {};

        if (Array.isArray(data)) {
            data.forEach((res, idx) => {
                const owner = res.result?.value?.data?.parsed?.info?.owner;
                if (owner) {
                    results[accountAddresses[idx]] = owner;
                }
            });
        }

        return results;
    } catch (error: any) {
        console.error('[Helius] Error fetching account owners batch:', error.message);
        return {};
    }
}
