// CONTEXT MEMORY
// Updated: 2026-04-16
// Author: Almurat
// Reason: X ingress now owns only mention-driven interaction. Product direction
//         changed after runtime/document evidence showed XChat webhook events do
//         not expose readable DM bodies through public lookup APIs, so inbound X
//         DMs are no longer treated as a conversation surface. Mention replies
//         now also use a KIKO-hosted public share link instead of posting full
//         AI text directly on X, while still following each user's saved web model.
//         The public card image was later corrected to a conversation-screenshot
//         visual, which requires the original user prompt to be persisted with
//         every share record.
//         every share record. Runtime logs on 2026-04-13 then showed webhook
//         mention events can still be non-replyable at the API layer, so mention
//         business must now confirm the tweet against the bot's official mentions
//         feed before spending quota and attempting a public reply. A later
//         runtime correction showed valid mentions can appear in webhook delivery
//         before they appear in `/users/{botUserId}/mentions`, so the worker now
//         treats early feed misses as a retryable indexing lag instead of a
//         final skip. X mention turns now also need hydrated thread text and
//         attached media because the model must be able to see the real post
//         context instead of only the current webhook text.
// Goal: preserve deterministic mention handling while keeping X as a link-only
//       public surface, aligning X reply model selection with persisted user
//       preference, and handing real thread/media context to the model.
// Owns: inbound X mention processing, session routing, dedupe, and reply dispatch.
// Does Not Own: OAuth exchange, X webhook signature checks, or token persistence.
// Design Language:
// - Never process the same inbound event twice.
// - Keep public replies short and move detail into a KIKO-owned share page.
// - Use the shared conversation mapping as the source of truth.
// - X DM/chat is not part of the mention reply path.
// - Ignore inbound DM payloads even if the webhook receives them unexpectedly.
// - Mentions from non-verified X accounts must not trigger automated replies.
// - Blue/business/government `verified_type` counts as verified for mention gating.
// - X mention sessions must use the same persisted default model the user chose on web.
// - Webhook ingress is a fast capture path, not the final authority on reply
//   eligibility; public replies require confirmation from the bot mentions feed.
// - A mention missing from `/mentions` immediately after webhook delivery may be
//   indexing lag; retry inside a bounded grace window before final skip.
// - Hydrate X mention context from the REST API before model execution so the
//   current turn can include parent posts and attached media.
// Document Provenance:
// - Source: X Activity API docs + X Direct Messages lookup docs
// - Kind: official API doc
// - Retrieved: 2026-04-10
// - Applied To: removing inbound DM handling after confirming no documented readable
//   XChat body path exists for `chat.received`
// - Verification: partially verified
// - Source: production webhook + local lookup probes
// - Kind: runtime observation
// - Retrieved: 2026-04-10
// - Applied To: confirmed `chat.received` arrives but lookup returns no readable text
// - Verification: verified in runtime
// - Source: X users/mentions and user lookup docs
// - Kind: official API doc
// - Retrieved: 2026-04-10
// - Applied To: requiring `verified=true` before mention replies to control cost and spam
// - Verification: partially verified
// - Source: direct `/users/{authorId}` and `/users/{botUserId}/mentions`
//   inspection for blue-check user `1920347546704097280`
// - Kind: runtime observation
// - Retrieved: 2026-04-13
// - Applied To: accepting blue/business/government `verified_type` as verified
//   mention authors instead of relying on legacy `verified` only
// - Verification: verified in runtime
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-user-default-chat-model-for-x-mentions.md
// - Kind: repo doc
// - Retrieved: 2026-04-10
// - Applied To: selecting X mention reply model from persisted user settings
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-11-x-reply-share-pages.md
// - Kind: repo doc
// - Retrieved: 2026-04-11
// - Applied To: replacing direct public AI replies with a KIKO-hosted share link
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-12-x-share-og-chat-preview.md
// - Kind: repo doc
// - Retrieved: 2026-04-12
// - Applied To: persisting the user's prompt so the public share image can render
//   a real chat-style preview instead of a generic summary poster
// - Verification: verified in code
// - Source: production log `logs.1776054230484.json`
// - Kind: runtime observation
// - Retrieved: 2026-04-13
// - Applied To: confirming webhook mention candidates against `/users/:id/mentions`
//   after X rejected outbound reply permission with a 403
// - Verification: verified in runtime
// - Source: production log `logs.1776058844460.json` + direct `/users/{botUserId}/mentions`
//   inspection for tweet `2043564901130703343`
// - Kind: runtime observation
// - Retrieved: 2026-04-13
// - Applied To: retrying mention confirmation instead of final skip when webhook
//   delivery beats mentions-feed indexing by a few seconds
// - Verification: verified in runtime
// - Source: X expansions/media docs
// - Kind: official API doc
// - Retrieved: 2026-04-16
// - Applied To: fetching X parent-thread text and image attachments before
//   social-agent model execution
// - Verification: verified in docs
// See also:
// - system-journal/INDEX.md
// - system-journal/fix-log/2026-04-16-social-agent-thread-context-and-image-input.md
// - system-journal/fix-log/2026-04-10-user-default-chat-model-for-x-mentions.md
// - system-journal/fix-log/2026-04-11-x-reply-share-pages.md
// - system-journal/fix-log/2026-04-12-x-share-og-chat-preview.md
// - system-journal/fix-log/2026-04-13-x-mention-feed-confirmation.md
// - system-journal/fix-log/2026-04-13-x-blue-verified-type-gate.md
// - system-journal/fix-log/2026-04-09-x-oauth-official-account-flow.md
// - system-journal/fix-log/2026-04-10-x-dm-outbound-only.md
// - system-journal/fix-log/2026-04-09-auth-debug-cleanup.md
// - system-journal/conflicts.md
import prisma from '../../db/prisma.js';
import cacheClient from '../../cache/cacheClient.js';
import { env } from '../../config/env.js';
import { normalizeSupportedChatModel } from '../../config/chatModels.js';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import { buildXLinkUrl, getUserByXUserId } from './xIdentityService.js';
import { findOrCreateXConversation, markXConversationInbound, syncXConversationModel } from './xConversationService.js';
import { recordXQuotaMetric } from './xQuotaService.js';
import { enqueueXAgentMessage, waitForTaskAssistantText } from './xChatBridge.js';
import { xApiClient } from './xApiClient.js';
import { xReplyService } from './xReplyService.js';
import { createXReplyShare } from './xReplyShareService.js';
import { getXBotUserId } from './xCredentialsService.js';
import { dedupeSocialImages, type SocialAgentInput } from '../socialAgentInput.js';
import type { XMentionEvent, XTweetContext } from './types.js';

const MENTION_CURSOR_KEY = 'x:ingress:mentions:since_id';
const RECOVERY_BATCH_SIZE = Math.max(1, Number(process.env.X_WEBHOOK_RECOVERY_BATCH_SIZE || '20'));
const MENTION_FEED_CONFIRMATION_GRACE_MS = 10 * 60 * 1000;

function isVerifiedMentionAuthor(mention: XMentionEvent): boolean {
  if (mention.authorVerified) return true;
  const verifiedType = String(mention.authorVerifiedType || '').trim().toLowerCase();
  return verifiedType === 'blue' || verifiedType === 'business' || verifiedType === 'government';
}

class MentionFeedPendingError extends Error {
  constructor(message = 'x_mention_feed_pending') {
    super(message);
    this.name = 'MentionFeedPendingError';
  }
}

function sortByNumericId<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    try {
      return Number(BigInt(a.id) - BigInt(b.id));
    } catch {
      return a.id.localeCompare(b.id);
    }
  });
}

function publicShareReplyText(shareUrl: string): string {
  return `I replied in KIKO. View it here: ${shareUrl}`;
}

function publicBindText(username?: string | null): string {
  return `Link your X account in KIKO first: ${buildXLinkUrl({ username })}`;
}

function formatXHandle(username?: string | null, authorId?: string | null): string {
  const normalized = String(username || '').trim().replace(/^@/, '');
  if (normalized) return `@${normalized}`;
  const id = String(authorId || '').trim();
  return id ? `user:${id}` : 'user:unknown';
}

async function buildXThreadHydration(mention: XMentionEvent, maxDepth: number = 3): Promise<{
  current: XTweetContext | null;
  parents: XTweetContext[];
}> {
  const current = await xApiClient.fetchTweetContextByTweetId(mention.id).catch(() => null);
  const parents: XTweetContext[] = [];
  const visited = new Set<string>();
  let nextTweetId = String(current?.parentTweetId || '').trim();

  while (nextTweetId && parents.length < maxDepth && !visited.has(nextTweetId)) {
    visited.add(nextTweetId);
    const parent = await xApiClient.fetchTweetContextByTweetId(nextTweetId).catch(() => null);
    if (!parent) break;
    parents.push(parent);
    nextTweetId = String(parent.parentTweetId || '').trim();
  }

  return {
    current,
    parents: parents.reverse(),
  };
}

function buildXThreadContextText(params: {
  mention: XMentionEvent;
  current: XTweetContext | null;
  parents: XTweetContext[];
}): string | null {
  const lines: string[] = [];
  for (const parent of params.parents) {
    lines.push(`Parent ${formatXHandle(parent.authorUsername, parent.authorId)}: ${parent.text}`);
  }

  for (const reference of params.current?.referencedTweets || []) {
    if (reference.relationship !== 'quoted' || !reference.text) continue;
    lines.push(`Quoted ${formatXHandle(reference.authorUsername, reference.authorId)}: ${reference.text}`);
  }

  return lines.length > 0 ? lines.join('\n') : null;
}

function buildXInboundPromptText(params: {
  mention: XMentionEvent;
  current: XTweetContext | null;
  parents: XTweetContext[];
}): string {
  const contextText = buildXThreadContextText(params);
  const currentText = String(params.current?.text || params.mention.text || '').trim();
  const currentHandle = formatXHandle(
    params.current?.authorUsername || params.mention.authorUsername,
    params.current?.authorId || params.mention.authorId,
  );

  return [
    'X inbound mention context:',
    contextText,
    `Current ${currentHandle}: ${currentText}`,
  ].filter(Boolean).join('\n');
}

function buildXSocialInput(params: {
  mention: XMentionEvent;
  current: XTweetContext | null;
  parents: XTweetContext[];
}): SocialAgentInput {
  const current = params.current;
  const currentHandle = formatXHandle(
    current?.authorUsername || params.mention.authorUsername,
    current?.authorId || params.mention.authorId,
  );

  const images = dedupeSocialImages([
    ...(current?.media || []).map((image) => ({
      url: image.url,
      altText: image.altText || null,
      sourceId: current?.id || params.mention.id,
      sourceLabel: `current X post by ${currentHandle}`,
    })),
    ...((current?.referencedTweets || []).flatMap((reference) => reference.media.map((image) => ({
      url: image.url,
      altText: image.altText || null,
      sourceId: reference.id,
      sourceLabel: `referenced ${reference.relationship} X post`,
    })))),
    ...(params.parents.flatMap((parent) => parent.media.map((image) => ({
      url: image.url,
      altText: image.altText || null,
      sourceId: parent.id,
      sourceLabel: `parent X post by ${formatXHandle(parent.authorUsername, parent.authorId)}`,
    })))),
  ]);

  return {
    platform: 'x',
    currentText: String(current?.text || params.mention.text || '').trim(),
    threadContextText: buildXThreadContextText(params),
    images,
  };
}

function normalizeMentionPayload(payload: unknown): XMentionEvent | null {
  const item = payload as any;
  const id = String(item?.id || '').trim();
  const authorId = String(item?.authorId || item?.author_id || '').trim();
  const text = String(item?.text || '').trim();
  if (!id || !authorId || !text) return null;
  return {
    id,
    text,
    authorId,
    authorUsername: item?.authorUsername || item?.author_username || null,
    authorVerified: item?.authorVerified === true,
    authorVerifiedType: item?.authorVerifiedType || item?.author_verified_type || null,
    conversationId: item?.conversationId || item?.conversation_id || null,
    createdAt: item?.createdAt || item?.created_at || null,
  };
}

export async function createInboundEventLog(params: {
  eventId: string;
  xUserId: string;
  channel: 'mention' | 'dm';
  sourceId?: string | null;
  payload: unknown;
  userId?: string | null;
}) {
  try {
    const record = await prisma.xEventLog.create({
      data: {
        eventId: params.eventId,
        userId: params.userId || null,
        xUserId: params.xUserId,
        channel: params.channel,
        direction: 'inbound',
        sourceId: params.sourceId || null,
        payload: params.payload as any,
        status: 'received',
      },
    });
    return { accepted: true, record };
  } catch (error: any) {
    if (error?.code === 'P2002') return { accepted: false, record: null };
    throw error;
  }
}

async function claimInboundEvent(eventId: string): Promise<boolean> {
  const result = await prisma.xEventLog.updateMany({
    where: {
      eventId,
      direction: 'inbound',
      status: 'received',
    },
    data: {
      status: 'processing',
    },
  });
  return result.count > 0;
}

export async function markInboundProcessed(eventId: string, status: 'processed' | 'failed', error?: unknown) {
  await prisma.xEventLog.updateMany({
    where: { eventId },
    data: {
      status,
      processedAt: new Date(),
      errorMessage: error ? String((error as any)?.message || error || 'unknown_error').slice(0, 500) : null,
    },
  }).catch(() => {});
}

async function requeueInboundEvent(eventId: string): Promise<void> {
  await prisma.xEventLog.updateMany({
    where: {
      eventId,
      direction: 'inbound',
      status: 'processing',
    },
    data: {
      status: 'received',
      errorMessage: null,
    },
  }).catch(() => {});
}

function isMentionFeedGraceWindowOpen(mention: XMentionEvent): boolean {
  const raw = String(mention.createdAt || '').trim();
  if (!raw) return true;
  const timestamp = Date.parse(raw);
  if (!Number.isFinite(timestamp)) return true;
  return (Date.now() - timestamp) < MENTION_FEED_CONFIRMATION_GRACE_MS;
}

export class XIngressWorker {
  private mentionsTimer: NodeJS.Timeout | null = null;
  private recoveryTimer: NodeJS.Timeout | null = null;
  private runningMentions = false;
  private runningRecovery = false;

  start(): void {
    if (!env.x.enabled) return;
    if (env.x.ingressMode === 'polling') {
      this.scheduleMentions(1000);
    }
    this.scheduleRecovery(2000);
    logger.info(LogCode.SYS_STARTUP, '[X] ingress worker started', {
      mode: env.x.ingressMode,
      botUserId: getXBotUserId() || env.x.botUserId || null,
      pollMentionsMs: env.x.pollMentionsMs,
      webhookRecoveryMs: env.x.webhookRecoveryMs,
    });
  }

  stop(): void {
    if (this.mentionsTimer) clearTimeout(this.mentionsTimer);
    if (this.recoveryTimer) clearTimeout(this.recoveryTimer);
    this.mentionsTimer = null;
    this.recoveryTimer = null;
  }

  async enqueueMention(mention: XMentionEvent): Promise<boolean> {
    const accepted = await createInboundEventLog({
      eventId: mention.id,
      xUserId: mention.authorId,
      channel: 'mention',
      sourceId: mention.conversationId || mention.id,
      payload: mention,
    });
    if (!accepted.accepted) return false;
    this.kickMentionProcessing(mention);
    return true;
  }

  async pollMentionsOnce(): Promise<void> {
    if (this.runningMentions || env.x.ingressMode !== 'polling' || !xApiClient.isConfigured()) return;
    this.runningMentions = true;
    try {
      const sinceId = await cacheClient.get(MENTION_CURSOR_KEY).catch(() => null);
      const mentions = sortByNumericId(await xApiClient.fetchMentions({ sinceId }));
      for (const mention of mentions) {
        await this.enqueueMention(mention);
      }
      const latestId = mentions.at(-1)?.id;
      if (latestId) {
        await cacheClient.set(MENTION_CURSOR_KEY, latestId, 7 * 24 * 60 * 60).catch(() => {});
      }
    } finally {
      this.runningMentions = false;
    }
  }

  async recoverPendingEventsOnce(): Promise<void> {
    if (this.runningRecovery || !env.x.enabled) return;
    this.runningRecovery = true;
    try {
      const rows = await prisma.xEventLog.findMany({
        where: {
          direction: 'inbound',
          status: 'received',
        },
        orderBy: { createdAt: 'asc' },
        take: RECOVERY_BATCH_SIZE,
      });

      for (const row of rows) {
        if (row.channel === 'mention') {
          const mention = normalizeMentionPayload(row.payload);
          if (!mention) {
            await markInboundProcessed(row.eventId, 'failed', new Error('invalid_mention_payload'));
            continue;
          }
          this.kickMentionProcessing(mention);
          continue;
        }
        await markInboundProcessed(row.eventId, 'failed', new Error('x_dm_inbound_disabled'));
      }
    } finally {
      this.runningRecovery = false;
    }
  }

  private scheduleMentions(delayMs: number): void {
    this.mentionsTimer = setTimeout(async () => {
      await this.pollMentionsOnce().catch((error) => {
        logger.warn(LogCode.API_NOTIFY_FAILED, '[X] mention poll failed', {
          error: String((error as any)?.message || error || 'unknown_error'),
        });
      });
      this.scheduleMentions(env.x.pollMentionsMs);
    }, delayMs);
  }

  private scheduleRecovery(delayMs: number): void {
    this.recoveryTimer = setTimeout(async () => {
      await this.recoverPendingEventsOnce().catch((error) => {
        logger.warn(LogCode.API_NOTIFY_FAILED, '[X] webhook recovery failed', {
          error: String((error as any)?.message || error || 'unknown_error'),
        });
      });
      this.scheduleRecovery(env.x.webhookRecoveryMs);
    }, delayMs);
  }

  private kickMentionProcessing(mention: XMentionEvent): void {
    void this.processMentionRecorded(mention).catch((error) => {
      logger.warn(LogCode.API_NOTIFY_FAILED, '[X] mention processing failed', {
        eventId: mention.id,
        error: String((error as any)?.message || error || 'unknown_error'),
      });
    });
  }

  private async processMentionRecorded(mention: XMentionEvent): Promise<void> {
    const claimed = await claimInboundEvent(mention.id);
    if (!claimed) return;
    try {
      await this.handleMentionBusiness(mention);
      await markInboundProcessed(mention.id, 'processed');
    } catch (error) {
      if (error instanceof MentionFeedPendingError) {
        await requeueInboundEvent(mention.id);
        return;
      }
      await markInboundProcessed(mention.id, 'failed', error);
      throw error;
    }
  }

  private async handleMentionBusiness(mention: XMentionEvent): Promise<void> {
    // CRITICAL: Never interact with self. The bot's own replies can appear in
    // the mentions feed or webhook delivery; processing them would create a
    // self-reply loop.
    const botUserId = getXBotUserId() || env.x.botUserId;
    if (botUserId && mention.authorId === botUserId) {
      return;
    }

    const confirmedMention = await xApiClient.fetchMentionByTweetId(mention.id);
    if (!confirmedMention) {
      if (isMentionFeedGraceWindowOpen(mention)) {
        logger.info(LogCode.API_NOTIFY_FAILED, '[X] Mention deferred: waiting for mentions feed indexing', {
          eventId: mention.id,
          xUserId: mention.authorId,
          username: mention.authorUsername || null,
          createdAt: mention.createdAt || null,
        });
        throw new MentionFeedPendingError();
      }
      logger.info(LogCode.API_NOTIFY_FAILED, '[X] Mention skipped: not present in mentions feed', {
        eventId: mention.id,
        xUserId: mention.authorId,
        username: mention.authorUsername || null,
      });
      return;
    }

    mention = {
      ...mention,
      ...confirmedMention,
      authorUsername: confirmedMention.authorUsername || mention.authorUsername || null,
      conversationId: confirmedMention.conversationId || mention.conversationId || null,
      createdAt: confirmedMention.createdAt || mention.createdAt || null,
    };

    if (!isVerifiedMentionAuthor(mention)) {
      logger.info(LogCode.API_NOTIFY_FAILED, '[X] Mention skipped: author not verified', {
        eventId: mention.id,
        xUserId: mention.authorId,
        username: mention.authorUsername || null,
        verifiedType: mention.authorVerifiedType || null,
      });
      return;
    }

    const user = await getUserByXUserId(mention.authorId);
    if (!user?.privyDid) {
      await xReplyService.replyToMention({
        xUserId: mention.authorId,
        tweetId: mention.id,
        text: publicBindText(mention.authorUsername),
        idempotencyKey: `x:reply:bind:${mention.id}`,
      });
      return;
    }

    const messageQuota = await recordXQuotaMetric({ userId: user.privyDid, metric: 'messages' });
    const runQuota = await recordXQuotaMetric({ userId: user.privyDid, metric: 'agent_runs' });
    if (!messageQuota.allowed || !runQuota.allowed) {
      await xReplyService.replyToMention({
        userId: user.privyDid,
        xUserId: mention.authorId,
        tweetId: mention.id,
        text: 'Daily X usage limit reached. Continue in the KIKO app tomorrow or raise your plan limit.',
        idempotencyKey: `x:reply:quota:${mention.id}`,
      });
      return;
    }

    const preferredModel = normalizeSupportedChatModel(user.settings?.defaultChatModel);
    const mapping = await findOrCreateXConversation({
      userId: user.privyDid,
      xUserId: mention.authorId,
      xUsername: mention.authorUsername || user.xUsername || null,
      channel: 'mention',
      rootTweetId: mention.conversationId || mention.id,
      preferredModel,
    });
    await syncXConversationModel({
      chatSessionId: mapping.chatSessionId,
      preferredModel,
    });
    await markXConversationInbound({
      mappingId: mapping.id,
      eventId: mention.id,
      messageId: mention.id,
      username: mention.authorUsername || user.xUsername || null,
    });

    const threadHydration = await buildXThreadHydration(mention);
    const socialInput = buildXSocialInput({
      mention,
      current: threadHydration.current,
      parents: threadHydration.parents,
    });
    const promptContent = buildXInboundPromptText({
      mention,
      current: threadHydration.current,
      parents: threadHydration.parents,
    });

    const queued = await enqueueXAgentMessage({
      userId: user.privyDid,
      sessionId: mapping.chatSessionId,
      content: promptContent,
      socialInput,
      channel: 'mention',
      xUserId: mention.authorId,
      xUsername: mention.authorUsername || user.xUsername || null,
      sourceMessageId: mention.id,
      rootTweetId: mention.conversationId || mention.id,
    });
    const assistantText = queued.completedSynchronously
      ? queued.assistantContent
      : await waitForTaskAssistantText({
          taskId: queued.task?.id,
          assistantMessageId: queued.assistantMessage.id,
        });
    const share = await createXReplyShare({
      userId: user.privyDid,
      xUserId: mention.authorId,
      conversationMappingId: mapping.id,
      chatSessionId: mapping.chatSessionId,
      sourceTweetId: mention.id,
      promptText: socialInput.currentText || mention.text,
      assistantText,
    });

    await xReplyService.replyToMention({
      userId: user.privyDid,
      xUserId: mention.authorId,
      tweetId: mention.id,
      conversationMappingId: mapping.id,
      text: publicShareReplyText(share.shareUrl),
      idempotencyKey: `x:reply:mention:${mention.id}`,
    });
  }
}

export const xIngressWorker = new XIngressWorker();
