// CONTEXT MEMORY
// Updated: 2026-04-16
// Author: Linh Tran
// Reason: Farcaster polling ingress needs a dedicated bridge into the shared
//         chat worker so mention threads can reuse the same AI runtime without
//         pretending to be X conversations. Farcaster social-agent turns now
//         also need structured thread/image metadata for the current turn while
//         still persisting a plain text transport message for audit/history.
// Goal: enqueue Farcaster-originated chat work with enough context for the
//       existing agent runtime, billing gates, and vision-capable providers.
// Owns: Farcaster-to-chat task creation, social-agent context handoff, and
//       assistant text waiting logic.
// Does Not Own: mention polling, reply publishing, or user linking.
// Design Language:
// - Reuse the shared chat worker and usage guards.
// - Persist inbound user messages before agent execution.
// - Carry Farcaster profile context into toolContext.
// - Keep structured social multimodal context separate from the canonical
//   stored message string.
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
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-social-agent-thread-context-and-image-input.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-farcaster-polling-agent-ingress.md
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
import type { SocialAgentInput } from '../socialAgentInput.js';

function normalizeTaskModel(model?: string): string {
  return normalizeSupportedChatModel(model);
}

function buildUsageLimitMessage(usageDecision: any): string {
  return getUsageLimitMessage(usageDecision);
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

export async function waitForFarcasterTaskAssistantText(params: {
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
