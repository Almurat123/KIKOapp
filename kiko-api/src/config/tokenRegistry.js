"use strict";
/**
 * Unified Token Registry
 * Centralized mapping for common tokens across EVM and Solana.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOKEN_REGISTRY = exports.SPL_TOKEN_METADATA = exports.SOLANA_NATIVE_MINT = exports.NATIVE_TOKEN_ADDRESS = void 0;
exports.getTokenDecimalsFromRegistry = getTokenDecimalsFromRegistry;
exports.isNativeToken = isNativeToken;
exports.NATIVE_TOKEN_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
exports.SOLANA_NATIVE_MINT = 'So11111111111111111111111111111111111111112';
exports.SPL_TOKEN_METADATA = {
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', name: 'Tether USD', decimals: 6 },
    'So11111111111111111111111111111111111111112': { symbol: 'SOL', name: 'Solana', decimals: 9 }
};
exports.TOKEN_REGISTRY = {
    'SOL': {
        symbol: 'SOL',
        name: 'Solana',
        decimals: 9,
        addresses: {
            900: exports.SOLANA_NATIVE_MINT, // Solana
        }
    },
    'ETH': {
        symbol: 'ETH',
        name: 'Ether',
        decimals: 18,
        addresses: {
            1: exports.NATIVE_TOKEN_ADDRESS, // Ethereum
            8453: exports.NATIVE_TOKEN_ADDRESS, // Base
            42161: exports.NATIVE_TOKEN_ADDRESS, // Arbitrum
            10: exports.NATIVE_TOKEN_ADDRESS, // Optimism
        }
    },
    'BNB': {
        symbol: 'BNB',
        name: 'BNB',
        decimals: 18,
        addresses: {
            56: exports.NATIVE_TOKEN_ADDRESS,
        }
    },
    'POL': {
        symbol: 'POL',
        name: 'Polygon',
        decimals: 18,
        addresses: {
            137: exports.NATIVE_TOKEN_ADDRESS,
        }
    },
    'USDC': {
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        addresses: {
            1: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            56: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            10: '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
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
    },
    'WBNB': {
        symbol: 'WBNB',
        name: 'Wrapped BNB',
        decimals: 18,
        addresses: {
            56: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
        }
    }
};
/**
 * Helper to get token decimals by address and chain
 */
function getTokenDecimalsFromRegistry(address, chainId) {
    var _a;
    var addrLower = address.toLowerCase();
    for (var _i = 0, _b = Object.values(exports.TOKEN_REGISTRY); _i < _b.length; _i++) {
        var token = _b[_i];
        if (((_a = token.addresses[chainId]) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === addrLower) {
            return token.decimals;
        }
    }
    return null;
}
/**
 * Helper to check if an address is the native token for a given chain
 */
function isNativeToken(address, chainId) {
    var addrLower = address.toLowerCase();
    if (chainId === 900) {
        return addrLower === exports.SOLANA_NATIVE_MINT.toLowerCase() || addrLower === 'sol';
    }
    // Check for various native token formats: address, zero address, or symbol
    return addrLower === exports.NATIVE_TOKEN_ADDRESS ||
        addrLower === '0x0000000000000000000000000000000000000000' ||
        addrLower === 'eth' ||
        addrLower === 'ether' ||
        addrLower === 'bnb' ||
        addrLower === 'matic' ||
        addrLower === 'pol' ||
        addrLower === 'base';
}
