import prisma from '../../db/prisma.js';
import * as chatRepo from '../../repositories/chatRepository.js';
import { trackChatMessage } from '../userActivityService.js';
import { evaluateUsageAccess, isCurrentRequestFree } from '../usageAccess.js';
import { recordUsage } from '../usageCounter.js';
import { getEmbeddedWalletAddress, getSolanaEmbeddedWalletAddress } from '../privyWallet.js';
import { chatWorker } from '../../jobs/chatWorker.js';

function normalizeTaskModel(model?: string): string {
  const normalized = (model || '').toLowerCase().trim();
  return normalized || 'deepseek-chat';
}

function buildUsageLimitMessage(usageDecision: any): string {
  if (usageDecision.reason === 'DAILY_TOTAL_LIMIT_REACHED') {
    return `You have reached your daily total usage limit (${usageDecision.totalLimit} messages). Please check back tomorrow or increase your token balance to raise your limit.`;
  }
  if (usageDecision.reason === 'DAILY_ADVANCED_LIMIT_REACHED') {
    return 'You have reached your daily limit for Advanced models. You can continue using Normal models or wait until tomorrow.';
  }
  if (usageDecision.reason === 'DAILY_NORMAL_LIMIT_REACHED') {
    return 'You have reached your daily limit for Normal models. Please check back tomorrow.';
  }
  return 'Daily limit reached.';
}

export async function enqueueXAgentMessage(params: {
  userId: string;
  sessionId: string;
  content: string;
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
  const userMessage = await chatRepo.createMessage(params.sessionId, 'user', params.content.trim());
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
