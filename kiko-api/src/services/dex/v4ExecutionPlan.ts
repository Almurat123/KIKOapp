import { V4PoolKey } from './uniswapV4.js';
import { buildV4HookDataCandidates, resolveV4HookProfile, V4HookFamily } from './v4Hooks.js';
import { getCanonicalAssetIdentity, getWrappedNativeAddressForChain, normalizeCanonicalEvmAsset } from '../evmCanonicalAsset.js';

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
    const wrappedNativeAddress = getWrappedNativeAddressForChain(chainId);
    const inIdentity = getCanonicalAssetIdentity(chainId, tokenIn, wrappedNativeAddress || undefined);
    const outIdentity = getCanonicalAssetIdentity(chainId, tokenOut, wrappedNativeAddress || undefined);
    const isNativeIn = inIdentity.isNativeLike;
    const isNativeOut = outIdentity.isNativeLike;

    const normalizedIn = inIdentity.normalized;
    const normalizedOut = outIdentity.normalized;
    const poolKey = {
        ...pool.poolKey,
        currency0: normalizeCanonicalEvmAsset(chainId, pool.poolKey.currency0, wrappedNativeAddress || undefined),
        currency1: normalizeCanonicalEvmAsset(chainId, pool.poolKey.currency1, wrappedNativeAddress || undefined)
    };
    const zeroForOne = poolKey.currency0 === normalizedIn;
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
