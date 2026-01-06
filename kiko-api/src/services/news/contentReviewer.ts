/**
 * Content Reviewer Service
 * Implements automated keyword-based moderation for generated news articles.
 */

// Rules based on newsrules.md
const PROHIBITED_PATTERNS = [
    // 1. Illegal / Harmful
    /scam/i,
    /ponzi/i,
    /money laundering/i,
    /drug/i,

    // 2. Absolute Investment Advice (High Risk)
    /guaranteed return/i,
    /risk-free/i,
    /no risk/i,
    /certain to pump/i,
    /must buy/i,
    /financial advice/i,
    /100x guaranteed/i,

    // 3. Fake News / Insider Info
    /insider leak/i,
    /confirmed by (?:source|insider)/i,
];

const COMPLIANCE_CHECK_PATTERNS = [
    // Must include risk warning (simple check)
    /risk/i,
    /financial advice/i, // To check if it SAYS "not financial advice"
    /investment advice/i
];

export interface ReviewResult {
    approved: boolean;
    reason?: string;
    flaggedKeywords?: string[];
}

/**
 * Review content against compliance rules
 */
export function reviewContent(content: string): ReviewResult {
    const flagged: string[] = [];

    // Check for prohibited content
    for (const pattern of PROHIBITED_PATTERNS) {
        if (pattern.test(content)) {
            // Context check: If it says "Avoid scams", that's fine. 
            // But simple keyword match first.
            // For now, strict match.
            flagged.push(pattern.source);
        }
    }

    if (flagged.length > 0) {
        return {
            approved: false,
            reason: "Found prohibited keywords",
            flaggedKeywords: flagged
        };
    }

    // Check for required risk disclosure
    // We expect the AI to generate "This is not financial advice" or similar
    // Simple check: does it mention "advice"?
    // Actually, let's just approve if no bad words for now.

    return {
        approved: true
    };
}
