/**
 * Stage Layer
 * Evaluates token lifecycle stage based on contract age
 * 
 * Stage definitions:
 * S0: Just created (< 10 minutes) - Extreme uncertainty
 * S1: Early (10 min - 2 hours) - High volatility
 * S2: Mid-term (2 - 24 hours) - Establishing pattern
 * S3: Stable (> 24 hours) - More predictable
 * S4: Post-Migration / Special stage
 */

import {
    StageLayer,
    TokenStage,
    LayerDecision,
    STAGE_THRESHOLDS,
} from '../../types/judgeTypes.js';

/**
 * Evaluate stage layer based on contract age
 * 
 * @param contractAgeMinutes - Age of contract in minutes
 * @param isMigrated - Whether token has been migrated (optional)
 * @returns StageLayer with stage, score, and decision
 */
export function evaluateStageLayer(
    contractAgeMinutes: number,
    isMigrated: boolean = false
): StageLayer {
    const reasons: string[] = [];

    let stage: TokenStage;
    let riskScore: number;
    let decision: LayerDecision;

    // Special case: Migrated token
    if (isMigrated) {
        stage = 'S4';
        riskScore = 0.5;
        decision = 'ALLOW_WITH_RISK';
        reasons.push('Token migrated - contract switch risk');
        reasons.push('Post-migration state needs extra verification');

        return {
            stage,
            contract_age_minutes: contractAgeMinutes,
            stage_risk_score: riskScore,
            stage_decision: decision,
            reasons,
        };
    }

    // Determine stage based on age
    if (contractAgeMinutes < 10) {
        // S0: Just created
        stage = 'S0';
        riskScore = 0.2;
        decision = 'ALLOW_WITH_RISK';
        reasons.push(`Just created (${contractAgeMinutes.toFixed(0)} minutes) - extreme uncertainty`);
        reasons.push('Price and liquidity may be highly volatile');
        reasons.push('Recommend a small test size only');

    } else if (contractAgeMinutes < 120) {
        // S1: Early (10 min - 2 hours)
        stage = 'S1';
        riskScore = 0.4;
        decision = 'ALLOW_WITH_RISK';
        const ageDisplay = contractAgeMinutes < 60
            ? `${contractAgeMinutes.toFixed(0)} minutes`
            : `${(contractAgeMinutes / 60).toFixed(1)} hours`;
        reasons.push(`Early stage (${ageDisplay}) - high volatility`);
        reasons.push('Smart money entries may create opportunities');

    } else if (contractAgeMinutes < 1440) {
        // S2: Mid-term (2 - 24 hours)
        stage = 'S2';
        riskScore = 0.6;
        decision = 'ALLOW';
        const hours = (contractAgeMinutes / 60).toFixed(1);
        reasons.push(`Mid stage (${hours} hours) - stabilizing`);
        reasons.push('Some trading history is available');

    } else {
        // S3: Stable (> 24 hours)
        stage = 'S3';
        riskScore = 0.8;
        decision = 'ALLOW';
        const days = (contractAgeMinutes / 1440).toFixed(1);
        reasons.push(`Stable stage (${days} days) - more predictable`);
        reasons.push('Lower risk but may miss early upside');
    }

    return {
        stage,
        contract_age_minutes: contractAgeMinutes,
        stage_risk_score: riskScore,
        stage_decision: decision,
        reasons,
    };
}

/**
 * Calculate contract age in minutes from creation timestamp
 */
export function calculateContractAgeMinutes(createdAt?: number | string): number {
    if (!createdAt) return 0;

    const createdTime = typeof createdAt === 'string'
        ? new Date(createdAt).getTime()
        : createdAt;

    const now = Date.now();
    const ageMs = now - createdTime;

    return Math.max(0, ageMs / (1000 * 60));
}

/**
 * Get stage label for display
 */
export function getStageLabel(stage: TokenStage): string {
    const labels: Record<TokenStage, string> = {
        'S0': 'Just created',
        'S1': 'Early',
        'S2': 'Mid',
        'S3': 'Stable',
        'S4': 'Special',
    };
    return labels[stage];
}
