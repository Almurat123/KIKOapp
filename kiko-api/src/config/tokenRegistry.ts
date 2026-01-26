
/**
 * Unified Token Registry
 * Centralized mapping for common tokens across EVM and Solana.
 */

export const NATIVE_TOKEN_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
export const SOLANA_NATIVE_MINT = 'So11111111111111111111111111111111111111112';

export interface TokenEntry {
    symbol: string;
    name: string;
    decimals: number;
    addresses: Record<number, string>; // chainId -> address
}

export const SPL_TOKEN_METADATA: Record<string, { symbol: string; name: string; decimals: number }> = {
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', name: 'Tether USD', decimals: 6 },
    'So11111111111111111111111111111111111111112': { symbol: 'SOL', name: 'Solana', decimals: 9 }
};

export const TOKEN_REGISTRY: Record<string, TokenEntry> = {
    'SOL': {
        symbol: 'SOL',
        name: 'Solana',
        decimals: 9,
        addresses: {
            900: SOLANA_NATIVE_MINT, // Solana
        }
    },
    'ETH': {
        symbol: 'ETH',
        name: 'Ether',
        decimals: 18,
        addresses: {
            1: NATIVE_TOKEN_ADDRESS,     // Ethereum
            8453: NATIVE_TOKEN_ADDRESS,  // Base
            42161: NATIVE_TOKEN_ADDRESS, // Arbitrum
            10: NATIVE_TOKEN_ADDRESS,    // Optimism
        }
    },
    'USDC': {
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        addresses: {
            1: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            8453: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
            137: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
            42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
            900: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // Solana
        }
    },
    'USDT': {
        symbol: 'USDT',
        name: 'Tether USD',
        decimals: 6,
        addresses: {
            1: '0xdac17f958d2ee523a2206206994597c13d831ec7',
            137: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
            56: '0x55d398326f99059ff775485246999027b3197955',
            900: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // Solana
        }
    },
    'WETH': {
        symbol: 'WETH',
        name: 'Wrapped Ether',
        decimals: 18,
        addresses: {
            1: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            8453: '0x4200000000000000000000000000000000000006',
            42161: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
            10: '0x4200000000000000000000000000000000000006',
        }
    }
};

/**
 * Helper to get token decimals by address and chain
 */
export function getTokenDecimalsFromRegistry(address: string, chainId: number): number | null {
    const addrLower = address.toLowerCase();
    for (const token of Object.values(TOKEN_REGISTRY)) {
        if (token.addresses[chainId]?.toLowerCase() === addrLower) {
            return token.decimals;
        }
    }
    return null;
}

/**
 * Helper to check if an address is the native token for a given chain
 */
export function isNativeToken(address: string, chainId: number): boolean {
    const addrLower = address.toLowerCase();
    if (chainId === 900) {
        return addrLower === SOLANA_NATIVE_MINT.toLowerCase() || addrLower === 'sol';
    }
    // Check for various native token formats: address, zero address, or symbol
    return addrLower === NATIVE_TOKEN_ADDRESS || 
           addrLower === '0x0000000000000000000000000000000000000000' ||
           addrLower === 'eth' ||
           addrLower === 'ether';
}
