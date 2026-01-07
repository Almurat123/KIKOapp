/**
 * Judge Decision Repository
 * Saves Judge Engine v3.5 decisions to database for ML/DL training
 */

import { prisma, withRetry } from '../db/prisma.js';
import { DecisionEngineOutput } from '../types/judgeTypes.js';

/**
 * Save a judge decision to database
 */
export async function saveJudgeDecision(
    judgeOutput: DecisionEngineOutput,
    analysisTimeMs: number
): Promise<string> {
    const engine = judgeOutput.decision_engine;

    const decision = await withRetry(() => prisma.judgeDecision.create({
        data: {
            // Input
            tokenAddress: engine.input.token_address,
            tokenSymbol: undefined,  // TODO: Extract from token data
            tokenName: undefined,
            chainId: engine.input.chain_id,
            userAmountUsd: engine.input.user_amount,
            targetWallet: engine.input.target_wallet,

            // Context
            launchpadType: engine.input.launchpad_type,
            liquidity: engine.layers.liquidity_layer.lp_depth_usd,
            contractAgeHours: engine.layers.stage_layer.contract_age_minutes / 60,

            // Layer Outputs
            userSizeLayer: engine.layers.user_size_layer as any,
            liquidityLayer: engine.layers.liquidity_layer as any,
            structureLayer: engine.layers.structure_layer as any,
            stageLayer: engine.layers.stage_layer as any,
            tokenIntelLayer: engine.layers.token_intelligence_layer as any,

            // Final Decision
            finalDecision: engine.final_decision.decision,
            overallRiskScore: engine.final_decision.overall_risk_score,
            slippageEstimate: engine.final_decision.slippage_estimate,
            reasons: engine.final_decision.reasons as any,
            aiRationale: engine.final_decision.ai_rationale,

            // Full Output
            fullOutputJson: JSON.stringify(judgeOutput, null, 2),

            // Metadata
            analysisTimeMs,
        },
    }));

    console.log(`[Judge Repository] Saved decision ${decision.id} for ${engine.input.token_address}`);

    return decision.id;
}

/**
 * Update actual outcome after trade execution
 */
export async function updateJudgeOutcome(
    decisionId: string,
    outcome: {
        actualExecuted: boolean;
        actualProfitPct?: number;
        actualOutcome?: 'success' | 'failed' | 'rug' | 'honeypot';
        outcomeNotes?: string;
    }
): Promise<void> {
    await withRetry(() => prisma.judgeDecision.update({
        where: { id: decisionId },
        data: {
            actualExecuted: outcome.actualExecuted,
            actualProfitPct: outcome.actualProfitPct,
            actualOutcome: outcome.actualOutcome,
            outcomeNotes: outcome.outcomeNotes,
            outcomeUpdatedAt: new Date(),
        },
    }));

    console.log(`[Judge Repository] Updated outcome for decision ${decisionId}: ${outcome.actualOutcome}`);
}

/**
 * Get all judge decisions for ML training
 */
export async function getJudgeDecisionsForTraining(
    filters?: {
        chainId?: number;
        minLiquidity?: number;
        finalDecision?: string;
        hasOutcome?: boolean;
    }
): Promise<any[]> {
    const where: any = {};

    if (filters?.chainId) where.chainId = filters.chainId;
    if (filters?.minLiquidity) where.liquidity = { gte: filters.minLiquidity };
    if (filters?.finalDecision) where.finalDecision = filters.finalDecision;
    if (filters?.hasOutcome !== undefined) {
        where.actualExecuted = filters.hasOutcome ? { not: null } : null;
    }

    return prisma.judgeDecision.findMany({
        where,
        orderBy: { createdAt: 'desc' },
    });
}

/**
 * Get statistics for model evaluation
 */
export async function getJudgeStats(): Promise<any> {
    const [
        total,
        allowCount,
        allowWithRiskCount,
        blockCount,
        executedCount,
        successCount,
    ] = await Promise.all([
        prisma.judgeDecision.count(),
        prisma.judgeDecision.count({ where: { finalDecision: 'ALLOW' } }),
        prisma.judgeDecision.count({ where: { finalDecision: 'ALLOW_WITH_RISK' } }),
        prisma.judgeDecision.count({ where: { finalDecision: 'BLOCK' } }),
        prisma.judgeDecision.count({ where: { actualExecuted: true } }),
        prisma.judgeDecision.count({ where: { actualOutcome: 'success' } }),
    ]);

    return {
        total,
        decisions: {
            allow: allowCount,
            allowWithRisk: allowWithRiskCount,
            block: blockCount,
        },
        outcomes: {
            executed: executedCount,
            success: successCount,
            successRate: executedCount > 0 ? (successCount / executedCount) * 100 : 0,
        },
    };
}
