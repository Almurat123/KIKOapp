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
        reasons.push('代币已迁移 - 存在合约切换风险');
        reasons.push('迁移后状态需要额外验证');

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
        reasons.push(`刚创建 (${contractAgeMinutes.toFixed(0)} 分钟) - 极高不确定性`);
        reasons.push('价格和流动性可能剧烈波动');
        reasons.push('建议仅小额试探');

    } else if (contractAgeMinutes < 120) {
        // S1: Early (10 min - 2 hours)
        stage = 'S1';
        riskScore = 0.4;
        decision = 'ALLOW_WITH_RISK';
        const ageDisplay = contractAgeMinutes < 60
            ? `${contractAgeMinutes.toFixed(0)} 分钟`
            : `${(contractAgeMinutes / 60).toFixed(1)} 小时`;
        reasons.push(`早期阶段 (${ageDisplay}) - 高波动性`);
        reasons.push('Smart Money 入场可能带来机会');

    } else if (contractAgeMinutes < 1440) {
        // S2: Mid-term (2 - 24 hours)
        stage = 'S2';
        riskScore = 0.6;
        decision = 'ALLOW';
        const hours = (contractAgeMinutes / 60).toFixed(1);
        reasons.push(`中期阶段 (${hours} 小时) - 逐渐稳定`);
        reasons.push('已有一定交易历史可供参考');

    } else {
        // S3: Stable (> 24 hours)
        stage = 'S3';
        riskScore = 0.8;
        decision = 'ALLOW';
        const days = (contractAgeMinutes / 1440).toFixed(1);
        reasons.push(`稳定期 (${days} 天) - 相对可预测`);
        reasons.push('风险相对较低，但可能错过早期收益');
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
        'S0': '刚创建',
        'S1': '早期',
        'S2': '中期',
        'S3': '稳定期',
        'S4': '特殊阶段',
    };
    return labels[stage];
}
