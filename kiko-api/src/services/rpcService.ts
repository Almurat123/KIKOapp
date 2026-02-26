import { callRpc } from './rpcManager.js';
import { getChainConfig } from '../config/chainConfig.js';
import cacheClient from '../cache/cacheClient.js';
import { decodeFunctionResult, encodeFunctionData, parseAbi } from 'viem';

const METADATA_L1_TTL_MS = Math.max(30_000, Number(process.env.COPYTRADE_METADATA_L1_TTL_MS || 10 * 60_000));
const METADATA_L2_TTL_SECONDS = Math.max(30, Number(process.env.COPYTRADE_METADATA_L2_TTL_SECONDS || 30 * 60));
const METADATA_NEGATIVE_TTL_SECONDS = Math.max(10, Number(process.env.COPYTRADE_METADATA_NEGATIVE_TTL_SECONDS || 60));
const DEFAULT_DECIMALS = 18;

// Minimal ABI for ERC20 metadata
const ERC20_ABI = parseAbi([
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)'
]);

export interface OnChainMetadata {
    name: string;
    symbol: string;
    decimals: number;
}

type LocalCacheEntry<T> = { value: T; expiresAt: number };

const metadataL1Cache = new Map<string, LocalCacheEntry<OnChainMetadata>>();
const decimalsL1Cache = new Map<string, LocalCacheEntry<number>>();
const negativeCache = new Map<string, LocalCacheEntry<true>>();

function metadataCacheKey(chainId: number, address: string): string {
    return `token_meta:v1:${chainId}:${address.toLowerCase()}`;
}

function decimalsCacheKey(chainId: number, address: string): string {
    return `token_decimals:v1:${chainId}:${address.toLowerCase()}`;
}

function negativeCacheKey(chainId: number, address: string): string {
    return `token_meta_neg:v1:${chainId}:${address.toLowerCase()}`;
}

function getFromL1<T>(cache: Map<string, LocalCacheEntry<T>>, key: string): T | null {
    const hit = cache.get(key);
    if (!hit) return null;
    if (Date.now() > hit.expiresAt) {
        cache.delete(key);
        return null;
    }
    return hit.value;
}

function setL1<T>(cache: Map<string, LocalCacheEntry<T>>, key: string, value: T, ttlMs: number): void {
    cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function parseAddress(address: string): string {
    return String(address || '').toLowerCase();
}

function isNativePlaceholder(normalized: string): boolean {
    return normalized === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
        || normalized === '0x0000000000000000000000000000000000000000';
}

function defaultMetadata(chainId: number): OnChainMetadata {
    const chain = getChainConfig(chainId);
    return {
        name: chain.nativeCurrency.name,
        symbol: chain.nativeCurrency.symbol,
        decimals: chain.nativeCurrency.decimals
    };
}

async function setNegativeCache(chainId: number, address: string): Promise<void> {
    const key = negativeCacheKey(chainId, address);
    setL1(negativeCache, key, true, METADATA_NEGATIVE_TTL_SECONDS * 1000);
    await cacheClient.set(key, '1', METADATA_NEGATIVE_TTL_SECONDS).catch(() => { });
}

async function hasNegativeCache(chainId: number, address: string): Promise<boolean> {
    const key = negativeCacheKey(chainId, address);
    if (getFromL1(negativeCache, key)) return true;
    const l2 = await cacheClient.get(key).catch(() => null);
    if (!l2) return false;
    setL1(negativeCache, key, true, METADATA_NEGATIVE_TTL_SECONDS * 1000);
    return true;
}

async function getDecimalsFromCache(chainId: number, address: string): Promise<number | null> {
    const l1Key = decimalsCacheKey(chainId, address);
    const l1 = getFromL1(decimalsL1Cache, l1Key);
    if (typeof l1 === 'number') return l1;

    const l2Raw = await cacheClient.get(l1Key).catch(() => null);
    if (!l2Raw) return null;
    const parsed = Number(l2Raw);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 255) return null;
    setL1(decimalsL1Cache, l1Key, parsed, METADATA_L1_TTL_MS);
    return parsed;
}

async function setDecimalsCache(chainId: number, address: string, decimals: number): Promise<void> {
    const key = decimalsCacheKey(chainId, address);
    setL1(decimalsL1Cache, key, decimals, METADATA_L1_TTL_MS);
    await cacheClient.set(key, String(decimals), METADATA_L2_TTL_SECONDS).catch(() => { });
}

async function getMetadataFromCache(chainId: number, address: string): Promise<OnChainMetadata | null> {
    const key = metadataCacheKey(chainId, address);
    const l1 = getFromL1(metadataL1Cache, key);
    if (l1) return l1;

    const l2Raw = await cacheClient.get(key).catch(() => null);
    if (!l2Raw) return null;
    try {
        const parsed = JSON.parse(l2Raw) as OnChainMetadata;
        if (typeof parsed?.decimals !== 'number') return null;
        setL1(metadataL1Cache, key, parsed, METADATA_L1_TTL_MS);
        setL1(decimalsL1Cache, decimalsCacheKey(chainId, address), parsed.decimals, METADATA_L1_TTL_MS);
        return parsed;
    } catch {
        return null;
    }
}

async function setMetadataCache(chainId: number, address: string, value: OnChainMetadata): Promise<void> {
    const key = metadataCacheKey(chainId, address);
    setL1(metadataL1Cache, key, value, METADATA_L1_TTL_MS);
    await cacheClient.set(key, JSON.stringify(value), METADATA_L2_TTL_SECONDS).catch(() => { });
}

export async function getTokenDecimals(
    chainId: number,
    address: string,
    options: { rpcStrategy?: 'fast' | 'cheap'; defaultDecimals?: number } = {}
): Promise<number> {
    const normalized = parseAddress(address);
    const fallbackDecimals = Number(options.defaultDecimals ?? DEFAULT_DECIMALS);

    if (isNativePlaceholder(normalized)) {
        return defaultMetadata(chainId).decimals;
    }

    const cached = await getDecimalsFromCache(chainId, normalized);
    if (typeof cached === 'number') return cached;

    if (await hasNegativeCache(chainId, normalized)) {
        return fallbackDecimals;
    }

    try {
        const decimalsRaw = await callEthCall(chainId, normalized, 'decimals', options.rpcStrategy || 'cheap');
        const decimals = Number(decimalsRaw);
        if (!Number.isFinite(decimals) || decimals < 0 || decimals > 255) {
            throw new Error('invalid_decimals_result');
        }
        await setDecimalsCache(chainId, normalized, decimals);
        return decimals;
    } catch {
        await setNegativeCache(chainId, normalized);
        return fallbackDecimals;
    }
}

/**
 * Fetch token metadata directly from chain via RPC (cache-first + best effort)
 */
export async function getTokenMetadata(
    chainId: number,
    address: string,
    options: { rpcStrategy?: 'fast' | 'cheap' } = {}
): Promise<OnChainMetadata> {
    const normalized = parseAddress(address);
    const rpcStrategy = options.rpcStrategy || 'cheap';

    if (isNativePlaceholder(normalized)) {
        return defaultMetadata(chainId);
    }

    const cached = await getMetadataFromCache(chainId, normalized);
    if (cached) return cached;

    const decimals = await getTokenDecimals(chainId, normalized, { rpcStrategy, defaultDecimals: DEFAULT_DECIMALS });
    if (await hasNegativeCache(chainId, normalized)) {
        return { name: 'Unknown Token', symbol: 'UNK', decimals };
    }

    // Solana path preserves old behavior with graceful fallback metadata.
    if (chainId === 900) {
        try {
            const result = await callRpc<any>(chainId, 'getAccountInfo', [
                normalized,
                { encoding: 'jsonParsed' }
            ], { rpcClass: 'best_effort_read', path: 'token_metadata' });

            const info = result?.value?.data?.parsed?.info;
            const meta: OnChainMetadata = {
                name: 'Solana Token',
                symbol: 'SOL-TOKEN',
                decimals: Number(info?.decimals ?? decimals)
            };
            await setMetadataCache(chainId, normalized, meta);
            await setDecimalsCache(chainId, normalized, meta.decimals);
            return meta;
        } catch {
            await setNegativeCache(chainId, normalized);
            return { name: 'Unknown Token', symbol: 'UNK', decimals };
        }
    }

    const [nameResult, symbolResult] = await Promise.allSettled([
        callEthCall(chainId, normalized, 'name', rpcStrategy),
        callEthCall(chainId, normalized, 'symbol', rpcStrategy)
    ]);

    const meta: OnChainMetadata = {
        name: nameResult.status === 'fulfilled' ? String(nameResult.value) : 'Unknown Token',
        symbol: symbolResult.status === 'fulfilled' ? String(symbolResult.value) : 'UNK',
        decimals
    };

    await setMetadataCache(chainId, normalized, meta);
    return meta;
}

async function callEthCall(
    chainId: number,
    to: string,
    functionName: 'name' | 'symbol' | 'decimals',
    rpcStrategy: 'fast' | 'cheap'
): Promise<string | number> {
    const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName
    });

    const resultHex = await callRpc<string>(
        chainId,
        'eth_call',
        [{ to, data }, 'latest'],
        {
            strategy: rpcStrategy,
            rpcClass: 'best_effort_read',
            path: functionName === 'decimals' ? 'token_decimals' : 'token_metadata'
        }
    );

    return decodeFunctionResult({
        abi: ERC20_ABI,
        functionName,
        data: resultHex as `0x${string}`
    });
}
