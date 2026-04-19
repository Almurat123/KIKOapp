"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHAINS = void 0;
exports.getChainConfig = getChainConfig;
exports.getChainSlug = getChainSlug;
exports.getProvider = getProvider;
var apiEndpoints_js_1 = require("./apiEndpoints.js");
// Helper to build RPC array with fallbacks (uses unified API config)
var buildRpcList = function (primaryEnv, chainSlug) {
    if (chainSlug) {
        return (0, apiEndpoints_js_1.getRpcUrlsArray)(chainSlug, primaryEnv);
    }
    // Fallback for chains without unified config yet
    return primaryEnv ? [primaryEnv] : [];
};
exports.CHAINS = {
    // Ethereum Mainnet
    1: {
        id: 1,
        name: 'Ethereum',
        rpcUrls: buildRpcList(process.env.ETH_RPC_URL, 'eth'),
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        wrappedNativeAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        stablecoins: [
            '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
            '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
            '0x6b175474e89094c44da98b954eedeac495271d0f' // DAI
        ],
        explorerUrl: 'https://etherscan.io',
        contracts: {
            zeroExProxy: '0xdef1c0ded9bec7f1a1670819833240faca6db2a2',
            permit2: '0x000000000022d473030f116ddee9dad608d18000',
        },
        gasReserve: '0.01',
        slugs: { dexScreener: 'ethereum', geckoTerminal: 'eth' }
    },
    // Base
    8453: {
        id: 8453,
        name: 'Base',
        rpcUrls: buildRpcList(process.env.BASE_RPC_URL, 'base'),
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        wrappedNativeAddress: '0x4200000000000000000000000000000000000006',
        stablecoins: [
            '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC
            '0x50c5725949a6f0c72e6c4a641f24049a917db0cb' // DAI
        ],
        explorerUrl: 'https://basescan.org',
        contracts: {
            zeroExProxy: '0xdef1c0ded9bec7f1a1670819833240faca6db2a2',
            permit2: '0x000000000022d473030f116ddee9dad608d18000',
        },
        apiUrl: process.env.ALCHEMY_BASE_URL,
        gasReserve: '0.0003',
        slugs: { dexScreener: 'base', geckoTerminal: 'base' }
    },
    // BNB Smart Chain
    56: {
        id: 56,
        name: 'BNB Smart Chain',
        rpcUrls: buildRpcList(process.env.BSC_RPC_URL, 'bsc'),
        nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
        wrappedNativeAddress: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
        stablecoins: [
            '0x55d398326f99059ff775485246999027b3197955', // USDT
            '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', // USDC
            '0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3', // DAI
            '0xe9e7cea3dedca5984780bafc599bd69add087d56', // BUSD
            '0xc5f0f7b66764f6ec8c8dff7ba683102295e16409', // FDUSD
            '0x8d0d000ee44948fc98c9b98a4fa4921476f08b0d' // USD1
        ],
        explorerUrl: 'https://bscscan.com',
        contracts: {
            zeroExProxy: '0xdef1c0ded9bec7f1a1670819833240faca6db2a2',
            permit2: '0x000000000022d473030f116ddee9dad608d18000',
        },
        apiUrl: 'https://bnb-mainnet.g.alchemy.com/v2',
        gasReserve: '0.0001',
        slugs: { dexScreener: 'bsc', geckoTerminal: 'bsc' }
    },
    // Solana  
    900: {
        id: 900,
        name: 'Solana',
        rpcUrls: buildRpcList(process.env.SOLANA_RPC_URL, 'solana'),
        nativeCurrency: { name: 'Solana', symbol: 'SOL', decimals: 9 },
        wrappedNativeAddress: 'So11111111111111111111111111111111111111112',
        stablecoins: [
            'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
            'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' // USDT
        ],
        explorerUrl: 'https://solscan.io',
        contracts: {
            zeroExProxy: '',
            permit2: '',
        },
        gasReserve: '0.005',
        slugs: { dexScreener: 'solana', geckoTerminal: 'solana' }
    },
    // Polygon
    137: {
        id: 137,
        name: 'Polygon',
        rpcUrls: buildRpcList(process.env.POLYGON_RPC_URL, 'polygon'),
        nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
        wrappedNativeAddress: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
        stablecoins: [
            '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', // USDT
            '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', // USDC.e
            '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359' // USDC Native
        ],
        explorerUrl: 'https://polygonscan.com',
        contracts: {
            zeroExProxy: '0xdef1c0ded9bec7f1a1670819833240faca6db2a2',
            permit2: '0x000000000022d473030f116ddee9dad608d18000',
        },
        gasReserve: '0.01',
        slugs: { dexScreener: 'polygon', geckoTerminal: 'polygon_pos' }
    },
    // Arbitrum
    42161: {
        id: 42161,
        name: 'Arbitrum',
        rpcUrls: buildRpcList(process.env.ARBITRUM_RPC_URL, 'arbitrum'),
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        wrappedNativeAddress: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
        stablecoins: [
            '0xaf88d065e77c8cc2239327c5edb3a432268e5831', // USDC
            '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8', // USDC.e
            '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9' // USDT
        ],
        explorerUrl: 'https://arbiscan.io',
        contracts: {
            zeroExProxy: '0xdef1c0ded9bec7f1a1670819833240faca6db2a2',
            permit2: '0x000000000022d473030f116ddee9dad608d18000',
        },
        gasReserve: '0.002',
        slugs: { dexScreener: 'arbitrum', geckoTerminal: 'arbitrum' }
    },
    // Optimism
    10: {
        id: 10,
        name: 'Optimism',
        rpcUrls: buildRpcList(process.env.OPTIMISM_RPC_URL, 'optimism'),
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        wrappedNativeAddress: '0x4200000000000000000000000000000000000006',
        stablecoins: [
            '0x0b2c639c533813f4aa9d7837caf62653d097ff85', // USDC
            '0x7f5c764cbc14f9669b88837ca1490cca17c31607', // USDC.e
            '0x94b008aa00579c1307b0ef2b499ad98a8ce58e58' // USDT
        ],
        explorerUrl: 'https://optimistic.etherscan.io',
        contracts: {
            zeroExProxy: '0xdef1c0ded9bec7f1a1670819833240faca6db2a2',
            permit2: '0x000000000022d473030f116ddee9dad608d18000',
        },
        gasReserve: '0.002',
        slugs: { dexScreener: 'optimism', geckoTerminal: 'optimism' }
    }
};
function getChainConfig(chainId) {
    var config = exports.CHAINS[chainId];
    if (!config) {
        throw new Error("Unsupported chain ID: ".concat(chainId));
    }
    return config;
}
function getChainSlug(chainId) {
    var config = exports.CHAINS[chainId];
    if (config === null || config === void 0 ? void 0 : config.slugs) {
        return config.slugs;
    }
    return { dexScreener: 'ethereum', geckoTerminal: 'eth' };
}
// ============================================================================
// Provider Singleton Cache
// ============================================================================
var rpcManager_js_1 = require("../services/rpcManager.js");
/**
 * Get an ethers provider via rpcManager (统一调度)
 */
function getProvider(chainId) {
    return (0, rpcManager_js_1.getEthersProvider)(chainId);
}
