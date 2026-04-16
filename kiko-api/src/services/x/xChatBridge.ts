// CONTEXT MEMORY
// Updated: 2026-04-16
// Author: Linh Tran
// Reason: X social-agent ingress now has to preserve more than plain text. The
//         shared chat worker still expects a persisted user message string, but
//         the current turn also needs structured social context/image metadata
//         so vision-capable providers can see the original post attachments.
// Goal: enqueue X-originated chat work with stable text history plus explicit
//       structured social-agent multimodal input for the current turn.
// Owns: X-to-chat task creation and social-agent context handoff.
// Does Not Own: X thread fetching, prompt assembly, or reply publication.
// Design Language:
// - Persist the plain text transport message for audit/history.
// - Carry social multimodal context separately in message data and toolContext.
// - Do not let bridge-layer metadata replace the canonical stored user content.
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
import { normalizeSupportedChatModel } from '../../config/chatModels.js';
import type { SocialAgentInput } from '../socialAgentInput.js';

function normalizeTaskModel(model?: string): string {
  return normalizeSupportedChatModel(model);
}

function buildUsageLimitMessage(usageDecision: any): string {
  return getUsageLimitMessage(usageDecision);
}

export async function enqueueXAgentMessage(params: {
  userId: string;
  sessionId: string;
  content: string;
  socialInput?: SocialAgentInput | null;
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

export async function waitForTaskAssistantText(params: {
  taskId?: string | null;
  assistantMessageId: string;
  timeoutMs?: number;
}) {
  if (!params.taskId) {
    const assistantMessage = await chatRepo.getMessage(params.assistantMessageId);
    return String(assistantMessage?.content || '').trim();
  }

  const timeoutMs = Math.max(1_000, Number(params.timeoutMs || 90_000));
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const [task, assistantMessage] = await Promise.all([
      chatRepo.getTask(params.taskId),
      chatRepo.getMessage(params.assistantMessageId),
    ]);

    if (!task || ['done', 'error', 'cancelled'].includes(task.status)) {
      const content = String(assistantMessage?.content || '').trim();
      return content || 'I ran into an issue processing that request. Please try again.';
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  const assistantMessage = await chatRepo.getMessage(params.assistantMessageId);
  return String(assistantMessage?.content || '').trim() || 'I am still working on that. Please try again in a moment.';
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
