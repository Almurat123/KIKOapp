import { V4PoolKey } from './uniswapV4.js';
import { buildV4HookDataCandidates, resolveV4HookProfile, V4HookFamily } from './v4Hooks.js';

const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
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

    const normalizedIn = isNativeIn ? (WETH_ADDRESSES[chainId] || tokenIn) : tokenIn;
    const normalizedOut = isNativeOut ? (WETH_ADDRESSES[chainId] || tokenOut) : tokenOut;
    const poolKey = pool.poolKey;
    const zeroForOne = poolKey.currency0.toLowerCase() === normalizedIn.toLowerCase();
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
