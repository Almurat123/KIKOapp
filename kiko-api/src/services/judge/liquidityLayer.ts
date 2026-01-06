/**
 * Liquidity Layer
 * Evaluates pool depth vs user amount for slippage/rug risk
 * 
 * This is the HIGHEST PRIORITY layer - Liquidity BLOCK = Final BLOCK
 */

import {
    LiquidityLayer,
    LayerDecision,
} from '../../types/judgeTypes.js';

/**
 * Evaluate liquidity layer
 * 
 * @param lpDepthUsd - Pool liquidity depth in USD
 * @param userAmountUsd - User trade amount in USD
 * @param isFixedPool - Whether pool has fixed pricing (Zora, Paragraph)
 * @param isBondingCurve - Whether using bonding curve pricing
 * @returns LiquidityLayer with slippage estimate and decision
 */
export function evaluateLiquidityLayer(
    lpDepthUsd: number,
    userAmountUsd: number,
    isFixedPool: boolean = false,
    isBondingCurve: boolean = false
): LiquidityLayer {
    const reasons: string[] = [];

    // Handle fixed pool case (Zora, Paragraph)
    if (isFixedPool) {
        return {
            lp_depth_usd: lpDepthUsd,
            user_amount_usd: userAmountUsd,
            slippage_estimate: 0,
            liquidity_risk_score: 0.9,
            liquidity_decision: 'ALLOW',
            reasons: ['固定池子定价 - 无滑点风险'],
        };
    }

    // Calculate impact ratio
    const impactRatio = lpDepthUsd > 0 ? userAmountUsd / lpDepthUsd : 1;

    // Estimate slippage based on impact ratio
    // Using simplified constant product AMM model: slippage ≈ 2 * impactRatio for small amounts
    let slippageEstimate: number;
    if (isBondingCurve) {
        // Bonding curves typically have higher slippage
        slippageEstimate = Math.min(0.95, impactRatio * 3);
    } else {
        // Standard AMM (Uniswap-style)
        slippageEstimate = Math.min(0.95, impactRatio * 2);
    }

    // Evaluate liquidity risk
    let riskScore: number;
    let decision: LayerDecision;

    // Critical: Pool is extremely shallow
    if (lpDepthUsd < 1000) {
        riskScore = 0.1;
        decision = 'BLOCK';
        reasons.push(`池子极浅 ($${lpDepthUsd.toFixed(0)}) - 高 Rug 风险`);
        reasons.push('任何金额都将造成巨大滑点');

        // Very shallow pool
    } else if (lpDepthUsd < 5000) {
        riskScore = 0.25;
        if (userAmountUsd > lpDepthUsd * 0.05) {
            decision = 'BLOCK';
            reasons.push(`用户金额 ($${userAmountUsd}) 占池子 ${(impactRatio * 100).toFixed(1)}%`);
            reasons.push('预估滑点过高，建议减少金额');
        } else {
            decision = 'ALLOW_WITH_RISK';
            reasons.push(`池子较浅 ($${lpDepthUsd.toFixed(0)}) - 需谨慎`);
        }

        // Shallow pool
    } else if (lpDepthUsd < 20000) {
        if (slippageEstimate > 0.15) {
            riskScore = 0.35;
            decision = 'ALLOW_WITH_RISK';
            reasons.push(`预估滑点 ${(slippageEstimate * 100).toFixed(1)}% - 较高`);
        } else if (slippageEstimate > 0.05) {
            riskScore = 0.5;
            decision = 'ALLOW_WITH_RISK';
            reasons.push(`预估滑点 ${(slippageEstimate * 100).toFixed(1)}%`);
        } else {
            riskScore = 0.6;
            decision = 'ALLOW';
            reasons.push(`池子深度 $${lpDepthUsd.toLocaleString()} - 可接受`);
        }

        // Medium liquidity
    } else if (lpDepthUsd < 100000) {
        if (slippageEstimate > 0.10) {
            riskScore = 0.55;
            decision = 'ALLOW_WITH_RISK';
            reasons.push(`预估滑点 ${(slippageEstimate * 100).toFixed(1)}% - 用户金额较大`);
        } else {
            riskScore = 0.7;
            decision = 'ALLOW';
            reasons.push(`池子深度 $${lpDepthUsd.toLocaleString()} - 良好`);
        }

        // Deep liquidity
    } else {
        riskScore = 0.85;
        decision = 'ALLOW';
        reasons.push(`池子深度 $${lpDepthUsd.toLocaleString()} - 充足`);
        if (slippageEstimate > 0.01) {
            reasons.push(`预估滑点 ${(slippageEstimate * 100).toFixed(2)}%`);
        }
    }

    // Add bonding curve note
    if (isBondingCurve) {
        reasons.push('使用 Bonding Curve - 滑点随购买量增加');
    }

    return {
        lp_depth_usd: lpDepthUsd,
        user_amount_usd: userAmountUsd,
        slippage_estimate: slippageEstimate,
        liquidity_risk_score: riskScore,
        liquidity_decision: decision,
        reasons,
    };
}

/**
 * Estimate slippage for a given trade
 * Simplified model for quick estimation
 */
export function estimateSlippage(
    lpDepthUsd: number,
    userAmountUsd: number,
    isBondingCurve: boolean = false
): number {
    if (lpDepthUsd <= 0) return 1.0; // 100% slippage = can't trade

    const impactRatio = userAmountUsd / lpDepthUsd;
    const multiplier = isBondingCurve ? 3 : 2;

    return Math.min(0.95, impactRatio * multiplier);
}

/**
 * Check if liquidity is sufficient for trade
 */
export function isLiquiditySufficient(
    lpDepthUsd: number,
    userAmountUsd: number,
    maxSlippage: number = 0.10
): boolean {
    const slippage = estimateSlippage(lpDepthUsd, userAmountUsd);
    return slippage <= maxSlippage && lpDepthUsd >= 1000;
}
