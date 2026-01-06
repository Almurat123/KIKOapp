/**
 * Risk Signals Module
 * Detects scam/rug/honeypot reports and negative sentiment
 */

import { RiskSignals } from '../../../types/judgeTypes.js';

export interface RiskSignalsInput {
    scamReportsFound: boolean;
    rugReportsFound: boolean;
    honeypotReportsFound: boolean;
    negativeSentimentScore: number;  // 0-1, higher = more negative
    deployerReputation: number;      // 0-1, higher = better
}

export function evaluateRiskSignals(input: RiskSignalsInput): RiskSignals {
    let score = 1.0;  // Start at 100% safe

    // Critical red flags - immediate severe penalties
    if (input.honeypotReportsFound) {
        score = 0;  // Honeypot = instant fail
    } else if (input.rugReportsFound) {
        score = Math.min(score, 0.1);  // Rug reports = very dangerous
    } else if (input.scamReportsFound) {
        score -= 0.4;  // Scam reports = major concern
    }

    // Negative sentiment
    score -= input.negativeSentimentScore * 0.3;

    // Deployer reputation (good deployer = bonus)
    if (input.deployerReputation > 0.7) {
        score += 0.2;
    } else if (input.deployerReputation < 0.3) {
        score -= 0.2;
    }

    // Clamp to 0-1
    score = Math.max(0, Math.min(1, score));

    return {
        scam_reports_found: input.scamReportsFound,
        rug_reports_found: input.rugReportsFound,
        honeypot_reports_found: input.honeypotReportsFound,
        negative_sentiment_score: input.negativeSentimentScore,
        deployer_reputation: input.deployerReputation,
        score,
    };
}
