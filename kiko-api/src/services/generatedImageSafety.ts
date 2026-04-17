// CONTEXT MEMORY
// Updated: 2026-04-17
// Author: Rowan
// Reason: generated-image models need a stricter safety boundary than ordinary
//         chat because unsafe imagery can become a durable public Farcaster
//         asset. The strict policy must stay out of normal chat paths.
// Goal: require fail-closed moderation before prompt submission, after image
//       generation, and before social publication.
// Owns: generated-image safety stage orchestration and block/error semantics.
// Does Not Own: image model invocation, R2 storage, chat worker moderation, or
//               Farcaster cast publication.
// Design Language:
// - generated-image prompts must be checked before provider calls
// - generated outputs must be checked while still private or quarantined
// - Farcaster publish payloads must be checked immediately before exposure
// - moderation outage blocks generated-image flow instead of falling back open
// - normal chat must not import or depend on this strict generated-image owner
// Document Provenance:
// - Source: OpenAI Moderation guide and Moderations API OpenAPI spec
// - Kind: official API doc
// - Retrieved: 2026-04-17
// - Applied To: strict generated-image text + image_url moderation stages
// - Verification: verified in docs and code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/generated-image-safety.md
// - /Users/almurat/KiKo/system-journal/owner-map/generated-image-safety.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-generated-image-safety-gate.md

import {
    moderationClient,
    type GeneratedImageModerationStage,
    type ModerationResult,
} from './moderationClient.js';

export { type GeneratedImageModerationStage } from './moderationClient.js';

export interface GeneratedImageSafetyContext {
    userId?: string | null;
    sessionId?: string | null;
    assetId?: string | null;
    provider?: string | null;
    model?: string | null;
    source?: 'web' | 'agent' | 'farcaster' | string | null;
}

export interface GeneratedImageSafetyRequest extends GeneratedImageSafetyContext {
    stage: GeneratedImageModerationStage;
    text?: string | null;
    imageUrls?: string[] | null;
}

export interface GeneratedImageSafetyPass {
    safe: true;
    stage: GeneratedImageModerationStage;
    moderation: ModerationResult;
}

export class GeneratedImageSafetyError extends Error {
    readonly statusCode = 400;
    readonly code = 'GENERATED_IMAGE_SAFETY_BLOCKED';
    readonly stage: GeneratedImageModerationStage;
    readonly categories: string[];
    readonly moderation: ModerationResult | null;

    constructor(params: {
        stage: GeneratedImageModerationStage;
        message?: string;
        categories?: string[];
        moderation?: ModerationResult | null;
    }) {
        super(params.message || buildBlockedMessage(params.stage, params.categories || []));
        this.name = 'GeneratedImageSafetyError';
        this.stage = params.stage;
        this.categories = params.categories || [];
        this.moderation = params.moderation || null;
    }
}

function normalizeText(value?: string | null): string {
    return String(value || '').trim();
}

function normalizeImageUrls(values?: string[] | null): string[] {
    return (Array.isArray(values) ? values : [])
        .map((value) => String(value || '').trim())
        .filter(Boolean);
}

function extractFlaggedCategories(moderation: ModerationResult | null | undefined): string[] {
    const categories = (
        moderation?.checks?.openai?.categories
        || moderation?.verification?.categories
        || {}
    ) as Record<string, unknown>;

    return Object.entries(categories)
        .filter(([, flagged]) => Boolean(flagged))
        .map(([category]) => category);
}

function buildBlockedMessage(stage: GeneratedImageModerationStage, categories: string[]): string {
    const suffix = categories.length > 0 ? ` (${categories.join(', ')})` : '';
    return `Generated image ${stage} blocked by safety policy${suffix}`;
}

function assertCheckablePayload(stage: GeneratedImageModerationStage, text: string, imageUrls: string[]): void {
    if (text || imageUrls.length > 0) return;
    throw new GeneratedImageSafetyError({
        stage,
        message: 'Generated image safety check requires text or image input',
        categories: ['empty_image_generation_moderation_input'],
        moderation: null,
    });
}

export async function evaluateGeneratedImageSafety(
    request: GeneratedImageSafetyRequest,
): Promise<GeneratedImageSafetyPass> {
    const text = normalizeText(request.text);
    const imageUrls = normalizeImageUrls(request.imageUrls);
    assertCheckablePayload(request.stage, text, imageUrls);

    const moderation = await moderationClient.moderateGeneratedImage({
        text,
        imageUrls,
        stage: request.stage,
        userId: request.userId,
        sessionId: request.sessionId,
        model: request.model,
        context: {
            assetId: request.assetId || undefined,
            provider: request.provider || undefined,
            source: request.source || undefined,
        },
    });

    if (moderation.safe !== true || moderation.action === 'block') {
        const categories = extractFlaggedCategories(moderation);
        throw new GeneratedImageSafetyError({
            stage: request.stage,
            categories,
            moderation,
        });
    }

    return {
        safe: true,
        stage: request.stage,
        moderation,
    };
}

export function isGeneratedImageSafetyError(error: unknown): error is GeneratedImageSafetyError {
    return error instanceof GeneratedImageSafetyError
        || String((error as any)?.code || '') === 'GENERATED_IMAGE_SAFETY_BLOCKED';
}

export async function assertGeneratedImagePromptSafe(params: Omit<GeneratedImageSafetyRequest, 'stage'>) {
    return evaluateGeneratedImageSafety({
        ...params,
        stage: 'prompt',
    });
}

export async function assertGeneratedImageReferenceInputSafe(params: Omit<GeneratedImageSafetyRequest, 'stage'>) {
    return evaluateGeneratedImageSafety({
        ...params,
        stage: 'reference_input',
    });
}

export async function assertGeneratedImageOutputSafe(params: Omit<GeneratedImageSafetyRequest, 'stage'>) {
    return evaluateGeneratedImageSafety({
        ...params,
        stage: 'generated_output',
    });
}

export async function assertGeneratedImagePublishSafe(params: Omit<GeneratedImageSafetyRequest, 'stage'>) {
    return evaluateGeneratedImageSafety({
        ...params,
        stage: 'publish',
    });
}

export const __generatedImageSafetyTest = {
    extractFlaggedCategories,
    normalizeImageUrls,
};
