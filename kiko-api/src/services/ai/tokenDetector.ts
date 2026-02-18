/**
 * Token Detector Service
 * Finds token on any chain and detects chain information
 * Also detects launchpad tokens
 */

import { getTokenDetails as getDexTokenDetails } from '../dexscreener.js';
import { getTokenDetails as getGeckoTokenDetails } from '../geckoTerminal.js';
import { detectLaunchpadToken } from './launchpadDetector.js';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import { fetchJson } from '../../config/unifiedApiService.js';

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
        provider: 'zora' | 'clanker' | 'paragraph' | 'fourmeme' | 'flap' | 'pumpfun' | 'pumpswap' | 'bonkfun' | 'virtuals' | 'doppler';
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
    'solana': 900
};

const CHAIN_ID_TO_SLUG: Record<number, string> = {
    1: 'ethereum',
    8453: 'base',
    56: 'bsc',
    42161: 'arbitrum',
    10: 'optimism',
    137: 'polygon',
    900: 'solana',
};

const CHAIN_ID_TO_NAME: Record<number, string> = {
    1: 'Ethereum',
    8453: 'Base',
    56: 'BSC',
    42161: 'Arbitrum',
    10: 'Optimism',
    137: 'Polygon',
    900: 'Solana',
};

/**
 * Find token on any chain using DexScreener global search
 */
export async function findTokenOnAnyChain(address: string): Promise<TokenInfo | null> {
    const timerLabel = `find_token_any_${address}`;
    logger.startTimer(timerLabel);
    try {
        logger.debug(LogCode.AI_TOKEN_DETECTED, 'TokenDetector: Searching for token globally', { address });

        // Use DexScreener global search (fastest for multi-chain)
        const data = await fetchJson({
            url: `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(address)}`,
            timeout: 5000
        }) as {
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
            logger.debug(LogCode.SYS_INFO, 'TokenDetector: No pairs found, checking launchpad', { address });

            // Even without DEX pairs, check if token is from a launchpad (Zora/Clanker on Base)
            // Assume Base chain for 0x addresses since most launchpad tokens are there
            const launchpadResult = await detectLaunchpadToken(address, 8453);
            if (launchpadResult) {
                logger.info(LogCode.SYS_INFO, 'TokenDetector: Found launchpad token without DEX', { provider: launchpadResult.provider, address });
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
            logger.debug(LogCode.SYS_INFO, 'TokenDetector: No exact match found', { address });
            return null;
        }

        const chainId = CHAIN_SLUG_TO_ID[match.chainId] || 1;
        const tokenInfo: TokenInfo = {
            address: match.baseToken.address,
            symbol: match.baseToken.symbol,
            name: match.baseToken.name,
            chainId,
            chainName: CHAIN_ID_TO_NAME[chainId] || 'Unknown',
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
            logger.info(LogCode.SYS_INFO, 'TokenDetector: Found launchpad token', { symbol: tokenInfo.symbol, provider: launchpadResult.provider });
        }

        if (tokenInfo) {
            logger.endTimer(timerLabel, LogCode.AI_TOKEN_DETECTED, { address, symbol: tokenInfo.symbol, chain: tokenInfo.chainName });
        } else {
            logger.endTimer(timerLabel, LogCode.AI_TOKEN_DETECTED, { address, found: false });
        }
        return tokenInfo;
    } catch (error: any) {
        logger.error(LogCode.SYS_ERROR, 'TokenDetector: Error finding token', { address, error: error.message });
        return null;
    }
}

/**
 * Get token info for a specific chain
 */
export async function getTokenInfo(address: string, chainId: number): Promise<TokenInfo | null> {
    const timerLabel = `get_token_info_${address}_${chainId}`;
    logger.startTimer(timerLabel);
    try {
        const chainSlug = CHAIN_ID_TO_SLUG[chainId];
        if (!chainSlug) {
            logger.error(LogCode.SYS_ERROR, 'TokenDetector: Unsupported chainId', { chainId });
            logger.endTimer(timerLabel, LogCode.AI_TOKEN_DETECTED, { address, chainId, error: 'Unsupported chain' });
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
                    chainName: CHAIN_ID_TO_NAME[chainId] || 'Unknown',
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

                    logger.info(LogCode.AI_TOKEN_DETECTED, 'TokenDetector: Found launchpad token (via Gecko)', { symbol: tokenInfo.symbol, provider: launchpadResult.provider });
                }

                logger.endTimer(timerLabel, LogCode.AI_TOKEN_DETECTED, { address, chainId, symbol: tokenInfo.symbol, source: 'gecko' });
                return tokenInfo;
            }
        } catch (error: any) {
            logger.debug(LogCode.AI_TOKEN_DETECTED, 'TokenDetector: GeckoTerminal failed, trying DexScreener', { address, error: error.message });
        }

        // Fallback to DexScreener
        const dexData = await getDexTokenDetails(chainSlug, address);
        if (dexData) {
            const tokenInfo: TokenInfo = {
                    address: dexData.address,
                    symbol: dexData.symbol,
                    name: dexData.name,
                    chainId,
                    chainName: CHAIN_ID_TO_NAME[chainId] || 'Unknown',
                    price: dexData.price,
                    priceChange24h: dexData.priceChange24h,
                    volume24h: dexData.volume24h,
                    marketCap: dexData.fdv,
            };

            // Check if this is a launchpad token
            // User Rule: We MUST detect launchpad status so we can SKIP active scanning for them.
            // "Active scanning is for != launchpad tokens"
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

                logger.info(LogCode.AI_TOKEN_DETECTED, 'TokenDetector: Found launchpad token', { symbol: tokenInfo.symbol, provider: launchpadResult.provider });
            }

            logger.endTimer(timerLabel, LogCode.AI_TOKEN_DETECTED, { address, chainId, symbol: tokenInfo.symbol, source: 'dex' });
            return tokenInfo;
        }

        // Last resort: check if it's a launchpad token even if not found on DEX
        const launchpadResult = await detectLaunchpadToken(address, chainId);
        if (launchpadResult) {
            const tokenInfo: TokenInfo = {
                address,
                symbol: launchpadResult.data.symbol || 'UNKNOWN',
                name: launchpadResult.data.name || 'Unknown Token',
                chainId: launchpadResult.chainId,
                chainName: CHAIN_ID_TO_NAME[launchpadResult.chainId] || 'Unknown',
                launchpad: {
                    provider: launchpadResult.provider,
                    data: launchpadResult.data,
                },
            };
            logger.endTimer(timerLabel, LogCode.AI_TOKEN_DETECTED, { address, chainId, symbol: tokenInfo.symbol, launchpad: launchpadResult.provider });
            return tokenInfo;
        }

        logger.endTimer(timerLabel, LogCode.AI_TOKEN_DETECTED, { address, chainId, found: false });
        return null;
    } catch (error: any) {
        logger.error(LogCode.SYS_ERROR, 'TokenDetector: Error getting token info', { address, chainId, error: error.message });
        logger.endTimer(timerLabel, LogCode.AI_TOKEN_DETECTED, { address, chainId, error: error.message });
        return null;
    }
}
