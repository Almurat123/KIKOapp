import { V4PoolKey } from './uniswapV4.js';
import { buildV4HookDataCandidates, resolveV4HookProfile, V4HookFamily } from './v4Hooks.js';

const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const EXTRA_NATIVE_ALIASES_BY_CHAIN: Record<number, string[]> = {
    // Flaunch native alias seen in Base v4 paths.
    8453: ['0x000000000d564d5be76f7f0d28fe52605afc7cf8']
};
const WETH_ADDRESSES: Record<number, string> = {
    8453: '0x4200000000000000000000000000000000000006',
    1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    56: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
};

export interface SelectedV4Pool {
    poolId: string;
    poolAddress: string;
    poolKey: V4PoolKey;
    token0?: string;
    token1?: string;
    sqrtPriceX96: string;
    liquidity: string;
    fee?: number;
    price?: number;
    version?: 'v4';
    dex?: 'uniswap';
}

export interface V4ExecutionPlan {
    isNativeIn: boolean;
    isNativeOut: boolean;
    normalizedIn: string;
    normalizedOut: string;
    zeroForOne: boolean;
    hookData: string;
    hookDataCandidates: string[];
    hookFamily: V4HookFamily;
    poolId: string;
    poolKey: V4PoolKey;
}

export function buildV4ExecutionPlan(params: {
    tokenIn: string;
    tokenOut: string;
    chainId: number;
    walletAddress: string;
    pool: SelectedV4Pool;
}): V4ExecutionPlan {
    const { tokenIn, tokenOut, chainId, walletAddress, pool } = params;
    const isNativeIn = tokenIn.toLowerCase() === ETH_ADDRESS;
    const isNativeOut = tokenOut.toLowerCase() === ETH_ADDRESS;

    const normalizedIn = String(isNativeIn ? (WETH_ADDRESSES[chainId] || tokenIn) : tokenIn).toLowerCase();
    const normalizedOut = String(isNativeOut ? (WETH_ADDRESSES[chainId] || tokenOut) : tokenOut).toLowerCase();
    const normalizeForDirection = (token: string): string => {
        const value = String(token || '').toLowerCase();
        if (value === ETH_ADDRESS || value === ZERO_ADDRESS || (EXTRA_NATIVE_ALIASES_BY_CHAIN[chainId] || []).includes(value)) {
            return String(WETH_ADDRESSES[chainId] || value).toLowerCase();
        }
        return value;
    };
    const normalizedPoolCurrency = (token: string): string => {
        const value = String(token || '').toLowerCase();
        if (value === ETH_ADDRESS) return (WETH_ADDRESSES[chainId] || token).toLowerCase();
        return value;
    };
    const poolKey = {
        ...pool.poolKey,
        currency0: normalizedPoolCurrency(pool.poolKey.currency0),
        currency1: normalizedPoolCurrency(pool.poolKey.currency1)
    };
    const zeroForOne = normalizeForDirection(poolKey.currency0) === normalizeForDirection(normalizedIn);
    const hookProfile = resolveV4HookProfile(chainId, poolKey.hooks);
    const hookDataCandidates = buildV4HookDataCandidates({
        chainId,
        hookAddress: poolKey.hooks,
        walletAddress,
        stage: 'execute'
    });
    const hookData = hookDataCandidates[0] || '0x';

    return {
        isNativeIn,
        isNativeOut,
        normalizedIn,
        normalizedOut,
        zeroForOne,
        hookData,
        hookDataCandidates,
        hookFamily: hookProfile.family,
        poolId: pool.poolId,
        poolKey
    };
}
