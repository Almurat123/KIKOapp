/**
 * Solana On-Chain Price Service
 * Uses Jupiter Quote API to get Solana token prices
 * Note: Solana doesn't use traditional RPC for price (no EVM eth_call)
 */

import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { callRpc } from './rpcManager.js';

interface JupiterQuoteResponse {
    data: {
        [tokenMint: string]: {
            id: string;
            mintSymbol: string;
            vsToken: string;
            vsTokenSymbol: string;
            price: number;
        };
    };
}

/**
 * Get Solana token price using Jupiter Price API
 * @param tokenAddress - Solana token mint address
 * @returns Price in USD
 */
export async function getSolanaTokenPrice(tokenAddress: string): Promise<number | null> {
    try {
        // Jupiter Price V2 API
        const url = `https://api.jup.ag/price/v2?ids=${tokenAddress}`;

        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            logger.debug(LogCode.API_FETCH_FAILED, 'Jupiter price API failed', {
                status: response.status,
                token: tokenAddress
            });
            return null;
        }

        const data: JupiterQuoteResponse = await response.json();

        if (!data.data || !data.data[tokenAddress]) {
            logger.debug(LogCode.API_FETCH_FAILED, 'No price data from Jupiter', {
                token: tokenAddress
            });
            return null;
        }

        const price = data.data[tokenAddress].price;

        if (price && price > 0) {
            logger.info(LogCode.API_FETCH_SUCCESS, 'Solana price fetched from Jupiter', {
                token: tokenAddress,
                price
            });
            return price;
        }

        return null;
    } catch (err: any) {
        logger.warn(LogCode.API_FETCH_FAILED, 'Jupiter API error', {
            error: err.message,
            token: tokenAddress
        });
        return null;
    }
}

/**
 * Get Solana token info including price and market cap
 * Uses Jupiter + Solana RPC for comprehensive data
 */
export async function getSolanaTokenInfo(tokenAddress: string): Promise<{
    price: number;
    marketCap: number;
    provider: string;
} | null> {
    try {
        // Get price from Jupiter
        const price = await getSolanaTokenPrice(tokenAddress);

        if (!price) {
            return null;
        }

        // Try to get supply from Solana RPC
        let marketCap = 0;
        try {
            const data = await callRpc<any>('solana', 'getTokenSupply', [tokenAddress], { strategy: 'cheap' });
            if (data?.value) {
                const supply = Number(data.value.amount);
                const decimals = data.value.decimals;
                const totalSupply = supply / Math.pow(10, decimals);
                marketCap = totalSupply * price;
            }
        } catch (supplyErr: any) {
            logger.debug(LogCode.API_FETCH_FAILED, 'Failed to get Solana token supply', {
                error: supplyErr.message,
                token: tokenAddress
            });
            // Market cap remains 0
        }

        return {
            price,
            marketCap,
            provider: 'Jupiter API'
        };
    } catch (err: any) {
        logger.warn(LogCode.API_FETCH_FAILED, 'Solana token info fetch failed', {
            error: err.message,
            token: tokenAddress
        });
        return null;
    }
}
