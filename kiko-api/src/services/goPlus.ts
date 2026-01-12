/**
 * GoPlus Security API Service
 * Documentation: https://docs.gopluslabs.io/
 */

import { env } from '../config/env.js';

const GOPLUS_BASE_URL = 'https://api.gopluslabs.io/api/v1';
const API_KEY = env.apiKeys.goplus;

/**
 * Chain ID mapping for GoPlus
 */
const GOPLUS_CHAIN_MAP: Record<string, string> = {
    'eth': '1',
    'ethereum': '1',
    'bsc': '56',
    'base': '8453',
    'arbitrum': '42161',
    'optimism': '10',
    'polygon': '137',
};

const GOPLUS_SOLANA_CHAIN = 'solana';

export interface GoPlusTokenSecurity {
    holder_count: string;
    is_honeypot: string;
    buy_tax: string;
    sell_tax: string;
    cannot_buy: string;
    cannot_sell_all: string;
    slippage_modifiable: string;
    is_blacklisted: string;
    is_whitelisted: string;
    owner_address: string;
    creator_address: string;
    is_proxy: string;
    is_mintable: string;
    can_take_back_ownership: string;
    owner_change_balance: string;
    [key: string]: any;
}

/**
 * Get token security info and holder count from GoPlus
 */
export async function getTokenSecurity(network: string, address: string): Promise<GoPlusTokenSecurity | null> {
    const isSolana = network.toLowerCase() === 'solana' || network.toLowerCase() === 'sol';
    const chainId = isSolana ? GOPLUS_SOLANA_CHAIN : (GOPLUS_CHAIN_MAP[network.toLowerCase()] || network);

    try {
        const endpoint = isSolana ? 'solana/token_security' : `token_security/${chainId}`;
        const url = `${GOPLUS_BASE_URL}/${endpoint}?contract_addresses=${address}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                ...(API_KEY ? { 'access-token': API_KEY } : {}),
            },
        });

        if (!response.ok) {
            console.error(`[GoPlus] API error ${response.status}: ${response.statusText}`);
            return null;
        }

        const data = await response.json();

        // GoPlus returns data in format: { code: 1, message: "OK", result: { "0x...": { ... } } }
        if (data.code === 1 && data.result && data.result[address.toLowerCase()]) {
            return data.result[address.toLowerCase()] as GoPlusTokenSecurity;
        }

        // Case-insensitive fallback
        const resultKey = Object.keys(data.result || {}).find(k => k.toLowerCase() === address.toLowerCase());
        if (resultKey) {
            return data.result[resultKey] as GoPlusTokenSecurity;
        }

        return null;
    } catch (error: any) {
        console.error(`[GoPlus] Error fetching security for ${address}:`, error.message);
        return null;
    }
}

/**
 * Get holder count specifically
 */
export async function getHolderCount(network: string, address: string): Promise<number | null> {
    const security = await getTokenSecurity(network, address);
    if (security && security.holder_count) {
        return parseInt(security.holder_count, 10);
    }
    return null;
}

export const goPlusService = {
    getTokenSecurity,
    getHolderCount,
};

export default goPlusService;
