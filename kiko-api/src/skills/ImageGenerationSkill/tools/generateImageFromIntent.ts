import { Tool } from '../../../tooling/registry.js';
import * as chatRepo from '../../../repositories/chatRepository.js';
import { chatWS } from '../../../services/chatWebSocket.js';
import {
    hasTaskChatImageInputs,
    loadTaskChatImageInputs,
} from '../../../services/chatImageUploads.js';
import {
    buildGeneratedImagePendingData,
    executeGeneratedImageChatTask,
} from '../../../services/generatedImageChatTask.js';
import {
    normalizeGeneratedImageIntentInput,
    normalizeGeneratedImageToolAction,
    optimizeGeneratedImagePrompt,
    type GeneratedImageIntentInput,
} from '../../../services/generatedImagePromptOptimizer.js';
import { refineGeneratedImagePromptWithOpenAi } from '../../../services/generatedImagePromptRefiner.js';
import { resolveAvailableGeneratedImagePreference } from '../../../services/generatedImageBilling.js';
import {
    supportsGeneratedImageReferenceInputModel,
    type GeneratedImageProviderInputImage,
} from '../../../services/generatedImageProviders.js';
import { normalizeSocialImageUrl } from '../../../services/socialAgentInput.js';

// CONTEXT MEMORY
// Updated: 2026-04-23
// Author: Rowan
// Reason: chat v2 now needs an internal image-generation skill that the main
//         model can call directly from the ordinary chat surface. Product
//         requires the model to decide whether to generate, optimize the prompt
//         first, then hand execution into the existing generated-image owner
//         without exposing provider-specific args or forcing a separate model picker.
//         Farcaster-originated tool calls must preserve their source label so
//         generated-image storage can publish a stable public embed URL instead
//         of an expiring private preview URL. A 2026-04-20 runtime trace showed
//         ordinary Web chat users with linked Farcaster profiles were being
//         misclassified as Farcaster-originated image tasks, forcing public URL
//         publication and failing when the local public CDN base was absent.
//         Later runtime logs also showed NVIDIA/GLM image-tool calls can omit
//         `user_intent` while still providing structured fields like `subject`
//         and `scene`, so this tool now has to normalize the intent payload
//         before delegating into the optimizer. The OpenAI Responses image
//         generation tool separates `action:auto/generate/edit` from direct
//         image-model execution, so this tool now preserves that action concept
//         while still delegating provider execution into KiKo's image task owner.
// Goal: expose one intent-level `generate_image_from_intent` tool that rewrites
//       image direction into a controlled provider prompt and then converts the
//       current assistant turn into a generated-image task inside the same transcript.
// Owns: tool schema, prompt-optimizer handoff, assistant-message conversion to
//       generated-image, and synchronous delegation into the generated-image task owner.
// Does Not Own: provider request details, image safety, billing, or generated-image UI rendering.
// Design Language:
// - this tool is intent-level, not provider-level
// - the current assistant message is reused; do not create a second assistant row for the same turn
// - the model should call this tool only when the user is actually requesting an image, not when discussing prompts abstractly
// - do not ask for a second confirmation before generation once the model has enough constraints to proceed
// - forbidden local patch pattern: passing raw provider-only prompt fragments back into visible chat history
// - preserve social source labels when delegating into generated-image execution
//   so downstream storage can decide whether a public publication copy is needed
// - linked Farcaster profile data is identity context only; it must not by itself
//   turn ordinary Web chat image generation into social publication
// - structured image fields may recover missing user_intent before optimizer
//   handoff, but this tool still must not invent new user-facing intent beyond
//   the provided image fields
// - Model-led image generation must honor saved image-model preferences in tool
//   context before any fallback. Farcaster, X, and Web chat all carry the
//   preference in tool context, but the text model still decides whether this
//   tool is called.
// - current task images are real reference/edit inputs, not just prompt
//   decoration; when present they must be passed into generated-image execution
//   so the OpenAI provider can use the edits endpoint with image references.
// - inbound X/Farcaster social images are also real reference/edit inputs, not
//   just analysis context for the text model. If the user asks to edit or
//   generate from the post image, those exact image URLs must reach the image
//   provider instead of relying on GPT-only textual restatement.
// - after deterministic prompt compilation, an optional GPT refiner may rewrite
//   the provider prompt into a final OpenAI image prompt. Refiner failure must
//   fall back to the deterministic prompt so image execution still proceeds.
// - `action:auto` follows the official Responses tool mental model: generate
//   without source images and edit when usable source/reference images exist.
//   In this intent-level tool, `action:generate` means "make a new output image";
//   it must not discard current-turn reference images from social/uploads.
//   Forced `edit` still needs source/reference images.
// Document Provenance:
// - Source: operator requirement on 2026-04-18 for model-owned image generation inside main chat
// - Kind: product doc
// - Retrieved: 2026-04-18
// - Applied To: intent-level image tool contract and same-turn generated-image handoff
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-generated-image-chat-execution-and-ui.md
// - Kind: repo doc
// - Retrieved: 2026-04-18
// - Applied To: transcript-native assistant generated-image message reuse
// - Verification: verified in code
// - Source: operator correction on 2026-04-19 for production-stable Farcaster image embeds
// - Kind: product doc
// - Retrieved: 2026-04-19
// - Applied To: propagating Farcaster source into generated-image execution
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/test.txt
// - Kind: runtime observation
// - Retrieved: 2026-04-20
// - Applied To: requiring explicit Farcaster page/runtime source before public
//   generated-image publication is requested
// - Verification: verified in code and targeted test
// - Source: /Users/almurat/Downloads/logs.1776663333220.json
// - Kind: runtime observation
// - Retrieved: 2026-04-20
// - Applied To: normalizing missing `user_intent` from structured image fields
//   before optimizer handoff for NVIDIA/GLM image-tool turns
// - Verification: verified in runtime log and targeted tests
// - Source: operator request on 2026-04-20 to make GPT Image 1 Mini the
//   product-wide default generated-image model while still honoring explicit
//   user image-model preferences
// - Kind: product doc
// - Retrieved: 2026-04-20
// - Applied To: image-model family default selection inside the image tool
// - Verification: verified in code and targeted tests
// - Source: operator correction on 2026-04-21 that Farcaster image generation
//   should be decided by the model, while still honoring saved image-model
//   preferences once the model calls the tool
// - Kind: product doc
// - Retrieved: 2026-04-21
// - Applied To: reading generatedImagePreference from tool context before
//   falling back to GPT Image 1 Mini
// - Verification: verified in targeted tests
// - Source: OpenAI Image generation guide and openai-imagegen-demo
// - Kind: official API doc and official demo
// - Retrieved: 2026-04-22
// - Applied To: treating attached/reference images as image edit/reference
//   inputs for generated-image execution, not as prompt-only text context
// - Verification: verified in targeted tests
// - Source: operator request on 2026-04-22 for a GPT second-pass image prompt optimizer
// - Kind: product instruction
// - Retrieved: 2026-04-22
// - Applied To: optional GPT prompt-refinement pass before image provider execution
// - Verification: verified in targeted tests
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/generated-image-safety.md
// - /Users/almurat/KiKo/system-journal/design-language/generated-image-billing.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-generated-image-chat-execution-and-ui.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-v2-model-owned-image-generation-tool.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-farcaster-generated-image-reply-and-watermark.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-generated-image-source-classification.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-generated-image-tool-call-repair-and-farcaster-wait-window.md

function resolveImageToolContext(context?: Record<string, any>) {
    const snapshot = context?.__snapshot || null;
    const taskId = String(snapshot?.taskId || context?.taskId || '').trim();
    const sessionId = String(context?.sessionId || snapshot?.sessionId || '').trim();
    const assistantMessageId = String(context?.assistantMessageId || snapshot?.assistantMessageId || '').trim();
    const userId = String(context?.userId || snapshot?.runtime?.userId || '').trim();
    const taskModel = String(snapshot?.model || context?.model || '').trim();
    const generatedImagePreference = {
        model: String(context?.generatedImagePreference?.model || snapshot?.runtime?.generatedImagePreference?.model || '').trim(),
        quality: String(context?.generatedImagePreference?.quality || snapshot?.runtime?.generatedImagePreference?.quality || '').trim(),
    };
    return {
        snapshot,
        taskId,
        sessionId,
        assistantMessageId,
        userId,
        taskModel,
        generatedImagePreference,
        source: resolveGeneratedImageSource(context, snapshot),
    };
}

function resolveGeneratedImageSource(context?: Record<string, any>, snapshot?: any): 'farcaster' | 'x' | 'chat-v2-tool' {
    const currentPage = String(context?.currentPage || snapshot?.runtime?.currentPage || '').trim().toLowerCase();
    const pageContext = String(context?.pageContext || snapshot?.runtime?.pageContext || '').trim().toLowerCase();
    if (currentPage === 'farcaster' || pageContext === 'farcaster_agent') {
        return 'farcaster';
    }
    if (currentPage === 'x' || pageContext === 'x_agent') {
        return 'x';
    }
    return 'chat-v2-tool';
}

function pickDefaultGeneratedImageModel(_taskModel?: string | null): 'gpt-image-1-mini' | 'gpt-image-2' | 'grok-imagine-image' {
    const resolved = resolveAvailableGeneratedImagePreference([
        { model: 'gpt-image-1-mini' },
        { model: 'grok-imagine-image' },
        { model: 'gpt-image-2' },
    ]);
    return (resolved.model || 'gpt-image-1-mini') as 'gpt-image-1-mini' | 'gpt-image-2' | 'grok-imagine-image';
}

function resolveGeneratedImageToolPreference(context?: Record<string, any>, taskModel?: string | null): {
    requestedModel: string;
    quality: string | null;
} {
    return resolveGeneratedImageToolPreferenceWithOptions(context, taskModel, {
        hasReferenceInputs: false,
    });
}

function resolveGeneratedImageToolPreferenceWithOptions(
    context?: Record<string, any>,
    taskModel?: string | null,
    options: {
        hasReferenceInputs?: boolean;
    } = {},
): {
    requestedModel: string;
    quality: string | null;
} {
    const generatedImagePreference = resolveImageToolContext(context).generatedImagePreference;
    const hasReferenceInputs = options.hasReferenceInputs === true;
    const preferredModel = hasReferenceInputs && !supportsGeneratedImageReferenceInputModel(generatedImagePreference.model)
        ? ''
        : generatedImagePreference.model;
    const resolved = resolveAvailableGeneratedImagePreference(
        [
            {
                model: preferredModel,
                quality: generatedImagePreference.quality,
            },
            { model: 'gpt-image-1-mini' },
            ...(hasReferenceInputs ? [{ model: 'gpt-image-2' }] : [{ model: 'grok-imagine-image' }, { model: 'gpt-image-2' }]),
        ],
    );
    return {
        requestedModel: resolved.model || pickDefaultGeneratedImageModel(taskModel),
        quality: resolved.quality,
    };
}

function mergeImplicitTaskReferenceImages(
    explicitReferenceImages: GeneratedImageIntentInput['reference_images'],
    taskImages: Array<{ url: string; sourceLabel: string }>,
): NonNullable<GeneratedImageIntentInput['reference_images']> {
    const explicit = Array.isArray(explicitReferenceImages)
        ? explicitReferenceImages
            .map((item) => ({
                url: String(item?.url || '').trim() || null,
                description: String(item?.description || '').trim() || null,
                purpose: String(item?.purpose || '').trim() || null,
            }))
            .filter((item) => Boolean(item.url || item.description))
        : [];
    if (taskImages.length === 0) {
        return explicit;
    }
    return [
        ...explicit,
        ...taskImages.map((image, index) => ({
            url: image.url,
            description: image.sourceLabel || `uploaded task image ${index + 1}`,
            purpose: 'preserve subject identity and visual details from the uploaded image',
        })),
    ];
}

function buildProviderReferenceImages(
    referenceImages: NonNullable<GeneratedImageIntentInput['reference_images']>,
): GeneratedImageProviderInputImage[] {
    return referenceImages
        .map((item) => ({
            url: String(item?.url || '').trim(),
            sourceLabel: [
                String(item?.description || '').trim(),
                String(item?.purpose || '').trim(),
            ].filter(Boolean).join(' | ') || null,
        }))
        .filter((item) => Boolean(item.url));
}

function readImplicitSocialReferenceImages(context?: Record<string, any>): Array<{ url: string; sourceLabel: string }> {
    const snapshot = context?.__snapshot || null;
    const socialImages = Array.isArray(snapshot?.runtime?.socialInput?.images)
        ? snapshot.runtime.socialInput.images
        : [];
    return socialImages
        .map((image: any, index: number) => {
            const url = normalizeSocialImageUrl(image?.url);
            if (!url) return null;
            return {
                url,
                sourceLabel: String(image?.sourceLabel || `social image ${index + 1}`).trim(),
            };
        })
        .filter((image: { url: string; sourceLabel: string } | null): image is { url: string; sourceLabel: string } => Boolean(image));
}

function mergeImplicitReferenceImages(
    explicitReferenceImages: GeneratedImageIntentInput['reference_images'],
    implicitImages: Array<{ url: string; sourceLabel: string; purpose: string }>,
): NonNullable<GeneratedImageIntentInput['reference_images']> {
    const explicit = Array.isArray(explicitReferenceImages)
        ? explicitReferenceImages
            .map((item) => ({
                url: String(item?.url || '').trim() || null,
                description: String(item?.description || '').trim() || null,
                purpose: String(item?.purpose || '').trim() || null,
            }))
            .filter((item) => Boolean(item.url || item.description))
        : [];
    if (implicitImages.length === 0) {
        return explicit;
    }

    const seenUrls = new Set(
        explicit
            .map((item) => String(item.url || '').trim())
            .filter(Boolean),
    );

    const mergedImplicit = implicitImages.flatMap((image) => {
        const url = String(image.url || '').trim();
        if (!url || seenUrls.has(url)) return [];
        seenUrls.add(url);
        return [{
            url,
            description: image.sourceLabel || null,
            purpose: image.purpose || null,
        }];
    });

    return [...explicit, ...mergedImplicit];
}

function buildImplicitImageReferenceInputs(params: {
    explicitReferenceImages: GeneratedImageIntentInput['reference_images'];
    uploadedTaskImages: Array<{ url: string; sourceLabel: string }>;
    context?: Record<string, any>;
}): {
    mergedReferenceImages: NonNullable<GeneratedImageIntentInput['reference_images']>;
    providerReferenceImages: GeneratedImageProviderInputImage[];
} {
    const socialReferenceImages = readImplicitSocialReferenceImages(params.context);
    const mergedReferenceImages = mergeImplicitReferenceImages(
        params.explicitReferenceImages,
        [
            ...params.uploadedTaskImages.map((image) => ({
                url: image.url,
                sourceLabel: image.sourceLabel,
                purpose: 'preserve subject identity and visual details from the uploaded image',
            })),
            ...socialReferenceImages.map((image) => ({
                url: image.url,
                sourceLabel: image.sourceLabel,
                purpose: 'preserve subject identity and visual details from the social post image',
            })),
        ],
    );
    return {
        mergedReferenceImages,
        providerReferenceImages: buildProviderReferenceImages(mergedReferenceImages),
    };
}

// CONTEXT MEMORY
// Updated: 2026-04-23
// Status: mixed
// Why: GPT tool calls often use action=generate to mean "make a new output"
// even when the user supplied a reference image in the current X/Farcaster
// post. Dropping references on that action loses the exact image the user
// asked us to use.
// Debug Goal: social/uploaded reference images must survive action=generate
// and reach generated-image execution; only action=edit enforces that a source
// image exists.
// Search Tags: generate_image_from_intent action generate preserve reference images social uploads
// Invariants:
// - Current-turn reference images are passed to providers whenever present.
// - action=edit without any usable source/reference image remains an error.
// Failure Modes:
// - X/Farcaster "use this image" turns generate unrelated pictures.
// - The model chooses action=generate and silently clears socialInput.images.
function resolveReferenceInputsForAction(params: {
    requestedAction: ReturnType<typeof normalizeGeneratedImageToolAction>;
    builtReferenceInputs: ReturnType<typeof buildImplicitImageReferenceInputs>;
}): ReturnType<typeof buildImplicitImageReferenceInputs> {
    if (
        params.requestedAction === 'edit'
        && params.builtReferenceInputs.providerReferenceImages.length === 0
    ) {
        throw new Error('generate_image_from_intent action=edit requires a source or reference image input.');
    }
    return params.builtReferenceInputs;
}

export const GenerateImageFromIntentTool: Tool<GeneratedImageIntentInput, Record<string, any>> = {
    definition: {
        name: 'generate_image_from_intent',
        description: 'Generate or edit an image inside the current chat turn when the user is explicitly asking for an image, poster, cover, illustration, concept frame, visual asset, reference-image generation, or image edit. First rewrite the idea into structured image direction, then call this tool directly. Do not use it for abstract prompt-writing advice or ordinary text discussion. If the request is still missing critical visual constraints, ask one precise clarification instead of calling the tool.',
        parameters: {
            type: 'object',
            properties: {
                user_intent: {
                    type: 'string',
                    description: 'The user-visible goal for the image in plain language.',
                },
                artifact_type: {
                    type: 'string',
                    description: 'OpenAI-style deliverable or use case, such as ad creative, UI mockup, infographic, product photo, poster, logo, comic panel, or image edit.',
                },
                style_hint: {
                    type: 'string',
                    description: 'Optional style hint such as cyberpunk, editorial, cinematic, anime, product render, or minimal poster.',
                },
                aspect_ratio: {
                    type: 'string',
                    description: 'Optional target aspect ratio, such as 1:1, 16:9, 9:16, 4:3, or 3:4.',
                },
                reference_images: {
                    type: 'array',
                    description: 'Optional reference images for edit/reference workflows. Current task uploads are automatically included when available; pass explicit URLs only when the user provided extra references.',
                    items: {
                        type: 'object',
                        properties: {
                            url: { type: 'string' },
                            description: { type: 'string' },
                            purpose: { type: 'string' },
                        },
                    },
                },
                safety_level: {
                    type: 'string',
                    description: 'Optional safety posture. Use strict for conservative brand-safe visuals, otherwise standard.',
                    enum: ['standard', 'strict'],
                },
                action: {
                    type: 'string',
                    description: 'OpenAI Responses-style image action. Use auto by default so the tool generates without source images and edits when source/reference images are in context; use generate to force a new image; use edit only when a source/reference image exists.',
                    enum: ['auto', 'generate', 'edit'],
                },
                edit_or_generate: {
                    type: 'string',
                    description: 'Legacy compatibility field. Prefer action. Use edit when source/reference images should guide the output; use generate when creating without source images.',
                    enum: ['generate', 'edit'],
                },
                subject: {
                    type: 'string',
                    description: 'Optimized primary subject or object of the image.',
                },
                scene: {
                    type: 'string',
                    description: 'Optimized environment or scene description.',
                },
                key_details: {
                    type: 'string',
                    description: 'Concrete materials, textures, objects, identity details, brand details, or real-world cues that materially improve the image.',
                },
                composition: {
                    type: 'string',
                    description: 'Optimized composition direction, framing, or layout.',
                },
                style: {
                    type: 'string',
                    description: 'Optimized style direction.',
                },
                lighting: {
                    type: 'string',
                    description: 'Optimized lighting direction.',
                },
                camera: {
                    type: 'string',
                    description: 'Optimized camera or framing direction.',
                },
                change_request: {
                    type: 'string',
                    description: 'For edits/reference workflows, the exact thing to change or create from the source images.',
                },
                preserve_elements: {
                    type: 'array',
                    description: 'For edits/reference workflows, explicit invariants to preserve such as identity, pose, layout, background, geometry, lighting, camera angle, label text, or brand elements.',
                    items: { type: 'string' },
                },
                exact_text: {
                    type: 'string',
                    description: 'Exact text that must appear in the image, quoted verbatim in the provider prompt.',
                },
                text_placement: {
                    type: 'string',
                    description: 'Where exact text should appear and how often it should appear.',
                },
                typography: {
                    type: 'string',
                    description: 'Typography direction for exact in-image text, such as bold sans-serif, centered, high contrast, clean kerning.',
                },
                constraints: {
                    type: 'array',
                    description: 'Optional explicit hard constraints to preserve.',
                    items: { type: 'string' },
                },
                negative_constraints: {
                    type: 'array',
                    description: 'Optional explicit things to avoid in the image.',
                    items: { type: 'string' },
                },
            },
            required: ['user_intent'],
    },
    },
    handler: async (args, context) => {
        const { taskId, sessionId, assistantMessageId, userId, taskModel, source } = resolveImageToolContext(context);
        if (!taskId || !sessionId || !assistantMessageId || !userId) {
            throw new Error('generate_image_from_intent requires task, session, assistant message, and user context.');
        }

        const uploadedTaskImages = await hasTaskChatImageInputs(taskId)
            ? await loadTaskChatImageInputs(taskId).catch(() => [])
            : [];
        const requestedAction = normalizeGeneratedImageToolAction(args.action);
        const builtReferenceInputs = buildImplicitImageReferenceInputs({
            explicitReferenceImages: args.reference_images,
            uploadedTaskImages: uploadedTaskImages.map((image) => ({
                url: image.url,
                sourceLabel: image.sourceLabel,
            })),
            context,
        });
        const referenceInputs = resolveReferenceInputsForAction({
            requestedAction,
            builtReferenceInputs,
        });
        const mergedReferenceImages = referenceInputs.mergedReferenceImages;
        const providerReferenceImages = referenceInputs.providerReferenceImages;
        const normalizedArgs = normalizeGeneratedImageIntentInput({
            ...args,
            action: requestedAction,
            edit_or_generate: requestedAction === 'auto' ? args.edit_or_generate : requestedAction,
            reference_images: mergedReferenceImages,
        });
        const hasReferenceInputs = providerReferenceImages.length > 0;
        const optimized = optimizeGeneratedImagePrompt(normalizedArgs);
        const refinedPrompt = await refineGeneratedImagePromptWithOpenAi({
            userIntent: String(normalizedArgs.user_intent || '').trim(),
            draftProviderPrompt: optimized.providerPrompt,
            spec: optimized.spec,
        });
        const imagePreference = resolveGeneratedImageToolPreferenceWithOptions(context, taskModel, {
            hasReferenceInputs,
        });
        const requestedModel = imagePreference.requestedModel;
        const requestedQuality = imagePreference.quality;
        const pendingGeneratedImage = buildGeneratedImagePendingData({
            requestedModel,
            quality: requestedQuality,
            prompt: refinedPrompt.prompt,
        });

        const existingTask = await chatRepo.getTask(taskId);
        const nextToolContext = {
            ...(existingTask?.toolContext || {}),
            generatedImage: {
                requestedModel,
                quality: requestedQuality,
                userIntent: String(normalizedArgs.user_intent || '').trim(),
                referenceImageCount: mergedReferenceImages.length,
                optimizedPromptSummary: optimized.optimizedPromptSummary,
                promptRefiner: {
                    model: refinedPrompt.model,
                    usedRefiner: refinedPrompt.usedRefiner,
                    errorMessage: refinedPrompt.errorMessage || null,
                },
                promptOptimizer: {
                    action: optimized.spec.action,
                    artifactType: optimized.spec.artifactType,
                    aspectRatio: optimized.spec.aspectRatio,
                    subject: optimized.spec.subject,
                    scene: optimized.spec.scene,
                    keyDetails: optimized.spec.keyDetails,
                    composition: optimized.spec.composition,
                    style: optimized.spec.style,
                    lighting: optimized.spec.lighting,
                    camera: optimized.spec.camera,
                    changeRequest: optimized.spec.changeRequest,
                    preserveElements: optimized.spec.preserveElements,
                    exactText: optimized.spec.exactText,
                    textPlacement: optimized.spec.textPlacement,
                    typography: optimized.spec.typography,
                    safetyLevel: optimized.spec.safetyLevel,
                },
            },
        };
        await chatRepo.updateTaskToolContext(taskId, nextToolContext);
        await chatRepo.updateMessage(assistantMessageId, {
            type: 'generated-image',
            data: {
                generatedImage: pendingGeneratedImage,
            },
            status: 'streaming',
        });

        chatWS.broadcastToUser(userId, {
            type: 'task_status',
            sessionId,
            data: {
                taskId,
                messageId: assistantMessageId,
                status: 'running',
                message: 'Generating image',
                taskType: 'image',
            },
        });
        chatWS.broadcastToUser(userId, {
            type: 'message_start',
            sessionId,
            data: {
                messageId: assistantMessageId,
                role: 'assistant',
                model: requestedModel,
                messageType: 'generated-image',
                data: {
                    generatedImage: pendingGeneratedImage,
                },
            },
        });

        const execution = await executeGeneratedImageChatTask({
            taskId,
            userId,
            sessionId,
            assistantMessageId,
            requestedModel,
            quality: requestedQuality,
            prompt: refinedPrompt.prompt,
            referenceImages: providerReferenceImages,
            source,
        });

        return {
            status: execution.status,
            assistantMessageId,
            taskId,
            optimizedPromptSummary: optimized.optimizedPromptSummary,
            promptRefiner: {
                usedRefiner: refinedPrompt.usedRefiner,
                model: refinedPrompt.model,
                errorMessage: refinedPrompt.errorMessage || null,
            },
            images: execution.images,
            errorMessage: execution.errorMessage || null,
            handled_response: true,
            response_channel: 'generated-image',
        };
    },
    permissions: 'authenticated',
};

export const __generateImageFromIntentTest = {
    resolveGeneratedImageSource,
    pickDefaultGeneratedImageModel,
    resolveGeneratedImageToolPreference,
    resolveGeneratedImageToolPreferenceWithOptions,
    buildImplicitImageReferenceInputs,
    mergeImplicitReferenceImages,
    readImplicitSocialReferenceImages,
    buildProviderReferenceImages,
    resolveReferenceInputsForAction,
};
