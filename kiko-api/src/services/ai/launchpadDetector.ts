/**
 * Launchpad Detector Service (Backend)
 * Detects tokens from various launchpad platforms
 * Adapted from frontend launchpadDetector.ts
 */

import { zoraService } from '../zoraService.js';
// ParagraphAPI imported dynamically to avoid startup crash from broken doppler-router
import { getChainConfig } from '../../config/chainConfig.js';
import { env } from '../../config/env.js';
import { Connection, PublicKey } from '@solana/web3.js';
import { redact } from '../../utils/sanitizer.js';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import { SOLANA_CONFIG } from '../../config/solanaConfig.js';

const LAUNCHPAD_AUTH_PDA = 'WLHv2UAZm6z4KyaaELi5pjdbJh6RESMva1Rnn8pJVVh';
const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

async function checkLaunchpadAuth(mintAddress: string): Promise<boolean> {
    try {
        const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
        const mint = new PublicKey(mintAddress);
        const [pda] = PublicKey.findProgramAddressSync(
            [Buffer.from('metadata'), METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
            METADATA_PROGRAM_ID
        );
        const info = await connection.getAccountInfo(pda);
        if (!info) return false;

        // Update Authority is at offset 1 (key is offset 0)
        // Data usually starts with u8 key (1 byte), then Update Authority (32 bytes)
        const updateAuth = new PublicKey(info.data.subarray(1, 33));
        return updateAuth.toBase58() === LAUNCHPAD_AUTH_PDA;
    } catch (e: any) {
        // console.warn(`[LaunchpadDetector] Metadata check failed: ${e.message}`);
        return false;
    }
}

export interface LaunchpadResult {
    provider: 'zora' | 'clanker' | 'paragraph' | 'fourmeme' | 'pumpfun' | 'bonkfun';
    data: any;
    chainId: number;
}

// Simple In-Memory Cache
const DETECTION_CACHE = new Map<string, { result: LaunchpadResult | null, expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes


import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

const CLANKER_FACTORY = '0xE85A59c628F7d27878ACeB4bf3b35733630083a9';
// Event: TokenCreated(address indexed token, uint256 indexed tokenId, ...)
// Topic0: 0xe5b9f4d1f6cf7c3238f0c0b48597a9ccd3ff3d2309f3ccd30bd46aad5e06a638
const CLANKER_TOPIC = '0xe5b9f4d1f6cf7c3238f0c0b48597a9ccd3ff3d2309f3ccd30bd46aad5e06a638';

/**
 * Detect Clanker token (Base)
 * Uses API first, then falls back to on-chain Factory check
 */
async function getClankerToken(address: string): Promise<any | null> {
    try {
        // Only run for Base (8453)
        // 1. Try API
        const url = `https://www.clanker.world/api/tokens?q=${encodeURIComponent(address)}`;
        const response = await fetch(
            url,
            {
                signal: AbortSignal.timeout(2000), // even faster timeout for API
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json'
                }
            }
        ).catch(() => null);

        if (response && response.ok) {
            const data = await response.json() as { data?: any[] };
            if (data.data && data.data.length > 0) {
                const token = data.data.find(
                    (t: any) => t.contract_address?.toLowerCase() === address.toLowerCase()
                );
                if (token) return token;
            }
        }

        return null; // Stick to API for now to avoid false positives
    } catch (error: any) {
        logger.error(LogCode.API_FETCH_FAILED, 'LaunchpadDetector: Clanker check failed', { address, error: error.message });
        return null;
    }
}

/**
 * Detect Paragraph token (Base)
 */
export async function getParagraphToken(address: string): Promise<any | null> {
    const paragraphApiKey = (env.apiKeys as any).paragraph || process.env.PARAGRAPH_API_KEY || '';

    // Dynamic import to avoid startup crash from broken doppler-router sub-dependency
    let ParagraphAPI: any;
    try {
        const sdk = await import('@paragraph_xyz/sdk');
        ParagraphAPI = sdk.ParagraphAPI;
    } catch (e: any) {
        logger.error(LogCode.SYS_ERROR, 'LaunchpadDetector: Failed to load Paragraph SDK', { error: e.message });
        return null;
    }

    // Use SDK with empty key if not provided, or fallback to public API
    const api = new ParagraphAPI(paragraphApiKey ? { apiKey: paragraphApiKey } : {});

    try {
        const coinBasic = await (api as any).getCoinByContract(address);
        if (!coinBasic || !coinBasic.id) {
            return null;
        }

        let coinFull: any = null;
        try {
            const apiAny = api as any;
            if (apiAny.coins && typeof apiAny.coins.get === 'function') {
                coinFull = await apiAny.coins.get({ id: coinBasic.id }).single();
            } else if (typeof apiAny.getCoin === 'function') {
                coinFull = await apiAny.getCoin(coinBasic.id);
            }
        } catch (err: any) {
            logger.error(LogCode.API_FETCH_FAILED, 'LaunchpadDetector: Failed to get Paragraph coin details', { coinId: coinBasic.id, error: err.message });
            return null;
        }

        const creationDateAttr = coinFull?.metadata?.attributes?.find((a: any) => a.trait_type === 'Token Creation Date')?.value;

        const result = {
            id: coinBasic.id,
            contractAddress: (coinBasic as any).contractAddress || address,
            symbol: coinFull?.metadata?.symbol || (coinBasic as any).symbol || 'UNKNOWN',
            postId: (coinBasic as any).postId,
            name: coinFull?.metadata?.name || coinFull?.metadata?.symbol || (coinBasic as any).symbol || 'Unknown Token',
            image: coinFull?.metadata?.image || coinFull?.metadata?.logoURI || undefined,
            description: coinFull?.metadata?.description || undefined,
            createdAt: creationDateAttr ? new Date(creationDateAttr).getTime() : undefined,
        };

        logger.info(LogCode.AI_LAUNCHPAD_DETECTED, 'LaunchpadDetector: Returning Paragraph coin data', { result });
        return result;
    } catch (error: any) {
        const statusCode = error?.response?.status || error?.status || error?.statusCode;

        if (statusCode === 404) {
            return null;
        }

        logger.error(LogCode.SYS_ERROR, 'LaunchpadDetector: Paragraph fetch failed', redact({
            address,
            error: error.message
        }));

        return null;
    }
}

/**
 * Detect Four.meme token (BSC)
 */
async function getFourMemeToken(address: string): Promise<any | null> {
    try {
        const url = `https://four.meme/meme-api/v1/private/token/get?address=${encodeURIComponent(address)}`;
        const response = await fetch(
            url,
            {
                signal: AbortSignal.timeout(10000),
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            }
        );

        if (!response.ok) {
            logger.error(LogCode.API_FETCH_FAILED, 'LaunchpadDetector: Four.meme API responded with unexpected status', { status: response.status, address });
            return null;
        }

        const data = await response.json() as any;
        if (data.code === 0 && data.data) {
            return {
                ...data.data,
                createdAt: data.data.createDate ? parseInt(data.data.createDate) : undefined
            };
        }

        return null;
    } catch (error: any) {
        logger.error(LogCode.API_FETCH_FAILED, 'LaunchpadDetector: Four.meme fetch failed', { address, error: error.message, cause: error.cause });
        return null;
    }
}

/**
 * Detect Pump.fun token (Solana)
 */
async function getPumpFunToken(mintAddress: string): Promise<any | null> {
    try {
        // 1. Try Official API (might be unstable)
        const url = `https://frontend-api.pump.fun/coins/${mintAddress}`;
        const response = await fetch(
            url,
            {
                signal: AbortSignal.timeout(3000),
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                }
            }
        ).catch(() => null);

        if (response && response.ok) {
            const data = await response.json() as any;
            if (data && data.mint) return data;
        }

        // 2b. Try Core Frontend API v3 (POST /coins/mints) - Good for batch or stable lookup
        try {
            const batchUrl = 'https://frontend-api.pump.fun/coins/mints';
            const batchRes = await fetch(batchUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                },
                body: JSON.stringify([mintAddress]),
                signal: AbortSignal.timeout(3000)
            }).catch(() => null);

            if (batchRes && batchRes.ok) {
                const batchData = await batchRes.json() as any[];
                if (batchData && batchData.length > 0 && batchData[0].mint === mintAddress) {
                    return batchData[0];
                }
            }
        } catch (e) {
            // Silently fail to next fallback
        }

        // 3. Fallback: PumpPortal.fun (Often more stable)
        const portalUrl = `https://pumpportal.fun/api/data/token-info?ca=${mintAddress}`;
        const portalRes = await fetch(portalUrl, {
            signal: AbortSignal.timeout(3000)
        }).catch(() => null);

        if (portalRes && portalRes.ok) {
            const portalData = await portalRes.json() as any;
            if (portalData && (portalData.mint || portalData.address)) {
                return portalData;
            }
        } else {
            logger.debug(LogCode.SYS_INFO, 'LaunchpadDetector: PumpPortal fallback status', { status: portalRes?.status });
        }

        // Fallback: Official Raydium V3 API - Often has Pump.fun tokens indexed too
        const raydiumUrl = `https://api-v3.raydium.io/mint/ids?mints=${mintAddress}`;
        const raydiumRes = await fetch(raydiumUrl, {
            signal: AbortSignal.timeout(3000)
        }).catch(() => null);

        if (raydiumRes && raydiumRes.ok) {
            const raydiumData = await raydiumRes.json() as any;
            if (raydiumData.success && raydiumData.data?.[0]) {
                const token = raydiumData.data[0];
                // STRICT FILTER: Ensure the token from Raydium is actually a Pump.fun token
                // Pump.fun Program ID: 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P
                if (token.programId === '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P') {
                    return {
                        mint: mintAddress,
                        name: token.name,
                        symbol: token.symbol,
                        image_uri: token.logoURI,
                        decimals: token.decimals
                    };
                }
                logger.debug(LogCode.SYS_INFO, 'LaunchpadDetector: Raydium fallback Program ID mismatch', { mintAddress, programId: token.programId });
            }
        }

        return null;
    } catch (error: any) {
        logger.error(LogCode.API_FETCH_FAILED, 'LaunchpadDetector: Pump.fun fetch failed', { mintAddress, error: error.message });
        return null;
    }
}

/**
 * Detect Raydium token (Solana)
 */
async function getRaydiumToken(mintAddress: string): Promise<any | null> {
    try {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
        };

        // 1. Try Raydium V3 Official
        const raydiumUrl = `https://api-v3.raydium.io/mint/ids?mints=${mintAddress}`;
        const raydiumResponse = await fetch(raydiumUrl, { headers, signal: AbortSignal.timeout(3000) }).catch(() => null);

        if (raydiumResponse && raydiumResponse.ok) {
            const text = await raydiumResponse.text();
            if (text.startsWith('{')) {
                const data = JSON.parse(text);
                if (data.success && data.data?.[0]) {
                    const t = data.data[0];
                    // STRICT CHECK: The user indicates LaunchLab tokens have a specific "platform ID".
                    // Standard tokens (Pump, SPL) do not have this field or use standard program IDs.
                    // Raydium LaunchLab Program ID: LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj

                    const isLaunchLabProgram = t.programId === 'LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj';
                    const hasPlatformId = !!t.platformId || !!t.platform || (t.extensions && (t.extensions.platform === 'launchlab' || t.extensions.platform === 'bonkfun'));
                    if (isLaunchLabProgram || hasPlatformId) {
                        return {
                            mint: mintAddress, // Use input mint as canonical
                            name: t.name,
                            symbol: t.symbol,
                            image_uri: t.logoURI,
                            decimals: t.decimals,
                            isBonkFun: true
                        };
                    }

                    // Fallback: Check on-chain metadata for authoritative indicator
                    // This uses the Launchpad Auth PDA (WLHv...) found via SDK reverse stats
                    logger.debug(LogCode.SYS_INFO, 'LaunchpadDetector: Token missing API indicators, checking on-chain', { mintAddress });
                    const isLaunchpad = await checkLaunchpadAuth(mintAddress);

                    if (isLaunchpad) {
                        return {
                            mint: mintAddress,
                            name: t.name,
                            symbol: t.symbol,
                            image_uri: t.logoURI,
                            decimals: t.decimals,
                            isBonkFun: true
                        };
                    }

                    logger.debug(LogCode.SYS_INFO, 'LaunchpadDetector: Raydium token missing indicators and Auth mismatch', { mintAddress });
                    return null;
                }
            }
        }

        // 2. Try DexScreener (Browser Mimicry)
        const dsUrl = `https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`;
        const dsResponse = await fetch(dsUrl, {
            headers: { ...headers, 'Referer': 'https://dexscreener.com/', 'Origin': 'https://dexscreener.com' },
            signal: AbortSignal.timeout(3000)
        }).catch(() => null);

        if (dsResponse && dsResponse.ok) {
            const text = await dsResponse.text();
            if (text.startsWith('{')) {
                const data = JSON.parse(text);
                if (data.pairs && data.pairs.length > 0) {
                    const p = data.pairs.find((pair: any) => pair.dexId === 'raydium') || data.pairs[0];
                    const t = p.baseToken?.address === mintAddress ? p.baseToken : p.quoteToken;
                    return { mint: mintAddress, name: t?.name, symbol: t?.symbol, image_uri: p.info?.imageUrl || t?.logoURI, decimals: 9 };
                }
            }
        }

        return null;
    } catch (error: any) {
        logger.error(LogCode.SYS_ERROR, 'LaunchpadDetector: Solana detection failed', { mintAddress, error: error.message });
        return null;
    }
}

/**
 * Detect launchpad token from any platform
 */
export async function detectLaunchpadToken(
    address: string,
    chainId?: number
): Promise<LaunchpadResult | null> {
    const cacheKey = `${chainId || 'any'}:${address.toLowerCase()}`;
    const cached = DETECTION_CACHE.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
        return cached.result;
    }

    // 6.0s Global Timeout for all detection
    let timeoutId: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => {
            logger.info(LogCode.API_TIMEOUT, 'LaunchpadDetector: Global timeout reached', { address });
            resolve(null);
        }, 6000);
    });

    const timerLabel = `launchpad_det_${address}`;
    logger.startTimer(timerLabel);

    try {
        const result = await Promise.race([
            handleDetection(address, chainId, cacheKey),
            timeoutPromise
        ]);
        if (timeoutId) clearTimeout(timeoutId);

        logger.endTimer(timerLabel, LogCode.AI_LAUNCHPAD_DETECTED, { address, chainId, found: !!result });
        return result;
    } catch (err) {
        if (timeoutId) clearTimeout(timeoutId);
        throw err;
    }
}

async function handleDetection(
    address: string,
    chainId: number | undefined,
    cacheKey: string
): Promise<LaunchpadResult | null> {
    const isSolana = address.length > 40 && !address.startsWith('0x');
    const isEVM = address.startsWith('0x') && address.length === 42;

    if (!isSolana && !isEVM) {
        return null;
    }

    if (isSolana) {
        // Run checks in parallel but wait for both to decide priority
        // We MUST prioritize Pump.fun if it exists there, because Raydium also indexes Pump tokens.
        const [pumpResult, rayResult] = await Promise.all([
            getPumpFunToken(address).catch(() => null),
            getRaydiumToken(address).catch(() => null)
        ]);

        // Priority 1: Pump.fun
        if (pumpResult) {
            DETECTION_CACHE.set(cacheKey, { result: { provider: 'pumpfun', data: pumpResult, chainId: SOLANA_CONFIG.CHAIN_ID }, expiry: Date.now() + CACHE_TTL });
            return { provider: 'pumpfun', data: pumpResult, chainId: SOLANA_CONFIG.CHAIN_ID };
        }

        // Priority 2: BonkFun (LaunchLab tokens on Raydium)
        if (rayResult) {
            DETECTION_CACHE.set(cacheKey, { result: { provider: 'bonkfun', data: rayResult, chainId: SOLANA_CONFIG.CHAIN_ID }, expiry: Date.now() + CACHE_TTL });
            return { provider: 'bonkfun', data: rayResult, chainId: SOLANA_CONFIG.CHAIN_ID };
        }

        return null; // Not found on either
    }

    if (isEVM) {
        // Parallel checks for all EVM platforms
        const basePlatforms = (chainId === 8453 || !chainId);
        const bscPlatforms = (chainId === 56 || !chainId);

        // Check for ZORA platform token first (lightning check)
        const ZORA_PLATFORM_TOKEN = '0x1111111111166b7fe7bd91427724b487980afc69'.toLowerCase();
        if (address.toLowerCase() === ZORA_PLATFORM_TOKEN) {
            const result: LaunchpadResult = {
                provider: 'zora',
                data: { symbol: 'ZORA', name: 'Zora', address: ZORA_PLATFORM_TOKEN },
                chainId: 8453
            };
            DETECTION_CACHE.set(cacheKey, { result, expiry: Date.now() + CACHE_TTL });
            return result;
        }

        // === PRIORITY-BASED DETECTION with Early Return ===
        // Check Zora FIRST (fastest & most reliable for Creator Tokens)
        // Only check other platforms if Zora returns null

        // Priority 1: Zora SDK (very fast, ~100-500ms)
        if (basePlatforms) {
            try {
                const zoraResult = await zoraService.getCoinByAddress(address);
                if (zoraResult) {
                    const result: LaunchpadResult = { provider: 'zora', data: zoraResult, chainId: 8453 };
                    DETECTION_CACHE.set(cacheKey, { result, expiry: Date.now() + CACHE_TTL });
                    return result;
                }
            } catch (e) {
                // Zora check failed, continue to other platforms
            }
        }

        // Priority 2 & 3: Clanker and Paragraph in parallel (only if Zora not found)
        if (basePlatforms) {
            const [clankerResult, paragraphResult] = await Promise.all([
                getClankerToken(address).catch(() => null),
                getParagraphToken(address).catch(() => null)
            ]);

            if (clankerResult) {
                const result: LaunchpadResult = { provider: 'clanker', data: clankerResult, chainId: 8453 };
                DETECTION_CACHE.set(cacheKey, { result, expiry: Date.now() + CACHE_TTL });
                return result;
            }

            if (paragraphResult) {
                const result: LaunchpadResult = { provider: 'paragraph', data: paragraphResult, chainId: 8453 };
                DETECTION_CACHE.set(cacheKey, { result, expiry: Date.now() + CACHE_TTL });
                return result;
            }
        }

        // Priority 4: FourMeme (BSC only)
        if (bscPlatforms) {
            try {
                const fourmemeResult = await getFourMemeToken(address);
                if (fourmemeResult) {
                    const result: LaunchpadResult = { provider: 'fourmeme', data: fourmemeResult, chainId: 56 };
                    DETECTION_CACHE.set(cacheKey, { result, expiry: Date.now() + CACHE_TTL });
                    return result;
                }
            } catch (e) {
                // FourMeme check failed
            }
        }
    }

    // Cache the result (even if null)
    DETECTION_CACHE.set(cacheKey, {
        result: null,
        expiry: Date.now() + CACHE_TTL
    });
    return null;
}
