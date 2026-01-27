/**
 * Solscan API Service (uses unified scan service)
 * Backup provider for Solana transaction history
 * Docs: https://pro-api.solscan.io/pro-api-v2
 */

import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { callSolscan } from '../config/unifiedScanService.js';
import * as unifiedApiService from '../config/unifiedApiService.js';

const SOLSCAN_API_KEY = process.env.SOLSCAN_API_KEY;
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
    try {
        const data = await callSolscan('/transaction/list', {
            address,
            limit: Math.min(limit, 40),
            before
        });
        return data as SolscanResponse;
    } catch (error: any) {
        logger.error(LogCode.SYS_ERROR, 'Solscan: Error fetching transactions', { error: error.message });
        return { success: false, data: [] };
    }
}

/**
 * Check if Solscan is configured
 */
export function isConfigured(): boolean {
    return true; // Using unified scan service with auto failover
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
        logger.warn(LogCode.SYS_INFO, 'Solscan API key not configured');
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
        logger.debug(LogCode.SYS_INFO, 'Solscan: Fetching token transfers', { tokenAddress, sortOrder });



        // # [Logic]: Fetch token transfers via Unified Transport
        // # [Ref]: Docs: https://pro-api.solscan.io/pro-api-v2
        const data = await unifiedApiService.fetchJson<SolscanTokenTransferResponse>({
            url,
            method: 'GET',
            headers: {
                'token': SOLSCAN_API_KEY,
                'Content-Type': 'application/json'
            },
            requestTimeout: 10000,
            endpointName: 'solscan-token-transfers',
            retry: {
                retries: 2,
                minTimeout: 1000
            }
        });

        logger.debug(LogCode.SYS_INFO, 'Solscan: Received token transfers', { tokenAddress, count: data.data?.length || 0 });
        return data;
    } catch (error: any) {
        logger.error(LogCode.SYS_ERROR, 'Solscan: Error fetching token transfers', { error: error.message });
        return { success: false, data: [] };
    }
}
