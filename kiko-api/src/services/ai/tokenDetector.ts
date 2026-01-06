/**
 * Token Detector Service
 * Finds token on any chain and detects chain information
 * Also detects launchpad tokens
 */

import { getTokenDetails as getDexTokenDetails } from '../dexscreener.js';
import { getTokenDetails as getGeckoTokenDetails } from '../geckoTerminal.js';
import { detectLaunchpadToken } from './launchpadDetector.js';

export interface TokenInfo {
    address: string;
    symbol: string;
    name: string;
    chainId: number;
    chainName: string;
    price?: number;
    priceChange24h?: number;
    marketCap?: number;
    volume24h?: number;
    launchpad?: {
        provider: 'zora' | 'clanker' | 'paragraph' | 'fourmeme' | 'pumpfun' | 'raydium' | 'bonkfun';
        data: any;
    };
}

/**
 * Chain ID mapping from DexScreener chain slugs
 */
const CHAIN_SLUG_TO_ID: Record<string, number> = {
    'ethereum': 1,
    'base': 8453,
    'bsc': 56,
    'arbitrum': 42161,
    'optimism': 10,
    'polygon': 137,
    'avalanche': 43114,
    'fantom': 250,
    'solana': 900,
};

/**
 * Find token on any chain using DexScreener global search
 */
export async function findTokenOnAnyChain(address: string): Promise<TokenInfo | null> {
    try {
        console.log(`[TokenDetector] Searching for token globally: ${address}`);

        // Use DexScreener global search (fastest for multi-chain)
        const response = await fetch(
            `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(address)}`,
            { signal: AbortSignal.timeout(5000) }
        );

        if (!response.ok) {
            console.warn(`[TokenDetector] DexScreener search failed: ${response.status}`);
            return null;
        }

        const data = await response.json() as {
            pairs?: Array<{
                chainId: string;
                baseToken?: {
                    address: string;
                    name: string;
                    symbol: string;
                };
                priceUsd?: string;
                priceChange24h?: number;
                volume24h?: number;
                fdv?: number;
            }>;
        };

        if (!data.pairs || data.pairs.length === 0) {
            console.log(`[TokenDetector] No pairs found for ${address}, checking launchpad...`);

            // Even without DEX pairs, check if token is from a launchpad (Zora/Clanker on Base)
            // Assume Base chain for 0x addresses since most launchpad tokens are there
            const launchpadResult = await detectLaunchpadToken(address, 8453);
            if (launchpadResult) {
                console.log(`[TokenDetector] Found launchpad token without DEX: ${launchpadResult.provider}`);
                return {
                    address,
                    symbol: launchpadResult.data?.symbol || 'UNKNOWN',
                    name: launchpadResult.data?.name || 'Unknown Token',
                    chainId: launchpadResult.chainId,
                    chainName: 'Base',
                    launchpad: {
                        provider: launchpadResult.provider,
                        data: launchpadResult.data,
                    },
                };
            }

            return null;
        }

        // Find exact match for token address
        const match = data.pairs.find(
            p => p.baseToken?.address.toLowerCase() === address.toLowerCase()
        );

        if (!match || !match.baseToken) {
            console.log(`[TokenDetector] No exact match found for ${address}`);
            return null;
        }

        const chainId = CHAIN_SLUG_TO_ID[match.chainId] || 1;
        const chainNameMap: Record<number, string> = {
            1: 'Ethereum',
            8453: 'Base',
            56: 'BSC',
            42161: 'Arbitrum',
            10: 'Optimism',
            137: 'Polygon',
            43114: 'Avalanche',
            250: 'Fantom',
            900: 'Solana',
        };

        const tokenInfo: TokenInfo = {
            address: match.baseToken.address,
            symbol: match.baseToken.symbol,
            name: match.baseToken.name,
            chainId,
            chainName: chainNameMap[chainId] || 'Unknown',
            price: match.priceUsd ? parseFloat(match.priceUsd) : undefined,
            priceChange24h: match.priceChange24h,
            volume24h: match.volume24h,
            marketCap: match.fdv,
        };

        // Check if this is a launchpad token
        const launchpadResult = await detectLaunchpadToken(address, tokenInfo.chainId);
        if (launchpadResult) {
            tokenInfo.launchpad = {
                provider: launchpadResult.provider,
                data: launchpadResult.data,
            };
            console.log(`[TokenDetector] Found launchpad token: ${tokenInfo.symbol} on ${launchpadResult.provider}`);
        }

        console.log(`[TokenDetector] Found token: ${tokenInfo.symbol} on ${tokenInfo.chainName} (${tokenInfo.chainId})`);
        return tokenInfo;
    } catch (error: any) {
        console.error(`[TokenDetector] Error finding token:`, error.message);
        return null;
    }
}

/**
 * Get token info for a specific chain
 */
export async function getTokenInfo(address: string, chainId: number): Promise<TokenInfo | null> {
    try {
        const chainMap: Record<number, string> = {
            1: 'ethereum',
            8453: 'base',
            56: 'bsc',
            42161: 'arbitrum',
            10: 'optimism',
            137: 'polygon',
            43114: 'avalanche',
            250: 'fantom',
            900: 'solana',
        };

        const chainSlug = chainMap[chainId];
        if (!chainSlug) {
            console.warn(`[TokenDetector] Unsupported chainId: ${chainId}`);
            return null;
        }

        // Try GeckoTerminal first
        try {
            const geckoData = await getGeckoTokenDetails(chainSlug, address);
            if (geckoData) {
                const tokenInfo: TokenInfo = {
                    address: geckoData.address,
                    symbol: geckoData.symbol,
                    name: geckoData.name,
                    chainId,
                    chainName: chainMap[chainId] || 'Unknown',
                    price: geckoData.price,
                    priceChange24h: geckoData.priceChange24h,
                    volume24h: geckoData.volume24h,
                    marketCap: typeof geckoData.fdv === 'string' ? parseFloat(geckoData.fdv) : geckoData.fdv,
                };

                // Check if this is a launchpad token
                const launchpadResult = await detectLaunchpadToken(address, chainId);
                if (launchpadResult) {
                    tokenInfo.launchpad = {
                        provider: launchpadResult.provider,
                        data: launchpadResult.data,
                    };

                    // Backfill metadata if missing from Gecko
                    if ((!tokenInfo.symbol || tokenInfo.symbol === 'UNKNOWN') && launchpadResult.data.symbol) {
                        tokenInfo.symbol = launchpadResult.data.symbol;
                    }
                    if ((!tokenInfo.name || tokenInfo.name === 'Unknown Token') && launchpadResult.data.name) {
                        tokenInfo.name = launchpadResult.data.name;
                    }

                    console.log(`[TokenDetector] Found launchpad token (via Gecko): ${tokenInfo.symbol} on ${launchpadResult.provider}`);
                }

                return tokenInfo;
            }
        } catch (error) {
            console.warn(`[TokenDetector] GeckoTerminal failed, trying DexScreener...`);
        }

        // Fallback to DexScreener
        const dexData = await getDexTokenDetails(chainSlug, address);
        if (dexData) {
            const tokenInfo: TokenInfo = {
                address: dexData.address,
                symbol: dexData.symbol,
                name: dexData.name,
                chainId,
                chainName: chainMap[chainId] || 'Unknown',
                price: dexData.price,
                priceChange24h: dexData.priceChange24h,
                volume24h: dexData.volume24h,
                marketCap: dexData.fdv,
            };

            // Check if this is a launchpad token
            const launchpadResult = await detectLaunchpadToken(address, chainId);
            if (launchpadResult) {
                tokenInfo.launchpad = {
                    provider: launchpadResult.provider,
                    data: launchpadResult.data,
                };

                // Backfill metadata if missing from DexScreener
                if ((!tokenInfo.symbol || tokenInfo.symbol === 'UNKNOWN') && launchpadResult.data.symbol) {
                    tokenInfo.symbol = launchpadResult.data.symbol;
                }
                if ((!tokenInfo.name || tokenInfo.name === 'Unknown Token') && launchpadResult.data.name) {
                    tokenInfo.name = launchpadResult.data.name;
                }

                console.log(`[TokenDetector] Found launchpad token: ${tokenInfo.symbol} on ${launchpadResult.provider}`);
            }

            return tokenInfo;
        }

        // Last resort: check if it's a launchpad token even if not found on DEX
        const launchpadResult = await detectLaunchpadToken(address, chainId);
        if (launchpadResult) {
            return {
                address,
                symbol: launchpadResult.data.symbol || 'UNKNOWN',
                name: launchpadResult.data.name || 'Unknown Token',
                chainId: launchpadResult.chainId,
                chainName: chainMap[launchpadResult.chainId] || 'Unknown',
                launchpad: {
                    provider: launchpadResult.provider,
                    data: launchpadResult.data,
                },
            };
        }

        return null;
    } catch (error: any) {
        console.error(`[TokenDetector] Error getting token info:`, error.message);
        return null;
    }
}

