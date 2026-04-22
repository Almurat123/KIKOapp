// CONTEXT MEMORY
// Updated: 2026-04-22
// Author: Linh Tran
// Reason: X social-agent ingress now has to preserve more than plain text. The
//         shared chat worker still expects a persisted user message string, but
//         the current turn also needs structured social context/image metadata
//         so vision-capable providers can see the original post attachments.
//         X generated-image turns now need to mirror Farcaster's model-led flow:
//         carry image-model preferences into tool context, wait for generated
//         image assistant rows, and return hydrated media URLs to publication.
// Goal: enqueue X-originated chat work with stable text history plus explicit
//       structured social-agent multimodal input for the current turn and
//       generated-image media output for X reply publication.
// Owns: X-to-chat task creation and social-agent context handoff.
// Does Not Own: X thread fetching, prompt assembly, or reply publication.
// Design Language:
// - Persist the plain text transport message for audit/history.
// - Carry social multimodal context separately in message data and toolContext.
// - Do not let bridge-layer metadata replace the canonical stored user content.
// - X image generation is model-led: the bridge provides context/preferences and
//   waits for output, but the text model decides whether to call image tools.
// - Generated-image rows should return durable or signed image URLs to the
//   X reply layer, which uploads bytes to X media before replying.
// Document Provenance:
// - Source: X expansions/media docs
// - Kind: official API doc
// - Retrieved: 2026-04-16
// - Applied To: preserving X mention thread/media context for model-visible input
// - Verification: verified in docs and code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-social-agent-thread-context-and-image-input.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-user-default-chat-model-for-x-mentions.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

import prisma from '../../db/prisma.js';
import * as chatRepo from '../../repositories/chatRepository.js';
import { trackChatMessage } from '../userActivityService.js';
import { evaluateUsageAccess, getUsageLimitMessage, isCurrentRequestFree } from '../usageAccess.js';
import { recordUsage } from '../usageCounter.js';
import { getEmbeddedWalletAddress, getSolanaEmbeddedWalletAddress } from '../privyWallet.js';
import { chatWorker } from '../../jobs/chatWorker.js';
import { inferSupportedChatReasoningLevel, normalizeSupportedChatModel, normalizeSupportedChatReasoningLevel } from '../../config/chatModels.js';
import type { SocialAgentInput } from '../socialAgentInput.js';
import { hydrateGeneratedChatImageDataForClient, resolveGeneratedImagePublicUrl } from '../chatImageUploads.js';

function normalizeTaskModel(model?: string): string {
  return normalizeSupportedChatModel(model);
}

function buildUsageLimitMessage(usageDecision: any): string {
  return getUsageLimitMessage(usageDecision);
}

export interface XAssistantReply {
  text: string;
  mediaUrls: string[];
}

const DEFAULT_X_ERROR_REPLY = 'I ran into an issue processing that request. Please try again.';
const DEFAULT_X_TIMEOUT_REPLY = 'I am still working on that. Please try again in a moment.';
const DEFAULT_X_GENERATED_IMAGE_READY_REPLY = 'Generated.';
const DEFAULT_X_GENERATED_IMAGE_PENDING_REPLY = 'Image generation is still running. Please try again in a moment.';
const DEFAULT_X_TASK_REPLY_TIMEOUT_MS = 180_000;

function sanitizeXPublicReplyText(text: string): string {
  const trimmed = String(text || '').trim();
  if (!trimmed) return '';
  if (
    /^\[(HTTP_\d{3}|NO_FINAL_USER_FACING_OUTPUT|[A-Z][A-Z0-9_]+)\]\s*(?:\||$)/.test(trimmed)
    || /^HTTP\s+\d{3}\b/i.test(trimmed)
    || /Invalid parameter:\s*messages with role 'tool'/i.test(trimmed)
  ) {
    return DEFAULT_X_ERROR_REPLY;
  }
  return trimmed;
}

function normalizeXReplyMediaUrls(value: unknown): string[] {
  const rawUrls = Array.isArray(value) ? value : [];
  const deduped = new Set<string>();
  for (const raw of rawUrls) {
    const url = String(raw || '').trim();
    if (!url) continue;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') continue;
      deduped.add(parsed.toString());
    } catch {
      continue;
    }
  }
  return Array.from(deduped).slice(0, 4);
}

function readGeneratedImageMediaUrl(image: any): string | null {
  return resolveGeneratedImagePublicUrl(image)
    || String(image?.previewUrl || image?.url || '').trim()
    || null;
}

function buildGeneratedImageFallbackText(generatedImage: any, content: string): string {
  const safeContent = sanitizeXPublicReplyText(content);
  if (safeContent) return safeContent;
  const status = String(generatedImage?.status || '').trim().toLowerCase();
  const errorMessage = String(generatedImage?.errorMessage || '').trim();
  if (status === 'failed' && errorMessage) {
    return DEFAULT_X_ERROR_REPLY;
  }
  if (status === 'complete') return DEFAULT_X_GENERATED_IMAGE_READY_REPLY;
  return '';
}

export function resolveXAssistantReplyText(
  assistantMessage: any,
  options?: {
    taskStatus?: string | null;
    timedOut?: boolean;
  },
): string {
  const content = String(assistantMessage?.content || '').trim();
  const safeContent = sanitizeXPublicReplyText(content);
  if (safeContent) return safeContent;

  const taskStatus = String(options?.taskStatus || '').trim().toLowerCase();
  const generatedImage = assistantMessage?.data?.generatedImage || null;
  const generatedImageText = buildGeneratedImageFallbackText(generatedImage, content);
  if (generatedImageText) return generatedImageText;

  const messageType = String(assistantMessage?.type || '').trim().toLowerCase();
  const isGeneratedImageTurn = messageType === 'generated-image' || Boolean(generatedImage);
  if (isGeneratedImageTurn) {
    if (options?.timedOut || ['pending', 'queued', 'running'].includes(taskStatus)) {
      return DEFAULT_X_GENERATED_IMAGE_PENDING_REPLY;
    }
    if (['error', 'cancelled'].includes(taskStatus)) {
      return DEFAULT_X_ERROR_REPLY;
    }
    return DEFAULT_X_GENERATED_IMAGE_READY_REPLY;
  }

  if (options?.timedOut || ['pending', 'queued', 'running'].includes(taskStatus)) {
    return DEFAULT_X_TIMEOUT_REPLY;
  }
  return DEFAULT_X_ERROR_REPLY;
}

export async function buildXAssistantReplyFromGeneratedImageState(
  generatedImage: any,
  content = '',
): Promise<XAssistantReply> {
  if (!generatedImage) {
    return {
      text: String(content || '').trim(),
      mediaUrls: [],
    };
  }

  const rawImages = Array.isArray(generatedImage?.images) ? generatedImage.images : [];
  const rawMediaUrls = normalizeXReplyMediaUrls(rawImages.map((image: any) => readGeneratedImageMediaUrl(image)));
  let hydratedGeneratedImage = generatedImage;
  try {
    const hydratedData = await hydrateGeneratedChatImageDataForClient({ generatedImage });
    hydratedGeneratedImage = hydratedData?.generatedImage || generatedImage;
  } catch {
    hydratedGeneratedImage = generatedImage;
  }

  const images = Array.isArray(hydratedGeneratedImage?.images) ? hydratedGeneratedImage.images : [];
  const mediaUrls = normalizeXReplyMediaUrls([
    ...rawMediaUrls,
    ...images.map((image: any) => readGeneratedImageMediaUrl(image)),
  ]);
  return {
    text: buildGeneratedImageFallbackText(hydratedGeneratedImage, String(content || '').trim()),
    mediaUrls: String(hydratedGeneratedImage?.status || '').toLowerCase() === 'complete' ? mediaUrls : [],
  };
}

export async function buildXAssistantReplyFromMessage(assistantMessage: any): Promise<XAssistantReply> {
  const content = String(assistantMessage?.content || '').trim();
  const generatedImage = assistantMessage?.data?.generatedImage || null;
  if (!generatedImage) {
    return {
      text: content,
      mediaUrls: [],
    };
  }
  return buildXAssistantReplyFromGeneratedImageState(generatedImage, content);
}

export async function enqueueXAgentMessage(params: {
  userId: string;
  sessionId: string;
  content: string;
  socialInput?: SocialAgentInput | null;
  preferredReasoningLevel?: string | null;
  preferredGeneratedImageModel?: string | null;
  preferredGeneratedImageQuality?: string | null;
  channel: 'mention' | 'dm';
  xUserId: string;
  xUsername?: string | null;
  sourceMessageId: string;
  rootTweetId?: string | null;
  xDmConversationId?: string | null;
}) {
  const session = await chatRepo.getSession(params.sessionId);
  if (!session) {
    throw new Error(`Chat session ${params.sessionId} not found`);
  }
  if (session.userId !== params.userId) {
    throw new Error(`Chat session ${params.sessionId} does not belong to user ${params.userId}`);
  }

  const taskModel = normalizeTaskModel(session.model);
  const reasoningEffort =
    normalizeSupportedChatReasoningLevel(params.preferredReasoningLevel)
    || normalizeSupportedChatReasoningLevel(session.reasoningLevel)
    || inferSupportedChatReasoningLevel(taskModel);
  const trimmedContent = params.content.trim();
  const socialInput = params.socialInput || null;
  const userMessage = await chatRepo.createMessage(params.sessionId, 'user', trimmedContent, {
    data: socialInput ? {
      source: 'social_agent',
      platform: socialInput.platform,
      socialInput,
    } : undefined,
  });
  trackChatMessage(params.userId);

  const usageDecision = await evaluateUsageAccess({
    userId: params.userId,
    model: taskModel,
  });
  if (!usageDecision.allowed) {
    const assistantMessage = await chatRepo.createMessage(
      params.sessionId,
      'assistant',
      buildUsageLimitMessage(usageDecision),
      { status: 'complete' },
    );
    return {
      userMessage,
      assistantMessage,
      task: null,
      completedSynchronously: true,
      assistantContent: assistantMessage.content,
    };
  }

  const assistantMessage = await chatRepo.createMessage(params.sessionId, 'assistant', '', {
    status: 'streaming',
  });

  const [evmWalletAddress, solanaWalletAddress] = await Promise.all([
    getEmbeddedWalletAddress(params.userId).catch(() => null),
    getSolanaEmbeddedWalletAddress(params.userId).catch(() => null),
  ]);

  const toolContext = {
    userId: params.userId,
    assistantMessageId: assistantMessage.id,
    sessionId: params.sessionId,
    walletAddress: evmWalletAddress || solanaWalletAddress || undefined,
    userAddress: evmWalletAddress || undefined,
    evmWalletAddress: evmWalletAddress || undefined,
    solanaWalletAddress: solanaWalletAddress || undefined,
    solanaAddress: solanaWalletAddress || undefined,
    userSolanaAddress: solanaWalletAddress || undefined,
    allowanceMode: 'confirm',
    accessToken: '',
    currentPage: 'x',
    pageContext: 'x_agent',
    billing: {
      isFree: isCurrentRequestFree(usageDecision),
      modelCategory: usageDecision.modelCategory,
    },
    x: {
      channel: params.channel,
      xUserId: params.xUserId,
      username: params.xUsername || null,
      sourceMessageId: params.sourceMessageId,
      rootTweetId: params.rootTweetId || null,
      xDmConversationId: params.xDmConversationId || null,
    },
    socialInput: socialInput || undefined,
    reasoningEffort,
    generatedImagePreference: {
      model: params.preferredGeneratedImageModel || null,
      quality: params.preferredGeneratedImageQuality || null,
    },
  };

  const task = await chatRepo.createTask(
    params.sessionId,
    taskModel,
    userMessage.id,
    assistantMessage.id,
    toolContext,
  );

  try {
    await recordUsage({
      userId: params.userId,
      dateUtc: usageDecision.dateUtc,
      modelCategory: usageDecision.modelCategory,
      model: taskModel,
      assistantMessageId: assistantMessage.id,
    });
  } catch {
    // Usage accounting should not block X ingress.
  }

  chatWorker.wake().catch(() => {});

  return {
    userMessage,
    assistantMessage,
    task,
    completedSynchronously: false,
    assistantContent: null,
  };
}

export async function waitForTaskAssistantReply(params: {
  taskId?: string | null;
  assistantMessageId: string;
  timeoutMs?: number;
}): Promise<XAssistantReply> {
  if (!params.taskId) {
    const assistantMessage = await chatRepo.getMessage(params.assistantMessageId);
    const reply = await buildXAssistantReplyFromMessage(assistantMessage);
    return {
      text: reply.text || resolveXAssistantReplyText(assistantMessage),
      mediaUrls: reply.mediaUrls,
    };
  }

  const timeoutMs = Math.max(1_000, Number(params.timeoutMs || DEFAULT_X_TASK_REPLY_TIMEOUT_MS));
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const [task, assistantMessage] = await Promise.all([
      chatRepo.getTask(params.taskId),
      chatRepo.getMessage(params.assistantMessageId),
    ]);

    if (!task || ['done', 'error', 'cancelled'].includes(task.status)) {
      const reply = await buildXAssistantReplyFromMessage(assistantMessage);
      const outputReply = reply.mediaUrls.length > 0
        ? reply
        : await buildXAssistantReplyFromGeneratedImageState(
          task?.toolContext?.generatedImage?.output,
          reply.text,
        );
      return {
        text: outputReply.text || reply.text || resolveXAssistantReplyText(assistantMessage, {
          taskStatus: task?.status || null,
        }),
        mediaUrls: outputReply.mediaUrls.length > 0 ? outputReply.mediaUrls : reply.mediaUrls,
      };
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  const assistantMessage = await chatRepo.getMessage(params.assistantMessageId);
  const reply = await buildXAssistantReplyFromMessage(assistantMessage);
  return {
    text: reply.text || resolveXAssistantReplyText(assistantMessage, {
      taskStatus: 'running',
      timedOut: true,
    }),
    mediaUrls: reply.mediaUrls,
  };
}

export async function waitForTaskAssistantText(params: {
  taskId?: string | null;
  assistantMessageId: string;
  timeoutMs?: number;
}) {
  const reply = await waitForTaskAssistantReply(params);
  return reply.text;
}

export async function getUserXBindings(userId: string) {
  return prisma.user.findUnique({
    where: { privyDid: userId },
    select: {
      xUserId: true,
      xUsername: true,
      xDmOptInAt: true,
      xNotificationsMutedAt: true,
    },
  });
}
