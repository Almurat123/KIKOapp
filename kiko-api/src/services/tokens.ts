
// Common token mappings by chain for popular tokens
// This allows resolving symbols like "ETH", "USDC" to contract addresses
export const COMMON_TOKENS: Record<number, Record<string, string>> = {
    // Ethereum Mainnet (chainId: 1)
    1: {
        'ETH': '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        'WETH': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        'USDC': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        'USDT': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        'DAI': '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        'WBTC': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    },
    // Base (chainId: 8453)
    8453: {
        'ETH': '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        'BASE': '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        'WETH': '0x4200000000000000000000000000000000000006',
        'USDC': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        'USDbC': '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', // Bridged USDC
        'DAI': '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
        'CBETH': '0x2Ae3F1Ec7F1F5012CFe74b7fF97e2b5A0f0A5E9F',
    },
    // BSC (chainId: 56)
    56: {
        'BNB': '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        'WBNB': '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
        'USDC': '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
        'USDT': '0x55d398326f99059fF775485246999027B3197955',
        'BUSD': '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
    },
    // Arbitrum (chainId: 42161)
    42161: {
        'ETH': '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        'WETH': '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
        'USDC': '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        'USDC.e': '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
        'USDT': '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
        'ARB': '0x912CE59144191C1204E64559FE8253a0e49E6548',
    },
    // Polygon (chainId: 137)
    137: {
        'POL': '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        'MATIC': '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        'WMATIC': '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
        'USDC': '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', // Native USDC
        'USDC.e': '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        'USDT': '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
        'DAI': '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    },
};

/**
 * Check if an address is the native token placeholder
 */
export function isNativeToken(address?: string | null): boolean {
    if (!address) return false;
    const normalized = address.toLowerCase();
    return normalized === '0x0000000000000000000000000000000000000000' ||
        normalized === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ||
        normalized === 'eth' ||
        normalized === 'bnb' ||
        normalized === 'matic' ||
    normalized === 'pol' ||
        normalized === 'base' ||
        normalized === 'sol';
}

/**
 * Resolve a token symbol (e.g. "USDC") or address to a valid contract address
 */
export function resolveTokenAddress(token: string, chainId: number): string {
    if (!token) return '';

    // If already an address (starts with 0x and correct length), return normalized
    if (token.startsWith('0x') && token.length === 42) {
        return token; // Return as-is, let normalize handle casing later if needed
    }

    // Check common tokens mapping
    const chainTokens = COMMON_TOKENS[chainId] || {};
    const upperToken = token.toUpperCase();

    if (chainTokens[upperToken]) {
        return chainTokens[upperToken];
    }

    // Return as-is if not found (caller should handle validation)
    return token;
}

/**
 * Normalize a token address to a standard format (0xEeee... for native)
 */
export function normalizeTokenAddress(address: string): string {
    if (!address) return '';

    if (isNativeToken(address)) {
        return '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    }


    return address;
}

/**
 * Get known decimals for common tokens to prevent metadata fetch failures
 * Returns undefined if unknown, allowing caller to fallback to RPC/API
 */
export function getKnownTokenDecimals(address: string, chainId: number): number | undefined {
    if (!address) return undefined;

    const lowerAddr = address.toLowerCase();

    // Base (8453)
    if (chainId === 8453) {
        // USDC
        if (lowerAddr === '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913') return 6;
        // USDbC
        if (lowerAddr === '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca') return 6;
    }

    // Ethereum (1)
    if (chainId === 1) {
        // USDC
        if (lowerAddr === '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48') return 6;
        // USDT
        if (lowerAddr === '0xdac17f958d2ee523a2206206994597c13d831ec7') return 6;
    }

    // Arbitrum (42161)
    if (chainId === 42161) {
        // USDC (Native)
        if (lowerAddr === '0xaf88d065e77c8cc2239327c5edb3a432268e5831') return 6;
        // USDC.e (Bridged)
        if (lowerAddr === '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8') return 6;
        // USDT
        if (lowerAddr === '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9') return 6;
    }

    // Optimism (10)
    if (chainId === 10) {
        // USDC (Native)
        if (lowerAddr === '0x0b2c639c533813f4aa9d7837caf99719afbebd3f') return 6;
        // USDC.e (Bridged)
        if (lowerAddr === '0x7f5c764cbc14f9669b88837ca1490cca17c31607') return 6;
        // USDT
        if (lowerAddr === '0x94b008aa00579c1307b0ef2c499ad98a8ce68e05') return 6;
    }

    // Polygon (137)
    if (chainId === 137) {
        // USDC (Native)
        if (lowerAddr === '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359') return 6;
        // USDC.e (Bridged)
        if (lowerAddr === '0x2791bca1f2de4661ed88a30c99a7a9449aa84174') return 6;
        // USDT
        if (lowerAddr === '0xc2132d05d31c914a87c6611c10748aeb04b58e8f') return 6;
    }

    return undefined;
}
