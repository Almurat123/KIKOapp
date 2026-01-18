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
import { isUserSizeCompatible } from './userSizeLayer.js';

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
                'Liquidity layer block - pool depth too low or slippage too high',
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
                'Structure layer block - launchpad mechanism risk too high',
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
                'Token intelligence block - project info insufficient or clear red flags',
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

    const userSizeCompatibility = isUserSizeCompatible(
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
                'User size block - position size too large for this risk level',
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
        reasons.push('All layers passed - risk is manageable');
    } else if (riskCount === 1) {
        finalDecision = 'ALLOW_WITH_RISK';
        reasons.push('1 risk factor found - proceed with caution');
    } else if (riskCount === 2) {
        finalDecision = 'ALLOW_WITH_RISK';
        reasons.push('2 risk factors found - monitor closely');
    } else {
        finalDecision = 'ALLOW_WITH_RISK';
        reasons.push(`Found ${riskCount} risk factors - high caution`);
    }

    // Add specific layer warnings
    if (hasLiquidityRisk) {
        reasons.push(`Liquidity: ${input.liquidityLayer.reasons[0]}`);
    }
    if (hasStructureRisk) {
        reasons.push(`Structure: ${input.structureLayer.reasons[0]}`);
    }
    if (hasStageRisk) {
        reasons.push(`Stage: ${input.stageLayer.reasons[0]}`);
    }
    if (hasTokenIntelRisk) {
        reasons.push(`Token intelligence: ${input.tokenIntelligenceLayer.reasons[0]}`);
    }
    if (hasUserSizeRisk) {
        reasons.push(`User size: ${userSizeCompatibility.warnings[0]}`);
    }

    // Add positive signals
    if (input.tokenIntelligenceLayer.token_intelligence_label === 'strong') {
        reasons.push('Project information is strong and reliable');
    }
    if (input.liquidityLayer.lp_depth_usd > 50000) {
        reasons.push('Liquidity is strong');
    }

    return {
        decision: finalDecision,
        overall_risk_score: overallProjectRisk,
        slippage_estimate: input.liquidityLayer.slippage_estimate,
        reasons,
    };
}
