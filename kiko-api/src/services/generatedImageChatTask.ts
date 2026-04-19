import pLimit from 'p-limit';
import { randomUUID } from 'node:crypto';
import * as chatRepo from '../repositories/chatRepository.js';
import { chatWS } from './chatWebSocket.js';
import { acquireLock, releaseLock } from '../cache/cacheClient.js';
import {
    buildChatImageMessageAttachments,
    hydrateGeneratedChatImageDataForClient,
    storeGeneratedChatImage,
    type ChatImageMessageAttachment,
} from './chatImageUploads.js';
import {
    markGeneratedImageUsageCompleted,
    markGeneratedImageUsageFailed,
    reserveGeneratedImageUsage,
    type GeneratedImageUsageReservation,
} from './generatedImageBilling.js';
import {
    assertGeneratedImageOutputSafe,
    assertGeneratedImagePromptSafe,
    isGeneratedImageSafetyError,
} from './generatedImageSafety.js';
import {
    generateImageWithProvider,
    isGeneratedImageProviderError,
} from './generatedImageProviders.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

// CONTEXT MEMORY
// Updated: 2026-04-19
// Author: Rowan
// Reason: generated-image chat turns do not fit the text worker contract. They
//         need one owner that can acquire per-user concurrency, reserve billing
//         against a server-owned context, moderate prompts and outputs, store
//         private image assets, and stream state updates back into the existing
//         chat transcript without going through text chunk brokers. The first
//         pass leaked fake stage semantics into the transcript because it had
//         no real provider progress signal. This owner now has to preserve the
//         distinction between true OpenAI partial-image progress, Grok's lack
//         of image streaming, and KiKo's own post-generation safety/storage
//         phases. Chat v2 now also needs a synchronous execution entry so an
//         internal tool can reuse this owner inside the main chat turn and let
//         the tool manage the reply without fabricating a text completion.
//         Farcaster-bound generated-image replies also require a stable public
//         image URL because casts embed URLs instead of uploaded binaries. A
//         short-lived watermark experiment previously modified the final image
//         pixels inside this owner, but product direction removed that
//         requirement entirely. This owner now has to preserve provider output
//         bytes through moderation and storage without post-generation
//         watermark rewriting.
// Goal: execute one generated-image chat task end to end while preserving the
//       chat session/message/task model, strict image safety gates, billing
//       reservation semantics, provider-specific capability metadata and
//       progress semantics, and a tool-call-friendly awaitable result contract.
// Owns: generated-image chat task execution, per-user concurrency locking,
//       staged message-data updates, provider invocation order, success/fail
//       finalization for assistant image replies, and the awaitable execution
//       contract used by chat-v2 image tools.
// Does Not Own: authenticated route validation, provider HTTP request-shape
//               details, private image storage internals, or frontend rendering.
// Design Language:
// - generated-image turns must reserve billing before provider execution
// - one authenticated user may run only one generated-image task at a time
// - generated-image replies update message data in stages instead of text chunks
// - client-facing generated-image broadcasts must carry hydrated preview URLs,
//   while database persistence keeps private object keys
// - task failure must leave a durable assistant row explaining the failure state
// - OpenAI partial-image events may update progress semantics, but this owner
//   must not reveal unmoderated image bytes to the user-facing transcript
// - blurred preview reveals are only allowed after output moderation has passed
// - Grok image generation must not fabricate partial-progress stages that the
//   provider does not emit
// - forbidden local patch pattern: sending provider URLs directly to the client as durable chat history
// - moderation and storage should preserve provider output bytes; this owner
//   must not rewrite final pixels with a server watermark
// - publish a public generated-image copy only when the source surface requires
//   durable URL embeds; ordinary web chat generated images stay private
// Document Provenance:
// - Source: OpenAI Image generation guide
// - Kind: official API doc
// - Retrieved: 2026-04-18
// - Applied To: OpenAI image generation path and real partial-image progress semantics
// - Verification: verified in docs
// - Source: OpenAI `/v1/images/generations` OpenAPI spec
// - Kind: official API doc
// - Retrieved: 2026-04-18
// - Applied To: using `image_generation.partial_image` / `image_generation.completed`
//   for OpenAI-only progress updates
// - Verification: verified in docs
// - Source: xAI Streaming guide
// - Kind: official API doc
// - Retrieved: 2026-04-18
// - Applied To: Grok image generation remains single-stage because image-output models do not stream
// - Verification: verified in docs
// - Source: operator requirement on 2026-04-18 for strict image safety
// - Kind: product doc
// - Retrieved: 2026-04-18
// - Applied To: blocking any pre-moderation partial-image preview from reaching the transcript
// - Verification: verified in code
// - Source: operator requirement on 2026-04-18
// - Kind: product doc
// - Retrieved: 2026-04-18
// - Applied To: generated-image execution, concurrency control, and OpenAI-style reveal UI preparation in chat
// - Verification: verified in code
// - Source: operator requirement on 2026-04-18 for model-owned image generation inside main chat
// - Kind: product doc
// - Retrieved: 2026-04-18
// - Applied To: awaitable generated-image execution for chat-v2 internal tools
// - Verification: verified in code
// - Source: operator correction on 2026-04-19 for production-stable Farcaster image embeds
// - Kind: product doc
// - Retrieved: 2026-04-19
// - Applied To: requesting public generated-image storage copies for Farcaster sources
// - Verification: verified in code
// - Source: operator correction on 2026-04-19 to remove generated-image
//   watermarking entirely
// - Kind: product doc
// - Retrieved: 2026-04-19
// - Applied To: removing all server-side pixel watermark rewriting from this owner
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-generated-image-chat-execution-and-ui.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-generated-image-client-preview-hydration.md
// - /Users/almurat/KiKo/system-journal/design-language/generated-image-billing.md
// - /Users/almurat/KiKo/system-journal/design-language/generated-image-safety.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-v2-model-owned-image-generation-tool.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-farcaster-generated-image-reply-and-watermark.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

const GENERATED_IMAGE_MAX_CONCURRENCY = Math.max(1, Number(process.env.GENERATED_IMAGE_MAX_CONCURRENCY || '2') || 2);
const GENERATED_IMAGE_USER_LOCK_TTL_SECONDS = Math.max(60, Number(process.env.GENERATED_IMAGE_USER_LOCK_TTL_SECONDS || '300') || 300);
const OPENAI_PARTIAL_IMAGE_PROGRESS_STEPS = 2;
const generatedImageExecutionLimit = pLimit(GENERATED_IMAGE_MAX_CONCURRENCY);

export type GeneratedImageMessageState = {
    requestedModel: string;
    provider: 'openai' | 'xai' | null;
    providerModel: string | null;
    quality: string | null;
    prompt: string;
    status: 'queued' | 'generating' | 'moderating' | 'saving' | 'complete' | 'failed';
    stageLabel: string;
    supportsProgressiveReveal: boolean;
    partialImageIndex: number | null;
    partialImageCount: number | null;
    images: ChatImageMessageAttachment[];
    revisedPrompt?: string | null;
    errorMessage?: string | null;
};

export type StartGeneratedImageChatTaskParams = {
    taskId: string;
    userId: string;
    sessionId: string;
    assistantMessageId: string;
    requestedModel: string;
    quality?: string | null;
    prompt: string;
    source?: string | null;
};

export type ExecuteGeneratedImageChatTaskResult = {
    status: 'complete' | 'failed';
    taskId: string;
    assistantMessageId: string;
    state: GeneratedImageMessageState;
    images: ChatImageMessageAttachment[];
    errorMessage?: string | null;
};

function inferProvider(requestedModel: string): 'openai' | 'xai' | null {
    const normalized = String(requestedModel || '').trim().toLowerCase();
    if (normalized.startsWith('gpt-image-1.5')) return 'openai';
    if (normalized.startsWith('grok-imagine-image')) return 'xai';
    return null;
}

function inferProviderModel(requestedModel: string): string | null {
    const normalized = String(requestedModel || '').trim().toLowerCase();
    if (normalized.startsWith('gpt-image-1.5')) return 'gpt-image-1.5';
    if (normalized.startsWith('grok-imagine-image-pro')) return 'grok-imagine-image-pro';
    if (normalized.startsWith('grok-imagine-image')) return 'grok-imagine-image';
    return null;
}

function normalizeQuality(requestedModel: string, quality?: string | null): string | null {
    const normalizedModel = String(requestedModel || '').trim().toLowerCase();
    const normalizedQuality = String(quality || '').trim().toLowerCase();
    if (normalizedModel.startsWith('gpt-image-1.5')) {
        if (normalizedQuality === 'low' || normalizedQuality === 'high') return normalizedQuality;
        return 'medium';
    }
    if (normalizedModel.startsWith('grok-imagine-image-pro')) return 'pro';
    if (normalizedModel.startsWith('grok-imagine-image')) return 'normal';
    return normalizedQuality || null;
}

export function buildGeneratedImagePendingData(params: {
    requestedModel: string;
    quality?: string | null;
    prompt: string;
}): GeneratedImageMessageState {
    const provider = inferProvider(params.requestedModel);
    const providerModel = inferProviderModel(params.requestedModel);
    return {
        requestedModel: String(params.requestedModel || '').trim().toLowerCase(),
        provider,
        providerModel,
        quality: normalizeQuality(params.requestedModel, params.quality),
        prompt: String(params.prompt || '').trim(),
        status: 'queued',
        stageLabel: 'Queued',
        supportsProgressiveReveal: provider === 'openai',
        partialImageIndex: null,
        partialImageCount: provider === 'openai' ? OPENAI_PARTIAL_IMAGE_PROGRESS_STEPS : null,
        images: [],
        revisedPrompt: null,
        errorMessage: null,
    };
}

function buildFailureMessage(params: {
    requestedModel: string;
    reason?: string | null;
    fallback?: string | null;
}): string {
    const requestedModel = String(params.requestedModel || '').trim().toLowerCase();
    const reason = String(params.reason || '').trim().toUpperCase();
    if (reason === 'BILLING_CONSENT_REQUIRED') {
        return 'Authorize billing in Wallet settings before using this image model.';
    }
    if (reason === 'MODEL_DISABLED') {
        if (requestedModel.startsWith('gpt-image-1.5')) {
            return 'GPT Image 1.5 is unavailable right now.';
        }
        if (requestedModel.startsWith('grok-imagine-image-pro')) {
            return 'Grok Imagine Pro is unavailable right now.';
        }
        return 'This image model is unavailable right now.';
    }
    if (reason === 'MODEL_NOT_SUPPORTED') {
        return 'This image model is not supported yet.';
    }
    if (reason === 'GENERATED_IMAGE_CONCURRENCY_LOCKED') {
        return 'Another image generation is already running for this account.';
    }
    if (reason === 'GENERATED_IMAGE_SAFETY_BLOCKED') {
        return 'This image request was blocked by safety policy.';
    }
    return String(params.fallback || 'Image generation failed. Please try again.');
}

function buildUserLockKey(userId: string): string {
    return `generated-image:running:${userId}`;
}

async function publishGeneratedImageMessageState(params: {
    userId: string;
    sessionId: string;
    assistantMessageId: string;
    messageStatus: 'streaming' | 'complete' | 'error';
    state: GeneratedImageMessageState;
    persist?: boolean;
}): Promise<void> {
    if (params.persist !== false) {
        await chatRepo.updateMessage(params.assistantMessageId, {
            type: 'generated-image',
            data: { generatedImage: params.state },
            status: params.messageStatus,
        });
    }

    let clientGeneratedImage = params.state;
    try {
        const hydratedData = await hydrateGeneratedChatImageDataForClient({
            generatedImage: params.state,
        });
        if (hydratedData?.generatedImage) {
            clientGeneratedImage = hydratedData.generatedImage;
        }
    } catch {
        // Fall back to the stored state. The DB row still keeps the private object keys.
    }

    chatWS.broadcastToUser(params.userId, {
        type: 'client_action',
        sessionId: params.sessionId,
        data: {
            message_id: params.assistantMessageId,
            targetMessageId: params.assistantMessageId,
            action: {
                type: 'update_message_data',
                data: {
                    generatedImage: clientGeneratedImage,
                },
            },
        },
    });
}

function broadcastTaskStatus(params: {
    userId: string;
    sessionId: string;
    taskId: string;
    assistantMessageId: string;
    status: 'running' | 'completed' | 'failed';
    message: string;
}): void {
    chatWS.broadcastToUser(params.userId, {
        type: 'task_status',
        sessionId: params.sessionId,
        data: {
            taskId: params.taskId,
            messageId: params.assistantMessageId,
            status: params.status,
            message: params.message,
            taskType: 'image',
        },
    });
}

async function failGeneratedImageTask(params: {
    taskId: string;
    userId: string;
    sessionId: string;
    assistantMessageId: string;
    state: GeneratedImageMessageState;
    errorMessage: string;
    reservation?: GeneratedImageUsageReservation | null;
    failureReason?: string | null;
}): Promise<ExecuteGeneratedImageChatTaskResult> {
    const failedState: GeneratedImageMessageState = {
        ...params.state,
        status: 'failed',
        stageLabel: 'Failed',
        errorMessage: params.errorMessage,
    };
    if (params.reservation?.status === 'reserved') {
        await markGeneratedImageUsageFailed(params.taskId, params.failureReason || params.errorMessage);
    }
    await publishGeneratedImageMessageState({
        userId: params.userId,
        sessionId: params.sessionId,
        assistantMessageId: params.assistantMessageId,
        messageStatus: 'error',
        state: failedState,
    });
    await chatRepo.updateTaskStatus(params.taskId, 'error', params.errorMessage);
    broadcastTaskStatus({
        userId: params.userId,
        sessionId: params.sessionId,
        taskId: params.taskId,
        assistantMessageId: params.assistantMessageId,
        status: 'failed',
        message: params.errorMessage,
    });
    return {
        status: 'failed',
        taskId: params.taskId,
        assistantMessageId: params.assistantMessageId,
        state: failedState,
        images: failedState.images,
        errorMessage: params.errorMessage,
    };
}

function buildEphemeralGeneratedImagePreview(params: {
    assistantMessageId: string;
    contentType: string;
    imageBuffer: Buffer;
}): ChatImageMessageAttachment {
    return {
        id: `${params.assistantMessageId}-preview`,
        previewUrl: `data:${params.contentType};base64,${params.imageBuffer.toString('base64')}`,
        name: 'generated-image-preview',
        type: params.contentType,
        size: params.imageBuffer.byteLength,
        width: null,
        height: null,
    };
}

async function runGeneratedImageChatTask(params: StartGeneratedImageChatTaskParams): Promise<ExecuteGeneratedImageChatTaskResult> {
    const initialState = buildGeneratedImagePendingData({
        requestedModel: params.requestedModel,
        quality: params.quality,
        prompt: params.prompt,
    });
    let currentState = initialState;
    const lockValue = randomUUID();
    const userLockKey = buildUserLockKey(params.userId);
    const hasUserLock = await acquireLock(userLockKey, GENERATED_IMAGE_USER_LOCK_TTL_SECONDS, lockValue);
    if (!hasUserLock) {
        return failGeneratedImageTask({
            taskId: params.taskId,
            userId: params.userId,
            sessionId: params.sessionId,
            assistantMessageId: params.assistantMessageId,
            state: initialState,
            errorMessage: buildFailureMessage({
                requestedModel: params.requestedModel,
                reason: 'GENERATED_IMAGE_CONCURRENCY_LOCKED',
            }),
            failureReason: 'GENERATED_IMAGE_CONCURRENCY_LOCKED',
        });
    }

    let reservation: GeneratedImageUsageReservation | null = null;
    try {
        await chatRepo.updateTaskStatus(params.taskId, 'running');
        broadcastTaskStatus({
            userId: params.userId,
            sessionId: params.sessionId,
            taskId: params.taskId,
            assistantMessageId: params.assistantMessageId,
            status: 'running',
            message: 'Generating image',
        });

        reservation = await reserveGeneratedImageUsage({
            requestId: params.taskId,
            userId: params.userId,
            model: params.requestedModel,
            quality: params.quality,
            imageCount: 1,
            source: params.source || 'web',
            contextType: 'assistant_message',
            contextId: params.assistantMessageId,
        });

        if (!reservation.allowed || !reservation.provider || !reservation.providerModel || !reservation.quality) {
            return failGeneratedImageTask({
                taskId: params.taskId,
                userId: params.userId,
                sessionId: params.sessionId,
                assistantMessageId: params.assistantMessageId,
                state: initialState,
                reservation,
                errorMessage: buildFailureMessage({
                    requestedModel: params.requestedModel,
                    reason: reservation.reason,
                }),
                failureReason: reservation.reason || 'GENERATED_IMAGE_BILLING_BLOCKED',
            });
        }

        const generatingState: GeneratedImageMessageState = {
            ...initialState,
            provider: reservation.provider,
            providerModel: reservation.providerModel,
            quality: reservation.quality,
            status: 'generating',
            stageLabel: 'Generating',
            supportsProgressiveReveal: reservation.provider === 'openai',
            partialImageIndex: null,
            partialImageCount: reservation.provider === 'openai' ? OPENAI_PARTIAL_IMAGE_PROGRESS_STEPS : null,
        };
        await publishGeneratedImageMessageState({
            userId: params.userId,
            sessionId: params.sessionId,
            assistantMessageId: params.assistantMessageId,
            messageStatus: 'streaming',
            state: generatingState,
        });
        currentState = generatingState;

        await assertGeneratedImagePromptSafe({
            userId: params.userId,
            sessionId: params.sessionId,
            model: reservation.providerModel,
            provider: reservation.provider,
            source: params.source || 'web',
            text: params.prompt,
        });

        const providerResult = await generateImageWithProvider({
            provider: reservation.provider,
            model: reservation.providerModel as 'gpt-image-1.5' | 'grok-imagine-image',
            prompt: params.prompt,
            quality: reservation.quality as 'low' | 'medium' | 'high' | 'normal',
            onProgress: reservation.provider === 'openai'
                ? async (event) => {
                    const progressState: GeneratedImageMessageState = {
                        ...generatingState,
                        partialImageIndex: event.partialImageIndex,
                        partialImageCount: event.partialImageCount,
                    };
                    await publishGeneratedImageMessageState({
                        userId: params.userId,
                        sessionId: params.sessionId,
                        assistantMessageId: params.assistantMessageId,
                        messageStatus: 'streaming',
                        state: progressState,
                        persist: false,
                    });
                }
                : null,
        });

        const moderatingState: GeneratedImageMessageState = {
            ...generatingState,
            revisedPrompt: providerResult.revisedPrompt || null,
            supportsProgressiveReveal: providerResult.supportsProgressiveReveal,
            status: 'moderating',
            stageLabel: 'Safety check',
            partialImageIndex: null,
            partialImageCount: null,
        };
        await publishGeneratedImageMessageState({
            userId: params.userId,
            sessionId: params.sessionId,
            assistantMessageId: params.assistantMessageId,
            messageStatus: 'streaming',
            state: moderatingState,
        });
        currentState = moderatingState;

        const moderationImageUrl = `data:${providerResult.contentType};base64,${providerResult.imageBuffer.toString('base64')}`;
        await assertGeneratedImageOutputSafe({
            userId: params.userId,
            sessionId: params.sessionId,
            model: reservation.providerModel,
            provider: reservation.provider,
            source: params.source || 'web',
            text: providerResult.revisedPrompt || params.prompt,
            imageUrls: [moderationImageUrl],
        });

        const savingState: GeneratedImageMessageState = {
            ...moderatingState,
            status: 'saving',
            stageLabel: 'Saving',
        };
        await publishGeneratedImageMessageState({
            userId: params.userId,
            sessionId: params.sessionId,
            assistantMessageId: params.assistantMessageId,
            messageStatus: 'streaming',
            state: savingState,
        });
        currentState = savingState;
        await publishGeneratedImageMessageState({
            userId: params.userId,
            sessionId: params.sessionId,
            assistantMessageId: params.assistantMessageId,
            messageStatus: 'streaming',
            state: {
                ...savingState,
                images: [
                    buildEphemeralGeneratedImagePreview({
                        assistantMessageId: params.assistantMessageId,
                        contentType: providerResult.contentType,
                        imageBuffer: providerResult.imageBuffer,
                    }),
                ],
            },
            persist: false,
        });

        const storedImage = await storeGeneratedChatImage({
            userId: params.userId,
            assistantMessageId: params.assistantMessageId,
            buffer: providerResult.imageBuffer,
            contentType: providerResult.contentType,
            fileName: `${reservation.providerModel}.png`,
            publishPublic: String(params.source || '').trim().toLowerCase() === 'farcaster',
        });

        const completedState: GeneratedImageMessageState = {
            ...savingState,
            status: 'complete',
            stageLabel: 'Complete',
            images: buildChatImageMessageAttachments([storedImage]),
        };
        await publishGeneratedImageMessageState({
            userId: params.userId,
            sessionId: params.sessionId,
            assistantMessageId: params.assistantMessageId,
            messageStatus: 'complete',
            state: completedState,
        });
        currentState = completedState;
        await markGeneratedImageUsageCompleted(params.taskId);
        await chatRepo.updateTaskStatus(params.taskId, 'done');
        chatWS.broadcastToUser(params.userId, {
            type: 'message_complete',
            sessionId: params.sessionId,
            data: {
                messageId: params.assistantMessageId,
                taskId: params.taskId,
            },
        });
        broadcastTaskStatus({
            userId: params.userId,
            sessionId: params.sessionId,
            taskId: params.taskId,
            assistantMessageId: params.assistantMessageId,
            status: 'completed',
            message: 'Image complete',
        });
        return {
            status: 'complete',
            taskId: params.taskId,
            assistantMessageId: params.assistantMessageId,
            state: completedState,
            images: completedState.images,
            errorMessage: null,
        };
    } catch (error: any) {
        logger.warn(LogCode.AI_API_CALL, 'Generated image chat task failed', {
            taskId: params.taskId,
            assistantMessageId: params.assistantMessageId,
            userId: params.userId,
            model: params.requestedModel,
            error: error?.message || String(error),
        });
        const failureReason =
            isGeneratedImageSafetyError(error)
                ? 'GENERATED_IMAGE_SAFETY_BLOCKED'
                : isGeneratedImageProviderError(error)
                    ? error.code
                    : 'GENERATED_IMAGE_PROVIDER_FAILED';
        return await failGeneratedImageTask({
            taskId: params.taskId,
            userId: params.userId,
            sessionId: params.sessionId,
            assistantMessageId: params.assistantMessageId,
            state: currentState,
            reservation,
            errorMessage: buildFailureMessage({
                requestedModel: params.requestedModel,
                reason: failureReason,
                fallback: error?.message,
            }),
            failureReason,
        });
    } finally {
        await releaseLock(userLockKey, lockValue).catch(() => undefined);
    }
}

export async function executeGeneratedImageChatTask(params: StartGeneratedImageChatTaskParams): Promise<ExecuteGeneratedImageChatTaskResult> {
    return generatedImageExecutionLimit(() => runGeneratedImageChatTask(params));
}

export function startGeneratedImageChatTask(params: StartGeneratedImageChatTaskParams): void {
    void executeGeneratedImageChatTask(params).catch((error: any) => {
        logger.error(LogCode.AI_API_CALL, 'Generated image chat task crashed outside task runner', {
            taskId: params.taskId,
            assistantMessageId: params.assistantMessageId,
            error: error?.message || String(error),
        });
    });
}
