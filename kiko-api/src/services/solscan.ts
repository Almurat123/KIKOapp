/**
 * Solscan API Service
 * Backup provider for Solana transaction history
 * Docs: https://pro-api.solscan.io/pro-api-v2
 */

import { env } from '../config/env.js';

const SOLSCAN_API_KEY = env.apiKeys.solscan || process.env.SOLSCAN_API_KEY || '';
const BASE_URL = 'https://pro-api.solscan.io/v2.0';

export interface SolscanTransaction {
    tx_hash: string;
    slot: number;
    block_time: number;
    fee: number;
    signer: string[];
    status: string;
    parsed_instructions?: any[];
}

export interface SolscanResponse {
    success: boolean;
    data: SolscanTransaction[];
}

/**
 * Get transaction history for an address on Solana
 */
export async function getAddressTransactions(
    address: string,
    limit: number = 20,
    before?: string
): Promise<SolscanResponse> {
    if (!SOLSCAN_API_KEY) {
        console.warn('[Solscan] API key not configured.');
        return { success: false, data: [] };
    }

    try {
        const params = new URLSearchParams({
            address,
            limit: Math.min(limit, 40).toString(), // Solscan usually limits to 40 per request
        });

        if (before) {
            params.append('before', before);
        }

        const response = await fetch(`${BASE_URL}/account/transactions?${params.toString()}`, {
            headers: {
                'token': SOLSCAN_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.error(`[Solscan] Error ${response.status}: ${response.statusText}`);
            return { success: false, data: [] };
        }

        const data = await response.json();
        return data as SolscanResponse;
    } catch (error: any) {
        console.error('[Solscan] Error fetching transactions:', error.message);
        return { success: false, data: [] };
    }
}

/**
 * Check if Solscan is configured
 */
export function isConfigured(): boolean {
    return !!SOLSCAN_API_KEY;
}

export interface SolscanTokenTransfer {
    tx_hash: string;
    block_time: number;
    from_address: string;
    to_address: string;
    amount: number;
    token_address: string;
    token_decimals: number;
}

export interface SolscanTokenTransferResponse {
    success: boolean;
    data: SolscanTokenTransfer[];
}

/**
 * Get token transfers for a specific token - supports ascending sort (oldest first)
 * This is the key function for finding earliest buyers!
 * @param tokenAddress - Solana token mint address
 * @param limit - Number of transfers to fetch (max 100)
 * @param sortOrder - 'asc' for oldest first, 'desc' for newest first
 */
export async function getTokenTransfers(
    tokenAddress: string,
    limit: number = 50,
    sortOrder: 'asc' | 'desc' = 'asc'
): Promise<SolscanTokenTransferResponse> {
    if (!SOLSCAN_API_KEY) {
        console.warn('[Solscan] API key not configured.');
        return { success: false, data: [] };
    }

    try {
        const params = new URLSearchParams({
            address: tokenAddress,
            page_size: Math.min(limit, 100).toString(),
            sort_by: 'block_time',
            sort_order: sortOrder, // 'asc' = oldest first!
        });

        const url = `${BASE_URL}/token/transfer?${params.toString()}`;
        console.log(`[Solscan] Fetching token transfers (${sortOrder}): ${tokenAddress}`);

        const response = await fetch(url, {
            headers: {
                'token': SOLSCAN_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`[Solscan] Error ${response.status}: ${errText}`);
            return { success: false, data: [] };
        }

        const data = await response.json();
        console.log(`[Solscan] Got ${(data as any).data?.length || 0} transfers for token`);
        return data as SolscanTokenTransferResponse;
    } catch (error: any) {
        console.error('[Solscan] Error fetching token transfers:', error.message);
        return { success: false, data: [] };
    }
}
