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
import { DOPPLER_HOOKS_BY_CHAIN } from '../dex/v4Hooks.js';

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
    provider: 'zora' | 'fourmeme' | 'flap' | 'pumpfun' | 'bonkfun' | 'virtuals' | 'clanker' | 'paragraph' | 'doppler';
    data: any;
    chainId: number;
}

type DetectMode = 'full' | 'cheap';

type DetectOptions = {
    mode?: DetectMode;
    forceRefresh?: boolean;
    requireCreator?: boolean;
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
const PUMPFUN_FRONTEND_BASES = (process.env.PUMPFUN_FRONTEND_BASES
    ? process.env.PUMPFUN_FRONTEND_BASES.split(',').map((v) => v.trim()).filter(Boolean)
    : [
        'https://frontend-api-v3.pump.fun',
        'https://frontend-api-v2.pump.fun',
        'https://frontend-api.pump.fun',
    ]);
const DOPPLER_INDEXER_BASES = (process.env.DOPPLER_INDEXER_BASES
    ? process.env.DOPPLER_INDEXER_BASES.split(',').map((v) => v.trim()).filter(Boolean)
    : [
        'https://indexer-prod.marble.live/graphql',
        'https://testnet-indexer.doppler.lol/graphql',
    ]);
const DOPPLER_INDEXER_API_KEY = process.env.DOPPLER_INDEXER_API_KEY || process.env.DOPPLER_API_KEY || '';
const DOPPLER_INDEXER_BEARER = process.env.DOPPLER_INDEXER_BEARER || process.env.DOPPLER_BEARER_TOKEN || '';
const FLAP_CREATOR_ABI = [
    'function creator() view returns (address)',
    'function getCreator() view returns (address)',
    'function owner() view returns (address)',
    'function deployer() view returns (address)',
    'function dev() view returns (address)'
] as const;
const UNISWAP_V4_POOL_MANAGER_BY_CHAIN: Record<number, string> = {
    8453: '0x000000000004444c5dc75cb358380d2e3de08a90',
    1: '0x000000000004444c5dc75cb358380d2e3de08a90'
};
const V4_INIT_EVENT = ethers.id('Initialize(bytes32,address,address,uint24,int24,address,uint160,int24)');
const v4InitEventInterface = new ethers.Interface([
    'event Initialize(bytes32 indexed id, address indexed currency0, address indexed currency1, uint24 fee, int24 tickSpacing, address hooks, uint160 sqrtPriceX96, int24 tick)'
]);
const PROVIDER_BACKOFF_BASE_MS = Math.max(30_000, Number(process.env.LAUNCHPAD_PROVIDER_BACKOFF_BASE_MS || '120000'));
const PROVIDER_BACKOFF_MAX_MS = Math.max(PROVIDER_BACKOFF_BASE_MS, Number(process.env.LAUNCHPAD_PROVIDER_BACKOFF_MAX_MS || '1800000'));
const providerBackoffState = new Map<string, { until: number; strikes: number }>();
const LAUNCHPAD_CACHE_PREFIX = 'launchpad:detected:v2';
const LAUNCHPAD_CACHE_TTL_HOURS = Math.max(24, Number(process.env.LAUNCHPAD_CACHE_TTL_HOURS || '72'));
const LAUNCHPAD_NEGATIVE_CACHE_PREFIX = 'launchpad:detected:none:v1';
const LAUNCHPAD_NEGATIVE_CACHE_TTL_HOURS = Math.max(1, Number(process.env.LAUNCHPAD_NEGATIVE_CACHE_TTL_HOURS || '24'));
const LAUNCHPAD_RETRY_CACHE_PREFIX = 'launchpad:detected:retry:v1';
const LAUNCHPAD_RETRY_CACHE_TTL_SECONDS = Math.max(60, Number(process.env.LAUNCHPAD_RETRY_CACHE_TTL_SECONDS || '1200'));
const LAUNCHPAD_RAW_CACHE_PREFIX = 'launchpad:raw:v1';
const LAUNCHPAD_RAW_CACHE_TTL_SECONDS = Math.max(10 * 60, Number(process.env.LAUNCHPAD_RAW_CACHE_TTL_SECONDS || `${60 * 60}`));
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

function buildRawCacheKey(provider: string, address: string, chainId?: number): string {
    return `${LAUNCHPAD_RAW_CACHE_PREFIX}:${provider}:${chainId || 'any'}:${address.toLowerCase()}`;
}

function isLaunchpadProvider(value: unknown): value is LaunchpadResult['provider'] {
    return value === 'zora'
        || value === 'fourmeme'
        || value === 'flap'
        || value === 'pumpfun'
        || value === 'bonkfun'
        || value === 'virtuals'
        || value === 'clanker'
        || value === 'paragraph'
        || value === 'doppler';
}

function buildDopplerHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };
    if (DOPPLER_INDEXER_API_KEY) {
        headers['x-api-key'] = DOPPLER_INDEXER_API_KEY;
    }
    if (DOPPLER_INDEXER_BEARER) {
        headers['Authorization'] = `Bearer ${DOPPLER_INDEXER_BEARER}`;
    }
    return headers;
}

function hasCreatorInResult(result: LaunchpadResult | null | undefined): boolean {
    if (!result || !result.data || typeof result.data !== 'object') return false;
    const data = result.data as Record<string, unknown>;
    const candidates: unknown[] = [
        data.creatorAddress,
        data.creator,
        data.creator_address,
        data.userAddress,
        data.user_address,
        data.owner,
        data.ownerAddress,
        data.deployer,
        data.deployerAddress,
        (data as any)?.creatorProfile?.address,
        (data as any)?.profile?.address,
        (data as any)?.user?.address,
    ];
    const evmLike = /0x[a-fA-F0-9]{40}/;
    const solLike = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    for (const raw of candidates) {
        if (typeof raw !== 'string') continue;
        const v = raw.trim();
        if (evmLike.test(v) || solLike.test(v)) return true;
    }
    return false;
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

async function readRawLaunchpadCache<T = any>(provider: string, address: string, chainId?: number): Promise<T | null> {
    try {
        const raw = await getCache(buildRawCacheKey(provider, address, chainId));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { data?: T };
        return (parsed?.data ?? null) as T | null;
    } catch {
        return null;
    }
}

async function writeRawLaunchpadCache(provider: string, address: string, chainId: number | undefined, data: any): Promise<void> {
    try {
        await setCache(
            buildRawCacheKey(provider, address, chainId),
            JSON.stringify({ data, cachedAt: Date.now() }),
            LAUNCHPAD_RAW_CACHE_TTL_SECONDS
        );
    } catch {
        // Ignore raw cache errors
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
            || isProviderBackoffActive('doppler')
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
            const creatorAddress = normalizeEvmAddress(
                data.data.userAddress
                || data.data.accountAddress
                || data.data.ownerAddress
                || data.data.owner
                || data.data.creatorAddress
                || data.data.creator
                || data.data.deployer
            ) || undefined;
            const twitterUrl = typeof data.data.twitterUrl === 'string' ? data.data.twitterUrl : undefined;
            let creatorLabel: string | undefined;
            if (twitterUrl) {
                const user = extractXUsernameFromUrl(twitterUrl);
                if (user) creatorLabel = `@${user}`;
            }
            if (!creatorLabel) {
                creatorLabel = creatorAddress || undefined;
            }
            return {
                ...data.data,
                creatorAddress,
                // four.meme creator rule: twitter first, fallback to creator wallet
                creatorUrl: twitterUrl || undefined,
                creatorLabel,
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

function extractXUsernameFromUrl(raw?: string): string | null {
    if (!raw) return null;
    try {
        const u = new URL(raw.trim());
        const host = u.hostname.replace(/^www\./, '').toLowerCase();
        if (!host.includes('x.com') && !host.includes('twitter.com')) return null;
        const parts = u.pathname.split('/').filter(Boolean);
        const user = (parts[0] || '').trim().replace(/^@/, '');
        if (!user) return null;
        const reserved = new Set([
            'i', 'intent', 'share', 'home', 'explore', 'search', 'messages',
            'notifications', 'settings', 'tos', 'privacy', 'status'
        ]);
        if (reserved.has(user.toLowerCase())) return null;
        return user;
    } catch {
        return null;
    }
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
        const lower = address.toLowerCase();

        const cachedPayload = await readRawLaunchpadCache<any>('clanker', lower, 8453);
        if (cachedPayload) {
            const tokenAddress = normalizeEvmAddress(
                cachedPayload?.contract_address
                || cachedPayload?.token_address
                || cachedPayload?.tokenAddress
                || cachedPayload?.address
                || cachedPayload?.clanker?.tokenAddress
                || cachedPayload?.clanker?.address
            );
            if (tokenAddress === lower) {
                const requestorFid = Number(cachedPayload?.requestor_fid || cachedPayload?.requestorFid || 0);
                const socialContext = cachedPayload?.social_context || {};
                const socialCandidates: string[] = [
                    socialContext?.messageId,
                    socialContext?.message_id,
                    socialContext?.twitter,
                    socialContext?.x,
                    socialContext?.url,
                    socialContext?.link,
                    socialContext?.profile,
                    cachedPayload?.twitter,
                    cachedPayload?.twitterUrl,
                    cachedPayload?.x,
                    cachedPayload?.xUrl,
                ].filter((v): v is string => typeof v === 'string' && !!v.trim());
                const xUrl = socialCandidates.find((raw) => {
                    try {
                        const u = new URL(raw.trim());
                        return u.hostname.includes('x.com') || u.hostname.includes('twitter.com');
                    } catch {
                        return false;
                    }
                });
                const creatorUrl = xUrl || (requestorFid > 0 ? `https://warpcast.com/~/profiles/${requestorFid}` : undefined);
                let creatorLabel: string | undefined;
                if (xUrl) {
                    const user = extractXUsernameFromUrl(xUrl);
                    if (user) creatorLabel = `@${user}`;
                }
                if (!creatorLabel) {
                    const socialId = typeof socialContext?.id === 'string' ? socialContext.id.trim() : '';
                    if (socialId) creatorLabel = /^\d+$/.test(socialId) ? 'Farcaster' : `@${socialId.replace(/^@/, '')}`;
                }
                markProviderHealthy('clanker');
                return {
                    ...cachedPayload,
                    source: 'clanker_api_cache',
                    creatorAddress: cachedPayload?.msg_sender || cachedPayload?.creator || undefined,
                    creatorUrl,
                    creatorLabel,
                    imageUrl: cachedPayload?.img_url || cachedPayload?.image || undefined,
                };
            }
        }

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

        // Clanker API may return either the token payload directly or wrapped in { data: {...} }.
        const payload = (data && typeof data === 'object' && data.data && typeof data.data === 'object')
            ? data.data
            : data;

        const tokenAddress = normalizeEvmAddress(
            (payload as any)?.contract_address
            || (payload as any)?.token_address
            || (payload as any)?.tokenAddress
            || (payload as any)?.address
            || (payload as any)?.clanker?.tokenAddress
            || (payload as any)?.clanker?.address
        );
        if (tokenAddress && tokenAddress === address.toLowerCase()) {
            await writeRawLaunchpadCache('clanker', lower, 8453, payload);
            markProviderHealthy('clanker');
            const requestorFid = Number((payload as any)?.requestor_fid || (payload as any)?.requestorFid || 0);
            const socialContext = (payload as any)?.social_context || {};
            const socialCandidates: string[] = [
                socialContext?.messageId,
                socialContext?.message_id,
                socialContext?.twitter,
                socialContext?.x,
                socialContext?.url,
                socialContext?.link,
                socialContext?.profile,
                (payload as any)?.twitter,
                (payload as any)?.twitterUrl,
                (payload as any)?.x,
                (payload as any)?.xUrl,
            ].filter((v): v is string => typeof v === 'string' && !!v.trim());
            const xUrl = socialCandidates.find((raw) => {
                try {
                    const u = new URL(raw.trim());
                    return u.hostname.includes('x.com') || u.hostname.includes('twitter.com');
                } catch {
                    return false;
                }
            });
            const creatorUrl = xUrl || (requestorFid > 0 ? `https://warpcast.com/~/profiles/${requestorFid}` : undefined);

            let creatorLabel: string | undefined;
            if (xUrl) {
                const user = extractXUsernameFromUrl(xUrl);
                if (user) creatorLabel = `@${user}`;
            }
            if (!creatorLabel) {
                const socialId = typeof socialContext?.id === 'string' ? socialContext.id.trim() : '';
                if (socialId) {
                    creatorLabel = /^\d+$/.test(socialId) ? 'Farcaster' : `@${socialId.replace(/^@/, '')}`;
                }
            }

            return {
                ...(payload as any),
                source: 'clanker_api',
                creatorAddress: (payload as any)?.msg_sender || (payload as any)?.creator || undefined,
                creatorUrl,
                creatorLabel,
                imageUrl: (payload as any)?.img_url || (payload as any)?.image || undefined,
            };
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
            walletAddress: hit.walletAddress || undefined,
            sentientWalletAddress: hit.sentientWalletAddress || undefined,
            socials: hit.socials || undefined,
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

async function getDopplerToken(address: string, chainId?: number): Promise<any | null> {
    try {
        if (isProviderBackoffActive('doppler')) return null;
        const lower = address.toLowerCase();
        const cid = Number(chainId || 8453);
        const headers = buildDopplerHeaders();
        const query = `query DopplerToken($address: String!, $chainId: Float!) {
  token(address: $address, chainId: $chainId) {
    address
    chainId
    name
    symbol
    image
    creatorAddress
    isDerc20
    isCreatorCoin
    firstSeenAt
    pool {
      address
      fee
      volumeUsd
    }
  }
}`;
        const isUsableDopplerHit = (hit: any): boolean => {
            if (!hit || typeof hit !== 'object') return false;
            const hasPool = !!normalizeEvmAddress(hit?.pool?.address || '');
            const isDerc20 = hit?.isDerc20 === true;
            const isCreatorCoin = hit?.isCreatorCoin === true;
            // Strict Doppler signal only: explicit launchpad flags/pool presence.
            // Do not trust generic creatorAddress because indexer can return broad token matches.
            return hasPool || isDerc20 || isCreatorCoin;
        };

        const cachedHit = await readRawLaunchpadCache<any>('doppler', lower, cid);
        if (cachedHit && normalizeEvmAddress(cachedHit?.address) === lower && isUsableDopplerHit(cachedHit)) {
            markProviderHealthy('doppler');
            return {
                ...cachedHit,
                source: 'doppler_graphql_token_cache',
                creatorAddress: cachedHit?.creatorAddress || undefined,
                creatorUrl: undefined,
                creatorLabel: undefined,
                imageUrl: cachedHit?.image || undefined,
                poolAddress: cachedHit?.pool?.address || undefined,
            };
        }

        for (const base of DOPPLER_INDEXER_BASES) {
            try {
                const url = String(base || '').replace(/\/+$/, '').endsWith('/graphql')
                    ? String(base || '').replace(/\/+$/, '')
                    : `${String(base || '').replace(/\/+$/, '')}/graphql`;
                const data = await fetchJson({
                    url,
                    method: 'POST',
                    timeout: 5000,
                    headers,
                    body: JSON.stringify({
                        query,
                        variables: {
                            address,
                            chainId: cid
                        }
                    })
                }) as any;

                const hit = data?.data?.token || null;
                const normalizedAddress = normalizeEvmAddress(hit?.address);
                if (hit && normalizedAddress === lower && isUsableDopplerHit(hit)) {
                    await writeRawLaunchpadCache('doppler', lower, cid, hit);
                    markProviderHealthy('doppler');
                    return {
                        ...hit,
                        source: 'doppler_graphql_token',
                        creatorAddress: hit?.creatorAddress || undefined,
                        creatorUrl: undefined,
                        creatorLabel: undefined,
                        imageUrl: hit?.image || undefined,
                        poolAddress: hit?.pool?.address || undefined,
                    };
                }
                markProviderHealthy('doppler');
            } catch (e) {
                const msg = String((e as any)?.message || '').toLowerCase();
                if (isRateLimitedError(e) || msg.includes('fetch failed') || msg.includes('enotfound')) {
                    markProviderRateLimited('doppler');
                }
            }
        }
        return null;
    } catch (error: any) {
        if (isRateLimitedError(error)) markProviderRateLimited('doppler');
        logger.debug(LogCode.SYS_INFO, 'LaunchpadDetector: Doppler detection failed', {
            address,
            error: error?.message?.slice(0, 120)
        });
        return null;
    }
}

export async function getDopplerTokensBatch(addresses: string[], chainId = 8453): Promise<Map<string, any>> {
    const result = new Map<string, any>();
    const normalized = Array.from(new Set(
        addresses
            .map((a) => normalizeEvmAddress(a))
            .filter((a): a is string => !!a)
    ));
    if (normalized.length === 0) return result;
    if (isProviderBackoffActive('doppler')) return result;

    const headers = buildDopplerHeaders();
    const query = `query DopplerTokens($chainId: Int!, $addresses: [String!], $limit: Int!) {
  tokens(where: { chainId: $chainId, address_in: $addresses }, limit: $limit) {
    items {
      address
      chainId
      name
      symbol
      image
      creatorAddress
      isDerc20
      isCreatorCoin
      firstSeenAt
      pool {
        address
        fee
        volumeUsd
      }
    }
  }
}`;

    for (const base of DOPPLER_INDEXER_BASES) {
        try {
            const url = String(base || '').replace(/\/+$/, '').endsWith('/graphql')
                ? String(base || '').replace(/\/+$/, '')
                : `${String(base || '').replace(/\/+$/, '')}/graphql`;
            const data = await fetchJson({
                url,
                method: 'POST',
                timeout: 5000,
                headers,
                body: JSON.stringify({
                    query,
                    variables: {
                        chainId: Number(chainId),
                        addresses: normalized,
                        limit: Math.max(20, normalized.length + 10)
                    }
                })
            }) as any;

            const items = Array.isArray(data?.data?.tokens?.items) ? data.data.tokens.items : [];
            for (const item of items) {
                const addr = normalizeEvmAddress(item?.address);
                if (!addr) continue;
                const hasPool = !!normalizeEvmAddress(item?.pool?.address || '');
                const isDerc20 = item?.isDerc20 === true;
                const isCreatorCoin = item?.isCreatorCoin === true;
                if (!(hasPool || isDerc20 || isCreatorCoin)) continue;
                await writeRawLaunchpadCache('doppler', addr, chainId, item);
                result.set(addr, {
                    ...item,
                    source: 'doppler_graphql_batch',
                    creatorAddress: item?.creatorAddress || undefined,
                    creatorUrl: undefined,
                    creatorLabel: undefined,
                    imageUrl: item?.image || undefined,
                    poolAddress: item?.pool?.address || undefined,
                });
            }

            markProviderHealthy('doppler');
            return result;
        } catch (e) {
            const msg = String((e as any)?.message || '').toLowerCase();
            if (isRateLimitedError(e) || msg.includes('fetch failed') || msg.includes('enotfound')) {
                markProviderRateLimited('doppler');
            }
        }
    }

    return result;
}

async function getDopplerTokenByV4Hook(address: string, chainId?: number): Promise<any | null> {
    try {
        const cid = Number(chainId || 8453);
        if (cid !== 8453) return null;
        const poolManager = UNISWAP_V4_POOL_MANAGER_BY_CHAIN[cid];
        if (!poolManager) return null;
        const provider = getEthersProvider(cid);
        const normalizedAddress = normalizeEvmAddress(address);
        if (!normalizedAddress) return null;
        const dopplerHooks = new Set((DOPPLER_HOOKS_BY_CHAIN[cid] || []).map((h) => h.toLowerCase()));
        if (dopplerHooks.size === 0) return null;

        const latest = await provider.getBlockNumber();
        const window = Math.max(50_000, Number(process.env.DOPPLER_V4_SCAN_WINDOW || '120000'));
        const maxScan = Math.max(window, Number(process.env.DOPPLER_V4_SCAN_MAX_BLOCKS || '600000'));
        const topicAddress = ethers.zeroPadValue(normalizedAddress, 32).toLowerCase();
        const minBlock = Math.max(0, latest - maxScan);

        for (let toBlock = latest; toBlock >= minBlock; toBlock -= window) {
            const fromBlock = Math.max(minBlock, toBlock - window + 1);
            const [asCurrency0, asCurrency1] = await Promise.all([
                provider.getLogs({
                    address: poolManager,
                    fromBlock,
                    toBlock,
                    topics: [V4_INIT_EVENT, null, topicAddress]
                }),
                provider.getLogs({
                    address: poolManager,
                    fromBlock,
                    toBlock,
                    topics: [V4_INIT_EVENT, null, null, topicAddress]
                })
            ]);

            const logs = [...asCurrency0, ...asCurrency1];
            if (logs.length === 0) continue;

            for (const log of logs) {
                try {
                    const parsed = v4InitEventInterface.parseLog(log);
                    const hook = String(parsed?.args?.hooks || '').toLowerCase();
                    if (!hook || !dopplerHooks.has(hook)) continue;
                    return {
                        address: normalizedAddress,
                        source: 'doppler_v4_hook_scan',
                        hookAddress: hook,
                        txHash: log.transactionHash,
                        blockNumber: Number(log.blockNumber || 0),
                    };
                } catch {
                    // Skip malformed/unknown logs
                }
            }
        }
        return null;
    } catch {
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
        const creatorProbe = new ethers.Contract(address, FLAP_CREATOR_ABI, provider);
        let metaUri: string | null = null;
        let name = 'Unknown';
        let symbol = 'UNKNOWN';
        let creatorAddress: string | undefined;
        try { metaUri = await token.metaURI(); } catch { /* no-op */ }
        if (!metaUri) {
            try { metaUri = await token.meta(); } catch { /* no-op */ }
        }
        if (!metaUri) {
            try { metaUri = await token.tokenURI(); } catch { /* no-op */ }
        }
        try { name = await token.name(); } catch { /* no-op */ }
        try { symbol = await token.symbol(); } catch { /* no-op */ }
        try {
            const creator = await creatorProbe.creator();
            const normalized = normalizeEvmAddress(creator);
            if (normalized) creatorAddress = normalized;
        } catch { /* no-op */ }
        if (!creatorAddress) {
            try {
                const creator = await creatorProbe.getCreator();
                const normalized = normalizeEvmAddress(creator);
                if (normalized) creatorAddress = normalized;
            } catch { /* no-op */ }
        }
        if (!creatorAddress) {
            try {
                const owner = await creatorProbe.owner();
                const normalized = normalizeEvmAddress(owner);
                if (normalized) creatorAddress = normalized;
            } catch { /* no-op */ }
        }
        if (!creatorAddress) {
            try {
                const deployer = await creatorProbe.deployer();
                const normalized = normalizeEvmAddress(deployer);
                if (normalized) creatorAddress = normalized;
            } catch { /* no-op */ }
        }
        if (!creatorAddress) {
            try {
                const dev = await creatorProbe.dev();
                const normalized = normalizeEvmAddress(dev);
                if (normalized) creatorAddress = normalized;
            } catch { /* no-op */ }
        }

        const imageUrl = await resolveFlapTokenImage(metaUri);
        markProviderHealthy('flap');
        return {
            address,
            name,
            symbol,
            creatorAddress,
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

function normalizeSolanaAddress(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const v = value.trim();
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v)) return null;
    try {
        return new PublicKey(v).toBase58();
    } catch {
        return null;
    }
}

function pickSolanaCreatorAddress(payload: any): string | undefined {
    if (!payload || typeof payload !== 'object') return undefined;
    const candidates: unknown[] = [
        payload.creator,
        payload.creatorAddress,
        payload.creator_address,
        payload.creator_wallet,
        payload.creatorWallet,
        payload.user,
        payload.userAddress,
        payload.owner,
        payload.deployer,
        payload.dev,
        payload.teamWallet,
        payload.authority,
        payload.mintAuthority,
        payload.updateAuthority,
    ];
    for (const raw of candidates) {
        const addr = normalizeSolanaAddress(raw);
        if (addr) return addr;
    }
    return undefined;
}

/**
 * Detect Pump.fun token (Solana)
 */
async function getPumpFunToken(mintAddress: string): Promise<any | null> {
    try {
        const normalizedMint = mintAddress.trim();
        for (const base of PUMPFUN_FRONTEND_BASES) {
            // 1) GET /coins/:mint
            try {
                const data = await fetchJson({
                    url: `${base}/coins/${mintAddress}`,
                    timeout: 3000,
                    suppressError: true,
                    headers: {
                        'Accept': 'application/json',
                        'Origin': 'https://pump.fun',
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    }
                });
                if (data && (data as any).mint) {
                    const payload: any = data as any;
                    const creatorAddress = pickSolanaCreatorAddress(payload);
                    const twitter = typeof payload.twitter === 'string' ? payload.twitter : undefined;
                    const telegram = typeof payload.telegram === 'string' ? payload.telegram : undefined;
                    return {
                        ...payload,
                        creatorAddress,
                        creatorUrl: twitter || telegram || undefined,
                        creatorLabel: typeof payload.username === 'string' ? payload.username : undefined
                    };
                }
            } catch {
                // try next endpoint
            }

            // 2) POST /coins/mints
            try {
                const batchData = await fetchJson({
                    url: `${base}/coins/mints`,
                    method: 'POST',
                    timeout: 3000,
                    suppressError: true,
                    headers: {
                        'Content-Type': 'application/json',
                        'Origin': 'https://pump.fun',
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    },
                    body: JSON.stringify([mintAddress])
                });

                if (Array.isArray(batchData) && batchData.length > 0 && (batchData[0] as any)?.mint === mintAddress) {
                    const row: any = batchData[0];
                    const creatorAddress = pickSolanaCreatorAddress(row);
                    const twitter = typeof row.twitter === 'string' ? row.twitter : undefined;
                    const telegram = typeof row.telegram === 'string' ? row.telegram : undefined;
                    return {
                        ...row,
                        creatorAddress,
                        creatorUrl: twitter || telegram || undefined,
                        creatorLabel: typeof row.username === 'string' ? row.username : undefined
                    };
                }
            } catch {
                // try next endpoint
            }
        }

        // 3. Fallback: PumpPortal.fun (Often more stable)
        try {
            const portalUrl = `https://pumpportal.fun/api/data/token-info?ca=${mintAddress}`;
            const portalData = await fetchJson({
                url: portalUrl,
                timeout: 3000,
                suppressError: true
            });

            // Strict match to avoid false positives from third-party mirror APIs.
            const portalMint = String(portalData?.mint || portalData?.address || '').trim();
            if (portalMint && portalMint === normalizedMint) {
                const creatorAddress = pickSolanaCreatorAddress(portalData);
                const twitter = typeof portalData.twitter === 'string' ? portalData.twitter : undefined;
                const telegram = typeof portalData.telegram === 'string' ? portalData.telegram : undefined;
                return {
                    ...portalData,
                    creatorAddress,
                    creatorUrl: twitter || telegram || undefined,
                    creatorLabel: typeof portalData.username === 'string' ? portalData.username : undefined
                };
            }
        } catch (e) {
            logger.debug(LogCode.SYS_INFO, 'LaunchpadDetector: PumpPortal fallback failed');
        }

        // Fallback: Official Raydium V3 API - Often has Pump.fun tokens indexed too
        try {
            const raydiumUrl = `https://api-v3.raydium.io/mint/ids?mints=${mintAddress}`;
            const raydiumData = await fetchJson({
                url: raydiumUrl,
                timeout: 3000,
                suppressError: true
            });

            if (raydiumData.success && raydiumData.data?.[0]) {
                const token = raydiumData.data[0];
                // STRICT FILTER: Ensure the token from Raydium is actually a Pump.fun token
                // Pump.fun Program ID: 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P
                if (token.programId === '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P') {
                    const creatorAddress = pickSolanaCreatorAddress(token);
                    return {
                        ...token,
                        mint: mintAddress,
                        name: token.name,
                        symbol: token.symbol,
                        image_uri: token.logoURI,
                        decimals: token.decimals,
                        creatorAddress
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

        // 1. Try Raydium V3 Official mint endpoint
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
                    const creatorAddress = pickSolanaCreatorAddress(t);
                    return {
                        ...t,
                        mint: mintAddress, // Use input mint as canonical
                        name: t.name,
                        symbol: t.symbol,
                        image_uri: t.logoURI,
                        decimals: t.decimals,
                        isBonkFun: true,
                        creatorAddress
                    };
                }

                // 2) Migration monitor signal from Raydium pool API:
                // docs: launchpad migration can be monitored via pool status/migration lifecycle.
                // In v3 REST this is exposed as launchMigratePool on pools linked by mint.
                try {
                    const poolsByMintUrl = `https://api-v3.raydium.io/pools/info/mint?mint1=${mintAddress}&poolType=all&poolSortField=default&sortType=desc&pageSize=20&page=1`;
                    const poolData = await fetchJson({
                        url: poolsByMintUrl,
                        timeout: 3000,
                        suppressError: true,
                        headers
                    });
                    const rows = Array.isArray(poolData?.data?.data) ? poolData.data.data : [];
                    const migratedLaunchLabPool = rows.find((row: any) => {
                        if (!row || row.launchMigratePool !== true) return false;
                        const mintA = row?.mintA?.address;
                        const mintB = row?.mintB?.address;
                        return mintA === mintAddress || mintB === mintAddress;
                    });
                    if (migratedLaunchLabPool) {
                        const creatorAddress = pickSolanaCreatorAddress(t) || pickSolanaCreatorAddress(migratedLaunchLabPool);
                        return {
                            ...t,
                            mint: mintAddress,
                            name: t.name,
                            symbol: t.symbol,
                            image_uri: t.logoURI,
                            decimals: t.decimals,
                            isBonkFun: true,
                            source: 'raydium_pool_migration',
                            poolId: migratedLaunchLabPool.id,
                            creatorAddress
                        };
                    }
                } catch {
                    // Continue to on-chain auth fallback
                }

                // 3) Fallback: check LaunchLab auth PDA on metadata
                logger.debug(LogCode.SYS_INFO, 'LaunchpadDetector: Token missing API indicators, checking on-chain auth', { mintAddress });
                const isLaunchpad = await checkLaunchpadAuth(mintAddress);

                if (isLaunchpad) {
                    const creatorAddress = pickSolanaCreatorAddress(t);
                    return {
                        ...t,
                        mint: mintAddress,
                        name: t.name,
                        symbol: t.symbol,
                        image_uri: t.logoURI,
                        decimals: t.decimals,
                        isBonkFun: true,
                        creatorAddress
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
    const needsCreator = !!options.requireCreator;
    const forceRefresh = !!options.forceRefresh;
    const useNegativeCache = Number(chainId || 0) !== 8453;

    const cached = DETECTION_CACHE.get(cacheKey);
    if (!forceRefresh && cached && cached.expiry > Date.now()) {
        if (!needsCreator || hasCreatorInResult(cached.result)) {
            return cached.result;
        }
    }

    const persistent = !forceRefresh ? await readPersistentLaunchpadCache(address, chainId) : null;
    if (persistent) {
        if (!needsCreator || hasCreatorInResult(persistent)) {
            DETECTION_CACHE.set(cacheKey, { result: persistent, expiry: Date.now() + CACHE_TTL });
            return persistent;
        }
    }
    if (!forceRefresh && await readRetryLaunchpadCache(address, chainId)) {
        DETECTION_CACHE.set(cacheKey, { result: null, expiry: Date.now() + Math.min(CACHE_TTL, 60_000) });
        return null;
    }
    if (!forceRefresh && useNegativeCache && await readNegativeLaunchpadCache(address, chainId)) {
        DETECTION_CACHE.set(cacheKey, { result: null, expiry: Date.now() + CACHE_TTL });
        return null;
    }

    // Cheap mode must stay lightweight to avoid API/log storms.
    const globalTimeoutMs = mode === 'cheap' ? 1500 : 6000;
    // Global timeout for all detection
    let timeoutId: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => {
            logger.info(LogCode.API_TIMEOUT, 'LaunchpadDetector: Global timeout reached', { address });
            resolve(null);
        }, globalTimeoutMs);
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
        } else if (useNegativeCache) {
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
  const cheapMode = (options.mode || 'full') === 'cheap' && !options.requireCreator;

    if (!isSolana && !isEVM) {
        return null;
    }

  if (isSolana) {
        // Fast suffix detection first (cheap and deterministic for launchpad mints)
        if (lowerAddress.endsWith('pump') && !options.requireCreator) {
            const result: LaunchpadResult = {
                provider: 'pumpfun',
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
            if (!cheapMode && (options.requireCreator || (options.mode || 'full') === 'full')) {
                try {
                    const fourmemeResult = await getFourMemeToken(address);
                    if (fourmemeResult) {
                        const result: LaunchpadResult = {
                            provider: 'fourmeme',
                            data: {
                                ...fourmemeResult,
                                vanitySuffix: lowerAddress.endsWith('ffff') ? 'ffff' : '4444'
                            },
                            chainId: 56
                        };
                        DETECTION_CACHE.set(cacheKey, { result, expiry: Date.now() + CACHE_TTL });
                        return result;
                    }
                } catch {
                    // continue to suffix fallback
                }
            }
            if (!options.requireCreator) {
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
        }
        if (bscPlatforms && FLAP_SUFFIXES.some((s) => lowerAddress.endsWith(s))) {
            if (!cheapMode) {
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
            if (!options.requireCreator) {
                const result: LaunchpadResult = {
                    provider: 'flap',
                    data: { address, source: 'suffix' },
                    chainId: 56
                };
                DETECTION_CACHE.set(cacheKey, { result, expiry: Date.now() + CACHE_TTL });
                return result;
            }
        }

        // Clanker must take precedence for b07 addresses to avoid Zora over-labeling.
        if (basePlatforms && lowerAddress.endsWith(CLANKER_SUFFIX)) {
            if (!cheapMode) {
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
            }

            // Fallback: keep Clanker provider but borrow creator metadata from Zora coin data when available.
            if (!cheapMode && basePlatforms && !isProviderBackoffActive('zora')) {
                try {
                    const zoraResult = await zoraService.getCoinByAddress(address);
                    if (zoraResult) {
                        const twitter = zoraResult.creatorProfile?.socialAccounts?.twitter?.username;
                        const farcaster = zoraResult.creatorProfile?.socialAccounts?.farcaster?.username;
                        const creatorUrl = twitter
                            ? `https://x.com/${String(twitter).replace(/^@/, '')}`
                            : (farcaster ? `https://warpcast.com/${String(farcaster).replace(/^@/, '')}` : undefined);
                        const creatorLabel = zoraResult.creatorProfile?.handle
                            ? `@${String(zoraResult.creatorProfile.handle).replace(/^@/, '')}`
                            : undefined;
                        const result: LaunchpadResult = {
                            provider: 'clanker',
                            data: {
                                address,
                                source: 'clanker_suffix_zora_creator_fallback',
                                creatorAddress: zoraResult.creatorAddress || undefined,
                                creatorUrl,
                                creatorLabel,
                            },
                            chainId: 8453
                        };
                        DETECTION_CACHE.set(cacheKey, { result, expiry: Date.now() + CACHE_TTL });
                        return result;
                    }
                } catch {
                    // ignore zora fallback errors
                }
            }

            if (!options.requireCreator) {
                const result: LaunchpadResult = {
                    provider: 'clanker',
                    data: { address, source: 'suffix_fallback' },
                    chainId: 8453
                };
                DETECTION_CACHE.set(cacheKey, { result, expiry: Date.now() + CACHE_TTL });
                return result;
            }
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

        // Soft mode: stop here for EVM. Keep it deterministic/cache-only.
        if (cheapMode) {
            return null;
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
        if (basePlatforms && !options.requireCreator) {
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

        // Priority 1.6~1.9: Base API checks in parallel; choose by strict priority.
        // This avoids missing a valid provider due to global timeout when run sequentially.
        if (basePlatforms) {
            const allowDopplerHookFallback = String(process.env.DOPPLER_HOOK_FALLBACK_ENABLED || '').toLowerCase() === 'true';
            const [virtualsResult, paragraphResult, clankerResult, dopplerResult, dopplerByHook] = await Promise.all([
                getVirtualsToken(address, options.mode || 'full').catch(() => null),
                getParagraphToken(address).catch(() => null),
                (!lowerAddress.endsWith(CLANKER_SUFFIX) && !isProviderBackoffActive('clanker'))
                    ? getClankerToken(address).catch(() => null)
                    : Promise.resolve(null),
                getDopplerToken(address, 8453).catch(() => null),
                allowDopplerHookFallback
                    ? getDopplerTokenByV4Hook(address, 8453).catch(() => null)
                    : Promise.resolve(null),
            ]);

            if (virtualsResult) {
                const result: LaunchpadResult = { provider: 'virtuals', data: virtualsResult, chainId: 8453 };
                DETECTION_CACHE.set(cacheKey, { result, expiry: Date.now() + CACHE_TTL });
                return result;
            }
            if (paragraphResult) {
                const result: LaunchpadResult = { provider: 'paragraph', data: paragraphResult, chainId: 8453 };
                DETECTION_CACHE.set(cacheKey, { result, expiry: Date.now() + CACHE_TTL });
                return result;
            }
            if (clankerResult) {
                const result: LaunchpadResult = { provider: 'clanker', data: clankerResult, chainId: 8453 };
                DETECTION_CACHE.set(cacheKey, { result, expiry: Date.now() + CACHE_TTL });
                return result;
            }
            if (dopplerResult) {
                const result: LaunchpadResult = { provider: 'doppler', data: dopplerResult, chainId: 8453 };
                DETECTION_CACHE.set(cacheKey, { result, expiry: Date.now() + CACHE_TTL });
                return result;
            }
            if (allowDopplerHookFallback && dopplerByHook) {
                const result: LaunchpadResult = { provider: 'doppler', data: dopplerByHook, chainId: 8453 };
                DETECTION_CACHE.set(cacheKey, { result, expiry: Date.now() + CACHE_TTL });
                return result;
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
