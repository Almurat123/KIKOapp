/**
 * Final Decision Layer
 * Combines all 5 layers using priority order
 * 
 * Priority: Liquidity > Structure > Stage > Token Intelligence > User Size
 */

import {
    FinalDecision,
    FinalDecisionOutput,
    UserSizeLayer,
    LiquidityLayer,
    StructureLayer,
    StageLayer,
    TokenIntelligenceLayer,
} from '../../types/judgeTypes.js';

export interface FinalDecisionInput {
    userSizeLayer: UserSizeLayer;
    liquidityLayer: LiquidityLayer;
    structureLayer: StructureLayer;
    stageLayer: StageLayer;
    tokenIntelligenceLayer: TokenIntelligenceLayer;
}

/**
 * Make final decision using priority order
 */
export function makeFinalDecision(input: FinalDecisionInput): FinalDecisionOutput {
    const reasons: string[] = [];

    // --- PRIORITY 1: LIQUIDITY (Hard Constraint) ---
    if (input.liquidityLayer.liquidity_decision === 'BLOCK') {
        return {
            decision: 'BLOCK',
            overall_risk_score: input.liquidityLayer.liquidity_risk_score,
            slippage_estimate: input.liquidityLayer.slippage_estimate,
            reasons: [
                '流动性层阻止 - 池子深度不足或滑点过高',
                ...input.liquidityLayer.reasons,
            ],
        };
    }

    // --- PRIORITY 2: STRUCTURE ---
    if (input.structureLayer.structure_decision === 'BLOCK') {
        return {
            decision: 'BLOCK',
            overall_risk_score: input.structureLayer.structure_risk_score,
            slippage_estimate: input.liquidityLayer.slippage_estimate,
            reasons: [
                '结构层阻止 - Launchpad 机制风险过高',
                ...input.structureLayer.reasons,
            ],
        };
    }

    // --- PRIORITY 3: STAGE ---
    // Stage layer rarely blocks, but influences final decision
    const stageRisk = 1 - input.stageLayer.stage_risk_score;

    // --- PRIORITY 4: TOKEN INTELLIGENCE ---
    const tokenIntelRisk = 1 - input.tokenIntelligenceLayer.token_intelligence_score;

    // Check for critical intelligence flags
    if (input.tokenIntelligenceLayer.token_intelligence_label === 'danger') {
        return {
            decision: 'BLOCK',
            overall_risk_score: input.tokenIntelligenceLayer.token_intelligence_score,
            slippage_estimate: input.liquidityLayer.slippage_estimate,
            reasons: [
                '代币信息层阻止 - 项目信息严重不足或有明显危险信号',
                ...input.tokenIntelligenceLayer.reasons,
            ],
        };
    }

    // --- PRIORITY 5: USER SIZE (Soft Constraint) ---
    // Check if user size is compatible with risk level
    const overallProjectRisk = (
        input.liquidityLayer.liquidity_risk_score * 0.35 +
        input.structureLayer.structure_risk_score * 0.25 +
        input.stageLayer.stage_risk_score * 0.20 +
        input.tokenIntelligenceLayer.token_intelligence_score * 0.20
    );

    const userSizeCompatibility = checkUserSizeCompatibility(
        input.userSizeLayer,
        overallProjectRisk,
        input.liquidityLayer.slippage_estimate
    );

    if (!userSizeCompatibility.compatible && input.userSizeLayer.user_size_level === 'L4') {
        return {
            decision: 'BLOCK',
            overall_risk_score: overallProjectRisk,
            slippage_estimate: input.liquidityLayer.slippage_estimate,
            reasons: [
                '用户金额层阻止 - 重仓金额不适合此风险等级',
                ...userSizeCompatibility.warnings,
            ],
        };
    }

    // --- FINAL DECISION LOGIC ---

    let finalDecision: FinalDecision;

    // Calculate risk factors
    const hasLiquidityRisk = input.liquidityLayer.liquidity_decision === 'ALLOW_WITH_RISK';
    const hasStructureRisk = input.structureLayer.structure_decision === 'ALLOW_WITH_RISK';
    const hasStageRisk = input.stageLayer.stage_decision === 'ALLOW_WITH_RISK';
    const hasTokenIntelRisk = input.tokenIntelligenceLayer.token_intelligence_label === 'weak';
    const hasUserSizeRisk = !userSizeCompatibility.compatible;

    const riskCount = [
        hasLiquidityRisk,
        hasStructureRisk,
        hasStageRisk,
        hasTokenIntelRisk,
        hasUserSizeRisk,
    ].filter(Boolean).length;

    // Decision tree
    if (riskCount === 0) {
        finalDecision = 'ALLOW';
        reasons.push('所有层级检查通过 - 风险可控');
    } else if (riskCount === 1) {
        finalDecision = 'ALLOW_WITH_RISK';
        reasons.push('发现 1 个风险因素 - 建议谨慎操作');
    } else if (riskCount === 2) {
        finalDecision = 'ALLOW_WITH_RISK';
        reasons.push('发现 2 个风险因素 - 需要密切关注');
    } else {
        finalDecision = 'ALLOW_WITH_RISK';
        reasons.push(`发现 ${riskCount} 个风险因素 - 高度谨慎`);
    }

    // Add specific layer warnings
    if (hasLiquidityRisk) {
        reasons.push(`流动性: ${input.liquidityLayer.reasons[0]}`);
    }
    if (hasStructureRisk) {
        reasons.push(`结构: ${input.structureLayer.reasons[0]}`);
    }
    if (hasStageRisk) {
        reasons.push(`阶段: ${input.stageLayer.reasons[0]}`);
    }
    if (hasTokenIntelRisk) {
        reasons.push(`代币信息: ${input.tokenIntelligenceLayer.reasons[0]}`);
    }
    if (hasUserSizeRisk) {
        reasons.push(`用户金额: ${userSizeCompatibility.warnings[0]}`);
    }

    // Add positive signals
    if (input.tokenIntelligenceLayer.token_intelligence_label === 'strong') {
        reasons.push('✓ 项目信息完整可靠');
    }
    if (input.liquidityLayer.lp_depth_usd > 50000) {
        reasons.push('✓ 流动性充足');
    }

    return {
        decision: finalDecision,
        overall_risk_score: overallProjectRisk,
        slippage_estimate: input.liquidityLayer.slippage_estimate,
        reasons,
    };
}

/**
 * Check user size compatibility with risk
 */
function checkUserSizeCompatibility(
    userSizeLayer: UserSizeLayer,
    projectRiskScore: number,
    slippageEstimate: number
): { compatible: boolean; warnings: string[] } {
    const warnings: string[] = [];
    let compatible = true;

    // Check slippage tolerance
    if (slippageEstimate > userSizeLayer.max_slippage_allowed) {
        warnings.push(
            `滑点 (${(slippageEstimate * 100).toFixed(1)}%) 超过容忍度 (${(userSizeLayer.max_slippage_allowed * 100).toFixed(1)}%)`
        );
        if (userSizeLayer.user_size_level === 'L4') {
            compatible = false;
        }
    }

    // Check risk tolerance
    const projectRisk = 1 - projectRiskScore;
    if (projectRisk > userSizeLayer.max_risk_allowed) {
        warnings.push(
            `项目风险 (${(projectRisk * 100).toFixed(0)}%) 超过容忍度 (${(userSizeLayer.max_risk_allowed * 100).toFixed(0)}%)`
        );
        if (userSizeLayer.user_size_level === 'L3' || userSizeLayer.user_size_level === 'L4') {
            compatible = false;
        }
    }

    return { compatible, warnings };
}
