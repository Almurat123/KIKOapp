import { callRpc } from './rpcManager.js';
import { getChainConfig } from '../config/chainConfig.js';
import cacheClient from '../cache/cacheClient.js';
import { PublicKey } from '@solana/web3.js';
import { decodeFunctionResult, encodeFunctionData, parseAbi } from 'viem';

const METADATA_L1_TTL_MS = Math.max(30_000, Number(process.env.COPYTRADE_METADATA_L1_TTL_MS || 10 * 60_000));
const METADATA_L2_TTL_SECONDS = Math.max(30, Number(process.env.COPYTRADE_METADATA_L2_TTL_SECONDS || 30 * 60));
const METADATA_NEGATIVE_TTL_SECONDS = Math.max(10, Number(process.env.COPYTRADE_METADATA_NEGATIVE_TTL_SECONDS || 60));
const DEFAULT_DECIMALS = 18;
const METAPLEX_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

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

export async function getTokenSupply(
    chainId: number,
    address: string,
    options: { rpcStrategy?: 'fast' | 'cheap'; defaultDecimals?: number } = {}
): Promise<number> {
    const normalized = parseAddress(address, chainId);
    const rpcStrategy = options.rpcStrategy || 'cheap';

    if (isNativePlaceholder(normalized)) {
        return 0;
    }

    if (chainId === 900) {
        if (!isValidSolanaMintAddress(normalized)) {
            return 0;
        }
        try {
            const supply = await callRpc<any>('solana', 'getTokenSupply', [normalized], {
                strategy: rpcStrategy,
                rpcClass: 'best_effort_read',
                path: 'token_supply'
            });
            const uiAmount = Number(supply?.value?.uiAmount ?? NaN);
            if (Number.isFinite(uiAmount) && uiAmount >= 0) return uiAmount;

            const amountRaw = String(supply?.value?.amount || '0');
            const decimals = Number(supply?.value?.decimals ?? options.defaultDecimals ?? 6);
            if (!amountRaw || !Number.isFinite(decimals)) return 0;
            return Number(BigInt(amountRaw)) / Math.pow(10, decimals);
        } catch {
            return 0;
        }
    }

    try {
        const decimals = await getTokenDecimals(chainId, normalized, {
            rpcStrategy,
            defaultDecimals: options.defaultDecimals ?? DEFAULT_DECIMALS,
        });
        const data = encodeFunctionData({
            abi: ERC20_ABI,
            functionName: 'decimals'
        });
        void data;
        const totalSupplyData = encodeFunctionData({
            abi: parseAbi(['function totalSupply() view returns (uint256)']),
            functionName: 'totalSupply',
        });
        const resultHex = await callRpc<string>(
            chainId,
            'eth_call',
            [{ to: normalized, data: totalSupplyData }, 'latest'],
            {
                strategy: rpcStrategy,
                rpcClass: 'best_effort_read',
                path: 'token_supply'
            }
        );
        const decoded = decodeFunctionResult({
            abi: parseAbi(['function totalSupply() view returns (uint256)']),
            functionName: 'totalSupply',
            data: resultHex as `0x${string}`
        }) as bigint;
        return Number(decoded) / Math.pow(10, decimals);
    } catch {
        return 0;
    }
}

type LocalCacheEntry<T> = { value: T; expiresAt: number };

const metadataL1Cache = new Map<string, LocalCacheEntry<OnChainMetadata>>();
const decimalsL1Cache = new Map<string, LocalCacheEntry<number>>();
const negativeCache = new Map<string, LocalCacheEntry<true>>();

function normalizeCacheAddress(chainId: number, address: string): string {
    const raw = String(address || '').trim();
    return chainId === 900 ? raw : raw.toLowerCase();
}

function metadataCacheKey(chainId: number, address: string): string {
    return `token_meta:v1:${chainId}:${normalizeCacheAddress(chainId, address)}`;
}

function decimalsCacheKey(chainId: number, address: string): string {
    return `token_decimals:v1:${chainId}:${normalizeCacheAddress(chainId, address)}`;
}

function negativeCacheKey(chainId: number, address: string): string {
    return `token_meta_neg:v1:${chainId}:${normalizeCacheAddress(chainId, address)}`;
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

function parseAddress(address: string, chainId?: number): string {
    const raw = String(address || '').trim();
    return chainId === 900 ? raw : raw.toLowerCase();
}

function isValidSolanaMintAddress(address: string): boolean {
    try {
        // PublicKey constructor validates base58 + length.
        // If this throws, downstream getTokenSupply/getAsset calls are guaranteed to fail.
        new PublicKey(address);
        return true;
    } catch {
        return false;
    }
}

function deriveSolanaMetadataPda(mintAddress: string): string {
    const mint = new PublicKey(mintAddress);
    const [pda] = PublicKey.findProgramAddressSync(
        [
            Buffer.from('metadata', 'utf8'),
            METAPLEX_METADATA_PROGRAM_ID.toBuffer(),
            mint.toBuffer(),
        ],
        METAPLEX_METADATA_PROGRAM_ID
    );
    return pda.toBase58();
}

function readBorshString(buffer: Buffer, offset: number): { value: string; nextOffset: number } {
    if (offset + 4 > buffer.length) return { value: '', nextOffset: buffer.length };
    const length = buffer.readUInt32LE(offset);
    const start = offset + 4;
    const end = Math.min(start + length, buffer.length);
    const raw = buffer.subarray(start, end).toString('utf8');
    const cleaned = raw.replace(/\0/g, '').trim();
    return { value: cleaned, nextOffset: end };
}

async function getSolanaMetadataViaRpc(mintAddress: string): Promise<{ name: string; symbol: string } | null> {
    if (!isValidSolanaMintAddress(mintAddress)) {
        return null;
    }
    try {
        const metadataPda = deriveSolanaMetadataPda(mintAddress);
        const result = await callRpc<any>('solana', 'getAccountInfo', [
            metadataPda,
            { encoding: 'base64' }
        ], { rpcClass: 'best_effort_read', path: 'token_metadata' });

        const encoded = result?.value?.data?.[0];
        if (encoded && typeof encoded === 'string') {
            const data = Buffer.from(encoded, 'base64');
            if (data.length >= 1 + 32 + 32 + 4) {
                let offset = 1 + 32 + 32;
                const nameRead = readBorshString(data, offset);
                offset = nameRead.nextOffset;
                const symbolRead = readBorshString(data, offset);
                if (nameRead.value || symbolRead.value) {
                    return {
                        name: nameRead.value || 'Unknown Token',
                        symbol: symbolRead.value || 'UNK',
                    };
                }
            }
        }
    } catch {
        // fall through to DAS-style RPC metadata
    }

    try {
        const asset = await callRpc<any>('solana', 'getAsset', [mintAddress], {
            rpcClass: 'best_effort_read',
            path: 'token_metadata_asset',
            importance: 'critical',
            exhaustiveFailover: true,
        });

        const contentMeta = asset?.content?.metadata || {};
        const extMeta = asset?.mint_extensions?.metadata || {};
        const name = String(contentMeta?.name || extMeta?.name || '').trim();
        const symbol = String(contentMeta?.symbol || extMeta?.symbol || '').trim();
        if (!name || !symbol) return null;

        return { name, symbol };
    } catch {
        return null;
    }
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
    if (l1) {
        if (chainId === 900 && /^unk(nown)?$/i.test(String(l1.symbol || ''))) {
            metadataL1Cache.delete(key);
        } else {
            return l1;
        }
    }

    const l2Raw = await cacheClient.get(key).catch(() => null);
    if (!l2Raw) return null;
    try {
        const parsed = JSON.parse(l2Raw) as OnChainMetadata;
        if (typeof parsed?.decimals !== 'number') return null;
        if (chainId === 900 && /^unk(nown)?$/i.test(String(parsed?.symbol || ''))) {
            return null;
        }
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
    const normalized = parseAddress(address, chainId);
    const fallbackDecimals = Number(options.defaultDecimals ?? DEFAULT_DECIMALS);

    if (isNativePlaceholder(normalized)) {
        return defaultMetadata(chainId).decimals;
    }

    if (chainId === 900) {
        if (!isValidSolanaMintAddress(normalized)) {
            return fallbackDecimals;
        }
        const cachedSol = await getDecimalsFromCache(chainId, normalized);
        if (typeof cachedSol === 'number') return cachedSol;
        try {
            const supply = await callRpc<any>('solana', 'getTokenSupply', [normalized], {
                rpcClass: 'best_effort_read',
                path: 'token_decimals'
            });
            const decimals = Number(supply?.value?.decimals);
            if (Number.isFinite(decimals) && decimals >= 0 && decimals <= 255) {
                await setDecimalsCache(chainId, normalized, decimals);
                return decimals;
            }
        } catch {
            // ignore
        }
        return fallbackDecimals;
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
    const normalized = parseAddress(address, chainId);
    const rpcStrategy = options.rpcStrategy || 'cheap';

    if (isNativePlaceholder(normalized)) {
        return defaultMetadata(chainId);
    }

    const cached = await getMetadataFromCache(chainId, normalized);
    if (cached) return cached;

    const decimals = await getTokenDecimals(chainId, normalized, { rpcStrategy, defaultDecimals: DEFAULT_DECIMALS });
    if (chainId !== 900 && await hasNegativeCache(chainId, normalized)) {
        return { name: 'Unknown Token', symbol: 'UNK', decimals };
    }

    // Solana RPC-only path: Metaplex metadata PDA + getTokenSupply decimals.
    if (chainId === 900) {
        if (!isValidSolanaMintAddress(normalized)) {
            return { name: 'Unknown Token', symbol: 'UNK', decimals };
        }
        try {
            const solMeta = await getSolanaMetadataViaRpc(normalized);
            const resolvedName = String(solMeta?.name || '').trim();
            const resolvedSymbol = String(solMeta?.symbol || '').trim();
            const validMetadata = !!resolvedName && !!resolvedSymbol && !/^unk(nown)?$/i.test(resolvedSymbol);

            if (!validMetadata) {
                return { name: 'Unknown Token', symbol: 'UNK', decimals };
            }

            const meta: OnChainMetadata = {
                name: resolvedName,
                symbol: resolvedSymbol,
                decimals
            };
            await setMetadataCache(chainId, normalized, meta);
            await setDecimalsCache(chainId, normalized, meta.decimals);
            return meta;
        } catch {
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
