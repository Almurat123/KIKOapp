import { Tool } from '../../../tooling/registry.js';
import * as chatRepo from '../../../repositories/chatRepository.js';
import { chatWS } from '../../../services/chatWebSocket.js';
import {
    buildGeneratedImagePendingData,
    executeGeneratedImageChatTask,
} from '../../../services/generatedImageChatTask.js';
import {
    normalizeGeneratedImageIntentInput,
    optimizeGeneratedImagePrompt,
    type GeneratedImageIntentInput,
} from '../../../services/generatedImagePromptOptimizer.js';
import { resolveAvailableGeneratedImagePreference } from '../../../services/generatedImageBilling.js';

// CONTEXT MEMORY
// Updated: 2026-04-20
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
//         before delegating into the optimizer.
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
// - Default image-model family should prefer GPT Image 1 Mini for all chats,
//   but it must still fall back to the first enabled image model instead of
//   selecting a disabled provider
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
    return {
        snapshot,
        taskId,
        sessionId,
        assistantMessageId,
        userId,
        taskModel,
        source: resolveGeneratedImageSource(context, snapshot),
    };
}

function resolveGeneratedImageSource(context?: Record<string, any>, snapshot?: any): 'farcaster' | 'chat-v2-tool' {
    const currentPage = String(context?.currentPage || snapshot?.runtime?.currentPage || '').trim().toLowerCase();
    const pageContext = String(context?.pageContext || snapshot?.runtime?.pageContext || '').trim().toLowerCase();
    if (currentPage === 'farcaster' || pageContext === 'farcaster_agent') {
        return 'farcaster';
    }
    return 'chat-v2-tool';
}

function pickDefaultGeneratedImageModel(_taskModel?: string | null): 'gpt-image-1-mini' | 'grok-imagine-image' {
    const resolved = resolveAvailableGeneratedImagePreference([
        { model: 'gpt-image-1-mini' },
        { model: 'grok-imagine-image' },
        { model: 'gpt-image-1.5' },
    ]);
    return (resolved.model || 'gpt-image-1-mini') as 'gpt-image-1-mini' | 'grok-imagine-image';
}

export const GenerateImageFromIntentTool: Tool<GeneratedImageIntentInput, Record<string, any>> = {
    definition: {
        name: 'generate_image_from_intent',
        description: 'Generate a new image inside the current chat turn when the user is explicitly asking for an image, poster, cover, illustration, concept frame, or visual asset. First rewrite the idea into structured image direction, then call this tool directly. Do not use it for abstract prompt-writing advice or ordinary text discussion. If the request is still missing critical visual constraints, ask one precise clarification instead of calling the tool.',
        parameters: {
            type: 'object',
            properties: {
                user_intent: {
                    type: 'string',
                    description: 'The user-visible goal for the image in plain language.',
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
                    description: 'Optional future-facing reference list. Do not rely on this for true image editing yet.',
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
                edit_or_generate: {
                    type: 'string',
                    description: 'Use generate for new images. Keep edit reserved for future flows.',
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

        const normalizedArgs = normalizeGeneratedImageIntentInput(args);
        const optimized = optimizeGeneratedImagePrompt(normalizedArgs);
        if (optimized.spec.editOrGenerate === 'edit') {
            return {
                handled_response: false,
                unsupported_mode: 'edit',
                message: 'Image edit/reference flow is not wired in this tool yet. Ask one precise clarification or keep the turn in text until edit support lands.',
            };
        }

        const requestedModel = pickDefaultGeneratedImageModel(taskModel);
        const pendingGeneratedImage = buildGeneratedImagePendingData({
            requestedModel,
            quality: null,
            prompt: optimized.providerPrompt,
        });

        const existingTask = await chatRepo.getTask(taskId);
        const nextToolContext = {
            ...(existingTask?.toolContext || {}),
            generatedImage: {
                requestedModel,
                quality: null,
                userIntent: String(normalizedArgs.user_intent || '').trim(),
                optimizedPromptSummary: optimized.optimizedPromptSummary,
                promptOptimizer: {
                    aspectRatio: optimized.spec.aspectRatio,
                    subject: optimized.spec.subject,
                    scene: optimized.spec.scene,
                    composition: optimized.spec.composition,
                    style: optimized.spec.style,
                    lighting: optimized.spec.lighting,
                    camera: optimized.spec.camera,
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
            quality: null,
            prompt: optimized.providerPrompt,
            source,
        });

        return {
            status: execution.status,
            assistantMessageId,
            taskId,
            optimizedPromptSummary: optimized.optimizedPromptSummary,
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
};
