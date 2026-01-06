export interface ChainConfig {
    id: number;
    name: string;
    rpcUrl: string;
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
    apiUrl?: string;         // Alchemy, Infura, etc. specific endpoint
}

export const CHAINS: Record<number, ChainConfig> = {
    // Ethereum Mainnet
    1: {
        id: 1,
        name: 'Ethereum',
        rpcUrl: process.env.ETH_RPC_URL || 'https://eth.llamarpc.com',
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
        }
    },
    // Base
    8453: {
        id: 8453,
        name: 'Base',
        rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
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
        apiUrl: process.env.ALCHEMY_BASE_URL // Reuse existing env var for Alchemy
    },
    // Binance Smart Chain (BNB)
    56: {
        id: 56,
        name: 'BNB Smart Chain',
        rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
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
        apiUrl: 'https://bnb-mainnet.g.alchemy.com/v2' // Alchemy BNB endpoint
    },
    // Solana
    900: {
        id: 900,
        name: 'Solana',
        rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
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
        }
    }
};

export function getChainConfig(chainId: number): ChainConfig {
    const config = CHAINS[chainId];
    if (!config) {
        throw new Error(`Unsupported chain ID: ${chainId}`);
    }
    return config;
}
