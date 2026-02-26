import { ethers } from 'ethers';
import { logger } from '../../../../utils/logger.js';
import { LogCode } from '../../../../config/logRegistry.js';
import { findV4Pools, calculatePriceFromSqrtX96, V4PoolInfo, V4PoolKey } from '../../uniswapV4.js';
import { isV4SwapSupported } from '../../uniswapV4Swap.js';
import { callRpc as callRpcBase, callRpcRaw as callRpcRawBase } from '../../../rpcManager.js';
import { getKyberQuote } from '../../../kyberAggregator.js';
import { getTokenDetails } from '../../../geckoTerminal.js';
import { getTokenDecimals, getTokenMetadata } from '../../../rpcService.js';
import { get as getDbCache } from '../../../../cache/dbCache.js';
import { get as cacheGet, set as cacheSet } from '../../../../cache/cacheClient.js';
import { V2_ROUTER_ABI, V3_FEE_TIERS } from '../../types.js';
import { buildAerodromeSwapTransaction, getAerodromeQuote } from '../../aerodrome.js';
import { buildV4HookDataCandidates, resolveV4HookProfile } from '../../v4Hooks.js';
import { SelectedV4Pool } from '../../v4ExecutionPlan.js';
import { zoraService } from '../../../zoraService.js';
import {
  resolveHintedV4PoolFromSwapSupply as resolveHintedV4PoolFromSourceTx
} from '../supplyParser.js';
import type { DirectSwapHint } from '../../directSwapTypes.js';
import type { ReferenceQuoteDiagnostics } from '../types.js';
import {
  DOPPLER_LENS_QUOTER_ADDRESSES,
  UNISWAP_V4_POOL_MANAGER_BY_CHAIN,
  V4_QUOTER_ADDRESSES
} from '../constants.js';
import {
  buildReferenceQuoteCacheKey,
  buildSharedExternalReferenceQuoteCacheKey,
  pickBestReferenceQuote
} from '../referenceQuote.js';
import {
  getSharedExternalReferenceQuote,
  setSharedExternalReferenceQuote,
  referenceQuoteCache,
  referenceQuoteRedisKey,
  sharedExternalReferenceQuoteInflight,
  v4QuoterCache,
  v4QuoterRedisKey,
  v4SpotCache,
  v4SpotRedisKey,
  withInflightSingleflight
} from '../cache.js';
import {
  createZoraQuoteWithRetry,
  get0xExpectedOutput,
  getZoraSdkExpectedOutput
} from './extraExecutors.js';

const WETH_ADDRESSES: Record<number, string> = {
  8453: '0x4200000000000000000000000000000000000006',
  1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  56: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'
};

const ZORA_TOKEN_ADDRESSES: Record<number, string> = {
  8453: '0x1111111111166b7fe7bd91427724b487980afc69'
};

const VIRTUAL_TOKEN_ADDRESSES: Record<number, string> = {
  8453: '0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b'
};

const V3_QUOTER_V2: Record<number, string> = {
  1: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
  8453: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
  42161: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
  10: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
  137: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e'
};

const v3QuoterInterface = new ethers.Interface([
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)'
]);

const v2RouterInterface = new ethers.Interface(V2_ROUTER_ABI);
const infinityQuoterInterface = new ethers.Interface([
  'function quoteExactInputSingle((tuple(address currency0,address currency1,address hooks,address poolManager,uint24 fee,bytes32 parameters),bool zeroForOne,uint128 exactAmount,bytes hookData) params) returns (uint256 amountOut, uint256 gasEstimate)'
]);

const V2_ROUTERS: Record<number, string> = {
  1: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
  8453: '0x4752ba5Dbc23f44D87826276BF6Fd6b1C372aD24',
  56: '0x10ED43C718714eb63d5aA57B78B54704E256024E'
};

const PANCAKE_V3_QUOTER = '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997';
const PANCAKE_V3_FEE_TIERS = [100, 500, 2500, 10000] as const;

const PANCAKE_INFINITY_CL_POOL_MANAGER = '0xa0FfB9c1CE1Fe56963B0321B32E7A0302114058b';
const PANCAKE_INFINITY_BIN_POOL_MANAGER = '0xC697d2898e0D09264376196696c51D7aBbbAA4a9';
const PANCAKE_INFINITY_CL_QUOTER = '0xd0737C9762912dD34c3271197E362Aa736Df0926';
const PANCAKE_INFINITY_BIN_QUOTER = '0xC631f4B0Fc2Dd68AD45f74B2942628db117dD359';

const INFINITY_CL_FEE_TIERS = [100, 500, 2500, 10000] as const;
const INFINITY_CL_TICK_SPACING_BY_FEE: Record<number, number> = {
  100: 1,
  500: 10,
  2500: 50,
  10000: 200
};
const INFINITY_BIN_STEPS = [1, 5, 10, 20, 25, 50, 100] as const;
const INFINITY_HOOKS_ZERO = '0x0000000000000000000000000000000000000000';

const V4_SPOT_CACHE_TTL_MS = Number(process.env.V4_SPOT_CACHE_TTL_MS || '15000');
const V4_QUOTER_CACHE_TTL_MS = Number(process.env.V4_QUOTER_CACHE_TTL_MS || '10000');
const V4_QUOTER_TIMEOUT_MS = Number(process.env.V4_QUOTER_TIMEOUT_MS || '1200');
const REFERENCE_QUOTE_TTL_MS = Number(process.env.DIRECT_SWAP_REF_CACHE_TTL_MS || '10000');
const REFERENCE_QUOTE_TIMEOUT_MS = Number(process.env.DIRECT_SWAP_REF_TIMEOUT_MS || '2000');
const REFERENCE_SHARED_EXTERNAL_TTL_MS = Number(process.env.DIRECT_SWAP_REF_SHARED_TTL_MS || String(REFERENCE_QUOTE_TTL_MS));
const REFERENCE_SHARED_EXTERNAL_NEGATIVE_TTL_MS = Number(process.env.DIRECT_SWAP_REF_SHARED_NEGATIVE_TTL_MS || '1500');
const ZORA_QUOTE_TIMEOUT_MS = Number(process.env.DIRECT_SWAP_ZORA_TIMEOUT_MS || '5000');
const ZORA_REFERENCE_TIMEOUT_MS = Number(process.env.DIRECT_SWAP_ZORA_REFERENCE_TIMEOUT_MS || '500');
const ZORA_RETRY_COUNT = Number(process.env.DIRECT_SWAP_ZORA_RETRY_COUNT || '1');

const infinityPairCache = new Map<string, { poolKeys: InfinityPoolKey[]; timestamp: number }>();

type DirectSwapRpcOptions = {
  strategy?: 'fast' | 'cheap';
  importance?: 'normal' | 'critical';
  exhaustiveFailover?: boolean;
};

async function callRpc<T = any>(
  chainIdOrName: number | string,
  method: string,
  params: any = [],
  options: DirectSwapRpcOptions = {}
): Promise<T> {
  return callRpcBase<T>(chainIdOrName, method, params, {
    strategy: options.strategy || 'fast',
    importance: options.importance || 'critical',
    exhaustiveFailover: options.exhaustiveFailover ?? true
  });
}

async function callRpcRaw<T = any>(
  chainIdOrName: number | string,
  method: string,
  params: any = [],
  options: DirectSwapRpcOptions = {}
): Promise<any> {
  return callRpcRawBase<T>(chainIdOrName, method, params, {
    strategy: options.strategy || 'fast',
    importance: options.importance || 'critical',
    exhaustiveFailover: options.exhaustiveFailover ?? true
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout_${ms}ms`)), ms);
    promise.then(val => {
      clearTimeout(timer);
      resolve(val);
    }).catch(err => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function withAbortableTimeout<T>(
  runner: (signal: AbortSignal) => Promise<T>,
  ms: number
): Promise<T> {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      runner(controller.signal),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error(`timeout_${ms}ms`));
        }, ms);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function getV2ExpectedOutput(
    tokenIn: string,
    tokenOut: string,
    amountInWei: bigint,
    chainId: number,
    deps?: {
        callRpcFn?: typeof callRpc;
    }
): Promise<bigint> {
    const router = V2_ROUTERS[chainId];
    if (!router) return 0n;

    const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const weth = WETH_ADDRESSES[chainId];
    if (!weth) return 0n;

    const normalizedIn = tokenIn.toLowerCase() === ETH_ADDRESS ? weth : tokenIn;
    const normalizedOut = tokenOut.toLowerCase() === ETH_ADDRESS ? weth : tokenOut;

    try {
        const callData = v2RouterInterface.encodeFunctionData('getAmountsOut', [amountInWei, [normalizedIn, normalizedOut]]);
        const rpc = deps?.callRpcFn ?? callRpc;
        const result = await rpc<string>(chainId, 'eth_call', [{
            to: router,
            data: callData
        }, 'latest']);
        if (!result || result === '0x') return 0n;
        const decoded = v2RouterInterface.decodeFunctionResult('getAmountsOut', result);
        const amounts = decoded[0] as bigint[];
        return amounts[amounts.length - 1] || 0n;
    } catch {
        return 0n;
    }
}

export async function getV3BestQuoteOut(
    tokenIn: string,
    tokenOut: string,
    amountInWei: bigint,
    chainId: number,
    dex: 'uniswap' | 'pancake',
    deps?: {
        callRpcFn?: typeof callRpc;
    }
): Promise<bigint> {
    const quoter = dex === 'pancake' ? PANCAKE_V3_QUOTER : V3_QUOTER_V2[chainId];
    if (!quoter) return 0n;

    const feeTiers = dex === 'pancake' ? PANCAKE_V3_FEE_TIERS : V3_FEE_TIERS;
    const rpc = deps?.callRpcFn ?? callRpc;

    // 所有 fee tier 并行查询，不再串行等待
    const results = await Promise.all(
        feeTiers.map(async (fee) => {
            try {
                const quoteParams = {
                    tokenIn,
                    tokenOut,
                    amountIn: amountInWei,
                    fee,
                    sqrtPriceLimitX96: 0
                };
                const callData = v3QuoterInterface.encodeFunctionData('quoteExactInputSingle', [quoteParams]);
                const result = await rpc<string>(chainId, 'eth_call', [{
                    to: quoter,
                    data: callData
                }, 'latest']);
                if (!result || result === '0x') return 0n;
                const decoded = v3QuoterInterface.decodeFunctionResult('quoteExactInputSingle', result);
                return decoded[0] as bigint;
            } catch {
                return 0n;
            }
        })
    );

    return results.reduce((best, cur) => (cur > best ? cur : best), 0n);
}

export interface V3BridgeQuote {
    amountOut: bigint;
    feeInToBridge: number;
    feeBridgeToOut: number;
}

export async function getV3BridgeQuoteOut(
    tokenIn: string,
    bridgeToken: string,
    tokenOut: string,
    amountInWei: bigint,
    chainId: number,
    dex: 'uniswap' | 'pancake',
    deps?: {
        callRpcFn?: typeof callRpc;
    }
): Promise<V3BridgeQuote | null> {
    const quoter = dex === 'pancake' ? PANCAKE_V3_QUOTER : V3_QUOTER_V2[chainId];
    if (!quoter) return null;

    const feeTiers = dex === 'pancake' ? PANCAKE_V3_FEE_TIERS : V3_FEE_TIERS;
    const rpc = deps?.callRpcFn ?? callRpc;
    let best: V3BridgeQuote | null = null;

    for (const fee1 of feeTiers) {
        let hop1Out = 0n;
        try {
            const params1 = {
                tokenIn,
                tokenOut: bridgeToken,
                amountIn: amountInWei,
                fee: fee1,
                sqrtPriceLimitX96: 0
            };
            const data1 = v3QuoterInterface.encodeFunctionData('quoteExactInputSingle', [params1]);
            const res1 = await rpc<string>(chainId, 'eth_call', [{ to: quoter, data: data1 }, 'latest']);
            if (res1 && res1 !== '0x') {
                const decoded1 = v3QuoterInterface.decodeFunctionResult('quoteExactInputSingle', res1);
                hop1Out = decoded1[0] as bigint;
            }
        } catch {
            hop1Out = 0n;
        }
        if (hop1Out <= 0n) continue;

        for (const fee2 of feeTiers) {
            try {
                const params2 = {
                    tokenIn: bridgeToken,
                    tokenOut,
                    amountIn: hop1Out,
                    fee: fee2,
                    sqrtPriceLimitX96: 0
                };
                const data2 = v3QuoterInterface.encodeFunctionData('quoteExactInputSingle', [params2]);
                const res2 = await rpc<string>(chainId, 'eth_call', [{ to: quoter, data: data2 }, 'latest']);
                if (!res2 || res2 === '0x') continue;
                const decoded2 = v3QuoterInterface.decodeFunctionResult('quoteExactInputSingle', res2);
                const out = decoded2[0] as bigint;
                if (!best || out > best.amountOut) {
                    best = {
                        amountOut: out,
                        feeInToBridge: fee1,
                        feeBridgeToOut: fee2
                    };
                }
            } catch {
                continue;
            }
        }
    }

    return best;
}

const MAX_UINT128 = (1n << 128n) - 1n;

type InfinityPoolKind = 'cl' | 'bin';

interface InfinityPoolKey {
    currency0: string;
    currency1: string;
    hooks: string;
    poolManager: string;
    fee: number;
    parameters: string;
}

export interface InfinityBestQuote {
    amountOut: bigint;
    poolKey: InfinityPoolKey;
    zeroForOne: boolean;
    kind: InfinityPoolKind;
    fee: number;
    tickSpacing?: number;
    binStep?: number;
}

function sortCurrencies(tokenIn: string, tokenOut: string): { currency0: string; currency1: string; zeroForOne: boolean } {
    const a = ethers.getAddress(tokenIn);
    const b = ethers.getAddress(tokenOut);
    const aNum = BigInt(a.toLowerCase());
    const bNum = BigInt(b.toLowerCase());
    if (aNum < bNum) {
        return { currency0: a, currency1: b, zeroForOne: a.toLowerCase() === tokenIn.toLowerCase() };
    }
    return { currency0: b, currency1: a, zeroForOne: b.toLowerCase() === tokenIn.toLowerCase() };
}

function encodeInfinityParameters(rawValue: number): string {
    const value = BigInt(rawValue) << 16n;
    return ethers.zeroPadValue(ethers.toBeHex(value), 32);
}

function buildInfinityPoolKey(
    tokenIn: string,
    tokenOut: string,
    poolManager: string,
    fee: number,
    parameters: string
): { poolKey: InfinityPoolKey; zeroForOne: boolean } {
    const { currency0, currency1, zeroForOne } = sortCurrencies(tokenIn, tokenOut);
    return {
        poolKey: {
            currency0,
            currency1,
            hooks: INFINITY_HOOKS_ZERO,
            poolManager,
            fee,
            parameters
        },
        zeroForOne
    };
}

function buildInfinityPairKey(chainId: number, tokenA: string, tokenB: string): string {
    const a = ethers.getAddress(tokenA).toLowerCase();
    const b = ethers.getAddress(tokenB).toLowerCase();
    const [t0, t1] = a < b ? [a, b] : [b, a];
    return `infi:pair:${chainId}:${t0}:${t1}`;
}

async function loadInfinityPoolKeys(
    chainId: number,
    tokenIn: string,
    tokenOut: string
): Promise<InfinityPoolKey[]> {
    const pairKey = buildInfinityPairKey(chainId, tokenIn, tokenOut);
    const cached = infinityPairCache.get(pairKey);
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
        return cached.poolKeys;
    }

    const poolIdsRaw = await getDbCache(pairKey);
    if (!poolIdsRaw) return [];
    let poolIds: string[] = [];
    try {
        poolIds = JSON.parse(poolIdsRaw);
    } catch {
        return [];
    }
    if (!poolIds.length) return [];

    const poolKeys: InfinityPoolKey[] = [];
    for (const poolId of poolIds) {
        const poolKeyRaw = await getDbCache(`infi:poolkey:${chainId}:${poolId}`);
        if (!poolKeyRaw) continue;
        try {
            const parsed = JSON.parse(poolKeyRaw) as InfinityPoolKey;
            if (parsed.currency0 && parsed.currency1) {
                poolKeys.push({
                    currency0: parsed.currency0.toLowerCase(),
                    currency1: parsed.currency1.toLowerCase(),
                    hooks: parsed.hooks.toLowerCase(),
                    poolManager: parsed.poolManager.toLowerCase(),
                    fee: parsed.fee,
                    parameters: parsed.parameters
                });
            }
        } catch {
            continue;
        }
    }

    if (poolKeys.length) {
        infinityPairCache.set(pairKey, { poolKeys, timestamp: Date.now() });
    }
    return poolKeys;
}

function parseInfinityParameterValue(parameters: string): number {
    try {
        const raw = BigInt(parameters);
        const value = Number((raw >> 16n) & 0xffffn);
        return value;
    } catch {
        return 0;
    }
}

async function quoteInfinityExactInputSingle(
    quoter: string,
    params: {
        poolKey: InfinityPoolKey;
        zeroForOne: boolean;
        amountIn: bigint;
    },
    chainId: number
): Promise<bigint> {
    if (params.amountIn <= 0n || params.amountIn > MAX_UINT128) return 0n;
    try {
        const callData = infinityQuoterInterface.encodeFunctionData('quoteExactInputSingle', [{
            poolKey: params.poolKey,
            zeroForOne: params.zeroForOne,
            exactAmount: params.amountIn,
            hookData: '0x'
        }]);
        const result = await callRpc<string>(chainId, 'eth_call', [{
            to: quoter,
            data: callData
        }, 'latest']);
        if (!result || result === '0x') return 0n;
        const decoded = infinityQuoterInterface.decodeFunctionResult('quoteExactInputSingle', result);
        const amountOut = decoded[0] as bigint;
        return amountOut;
    } catch {
        return 0n;
    }
}

export async function getInfinityBestQuoteOut(
    tokenIn: string,
    tokenOut: string,
    amountInWei: bigint,
    chainId: number
): Promise<InfinityBestQuote | null> {
    if (chainId !== 56) return null;
    const weth = WETH_ADDRESSES[chainId];
    if (!weth) return null;

    const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const normalizedIn = tokenIn.toLowerCase() === ETH_ADDRESS ? weth : tokenIn;
    const normalizedOut = tokenOut.toLowerCase() === ETH_ADDRESS ? weth : tokenOut;

    // Fast path: cached pool keys — 并行 quote
    const cachedPoolKeys = await loadInfinityPoolKeys(chainId, normalizedIn, normalizedOut);
    if (cachedPoolKeys.length) {
        logger.info(LogCode.SYS_INFO, '[DirectSwap] Infinity cache hit', {
            chainId,
            tokenIn: normalizedIn.slice(0, 10),
            tokenOut: normalizedOut.slice(0, 10),
            poolKeyCount: cachedPoolKeys.length
        });
        const cachedResults = await Promise.all(
            cachedPoolKeys.map(async (poolKey) => {
                const zeroForOne = poolKey.currency0.toLowerCase() === normalizedIn.toLowerCase();
                const isCl = poolKey.poolManager.toLowerCase() === PANCAKE_INFINITY_CL_POOL_MANAGER.toLowerCase();
                const quoter = isCl ? PANCAKE_INFINITY_CL_QUOTER : PANCAKE_INFINITY_BIN_QUOTER;
                const amountOut = await quoteInfinityExactInputSingle(
                    quoter,
                    { poolKey, zeroForOne, amountIn: amountInWei },
                    chainId
                );
                if (amountOut <= 0n) return null;
                return {
                    amountOut,
                    poolKey,
                    zeroForOne,
                    kind: (isCl ? 'cl' : 'bin') as 'cl' | 'bin',
                    fee: poolKey.fee,
                    tickSpacing: isCl ? parseInfinityParameterValue(poolKey.parameters) : undefined,
                    binStep: isCl ? undefined : parseInfinityParameterValue(poolKey.parameters)
                } satisfies InfinityBestQuote;
            })
        );
        const bestCached = cachedResults.reduce<InfinityBestQuote | null>((best, cur) => {
            if (!cur) return best;
            return !best || cur.amountOut > best.amountOut ? cur : best;
        }, null);
        if (bestCached) return bestCached;
    }

    // Discovery path: CL fees + Bin fees×steps — 全部并行
    const clCandidates: Array<{ fee: number; tickSpacing: number; parameters: string }> = [];
    for (const fee of INFINITY_CL_FEE_TIERS) {
        const tickSpacing = INFINITY_CL_TICK_SPACING_BY_FEE[fee];
        if (tickSpacing) clCandidates.push({ fee, tickSpacing, parameters: encodeInfinityParameters(tickSpacing) });
    }

    const binCandidates: Array<{ fee: number; binStep: number; parameters: string }> = [];
    for (const fee of INFINITY_CL_FEE_TIERS) {
        for (const binStep of INFINITY_BIN_STEPS) {
            binCandidates.push({ fee, binStep, parameters: encodeInfinityParameters(binStep) });
        }
    }

    const [clResults, binResults] = await Promise.all([
        Promise.all(clCandidates.map(async ({ fee, tickSpacing, parameters }) => {
            const { poolKey, zeroForOne } = buildInfinityPoolKey(
                normalizedIn, normalizedOut, PANCAKE_INFINITY_CL_POOL_MANAGER, fee, parameters
            );
            const amountOut = await quoteInfinityExactInputSingle(
                PANCAKE_INFINITY_CL_QUOTER, { poolKey, zeroForOne, amountIn: amountInWei }, chainId
            );
            if (amountOut <= 0n) return null;
            return { amountOut, poolKey, zeroForOne, kind: 'cl' as const, fee, tickSpacing };
        })),
        Promise.all(binCandidates.map(async ({ fee, binStep, parameters }) => {
            const { poolKey, zeroForOne } = buildInfinityPoolKey(
                normalizedIn, normalizedOut, PANCAKE_INFINITY_BIN_POOL_MANAGER, fee, parameters
            );
            const amountOut = await quoteInfinityExactInputSingle(
                PANCAKE_INFINITY_BIN_QUOTER, { poolKey, zeroForOne, amountIn: amountInWei }, chainId
            );
            if (amountOut <= 0n) return null;
            return { amountOut, poolKey, zeroForOne, kind: 'bin' as const, fee, binStep };
        }))
    ]);

    const all: InfinityBestQuote[] = [
        ...clResults.filter((r): r is NonNullable<typeof r> => r !== null),
        ...binResults.filter((r): r is NonNullable<typeof r> => r !== null)
    ];
    if (all.length === 0) return null;
    return all.reduce((best, cur) => cur.amountOut > best.amountOut ? cur : best);
}

async function getV4BestSpotOut(
    tokenIn: string,
    tokenOut: string,
    amountInWei: bigint,
    chainId: number
): Promise<bigint> {
    const cacheKey = `${chainId}:${tokenIn.toLowerCase()}:${tokenOut.toLowerCase()}:${amountInWei.toString()}`;
    const cached = v4SpotCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < V4_SPOT_CACHE_TTL_MS) {
        return cached.value;
    }
    const redisCached = await cacheGet(v4SpotRedisKey(cacheKey)).catch(() => null);
    if (redisCached) {
        try {
            const parsed = JSON.parse(redisCached) as { value: string; timestamp: number };
            if (Date.now() - parsed.timestamp < V4_SPOT_CACHE_TTL_MS) {
                const value = BigInt(parsed.value);
                v4SpotCache.set(cacheKey, { value, timestamp: parsed.timestamp });
                return value;
            }
        } catch {
            // ignore parse errors
        }
    }

    try {
        const best = await getV4BestPoolQuote(tokenIn, tokenOut, amountInWei, chainId);
        v4SpotCache.set(cacheKey, { value: best.amountOut, timestamp: Date.now() });
        await cacheSet(
            v4SpotRedisKey(cacheKey),
            JSON.stringify({ value: best.amountOut.toString(), timestamp: Date.now() }),
            Math.max(1, Math.ceil(V4_SPOT_CACHE_TTL_MS / 1000))
        ).catch(() => { });
        return best.amountOut;
    } catch {
        return 0n;
    }
}

function getV4QuoterAddress(chainId: number): string | undefined {
    return V4_QUOTER_ADDRESSES[chainId];
}

function decodeV4QuoterRevert(data: string): bigint | null {
    if (!data || data === '0x') return null;
    const selector = ethers.id('QuoteSwap(uint256)').slice(0, 10);
    if (!data.startsWith(selector)) return null;
    try {
        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['uint256'], '0x' + data.slice(10));
        return BigInt(decoded[0].toString());
    } catch {
        return null;
    }
}

async function callDopplerLensQuote(
    poolKey: V4PoolKey,
    zeroForOne: boolean,
    amountInWei: bigint,
    chainId: number,
    hookData: string
): Promise<bigint> {
    const lens = DOPPLER_LENS_QUOTER_ADDRESSES[chainId];
    const poolManager = UNISWAP_V4_POOL_MANAGER_BY_CHAIN[chainId];
    if (!lens || !poolManager) return 0n;

    const iface = new ethers.Interface([
        'function quoteDopplerLensData(address poolManager,(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,bool zeroForOne,int256 amountSpecified,bytes hookData) external returns ((int128 amount0,int128 amount1) delta,uint160 sqrtPriceX96After)'
    ]);

    const data = iface.encodeFunctionData('quoteDopplerLensData', [
        poolManager,
        {
            currency0: poolKey.currency0,
            currency1: poolKey.currency1,
            fee: poolKey.fee,
            tickSpacing: poolKey.tickSpacing,
            hooks: poolKey.hooks
        },
        zeroForOne,
        amountInWei,
        hookData
    ]);

    const response = await withTimeout(
        callRpcRaw<any>(chainId, 'eth_call', [{ to: lens, data }, 'latest'], { strategy: 'fast', importance: 'critical' }),
        V4_QUOTER_TIMEOUT_MS
    ).catch(() => null);
    if (!response?.result) return 0n;

    try {
        const decoded = iface.decodeFunctionResult('quoteDopplerLensData', response.result) as any;
        const delta = decoded?.[0];
        if (!delta) return 0n;
        const amount0 = BigInt(delta.amount0?.toString?.() ?? delta[0]?.toString?.() ?? '0');
        const amount1 = BigInt(delta.amount1?.toString?.() ?? delta[1]?.toString?.() ?? '0');
        const out = zeroForOne ? (amount1 < 0n ? -amount1 : 0n) : (amount0 < 0n ? -amount0 : 0n);
        return out > 0n ? out : 0n;
    } catch {
        return 0n;
    }
}

export async function callV4QuoterExactOut(
    poolKey: V4PoolKey,
    zeroForOne: boolean,
    amountInWei: bigint,
    chainId: number,
    payee?: string,
    gasPriceWei?: bigint,
    hookDataCandidatesOverride?: string[]
): Promise<bigint> {
    const quoter = getV4QuoterAddress(chainId);
    if (!quoter) return 0n;
    const MAX_UINT128 = (1n << 128n) - 1n;
    if (amountInWei <= 0n || amountInWei > MAX_UINT128) return 0n;

    const hookProfile = resolveV4HookProfile(chainId, poolKey.hooks);
    const isClanker = hookProfile.family === 'clanker';
    if (isClanker && !payee) return 0n;

    const payeeKey = isClanker && payee ? payee.toLowerCase() : 'nopayee';
    const gasKey = isClanker && gasPriceWei ? gasPriceWei.toString() : 'nogas';
    const cacheKey = `${chainId}:${poolKey.currency0.toLowerCase()}:${poolKey.currency1.toLowerCase()}:${poolKey.fee}:${poolKey.tickSpacing}:${poolKey.hooks.toLowerCase()}:${zeroForOne ? '1' : '0'}:${amountInWei.toString()}:${payeeKey}:${gasKey}`;
    const cached = v4QuoterCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < V4_QUOTER_CACHE_TTL_MS) {
        return cached.value;
    }
    const redisCached = await cacheGet(v4QuoterRedisKey(cacheKey)).catch(() => null);
    if (redisCached) {
        try {
            const parsed = JSON.parse(redisCached) as { value: string; timestamp: number };
            if (Date.now() - parsed.timestamp < V4_QUOTER_CACHE_TTL_MS) {
                const value = BigInt(parsed.value);
                v4QuoterCache.set(cacheKey, { value, timestamp: parsed.timestamp });
                return value;
            }
        } catch {
            // ignore parse errors
        }
    }

    const iface = new ethers.Interface([
        'function quoteExactInputSingle((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,bool zeroForOne,uint128 exactAmount,bytes hookData) external returns (uint256 amountOut,uint256 gasEstimate)'
    ]);

    const hookDataCandidates = (hookDataCandidatesOverride && hookDataCandidatesOverride.length > 0)
        ? hookDataCandidatesOverride
        : buildV4HookDataCandidates({
            chainId,
            hookAddress: poolKey.hooks,
            walletAddress: payee,
            stage: 'quote'
        });
    const gasPriceCandidates: Array<bigint | undefined> = gasPriceWei && gasPriceWei > 0n
        ? [gasPriceWei, undefined]
        : [undefined];

    for (const hookData of hookDataCandidates) {
        if (hookProfile.family === 'doppler') {
            const dopplerOut = await callDopplerLensQuote(poolKey, zeroForOne, amountInWei, chainId, hookData);
            if (dopplerOut > 0n) {
                v4QuoterCache.set(cacheKey, { value: dopplerOut, timestamp: Date.now() });
                await cacheSet(
                    v4QuoterRedisKey(cacheKey),
                    JSON.stringify({ value: dopplerOut.toString(), timestamp: Date.now() }),
                    Math.max(1, Math.ceil(V4_QUOTER_CACHE_TTL_MS / 1000))
                ).catch(() => { });
                return dopplerOut;
            }
        }

        const data = iface.encodeFunctionData('quoteExactInputSingle', [
            {
                currency0: poolKey.currency0,
                currency1: poolKey.currency1,
                fee: poolKey.fee,
                tickSpacing: poolKey.tickSpacing,
                hooks: poolKey.hooks
            },
            zeroForOne,
            amountInWei,
            hookData
        ]);

        for (const gasCandidate of gasPriceCandidates) {
            const callParams: Record<string, any> = { to: quoter, data };
            if (gasCandidate && gasCandidate > 0n) {
                callParams.gasPrice = ethers.toQuantity(gasCandidate);
            }
            try {
                const response = await withTimeout(
                    callRpcRaw<any>(chainId, 'eth_call', [callParams, 'latest'], { strategy: 'fast', importance: 'critical' }),
                    V4_QUOTER_TIMEOUT_MS
                );

                if (response?.result) {
                    const decoded = iface.decodeFunctionResult('quoteExactInputSingle', response.result);
                    const amountOut = BigInt(decoded[0].toString());
                    v4QuoterCache.set(cacheKey, { value: amountOut, timestamp: Date.now() });
                    await cacheSet(
                        v4QuoterRedisKey(cacheKey),
                        JSON.stringify({ value: amountOut.toString(), timestamp: Date.now() }),
                        Math.max(1, Math.ceil(V4_QUOTER_CACHE_TTL_MS / 1000))
                    ).catch(() => { });
                    return amountOut;
                }

                const errorData = (response as any)?.error?.data?.data
                    || (response as any)?.error?.data
                    || (response as any)?.error?.message?.data;
                if (typeof errorData === 'string' && errorData.startsWith('0x')) {
                    const amountOut = decodeV4QuoterRevert(errorData);
                    if (amountOut && amountOut > 0n) {
                        v4QuoterCache.set(cacheKey, { value: amountOut, timestamp: Date.now() });
                        await cacheSet(
                            v4QuoterRedisKey(cacheKey),
                            JSON.stringify({ value: amountOut.toString(), timestamp: Date.now() }),
                            Math.max(1, Math.ceil(V4_QUOTER_CACHE_TTL_MS / 1000))
                        ).catch(() => { });
                        return amountOut;
                    }
                }
            } catch {
                // try next candidate
            }
        }
    }

    return 0n;
}

export async function getV4BestPoolQuote(
    tokenIn: string,
    tokenOut: string,
    amountInWei: bigint,
    chainId: number,
    payee?: string,
    hint?: DirectSwapHint,
    options?: {
        preloadedPools?: V4PoolInfo[];
    }
): Promise<{ pool: SelectedV4Pool | null; amountOut: bigint }> {
    const pools = options?.preloadedPools || await findV4Pools(tokenIn, tokenOut, chainId);
    const hintedPool = pools.length === 0
        ? await resolveHintedV4PoolFromSourceTx({ tokenIn, tokenOut, chainId, hint })
        : null;
    if (!pools.length && !hintedPool) return { pool: null, amountOut: 0n };

    const basePoolKey = (pools[0]?.poolKey || hintedPool?.poolKey);
    if (!basePoolKey) return { pool: null, amountOut: 0n };
    const [meta0, meta1] = await Promise.all([
        getTokenMetadata(chainId, basePoolKey.currency0),
        getTokenMetadata(chainId, basePoolKey.currency1)
    ]);
    const decimals0 = meta0.decimals || 18;
    const decimals1 = meta1.decimals || 18;

    let bestOut = 0n;
    let bestPool: SelectedV4Pool | null = null;
    let fallbackPool: SelectedV4Pool | null = hintedPool;
    let fallbackLiquidity = hintedPool ? BigInt(hintedPool.liquidity || '0') : 0n;
    for (const pool of pools) {
        const zeroForOne = pool.poolKey.currency0.toLowerCase() === tokenIn.toLowerCase();
        const liquidity = BigInt(pool.liquidity);
        if (liquidity <= 0n) {
            const family = resolveV4HookProfile(chainId, pool.poolKey.hooks).family;
            const allowZeroLiq = chainId === 8453 && (
                family === 'clanker' ||
                family === 'doppler' ||
                family === 'flaunch' ||
                family === 'zora' ||
                family === 'custom'
            );
            if (!allowZeroLiq) continue;
        }

        if (liquidity > fallbackLiquidity) {
            fallbackLiquidity = liquidity;
            fallbackPool = {
                poolId: pool.poolId,
                poolAddress: pool.poolId,
                poolKey: pool.poolKey,
                token0: pool.poolKey.currency0,
                token1: pool.poolKey.currency1,
                liquidity: pool.liquidity,
                sqrtPriceX96: pool.sqrtPriceX96,
                fee: pool.lpFee,
                price: 0,
                version: 'v4',
                dex: 'uniswap'
            };
        }

        const spotPrice = calculatePriceFromSqrtX96(
            BigInt(pool.sqrtPriceX96),
            decimals0,
            decimals1
        );

        const hookDataCandidates = buildV4HookDataCandidates({
            chainId,
            hookAddress: pool.poolKey.hooks,
            walletAddress: payee,
            stage: 'quote'
        });
        const quoterOut = await callV4QuoterExactOut(
            pool.poolKey,
            zeroForOne,
            amountInWei,
            chainId,
            payee,
            undefined,
            hookDataCandidates
        );
        if (quoterOut <= 0n) continue;

        if (quoterOut > bestOut) {
            bestOut = quoterOut;
            bestPool = {
                poolId: pool.poolId,
                poolAddress: pool.poolId,
                poolKey: pool.poolKey,
                token0: pool.poolKey.currency0,
                token1: pool.poolKey.currency1,
                liquidity: pool.liquidity,
                sqrtPriceX96: pool.sqrtPriceX96,
                fee: pool.lpFee,
                price: spotPrice,
                version: 'v4',
                dex: 'uniswap'
            };
        }
    }

    if (hintedPool) {
        const zeroForOne = hintedPool.poolKey.currency0.toLowerCase() === tokenIn.toLowerCase();
        const hintedHookCandidates = buildV4HookDataCandidates({
            chainId,
            hookAddress: hintedPool.poolKey.hooks,
            walletAddress: payee,
            stage: 'quote'
        });
        const quoted = await callV4QuoterExactOut(
            hintedPool.poolKey,
            zeroForOne,
            amountInWei,
            chainId,
            payee,
            undefined,
            hintedHookCandidates
        );
        if (quoted > bestOut) {
            bestOut = quoted;
            bestPool = hintedPool;
        }
    }

    if (!bestPool && fallbackPool) {
        return { pool: fallbackPool, amountOut: 0n };
    }

    return { pool: bestPool, amountOut: bestOut };
}

export async function getAerodromeExpectedOutput(
    tokenIn: string,
    tokenOut: string,
    amountInWei: bigint,
    chainId: number,
    slippageBps: number,
    recipient: string,
    deps?: {
        getAerodromeQuoteFn?: typeof getAerodromeQuote;
    }
): Promise<bigint> {
    try {
        const aerodromeQuote = deps?.getAerodromeQuoteFn ?? getAerodromeQuote;
        const quote = await aerodromeQuote({
            tokenIn,
            tokenOut,
            amountIn: amountInWei,
            recipient,
            slippageBps
        }, chainId);
        return quote?.amountOut ? BigInt(quote.amountOut) : 0n;
    } catch {
        return 0n;
    }
}

async function getV4ViaZoraBridgeExpectedOutput(
    tokenIn: string,
    tokenOut: string,
    amountInWei: bigint,
    chainId: number,
    recipient?: string
): Promise<bigint> {
    const zoraToken = ZORA_TOKEN_ADDRESSES[chainId];
    if (!zoraToken || chainId !== 8453) return 0n;
    if (amountInWei <= 0n) return 0n;

    const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const weth = WETH_ADDRESSES[chainId];
    if (!weth) return 0n;

    const normalizedIn = tokenIn.toLowerCase() === ETH_ADDRESS ? weth : tokenIn;
    const normalizedOut = tokenOut.toLowerCase() === ETH_ADDRESS ? weth : tokenOut;
    if (normalizedIn.toLowerCase() === zoraToken.toLowerCase()) return 0n;
    if (normalizedOut.toLowerCase() === zoraToken.toLowerCase()) return 0n;

    const firstHop = await getV4BestPoolQuote(normalizedIn, zoraToken, amountInWei, chainId, recipient);
    if (!firstHop.pool || firstHop.amountOut <= 0n) return 0n;
    const secondHop = await getV4BestPoolQuote(zoraToken, normalizedOut, firstHop.amountOut, chainId, recipient);
    return secondHop.amountOut > 0n ? secondHop.amountOut : 0n;
}

async function getV3ViaVirtualBridgeExpectedOutput(
    tokenIn: string,
    tokenOut: string,
    amountInWei: bigint,
    chainId: number
): Promise<bigint> {
    const virtualToken = VIRTUAL_TOKEN_ADDRESSES[chainId];
    if (!virtualToken || chainId !== 8453) return 0n;
    if (amountInWei <= 0n) return 0n;

    const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const weth = WETH_ADDRESSES[chainId];
    if (!weth) return 0n;
    const normalizedIn = tokenIn.toLowerCase() === ETH_ADDRESS ? weth : tokenIn;
    const normalizedOut = tokenOut.toLowerCase() === ETH_ADDRESS ? weth : tokenOut;
    if (normalizedIn.toLowerCase() === virtualToken.toLowerCase()) return 0n;
    if (normalizedOut.toLowerCase() === virtualToken.toLowerCase()) return 0n;

    const quote = await getV3BridgeQuoteOut(normalizedIn, virtualToken, normalizedOut, amountInWei, chainId, 'uniswap');
    return quote?.amountOut || 0n;
}

export async function getReferenceExpectedOutput(
    tokenIn: string,
    tokenOut: string,
    amountInWei: bigint,
    chainId: number,
    slippageBps: number,
    recipient: string,
    options?: { enableZoraRoutes?: boolean; diagnostics?: ReferenceQuoteDiagnostics; traceId?: string }
): Promise<bigint> {
    const diagnostics = options?.diagnostics;
    const traceId = options?.traceId;
    const enableZoraRoutes = options?.enableZoraRoutes === true;
    const zoraRefTimeoutMs = Math.min(REFERENCE_QUOTE_TIMEOUT_MS, ZORA_REFERENCE_TIMEOUT_MS);
    if (process.env.DIRECT_SWAP_REF_MODE === 'onchain-only') {
        const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
        const weth = WETH_ADDRESSES[chainId];
        const poolTokenIn = tokenIn.toLowerCase() === ETH_ADDRESS && weth ? weth : tokenIn;
        const poolTokenOut = tokenOut.toLowerCase() === ETH_ADDRESS && weth ? weth : tokenOut;

        const sourceCandidates = await Promise.all([
            withTimeout(
                getV4BestPoolQuote(poolTokenIn, poolTokenOut, amountInWei, chainId, recipient),
                REFERENCE_QUOTE_TIMEOUT_MS
            )
                .then(r => ({ source: 'v4', amountOut: r.amountOut }))
                .catch(() => ({ source: 'v4', amountOut: 0n })),
            withTimeout(
                getV3BestQuoteOut(poolTokenIn, poolTokenOut, amountInWei, chainId, chainId === 56 ? 'pancake' : 'uniswap'),
                REFERENCE_QUOTE_TIMEOUT_MS
            )
                .then(v => ({ source: chainId === 56 ? 'v3:pancake' : 'v3:uniswap', amountOut: v }))
                .catch(() => ({ source: chainId === 56 ? 'v3:pancake' : 'v3:uniswap', amountOut: 0n })),
            withTimeout(
                getV2ExpectedOutput(poolTokenIn, poolTokenOut, amountInWei, chainId),
                REFERENCE_QUOTE_TIMEOUT_MS
            )
                .then(v => ({ source: chainId === 56 ? 'v2:pancake' : 'v2:uniswap', amountOut: v }))
                .catch(() => ({ source: chainId === 56 ? 'v2:pancake' : 'v2:uniswap', amountOut: 0n })),
            chainId === 8453
                ? withTimeout(
                    getAerodromeExpectedOutput(tokenIn, tokenOut, amountInWei, chainId, slippageBps, recipient),
                    REFERENCE_QUOTE_TIMEOUT_MS
                )
                    .then(v => ({ source: 'aerodrome', amountOut: v }))
                    .catch(() => ({ source: 'aerodrome', amountOut: 0n }))
                : Promise.resolve({ source: 'aerodrome', amountOut: 0n }),
            chainId === 8453 && enableZoraRoutes
                ? withTimeout(
                    getZoraSdkExpectedOutput({
                        tokenIn,
                        tokenOut,
                        amountInWei,
                        chainId,
                        recipient
                    }, {
                        zoraQuoteTimeoutMs: ZORA_QUOTE_TIMEOUT_MS,
                        createZoraQuoteWithRetry: (payload: any) => createZoraQuoteWithRetry(payload, {
                            zoraService,
                            retryCount: ZORA_RETRY_COUNT
                        }),
                        withTimeout
                    }),
                    zoraRefTimeoutMs
                )
                    .then(v => ({ source: 'zora-sdk', amountOut: v }))
                    .catch(() => ({ source: 'zora-sdk', amountOut: 0n }))
                : Promise.resolve({ source: 'zora-sdk', amountOut: 0n }),
            chainId === 8453 && enableZoraRoutes
                ? withTimeout(
                    getV4ViaZoraBridgeExpectedOutput(tokenIn, tokenOut, amountInWei, chainId, recipient),
                    zoraRefTimeoutMs
                )
                    .then(v => ({ source: 'v4-zora-bridge', amountOut: v }))
                    .catch(() => ({ source: 'v4-zora-bridge', amountOut: 0n }))
                : Promise.resolve({ source: 'v4-zora-bridge', amountOut: 0n }),
            chainId === 8453
                ? withTimeout(
                    getV3ViaVirtualBridgeExpectedOutput(tokenIn, tokenOut, amountInWei, chainId),
                    REFERENCE_QUOTE_TIMEOUT_MS
                )
                    .then(v => ({ source: 'v3-virtual-bridge', amountOut: v }))
                    .catch(() => ({ source: 'v3-virtual-bridge', amountOut: 0n }))
                : Promise.resolve({ source: 'v3-virtual-bridge', amountOut: 0n })
        ]);

        const best = pickBestReferenceQuote(sourceCandidates) || { source: 'none', amountOut: 0n };

        logger.info(LogCode.EXE_QUOTE_FETCHED, '[DirectSwap] On-chain reference quote', {
            traceId,
            chainId,
            tokenIn: tokenIn.slice(0, 12),
            tokenOut: tokenOut.slice(0, 12),
            bestSource: best.source,
            bestOut: best.amountOut.toString().slice(0, 15),
            bySource: sourceCandidates
                .map(s => `${s.source}:${s.amountOut.toString().slice(0, 12)}`)
                .join(',')
        });
        diagnostics && (diagnostics.source = best.source);
        diagnostics && (diagnostics.l2Status = best.amountOut > 0n ? 'ok' : 'missing');
        diagnostics && (diagnostics.l3Status = 'skipped');
        return best.amountOut > 0n ? best.amountOut : 0n;
    }
    const cacheKey = buildReferenceQuoteCacheKey({
        chainId,
        tokenIn,
        tokenOut,
        amountInWei,
        recipient,
        enableZoraRoutes
    });
    const cached = referenceQuoteCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < REFERENCE_QUOTE_TTL_MS) {
        diagnostics && (diagnostics.source = 'cache:memory');
        diagnostics && (diagnostics.l2Status = 'ok');
        diagnostics && (diagnostics.l3Status = 'skipped');
        return cached.value;
    }
    const redisCached = await cacheGet(referenceQuoteRedisKey(cacheKey)).catch(() => null);
    if (redisCached) {
        try {
            const parsed = JSON.parse(redisCached) as { value: string; timestamp: number };
            if (Date.now() - parsed.timestamp < REFERENCE_QUOTE_TTL_MS) {
                const value = BigInt(parsed.value);
                referenceQuoteCache.set(cacheKey, { value, timestamp: parsed.timestamp });
                diagnostics && (diagnostics.source = 'cache:redis');
                diagnostics && (diagnostics.l2Status = 'ok');
                diagnostics && (diagnostics.l3Status = 'skipped');
                return value;
            }
        } catch {
            // ignore parse errors
        }
    }

    const refStart = Date.now();

    let ref0x = 0n;
    let refKyber = 0n;
    const sharedExternalCacheKey = buildSharedExternalReferenceQuoteCacheKey({
        chainId,
        tokenIn,
        tokenOut,
        amountInWei
    });
    const sharedExternalQuote = await getSharedExternalReferenceQuote(
        sharedExternalCacheKey,
        REFERENCE_SHARED_EXTERNAL_TTL_MS
    );

    if (sharedExternalQuote) {
        ref0x = sharedExternalQuote.ref0x;
        refKyber = sharedExternalQuote.refKyber;
        logger.info(LogCode.SYS_INFO, '[DirectSwap] Shared reference quote cache hit', {
            traceId,
            chainId,
            tokenIn: tokenIn.slice(0, 12),
            tokenOut: tokenOut.slice(0, 12),
            amountIn: amountInWei.toString().slice(0, 16)
        });
    } else {
        const { value: resolvedSharedQuote, shared } = await withInflightSingleflight(
            sharedExternalReferenceQuoteInflight,
            sharedExternalCacheKey,
            async () => {
                let localRef0x = 0n;
                let localRefKyber = 0n;
                const [zeroExResult, kyberResult] = await Promise.allSettled([
                    withAbortableTimeout(
                        (signal) => get0xExpectedOutput(tokenIn, tokenOut, amountInWei, chainId, signal),
                        REFERENCE_QUOTE_TIMEOUT_MS
                    ),
                    withAbortableTimeout(
                        async (signal) => {
                            const res = await getKyberQuote(
                                tokenIn,
                                tokenOut,
                                amountInWei.toString(),
                                chainId,
                                slippageBps,
                                recipient,
                                'copyTrade',
                                undefined,
                                signal
                            );
                            return res?.amountOut ? BigInt(res.amountOut) : 0n;
                        },
                        REFERENCE_QUOTE_TIMEOUT_MS
                    )
                ]);
                if (zeroExResult.status === 'fulfilled') {
                    localRef0x = zeroExResult.value;
                } else {
                    logger.warn(LogCode.API_FETCH_FAILED, '[DirectSwap] 0x reference quote failed', {
                        traceId,
                        error: String(zeroExResult.reason?.message || zeroExResult.reason || '').slice(0, 80)
                    });
                }
                if (kyberResult.status === 'fulfilled') {
                    localRefKyber = kyberResult.value;
                } else {
                    logger.warn(LogCode.API_FETCH_FAILED, '[DirectSwap] Kyber reference quote failed', {
                        traceId,
                        error: String(kyberResult.reason?.message || kyberResult.reason || '').slice(0, 80)
                    });
                }

                const best = localRef0x > localRefKyber ? localRef0x : localRefKyber;
                const ttlMs = best > 0n
                    ? REFERENCE_SHARED_EXTERNAL_TTL_MS
                    : REFERENCE_SHARED_EXTERNAL_NEGATIVE_TTL_MS;
                await setSharedExternalReferenceQuote(
                    sharedExternalCacheKey,
                    { ref0x: localRef0x, refKyber: localRefKyber, best },
                    Math.max(1, Math.ceil(ttlMs / 1000))
                );
                return { ref0x: localRef0x, refKyber: localRefKyber, best };
            }
        );

        ref0x = resolvedSharedQuote.ref0x;
        refKyber = resolvedSharedQuote.refKyber;
        if (shared) {
            logger.info(LogCode.SYS_INFO, '[DirectSwap] Shared reference quote inflight join', {
                traceId,
                chainId,
                tokenIn: tokenIn.slice(0, 12),
                tokenOut: tokenOut.slice(0, 12),
                amountIn: amountInWei.toString().slice(0, 16)
            });
        }
    }

    const bestRef = ref0x > refKyber ? ref0x : refKyber;
    if (bestRef > 0n) {
        referenceQuoteCache.set(cacheKey, { value: bestRef, timestamp: Date.now() });
        await cacheSet(
            referenceQuoteRedisKey(cacheKey),
            JSON.stringify({ value: bestRef.toString(), timestamp: Date.now() }),
            Math.max(1, Math.ceil(REFERENCE_QUOTE_TTL_MS / 1000))
        ).catch(() => { });
        logger.info(LogCode.EXE_QUOTE_FETCHED, '[DirectSwap] Reference quote ready', {
            traceId,
            ref0x: ref0x.toString().slice(0, 15),
            refKyber: refKyber.toString().slice(0, 15),
            durationMs: Date.now() - refStart
        });
        diagnostics && (diagnostics.source = ref0x >= refKyber ? '0x' : 'kyber');
        diagnostics && (diagnostics.l2Status = 'ok');
        diagnostics && (diagnostics.l3Status = 'skipped');
        return bestRef;
    }

    // Fallback: use V4 spot quote as reference for very new tokens
    if (isV4SwapSupported(chainId)) {
        const v4Spot = await getV4BestSpotOut(tokenIn, tokenOut, amountInWei, chainId);
        if (v4Spot > 0n) {
            referenceQuoteCache.set(cacheKey, { value: v4Spot, timestamp: Date.now() });
            await cacheSet(
                referenceQuoteRedisKey(cacheKey),
                JSON.stringify({ value: v4Spot.toString(), timestamp: Date.now() }),
                Math.max(1, Math.ceil(REFERENCE_QUOTE_TTL_MS / 1000))
            ).catch(() => { });
            logger.info(LogCode.EXE_QUOTE_FETCHED, '[DirectSwap] Reference quote fallback (V4 spot)', {
                traceId,
                outWei: v4Spot.toString().slice(0, 15),
                durationMs: Date.now() - refStart
            });
            diagnostics && (diagnostics.source = 'v4-spot');
            diagnostics && (diagnostics.l2Status = 'ok');
            diagnostics && (diagnostics.l3Status = 'skipped');
            return v4Spot;
        }
    }

    try {
        const chainName = chainId === 8453 ? 'base'
            : chainId === 1 ? 'eth'
                : chainId === 56 ? 'bsc'
                    : chainId === 137 ? 'polygon'
                        : chainId === 42161 ? 'arbitrum'
                            : chainId === 10 ? 'optimism'
                                : '';
        if (chainName) {
            const [inDetails, outDetails] = await withTimeout(
                Promise.all([
                    getTokenDetails(chainName, tokenIn, 'high'),
                    getTokenDetails(chainName, tokenOut, 'high')
                ]),
                REFERENCE_QUOTE_TIMEOUT_MS
            );
            if (inDetails?.price && outDetails?.price && inDetails.price > 0 && outDetails.price > 0) {
                const [inDecimals, outDecimals] = await Promise.all([
                    getTokenDecimals(chainId, tokenIn, { defaultDecimals: 18 }),
                    getTokenDecimals(chainId, tokenOut, { defaultDecimals: 18 })
                ]);
                const inAmountHuman = Number(amountInWei) / Math.pow(10, inDecimals || 18);
                const outAmountHuman = inAmountHuman * (inDetails.price / outDetails.price);
                const outWei = BigInt(Math.max(0, Math.floor(outAmountHuman * Math.pow(10, outDecimals || 18))));
                referenceQuoteCache.set(cacheKey, { value: outWei, timestamp: Date.now() });
                await cacheSet(
                    referenceQuoteRedisKey(cacheKey),
                    JSON.stringify({ value: outWei.toString(), timestamp: Date.now() }),
                    Math.max(1, Math.ceil(REFERENCE_QUOTE_TTL_MS / 1000))
                ).catch(() => { });
                logger.info(LogCode.EXE_QUOTE_FETCHED, '[DirectSwap] Reference quote from Gecko', {
                    traceId,
                    outWei: outWei.toString().slice(0, 15),
                    durationMs: Date.now() - refStart
                });
                diagnostics && (diagnostics.source = 'gecko');
                diagnostics && (diagnostics.l2Status = 'missing');
                diagnostics && (diagnostics.l3Status = 'ok');
                return outWei;
            }
        }
    } catch (err: any) {
        logger.warn(LogCode.API_FETCH_FAILED, '[DirectSwap] Gecko reference failed', {
            traceId,
            error: err?.message?.slice(0, 80)
        });
    }

    logger.warn(LogCode.API_FETCH_FAILED, '[DirectSwap] No reference quote available', {
        traceId,
        durationMs: Date.now() - refStart
    });
    diagnostics && (diagnostics.source = 'none');
    diagnostics && (diagnostics.l2Status = 'missing');
    diagnostics && (diagnostics.l3Status = 'missing');
    return 0n;
}

export const __quoteEnginesTestApi = {
  sortCurrencies,
  encodeInfinityParameters,
  buildInfinityPoolKey,
  buildInfinityPairKey,
  parseInfinityParameterValue,
  decodeV4QuoterRevert,
  getV4QuoterAddress,
  withTimeout,
  withAbortableTimeout
};
