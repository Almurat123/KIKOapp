// CONTEXT MEMORY
// Updated: 2026-04-23
// Author: Rowan
// Reason: model-owned image generation needs one server-owned optimizer boundary
//         between the chat model's intent-level tool call and the provider
//         prompt sent into generated-image execution. The product requirement
//         is to let the main model decide when to generate, while still keeping
//         prompt control, brand/safety defaults, and negative constraints out of
//         free-form provider prompting. A short-lived server watermark
//         experiment was removed, but this optimizer should still avoid asking
//         the provider to place logos, signatures, or watermarks inside the
//         scene itself. A later NVIDIA/GLM Farcaster trace showed some models
//         can call the image tool with structured fields like `subject` and
//         `scene` but omit `user_intent`, so this owner now has to synthesize a
//         stable intent string from those structured fields before execution.
// Goal: accept intent-level image-generation arguments, normalize them into one
//       structured prompt spec, and compile a provider prompt plus a short
//       user-safe summary without leaking provider-only controls into chat history.
// Owns: structured image prompt normalization, server-owned prompt controls,
//       negative constraint defaults, and prompt-summary generation.
// Does Not Own: provider HTTP request shape, task execution, billing, safety
//               moderation, or frontend rendering.
// Design Language:
// - the chat model may propose structured image fields, but the server owns the final provider prompt
// - prompt summaries are transcript-safe; full provider prompts stay inside execution owners
// - image prompt control should be additive and deterministic, not a second hidden model call
// - provider prompts should block extra provider/artist marks inside the scene
//   without relying on a server watermark layer
// - structured image fields may recover a missing user_intent, but the server
//   must synthesize it deterministically from provided fields instead of
//   inventing new creative direction
// - OpenAI image prompting should preserve the official method shape:
//   deliverable/use case, scene, subject, key details, composition, style,
//   lighting/camera, exact text, change, preserve, constraints, and avoid list.
//   Official Responses image-generation tool behavior also distinguishes
//   action:auto/generate/edit, so this optimizer keeps `action` as the
//   model-facing decision and derives the effective provider mode from it.
// - forbidden local patch pattern: letting provider-specific prompt strings leak directly into visible assistant history
// Document Provenance:
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-generated-image-chat-execution-and-ui.md
// - Kind: repo doc
// - Retrieved: 2026-04-18
// - Applied To: reusing transcript-native generated-image execution instead of a separate UI path
// - Verification: verified in code
// - Source: operator requirement on 2026-04-18 for model-owned image generation with prompt optimization
// - Kind: product doc
// - Retrieved: 2026-04-18
// - Applied To: intent-level tool contract plus server-owned prompt compilation
// - Verification: verified in code
// - Source: operator correction on 2026-04-19 to remove generated-image
//   watermarking while still avoiding provider-added marks inside the scene
// - Kind: product doc
// - Retrieved: 2026-04-19
// - Applied To: keeping provider prompt defaults focused on in-scene marks only
// - Verification: verified in code
// - Source: /Users/almurat/Downloads/logs.1776663333220.json
// - Kind: runtime observation
// - Retrieved: 2026-04-20
// - Applied To: synthesizing user_intent from structured image fields when
//   NVIDIA/GLM tool calls omit the required intent string
// - Verification: verified in runtime log and targeted tests
// - Source: OpenAI GPT Image Generation Models Prompting Guide
// - Kind: official OpenAI cookbook
// - Retrieved: 2026-04-22
// - Applied To: provider prompt order, edit preserve/change rules,
//   multi-image reference roles, exact text handling, and single-purpose
//   constraints for production image workflows
// - Verification: verified in targeted tests
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/generated-image-safety.md
// - /Users/almurat/KiKo/system-journal/design-language/generated-image-billing.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-generated-image-chat-execution-and-ui.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-v2-model-owned-image-generation-tool.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-farcaster-generated-image-reply-and-watermark.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-generated-image-tool-call-repair-and-farcaster-wait-window.md

export type GeneratedImageIntentMode = 'generate' | 'edit';
export type GeneratedImageToolAction = 'auto' | 'generate' | 'edit';

export interface GeneratedImageReferenceImage {
    url?: string | null;
    description?: string | null;
    purpose?: string | null;
}

export interface GeneratedImageIntentInput {
    user_intent: string;
    artifact_type?: string | null;
    style_hint?: string | null;
    aspect_ratio?: string | null;
    reference_images?: GeneratedImageReferenceImage[] | null;
    safety_level?: string | null;
    action?: GeneratedImageToolAction | string | null;
    edit_or_generate?: GeneratedImageIntentMode | string | null;
    subject?: string | null;
    scene?: string | null;
    key_details?: string | null;
    composition?: string | null;
    style?: string | null;
    lighting?: string | null;
    camera?: string | null;
    change_request?: string | null;
    preserve_elements?: string[] | null;
    exact_text?: string | null;
    text_placement?: string | null;
    typography?: string | null;
    constraints?: string[] | null;
    negative_constraints?: string[] | null;
}

export interface OptimizedGeneratedImagePromptSpec {
    action: GeneratedImageToolAction;
    editOrGenerate: GeneratedImageIntentMode;
    artifactType: string;
    subject: string;
    scene: string;
    keyDetails: string;
    composition: string;
    style: string;
    lighting: string;
    camera: string;
    changeRequest: string;
    preserveElements: string[];
    exactText: string;
    textPlacement: string;
    typography: string;
    aspectRatio: string;
    safetyLevel: 'standard' | 'strict';
    constraints: string[];
    negativeConstraints: string[];
    referenceImages: GeneratedImageReferenceImage[];
}

export interface OptimizedGeneratedImagePrompt {
    spec: OptimizedGeneratedImagePromptSpec;
    optimizedPromptSummary: string;
    providerPrompt: string;
}

const DEFAULT_ASPECT_RATIO = '1:1';
const DEFAULT_STYLE = 'high-quality, cohesive visual design';
const DEFAULT_LIGHTING = 'clean, intentional lighting';
const DEFAULT_CAMERA = 'framing that matches the requested composition';
const DEFAULT_COMPOSITION = 'single clear focal point with balanced composition';
const DEFAULT_SCENE = 'a visually coherent scene that matches the request';
const DEFAULT_ARTIFACT_TYPE = 'image';
const DEFAULT_KEY_DETAILS = 'concrete visual details that materially support the request';

function normalizeText(value: unknown): string {
    return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeList(values: unknown): string[] {
    if (!Array.isArray(values)) return [];
    return values
        .map((value) => normalizeText(value))
        .filter(Boolean);
}

function dedupe(items: string[]): string[] {
    return Array.from(new Set(items.filter(Boolean)));
}

function normalizeSafetyLevel(value: unknown): 'standard' | 'strict' {
    const normalized = normalizeText(value).toLowerCase();
    if (normalized === 'strict' || normalized === 'high') return 'strict';
    return 'standard';
}

export function normalizeGeneratedImageToolAction(value: unknown): GeneratedImageToolAction {
    const normalized = normalizeText(value).toLowerCase();
    if (normalized === 'generate' || normalized === 'edit') return normalized;
    return 'auto';
}

function inferIntentMode(params: GeneratedImageIntentInput): GeneratedImageIntentMode {
    const action = normalizeGeneratedImageToolAction(params.action);
    if (action === 'generate') return 'generate';
    if (action === 'edit') return 'edit';
    const declared = normalizeText(params.edit_or_generate).toLowerCase();
    if (declared === 'edit') return 'edit';
    if (Array.isArray(params.reference_images) && params.reference_images.length > 0) {
        return 'edit';
    }
    return 'generate';
}

function synthesizeUserIntent(params: GeneratedImageIntentInput): string {
    const parts = [
        normalizeText(params.artifact_type) ? `Deliverable: ${normalizeText(params.artifact_type)}` : '',
        normalizeText(params.subject) ? `Subject: ${normalizeText(params.subject)}` : '',
        normalizeText(params.scene) ? `Scene: ${normalizeText(params.scene)}` : '',
        normalizeText(params.key_details) ? `Key details: ${normalizeText(params.key_details)}` : '',
        normalizeText(params.style) || normalizeText(params.style_hint)
            ? `Style: ${normalizeText(params.style) || normalizeText(params.style_hint)}`
            : '',
        normalizeText(params.composition) ? `Composition: ${normalizeText(params.composition)}` : '',
        normalizeText(params.lighting) ? `Lighting: ${normalizeText(params.lighting)}` : '',
        normalizeText(params.camera) ? `Camera: ${normalizeText(params.camera)}` : '',
        normalizeText(params.change_request) ? `Change: ${normalizeText(params.change_request)}` : '',
        normalizeText(params.aspect_ratio) ? `Aspect ratio: ${normalizeText(params.aspect_ratio)}` : '',
    ].filter(Boolean);
    return parts.join('. ');
}

export function normalizeGeneratedImageIntentInput(input: GeneratedImageIntentInput): GeneratedImageIntentInput {
    return {
        ...input,
        user_intent: normalizeText(input.user_intent) || synthesizeUserIntent(input),
    };
}

function inferSubject(params: GeneratedImageIntentInput): string {
    return normalizeText(params.subject) || normalizeText(params.user_intent);
}

function inferArtifactType(params: GeneratedImageIntentInput): string {
    return normalizeText(params.artifact_type) || DEFAULT_ARTIFACT_TYPE;
}

function inferScene(params: GeneratedImageIntentInput): string {
    return normalizeText(params.scene) || DEFAULT_SCENE;
}

function inferKeyDetails(params: GeneratedImageIntentInput): string {
    return normalizeText(params.key_details) || DEFAULT_KEY_DETAILS;
}

function inferComposition(params: GeneratedImageIntentInput): string {
    return normalizeText(params.composition) || DEFAULT_COMPOSITION;
}

function inferStyle(params: GeneratedImageIntentInput): string {
    return normalizeText(params.style) || normalizeText(params.style_hint) || DEFAULT_STYLE;
}

function inferLighting(params: GeneratedImageIntentInput): string {
    return normalizeText(params.lighting) || DEFAULT_LIGHTING;
}

function inferCamera(params: GeneratedImageIntentInput): string {
    return normalizeText(params.camera) || DEFAULT_CAMERA;
}

function inferChangeRequest(params: GeneratedImageIntentInput): string {
    return normalizeText(params.change_request);
}

function inferExactText(params: GeneratedImageIntentInput): string {
    return normalizeText(params.exact_text);
}

function inferTextPlacement(params: GeneratedImageIntentInput): string {
    return normalizeText(params.text_placement);
}

function inferTypography(params: GeneratedImageIntentInput): string {
    return normalizeText(params.typography);
}

function normalizeReferenceImages(value: unknown): GeneratedImageReferenceImage[] {
    if (!Array.isArray(value)) return [];
    const normalized: GeneratedImageReferenceImage[] = [];
    for (const item of value) {
        if (!item || typeof item !== 'object') continue;
        const url = normalizeText((item as GeneratedImageReferenceImage).url);
        const description = normalizeText((item as GeneratedImageReferenceImage).description);
        const purpose = normalizeText((item as GeneratedImageReferenceImage).purpose);
        if (!url && !description) continue;
        normalized.push({
            url: url || null,
            description: description || null,
            purpose: purpose || null,
        });
    }
    return normalized;
}

function buildDefaultConstraints(spec: {
    aspectRatio: string;
    safetyLevel: 'standard' | 'strict';
    exactText?: string | null;
}): string[] {
    const base = [
        `target aspect ratio ${spec.aspectRatio}`,
        'clear primary subject and readable silhouette',
        'strong composition with natural depth and consistent perspective',
        'high detail, polished finish, and coherent color palette',
    ];
    if (normalizeText(spec.exactText)) {
        base.push('render requested text verbatim, once, with no extra characters');
    } else {
        base.push('include text only if the user explicitly asked for text in the image');
    }
    if (spec.safetyLevel === 'strict') {
        base.push('stay within a conservative brand-safe visual range');
    }
    return base;
}

function buildDefaultNegativeConstraints(safetyLevel: 'standard' | 'strict'): string[] {
    const base = [
        'no provider-generated watermark, artist signature, or logo inside the scene',
        'no unintended extra limbs or duplicated subjects',
        'no distorted anatomy',
        'no blurry low-detail output',
        'no broken hands or malformed facial features',
        'no random unreadable text',
    ];
    if (safetyLevel === 'strict') {
        base.push('no graphic violence');
        base.push('no explicit nudity');
        base.push('no hateful or extremist imagery');
    }
    return base;
}

function buildProviderPrompt(spec: OptimizedGeneratedImagePromptSpec): string {
    const lines = [
        `Create an original ${spec.editOrGenerate === 'edit' ? 'image revision' : spec.artifactType} for this use case.`,
        `Scene/background: ${spec.scene}`,
        `Subject: ${spec.subject}`,
        `Key details: ${spec.keyDetails}`,
        `Composition: ${spec.composition}`,
        `Style: ${spec.style}`,
        `Lighting: ${spec.lighting}`,
        `Camera framing: ${spec.camera}`,
    ];
    if (spec.referenceImages.length > 0) {
        const referenceSummary = spec.referenceImages
            .map((item, index) => {
                const parts = [
                    item.description ? `desc=${item.description}` : '',
                    item.purpose ? `purpose=${item.purpose}` : '',
                ].filter(Boolean);
                return `reference ${index + 1}${parts.length > 0 ? ` (${parts.join(', ')})` : ''}`;
            })
            .join('; ');
        lines.push(`Input image roles: ${referenceSummary}`);
    }
    if (spec.changeRequest) {
        lines.push(`Change: ${spec.changeRequest}`);
    }
    if (spec.preserveElements.length > 0) {
        lines.push(`Preserve: ${spec.preserveElements.join('; ')}`);
    }
    if (spec.exactText) {
        const textRules = [
            `"${spec.exactText}"`,
            'rendered verbatim',
            spec.textPlacement ? `placement: ${spec.textPlacement}` : '',
            spec.typography ? `typography: ${spec.typography}` : '',
        ].filter(Boolean);
        lines.push(`Text: ${textRules.join('; ')}`);
    }
    lines.push(`Hard constraints: ${spec.constraints.join('; ')}`);
    lines.push(`Avoid: ${spec.negativeConstraints.join('; ')}`);
    lines.push(`Output surface: ${spec.aspectRatio}`);
    lines.push('Keep the image visually clean, intentional, and faithful to the requested subject.');
    return lines.join('\n');
}

function buildPromptSummary(spec: OptimizedGeneratedImagePromptSpec): string {
    const summaryBits = [
        spec.subject,
        spec.style !== DEFAULT_STYLE ? spec.style : '',
        spec.composition !== DEFAULT_COMPOSITION ? spec.composition : '',
        spec.aspectRatio !== DEFAULT_ASPECT_RATIO ? `${spec.aspectRatio} frame` : '',
    ].filter(Boolean);
    return summaryBits.join(' | ');
}

export function optimizeGeneratedImagePrompt(input: GeneratedImageIntentInput): OptimizedGeneratedImagePrompt {
    const normalizedInput = normalizeGeneratedImageIntentInput(input);
    const userIntent = normalizeText(normalizedInput.user_intent);
    if (!userIntent) {
        throw new Error('user_intent is required for image generation.');
    }

    const safetyLevel = normalizeSafetyLevel(normalizedInput.safety_level);
    const action = normalizeGeneratedImageToolAction(normalizedInput.action);
    const spec: OptimizedGeneratedImagePromptSpec = {
        action,
        editOrGenerate: inferIntentMode(normalizedInput),
        artifactType: inferArtifactType(normalizedInput),
        subject: inferSubject(normalizedInput),
        scene: inferScene(normalizedInput),
        keyDetails: inferKeyDetails(normalizedInput),
        composition: inferComposition(normalizedInput),
        style: inferStyle(normalizedInput),
        lighting: inferLighting(normalizedInput),
        camera: inferCamera(normalizedInput),
        changeRequest: inferChangeRequest(normalizedInput),
        preserveElements: normalizeList(normalizedInput.preserve_elements),
        exactText: inferExactText(normalizedInput),
        textPlacement: inferTextPlacement(normalizedInput),
        typography: inferTypography(normalizedInput),
        aspectRatio: normalizeText(normalizedInput.aspect_ratio) || DEFAULT_ASPECT_RATIO,
        safetyLevel,
        constraints: dedupe([
            ...buildDefaultConstraints({
                aspectRatio: normalizeText(normalizedInput.aspect_ratio) || DEFAULT_ASPECT_RATIO,
                safetyLevel,
                exactText: normalizedInput.exact_text,
            }),
            ...normalizeList(normalizedInput.constraints),
        ]),
        negativeConstraints: dedupe([
            ...buildDefaultNegativeConstraints(safetyLevel),
            ...normalizeList(normalizedInput.negative_constraints),
        ]),
        referenceImages: normalizeReferenceImages(normalizedInput.reference_images),
    };

    return {
        spec,
        optimizedPromptSummary: buildPromptSummary(spec),
        providerPrompt: buildProviderPrompt(spec),
    };
}
