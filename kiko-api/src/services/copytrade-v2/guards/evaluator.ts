import {
    getMinTargetEffectiveFloorUsd,
    isBelowMinTargetValue,
    type TargetValueSnapshot
} from './targetValueGuard.js';
import { shouldEnforceBuyGuard } from './policy.js';
import type { BuyGuardPolicy } from './types.js';
import type { LiquidityGuardSnapshot } from './liquidityGuard.js';
import { evaluateBscPancakeV3ExecutableDepth } from './bscPancakeV3ExecutableDepth.js';

function safeNumber(value: any, fieldName: string): number {
    const num = Number(value);
    if (isNaN(num) || !isFinite(num) || num < 0) {
        throw new Error(`Invalid ${fieldName}: ${value}`);
    }
    return num;
}

export async function evaluateStaticBuyGuards(
    tokenInfo: any,
    config: any,
    targetSwapValueUsd: number,
    policy: BuyGuardPolicy,
    options?: {
        targetValueSnapshot?: TargetValueSnapshot;
        liquidityGuardSnapshot?: LiquidityGuardSnapshot;
    }
): Promise<{ passed: boolean; reason?: string }> {
    let price: number;
    let liquidity = 0;
    let volume24h = 0;
    let marketCap = 0;
    const targetValueSnapshot = options?.targetValueSnapshot;
    const liquiditySnapshot = options?.liquidityGuardSnapshot;

    try {
        price = safeNumber(tokenInfo.price, 'price');

        if (liquiditySnapshot && Number.isFinite(liquiditySnapshot.liquidityUsd)) {
            liquidity = safeNumber(liquiditySnapshot.liquidityUsd, 'guardLiquidityUsd');
        } else if (tokenInfo.guardLiquidityUsd !== null && tokenInfo.guardLiquidityUsd !== undefined) {
            try { liquidity = safeNumber(tokenInfo.guardLiquidityUsd, 'guardLiquidityUsd'); } catch { }
        } else if (tokenInfo.liquidity !== null && tokenInfo.liquidity !== undefined) {
            try { liquidity = safeNumber(tokenInfo.liquidity, 'liquidity'); } catch { }
        }

        if (tokenInfo.volume24h !== null && tokenInfo.volume24h !== undefined) {
            try { volume24h = safeNumber(tokenInfo.volume24h, 'volume24h'); } catch { }
        }

        if (tokenInfo.marketCap !== null && tokenInfo.marketCap !== undefined) {
            try { marketCap = safeNumber(tokenInfo.marketCap, 'marketCap'); } catch { }
        } else if (tokenInfo.fdv !== null && tokenInfo.fdv !== undefined) {
            try { marketCap = safeNumber(tokenInfo.fdv, 'fdv'); } catch { }
        }
    } catch (err: any) {
        return { passed: false, reason: `[DATA ERROR] ${err.message}` };
    }

    const normalizedTargetSwapValueUsd = Number.isFinite(targetSwapValueUsd) ? targetSwapValueUsd : 0;
    const normalizedStrictTargetSwapValueUsd = Number.isFinite(targetValueSnapshot?.strictTargetSwapValueUsd)
        ? Number(targetValueSnapshot?.strictTargetSwapValueUsd)
        : 0;
    const strictTargetSwapValueReliable = Boolean(targetValueSnapshot?.strictTargetSwapValueReliable);
    const strictTargetSwapValueSource = String(targetValueSnapshot?.strictTargetSwapValueSource || 'none');
    const strictMinGuardRequired = Boolean(targetValueSnapshot?.strictMinGuardRequired);
    const effectiveTargetSwapValueUsd = strictTargetSwapValueReliable
        ? normalizedStrictTargetSwapValueUsd
        : normalizedTargetSwapValueUsd;

    if (shouldEnforceBuyGuard(policy, 'minTargetValue') && config.minTargetValueUsd && strictMinGuardRequired && !strictTargetSwapValueReliable) {
        return {
            passed: false,
            reason: `Unable to verify target cash value for strict min gate ($${Number(config.minTargetValueUsd).toFixed(2)}); source=${strictTargetSwapValueSource}`
        };
    }

    if (shouldEnforceBuyGuard(policy, 'minTargetValue') && config.minTargetValueUsd && isBelowMinTargetValue(effectiveTargetSwapValueUsd, config.minTargetValueUsd)) {
        const effectiveFloor = getMinTargetEffectiveFloorUsd(Number(config.minTargetValueUsd || 0));
        return {
            passed: false,
            reason: `Target buy value $${effectiveTargetSwapValueUsd.toFixed(2)} < min floor $${effectiveFloor.toFixed(2)} (configured $${Number(config.minTargetValueUsd).toFixed(2)})`
        };
    }

    const minMarketCapUsd = (config.minMarketCapUsd ?? config.minMarketCap) || 0;
    const maxMarketCapUsd = (config.maxMarketCapUsd ?? config.maxMarketCap) || 0;

    if (shouldEnforceBuyGuard(policy, 'minMarketCap')) {
        if (marketCap > 0) {
            if (minMarketCapUsd > 0 && marketCap < minMarketCapUsd) {
                return { passed: false, reason: `MCap $${marketCap.toFixed(0)} < min $${minMarketCapUsd.toFixed(0)}` };
            }
            if (maxMarketCapUsd > 0 && marketCap > maxMarketCapUsd) {
                return { passed: false, reason: `MCap $${marketCap.toFixed(0)} > max $${maxMarketCapUsd.toFixed(0)}` };
            }
        } else if (minMarketCapUsd > 0) {
            return { passed: false, reason: `MCap data unavailable — cannot verify min $${minMarketCapUsd.toFixed(0)} filter` };
        } else if (maxMarketCapUsd > 0) {
            // G1: maxMarketCap 配置了但数据缺失时，拒绝而不是静默放行
            return { passed: false, reason: `MCap data unavailable — cannot verify max $${maxMarketCapUsd.toFixed(0)} filter` };
        }
    }

    const minLiquidityUsd = config.minLiquidityUsd || 0;
    const liquidityDataUnavailable = liquidity <= 0 && !(liquiditySnapshot?.reliable ?? false);
    if (shouldEnforceBuyGuard(policy, 'minLiquidity') && minLiquidityUsd > 0 && liquidityDataUnavailable) {
        return {
            passed: false,
            reason: `Liquidity data unavailable — cannot verify min $${minLiquidityUsd.toFixed(0)} filter`
        };
    }

    if (shouldEnforceBuyGuard(policy, 'minLiquidity') && minLiquidityUsd > 0 && liquidity < minLiquidityUsd) {
        const depthCheck = await evaluateBscPancakeV3ExecutableDepth({
            chainId: Number(config.chainId || 0),
            tokenAddress: String(tokenInfo?.address || tokenInfo?.tokenAddress || ''),
            tokenInfo,
            config
        });
        if (depthCheck?.eligible) {
            return { passed: true };
        }
        const depthSuffix = depthCheck
            ? `; ${depthCheck.reasonCode}; impact=${Number(depthCheck.priceImpactPct || 0).toFixed(2)}%; ticks=${Number(depthCheck.initializedTicksCrossed || 0)}`
            : '';
        return { passed: false, reason: `Liquidity $${liquidity.toFixed(0)} < min $${minLiquidityUsd.toFixed(0)}${depthSuffix}` };
    }

    const MIN_LIQUIDITY_FAST = 500;
    const MIN_LIQUIDITY_NORMAL = 1000;
    const MIN_VOLUME_RATIO = 0.01;
    const isFastMode = config.fastExecutionEnabled !== false;

    if (isFastMode) {
        // G3: $500 honeypot 下限无条件生效，不受 minLiquidity guard policy 开关控制
        if (liquidity > 0 && liquidity < MIN_LIQUIDITY_FAST) {
            return { passed: false, reason: `[HONEYPOT/FAST] Liquidity $${liquidity.toFixed(0)} < $${MIN_LIQUIDITY_FAST}` };
        }
        if (config.buyAmountUsd && liquidity > 0) {
            const buyAmount = safeNumber(config.buyAmountUsd, 'buyAmountUsd');
            // G7: 用 0.35 代替 0.5 作为单侧可用深度系数，集中流动性池实际可用深度远小于 TVL/2
            const effectiveSingleSideDepth = liquidity * 0.35;
            const estimatedPriceImpact = (buyAmount / effectiveSingleSideDepth) * 100;
            const MAX_PRICE_IMPACT = 8;
            if (estimatedPriceImpact > MAX_PRICE_IMPACT) {
                return { passed: false, reason: `[PRICE IMPACT] Est. impact ${estimatedPriceImpact.toFixed(2)}% > ${MAX_PRICE_IMPACT}%` };
            }
        }
        return { passed: true };
    }

    if (shouldEnforceBuyGuard(policy, 'minLiquidity') && liquidity > 0 && liquidity < MIN_LIQUIDITY_NORMAL) {
        return { passed: false, reason: `[HONEYPOT] Liquidity $${liquidity.toFixed(0)} < $${MIN_LIQUIDITY_NORMAL}` };
    }

    // G5: 门槛从 $50000 降至 $5000，覆盖蜜罐 token 最常见的小流动性区间
    if (liquidity > 5000 && volume24h > 0) {
        const volumeRatio = volume24h / liquidity;
        if (volumeRatio < MIN_VOLUME_RATIO) {
            return { passed: false, reason: `[HONEYPOT] Suspicious volume ratio: ${(volumeRatio * 100).toFixed(2)}%` };
        }
    }

    if (config.buyAmountUsd && liquidity > 0) {
        const buyAmount = safeNumber(config.buyAmountUsd, 'buyAmountUsd');
        // G7: 用 0.35 代替 0.5 作为单侧可用深度系数，保守估计集中流动性池实际可用深度
        const effectiveSingleSideDepth = liquidity * 0.35;
        const estimatedPriceImpact = (buyAmount / effectiveSingleSideDepth) * 100;
        const MAX_PRICE_IMPACT = 5;

        if (estimatedPriceImpact > MAX_PRICE_IMPACT) {
            return { passed: false, reason: `[PRICE IMPACT] Est. impact ${estimatedPriceImpact.toFixed(2)}% > ${MAX_PRICE_IMPACT}%` };
        }
    }

    return { passed: true };
}
