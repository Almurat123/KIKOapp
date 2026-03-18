/**
 * Transaction Decoder Service
 * Parses DEX swap transactions to extract token information
 */

import { ethers } from 'ethers';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { getChainConfig } from '../config/chainConfig.js';
import { callRpc as rpcCall } from './rpcManager.js';
import { NATIVE_TOKEN_ADDRESS } from '../config/tokenRegistry.js';
import { get as getDbCache, set as setDbCache } from '../cache/dbCache.js';
import { matchV4PoolKeyById } from './dex/uniswapV4.js';
import { decodeSwapFromLogs } from './txDecoder/evmTransferFallback.js';
import { isSwapTransaction, shouldAttemptTransferBasedDecode } from './txDecoder/evmSwapEvidence.js';
import { TRADE_QUOTE_PROFILE } from './rpc/profile.js';
export { decodeSwapFromLogs } from './txDecoder/evmTransferFallback.js';
export { isSwapTransaction } from './txDecoder/evmSwapEvidence.js';



// ERC20 Transfer event signature
const TRANSFER_EVENT = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
// UniswapV2/PancakeV2 Swap(address,uint256,uint256,uint256,uint256,address)
const V2_SWAP_EVENT = '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822';
// Aerodrome/Velodrome-style pair swap topic seen on Base launchpad routes.
const V2_SWAP_EVENT_ALT = '0xb3e2773606abfd36b5bd91394b3a54d1398336c65005baf7bf7a05efeffaf75b';
const V3_SWAP_EVENT = '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67';
// Pancake/Algebra-style extended V3 swap event:
// Swap(address,address,int256,int256,uint160,uint128,int24,uint128,uint128)
const V3_SWAP_EVENT_EXT = '0x19b47279256b2a23a1665c810c8d55a1758940ee09377d4f8d26497a3577dc83';
const V4_SWAP_EVENT = ethers.id('Swap(bytes32,address,int128,int128,uint160,uint128,int24,uint24)');
const V4_INIT_EVENT = ethers.id('Initialize(bytes32,address,address,uint24,int24,address,uint160,int24)');
const v4SwapEventInterface = new ethers.Interface([
    'event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)'
]);
const v4InitEventInterface = new ethers.Interface([
    'event Initialize(bytes32 indexed id, address indexed currency0, address indexed currency1, uint24 fee, int24 tickSpacing, address hooks, uint160 sqrtPriceX96, int24 tick)'
]);
const USER_OP_EVENT = '0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0344d39e5a8e6ec1419f';
const INFINITY_CL_POOL_MANAGER = '0xa0ffb9c1ce1fe56963b0321b32e7a0302114058b';
const INFINITY_BIN_POOL_MANAGER = '0xc697d2898e0d09264376196696c51d7abbbaa4a9';
const INFINITY_CL_SWAP_EVENT = ethers.id('Swap(bytes32,address,int128,int128,uint160,uint128,int24,uint24,uint16)');
const INFINITY_BIN_SWAP_EVENT = ethers.id('Swap(bytes32,address,int128,int128,uint24,uint24,uint16)');

const ENTRYPOINT_ADDRESSES = new Set([
    '0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789', // EntryPoint v0.6
    '0x0000000071727de22e5e9d8baf0edac6f37da032', // EntryPoint v0.7
]);

const poolTokenCache = new Map<string, { token0: string; token1: string }>();
const v4PoolTokenCache = new Map<string, { token0: string; token1: string } | null>();
const v4PoolTokenInflight = new Map<string, Promise<{ token0: string; token1: string } | null>>();
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const infinityPoolKeyCache = new Set<string>();
const EXTRA_NATIVE_ALIASES_BY_CHAIN: Record<number, string[]> = {
    8453: ['0x000000000d564d5be76f7f0d28fe52605afc7cf8']
};

const KNOWN_V3_FACTORIES: Record<number, Record<string, 'uniswap' | 'pancake' | 'aerodrome'>> = {
    8453: {
        '0x33128a8fc17869897dce68ed026d694621f6fdfd': 'uniswap',
        '0xade65c38cd4849adba595a4323a8c7ddfe89716a': 'aerodrome',
    },
    1: {
        '0x1f98431c8ad98523631ae4a59f267346ea31f984': 'uniswap',
    },
    56: {
        '0x0bfbcf9fa4f9c56b0f40a671ad40e0805a091865': 'pancake',
    }
};
const poolDexCache = new Map<string, 'uniswap' | 'pancake' | 'aerodrome'>();

async function detectPoolDex(pool: string, chainId: number): Promise<'uniswap' | 'pancake' | 'aerodrome'> {
    const key = `${chainId}:${pool.toLowerCase()}`;
    const cached = poolDexCache.get(key);
    if (cached) return cached;

    const fallback: 'uniswap' | 'pancake' = chainId === 56 ? 'pancake' : 'uniswap';
    try {
        const factoryHex = await rpcCall<string>(
            chainId, 'eth_call',
            [{ to: pool, data: '0xc45a0155' }, 'latest'],
            {
                purpose: TRADE_QUOTE_PROFILE.purpose,
                strategy: TRADE_QUOTE_PROFILE.strategy,
                importance: TRADE_QUOTE_PROFILE.importance
            }
        );
        if (factoryHex && factoryHex.length >= 42) {
            const factory = '0x' + factoryHex.slice(-40).toLowerCase();
            const mapping = KNOWN_V3_FACTORIES[chainId];
            if (mapping?.[factory]) {
                poolDexCache.set(key, mapping[factory]);
                return mapping[factory];
            }
        }
    } catch {
        // factory() call failed — use fallback
    }
    poolDexCache.set(key, fallback);
    return fallback;
}

async function getPoolTokens(chainId: number, pool: string): Promise<{ token0: string; token1: string } | null> {
    const key = `${chainId}:${pool.toLowerCase()}`;
    const cached = poolTokenCache.get(key);
    if (cached) return cached;

    try {
        const iface = new ethers.Interface([
            'function token0() view returns (address)',
            'function token1() view returns (address)',
        ]);
        const token0Data = iface.encodeFunctionData('token0', []);
        const token1Data = iface.encodeFunctionData('token1', []);

        const [token0Res, token1Res] = await Promise.all([
            rpcCall<string>(chainId, 'eth_call', [{ to: pool, data: token0Data }, 'latest'], {
                purpose: TRADE_QUOTE_PROFILE.purpose,
                strategy: TRADE_QUOTE_PROFILE.strategy,
                importance: TRADE_QUOTE_PROFILE.importance
            }),
            rpcCall<string>(chainId, 'eth_call', [{ to: pool, data: token1Data }, 'latest'], {
                purpose: TRADE_QUOTE_PROFILE.purpose,
                strategy: TRADE_QUOTE_PROFILE.strategy,
                importance: TRADE_QUOTE_PROFILE.importance
            }),
        ]);

        if (!token0Res || !token1Res) return null;
        const token0 = ethers.getAddress(ethers.AbiCoder.defaultAbiCoder().decode(['address'], token0Res)[0]);
        const token1 = ethers.getAddress(ethers.AbiCoder.defaultAbiCoder().decode(['address'], token1Res)[0]);

        const result = { token0: token0.toLowerCase(), token1: token1.toLowerCase() };
        poolTokenCache.set(key, result);
        return result;
    } catch (err: any) {
        logger.debug(LogCode.DEC_SWAP_DETECTION, 'Failed to resolve pool tokens', { chainId, pool, error: err.message });
        return null;
    }
}

function extractTransfersFromLogs(logs: Array<{ address: string; topics: string[]; data: string }>): Array<{
    token: string;
    from: string;
    to: string;
    amount: bigint;
}> {
    const transfers: Array<{
        token: string;
        from: string;
        to: string;
        amount: bigint;
    }> = [];

    for (const log of logs) {
        if (log.topics[0]?.toLowerCase() === TRANSFER_EVENT.toLowerCase() && log.topics.length >= 3) {
            const fromAddress = '0x' + log.topics[1].slice(26);
            const toAddress = '0x' + log.topics[2].slice(26);
            const amount = BigInt(log.data && log.data !== '0x' ? log.data : '0');

            transfers.push({
                token: log.address.toLowerCase(),
                from: fromAddress.toLowerCase(),
                to: toAddress.toLowerCase(),
                amount
            });
        }
    }

    return transfers;
}

function inferSwapFromPoolTransfers(
    logs: Array<{ address: string; topics: string[]; data: string }>,
    poolAddress: string
): { tokenIn: string; tokenOut: string; amountIn: bigint; amountOut: bigint } | null {
    const pool = poolAddress.toLowerCase();
    const transfers = extractTransfersFromLogs(logs);
    if (!transfers.length) return null;

    const totals = new Map<string, { in: bigint; out: bigint }>();
    for (const t of transfers) {
        if (t.to === pool) {
            const entry = totals.get(t.token) || { in: 0n, out: 0n };
            entry.in += t.amount;
            totals.set(t.token, entry);
        }
        if (t.from === pool) {
            const entry = totals.get(t.token) || { in: 0n, out: 0n };
            entry.out += t.amount;
            totals.set(t.token, entry);
        }
    }

    const entries = [...totals.entries()].filter(([, v]) => v.in > 0n || v.out > 0n);
    if (entries.length < 2) return null;

    const tokenInEntry = entries.sort((a, b) => (b[1].in > a[1].in ? 1 : -1))[0];
    const tokenOutEntry = entries.sort((a, b) => (b[1].out > a[1].out ? 1 : -1))[0];

    if (!tokenInEntry || !tokenOutEntry) return null;
    if (tokenInEntry[0] === tokenOutEntry[0]) return null;
    if (tokenInEntry[1].in <= 0n || tokenOutEntry[1].out <= 0n) return null;

    return {
        tokenIn: tokenInEntry[0],
        tokenOut: tokenOutEntry[0],
        amountIn: tokenInEntry[1].in,
        amountOut: tokenOutEntry[1].out
    };
}

function inferSwapFromAnyPoolLikeAddress(
    logs: Array<{ address: string; topics: string[]; data: string }>
): { tokenIn: string; tokenOut: string; amountIn: bigint; amountOut: bigint; poolAddress: string } | null {
    const transfers = extractTransfersFromLogs(logs);
    if (transfers.length < 2) return null;

    // Find addresses that both receive and send token transfers in the same tx.
    const flow = new Map<string, { in: number; out: number }>();
    for (const t of transfers) {
        const to = t.to.toLowerCase();
        const from = t.from.toLowerCase();
        if (to !== ZERO_ADDRESS) {
            const entry = flow.get(to) || { in: 0, out: 0 };
            entry.in += 1;
            flow.set(to, entry);
        }
        if (from !== ZERO_ADDRESS) {
            const entry = flow.get(from) || { in: 0, out: 0 };
            entry.out += 1;
            flow.set(from, entry);
        }
    }

    // Prefer addresses with strongest bi-directional transfer footprint.
    const candidates = [...flow.entries()]
        .filter(([, v]) => v.in > 0 && v.out > 0)
        .sort((a, b) => (b[1].in + b[1].out) - (a[1].in + a[1].out));

    for (const [candidate] of candidates) {
        const inferred = inferSwapFromPoolTransfers(logs, candidate);
        if (inferred) {
            return { ...inferred, poolAddress: candidate };
        }
    }
    return null;
}

function normalizeCurrencyAddress(address: string): string {
    const normalized = address.toLowerCase();
    return normalized === ZERO_ADDRESS ? NATIVE_TOKEN_ADDRESS : normalized;
}

function normalizePoolIdTopic(topicValue: unknown): string | null {
    const normalized = String(topicValue || '').toLowerCase();
    if (!/^0x[0-9a-f]{64}$/.test(normalized)) return null;
    return normalized;
}

function buildV4PairMatchTokenCandidates(token: string, chainId: number): string[] {
    const normalized = String(token || '').toLowerCase();
    if (!normalized) return [];
    const wrapped = String(getChainConfig(chainId).wrappedNativeAddress || '').toLowerCase();
    const aliases = EXTRA_NATIVE_ALIASES_BY_CHAIN[chainId] || [];
    const candidates = new Set<string>();
    const nativeLikeSet = new Set<string>([
        NATIVE_TOKEN_ADDRESS.toLowerCase(),
        ZERO_ADDRESS,
        wrapped,
        ...aliases
    ]);
    if (nativeLikeSet.has(normalized)) {
        if (wrapped) candidates.add(wrapped);
        candidates.add(ZERO_ADDRESS);
        candidates.add(NATIVE_TOKEN_ADDRESS.toLowerCase());
        for (const alias of aliases) candidates.add(String(alias || '').toLowerCase());
    } else {
        candidates.add(normalized);
    }
    return [...candidates].filter(Boolean);
}

function tryMatchV4PoolKeyFromPair(
    chainId: number,
    poolId: string,
    tokenIn: string,
    tokenOut: string
): ReturnType<typeof matchV4PoolKeyById> {
    if (!poolId || !tokenIn || !tokenOut) return null;
    const inCandidates = buildV4PairMatchTokenCandidates(tokenIn, chainId);
    const outCandidates = buildV4PairMatchTokenCandidates(tokenOut, chainId);
    for (const tokenA of inCandidates) {
        for (const tokenB of outCandidates) {
            if (!tokenA || !tokenB || tokenA === tokenB) continue;
            const matched = matchV4PoolKeyById(chainId, poolId, tokenA, tokenB);
            if (matched) return matched;
        }
    }
    return null;
}

function findV4InitLogInReceipt(
    logs: Array<{ address: string; topics: string[]; data: string }>,
    poolManager: string,
    poolId: string
): { address: string; topics: string[]; data: string } | null {
    return logs.find((log) =>
        log.address?.toLowerCase() === poolManager.toLowerCase()
        && log.topics?.[0]?.toLowerCase() === V4_INIT_EVENT.toLowerCase()
        && log.topics?.[1]?.toLowerCase() === poolId.toLowerCase()
    ) || null;
}

const infinityPoolKeyInterface = new ethers.Interface([
    'function poolIdToPoolKey(bytes32) view returns (tuple(address currency0,address currency1,address hooks,address poolManager,uint24 fee,bytes32 parameters))'
]);

async function cacheInfinityPoolKey(
    chainId: number,
    poolManager: string,
    poolId: string
): Promise<void> {
    const key = `${chainId}:${poolManager.toLowerCase()}:${poolId.toLowerCase()}`;
    if (infinityPoolKeyCache.has(key)) return;
    infinityPoolKeyCache.add(key);

    try {
        const callData = infinityPoolKeyInterface.encodeFunctionData('poolIdToPoolKey', [poolId]);
        const result = await rpcCall<string>(chainId, 'eth_call', [{
            to: poolManager,
            data: callData
        }, 'latest'], {
            purpose: TRADE_QUOTE_PROFILE.purpose,
            strategy: TRADE_QUOTE_PROFILE.strategy,
            importance: TRADE_QUOTE_PROFILE.importance
        });

        if (!result || result === '0x') return;
        const decoded = infinityPoolKeyInterface.decodeFunctionResult('poolIdToPoolKey', result)[0];
        const poolKey = {
            currency0: (decoded.currency0 as string).toLowerCase(),
            currency1: (decoded.currency1 as string).toLowerCase(),
            hooks: (decoded.hooks as string).toLowerCase(),
            poolManager: (decoded.poolManager as string).toLowerCase(),
            fee: Number(decoded.fee),
            parameters: decoded.parameters as string
        };

        const pairKey = `infi:pair:${chainId}:${poolKey.currency0}:${poolKey.currency1}`;
        const poolKeyKey = `infi:poolkey:${chainId}:${poolId.toLowerCase()}`;

        await setDbCache(poolKeyKey, JSON.stringify(poolKey), 60 * 60 * 24 * 7);

        const existing = await getDbCache(pairKey);
        let poolIds: string[] = [];
        if (existing) {
            try {
                poolIds = JSON.parse(existing);
            } catch { }
        }
        if (!poolIds.includes(poolId.toLowerCase())) {
            poolIds.push(poolId.toLowerCase());
            await setDbCache(pairKey, JSON.stringify(poolIds), 60 * 60 * 24 * 7);
        }
    } catch (err: any) {
        logger.debug(LogCode.DEC_SWAP_DETECTION, 'Failed to cache infinity pool key', {
            poolId,
            error: err?.message?.slice(0, 120)
        });
    }
}

function cacheInfinityPoolKeysFromLogs(
    logs: Array<{ address: string; topics: string[]; data: string }>,
    chainId: number
): void {
    if (chainId !== 56) return;
    const tasks: Promise<void>[] = [];
    for (const log of logs) {
        const addr = log.address?.toLowerCase();
        const topic0 = log.topics?.[0]?.toLowerCase();
        const poolId = log.topics?.[1];
        if (!poolId) continue;

        if (addr === INFINITY_CL_POOL_MANAGER && topic0 === INFINITY_CL_SWAP_EVENT.toLowerCase()) {
            tasks.push(cacheInfinityPoolKey(chainId, INFINITY_CL_POOL_MANAGER, poolId));
            continue;
        }
        if (addr === INFINITY_BIN_POOL_MANAGER && topic0 === INFINITY_BIN_SWAP_EVENT.toLowerCase()) {
            tasks.push(cacheInfinityPoolKey(chainId, INFINITY_BIN_POOL_MANAGER, poolId));
            continue;
        }
    }
    if (tasks.length) {
        Promise.allSettled(tasks).catch(() => undefined);
    }
}

async function fetchV4InitLog(
    chainId: number,
    poolManager: string,
    poolId: string
): Promise<{ address: string; topics: string[]; data: string } | null> {
    try {
        const logs = await rpcCall<any[]>(
            chainId,
            'eth_getLogs',
            [{
                address: poolManager,
                fromBlock: '0x0',
                toBlock: 'latest',
                topics: [V4_INIT_EVENT, poolId]
            }],
            {
                purpose: TRADE_QUOTE_PROFILE.purpose,
                strategy: TRADE_QUOTE_PROFILE.strategy,
                importance: TRADE_QUOTE_PROFILE.importance
            }
        );
        if (!logs || logs.length === 0) return null;
        return logs[0];
    } catch (err: any) {
        logger.debug(LogCode.DEC_SWAP_DETECTION, 'Failed to fetch V4 init log', {
            chainId,
            poolManager,
            poolId,
            error: err.message
        });
        return null;
    }
}

async function resolveV4PoolTokens(
    chainId: number,
    poolManager: string,
    poolId: string,
    receiptLogs: Array<{ address: string; topics: string[]; data: string }>
): Promise<{ token0: string; token1: string } | null> {
    const cacheKey = `${chainId}:${poolManager.toLowerCase()}:${poolId.toLowerCase()}`;
    if (v4PoolTokenCache.has(cacheKey)) {
        return v4PoolTokenCache.get(cacheKey) || null;
    }
    const inflight = v4PoolTokenInflight.get(cacheKey);
    if (inflight) return await inflight;

    const promise = (async () => {
        const dbKey = `v4pool:${cacheKey}`;
        const cachedValue = await getDbCache(dbKey);
        if (cachedValue) {
            try {
                const parsed = JSON.parse(cachedValue);
                if (parsed?.token0 && parsed?.token1) {
                    const tokens = {
                        token0: parsed.token0.toLowerCase(),
                        token1: parsed.token1.toLowerCase()
                    };
                    v4PoolTokenCache.set(cacheKey, tokens);
                    return tokens;
                }
            } catch {
                // ignore bad cache
            }
        }

        const initLog = findV4InitLogInReceipt(receiptLogs, poolManager, poolId)
            || await fetchV4InitLog(chainId, poolManager, poolId);

        if (!initLog || initLog.topics.length < 4) {
            v4PoolTokenCache.set(cacheKey, null);
            return null;
        }

        const currency0 = '0x' + initLog.topics[2].slice(26);
        const currency1 = '0x' + initLog.topics[3].slice(26);

        const tokens = {
            token0: normalizeCurrencyAddress(currency0),
            token1: normalizeCurrencyAddress(currency1)
        };

        v4PoolTokenCache.set(cacheKey, tokens);
        await setDbCache(dbKey, JSON.stringify(tokens), 60 * 60 * 24 * 30); // 30d
        return tokens;
    })();

    v4PoolTokenInflight.set(cacheKey, promise);
    try {
        return await promise;
    } finally {
        v4PoolTokenInflight.delete(cacheKey);
    }
}

async function decodeSwapFromV4Events(
    logs: Array<{ address: string; topics: string[]; data: string }>,
    chainId: number,
    preferredPair?: { tokenIn: string; tokenOut: string }
): Promise<DecodedSwap | null> {
    const swapLogs = logs.filter((log) => log.topics?.[0]?.toLowerCase() === V4_SWAP_EVENT.toLowerCase());
    if (swapLogs.length === 0) return null;

    let swapLog: { address: string; topics: string[]; data: string } | null = swapLogs[swapLogs.length - 1];
    let preMatchedKey: ReturnType<typeof matchV4PoolKeyById> = null;

    if (preferredPair?.tokenIn && preferredPair?.tokenOut) {
        for (let i = swapLogs.length - 1; i >= 0; i--) {
            const candidate = swapLogs[i];
            const candidatePoolId = normalizePoolIdTopic(candidate.topics?.[1]);
            if (!candidatePoolId) continue;
            const matchedKey = tryMatchV4PoolKeyFromPair(
                chainId,
                candidatePoolId,
                preferredPair.tokenIn,
                preferredPair.tokenOut
            );
            if (matchedKey) {
                swapLog = candidate;
                preMatchedKey = matchedKey;
                break;
            }
        }
    }

    if (!swapLog || !swapLog.topics || swapLog.topics.length < 2) return null;

    const poolId = normalizePoolIdTopic(swapLog.topics[1]);
    const poolManager = swapLog.address;
    if (!poolId || !poolManager) return null;

    let tokens = await resolveV4PoolTokens(chainId, poolManager, poolId, logs);

    try {
        let matchedKey = preMatchedKey;
        if (!matchedKey && tokens) {
            matchedKey = matchV4PoolKeyById(chainId, poolId, tokens.token0, tokens.token1);
        }
        if (!matchedKey && preferredPair?.tokenIn && preferredPair?.tokenOut) {
            matchedKey = tryMatchV4PoolKeyFromPair(chainId, poolId, preferredPair.tokenIn, preferredPair.tokenOut);
        }
        if (!tokens && matchedKey) {
            tokens = {
                token0: normalizeCurrencyAddress(matchedKey.currency0),
                token1: normalizeCurrencyAddress(matchedKey.currency1)
            };
        }
        if (!tokens) return null;

        const parsed = v4SwapEventInterface.parseLog({ topics: swapLog.topics, data: swapLog.data });
        if (!parsed) {
            return null;
        }
        const amount0 = BigInt(parsed.args.amount0.toString());
        const amount1 = BigInt(parsed.args.amount1.toString());

        let tokenIn = '';
        let tokenOut = '';
        let amountIn = 0n;
        let amountOut = 0n;

        if (amount0 > 0n && amount1 < 0n) {
            tokenIn = tokens.token0;
            tokenOut = tokens.token1;
            amountIn = amount0;
            amountOut = amount1 * -1n;
        } else if (amount1 > 0n && amount0 < 0n) {
            tokenIn = tokens.token1;
            tokenOut = tokens.token0;
            amountIn = amount1;
            amountOut = amount0 * -1n;
        } else {
            if (!preferredPair?.tokenIn || !preferredPair?.tokenOut) return null;
            tokenIn = preferredPair.tokenIn.toLowerCase();
            tokenOut = preferredPair.tokenOut.toLowerCase();
            amountIn = 0n;
            amountOut = 0n;
        }

        const eventFee = Number(parsed.args.fee ?? 0);
        const DYNAMIC_FEE_FLAG = 0x800000;
        const feeToTickSpacing = (fee: number): number => {
            if (fee === DYNAMIC_FEE_FLAG) return 200;
            if (fee <= 500) return 10;
            if (fee <= 1000) return 20;
            if (fee <= 2500) return 50;
            if (fee <= 3000) return 60;
            return 200;
        };
        let fallbackHook = '0x0000000000000000000000000000000000000000';
        let fallbackFee = eventFee;
        let fallbackTickSpacing = feeToTickSpacing(eventFee);

        if (!matchedKey) {
            const initLog = findV4InitLogInReceipt(logs, poolManager, poolId)
                || await fetchV4InitLog(chainId, poolManager, poolId);
            if (initLog) {
                try {
                    const initParsed = v4InitEventInterface.parseLog({ topics: initLog.topics, data: initLog.data });
                    fallbackHook = String(initParsed?.args?.hooks || fallbackHook).toLowerCase();
                    fallbackFee = Number(initParsed?.args?.fee ?? fallbackFee);
                    fallbackTickSpacing = Number(initParsed?.args?.tickSpacing ?? fallbackTickSpacing);
                } catch {
                    // Keep heuristic fallback values.
                }
            }
        }

        // Build resolvedPoolHint from matched key if available, otherwise from event data.
        // For copy-trade this is critical: it lets us skip pool discovery and use the same pool.
        const resolvedPoolHint: DecodedSwap['resolvedPoolHint'] = matchedKey
            ? {
                kind: 'v4',
                dex: chainId === 56 ? 'pancake' : 'uniswap',
                poolAddress: poolId.toLowerCase(),
                fee: matchedKey.fee,
                v4PoolKey: {
                    currency0: matchedKey.currency0,
                    currency1: matchedKey.currency1,
                    hooks: matchedKey.hooks,
                    poolManager: poolManager.toLowerCase(),
                    fee: matchedKey.fee,
                    tickSpacing: matchedKey.tickSpacing
                }
            }
            : {
                kind: 'v4',
                dex: chainId === 56 ? 'pancake' : 'uniswap',
                poolAddress: poolId.toLowerCase(),
                fee: fallbackFee,
                v4PoolKey: {
                    currency0: tokens.token0,
                    currency1: tokens.token1,
                    hooks: fallbackHook,
                    poolManager: poolManager.toLowerCase(),
                    fee: fallbackFee,
                    tickSpacing: fallbackTickSpacing
                }
            };

        return {
            tokenIn,
            tokenOut,
            amountIn: amountIn.toString(),
            amountOut: amountOut.toString(),
            router: '',
            dexName: 'Uniswap v4',
            resolvedPoolHint
        };
    } catch (err: any) {
        logger.debug(LogCode.DEC_SWAP_DETECTION, 'Failed to parse V4 swap log', { error: err.message });
        return null;
    }
}

async function decodeSwapFromPoolEvents(
    logs: Array<{ address: string; topics: string[]; data: string }>,
    chainId: number
): Promise<DecodedSwap | null> {
    // Prefer pool Swap events if present (V3/V2). They are more reliable than Transfer heuristics.
    let lastSwapLog: { address: string; topics: string[]; data: string } | null = null;
    let swapType: 'v3' | 'v2' | null = null;

    for (const log of logs) {
        const topic0 = log.topics?.[0]?.toLowerCase();
        if (topic0 === V3_SWAP_EVENT || topic0 === V3_SWAP_EVENT_EXT) {
            lastSwapLog = log;
            swapType = 'v3';
        } else if (topic0 === V2_SWAP_EVENT || topic0 === V2_SWAP_EVENT_ALT) {
            lastSwapLog = log;
            swapType = 'v2';
        }
    }

    if (!lastSwapLog || !swapType) return null;

    const pool = lastSwapLog.address.toLowerCase();
    const poolDex = swapType === 'v3'
        ? await detectPoolDex(pool, chainId)
        : (chainId === 56 ? 'pancake' as const : 'uniswap' as const);
    const inferred = inferSwapFromPoolTransfers(logs, pool);
    if (inferred) {
        return {
            tokenIn: inferred.tokenIn,
            tokenOut: inferred.tokenOut,
            amountIn: inferred.amountIn.toString(),
            amountOut: inferred.amountOut.toString(),
            router: '',
            dexName: swapType === 'v3' ? 'V3 Pool' : 'V2 Pair',
            resolvedPoolHint: {
                kind: poolDex === 'aerodrome' ? 'aerodrome' as const : swapType,
                dex: poolDex,
                poolAddress: pool
            }
        };
    }

    const tokens = await getPoolTokens(chainId, pool);
    if (!tokens) return null;

    if (swapType === 'v3') {
        try {
            // Support both canonical UniswapV3 Swap and extended Pancake/Algebra Swap.
            const ifaces = [
                new ethers.Interface([
                    'event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)',
                ]),
                new ethers.Interface([
                    'event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint128 protocolFeesToken0, uint128 protocolFeesToken1)',
                ]),
            ];
            let parsed: ethers.LogDescription | null = null;
            for (const iface of ifaces) {
                try {
                    parsed = iface.parseLog({ topics: lastSwapLog.topics, data: lastSwapLog.data });
                    if (parsed) break;
                } catch {
                    // Try next ABI variant.
                }
            }
            if (!parsed) return null;
            const amount0 = BigInt(parsed.args.amount0.toString());
            const amount1 = BigInt(parsed.args.amount1.toString());

            // V3: positive amount is token in, negative is token out
            let tokenIn = '';
            let tokenOut = '';
            let amountIn = 0n;
            let amountOut = 0n;

            if (amount0 > 0n && amount1 < 0n) {
                tokenIn = tokens.token0;
                tokenOut = tokens.token1;
                amountIn = amount0;
                amountOut = amount1 * -1n;
            } else if (amount1 > 0n && amount0 < 0n) {
                tokenIn = tokens.token1;
                tokenOut = tokens.token0;
                amountIn = amount1;
                amountOut = amount0 * -1n;
            } else {
                return null;
            }

            return {
                tokenIn,
                tokenOut,
                amountIn: amountIn.toString(),
                amountOut: amountOut.toString(),
                router: '',
                dexName: poolDex === 'aerodrome' ? 'Aerodrome CL' : 'V3 Pool',
                resolvedPoolHint: {
                    kind: poolDex === 'aerodrome' ? 'aerodrome' as const : 'v3',
                    dex: poolDex,
                    poolAddress: pool,
                    fee: 0
                }
            };
        } catch (err: any) {
            logger.debug(LogCode.DEC_SWAP_DETECTION, 'Failed to parse V3 swap log', { pool, error: err.message });
            return null;
        }
    }

    if (swapType === 'v2') {
        try {
            const ifaces = [
                new ethers.Interface([
                    'event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)',
                ]),
                new ethers.Interface([
                    'event Swap(address indexed sender, address indexed to, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out)',
                ]),
            ];
            let parsed: ethers.LogDescription | null = null;
            for (const iface of ifaces) {
                try {
                    parsed = iface.parseLog({ topics: lastSwapLog.topics, data: lastSwapLog.data });
                    if (parsed) break;
                } catch {
                    // Try next ABI variant.
                }
            }
            if (!parsed) return null;
            const amount0In = BigInt(parsed.args.amount0In.toString());
            const amount1In = BigInt(parsed.args.amount1In.toString());
            const amount0Out = BigInt(parsed.args.amount0Out.toString());
            const amount1Out = BigInt(parsed.args.amount1Out.toString());

            let tokenIn = '';
            let tokenOut = '';
            let amountIn = 0n;
            let amountOut = 0n;

            if (amount0In > 0n && amount1Out > 0n) {
                tokenIn = tokens.token0;
                tokenOut = tokens.token1;
                amountIn = amount0In;
                amountOut = amount1Out;
            } else if (amount1In > 0n && amount0Out > 0n) {
                tokenIn = tokens.token1;
                tokenOut = tokens.token0;
                amountIn = amount1In;
                amountOut = amount0Out;
            } else {
                return null;
            }

            return {
                tokenIn,
                tokenOut,
                amountIn: amountIn.toString(),
                amountOut: amountOut.toString(),
                router: '',
                dexName: 'V2 Pair',
                resolvedPoolHint: {
                    kind: 'v2',
                    dex: chainId === 56 ? 'pancake' : 'uniswap',
                    poolAddress: pool
                }
            };
        } catch (err: any) {
            logger.debug(LogCode.DEC_SWAP_DETECTION, 'Failed to parse V2 swap log', { pool, error: err.message });
            return null;
        }
    }

    return null;
}

export interface DecodedSwap {
    txHash?: string;
    sourceTxInput?: string;
    sourceTxValue?: string;
    sourceSelector?: string;
    poolAmountIn?: string;
    poolTokenIn?: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOut: string;
    router: string;
    dexName: string;
    routeHopCount?: number;
    routeHops?: Array<{
        kind: 'v4' | 'v3' | 'v2' | 'aerodrome' | 'infinity';
        dex?: 'uniswap' | 'pancake' | 'aerodrome' | 'pancake-infinity';
        poolAddress?: string;
        tokenIn?: string;
        tokenOut?: string;
        fee?: number;
    }>;
    canUseResolvedPoolFastPath?: boolean;
    resolvedPoolHint?: {
        kind: 'v4' | 'v3' | 'v2' | 'aerodrome';
        dex?: 'uniswap' | 'pancake' | 'aerodrome' | 'pancake-infinity';
        poolAddress?: string;
        fee?: number;
        v4PoolKey?: {
            currency0: string;
            currency1: string;
            hooks: string;
            poolManager: string;
            fee: number;
            tickSpacing: number;
        };
    };
    cashLegHint?: {
        cashSpentUsd?: number;
        cashReceivedUsd?: number;
        inferredTxType?: 'TARGET_BUY' | 'TARGET_SELL' | 'TARGET_TOKEN_SWAP';
    };
}

function normalizePairToken(token: string, chainId: number): string {
    const native = NATIVE_TOKEN_ADDRESS.toLowerCase();
    const wrapped = getChainConfig(chainId).wrappedNativeAddress.toLowerCase();
    const normalized = String(token || '').toLowerCase();
    if (!normalized) return normalized;
    if (normalized === native) return wrapped;
    return normalized;
}

function isSamePoolPair(
    tokenA: string,
    tokenB: string,
    tokenX: string,
    tokenY: string,
    chainId: number
): boolean {
    const a = normalizePairToken(tokenA, chainId);
    const b = normalizePairToken(tokenB, chainId);
    const x = normalizePairToken(tokenX, chainId);
    const y = normalizePairToken(tokenY, chainId);
    if (!a || !b || !x || !y) return false;
    return (a === x && b === y) || (a === y && b === x);
}

type DecodedRouteHopKind = 'v4' | 'v3' | 'v2' | 'aerodrome' | 'infinity';

function classifyHopFromTopic(topic0: string): DecodedRouteHopKind | null {
    const normalized = topic0.toLowerCase();
    if (normalized === V4_SWAP_EVENT.toLowerCase()) return 'v4';
    if (normalized === V3_SWAP_EVENT || normalized === V3_SWAP_EVENT_EXT) return 'v3';
    if (normalized === V2_SWAP_EVENT || normalized === V2_SWAP_EVENT_ALT) return 'v2';
    if (normalized === INFINITY_CL_SWAP_EVENT.toLowerCase() || normalized === INFINITY_BIN_SWAP_EVENT.toLowerCase()) return 'infinity';
    return null;
}

function dedupeRouteHops(hops: NonNullable<DecodedSwap['routeHops']>): NonNullable<DecodedSwap['routeHops']> {
    const seen = new Set<string>();
    const result: NonNullable<DecodedSwap['routeHops']> = [];
    for (const hop of hops) {
        const key = `${hop.kind}:${(hop.poolAddress || '').toLowerCase()}:${(hop.tokenIn || '').toLowerCase()}:${(hop.tokenOut || '').toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(hop);
    }
    return result;
}

function extractRouteHops(logs: Array<{ address: string; topics: string[]; data: string }>, chainId: number): NonNullable<DecodedSwap['routeHops']> {
    const routeHops: NonNullable<DecodedSwap['routeHops']> = [];
    for (const log of logs) {
        const topic0 = String(log.topics?.[0] || '').toLowerCase();
        const kind = classifyHopFromTopic(topic0);
        if (!kind) continue;
        const poolManagerOrPoolAddress = String(log.address || '').toLowerCase();
        const topicPoolId = normalizePoolIdTopic(log.topics?.[1]);
        const poolAddress = (kind === 'v4' || kind === 'infinity')
            ? (topicPoolId || poolManagerOrPoolAddress)
            : poolManagerOrPoolAddress;
        const inferred = poolManagerOrPoolAddress ? inferSwapFromPoolTransfers(logs, poolManagerOrPoolAddress) : null;
        let fee: number | undefined;
        if (kind === 'v4') {
            try {
                const parsed = v4SwapEventInterface.parseLog({ topics: log.topics, data: log.data });
                fee = Number(parsed?.args?.fee ?? 0);
            } catch {
                fee = undefined;
            }
        }
        routeHops.push({
            kind,
            dex: kind === 'infinity'
                ? 'pancake-infinity'
                : chainId === 56
                    ? 'pancake'
                    : 'uniswap',
            poolAddress,
            tokenIn: inferred?.tokenIn,
            tokenOut: inferred?.tokenOut,
            fee
        });
    }
    return dedupeRouteHops(routeHops);
}

function attachRouteContext(
    swap: DecodedSwap,
    logs: Array<{ address: string; topics: string[]; data: string }>,
    chainId: number
): DecodedSwap {
    const resolvedPairMismatch = (() => {
        if (swap.resolvedPoolHint?.kind !== 'v4' || !swap.resolvedPoolHint.v4PoolKey) return false;
        return !isSamePoolPair(
            swap.tokenIn,
            swap.tokenOut,
            swap.resolvedPoolHint.v4PoolKey.currency0,
            swap.resolvedPoolHint.v4PoolKey.currency1,
            chainId
        );
    })();

    const routeHops = extractRouteHops(logs, chainId);
    if (!routeHops.length) {
        swap.routeHopCount = 0;
        swap.routeHops = undefined;
        swap.canUseResolvedPoolFastPath = Boolean(swap.resolvedPoolHint) && !resolvedPairMismatch;
        return swap;
    }

    swap.routeHopCount = routeHops.length;
    swap.routeHops = routeHops;

    if (routeHops.length === 1 && routeHops[0]?.poolAddress) {
        const inferredPoolFlow = inferSwapFromPoolTransfers(logs, routeHops[0].poolAddress);
        if (inferredPoolFlow && isSamePoolPair(
            swap.tokenIn,
            swap.tokenOut,
            inferredPoolFlow.tokenIn,
            inferredPoolFlow.tokenOut,
            chainId
        )) {
            const swapIn = normalizePairToken(swap.tokenIn, chainId);
            const inferredIn = normalizePairToken(inferredPoolFlow.tokenIn, chainId);
            const wrappedNative = getChainConfig(chainId).wrappedNativeAddress.toLowerCase();
            const poolTokenIn = inferredIn === wrappedNative ? NATIVE_TOKEN_ADDRESS : inferredPoolFlow.tokenIn;
            const poolAmountIn = swapIn === inferredIn
                ? inferredPoolFlow.amountIn
                : inferredPoolFlow.amountOut;
            if (poolAmountIn > 0n) {
                swap.poolAmountIn = poolAmountIn.toString();
                swap.poolTokenIn = String(poolTokenIn).toLowerCase();
            }
        }
    }

    if (!swap.resolvedPoolHint) {
        swap.canUseResolvedPoolFastPath = false;
        return swap;
    }

    if (resolvedPairMismatch) {
        swap.canUseResolvedPoolFastPath = false;
        return swap;
    }

    // Multi-hop router paths (OKX/aggregators) often expose only a tail pool in resolvedPoolHint.
    // Disable resolved-pool fast-path to avoid executing ETH->token against a USDC->token tail pool.
    if (routeHops.length > 1) {
        swap.canUseResolvedPoolFastPath = false;
        return swap;
    }

    const onlyHop = routeHops[0];
    if (onlyHop?.tokenIn && onlyHop?.tokenOut) {
        swap.canUseResolvedPoolFastPath = isSamePoolPair(
            swap.tokenIn,
            swap.tokenOut,
            onlyHop.tokenIn,
            onlyHop.tokenOut,
            chainId
        );
        return swap;
    }

    swap.canUseResolvedPoolFastPath = true;
    return swap;
}

/**
 * Get DEX name from router address
 */
export function getDexName(routerAddress: string, chainId: number): string {
    const address = routerAddress.toLowerCase();

    // Base chain routers
    if (chainId === 8453) {
        const baseRouters: Record<string, string> = {
            '0x2626664c2603336e57b271c5c0b26f421741e481': 'Uniswap V3',
            '0x6ff5693b99212da76ad316178a184ab56d299b43': 'Uniswap Universal Router (v4)',
            '0x498581ff718922c3f8e6a244956af099b2652b2b': 'Uniswap v4 PoolManager',
            '0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43': 'Aerodrome Router',
            '0x0b75c6ec0b855abb3b0e01c84ec1122e982c1a79': 'Aerodrome Router',
            '0x278d858f05b94576c1e6f73285886876ff6ef8d2': 'Aerodrome Router',
            '0x6cb442acf35158d5eda88fe602221b67b400be3e': 'Aerodrome Router',
            '0xecdbefd25ff60725cb0ee3419706b0d42137fa41': 'Aerodrome Router',
            '0x013bb8a204499523ddf717e0abaa14e6dc849060': 'Aerodrome Router',
            '0xf9cfb8a62f50e10adde5aa888b44cf01c5957055': 'Aerodrome Router',
            '0x4409921ae43a39a11d90f7b7f96cfd0b8093d9fc': 'Aerodrome Router',
            '0x6df1c91424f79e40e33b1a48f0687b666be71075': 'Aerodrome Router',
            '0xc681a700adf9821461a935acb56422b2cbd926b8': 'Aerodrome Router',
            '0x21e99b325d53fe3d574ac948b9cb1519da03e518': 'Aerodrome Router',
            '0xf57129eb376998de8513ea4e996c1334930b02cb': 'Aerodrome Router',
            '0x5e766616aabfb588e23a8ea854e9dbd1042affd3': 'Aerodrome Router',
            '0x663dc15d3c1ac63ff12e45ab68fea3f0a883c251': 'Aerodrome Router',
            '0xbc0663ef63add180609944c58ba7d4851890ca45': 'Aerodrome Router',
            '0x420dd381b31aef6683db6b902084cb0ffece40da': 'Aerodrome Slipstream PoolFactory',
            '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24': 'BaseSwap Router',
            '0x1111111254eeb25477b68fb85ed929f73a960582': '1inch Router',
            '0x6131b5fae19ea4f9d964eac0408e4408b66337b5': 'KyberSwap',
            '0x0000000000001ff3684f28c67538d4d072c22734': '0x Protocol',
            '0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae': 'LiFi',
        };
        return baseRouters[address] || 'Unknown DEX';
    }

    // BSC Routers
    if (chainId === 56) {
        const bscRouters: Record<string, string> = {
            '0x10ed43c718714eb63d5aa57b78b54704e256024e': 'PancakeSwap V2',
            '0x13f4ea83d0bd40e75c8222255bc855a974568dd4': 'PancakeSwap Smart Router',
            '0x1b81d678ffb9c0263b24a97847620c99d213eb14': 'Pancake Universal Router',
            '0x1111111254eeb25477b68fb85ed929f73a960582': '1inch Router',
            '0x6352a56caadc4f1e25cd6c75970fa768a3304e64': 'OpenOcean Router',
            '0xdef1c0ded9bec7f1a1670819833240faca6db2a2': '0x Protocol',
        };
        return bscRouters[address] || 'Unknown DEX';
    }

    // Ethereum Routers (Common ones)
    if (chainId === 1) {
        const ethRouters: Record<string, string> = {
            '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': 'Uniswap V2',
            '0xe592427a0aece92de3edee1f18e0157c05861564': 'Uniswap V3',
            '0xdef1c0ded9bec7f1a1670819833240faca6db2a2': '0x Protocol',
            '0x000000000004444c5dc75cb358380d2e3de08a90': 'Uniswap v4 PoolManager',
        };
        return ethRouters[address] || 'Unknown DEX';
    }

    return 'Unknown DEX';
}

/**
 * Parse a transaction to extract swap details
 */
export async function parseSwapTransaction(
    tx: {
        hash: string;
        from: string;
        to: string;
        input: string;
        value: string;
    },
    receipt: {
        logs: Array<{ address: string; topics: string[]; data: string }>;
        status: number | string | boolean;
    },
    chainId: number,
    targetWallet?: string
): Promise<DecodedSwap | null> {
    const PROFILE = process.env.COPYTRADE_PROFILE ? process.env.COPYTRADE_PROFILE === 'true' : true;
    const t0 = Date.now();
    const attachSourceTx = (swap: DecodedSwap): DecodedSwap => {
        swap.sourceTxInput = String(tx.input || '');
        swap.sourceTxValue = String(tx.value || '0');
        swap.sourceSelector = String(tx.input || '').slice(0, 10).toLowerCase();
        return swap;
    };
    // Only process successful transactions
    const status = typeof receipt.status === 'string'
        ? Number.parseInt(receipt.status, 16)
        : receipt.status === true
            ? 1
            : receipt.status;
    if (status !== 1) {
        if (PROFILE) {
            logger.info(LogCode.DEC_SWAP_DETECTION, '[Profile] parseSwapTransaction', {
                tx: tx.hash?.slice(0, 12),
                path: 'status_not_success',
                ms: Date.now() - t0
            });
        }
        return null;
    }

    // Determine effective wallet for Transfer-based decoding
    let effectiveWallet = targetWallet?.toLowerCase() || tx.from.toLowerCase();
    if (!targetWallet) {
        const entrypoint = tx.to?.toLowerCase();
        if (entrypoint && ENTRYPOINT_ADDRESSES.has(entrypoint)) {
            const userOpLog = receipt.logs.find(log => log.topics?.[0]?.toLowerCase() === USER_OP_EVENT);
            if (userOpLog && userOpLog.topics.length >= 3) {
                effectiveWallet = ('0x' + userOpLog.topics[2].slice(26)).toLowerCase();
            }
        } else {
            const userOpLog = receipt.logs.find(log => log.topics?.[0]?.toLowerCase() === USER_OP_EVENT);
            if (userOpLog && userOpLog.topics.length >= 3) {
                effectiveWallet = ('0x' + userOpLog.topics[2].slice(26)).toLowerCase();
            }
        }
    }

    const v2SwapTopic = V2_SWAP_EVENT.toLowerCase();
    const v2SwapAltTopic = V2_SWAP_EVENT_ALT.toLowerCase();
    const v3SwapTopic = V3_SWAP_EVENT.toLowerCase();
    const v4SwapTopic = V4_SWAP_EVENT.toLowerCase();
    const infinityClSwapTopic = INFINITY_CL_SWAP_EVENT.toLowerCase();
    const infinityBinSwapTopic = INFINITY_BIN_SWAP_EVENT.toLowerCase();
    const hasV2Swap = receipt.logs.some((log) => {
        const topic0 = log.topics?.[0]?.toLowerCase();
        return topic0 === v2SwapTopic || topic0 === v2SwapAltTopic;
    });
    const v3SwapExtTopic = V3_SWAP_EVENT_EXT.toLowerCase();
    const hasV3Swap = receipt.logs.some((log) => {
        const topic0 = log.topics?.[0]?.toLowerCase();
        return topic0 === v3SwapTopic || topic0 === v3SwapExtTopic;
    });
    const hasV4Swap = receipt.logs.some((log) => log.topics?.[0]?.toLowerCase() === v4SwapTopic);
    const hasInfinitySwap = receipt.logs.some((log) => {
        const topic0 = log.topics?.[0]?.toLowerCase();
        return topic0 === infinityClSwapTopic || topic0 === infinityBinSwapTopic;
    });
    const hasPoolSwapEvidence = hasV2Swap || hasV3Swap || hasV4Swap || hasInfinitySwap;
    const hasKnownSwapSelector = isSwapTransaction(tx.input || '');
    const knownRouter = tx.to ? getDexName(tx.to, chainId) !== 'Unknown DEX' : false;
    const hasDexIntentEvidence = hasKnownSwapSelector && knownRouter;
    const hasTransferEvidence = shouldAttemptTransferBasedDecode({
        hasPoolSwapEvidence,
        hasDexIntentEvidence,
        logs: receipt.logs,
        walletAddress: effectiveWallet,
        nativeValue: tx.value
    });

    if (!hasTransferEvidence) {
        if (PROFILE) {
            logger.info(LogCode.DEC_SWAP_DETECTION, '[Profile] parseSwapTransaction', {
                tx: tx.hash?.slice(0, 12),
                path: 'no_swap_evidence',
                totalMs: Date.now() - t0
            });
        }
        return null;
    }

    cacheInfinityPoolKeysFromLogs(receipt.logs, chainId);

    const toPositiveBigInt = (value?: string): bigint => {
        try {
            const v = BigInt(value || '0');
            return v > 0n ? v : 0n;
        } catch {
            return 0n;
        }
    };
    const hasMissingLegAmount = (swap: DecodedSwap): boolean =>
        toPositiveBigInt(swap.amountIn) <= 0n || toPositiveBigInt(swap.amountOut) <= 0n;
    const wrappedNative = getChainConfig(chainId).wrappedNativeAddress.toLowerCase();
    const toToken = (value?: string): string => String(value || '').toLowerCase();
    const toCanonicalPairToken = (value?: string): string => {
        const token = toToken(value);
        if (!token) return token;
        return token === wrappedNative ? NATIVE_TOKEN_ADDRESS : token;
    };
    const hasSameTokenPair = (left: DecodedSwap, right: DecodedSwap): boolean => {
        const leftIn = toCanonicalPairToken(left.tokenIn);
        const leftOut = toCanonicalPairToken(left.tokenOut);
        const rightIn = toCanonicalPairToken(right.tokenIn);
        const rightOut = toCanonicalPairToken(right.tokenOut);
        if (!leftIn || !leftOut || !rightIn || !rightOut) return false;
        return (
            (leftIn === rightIn && leftOut === rightOut)
            || (leftIn === rightOut && leftOut === rightIn)
        );
    };
    const repairMissingAmountsFromHint = (
        baseSwap: DecodedSwap,
        hintedSwap: DecodedSwap,
        source: 'v4' | 'pool'
    ): { repaired: boolean; reversed: boolean } => {
        if (!hasSameTokenPair(baseSwap, hintedSwap)) {
            logger.debug(LogCode.DEC_SWAP_DETECTION, 'Swap repair skipped: hinted pair mismatch', {
                source,
                baseTokenIn: baseSwap.tokenIn,
                baseTokenOut: baseSwap.tokenOut,
                hintedTokenIn: hintedSwap.tokenIn,
                hintedTokenOut: hintedSwap.tokenOut
            });
            return { repaired: false, reversed: false };
        }

        const baseIn = toCanonicalPairToken(baseSwap.tokenIn);
        const baseOut = toCanonicalPairToken(baseSwap.tokenOut);
        const hintedIn = toCanonicalPairToken(hintedSwap.tokenIn);
        const hintedOut = toCanonicalPairToken(hintedSwap.tokenOut);
        const sameDirection = baseIn === hintedIn && baseOut === hintedOut;
        const reversedDirection = baseIn === hintedOut && baseOut === hintedIn;

        if (!sameDirection && !reversedDirection) {
            return { repaired: false, reversed: false };
        }

        const baseMissingIn = toPositiveBigInt(baseSwap.amountIn) <= 0n;
        const baseMissingOut = toPositiveBigInt(baseSwap.amountOut) <= 0n;
        if (!baseMissingIn && !baseMissingOut) {
            return { repaired: false, reversed: reversedDirection };
        }

        const hintedAmountIn = toPositiveBigInt(hintedSwap.amountIn);
        const hintedAmountOut = toPositiveBigInt(hintedSwap.amountOut);
        if (sameDirection) {
            if (baseMissingIn && hintedAmountIn > 0n) baseSwap.amountIn = hintedSwap.amountIn;
            if (baseMissingOut && hintedAmountOut > 0n) baseSwap.amountOut = hintedSwap.amountOut;
        } else {
            // Preserve wallet-perspective direction; only map amounts from opposite pool-direction quote.
            if (baseMissingIn && hintedAmountOut > 0n) baseSwap.amountIn = hintedSwap.amountOut;
            if (baseMissingOut && hintedAmountIn > 0n) baseSwap.amountOut = hintedSwap.amountIn;
        }

        const repaired = !hasMissingLegAmount(baseSwap);
        if (repaired && reversedDirection) {
            logger.info(LogCode.DEC_SWAP_DETECTION, 'Swap repair used reversed pool direction while preserving wallet direction', {
                source,
                tokenIn: baseSwap.tokenIn,
                tokenOut: baseSwap.tokenOut
            });
        }
        return { repaired, reversed: reversedDirection };
    };

    const tTransferStart = Date.now();
    const transferSwap = decodeSwapFromLogs(receipt.logs, effectiveWallet, tx.value);
    if (transferSwap) {
        let finalTransferSwap = transferSwap;
        let decodePath = 'transfer_logs';

        if (hasMissingLegAmount(finalTransferSwap)) {
            if (hasV4Swap) {
                const hintedV4 = await decodeSwapFromV4Events(receipt.logs, chainId, {
                    tokenIn: finalTransferSwap.tokenIn,
                    tokenOut: finalTransferSwap.tokenOut
                });
                if (hintedV4?.resolvedPoolHint && hasSameTokenPair(finalTransferSwap, hintedV4)) {
                    finalTransferSwap.resolvedPoolHint = hintedV4.resolvedPoolHint;
                }
                if (hintedV4 && !hasMissingLegAmount(hintedV4)) {
                    const repaired = repairMissingAmountsFromHint(finalTransferSwap, hintedV4, 'v4');
                    if (repaired.repaired) {
                        decodePath = repaired.reversed
                            ? 'transfer_logs_repaired_v4_reverse_mapped'
                            : 'transfer_logs_repaired_v4';
                    }
                }
            }
            if (hasMissingLegAmount(finalTransferSwap)) {
                const hintedPool = await decodeSwapFromPoolEvents(receipt.logs, chainId);
                if (hintedPool && !hasMissingLegAmount(hintedPool)) {
                    const repaired = repairMissingAmountsFromHint(finalTransferSwap, hintedPool, 'pool');
                    if (repaired.repaired) {
                        decodePath = repaired.reversed
                            ? 'transfer_logs_repaired_pool_reverse_mapped'
                            : 'transfer_logs_repaired_pool';
                    }
                }
            }
        } else if (hasV4Swap) {
            const hintedV4 = await decodeSwapFromV4Events(receipt.logs, chainId, {
                tokenIn: finalTransferSwap.tokenIn,
                tokenOut: finalTransferSwap.tokenOut
            });
            if (hintedV4?.resolvedPoolHint) {
                finalTransferSwap.resolvedPoolHint = hintedV4.resolvedPoolHint;
            }
        }

        if (!finalTransferSwap.resolvedPoolHint && !hasV4Swap) {
            const poolSwap = await decodeSwapFromPoolEvents(receipt.logs, chainId);
            if (poolSwap?.resolvedPoolHint) {
                finalTransferSwap.resolvedPoolHint = poolSwap.resolvedPoolHint;
            }
        }

        finalTransferSwap.router = tx.to;
        finalTransferSwap.dexName = hasV4Swap ? 'Uniswap v4' : getDexName(tx.to, chainId);
        finalTransferSwap.txHash = tx.hash;
        const NATIVE_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
        const chainConfig = getChainConfig(chainId);
        const WRAPPED_NATIVE = chainConfig.wrappedNativeAddress;
        if (finalTransferSwap.tokenIn.toLowerCase() === WRAPPED_NATIVE.toLowerCase()) {
            finalTransferSwap.tokenIn = NATIVE_ADDRESS;
        }
        if (finalTransferSwap.tokenOut.toLowerCase() === WRAPPED_NATIVE.toLowerCase()) {
            finalTransferSwap.tokenOut = NATIVE_ADDRESS;
        }
        if (PROFILE) {
            logger.info(LogCode.DEC_SWAP_DETECTION, '[Profile] parseSwapTransaction', {
                tx: tx.hash?.slice(0, 12),
                path: decodePath,
                transferMs: Date.now() - tTransferStart,
                totalMs: Date.now() - t0
            });
        }
        return attachRouteContext(attachSourceTx(finalTransferSwap), receipt.logs, chainId);
    }

    if (hasV4Swap) {
        const tV4Start = Date.now();
        const v4Swap = await decodeSwapFromV4Events(receipt.logs, chainId);
        if (v4Swap) {
            v4Swap.router = tx.to;
            v4Swap.txHash = tx.hash;
            const NATIVE_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
            const chainConfig = getChainConfig(chainId);
            const WRAPPED_NATIVE = chainConfig.wrappedNativeAddress;
            if (v4Swap.tokenIn.toLowerCase() === WRAPPED_NATIVE.toLowerCase()) {
                v4Swap.tokenIn = NATIVE_ADDRESS;
            }
            if (v4Swap.tokenOut.toLowerCase() === WRAPPED_NATIVE.toLowerCase()) {
                v4Swap.tokenOut = NATIVE_ADDRESS;
            }
            if (PROFILE) {
                logger.info(LogCode.DEC_SWAP_DETECTION, '[Profile] parseSwapTransaction', {
                    tx: tx.hash?.slice(0, 12),
                    path: 'v4_events',
                    v4Ms: Date.now() - tV4Start,
                    totalMs: Date.now() - t0
                });
            }
            return attachRouteContext(attachSourceTx(v4Swap), receipt.logs, chainId);
        }
    }

    const tPoolStart = Date.now();
    const poolSwap = await decodeSwapFromPoolEvents(receipt.logs, chainId);
    if (poolSwap) {
        poolSwap.router = tx.to;
        const routerDex = getDexName(tx.to, chainId);
        poolSwap.dexName = routerDex !== 'Unknown DEX' ? routerDex : poolSwap.dexName;
        poolSwap.txHash = tx.hash;
        const NATIVE_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
        const chainConfig = getChainConfig(chainId);
        const WRAPPED_NATIVE = chainConfig.wrappedNativeAddress;
        if (poolSwap.tokenIn.toLowerCase() === WRAPPED_NATIVE.toLowerCase()) {
            poolSwap.tokenIn = NATIVE_ADDRESS;
        }
        if (poolSwap.tokenOut.toLowerCase() === WRAPPED_NATIVE.toLowerCase()) {
            poolSwap.tokenOut = NATIVE_ADDRESS;
        }
        if (PROFILE) {
            logger.info(LogCode.DEC_SWAP_DETECTION, '[Profile] parseSwapTransaction', {
                tx: tx.hash?.slice(0, 12),
                path: 'pool_events',
                poolMs: Date.now() - tPoolStart,
                totalMs: Date.now() - t0
            });
        }
        return attachRouteContext(attachSourceTx(poolSwap), receipt.logs, chainId);
    }

    if (hasDexIntentEvidence) {
        const inferred = inferSwapFromAnyPoolLikeAddress(receipt.logs);
        if (inferred) {
            const swap: DecodedSwap = {
                tokenIn: inferred.tokenIn,
                tokenOut: inferred.tokenOut,
                amountIn: inferred.amountIn.toString(),
                amountOut: inferred.amountOut.toString(),
                router: tx.to,
                dexName: getDexName(tx.to, chainId),
                txHash: tx.hash,
                resolvedPoolHint: {
                    kind: 'v2',
                    dex: chainId === 56 ? 'pancake' : 'aerodrome',
                    poolAddress: inferred.poolAddress
                }
            };
            if (PROFILE) {
                logger.info(LogCode.DEC_SWAP_DETECTION, '[Profile] parseSwapTransaction', {
                    tx: tx.hash?.slice(0, 12),
                    path: 'pool_like_infer',
                    totalMs: Date.now() - t0
                });
            }
            return attachRouteContext(attachSourceTx(swap), receipt.logs, chainId);
        }
    }

    const tFallbackStart = Date.now();
    const swap = decodeSwapFromLogs(receipt.logs, effectiveWallet, tx.value);
    if (!swap) {
        if (PROFILE) {
            logger.info(LogCode.DEC_SWAP_DETECTION, '[Profile] parseSwapTransaction', {
                tx: tx.hash?.slice(0, 12),
                path: 'no_swap',
                fallbackMs: Date.now() - tFallbackStart,
                totalMs: Date.now() - t0
            });
        }
        return null;
    }

    swap.router = tx.to;
    swap.dexName = hasV4Swap ? 'Uniswap v4' : getDexName(tx.to, chainId);
    swap.txHash = tx.hash;

    const NATIVE_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const chainConfig = getChainConfig(chainId);
    const WRAPPED_NATIVE = chainConfig.wrappedNativeAddress;
    if (swap.tokenIn.toLowerCase() === WRAPPED_NATIVE.toLowerCase()) {
        swap.tokenIn = NATIVE_ADDRESS;
    }
    if (swap.tokenOut.toLowerCase() === WRAPPED_NATIVE.toLowerCase()) {
        swap.tokenOut = NATIVE_ADDRESS;
    }

    if (PROFILE) {
        logger.info(LogCode.DEC_SWAP_DETECTION, '[Profile] parseSwapTransaction', {
            tx: tx.hash?.slice(0, 12),
            path: 'fallback_transfer',
            fallbackMs: Date.now() - tFallbackStart,
            totalMs: Date.now() - t0
        });
    }
    return attachRouteContext(attachSourceTx(swap), receipt.logs, chainId);
}
