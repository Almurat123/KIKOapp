// CONTEXT MEMORY
// Updated: 2026-04-20
// Author: Linh Tran
// Reason: Farcaster polling ingress needs a dedicated bridge into the shared
//         chat worker so mention threads can reuse the same AI runtime without
//         pretending to be X conversations. Farcaster social-agent turns now
//         also need structured thread/image metadata for the current turn while
//         still persisting a plain text transport message for audit/history.
//         Model-owned generated-image turns now finish as `generated-image`
//         assistant rows rather than text rows, so the Farcaster bridge must
//         return both reply text and hydrated image embeds to the outbound cast
//         layer. Production runtime logs then showed a public-reply gap: some
//         successful generated-image turns still reached Farcaster publication
//         with empty assistant text, which triggered the generic English error
//         fallback instead of an image-ready acknowledgement. A later
//         production check showed the acknowledgement was still Chinese and the
//         cast embed list could be empty even after image generation completed,
//         so Farcaster publication must use English status text and fall back to
//         generated-image task output media before publishing.
// Goal: enqueue Farcaster-originated chat work with enough context for the
//       existing agent runtime, billing gates, vision-capable providers, and
//       social reply publication of generated-image assets.
// Owns: Farcaster-to-chat task creation, social-agent context handoff, and
//       assistant reply waiting logic.
// Does Not Own: mention polling, reply publishing, or user linking.
// Design Language:
// - Reuse the shared chat worker and usage guards.
// - Persist inbound user messages before agent execution.
// - Carry Farcaster profile context into toolContext.
// - Keep structured social multimodal context separate from the canonical
//   stored message string.
// - Generated-image assistant rows should become Farcaster cast embeds after
//   client-safe hydration; do not expect image turns to have assistant text.
// - Farcaster generated-image embeds must prefer durable public media URLs and
//   use signed preview URLs only for legacy rows that predate public copies.
// - Farcaster public replies are international-facing; generated-image fallback
//   text must stay English and must not reintroduce Chinese status copy.
// Document Provenance:
// - Source: repo code review of X chat bridge
// - Kind: repo doc
// - Retrieved: 2026-04-10
// - Applied To: reusing chat worker/task creation for Farcaster mention threads
// - Verification: verified in code
// - Source: Neynar cast lookup and notifications docs
// - Kind: official API doc
// - Retrieved: 2026-04-16
// - Applied To: preserving Farcaster cast image context for the current model turn
// - Verification: verified in docs and code
// - Source: operator requirement on 2026-04-19 for Farcaster generated-image replies
// - Kind: product doc
// - Retrieved: 2026-04-19
// - Applied To: extracting generated-image preview URLs for Farcaster outbound embeds
// - Verification: verified in code and targeted test
// - Source: operator correction on 2026-04-19 for production-stable Farcaster image embeds
// - Kind: product doc
// - Retrieved: 2026-04-19
// - Applied To: preferring generated-image public URLs over signed preview URLs
// - Verification: verified in targeted test
// - Source: production runtime log /Users/almurat/Downloads/logs.1776611031853.json
// - Kind: runtime observation
// - Retrieved: 2026-04-19
// - Applied To: synthesizing generated-image reply text when a tool-managed
//   Farcaster turn reaches terminal state without assistant text
// - Verification: verified in runtime log and code
// - Source: production runtime log /Users/almurat/Downloads/logs.1776622156347.json
// - Kind: runtime observation
// - Retrieved: 2026-04-20
// - Applied To: English-only generated-image Farcaster fallback text and
//   task-output image embed fallback before cast publication
// - Verification: verified in runtime log and targeted tests
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-social-agent-thread-context-and-image-input.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-farcaster-polling-agent-ingress.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-farcaster-generated-image-reply-and-watermark.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-farcaster-generated-image-english-media-reply.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
import * as chatRepo from '../../repositories/chatRepository.js';
import { trackChatMessage } from '../userActivityService.js';
import { evaluateUsageAccess, getUsageLimitMessage, isCurrentRequestFree } from '../usageAccess.js';
import { recordUsage } from '../usageCounter.js';
import { getEmbeddedWalletAddress, getSolanaEmbeddedWalletAddress } from '../privyWallet.js';
import { chatWorker } from '../../jobs/chatWorker.js';
import { normalizeSupportedChatModel } from '../../config/chatModels.js';
import { buildFarcasterProfileUrl } from './farcasterIdentityService.js';
import { env } from '../../config/env.js';
import { hydrateGeneratedChatImageDataForClient } from '../chatImageUploads.js';
import type { SocialAgentInput } from '../socialAgentInput.js';

function normalizeTaskModel(model?: string): string {
  return normalizeSupportedChatModel(model);
}

function buildUsageLimitMessage(usageDecision: any): string {
  return getUsageLimitMessage(usageDecision);
}

export interface FarcasterAssistantReply {
  text: string;
  embeds: string[];
}

const DEFAULT_FARCASTER_ERROR_REPLY = 'I ran into an issue processing that request. Please try again.';
const DEFAULT_FARCASTER_TIMEOUT_REPLY = 'I am still working on that. Please try again in a moment.';
const DEFAULT_FARCASTER_GENERATED_IMAGE_READY_REPLY = 'Generated.';
const DEFAULT_FARCASTER_GENERATED_IMAGE_PENDING_REPLY = 'Image generation is still running. Please try again in a moment.';

function normalizeFarcasterReplyEmbedUrls(value: unknown): string[] {
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
  return Array.from(deduped).slice(0, 2);
}

function buildGeneratedImageFallbackText(generatedImage: any, content: string): string {
  if (content) return content;
  const status = String(generatedImage?.status || '').trim().toLowerCase();
  const errorMessage = String(generatedImage?.errorMessage || '').trim();
  if (status === 'failed' && errorMessage) return errorMessage;
  if (status === 'complete') return DEFAULT_FARCASTER_GENERATED_IMAGE_READY_REPLY;
  return '';
}

export function resolveFarcasterAssistantReplyText(
  assistantMessage: any,
  options?: {
    taskStatus?: string | null;
    timedOut?: boolean;
  },
): string {
  const content = String(assistantMessage?.content || '').trim();
  if (content) return content;

  const taskStatus = String(options?.taskStatus || '').trim().toLowerCase();
  const generatedImage = assistantMessage?.data?.generatedImage || null;
  const generatedImageText = buildGeneratedImageFallbackText(generatedImage, content);
  if (generatedImageText) return generatedImageText;

  const messageType = String(assistantMessage?.type || '').trim().toLowerCase();
  const isGeneratedImageTurn = messageType === 'generated-image' || Boolean(generatedImage);
  if (isGeneratedImageTurn) {
    if (options?.timedOut || ['pending', 'queued', 'running'].includes(taskStatus)) {
      return DEFAULT_FARCASTER_GENERATED_IMAGE_PENDING_REPLY;
    }
    if (['error', 'cancelled'].includes(taskStatus)) {
      return DEFAULT_FARCASTER_ERROR_REPLY;
    }
    return DEFAULT_FARCASTER_GENERATED_IMAGE_READY_REPLY;
  }

  if (options?.timedOut || ['pending', 'queued', 'running'].includes(taskStatus)) {
    return DEFAULT_FARCASTER_TIMEOUT_REPLY;
  }
  return DEFAULT_FARCASTER_ERROR_REPLY;
}

export async function buildFarcasterAssistantReplyFromGeneratedImageState(
  generatedImage: any,
  content = '',
): Promise<FarcasterAssistantReply> {
  if (!generatedImage) {
    return {
      text: String(content || '').trim(),
      embeds: [],
    };
  }

  const rawImages = Array.isArray(generatedImage?.images) ? generatedImage.images : [];
  const rawEmbedUrls = normalizeFarcasterReplyEmbedUrls(rawImages.map((image: any) => image?.publicUrl || image?.previewUrl || image?.url));
  let hydratedGeneratedImage = generatedImage;
  try {
    const hydratedData = await hydrateGeneratedChatImageDataForClient({ generatedImage });
    hydratedGeneratedImage = hydratedData?.generatedImage || generatedImage;
  } catch {
    hydratedGeneratedImage = generatedImage;
  }

  const images = Array.isArray(hydratedGeneratedImage?.images) ? hydratedGeneratedImage.images : [];
  const embedUrls = normalizeFarcasterReplyEmbedUrls([
    ...rawEmbedUrls,
    ...images.map((image: any) => image?.publicUrl || image?.previewUrl || image?.url),
  ]);
  return {
    text: buildGeneratedImageFallbackText(hydratedGeneratedImage, String(content || '').trim()),
    embeds: String(hydratedGeneratedImage?.status || '').toLowerCase() === 'complete' ? embedUrls : [],
  };
}

export async function buildFarcasterAssistantReplyFromMessage(assistantMessage: any): Promise<FarcasterAssistantReply> {
  const content = String(assistantMessage?.content || '').trim();
  const generatedImage = assistantMessage?.data?.generatedImage || null;
  if (!generatedImage) {
    return {
      text: content,
      embeds: [],
    };
  }
  return buildFarcasterAssistantReplyFromGeneratedImageState(generatedImage, content);
}

export async function enqueueFarcasterAgentMessage(params: {
  userId: string;
  sessionId: string;
  content: string;
  socialInput?: SocialAgentInput | null;
  farcasterFid: number;
  farcasterUsername?: string | null;
  sourceMessageId: string;
  rootCastHash?: string | null;
}) {
  const session = await chatRepo.getSession(params.sessionId);
  if (!session) {
    throw new Error(`Chat session ${params.sessionId} not found`);
  }
  if (session.userId !== params.userId) {
    throw new Error(`Chat session ${params.sessionId} does not belong to user ${params.userId}`);
  }

  const taskModel = normalizeTaskModel(session.model);
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
    currentPage: 'farcaster',
    pageContext: 'farcaster_agent',
    billing: {
      isFree: isCurrentRequestFree(usageDecision),
      modelCategory: usageDecision.modelCategory,
    },
    farcaster: {
      fid: params.farcasterFid,
      username: params.farcasterUsername || null,
      profileUrl: buildFarcasterProfileUrl(params.farcasterUsername),
      kikoHandle: env.farcasterAgent.botUsername || 'kikoapp',
      followsKiko: null,
    },
    farcasterAgent: {
      sourceMessageId: params.sourceMessageId,
      rootCastHash: params.rootCastHash || null,
    },
    socialInput: socialInput || undefined,
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
    // Usage accounting should not block Farcaster ingress.
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

export async function waitForFarcasterTaskAssistantReply(params: {
  taskId?: string | null;
  assistantMessageId: string;
  timeoutMs?: number;
}): Promise<FarcasterAssistantReply> {
  if (!params.taskId) {
    const assistantMessage = await chatRepo.getMessage(params.assistantMessageId);
    const reply = await buildFarcasterAssistantReplyFromMessage(assistantMessage);
    return {
      text: reply.text || resolveFarcasterAssistantReplyText(assistantMessage),
      embeds: reply.embeds,
    };
  }

  const timeoutMs = Math.max(1_000, Number(params.timeoutMs || 90_000));
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const [task, assistantMessage] = await Promise.all([
      chatRepo.getTask(params.taskId),
      chatRepo.getMessage(params.assistantMessageId),
    ]);

    if (!task || ['done', 'error', 'cancelled'].includes(task.status)) {
      const reply = await buildFarcasterAssistantReplyFromMessage(assistantMessage);
      const outputReply = reply.embeds.length > 0
        ? reply
        : await buildFarcasterAssistantReplyFromGeneratedImageState(
          task?.toolContext?.generatedImage?.output,
          reply.text,
        );
      return {
        text: outputReply.text || reply.text || resolveFarcasterAssistantReplyText(assistantMessage, {
          taskStatus: task?.status || null,
        }),
        embeds: outputReply.embeds.length > 0 ? outputReply.embeds : reply.embeds,
      };
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  const assistantMessage = await chatRepo.getMessage(params.assistantMessageId);
  const reply = await buildFarcasterAssistantReplyFromMessage(assistantMessage);
  return {
    text: reply.text || resolveFarcasterAssistantReplyText(assistantMessage, {
      taskStatus: 'running',
      timedOut: true,
    }),
    embeds: reply.embeds,
  };
}

export async function waitForFarcasterTaskAssistantText(params: {
  taskId?: string | null;
  assistantMessageId: string;
  timeoutMs?: number;
}) {
  const reply = await waitForFarcasterTaskAssistantReply(params);
  return reply.text;
}
