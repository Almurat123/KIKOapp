import { CHAINS } from '../config/chainConfig.js';

const CHAIN_MAP: Record<string, string> = {
    eth: 'ethereum',
    ethereum: 'ethereum',
    '1': 'ethereum',
    base: 'base',
    '8453': 'base',
    bsc: 'bnb',
    bnb: 'bnb',
    '56': 'bnb',
    polygon: 'polygon',
    '137': 'polygon',
    arbitrum: 'arbitrum',
    '42161': 'arbitrum',
    optimism: 'optimism',
    '10': 'optimism',
    avalanche: 'avalanche_c',
    '43114': 'avalanche_c',
};

const CHAIN_ID_MAP: Record<string, number> = {
    ethereum: 1,
    eth: 1,
    '1': 1,
    base: 8453,
    '8453': 8453,
    bnb: 56,
    bsc: 56,
    '56': 56,
    polygon: 137,
    matic: 137,
    '137': 137,
    arbitrum: 42161,
    '42161': 42161,
    optimism: 10,
    op: 10,
    '10': 10,
    avalanche_c: 43114,
    avalanche: 43114,
    '43114': 43114,
};

const QUOTE_TOKENS = new Set([
    'WBNB', 'BNB', 'ETH', 'WETH', 'USDT', 'USDC', 'DAI', 'FDUSD', 'BUSD', 'USDE',
    'wBNB', 'bnb', 'eth', 'weth', 'usdt', 'usdc', 'dai', 'fdusd', 'busd', 'usde',
    'SOL', 'WSOL', 'USDC.e', 'USDT.e', 'sol', 'wsol',
]);

export function normalizeDuneChain(chain: string): string {
    return CHAIN_MAP[String(chain || '').toLowerCase()] || String(chain || '').toLowerCase();
}

export function getExcludedTokenAddresses(chain: string): Set<string> {
    const key = String(chain || '').toLowerCase();
    const chainId = CHAIN_ID_MAP[key];
    if (!chainId || !CHAINS[chainId]) return new Set();
    const config = CHAINS[chainId];
    const addresses = [config.wrappedNativeAddress, ...(config.stablecoins || [])]
        .filter(Boolean)
        .map((addr) => addr.toLowerCase());
    return new Set(addresses);
}

export function isQuoteToken(tokenSymbol?: string, tokenAddress?: string, chain?: string): boolean {
    if (tokenSymbol && QUOTE_TOKENS.has(tokenSymbol)) return true;
    if (!tokenAddress || !chain) return false;
    return getExcludedTokenAddresses(chain).has(tokenAddress.toLowerCase());
}
