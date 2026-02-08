/**
 * Launchpad Detector Service (Backend)
 * Detects tokens from various launchpad platforms
 * Adapted from frontend launchpadDetector.ts
 */

import { zoraService } from '../zoraService.js';
import { PublicKey } from '@solana/web3.js';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import { SOLANA_CONFIG } from '../../config/solanaConfig.js';
import { fetchJson } from '../../config/unifiedApiService.js';
import { getEthersProvider, getSolanaConnection } from '../rpcManager.js';
import { get as getCache, set as setCache } from '../../cache/redis.js';
import { ethers } from 'ethers';

const LAUNCHPAD_AUTH_PDA = 'WLHv2UAZm6z4KyaaELi5pjdbJh6RESMva1Rnn8pJVVh';
const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

async function checkLaunchpadAuth(mintAddress: string): Promise<boolean> {
    try {
        const connection = getSolanaConnection('cheap', 'normal');
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
    provider: 'zora' | 'fourmeme' | 'flap' | 'pumpfun' | 'bonkfun' | 'virtuals' | 'clanker' | 'paragraph';
    data: any;
    chainId: number;
}

type DetectMode = 'full' | 'cheap';

type DetectOptions = {
    mode?: DetectMode;
};

// Simple In-Memory Cache
const DETECTION_CACHE = new Map<string, { result: LaunchpadResult | null, expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const ZORA_PLATFORM_TOKEN = '0x1111111111166b7fe7bd91427724b487980afc69';
const CLANKER_SUFFIX = 'b07';
const FOURMEME_SUFFIXES = ['4444', 'ffff'];
const FLAP_SUFFIXES = ['8888', '7777'];
const FLAP_PORTAL_BSC_MAINNET = '0xe2ce6ab80874fa9fa2aae65d277dd6b8e65c9de0';
const FLAP_IPFS_GATEWAY = process.env.FLAP_IPFS_GATEWAY || 'https://flap.mypinata.cloud/ipfs/';
const FLAP_PORTAL_ABI = [
    'function getTokenV6(address token) view returns (tuple(uint8 status,uint256 reserve,uint256 circulatingSupply,uint256 price,uint8 tokenVersion,uint256 r,uint256 dexSupplyThresh,address quoteTokenAddress,bool nativeToQuoteSwapEnabled,bytes32 extensionID,uint256 h,uint256 k,uint256 taxRate,address pool,uint256 progress))',
    'function getTokenV5(address token) view returns (tuple(uint8 status,uint256 reserve,uint256 circulatingSupply,uint256 price,uint8 tokenVersion,uint256 r,uint256 dexSupplyThresh,address quoteTokenAddress,bool nativeToQuoteSwapEnabled,bytes32 extensionID,uint256 h,uint256 k))'
] as const;
const FLAP_META_ABI = [
    'function metaURI() view returns (string)',
    'function meta() view returns (string)',
    'function tokenURI() view returns (string)',
    'function name() view returns (string)',
    'function symbol() view returns (string)'
] as const;
const PROVIDER_BACKOFF_BASE_MS = Math.max(30_000, Number(process.env.LAUNCHPAD_PROVIDER_BACKOFF_BASE_MS || '120000'));
const PROVIDER_BACKOFF_MAX_MS = Math.max(PROVIDER_BACKOFF_BASE_MS, Number(process.env.LAUNCHPAD_PROVIDER_BACKOFF_MAX_MS || '1800000'));
const providerBackoffState = new Map<string, { until: number; strikes: number }>();
const LAUNCHPAD_CACHE_PREFIX = 'launchpad:detected:v2';
const LAUNCHPAD_CACHE_TTL_HOURS = Math.max(24, Number(process.env.LAUNCHPAD_CACHE_TTL_HOURS || '72'));
const LAUNCHPAD_NEGATIVE_CACHE_PREFIX = 'launchpad:detected:none:v1';
const LAUNCHPAD_NEGATIVE_CACHE_TTL_HOURS = Math.max(1, Number(process.env.LAUNCHPAD_NEGATIVE_CACHE_TTL_HOURS || '24'));
const LAUNCHPAD_RETRY_CACHE_PREFIX = 'launchpad:detected:retry:v1';
const LAUNCHPAD_RETRY_CACHE_TTL_SECONDS = Math.max(60, Number(process.env.LAUNCHPAD_RETRY_CACHE_TTL_SECONDS || '1200'));
const ZORA_INDEX_TTL_MS = 10 * 60 * 1000;

let zoraAddressIndexCache: { set: Set<string>; expiry: number } | null = null;
let zoraAddressIndexInflight: Promise<Set<string>> | null = null;

function buildPersistentCacheKey(address: string, chainId?: number): string {
    return `${LAUNCHPAD_CACHE_PREFIX}:${chainId || 'any'}:${address.toLowerCase()}`;
}

function buildNegativeCacheKey(address: string, chainId?: number): string {
    return `${LAUNCHPAD_NEGATIVE_CACHE_PREFIX}:${chainId || 'any'}:${address.toLowerCase()}`;
}

function buildRetryCacheKey(address: string, chainId?: number): string {
    return `${LAUNCHPAD_RETRY_CACHE_PREFIX}:${chainId || 'any'}:${address.toLowerCase()}`;
}

function isLaunchpadProvider(value: unknown): value is LaunchpadResult['provider'] {
    return value === 'zora'
        || value === 'fourmeme'
        || value === 'flap'
        || value === 'pumpfun'
        || value === 'bonkfun'
        || value === 'virtuals'
        || value === 'clanker'
        || value === 'paragraph';
}

async function readPersistentLaunchpadCache(address: string, chainId?: number): Promise<LaunchpadResult | null> {
    try {
        const raw = await getCache(buildPersistentCacheKey(address, chainId));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as any;
        if (!parsed || !isLaunchpadProvider(parsed.provider)) return null;
        const resolvedChainId = Number(parsed.chainId);
        return {
            provider: parsed.provider,
            data: parsed.data || null,
            chainId: Number.isFinite(resolvedChainId) ? resolvedChainId : (chainId || 0)
        };
    } catch {
        return null;
    }
}

async function writePersistentLaunchpadCache(address: string, chainId: number | undefined, result: LaunchpadResult): Promise<void> {
    try {
        await setCache(
            buildPersistentCacheKey(address, chainId),
            JSON.stringify({
                provider: result.provider,
                data: result.data || null,
                chainId: result.chainId,
                cachedAt: Date.now()
            }),
            LAUNCHPAD_CACHE_TTL_HOURS * 60 * 60
        );
    } catch {
        // Ignore persistent cache errors
    }
}

async function readNegativeLaunchpadCache(address: string, chainId?: number): Promise<boolean> {
    try {
        const raw = await getCache(buildNegativeCacheKey(address, chainId));
        if (!raw) return false;
        const parsed = JSON.parse(raw) as any;
        return !!parsed?.none;
    } catch {
        return false;
    }
}

async function writeNegativeLaunchpadCache(address: string, chainId?: number): Promise<void> {
    try {
        await setCache(
            buildNegativeCacheKey(address, chainId),
            JSON.stringify({ none: true, cachedAt: Date.now() }),
            LAUNCHPAD_NEGATIVE_CACHE_TTL_HOURS * 60 * 60
        );
    } catch {
        // Ignore persistent cache errors
    }
}

async function readRetryLaunchpadCache(address: string, chainId?: number): Promise<boolean> {
    try {
        const raw = await getCache(buildRetryCacheKey(address, chainId));
        if (!raw) return false;
        const parsed = JSON.parse(raw) as any;
        const until = Number(parsed?.until || 0);
        return Number.isFinite(until) && until > Date.now();
    } catch {
        return false;
    }
}

async function writeRetryLaunchpadCache(address: string, chainId?: number): Promise<void> {
    const until = Date.now() + LAUNCHPAD_RETRY_CACHE_TTL_SECONDS * 1000;
    try {
        await setCache(
            buildRetryCacheKey(address, chainId),
            JSON.stringify({ until, cachedAt: Date.now() }),
            LAUNCHPAD_RETRY_CACHE_TTL_SECONDS
        );
    } catch {
        // Ignore persistent cache errors
    }
}

function isRateLimitedError(error: unknown): boolean {
    const msg = String((error as any)?.message || error || '').toLowerCase();
    return msg.includes('429') || msg.includes('rate limit') || msg.includes('too many requests');
}

function isProviderBackoffActive(provider: string): boolean {
    const state = providerBackoffState.get(provider);
    return !!state && Date.now() < state.until;
}

function markProviderRateLimited(provider: string): void {
    const prev = providerBackoffState.get(provider) || { until: 0, strikes: 0 };
    const strikes = Math.min(prev.strikes + 1, 8);
    const duration = Math.min(PROVIDER_BACKOFF_BASE_MS * Math.pow(2, strikes - 1), PROVIDER_BACKOFF_MAX_MS);
    providerBackoffState.set(provider, { until: Date.now() + duration, strikes });
}

function markProviderHealthy(provider: string): void {
    if (providerBackoffState.has(provider)) {
        providerBackoffState.delete(provider);
    }
}

function hasAnyRelevantBackoff(address: string, chainId?: number): boolean {
    const isSolana = address.length > 40 && !address.startsWith('0x');
    const isEVM = address.startsWith('0x') && address.length === 42;
    if (isSolana) {
        return isProviderBackoffActive('pumpfun') || isProviderBackoffActive('bonkfun');
    }
    if (!isEVM) return false;
    const basePlatforms = (chainId === 8453 || !chainId);
    const bscPlatforms = (chainId === 56 || !chainId);
    if (basePlatforms) {
        if (isProviderBackoffActive('zora')
            || isProviderBackoffActive('virtuals')
            || isProviderBackoffActive('paragraph')
            || isProviderBackoffActive('clanker')
            || isProviderBackoffActive('flap')) {
            return true;
        }
    }
    if (bscPlatforms && isProviderBackoffActive('fourmeme')) {
        return true;
    }
    return false;
}

let paragraphClient: any | null = null;
let paragraphClientInited = false;

async function getParagraphToken(address: string): Promise<any | null> {
    try {
        if (isProviderBackoffActive('paragraph')) return null;

        if (!paragraphClientInited) {
            paragraphClientInited = true;
            const apiKey = process.env.PARAGRAPH_API_KEY;
            if (apiKey) {
                const sdk = await import('@paragraph_xyz/sdk');
                const ParagraphAPI = (sdk as any).ParagraphAPI;
                if (ParagraphAPI) {
                    paragraphClient = new ParagraphAPI(apiKey);
                }
            }
        }

        if (!paragraphClient || typeof paragraphClient.getCoinByContract !== 'function') {
            return null;
        }

        const coin = await paragraphClient.getCoinByContract(address);
        markProviderHealthy('paragraph');
        return coin || null;
    } catch (error: any) {
        if (isRateLimitedError(error)) {
            markProviderRateLimited('paragraph');
        }
        logger.debug(LogCode.SYS_INFO, 'LaunchpadDetector: Paragraph detection failed', {
            address,
            error: error?.message?.slice(0, 120)
        });
        return null;
    }
}


/**
 * Detect Four.meme token (BSC)
 */
async function getFourMemeToken(address: string): Promise<any | null> {
    try {
        if (isProviderBackoffActive('fourmeme')) return null;
        const url = `https://four.meme/meme-api/v1/private/token/get?address=${encodeURIComponent(address)}`;
        const data = await fetchJson({
            url,
            timeout: 10000,
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (data.code === 0 && data.data) {
            markProviderHealthy('fourmeme');
            return {
                ...data.data,
                createdAt: data.data.createDate ? parseInt(data.data.createDate) : undefined
            };
        }
        markProviderHealthy('fourmeme');

        return null;
    } catch (error: any) {
        if (isRateLimitedError(error)) {
            markProviderRateLimited('fourmeme');
        }
        logger.error(LogCode.API_FETCH_FAILED, 'LaunchpadDetector: Four.meme fetch failed', { address, error: error.message, cause: error.cause });
        return null;
    }
}

function normalizeEvmAddress(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const addr = value.trim().toLowerCase();
    return /^0x[0-9a-f]{40}$/.test(addr) ? addr : null;
}

async function getZoraAddressIndex(): Promise<Set<string>> {
    const now = Date.now();
    if (zoraAddressIndexCache && zoraAddressIndexCache.expiry > now) {
        return zoraAddressIndexCache.set;
    }
    if (zoraAddressIndexInflight) return zoraAddressIndexInflight;

    zoraAddressIndexInflight = (async () => {
        const discovered = new Set<string>();
        try {
            const [topVolume, topGainers, combinedNew] = await Promise.all([
                zoraService.getTopVolume24h(120).catch(() => []),
                zoraService.getTopGainers(120).catch(() => []),
                zoraService.getCombinedNewCoins(120).catch(() => [])
            ]);

            for (const row of [...topVolume, ...topGainers, ...combinedNew]) {
                const addr = normalizeEvmAddress((row as any)?.address);
                if (addr) discovered.add(addr);
            }
            markProviderHealthy('zora');
        } catch {
            // ignore
        }

        zoraAddressIndexCache = { set: discovered, expiry: Date.now() + ZORA_INDEX_TTL_MS };
        zoraAddressIndexInflight = null;
        return discovered;
    })();

    return zoraAddressIndexInflight;
}

async function getClankerToken(address: string): Promise<any | null> {
    try {
        if (isProviderBackoffActive('clanker')) return null;
        const apiKey = process.env.CLANKER_API_KEY;
        if (!apiKey) return null;

        const url = `https://www.clanker.world/api/get-clanker-by-address?address=${encodeURIComponent(address)}`;
        const data = await fetchJson({
            url,
            timeout: 8000,
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'x-api-key': apiKey
            }
        }) as any;

        if (!data || data.error) return null;
        const tokenAddress = normalizeEvmAddress(data?.tokenAddress || data?.address || data?.clanker?.tokenAddress || data?.clanker?.address);
        if (tokenAddress && tokenAddress === address.toLowerCase()) {
            markProviderHealthy('clanker');
            return data;
        }
        markProviderHealthy('clanker');
        return null;
    } catch (error: any) {
        if (isRateLimitedError(error)) {
            markProviderRateLimited('clanker');
        }
        return null;
    }
}

async function getVirtualsToken(address: string, _mode: DetectMode = 'full'): Promise<any | null> {
    try {
        if (isProviderBackoffActive('virtuals')) return null;
        const lower = address.toLowerCase();
        const baseUrl = 'https://api2.virtuals.io/api/virtuals';

        const queryByField = async (field: 'tokenAddress' | 'migrateTokenAddress') => {
            const url = new URL(baseUrl);
            url.searchParams.append(`filters[${field}][]`, address);
            url.searchParams.append('page', '1');
            const data = await fetchJson({
                url: url.toString(),
                timeout: 8000,
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            }) as any;
            return Array.isArray(data?.data) ? data.data : [];
        };

        const settled = await Promise.allSettled([
            queryByField('tokenAddress'),
            queryByField('migrateTokenAddress'),
        ]);

        const rowsA = settled[0].status === 'fulfilled' ? settled[0].value : [];
        const rowsB = settled[1].status === 'fulfilled' ? settled[1].value : [];
        const errors = settled
            .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
            .map((r) => r.reason);
        if (errors.length === settled.length) {
            throw errors[0];
        }
        if (errors.some((e) => isRateLimitedError(e))) {
            markProviderRateLimited('virtuals');
        } else {
            markProviderHealthy('virtuals');
        }

        const rows = [...rowsA, ...rowsB];
        const hit = rows.find((row: any) => {
            const tokenAddress = normalizeEvmAddress(row?.tokenAddress);
            const migrateTokenAddress = normalizeEvmAddress(row?.migrateTokenAddress);
            const chain = String(row?.chain || '').toLowerCase();
            const onBase = chain === 'base' || chain === '8453';
            return onBase && (tokenAddress === lower || migrateTokenAddress === lower);
        });

        if (!hit) return null;

        markProviderHealthy('virtuals');
        return {
            address: hit.tokenAddress || hit.migrateTokenAddress || address,
            symbol: hit.symbol || 'UNKNOWN',
            name: hit.name || 'Unknown',
            lpAddress: hit.lpAddress || undefined,
            virtualId: hit.id,
            source: 'virtuals_api'
        };
    } catch (error: any) {
        if (isRateLimitedError(error)) {
            markProviderRateLimited('virtuals');
        }
        logger.debug(LogCode.SYS_INFO, 'LaunchpadDetector: Virtuals detection failed', {
            address,
            error: error?.message?.slice(0, 120)
        });
        return null;
    }
}

function normalizeMaybeIpfsUri(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const raw = value.trim();
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith('ipfs://')) {
        return `${FLAP_IPFS_GATEWAY}${raw.slice('ipfs://'.length).replace(/^ipfs\//, '')}`;
    }
    if (/^[a-zA-Z0-9]+$/.test(raw) && raw.length >= 32) {
        return `${FLAP_IPFS_GATEWAY}${raw}`;
    }
    return null;
}

async function resolveFlapTokenImage(metaUri: string | null): Promise<string | null> {
    if (!metaUri) return null;
    const metaUrl = normalizeMaybeIpfsUri(metaUri);
    if (!metaUrl) return null;

    try {
        const metadata = await fetchJson<any>({
            url: metaUrl,
            timeout: 4000,
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        return normalizeMaybeIpfsUri(metadata?.image || metadata?.image_url || metadata?.logo || null);
    } catch {
        return null;
    }
}

async function getFlapToken(address: string): Promise<any | null> {
    try {
        if (isProviderBackoffActive('flap')) return null;
        const provider = getEthersProvider(56);
        const portal = new ethers.Contract(FLAP_PORTAL_BSC_MAINNET, FLAP_PORTAL_ABI, provider);

        let tokenInfo: any = null;
        try {
            tokenInfo = await portal.getTokenV6(address);
        } catch {
            tokenInfo = await portal.getTokenV5(address);
        }

        const statusRaw = Number(tokenInfo?.status ?? tokenInfo?.[0] ?? 0);
        if (!Number.isFinite(statusRaw) || statusRaw <= 0) {
            markProviderHealthy('flap');
            return null;
        }

        const token = new ethers.Contract(address, FLAP_META_ABI, provider);
        let metaUri: string | null = null;
        let name = 'Unknown';
        let symbol = 'UNKNOWN';
        try { metaUri = await token.metaURI(); } catch { /* no-op */ }
        if (!metaUri) {
            try { metaUri = await token.meta(); } catch { /* no-op */ }
        }
        if (!metaUri) {
            try { metaUri = await token.tokenURI(); } catch { /* no-op */ }
        }
        try { name = await token.name(); } catch { /* no-op */ }
        try { symbol = await token.symbol(); } catch { /* no-op */ }

        const imageUrl = await resolveFlapTokenImage(metaUri);
        markProviderHealthy('flap');
        return {
            address,
            name,
            symbol,
            status: statusRaw,
            source: 'flap_portal',
            metaURI: metaUri || undefined,
            imageUrl: imageUrl || undefined
        };
    } catch (error: any) {
        if (isRateLimitedError(error)) {
            markProviderRateLimited('flap');
        }
        return null;
    }
}

/**
 * Detect Pump.fun token (Solana)
 */
async function getPumpFunToken(mintAddress: string): Promise<any | null> {
    try {
        const normalizedMint = mintAddress.trim();
        // 1. Try Official API (might be unstable)
        const url = `https://frontend-api.pump.fun/coins/${mintAddress}`;
        try {
            const data = await fetchJson({
                url,
                timeout: 3000,
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                }
            });
            if (data && data.mint) return data;
        } catch (e) {
            // Continue to fallback
        }

        // 2b. Try Core Frontend API v3 (POST /coins/mints) - Good for batch or stable lookup
        try {
            const batchUrl = 'https://frontend-api.pump.fun/coins/mints';
            const batchData = await fetchJson({
                url: batchUrl,
                method: 'POST',
                timeout: 3000,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                },
                body: JSON.stringify([mintAddress])
            });

            if (batchData && batchData.length > 0 && batchData[0].mint === mintAddress) {
                return batchData[0];
            }
        } catch (e) {
            // Silently fail to next fallback
        }

        // 3. Fallback: PumpPortal.fun (Often more stable)
        try {
            const portalUrl = `https://pumpportal.fun/api/data/token-info?ca=${mintAddress}`;
            const portalData = await fetchJson({
                url: portalUrl,
                timeout: 3000
            });

            // Strict match to avoid false positives from third-party mirror APIs.
            const portalMint = String(portalData?.mint || portalData?.address || '').trim();
            if (portalMint && portalMint === normalizedMint) {
                return portalData;
            }
        } catch (e) {
            logger.debug(LogCode.SYS_INFO, 'LaunchpadDetector: PumpPortal fallback failed');
        }

        // Fallback: Official Raydium V3 API - Often has Pump.fun tokens indexed too
        try {
            const raydiumUrl = `https://api-v3.raydium.io/mint/ids?mints=${mintAddress}`;
            const raydiumData = await fetchJson({
                url: raydiumUrl,
                timeout: 3000
            });

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
        } catch (e) {
            // Final fallback failed
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
        try {
            const data = await fetchJson({
                url: raydiumUrl,
                timeout: 3000,
                headers
            });

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
        } catch (e) {
            // Continue to DexScreener fallback
        }

        // No non-official fallback here by design.
        // For Bonk/LaunchLab detection we only trust Raydium official signals + on-chain authority checks.
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
    chainId?: number,
    options: DetectOptions = {}
): Promise<LaunchpadResult | null> {
    const mode = options.mode || 'full';
    const cacheKey = `${chainId || 'any'}:${mode}:${address.toLowerCase()}`;
    const cached = DETECTION_CACHE.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
        return cached.result;
    }

    const persistent = await readPersistentLaunchpadCache(address, chainId);
    if (persistent) {
        DETECTION_CACHE.set(cacheKey, { result: persistent, expiry: Date.now() + CACHE_TTL });
        return persistent;
    }
    if (await readRetryLaunchpadCache(address, chainId)) {
        DETECTION_CACHE.set(cacheKey, { result: null, expiry: Date.now() + Math.min(CACHE_TTL, 60_000) });
        return null;
    }
    if (await readNegativeLaunchpadCache(address, chainId)) {
        DETECTION_CACHE.set(cacheKey, { result: null, expiry: Date.now() + CACHE_TTL });
        return null;
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
            handleDetection(address, chainId, cacheKey, options),
            timeoutPromise
        ]);
        if (timeoutId) clearTimeout(timeoutId);

        if (result) {
            await writePersistentLaunchpadCache(address, chainId, result);
        } else if (hasAnyRelevantBackoff(address, chainId)) {
            await writeRetryLaunchpadCache(address, chainId);
        } else {
            await writeNegativeLaunchpadCache(address, chainId);
        }

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
    cacheKey: string,
    options: DetectOptions
): Promise<LaunchpadResult | null> {
  const isSolana = address.length > 40 && !address.startsWith('0x');
  const isEVM = address.startsWith('0x') && address.length === 42;
  const lowerAddress = address.toLowerCase();

    if (!isSolana && !isEVM) {
        return null;
    }

  if (isSolana) {
        // Fast suffix detection first (cheap and deterministic for launchpad mints)
        if (lowerAddress.endsWith('pump')) {
            const result: LaunchpadResult = {
                provider: 'pumpfun',
                data: { mint: address, source: 'suffix' },
                chainId: SOLANA_CONFIG.CHAIN_ID
            };
            DETECTION_CACHE.set(cacheKey, { result, expiry: Date.now() + CACHE_TTL });
            return result;
        }

        if (lowerAddress.endsWith('bonk')) {
            const result: LaunchpadResult = {
                provider: 'bonkfun',
                data: { mint: address, source: 'suffix' },
                chainId: SOLANA_CONFIG.CHAIN_ID
            };
            DETECTION_CACHE.set(cacheKey, { result, expiry: Date.now() + CACHE_TTL });
            return result;
        }

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

        // Fast suffix rules (no API call needed)
        if (bscPlatforms && FOURMEME_SUFFIXES.some((s) => lowerAddress.endsWith(s))) {
            const result: LaunchpadResult = {
                provider: 'fourmeme',
                data: {
                    address,
                    source: 'suffix',
                    vanitySuffix: lowerAddress.endsWith('ffff') ? 'ffff' : '4444'
                },
                chainId: 56
            };
            DETECTION_CACHE.set(cacheKey, { result, expiry: Date.now() + CACHE_TTL });
            return result;
        }
        if (bscPlatforms && FLAP_SUFFIXES.some((s) => lowerAddress.endsWith(s))) {
            try {
                const flapResult = await getFlapToken(address);
                if (flapResult) {
                    const result: LaunchpadResult = {
                        provider: 'flap',
                        data: {
                            ...flapResult,
                            vanitySuffix: lowerAddress.endsWith('7777') ? '7777' : '8888'
                        },
                        chainId: 56
                    };
                    DETECTION_CACHE.set(cacheKey, { result, expiry: Date.now() + CACHE_TTL });
                    return result;
                }
            } catch {
                // flap verify failed, continue to other checks
            }
        }

        // Clanker must take precedence for b07 addresses to avoid Zora over-labeling.
        if (basePlatforms && lowerAddress.endsWith(CLANKER_SUFFIX)) {
            try {
                const clankerResult = await getClankerToken(address);
                if (clankerResult) {
                    const result: LaunchpadResult = { provider: 'clanker', data: clankerResult, chainId: 8453 };
                    DETECTION_CACHE.set(cacheKey, { result, expiry: Date.now() + CACHE_TTL });
                    return result;
                }
            } catch {
                // Clanker API check failed
            }

            const result: LaunchpadResult = {
                provider: 'clanker',
                data: { address, source: 'suffix_fallback' },
                chainId: 8453
            };
            DETECTION_CACHE.set(cacheKey, { result, expiry: Date.now() + CACHE_TTL });
            return result;
        }

        // Check for ZORA platform token first (lightning check)
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
        if (basePlatforms && !isProviderBackoffActive('zora')) {
            try {
                const zoraResult = await zoraService.getCoinByAddress(address);
                if (zoraResult) {
                    markProviderHealthy('zora');
                    const result: LaunchpadResult = { provider: 'zora', data: zoraResult, chainId: 8453 };
                    DETECTION_CACHE.set(cacheKey, { result, expiry: Date.now() + CACHE_TTL });
                    return result;
                }
                markProviderHealthy('zora');
            } catch (e) {
                if (isRateLimitedError(e)) {
                    markProviderRateLimited('zora');
                }
                // Zora check failed, continue to other platforms
            }
        }

        // Priority 1.5: Zora API index fallback (still official Zora API/SDK data)
        if (basePlatforms) {
            try {
                const zoraIndex = await getZoraAddressIndex();
                if (zoraIndex.has(lowerAddress)) {
                    const result: LaunchpadResult = {
                        provider: 'zora',
                        data: { address, source: 'zora_api_index' },
                        chainId: 8453
                    };
                    DETECTION_CACHE.set(cacheKey, { result, expiry: Date.now() + CACHE_TTL });
                    return result;
                }
            } catch {
                // Zora index fallback failed
            }
        }

        // Priority 1.6: Virtuals official API (Base only)
        if (basePlatforms) {
            try {
                const virtualsResult = await getVirtualsToken(address, options.mode || 'full');
                if (virtualsResult) {
                    const result: LaunchpadResult = { provider: 'virtuals', data: virtualsResult, chainId: 8453 };
                    DETECTION_CACHE.set(cacheKey, { result, expiry: Date.now() + CACHE_TTL });
                    return result;
                }
            } catch {
                // Virtuals check failed
            }
        }

        // Priority 1.8: Paragraph (Base)
        if (basePlatforms) {
            try {
                const paragraphResult = await getParagraphToken(address);
                if (paragraphResult) {
                    const result: LaunchpadResult = { provider: 'paragraph', data: paragraphResult, chainId: 8453 };
                    DETECTION_CACHE.set(cacheKey, { result, expiry: Date.now() + CACHE_TTL });
                    return result;
                }
            } catch {
                // Paragraph check failed
            }
        }

        // Priority 2: FourMeme (BSC only)
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
