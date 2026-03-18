import { ethers } from 'ethers';
import { getChainConfig } from '../../../config/chainConfig.js';
import { getNativeTokenPriceUsd } from '../../onChainPriceService.js';
import { callRpc as callRpcRaw } from '../../rpcManager.js';
import { TRADE_QUOTE_PROFILE } from '../../rpc/profile.js';

const PANCAKE_QUOTER_V2 = '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997';
const PANCAKE_V3_FEE_TIERS = [100, 500, 2500, 10000] as const;
const quoterV3Interface = new ethers.Interface([
    'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)'
]);

export interface BscExecutableDepthResult {
    eligible: boolean;
    reasonCode: string;
    quotedOut?: string;
    initializedTicksCrossed?: number;
    feeTier?: number;
    amountInWei?: string;
    priceImpactPct?: number;
}

async function callRpc<T = any>(chainId: number, method: string, params: any): Promise<T> {
    return callRpcRaw<T>(chainId, method, params, {
        strategy: TRADE_QUOTE_PROFILE.strategy,
        importance: TRADE_QUOTE_PROFILE.importance,
        purpose: TRADE_QUOTE_PROFILE.purpose,
        exhaustiveFailover: true
    });
}

export async function evaluateBscPancakeV3ExecutableDepth(params: {
    chainId: number;
    tokenAddress: string;
    tokenInfo: any;
    config: any;
}): Promise<BscExecutableDepthResult | null> {
    if (params.chainId !== 56) return null;
    if (!String(params.tokenInfo?.rpcDexName || '').toLowerCase().includes('pancakeswap v3')) return null;

    const buyAmountUsd = Number(params.config?.buyAmountUsd || 0);
    const tokenPriceUsd = Number(params.tokenInfo?.price || 0);
    if (!Number.isFinite(buyAmountUsd) || buyAmountUsd <= 0 || !Number.isFinite(tokenPriceUsd) || tokenPriceUsd <= 0) {
        return {
            eligible: false,
            reasonCode: 'bsc_v3_depth_invalid_inputs'
        };
    }

    const nativePriceUsd = await getNativeTokenPriceUsd(56).catch(() => 0);
    if (!Number.isFinite(nativePriceUsd) || nativePriceUsd <= 0) {
        return {
            eligible: false,
            reasonCode: 'bsc_v3_depth_native_price_unavailable'
        };
    }

    const amountInNative = buyAmountUsd / nativePriceUsd;
    if (!Number.isFinite(amountInNative) || amountInNative <= 0) {
        return {
            eligible: false,
            reasonCode: 'bsc_v3_depth_amount_in_invalid'
        };
    }

    const wrappedNative = getChainConfig(56).wrappedNativeAddress;
    const amountInWei = ethers.parseUnits(amountInNative.toFixed(18), 18);
    const decimalsOut = Number(params.tokenInfo?.decimals || 18);
    const spotOut = buyAmountUsd / tokenPriceUsd;

    let best: { amountOut: bigint; initializedTicksCrossed: number; feeTier: number } | null = null;

    for (const feeTier of PANCAKE_V3_FEE_TIERS) {
        try {
            const quoteParams = {
                tokenIn: wrappedNative,
                tokenOut: params.tokenAddress,
                amountIn: amountInWei,
                fee: feeTier,
                sqrtPriceLimitX96: 0
            };
            const callData = quoterV3Interface.encodeFunctionData('quoteExactInputSingle', [quoteParams]);
            const result = await callRpc<string>(56, 'eth_call', [{
                to: PANCAKE_QUOTER_V2,
                data: callData
            }, 'latest']);
            if (!result || result === '0x') continue;
            const decoded = quoterV3Interface.decodeFunctionResult('quoteExactInputSingle', result);
            const amountOut = decoded[0] as bigint;
            const initializedTicksCrossed = Number(decoded[2] as bigint | number);
            if (amountOut <= 0n) continue;
            if (!best || amountOut > best.amountOut) {
                best = { amountOut, initializedTicksCrossed, feeTier };
            }
        } catch {
            continue;
        }
    }

    if (!best) {
        return {
            eligible: false,
            reasonCode: 'bsc_v3_depth_quoter_unavailable',
            amountInWei: amountInWei.toString()
        };
    }

    const quotedOut = Number(ethers.formatUnits(best.amountOut, decimalsOut));
    if (!Number.isFinite(quotedOut) || quotedOut <= 0 || !Number.isFinite(spotOut) || spotOut <= 0) {
        return {
            eligible: false,
            reasonCode: 'bsc_v3_depth_quote_invalid',
            quotedOut: best.amountOut.toString(),
            initializedTicksCrossed: best.initializedTicksCrossed,
            feeTier: best.feeTier,
            amountInWei: amountInWei.toString()
        };
    }

    const priceImpactPct = Math.max(0, ((spotOut - quotedOut) / spotOut) * 100);
    const maxAllowedImpactPct = params.config?.fastExecutionEnabled !== false ? 8 : 5;
    const maxTicksCrossed = 400;

    return {
        eligible: priceImpactPct <= maxAllowedImpactPct && best.initializedTicksCrossed <= maxTicksCrossed,
        reasonCode: priceImpactPct <= maxAllowedImpactPct && best.initializedTicksCrossed <= maxTicksCrossed
            ? 'bsc_v3_depth_quote_pass'
            : 'bsc_v3_depth_quote_reject',
        quotedOut: best.amountOut.toString(),
        initializedTicksCrossed: best.initializedTicksCrossed,
        feeTier: best.feeTier,
        amountInWei: amountInWei.toString(),
        priceImpactPct
    };
}
