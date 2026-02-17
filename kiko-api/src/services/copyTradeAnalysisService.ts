import { runJudgeEngine } from './judge/judgeEngine.js';
import { DecisionEngineOutput } from '../types/judgeTypes.js';

export interface AnalysisResult {
    decision: 'BUY' | 'SKIP';
    confidence: number;
    reason: string;
    metrics: {
        launchpad: string;
        priceChange5m: number;
        liquidity: number;
        marketCap: number;
        holderCount?: number;
        top10HoldersPct?: number;
        tokenAgeHours: number;
        socialScore: number;
    };
    rawAnalysis: string;
    judgeDecisionId?: string;
}

/**
 * Enhanced analysis using the 5-layer Judge Engine
 * Replaces legacy direct Grok prompt logic
 */
export async function analyzeTradeOpportunity(
    tokenAddress: string,
    chainId: number,
    targetWallet: string,
    userAmountUsd: number = 100,
    knownLaunchpadType?: string
): Promise<AnalysisResult> {
    console.log(`[AI Analysis] Using Judge Engine for ${tokenAddress} on chain ${chainId}`);

    try {
        const judgeOutput: DecisionEngineOutput = await runJudgeEngine(
            tokenAddress,
            chainId,
            userAmountUsd,
            targetWallet,
            knownLaunchpadType
        );

        const engine = judgeOutput.decision_engine;
        const final = engine.final_decision;
        const layers = engine.layers;

        // Map DecisionEngineOutput to AnalysisResult (legacy compatibility)
        return {
            decision: final.decision === 'BLOCK' ? 'SKIP' : 'BUY',
            confidence: Math.round(final.overall_risk_score * 100),
            reason: final.reasons.join(' | '),
            metrics: {
                launchpad: layers.structure_layer.launchpad_type,
                priceChange5m: (layers.token_intelligence_layer as any).priceChange5m || 0,
                liquidity: layers.liquidity_layer.lp_depth_usd,
                marketCap: (layers.token_intelligence_layer as any).marketCap || 0,
                tokenAgeHours: layers.stage_layer.contract_age_minutes / 60,
                socialScore: layers.token_intelligence_layer.token_intelligence_score * 100
            },
            rawAnalysis: final.ai_rationale || 'Analysis completed by multi-layer judge engine.',
            judgeDecisionId: engine.decision_id,
        };

    } catch (error: any) {
        console.error('[AI Analysis] Judge Engine failed:', error);
        return {
            decision: 'SKIP',
            confidence: 0,
            reason: `Analysis Engine Error: ${error.message}`,
            metrics: {
                launchpad: 'unknown',
                priceChange5m: 0,
                liquidity: 0,
                marketCap: 0,
                tokenAgeHours: 0,
                socialScore: 0
            },
            rawAnalysis: 'Error during judge engine execution.'
        };
    }
}
