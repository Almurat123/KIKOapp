/**
 * Website Quality Module
 * Evaluates if website is professional vs hastily made
 */

import { WebsiteQuality } from '../../../types/judgeTypes.js';

export interface WebsiteQualityInput {
    hasWebsite: boolean;
    websiteReachable: boolean;
    designQuality: number;       // 0-1 from LLM analysis
    contentDepth: number;        // 0-1 from LLM analysis
    hasDocs: boolean;
    hasProduct: boolean;
}

export function evaluateWebsiteQuality(input: WebsiteQualityInput): WebsiteQuality {
    let score = 0;

    // Has website at all
    if (!input.hasWebsite) {
        return {
            has_website: false,
            website_reachable: false,
            website_design_quality: 0,
            website_content_depth: 0,
            has_docs: false,
            has_product: false,
            score: 0.3,  // Not terrible - some memes don't need websites
        };
    }

    // Website exists
    score += 0.15;

    // Website reachable
    if (!input.websiteReachable) {
        return {
            has_website: true,
            website_reachable: false,
            website_design_quality: 0,
            website_content_depth: 0,
            has_docs: false,
            has_product: false,
            score: 0.2,  // Worse than no website
        };
    }

    score += 0.10;  // Reachable bonus

    // Design quality
    score += input.designQuality * 0.25;

    // Content depth
    score += input.contentDepth * 0.25;

    // Documentation
    if (input.hasDocs) {
        score += 0.15;
    }

    // Real product
    if (input.hasProduct) {
        score += 0.10;
    }

    // Clamp to 0-1
    score = Math.max(0, Math.min(1, score));

    return {
        has_website: input.hasWebsite,
        website_reachable: input.websiteReachable,
        website_design_quality: input.designQuality,
        website_content_depth: input.contentDepth,
        has_docs: input.hasDocs,
        has_product: input.hasProduct,
        score,
    };
}
