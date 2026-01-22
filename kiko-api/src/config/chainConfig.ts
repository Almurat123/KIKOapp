import { env } from './env.js';

export interface ChainConfig {
    id: number;
    name: string;
    rpcUrls: string[]; // Array of RPCs for fallback
    nativeCurrency: {
        name: string;
        symbol: string;
        decimals: number;
    };
    wrappedNativeAddress: string; // WETH, WBNB, etc.
    stablecoins: string[];   // USDC, USDT, DAI etc.
    explorerUrl: string;
    contracts: {
        zeroExProxy: string; // 0x Exchange Proxy
        permit2?: string;    // Uniswap Permit2 (optional)
        kyberRouter?: string;// KyberSwap MetaAggregationRouterV2 (optional)
    };
    slugs: {                 // Upstream API slugs
        dexScreener: string;
        geckoTerminal: string;
    };
    apiUrl?: string;         // Alchemy, Infura, etc. specific endpoint
}

// Helper to build RPC array with fallbacks
const buildRpcList = (primaryEnv?: string, chainPath?: string, compatibilityPath?: string): string[] => {
    const rpcs: string[] = [];

    // 1. Primary Provider (e.g. Alchemy, Infura from ENV)
    if (primaryEnv) rpcs.push(primaryEnv);

    // 2. Ankr (High performance backup) if key exists
    if (env.apiKeys.ankr && chainPath) {
        rpcs.push(`https://rpc.ankr.com/${chainPath}/${env.apiKeys.ankr}`);
    }

    // 3. Public/DRPC Community Nodes
    if (compatibilityPath) {
        rpcs.push(`https://${compatibilityPath}.drpc.org`);
        rpcs.push(`https://${compatibilityPath}-rpc.publicnode.com`);
    }

    return rpcs;
};

export const CHAINS: Record<number, ChainConfig> = {
    // Ethereum Mainnet
    1: {
        id: 1,
        name: 'Ethereum',
        rpcUrls: buildRpcList(
            process.env.ETH_RPC_URL,
            'eth',
            'eth'
        ),
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        wrappedNativeAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        stablecoins: [
            '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
            '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
            '0x6b175474e89094c44da98b954eedeac495271d0f'  // DAI
        ],
        explorerUrl: 'https://etherscan.io',
        contracts: {
            zeroExProxy: '0xdef1c0ded9bec7f1a1670819833240faca6db2a2', // Standard 0x Proxy
            permit2: '0x000000000022d473030f116ddee9dad608d18000',
            kyberRouter: '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5'
        },
        slugs: { dexScreener: 'ethereum', geckoTerminal: 'eth' }
    },
    // Base
    8453: {
        id: 8453,
        name: 'Base',
        rpcUrls: buildRpcList(
            process.env.BASE_RPC_URL,
            'base',
            'base'
        ),
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        wrappedNativeAddress: '0x4200000000000000000000000000000000000006',
        stablecoins: [
            '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC
            '0x50c5725949a6f0c72e6c4a641f24049a917db0cb'  // DAI
        ],
        explorerUrl: 'https://basescan.org',
        contracts: {
            zeroExProxy: '0xdef1c0ded9bec7f1a1670819833240faca6db2a2',
            permit2: '0x000000000022d473030f116ddee9dad608d18000',
            kyberRouter: '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5'
        },
        apiUrl: process.env.ALCHEMY_BASE_URL,
        slugs: { dexScreener: 'base', geckoTerminal: 'base' }
    },
    // BNB Smart Chain
    56: {
        id: 56,
        name: 'BNB Smart Chain',
        rpcUrls: buildRpcList(
            process.env.BSC_RPC_URL,
            'bsc',
            'bsc'
        ),
        nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
        wrappedNativeAddress: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
        stablecoins: [
            '0x55d398326f99059ff775485246999027b3197955', // USDT (BSC-USD)
            '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', // USDC
            '0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3'  // DAI
        ],
        explorerUrl: 'https://bscscan.com',
        contracts: {
            zeroExProxy: '0xdef1c0ded9bec7f1a1670819833240faca6db2a2', // Same on BSC
            permit2: '0x000000000022d473030f116ddee9dad608d18000',
            kyberRouter: '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5'
        },
        apiUrl: 'https://bnb-mainnet.g.alchemy.com/v2', // Alchemy BNB endpoint
        slugs: { dexScreener: 'bsc', geckoTerminal: 'bsc' }
    },
    // Solana
    900: {
        id: 900,
        name: 'Solana',
        rpcUrls: [
            process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
            env.apiKeys.helius ? `https://mainnet.helius-rpc.com/?api-key=${env.apiKeys.helius}` : '',
            env.apiKeys.ankr ? `https://rpc.ankr.com/solana/${env.apiKeys.ankr}` : '',
            'https://solana.drpc.org'
        ].filter(Boolean),
        nativeCurrency: { name: 'Solana', symbol: 'SOL', decimals: 9 },
        wrappedNativeAddress: 'So11111111111111111111111111111111111111112', // Native SOL Mint
        stablecoins: [
            'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
            'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'  // USDT
        ],
        explorerUrl: 'https://solscan.io',
        contracts: {
            zeroExProxy: '',
            permit2: '',
            kyberRouter: ''
        },
        slugs: { dexScreener: 'solana', geckoTerminal: 'solana' }
    }
};

export function getChainConfig(chainId: number): ChainConfig {
    const config = CHAINS[chainId];
    if (!config) {
        throw new Error(`Unsupported chain ID: ${chainId}`);
    }
    return config;
}

export function getChainSlug(chainId: number): { dexScreener: string; geckoTerminal: string } {
    const config = CHAINS[chainId];
    if (config?.slugs) {
        return config.slugs;
    }
    return { dexScreener: 'ethereum', geckoTerminal: 'eth' };
}

// ============================================================================
// Provider Singleton Cache
// ============================================================================
import { ethers } from 'ethers';

const providerCache = new Map<number, ethers.JsonRpcProvider>();

/**
 * Get a cached JsonRpcProvider for the given chain ID.
 * Creates a new provider on first access using the PRIMARY RPC.
 * TODO: Integrate RpcManager for true fallback support at the provider level if needed.
 */
export function getProvider(chainId: number): ethers.JsonRpcProvider {
    if (!providerCache.has(chainId)) {
        const config = getChainConfig(chainId);
        // Default to the first (primary) RPC for standard provider access
        const provider = new ethers.JsonRpcProvider(config.rpcUrls[0], chainId);
        providerCache.set(chainId, provider);
    }
    return providerCache.get(chainId)!;
}
