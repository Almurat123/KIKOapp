// CONTEXT MEMORY
// Updated: 2026-04-23
// Status: mixed
// Why: generated-image provider USD cost and user-facing credits pricing were
// previously duplicated in separate files. That drift-prone split makes one
// family easy to update while the other silently keeps stale user charges.
// Debug Goal: keep image provider cost snapshots and default credits charges
// derived from the same source for both OpenAI and xAI image models.
// Search Tags: image provider usd cost credits pricing default markup multiplier
// Invariants:
// - Default image credits pricing is derived from provider USD cost, not typed twice.
// - Both OpenAI image models and Grok image models use the same conversion rule.
// Failure Modes:
// - Updating provider USD cost without updating default credits pricing.
// - Showing one image price in billing while reserve/capture charges another.

export const DEFAULT_GENERATED_IMAGE_CREDIT_MARKUP_MULTIPLIER = 3;

export const DEFAULT_GENERATED_IMAGE_PROVIDER_USD_PRICING = {
    'gpt-image-1-mini': {
        low: 0.005,
        medium: 0.011,
        high: 0.036,
    },
    'gpt-image-2': {
        low: 0.006,
        medium: 0.053,
        high: 0.211,
    },
    'grok-imagine-image': {
        normal: 0.02,
    },
    'grok-imagine-image-pro': {
        pro: 0.07,
    },
} as const;

function normalizePricingModelKey(model: string): string {
    return String(model || '').trim().toLowerCase();
}

function normalizePricingQualityKey(quality?: string | null): string {
    return String(quality || '').trim().toLowerCase() || 'default';
}

function roundPricingNumber(value: number): number {
    return Number(value.toFixed(8));
}

export function getDefaultGeneratedImageUsdPrice(model: string, quality?: string | null): number | null {
    const familyPricing = DEFAULT_GENERATED_IMAGE_PROVIDER_USD_PRICING[
        normalizePricingModelKey(model) as keyof typeof DEFAULT_GENERATED_IMAGE_PROVIDER_USD_PRICING
    ];
    if (!familyPricing) return null;
    const qualityKey = normalizePricingQualityKey(quality) as keyof typeof familyPricing;
    const direct = familyPricing[qualityKey];
    if (typeof direct === 'number' && Number.isFinite(direct)) return direct;
    const first = Object.values(familyPricing)[0];
    return typeof first === 'number' && Number.isFinite(first) ? first : null;
}

export function buildDefaultCreditImagePricing(
    creditsPerUsd: number,
    markupMultiplier = DEFAULT_GENERATED_IMAGE_CREDIT_MARKUP_MULTIPLIER,
): Record<string, Record<string, number>> {
    const safeCreditsPerUsd = Number.isFinite(creditsPerUsd) ? creditsPerUsd : 10;
    const safeMarkupMultiplier = Number.isFinite(markupMultiplier) ? markupMultiplier : DEFAULT_GENERATED_IMAGE_CREDIT_MARKUP_MULTIPLIER;

    return Object.fromEntries(
        Object.entries(DEFAULT_GENERATED_IMAGE_PROVIDER_USD_PRICING).map(([model, qualityPricing]) => [
            model,
            Object.fromEntries(
                Object.entries(qualityPricing).map(([quality, usdPrice]) => [
                    quality,
                    roundPricingNumber(usdPrice * safeCreditsPerUsd * safeMarkupMultiplier),
                ]),
            ),
        ]),
    );
}
