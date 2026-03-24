
import { searchTokens as searchDexTokens, type DexScreenerToken } from './dexscreener.js';
import {
    findTokenOnAnyChain as findDetectedTokenOnAnyChain,
    getTokenInfo as getDetectedTokenInfo,
    type TokenInfo as DetectedTokenInfo,
} from './ai/tokenDetector.js';

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
        'USDCE': '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
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
        'USDCE': '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        'USDT': '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
        'DAI': '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    },
    // Optimism (chainId: 10)
    10: {
        'ETH': '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        'WETH': '0x4200000000000000000000000000000000000006',
        'USDC': '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
        'USDC.e': '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
        'USDCE': '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
        'USDT': '0x94b008aA00579c1307B0EF2b499aD98a8ce58e58',
        'DAI': '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
        'OP': '0x4200000000000000000000000000000000000042',
    },
    // Solana (chainId: 900)
    900: {
        'SOL': 'So11111111111111111111111111111111111111112',
        'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    },
};

const CHAIN_NATIVE_SYMBOLS: Record<number, string> = {
    1: 'ETH',
    10: 'ETH',
    56: 'BNB',
    137: 'MATIC',
    8453: 'ETH',
    42161: 'ETH',
    900: 'SOL',
};

const TOKEN_LOGO_URI_BY_SYMBOL: Record<string, string> = {
    ETH: '/assets/tokens/eth.png',
    WETH: '/assets/tokens/eth.png',
    SOL: '/assets/tokens/sol.png',
    WSOL: '/assets/tokens/sol.png',
    BNB: '/assets/tokens/bsc.png',
    WBNB: '/assets/tokens/bsc.png',
    MATIC: '/assets/tokens/polygon.png',
    WMATIC: '/assets/tokens/polygon.png',
    POL: '/assets/tokens/polygon.png',
    USDC: '/assets/tokens/usdc.png',
    'USDC.E': '/assets/tokens/usdc.png',
    USDCE: '/assets/tokens/usdc.png',
    USDBC: '/assets/tokens/usdc.png',
    USDT: '/assets/tokens/usdt.png',
    BASE: '/assets/tokens/base.png',
    ARB: '/assets/tokens/arbitrum.png',
    OP: '/assets/tokens/optimism.png',
};

function normalizeSymbolForLookup(token: string): string {
    return String(token || '')
        .trim()
        .replace(/^\$/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

function normalizeDisplaySymbol(symbol: string): string {
    const upper = String(symbol || '').trim().toUpperCase();
    if (!upper) return 'UNKNOWN';
    if (upper === 'USDCE') return 'USDC.e';
    if (upper === 'USDC.E') return 'USDC.e';
    return upper;
}

function isHexAddressLike(token: string): boolean {
    return /^0x[0-9a-fA-F]{40}$/.test(String(token || '').trim());
}

function isSolanaAddressLike(token: string): boolean {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(token || '').trim());
}

function addressesMatch(left: string, right: string): boolean {
    const lhs = String(left || '').trim();
    const rhs = String(right || '').trim();
    if (!lhs || !rhs) return false;
    if (lhs.startsWith('0x') || rhs.startsWith('0x')) {
        return lhs.toLowerCase() === rhs.toLowerCase();
    }
    return lhs === rhs;
}

function getChainNativeSymbol(chainId: number): string {
    return CHAIN_NATIVE_SYMBOLS[chainId] || 'ETH';
}

function shouldPreserveExplicitNativeSymbol(symbol: string, chainId: number): boolean {
    const normalized = normalizeDisplaySymbol(symbol);
    const nativeSymbol = getChainNativeSymbol(chainId);
    if (normalized === nativeSymbol) return true;
    if (chainId === 8453 && normalized === 'BASE') return true;
    if (chainId === 137 && (normalized === 'MATIC' || normalized === 'POL')) return true;
    return false;
}

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
    const rawToken = String(token).trim();
    const cleanedToken = rawToken.replace(/^\$/, '');

    // If already an address (starts with 0x and correct length), return normalized
    if (cleanedToken.startsWith('0x') && cleanedToken.length === 42) {
        const lower = cleanedToken.toLowerCase();
        const chainTokens = COMMON_TOKENS[chainId] || {};
        // Cross-chain symbol alias normalization:
        // If model passes a canonical token address from another chain (e.g. ETH USDC on Base),
        // remap to the same symbol's address on target chain to avoid route-not-found failures.
        const aliasSymbolByAddress: Record<string, string> = {
            // USDC variants
            '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 'USDC', // Ethereum USDC
            '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': 'USDC', // Base USDC
            '0xaf88d065e77c8cc2239327c5edb3a432268e5831': 'USDC', // Arbitrum USDC
            '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359': 'USDC', // Polygon USDC
            '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d': 'USDC', // BSC USDC
            // USDT variants
            '0xdac17f958d2ee523a2206206994597c13d831ec7': 'USDT', // Ethereum USDT
            '0x55d398326f99059ff775485246999027b3197955': 'USDT', // BSC USDT
            '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9': 'USDT', // Arbitrum USDT
            // DAI variants
            '0x6b175474e89094c44da98b954eedeac495271d0f': 'DAI', // Ethereum DAI
            '0x50c5725949a6f0c72e6c4a641f24049a917db0cb': 'DAI', // Base DAI
        };
        const mappedSymbol = aliasSymbolByAddress[lower];
        if (mappedSymbol && chainTokens[mappedSymbol]) {
            return chainTokens[mappedSymbol];
        }
        return cleanedToken; // Return as-is, let normalize handle casing later if needed
    }

    // Check common tokens mapping
    const chainTokens = COMMON_TOKENS[chainId] || {};
    const upperToken = cleanedToken.toUpperCase();
    if (chainTokens[cleanedToken]) return chainTokens[cleanedToken];

    if (chainTokens[upperToken]) {
        return chainTokens[upperToken];
    }

    // Case-insensitive + punctuation-insensitive lookup (e.g. USDC.e / USDC.E / usdce / $usdc).
    const targetNorm = normalizeSymbolForLookup(cleanedToken);
    if (targetNorm) {
        for (const [symbol, address] of Object.entries(chainTokens)) {
            if (normalizeSymbolForLookup(symbol) === targetNorm) {
                return address;
            }
        }
    }

    // Return as-is if not found (caller should handle validation)
    return cleanedToken;
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

export function getKnownTokenLogoURI(symbol?: string | null): string | undefined {
    if (!symbol) return undefined;
    const normalized = normalizeDisplaySymbol(symbol);
    return TOKEN_LOGO_URI_BY_SYMBOL[normalized] || TOKEN_LOGO_URI_BY_SYMBOL[normalized.replace(/[^A-Z0-9]/g, '')];
}

export function resolveCommonTokenDisplay(
    token: string,
    chainId: number
): { symbol: string; logoURI?: string } | null {
    const raw = String(token || '').trim();
    if (!raw) return null;

    if (isNativeToken(raw)) {
        const explicitSymbol = !isHexAddressLike(raw) && shouldPreserveExplicitNativeSymbol(raw, chainId)
            ? normalizeDisplaySymbol(raw)
            : getChainNativeSymbol(chainId);
        return {
            symbol: explicitSymbol,
            logoURI: getKnownTokenLogoURI(explicitSymbol),
        };
    }

    const chainTokens = COMMON_TOKENS[chainId] || {};

    for (const [symbol, address] of Object.entries(chainTokens)) {
        if (addressesMatch(address, raw)) {
            const normalizedSymbol = normalizeDisplaySymbol(symbol);
            return {
                symbol: normalizedSymbol,
                logoURI: getKnownTokenLogoURI(normalizedSymbol),
            };
        }
    }

    for (const tokensBySymbol of Object.values(COMMON_TOKENS)) {
        for (const [symbol, address] of Object.entries(tokensBySymbol)) {
            if (addressesMatch(address, raw)) {
                const normalizedSymbol = normalizeDisplaySymbol(symbol);
                return {
                    symbol: normalizedSymbol,
                    logoURI: getKnownTokenLogoURI(normalizedSymbol),
                };
            }
        }
    }

    if (!isHexAddressLike(raw)) {
        const direct = chainTokens[raw] || chainTokens[raw.toUpperCase()];
        if (direct) {
            const symbol = Object.entries(chainTokens).find(([, address]) => address === direct)?.[0] || raw.toUpperCase();
            const normalizedSymbol = normalizeDisplaySymbol(symbol);
            return {
                symbol: normalizedSymbol,
                logoURI: getKnownTokenLogoURI(normalizedSymbol),
            };
        }

        const targetNorm = normalizeSymbolForLookup(raw);
        if (targetNorm) {
            for (const symbol of Object.keys(chainTokens)) {
                if (normalizeSymbolForLookup(symbol) === targetNorm) {
                    const normalizedSymbol = normalizeDisplaySymbol(symbol);
                    return {
                        symbol: normalizedSymbol,
                        logoURI: getKnownTokenLogoURI(normalizedSymbol),
                    };
                }
            }
        }

        const fallbackSymbol = normalizeDisplaySymbol(raw);
        return {
            symbol: fallbackSymbol,
            logoURI: getKnownTokenLogoURI(fallbackSymbol),
        };
    }

    return null;
}

export interface TokenDisplayMetadata {
    symbol: string;
    logoURI?: string;
}

type TokenDisplayResolverDeps = {
    getDetectedTokenInfo?: typeof getDetectedTokenInfo;
    findDetectedTokenOnAnyChain?: typeof findDetectedTokenOnAnyChain;
    searchDexTokens?: typeof searchDexTokens;
};

function normalizeResolvedSymbol(symbol?: string | null, fallback?: string): string {
    const raw = String(symbol || fallback || '').trim();
    if (!raw) return 'UNKNOWN';
    return normalizeDisplaySymbol(raw);
}

function toDynamicTokenDisplay(
    candidate: Pick<DetectedTokenInfo, 'symbol' | 'logoURI'> | Pick<DexScreenerToken, 'symbol' | 'imageUrl'>,
    fallbackSymbol: string
): TokenDisplayMetadata {
    const symbol = normalizeResolvedSymbol(candidate.symbol, fallbackSymbol);
    const logoURI =
        typeof (candidate as { logoURI?: unknown }).logoURI === 'string'
            ? (candidate as { logoURI: string }).logoURI
            : (typeof (candidate as { imageUrl?: unknown }).imageUrl === 'string'
                ? (candidate as { imageUrl: string }).imageUrl
                : undefined);
    return {
        symbol,
        logoURI: logoURI || getKnownTokenLogoURI(symbol),
    };
}

function pickBestSearchCandidate(
    query: string,
    chainId: number,
    results: DexScreenerToken[]
): DexScreenerToken | null {
    if (!results.length) return null;
    const normalizedQuery = normalizeSymbolForLookup(query);
    const sameChain = results.filter((item) => {
        const normalizedChain = String(item.chainId || '').toLowerCase();
        if (chainId === 900) return normalizedChain === 'solana';
        if (chainId === 56) return normalizedChain === 'bsc';
        if (chainId === 8453) return normalizedChain === 'base';
        if (chainId === 42161) return normalizedChain === 'arbitrum';
        if (chainId === 137) return normalizedChain === 'polygon';
        if (chainId === 10) return normalizedChain === 'optimism';
        if (chainId === 1) return normalizedChain === 'ethereum';
        return false;
    });
    const candidates = sameChain.length ? sameChain : results;
    const exactSymbol = candidates.find((item) => normalizeSymbolForLookup(item.symbol) === normalizedQuery);
    if (exactSymbol) return exactSymbol;
    const exactName = candidates.find((item) => normalizeSymbolForLookup(item.name) === normalizedQuery);
    if (exactName) return exactName;
    return candidates[0] || null;
}

export async function resolveTokenDisplayMetadata(
    token: string,
    chainId: number,
    deps: TokenDisplayResolverDeps = {}
): Promise<TokenDisplayMetadata> {
    const raw = String(token || '').trim();
    if (!raw) return { symbol: 'UNKNOWN' };

    const common = resolveCommonTokenDisplay(raw, chainId);
    if (
        common?.symbol
        && (
            isHexAddressLike(raw)
            || isSolanaAddressLike(raw)
            || isNativeToken(raw)
            || Boolean(common.logoURI)
            || common.symbol !== normalizeDisplaySymbol(raw)
        )
    ) {
        return common;
    }

    const getSpecificInfo = deps.getDetectedTokenInfo || getDetectedTokenInfo;
    const getGlobalInfo = deps.findDetectedTokenOnAnyChain || findDetectedTokenOnAnyChain;
    const searchDynamicTokens = deps.searchDexTokens || searchDexTokens;

    if (isHexAddressLike(raw) || isSolanaAddressLike(raw)) {
        try {
            const specific = await getSpecificInfo(raw, chainId);
            if (specific?.symbol && specific.symbol !== 'UNKNOWN') {
                return toDynamicTokenDisplay(specific, raw);
            }
        } catch {
            // Fall through to global lookup.
        }

        try {
            const global = await getGlobalInfo(raw);
            if (global?.symbol && global.symbol !== 'UNKNOWN') {
                return toDynamicTokenDisplay(global, raw);
            }
        } catch {
            // Fall through to fallback.
        }

        return {
            symbol: `${raw.slice(0, 6)}...${raw.slice(-4)}`,
            logoURI: undefined,
        };
    }

    const normalizedSymbol = normalizeDisplaySymbol(raw);
    try {
        const searchResults = await searchDynamicTokens(raw);
        const candidate = pickBestSearchCandidate(raw, chainId, searchResults);
        if (candidate?.symbol) {
            return toDynamicTokenDisplay(candidate, normalizedSymbol);
        }
    } catch {
        // Fall back to known-symbol rendering below.
    }

    return {
        symbol: normalizedSymbol,
        logoURI: getKnownTokenLogoURI(normalizedSymbol),
    };
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
