/**
 * User Size Layer
 * Evaluates user risk profile based on trade amount
 * 
 * NOT a project risk layer - evaluates "what this amount means to the user"
 */

import {
    UserSizeLayer,
    UserSizeLevel,
    USER_SIZE_THRESHOLDS,
} from '../../types/judgeTypes.js';

/**
 * Evaluate user size layer
 * 
 * @param userAmountUsd - Trade amount in USD
 * @returns UserSizeLayer with level, score, and risk tolerance
 */
export function evaluateUserSizeLayer(userAmountUsd: number): UserSizeLayer {
    const reasons: string[] = [];

    // Determine user size level
    let level: UserSizeLevel;
    let maxSlippage: number;
    let maxRisk: number;
    let score: number;

    if (userAmountUsd < 100) {
        // L1: Small Probe - Most tolerant
        level = 'L1';
        maxSlippage = 0.15;  // 15% slippage acceptable for small tests
        maxRisk = 0.8;       // Can take high risk projects
        score = 0.9;         // Very safe for user (small amount)
        reasons.push(`小额试探 ($${userAmountUsd.toFixed(2)}) - 损失可承受`);
        reasons.push('允许较高滑点和风险容忍度');

    } else if (userAmountUsd < 400) {
        // L2: Medium - Balanced
        level = 'L2';
        maxSlippage = 0.10;  // 10%
        maxRisk = 0.6;
        score = 0.7;
        reasons.push(`中等金额 ($${userAmountUsd.toFixed(2)})`);
        reasons.push('建议避免极高风险项目');

    } else if (userAmountUsd < 1500) {
        // L3: Large - More conservative
        level = 'L3';
        maxSlippage = 0.05;  // 5%
        maxRisk = 0.4;
        score = 0.5;
        reasons.push(`较大金额 ($${userAmountUsd.toFixed(2)}) - 需谨慎`);
        reasons.push('建议仅投资中低风险项目');
        reasons.push('滑点超过5%将触发警告');

    } else {
        // L4: Heavy Position - Most conservative
        level = 'L4';
        maxSlippage = 0.03;  // 3%
        maxRisk = 0.25;
        score = 0.3;
        reasons.push(`重仓级别 ($${userAmountUsd.toFixed(2)}) - 高度谨慎`);
        reasons.push('仅建议投资低风险、高流动性项目');
        reasons.push('滑点超过3%将触发阻止');
        reasons.push('不建议投资早期(<1小时)项目');
    }

    return {
        user_size_level: level,
        max_slippage_allowed: maxSlippage,
        max_risk_allowed: maxRisk,
        score,
        reasons,
    };
}

/**
 * Check if user size is compatible with given risk level
 */
export function isUserSizeCompatible(
    userSizeLayer: UserSizeLayer,
    projectRiskScore: number,  // 0-1, higher = safer
    slippageEstimate: number   // 0-1
): { compatible: boolean; warnings: string[] } {
    const warnings: string[] = [];
    let compatible = true;

    // Check slippage tolerance
    if (slippageEstimate > userSizeLayer.max_slippage_allowed) {
        warnings.push(
            `滑点 (${(slippageEstimate * 100).toFixed(1)}%) 超过用户容忍度 (${(userSizeLayer.max_slippage_allowed * 100).toFixed(1)}%)`
        );
        if (userSizeLayer.user_size_level === 'L4') {
            compatible = false; // Block for heavy positions
        }
    }

    // Check risk tolerance
    // projectRiskScore is 0-1 where higher = safer
    // max_risk_allowed is 0-1 where we need (1 - projectRiskScore) < max_risk_allowed
    const projectRisk = 1 - projectRiskScore;
    if (projectRisk > userSizeLayer.max_risk_allowed) {
        warnings.push(
            `项目风险 (${(projectRisk * 100).toFixed(0)}%) 超过用户容忍度 (${(userSizeLayer.max_risk_allowed * 100).toFixed(0)}%)`
        );
        if (userSizeLayer.user_size_level === 'L3' || userSizeLayer.user_size_level === 'L4') {
            compatible = false;
        }
    }

    return { compatible, warnings };
}
