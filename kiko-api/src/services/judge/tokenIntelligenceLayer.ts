/**
 * Token Intelligence Layer
 * Aggregates all 5 intelligence sub-modules
 */

import {
    TokenIntelligenceLayer,
    TokenIntelligenceLabel,
    ProjectIdentity,
    SocialPresence,
    NarrativeStrength,
    WebsiteQuality,
    RiskSignals,
} from '../../types/judgeTypes.js';

export interface TokenIntelligenceInput {
    projectIdentity: ProjectIdentity;
    socialPresence: SocialPresence;
    narrativeStrength: NarrativeStrength;
    websiteQuality: WebsiteQuality;
    riskSignals: RiskSignals;
}

/**
 * Aggregate all Token Intelligence modules into final layer
 */
export function evaluateTokenIntelligenceLayer(
    input: TokenIntelligenceInput
): TokenIntelligenceLayer {
    const reasons: string[] = [];
    const riskTags: string[] = [];

    // Calculate weighted score
    // Weights: Risk (35%), Social (25%), Identity (20%), Narrative (10%), Website (10%)
    const score = (
        input.riskSignals.score * 0.35 +
        input.socialPresence.score * 0.25 +
        input.projectIdentity.score * 0.20 +
        input.narrativeStrength.score * 0.10 +
        input.websiteQuality.score * 0.10
    );

    // Determine label
    let label: TokenIntelligenceLabel;
    if (score >= 0.75) {
        label = 'strong';
        reasons.push('项目信息完整，真实性高');
    } else if (score >= 0.50) {
        label = 'medium';
        reasons.push('项目信息中等，存在一定风险');
    } else if (score >= 0.25) {
        label = 'weak';
        reasons.push('项目信息不足，真实性存疑');
    } else {
        label = 'danger';
        reasons.push('⚠️ 项目信息严重不足或有明显危险信号');
    }

    // Generate risk tags based on individual scores

    // Risk Signals tags
    if (input.riskSignals.scam_reports_found) {
        riskTags.push('scam-reports');
    }
    if (input.riskSignals.rug_reports_found) {
        riskTags.push('rug-reports');
    }
    if (input.riskSignals.honeypot_reports_found) {
        riskTags.push('honeypot');
    }

    // Social tags
    if (input.socialPresence.score >= 0.7) {
        riskTags.push('strong-social');
        reasons.push('社交媒体活跃度高');
    } else if (input.socialPresence.score < 0.3) {
        riskTags.push('weak-social');
        reasons.push('社交媒体活跃度低或无活动');
    }

    if (input.socialPresence.has_kol_mentions) {
        riskTags.push('kol-mentioned');
    }

    // Identity tags
    if (input.projectIdentity.score < 0.3) {
        riskTags.push('no-identity');
    }
    if (!input.projectIdentity.contract_verified) {
        riskTags.push('unverified-contract');
    }

    // Narrative tags
    if (input.narrativeStrength.narrative_type !== 'unknown') {
        riskTags.push(input.narrativeStrength.narrative_type);
    }
    if (input.narrativeStrength.score < 0.4) {
        riskTags.push('weak-narrative');
    }

    // Website tags
    if (!input.websiteQuality.has_website) {
        riskTags.push('no-website');
    } else if (!input.websiteQuality.has_docs) {
        riskTags.push('no-docs');
    }
    if (input.websiteQuality.has_product) {
        riskTags.push('has-product');
    }

    // Age tags
    if (input.projectIdentity.contract_age_hours < 1) {
        riskTags.push('very-early');
    } else if (input.projectIdentity.contract_age_hours < 24) {
        riskTags.push('early-stage');
    }

    return {
        project_identity: input.projectIdentity,
        social_presence: input.socialPresence,
        narrative_strength: input.narrativeStrength,
        website_quality: input.websiteQuality,
        risk_signals: input.riskSignals,
        token_intelligence_score: score,
        token_intelligence_label: label,
        risk_tags: riskTags,
        reasons,
    };
}
