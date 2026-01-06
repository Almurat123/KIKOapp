/**
 * Project Identity Module
 * Evaluates if token is a "real project" vs just a contract + image
 */

import { ProjectIdentity } from '../../../types/judgeTypes.js';

export interface ProjectIdentityInput {
    hasOfficialTwitter: boolean;
    hasTeamIdentity: boolean;
    hasLogo: boolean;
    hasDescription: boolean;
    contractVerified: boolean;
    contractAgeHours: number;
    metadataQuality: number;  // 0-1 from launchpad
}

export function evaluateProjectIdentity(input: ProjectIdentityInput): ProjectIdentity {
    let score = 0;

    // Official Twitter (important)
    if (input.hasOfficialTwitter) {
        score += 0.20;
    }

    // Team identity
    if (input.hasTeamIdentity) {
        score += 0.10;
    }

    // Logo (basic branding)
    if (input.hasLogo) {
        score += 0.10;
    }

    // Description
    if (input.hasDescription) {
        score += 0.10;
    }

    // Contract verified (trustworthy)
    if (input.contractVerified) {
        score += 0.20;
    }

    // Age bonus (established projects)
    if (input.contractAgeHours > 24) {
        score += 0.10;
    } else if (input.contractAgeHours > 168) { // 1 week
        score += 0.15;
    }

    // Metadata quality
    score += input.metadataQuality * 0.15;

    // Clamp to 0-1
    score = Math.max(0, Math.min(1, score));

    return {
        has_official_twitter: input.hasOfficialTwitter,
        has_team_identity: input.hasTeamIdentity,
        has_logo: input.hasLogo,
        has_description: input.hasDescription,
        contract_verified: input.contractVerified,
        contract_age_hours: input.contractAgeHours,
        launchpad_metadata_quality: input.metadataQuality,
        score,
    };
}
