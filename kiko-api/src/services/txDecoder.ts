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

// Common DEX Router method signatures
const DEX_SIGNATURES = {
    // Uniswap V2 / Sushiswap / etc
    swapExactTokensForTokens: '0x38ed1739',
    swapTokensForExactTokens: '0x8803dbee',
    swapExactETHForTokens: '0x7ff36ab5',
    swapTokensForExactETH: '0x4a25d94a',
    swapExactTokensForETH: '0x18cbafe5',
    swapETHForExactTokens: '0xfb3bdb41',

    // Uniswap V3
    exactInputSingle: '0x414bf389',
    exactOutputSingle: '0xdb3e2198',
    exactInput: '0xc04b8d59',
    exactOutput: '0xf28c0498',
    multicall: '0xac9650d8',

    // 0x Protocol
    transformERC20: '0x415565b0',
    sellToUniswap: '0xd9627aa4',
    sellToPancakeSwap: '0xd9627aa4',

    // KyberSwap
    swap: '0x12aa3caf',
    swapGeneric: '0xe21fd0e9',

    // Aerodrome / V2 Forks
    swapExactInput: '0xb80c2f09', // Often used by Aerodrome/Velodrome router proxies
};



// ERC20 Transfer event signature
const TRANSFER_EVENT = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const V2_SWAP_EVENT = '0xd78ad95fa46c994b6551d0da85fc275fe613c2f8a6a7256f1b4c5db0b03d9e10';
const V3_SWAP_EVENT = '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67';
const V4_SWAP_EVENT = ethers.id('Swap(bytes32,address,int128,int128,uint160,uint128,int24,uint24)');
const V4_INIT_EVENT = ethers.id('Initialize(bytes32,address,address,uint24,int24,address,uint160,int24)');
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
            rpcCall<string>(chainId, 'eth_call', [{ to: pool, data: token0Data }, 'latest'], { strategy: 'fast' }),
            rpcCall<string>(chainId, 'eth_call', [{ to: pool, data: token1Data }, 'latest'], { strategy: 'fast' }),
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

function normalizeCurrencyAddress(address: string): string {
    const normalized = address.toLowerCase();
    return normalized === ZERO_ADDRESS ? NATIVE_TOKEN_ADDRESS : normalized;
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
        }, 'latest'], { strategy: 'fast' });

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
            { strategy: 'fast' }
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
    chainId: number
): Promise<DecodedSwap | null> {
    let swapLog: { address: string; topics: string[]; data: string } | null = null;
    for (const log of logs) {
        if (log.topics?.[0]?.toLowerCase() === V4_SWAP_EVENT.toLowerCase()) {
            swapLog = log;
        }
    }

    if (!swapLog || !swapLog.topics || swapLog.topics.length < 2) return null;

    const poolId = swapLog.topics[1];
    const poolManager = swapLog.address;
    if (!poolId || !poolManager) return null;

    const tokens = await resolveV4PoolTokens(chainId, poolManager, poolId, logs);
    if (!tokens) return null;

    try {
        const matchedKey = matchV4PoolKeyById(
            chainId,
            poolId,
            tokens.token0,
            tokens.token1
        );

        const iface = new ethers.Interface([
            'event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)'
        ]);
        const parsed = iface.parseLog({ topics: swapLog.topics, data: swapLog.data });
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
            return null;
        }

        return {
            tokenIn,
            tokenOut,
            amountIn: amountIn.toString(),
            amountOut: amountOut.toString(),
            router: '',
            dexName: 'Uniswap v4',
            resolvedPoolHint: matchedKey ? {
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
            } : undefined
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
        if (topic0 === V3_SWAP_EVENT) {
            lastSwapLog = log;
            swapType = 'v3';
        } else if (topic0 === V2_SWAP_EVENT) {
            lastSwapLog = log;
            swapType = 'v2';
        }
    }

    if (!lastSwapLog || !swapType) return null;

    const pool = lastSwapLog.address.toLowerCase();
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
                kind: swapType,
                dex: chainId === 56 ? 'pancake' : 'uniswap',
                poolAddress: pool
            }
        };
    }

    const tokens = await getPoolTokens(chainId, pool);
    if (!tokens) return null;

    if (swapType === 'v3') {
        try {
            const iface = new ethers.Interface([
                'event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)',
            ]);
            const parsed = iface.parseLog({ topics: lastSwapLog.topics, data: lastSwapLog.data });
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
                dexName: 'V3 Pool',
                resolvedPoolHint: {
                    kind: 'v3',
                    dex: chainId === 56 ? 'pancake' : 'uniswap',
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
            const iface = new ethers.Interface([
                'event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)',
            ]);
            const parsed = iface.parseLog({ topics: lastSwapLog.topics, data: lastSwapLog.data });
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
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOut: string;
    router: string;
    dexName: string;
    resolvedPoolHint?: {
        kind: 'v4' | 'v3' | 'v2';
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
}

/**
 * Check if a transaction is a swap
 */
export function isSwapTransaction(txData: string): boolean {
    if (!txData || txData.length < 10) return false;

    const selector = txData.slice(0, 10).toLowerCase();
    return Object.values(DEX_SIGNATURES).some(sig => sig.toLowerCase() === selector);
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
 * Decode swap from transaction receipt logs
 * Uses Transfer events to determine tokens and amounts
 */
export function decodeSwapFromLogs(
    logs: Array<{ address: string; topics: string[]; data: string }>,
    walletAddress: string,
    nativeValue: string = '0'
): DecodedSwap | null {
    logger.debug(LogCode.DEC_SWAP_DETECTION, 'Decoding swap from transaction logs', {
        logCount: logs.length,
        from: walletAddress,
        nativeValue
    });

    const transfers = extractTransfersFromLogs(logs);

    logger.debug(LogCode.DEC_SWAP_DETECTION, `Found ${transfers.length} Transfer events in logs`);
    for (const t of transfers) {
        logger.debug(LogCode.DEC_SWAP_DETECTION, 'Log transfer detail', {
            token: t.token,
            from: t.from,
            to: t.to,
            amount: t.amount.toString()
        });
    }

    if (transfers.length < 1) {
        logger.debug(LogCode.DEC_SWAP_DETECTION, 'No transfer events found in logs');
        return null;
    }

    // Find token in (sent TO user's wallet) - what they BOUGHT
    // Logic: 
    // 1. Filter out transfers that are likely internal router operations (e.g. 1inch aggregator itself)
    // 2. Taking the LAST transfer usually represents the final output of the swap chain
    // 3. Filter out zero value transfers

    const incomingTransfers = transfers.filter(t => t.to.toLowerCase() === walletAddress.toLowerCase());
    logger.debug(LogCode.DEC_SWAP_DETECTION, 'Incoming transfers detected', { count: incomingTransfers.length, wallet: walletAddress });

    // Known router/system addresses to ignore as "tokens"
    const IGNORED_ADDRESSES = [
        '0xdef1c0ded9bec7f1a1670819833240f027b25eff', // 0x V4
        '0x0000000000000000000000000000000000000000', // Null
    ];

    // Identify what user RECEIVED (Result of Swap -> tokenOut) by largest incoming amount
    const incomingTotals = new Map<string, bigint>();
    for (const t of incomingTransfers) {
        if (IGNORED_ADDRESSES.includes(t.token.toLowerCase()) || t.amount <= 0n) continue;
        incomingTotals.set(t.token, (incomingTotals.get(t.token) || 0n) + t.amount);
    }
    const tokenReceived = [...incomingTotals.entries()]
        .sort((a, b) => (b[1] > a[1] ? 1 : -1))[0];

    // Identify what user SENT (Source of Swap -> tokenIn) by largest outgoing amount
    const outgoingTransfers = transfers.filter(t => t.from.toLowerCase() === walletAddress.toLowerCase());
    const outgoingTotals = new Map<string, bigint>();
    for (const t of outgoingTransfers) {
        if (IGNORED_ADDRESSES.includes(t.token.toLowerCase()) || t.amount <= 0n) continue;
        outgoingTotals.set(t.token, (outgoingTotals.get(t.token) || 0n) + t.amount);
    }
    const tokenSent = [...outgoingTotals.entries()]
        .sort((a, b) => (b[1] > a[1] ? 1 : -1))[0];
    let tokenSentAddress = tokenSent?.[0];
    let amountSent = tokenSent?.[1]?.toString();

    logger.debug(LogCode.DEC_SWAP_DETECTION, 'Transaction logic analysis', {
        received: tokenReceived?.[0],
        sent: tokenSentAddress
    });

    // Handle Native ETH Sent case (User sent ETH, so no outgoing Transfer event)
    if (!tokenSent && BigInt(nativeValue) > 0) {
        logger.debug(LogCode.DEC_SWAP_DETECTION, 'No outgoing token transfer found but native value present; assuming native asset input');
        tokenSentAddress = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'; // Native ETH placeholder
        amountSent = nativeValue;
    }

    // FALLBACK: If we found a valid tokenSent (SELL) but no tokenReceived
    // This happens when the tokenSent goes to a proxy, and the ETH/Result comes back via internal tx (often not logged as Transfer if Native ETH)
    // If we detected a SELL (Token Out from Wallet) but no Token In:
    if (tokenSentAddress && !tokenReceived) {
        logger.debug(LogCode.DEC_SWAP_DETECTION, 'Found source token but no incoming transfer; assuming native asset output');
        return {
            tokenIn: tokenSentAddress, // What user sent
            tokenOut: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', // Result is ETH
            amountIn: amountSent || '0',
            amountOut: '0', // Unknown
            router: '',
            dexName: '',
        };
    }

    if (!tokenReceived || !tokenSentAddress || !amountSent) {
        logger.debug(LogCode.DEC_SWAP_DETECTION, 'Decoding failed: missing required swap fields', {
            hasReceived: !!tokenReceived,
            hasSent: !!tokenSentAddress,
            hasAmount: !!amountSent
        });
        return null;
    }
    if (tokenReceived[0].toLowerCase() === tokenSentAddress.toLowerCase()) {
        logger.debug(LogCode.DEC_SWAP_DETECTION, 'Decoded same token in/out; falling back to other decoders', {
            token: tokenSentAddress
        });
        return null;
    }

    // Standard Case: User Sent A, Received B
    // tokenIn = What Sent (Source)
    // tokenOut = What Received (Result)
    // Standard Case: User Sent A, Received B
    // tokenIn = What Sent (Source)
    // tokenOut = What Received (Result)
    logger.info(LogCode.DEC_SUCCESS, 'Swap successfully decoded from logs', {
        tokenIn: tokenSentAddress,
        tokenOut: tokenReceived[0]
    });
    logger.debug(LogCode.DEC_SUCCESS, 'Decoded swap values', {
        amountIn: amountSent,
        amountOut: tokenReceived[1].toString()
    });

    return {
        tokenIn: tokenSentAddress,
        tokenOut: tokenReceived[0],
        amountIn: amountSent,
        amountOut: tokenReceived[1].toString(),
        router: '',
        dexName: '',
    };
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

    const v4SwapTopic = V4_SWAP_EVENT.toLowerCase();
    const hasV4Swap = receipt.logs.some((log) => log.topics?.[0]?.toLowerCase() === v4SwapTopic);

    // Cache Pancake Infinity pool keys (non-blocking)
    cacheInfinityPoolKeysFromLogs(receipt.logs, chainId);

    // 1) Prefer transfer-based decode for the target wallet (wallet perspective)
    const tTransferStart = Date.now();
    const transferSwap = decodeSwapFromLogs(receipt.logs, effectiveWallet, tx.value);
    if (transferSwap) {
        if (hasV4Swap) {
            const hintedV4 = await decodeSwapFromV4Events(receipt.logs, chainId);
            if (hintedV4?.resolvedPoolHint) {
                transferSwap.resolvedPoolHint = hintedV4.resolvedPoolHint;
            }
        }
        transferSwap.router = tx.to;
        transferSwap.dexName = hasV4Swap ? 'Uniswap v4' : getDexName(tx.to, chainId);
        transferSwap.txHash = tx.hash;
        // Normalize Wrapped Native to Native for display
        const NATIVE_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
        const chainConfig = getChainConfig(chainId);
        const WRAPPED_NATIVE = chainConfig.wrappedNativeAddress;
        if (transferSwap.tokenIn.toLowerCase() === WRAPPED_NATIVE.toLowerCase()) {
            transferSwap.tokenIn = NATIVE_ADDRESS;
        }
        if (transferSwap.tokenOut.toLowerCase() === WRAPPED_NATIVE.toLowerCase()) {
            transferSwap.tokenOut = NATIVE_ADDRESS;
        }
        if (PROFILE) {
            logger.info(LogCode.DEC_SWAP_DETECTION, '[Profile] parseSwapTransaction', {
                tx: tx.hash?.slice(0, 12),
                path: 'transfer_logs',
                transferMs: Date.now() - tTransferStart,
                totalMs: Date.now() - t0
            });
        }
        return transferSwap;
    }

    // 2) If V4 swap exists, decode from V4 events as fallback
    if (hasV4Swap) {
        const tV4Start = Date.now();
        const v4Swap = await decodeSwapFromV4Events(receipt.logs, chainId);
        if (v4Swap) {
            v4Swap.router = tx.to;
            v4Swap.txHash = tx.hash;
            // Normalize wrapped native to native for display and downstream direction checks.
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
            return v4Swap;
        }
    }

    // 3) Pool Swap events (V2/V3)
    const tPoolStart = Date.now();
    const poolSwap = await decodeSwapFromPoolEvents(receipt.logs, chainId);
    if (poolSwap) {
        poolSwap.router = tx.to;
        const routerDex = getDexName(tx.to, chainId);
        poolSwap.dexName = routerDex !== 'Unknown DEX' ? routerDex : poolSwap.dexName;
        poolSwap.txHash = tx.hash;
        // Normalize wrapped native to native for display
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
        return poolSwap;
    }

    // OLD: Check if it's a swap transaction based on method signature
    // This was too strict - many DEXes use custom methods
    // if (!isSwapTransaction(tx.input)) return null;

    // NEW: Just try to decode from logs - if there are valid transfers, it's a swap
    // This approach works with ANY DEX, aggregator, or custom router

    // Decode from logs, PASSING tx.value
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

    // Add router info
    swap.router = tx.to;
    swap.dexName = hasV4Swap ? 'Uniswap v4' : getDexName(tx.to, chainId);
    swap.txHash = tx.hash;

    // Handle native ETH
    const NATIVE_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const chainConfig = getChainConfig(chainId);
    const WRAPPED_NATIVE = chainConfig.wrappedNativeAddress;

    // If value > 0, user sent Native Token (e.g. Buying something with BNB)
    // We do NOT override tokenOut here. tokenOut is determined by what was RECEIVED (Logs).
    // tokenIn is already handled in decodeSwapFromLogs or by assuming Native input if no outgoing transfer.

    // Logic was:
    // if (BigInt(tx.value) > 0) {
    //    swap.tokenOut = NATIVE_ADDRESS;
    //    swap.amountOut = tx.value;
    // }
    // This was WRONG for BUYs. Removing it.

    // However, if we detected it was a swap where we couldn't find tokenOut from logs,
    // AND it was a simple send, it wouldn't be here.
    // We already handled "Native Sent" in decodeSwapFromLogs:
    // "No tokenSent found but nativeValue > 0, assuming User SENT ETH/BNB" -> tokenIn = Native.


    // Normalize Wrapped Native to Native for display
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
    return swap;
}
