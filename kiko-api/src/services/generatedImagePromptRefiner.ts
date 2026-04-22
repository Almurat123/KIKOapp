// CONTEXT MEMORY
// Updated: 2026-04-22
// Status: mixed
// Why: generated-image execution needs an optional GPT prompt-refinement pass
// after the main chat model has packaged user intent into structured image
// fields and after the deterministic server optimizer has produced an
// OpenAI-style provider prompt.
// Debug Goal: image-generation turns should send the image provider a
// GPT-refined OpenAI image prompt when available, while never blocking image
// generation if the refiner call is unavailable or malformed.
// Search Tags: generated image GPT prompt refiner second pass OpenAI image prompt
// Invariants:
// - The refiner may rewrite wording but must preserve user intent and hard constraints.
// - Refiner failure must fall back to the deterministic provider prompt.
// Failure Modes:
// - Treating refiner errors as fatal prevents Farcaster image replies.
// - Allowing the refiner to add unrelated creative direction causes prompt drift.

import type { OptimizedGeneratedImagePromptSpec } from './generatedImagePromptOptimizer.js';

export interface GeneratedImagePromptRefinerInput {
    userIntent: string;
    draftProviderPrompt: string;
    spec: OptimizedGeneratedImagePromptSpec;
}

export interface GeneratedImagePromptRefinerResult {
    prompt: string;
    usedRefiner: boolean;
    model: string | null;
    errorMessage?: string | null;
}

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_REFINER_MODEL = 'gpt-5.4-mini-2026-03-17';
const MAX_REFINED_PROMPT_CHARS = 6_000;

function normalizeText(value: unknown): string {
    return String(value || '').trim();
}

function resolveRefinerModel(): string {
    return normalizeText(process.env.GENERATED_IMAGE_PROMPT_REFINER_MODEL)
        || normalizeText(process.env.IMAGE_PROMPT_EVAL_MODEL)
        || DEFAULT_REFINER_MODEL;
}

function resolveOpenAiChatUrl(): string {
    return normalizeText(process.env.OPENAI_API_URL) || OPENAI_CHAT_COMPLETIONS_URL;
}

function buildRefinerSystemPrompt(): string {
    return [
        'You are an OpenAI image prompting expert for GPT Image workflows.',
        'Rewrite the provided draft into one final image-generation prompt.',
        'Follow OpenAI image prompting guidance: intended use case, scene/background, subject, key details, composition, style/medium, lighting/camera, exact text, change, preserve, constraints, and avoid list.',
        'For edits and references, keep Change and Preserve explicit. For exact text, quote it verbatim and require no extra characters.',
        'Preserve the user intent and all hard constraints. Do not add unrelated subjects, brands, claims, text, logos, or style changes.',
        'Return JSON only with this shape: {"prompt":"..."}',
    ].join('\n');
}

function buildRefinerUserPrompt(input: GeneratedImagePromptRefinerInput): string {
    return [
        `Original user intent:\n${input.userIntent}`,
        '',
        `Structured image spec:\n${JSON.stringify({
            edit_or_generate: input.spec.editOrGenerate,
            artifact_type: input.spec.artifactType,
            subject: input.spec.subject,
            scene: input.spec.scene,
            key_details: input.spec.keyDetails,
            composition: input.spec.composition,
            style: input.spec.style,
            lighting: input.spec.lighting,
            camera: input.spec.camera,
            change: input.spec.changeRequest,
            preserve: input.spec.preserveElements,
            exact_text: input.spec.exactText,
            text_placement: input.spec.textPlacement,
            typography: input.spec.typography,
            aspect_ratio: input.spec.aspectRatio,
            constraints: input.spec.constraints,
            avoid: input.spec.negativeConstraints,
            reference_images: input.spec.referenceImages.map((image, index) => ({
                index: index + 1,
                description: image.description || null,
                purpose: image.purpose || null,
            })),
        }, null, 2)}`,
        '',
        `Draft OpenAI image prompt:\n${input.draftProviderPrompt}`,
        '',
        'Return the final prompt only in JSON. Keep it concise but complete.',
    ].join('\n');
}

function extractPromptFromResponse(payload: any): string {
    const content = normalizeText(payload?.choices?.[0]?.message?.content);
    if (!content) return '';
    try {
        const parsed = JSON.parse(content);
        return normalizeText(parsed?.prompt);
    } catch {
        return content;
    }
}

function validateRefinedPrompt(prompt: string): string {
    const normalized = normalizeText(prompt);
    if (!normalized) return '';
    if (normalized.length > MAX_REFINED_PROMPT_CHARS) {
        return normalized.slice(0, MAX_REFINED_PROMPT_CHARS).trim();
    }
    return normalized;
}

export async function refineGeneratedImagePromptWithOpenAi(
    input: GeneratedImagePromptRefinerInput,
): Promise<GeneratedImagePromptRefinerResult> {
    const fallbackPrompt = input.draftProviderPrompt;
    const apiKey = normalizeText(process.env.OPENAI_API_KEY);
    const model = resolveRefinerModel();
    if (!apiKey) {
        return {
            prompt: fallbackPrompt,
            usedRefiner: false,
            model,
            errorMessage: 'OPENAI_API_KEY is not configured',
        };
    }

    try {
        const response = await fetch(resolveOpenAiChatUrl(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                temperature: 0.2,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: buildRefinerSystemPrompt() },
                    { role: 'user', content: buildRefinerUserPrompt(input) },
                ],
            }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
            return {
                prompt: fallbackPrompt,
                usedRefiner: false,
                model,
                errorMessage: `OpenAI prompt refiner failed (${response.status})`,
            };
        }
        const refinedPrompt = validateRefinedPrompt(extractPromptFromResponse(payload));
        if (!refinedPrompt) {
            return {
                prompt: fallbackPrompt,
                usedRefiner: false,
                model,
                errorMessage: 'OpenAI prompt refiner returned an empty prompt',
            };
        }
        return {
            prompt: refinedPrompt,
            usedRefiner: true,
            model,
            errorMessage: null,
        };
    } catch (error) {
        return {
            prompt: fallbackPrompt,
            usedRefiner: false,
            model,
            errorMessage: error instanceof Error ? error.message : String(error),
        };
    }
}

export const __generatedImagePromptRefinerTest = {
    buildRefinerSystemPrompt,
    buildRefinerUserPrompt,
    extractPromptFromResponse,
    validateRefinedPrompt,
};
