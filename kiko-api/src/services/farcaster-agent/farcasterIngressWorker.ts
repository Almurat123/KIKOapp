// CONTEXT MEMORY
// Updated: 2026-04-16
// Author: Linh Tran
// Reason: Farcaster mention automation now consumes normalized events from the
//         webhook ingress when enabled, while webhook-enabled polling falls
//         back to Hub instead of burning Neynar notification quota. Public
//         cast replies also need client-safe formatting: collapsing all
//         whitespace into one long line can make Farcaster clients visually
//         truncate otherwise valid text. Farcaster social-agent replies now
//         also need hydrated cast images so the model can see embedded media
//         instead of only parent-thread text.
// Goal: preserve deterministic Farcaster mention handling while keeping polling
//       cheap, idempotent, and aligned with linked-user chat sessions, while
//       handing real thread/media context to the model.
// Owns: inbound Farcaster mention polling fallback, webhook-fed dedupe, session
//       routing, and reply dispatch.
// Does Not Own: Farcaster account provisioning, frontend linking UI, or generic chat logic.
// Design Language:
// - Never process the same inbound event twice.
// - Duplicate inbound events should resolve as quiet idempotence, not database
//   error noise.
// - Bootstrap the polling watermark without replaying old backlog on first start.
// - Keep polling cadence env-driven with a 10-second default so ops can later
//   raise it to 15 minutes or 1 hour without code changes.
// - Only linked Farcaster users can trigger full agent execution.
// - Keep public replies short enough for cast publication limits.
// - Preserve readable public reply structure; do not collapse model output into
//   one unbroken line.
// - Insert newlines into long continuous text runs so Farcaster clients can wrap
//   the reply instead of visually clipping it.
// - Prefer webhook-fed mention ingress when the webhook is enabled, but keep
//   notifications polling only for webhook-disabled recovery; webhook-enabled
//   polling should fall back to Hub to avoid Neynar read spend.
// - Hydrate current/parent cast context before model execution so image-bearing
//   embeds remain visible to vision-capable providers.
// Document Provenance:
// - Source: Neynar webhook documentation and notifications/cast lookup APIs
// - Kind: official API doc
// - Retrieved: 2026-04-15
// - Applied To: webhook-fed mention ingress, normalized mention event
//   consumption, and thread hydration
// - Verification: verified in code
// - Source: @farcaster/hub-nodejs README and dist typings
// - Kind: local SDK source
// - Retrieved: 2026-04-12
// - Applied To: Hub fallback mention polling and thread context hydration
// - Verification: verified in runtime
// - Source: Farcaster long-cast FIP discussion and local runtime observation
// - Kind: product doc / runtime observation
// - Retrieved: 2026-04-15
// - Applied To: keeping normal public replies short and formatted with
//   line-break opportunities for client rendering
// - Verification: verified in docs and code
// - Source: runtime logs showing repeated webhook/polling delivery for the same
//   Farcaster cast hash causing unique-key error noise on event_id
// - Kind: runtime observation
// - Retrieved: 2026-04-16
// - Applied To: quiet idempotent inbound event persistence
// - Verification: verified in runtime logs and code
// - Source: Neynar cast lookup and notifications docs
// - Kind: official API doc
// - Retrieved: 2026-04-16
// - Applied To: fetching Farcaster thread text and image embeds before
//   social-agent model execution
// - Verification: verified in docs
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-social-agent-thread-context-and-image-input.md
// - /Users/almurat/KiKo/system-journal/owner-map/farcaster-neynar-webhook-ingress.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-farcaster-neynar-webhook-ingress.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-farcaster-neynar-notifications-standdown.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-farcaster-inbound-event-idempotence.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-farcaster-polling-agent-ingress.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
import prisma from '../../db/prisma.js';
import cacheClient from '../../cache/cacheClient.js';
import { env } from '../../config/env.js';
import { normalizeSupportedChatModel } from '../../config/chatModels.js';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import { farcasterApiClient, parseHubMentionEvents } from './farcasterApiClient.js';
import type { FarcasterCastContext, FarcasterMentionEvent } from './types.js';
import { getUserByFarcasterFid, buildFarcasterLinkUrl } from './farcasterIdentityService.js';
import { recordFarcasterQuotaMetric } from './farcasterQuotaService.js';
import {
  findOrCreateFarcasterConversation,
  markFarcasterConversationInbound,
  syncFarcasterConversationModel,
} from './farcasterConversationService.js';
import {
  enqueueFarcasterAgentMessage,
  waitForFarcasterTaskAssistantText,
} from './farcasterChatBridge.js';
import { farcasterReplyService } from './farcasterReplyService.js';
import { trimCastText } from './farcasterCastText.js';
import { dedupeSocialImages, type SocialAgentInput } from '../socialAgentInput.js';

const NOTIFICATION_WATERMARK_KEY = 'farcaster:ingress:mentions:last_seen_at';
const RECOVERY_BATCH_SIZE = Math.max(1, Number(process.env.FARCASTER_AGENT_RECOVERY_BATCH_SIZE || '20'));

function compareIsoTimestamps(a?: string | null, b?: string | null): number {
  const left = a || '';
  const right = b || '';
  if (!left && !right) return 0;
  if (!left) return -1;
  if (!right) return 1;
  return left.localeCompare(right);
}

function sortByOccurredAt(events: FarcasterMentionEvent[]): FarcasterMentionEvent[] {
  return [...events].sort((a, b) => {
    const byTime = compareIsoTimestamps(a.occurredAt, b.occurredAt);
    if (byTime !== 0) return byTime;
    return String(a.castHash || '').localeCompare(String(b.castHash || ''));
  });
}

interface MentionWatermark {
  occurredAt: string;
  castHash: string;
}

function compareMentionWatermarks(a: MentionWatermark, b: MentionWatermark): number {
  const byTime = compareIsoTimestamps(a.occurredAt, b.occurredAt);
  if (byTime !== 0) return byTime;
  return String(a.castHash || '').localeCompare(String(b.castHash || ''));
}

function serializeMentionWatermark(value: MentionWatermark): string {
  return JSON.stringify(value);
}

function parseMentionWatermark(raw?: string | null): MentionWatermark | null {
  const normalized = String(raw || '').trim();
  if (!normalized) return null;
  try {
    const parsed = JSON.parse(normalized);
    const occurredAt = String(parsed?.occurredAt || '').trim();
    const castHash = String(parsed?.castHash || '').trim();
    if (!occurredAt || !castHash) return null;
    return { occurredAt, castHash };
  } catch {
    return null;
  }
}

function eventToMentionWatermark(event: FarcasterMentionEvent): MentionWatermark | null {
  const occurredAt = String(event.occurredAt || '').trim();
  const castHash = String(event.castHash || '').trim();
  if (!occurredAt || !castHash) return null;
  return { occurredAt, castHash };
}

function publicBindText(username?: string | null): string {
  return `Link your Farcaster account in KIKO first: ${buildFarcasterLinkUrl({ username })}`;
}

function normalizeMentionPayload(payload: unknown): FarcasterMentionEvent | null {
  const item = payload as any;
  const castHash = String(item?.castHash || item?.cast_hash || '').trim();
  const text = String(item?.text || '').trim();
  const authorFid = Number(item?.authorFid || item?.author_fid);
  if (!castHash || !text || !Number.isFinite(authorFid) || authorFid <= 0) return null;
  return {
    eventId: String(item?.eventId || item?.event_id || `farcaster:mention:${castHash}`).trim(),
    notificationType: item?.notificationType === 'replies' ? 'replies' : 'mentions',
    castHash,
    text,
    authorFid,
    authorUsername: item?.authorUsername || item?.author_username || null,
    parentHash: item?.parentHash || item?.parent_hash || null,
    parentAuthorFid: Number(item?.parentAuthorFid || item?.parent_author_fid) || null,
    rootCastHash: item?.rootCastHash || item?.root_cast_hash || castHash,
    occurredAt: item?.occurredAt || item?.occurred_at || null,
  };
}

async function buildThreadContext(mention: FarcasterMentionEvent, maxDepth: number = 3): Promise<FarcasterCastContext[]> {
  const chain: FarcasterCastContext[] = [];
  const visited = new Set<string>();
  let nextCastId = mention.parentHash && mention.parentAuthorFid
    ? {
      fid: mention.parentAuthorFid,
      hash: String(mention.parentHash || '').trim(),
    }
    : null;

  while (nextCastId && chain.length < maxDepth && !visited.has(`${nextCastId.fid}:${nextCastId.hash}`)) {
    visited.add(`${nextCastId.fid}:${nextCastId.hash}`);
    const cast = await farcasterApiClient.fetchCastByHash(nextCastId);
    if (!cast) break;
    chain.push(cast);
    nextCastId = cast.parentHash && cast.parentAuthorFid
      ? {
        fid: cast.parentAuthorFid,
        hash: String(cast.parentHash || '').trim(),
      }
      : null;
  }

  return chain.reverse();
}

function formatFarcasterHandle(username?: string | null, fid?: number | null): string {
  const normalized = String(username || '').trim().replace(/^@/, '');
  if (normalized) return `@${normalized}`;
  return `fid:${fid ?? 'unknown'}`;
}

function buildFarcasterThreadContextText(params: {
  parents: FarcasterCastContext[];
}): string | null {
  const lines = params.parents.map((cast) => `Parent ${formatFarcasterHandle(cast.authorUsername, cast.authorFid)}: ${cast.text}`);
  return lines.length > 0 ? lines.join('\n') : null;
}

async function buildMentionPromptContent(mention: FarcasterMentionEvent): Promise<{
  content: string;
  socialInput: SocialAgentInput;
}> {
  const parents = await buildThreadContext(mention);
  const current = await farcasterApiClient.fetchCastByHash({
    fid: mention.authorFid,
    hash: mention.castHash,
  }).catch(() => null);
  const threadContextText = buildFarcasterThreadContextText({ parents });
  const currentText = String(current?.text || mention.text || '').trim();
  const currentHandle = formatFarcasterHandle(current?.authorUsername || mention.authorUsername, current?.authorFid || mention.authorFid);
  const content = [
    'Farcaster inbound mention context:',
    threadContextText,
    `Current ${currentHandle}: ${currentText}`,
  ].filter(Boolean).join('\n');

  const images = dedupeSocialImages([
    ...(current?.images || []).map((image) => ({
      url: image.url,
      altText: image.altText || null,
      mimeType: image.mimeType || null,
      sourceId: current?.hash || mention.castHash,
      sourceLabel: image.sourceLabel || `current Farcaster cast by ${currentHandle}`,
    })),
    ...(parents.flatMap((parent) => (parent.images || []).map((image) => ({
      url: image.url,
      altText: image.altText || null,
      mimeType: image.mimeType || null,
      sourceId: parent.hash,
      sourceLabel: image.sourceLabel || `parent Farcaster cast by ${formatFarcasterHandle(parent.authorUsername, parent.authorFid)}`,
    })))),
  ]);

  return {
    content,
    socialInput: {
      platform: 'farcaster',
      currentText,
      threadContextText,
      images,
    },
  };
}

export async function createFarcasterInboundEventLog(params: {
  eventId: string;
  farcasterFid: number;
  channel: 'mention';
  sourceId?: string | null;
  payload: unknown;
  userId?: string | null;
}) {
  const inserted = await prisma.farcasterEventLog.createMany({
    data: [
      {
        eventId: params.eventId,
        userId: params.userId || null,
        farcasterFid: params.farcasterFid,
        channel: params.channel,
        direction: 'inbound',
        sourceId: params.sourceId || null,
        payload: params.payload as any,
        status: 'received',
      },
    ],
    skipDuplicates: true,
  });
  return { accepted: inserted.count > 0, record: null };
}

async function claimInboundEvent(eventId: string): Promise<boolean> {
  const result = await prisma.farcasterEventLog.updateMany({
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

export async function markFarcasterInboundProcessed(eventId: string, status: 'processed' | 'failed', error?: unknown) {
  await prisma.farcasterEventLog.updateMany({
    where: { eventId },
    data: {
      status,
      processedAt: new Date(),
      errorMessage: error ? String((error as any)?.message || error || 'unknown_error').slice(0, 500) : null,
    },
  }).catch(() => {});
}

export class FarcasterIngressWorker {
  private mentionsTimer: NodeJS.Timeout | null = null;
  private recoveryTimer: NodeJS.Timeout | null = null;
  private runningMentions = false;
  private runningRecovery = false;

  start(): void {
    if (!env.farcasterAgent.enabled) return;
    this.scheduleMentions(1000);
    this.scheduleRecovery(2000);
    logger.info(LogCode.SYS_STARTUP, '[Farcaster] ingress worker started', {
      botFid: env.farcasterAgent.botFid,
      webhookEnabled: env.farcasterAgent.neynarWebhookEnabled,
      pollingFallbackEnabled: true,
      pollMentionsMs: env.farcasterAgent.pollMentionsMs,
      pollPageSize: env.farcasterAgent.pollPageSize,
    });
  }

  stop(): void {
    if (this.mentionsTimer) clearTimeout(this.mentionsTimer);
    if (this.recoveryTimer) clearTimeout(this.recoveryTimer);
    this.mentionsTimer = null;
    this.recoveryTimer = null;
  }

  async enqueueMention(mention: FarcasterMentionEvent): Promise<boolean> {
    const accepted = await createFarcasterInboundEventLog({
      eventId: mention.eventId,
      farcasterFid: mention.authorFid,
      channel: 'mention',
      sourceId: mention.rootCastHash || mention.castHash,
      payload: mention,
    });
    if (!accepted.accepted) return false;
    this.kickMentionProcessing(mention);
    return true;
  }

  async pollMentionsOnce(): Promise<void> {
    if (this.runningMentions || !farcasterApiClient.isConfigured()) return;
    this.runningMentions = true;

    try {
      const lastSeenAt = parseMentionWatermark(await cacheClient.get(NOTIFICATION_WATERMARK_KEY).catch(() => null));
      const freshEvents = await this.fetchFreshEventsSince(lastSeenAt);
      const latestSeenAt = sortByOccurredAt(freshEvents).reduce<MentionWatermark | null>((latest, event) => {
        const watermark = eventToMentionWatermark(event);
        if (!watermark) return latest;
        if (!latest || compareMentionWatermarks(watermark, latest) > 0) {
          return watermark;
        }
        return latest;
      }, lastSeenAt);

      if (!lastSeenAt) {
        if (latestSeenAt) {
          await cacheClient.set(NOTIFICATION_WATERMARK_KEY, serializeMentionWatermark(latestSeenAt), 7 * 24 * 60 * 60).catch(() => {});
        }
        logger.info(LogCode.SYS_INFO, '[Farcaster] polling watermark bootstrapped', {
          lastSeenAt: latestSeenAt?.occurredAt || null,
          bootstrappedEvents: freshEvents.length,
        });
        return;
      }

      for (const mention of sortByOccurredAt(freshEvents)) {
        await this.enqueueMention(mention);
      }

      if (latestSeenAt && compareMentionWatermarks(latestSeenAt, lastSeenAt) > 0) {
        await cacheClient.set(NOTIFICATION_WATERMARK_KEY, serializeMentionWatermark(latestSeenAt), 7 * 24 * 60 * 60).catch(() => {});
      }
    } finally {
      this.runningMentions = false;
    }
  }

  async recoverPendingEventsOnce(): Promise<void> {
    if (this.runningRecovery || !env.farcasterAgent.enabled) return;
    this.runningRecovery = true;
    try {
      const rows = await prisma.farcasterEventLog.findMany({
        where: {
          direction: 'inbound',
          status: 'received',
        },
        orderBy: { createdAt: 'asc' },
        take: RECOVERY_BATCH_SIZE,
      });

      for (const row of rows) {
        const mention = normalizeMentionPayload(row.payload);
        if (!mention) {
          await markFarcasterInboundProcessed(row.eventId, 'failed', new Error('invalid_farcaster_mention_payload'));
          continue;
        }
        this.kickMentionProcessing(mention);
      }
    } finally {
      this.runningRecovery = false;
    }
  }

  private async fetchFreshEventsSince(lastSeenAt?: MentionWatermark | string | null): Promise<FarcasterMentionEvent[]> {
    let pageToken: Uint8Array | null = null;
    let pageCount = 0;
    const events: FarcasterMentionEvent[] = [];
    const watermark = typeof lastSeenAt === 'string' ? parseMentionWatermark(lastSeenAt) : lastSeenAt || null;

    while (pageCount < env.farcasterAgent.pollMaxPages) {
      const page = await farcasterApiClient.fetchMentionPage({ pageToken, pageSize: env.farcasterAgent.pollPageSize });
      const parsed = parseHubMentionEvents(page)
        .filter((event) => event.authorFid !== env.farcasterAgent.botFid)
        .filter((event) => event.castHash && event.text && event.occurredAt);

      events.push(...parsed);

      pageToken = page?.nextPageToken || null;
      pageCount += 1;
      if (!pageToken) break;
    }

    const sorted = sortByOccurredAt(events);
    if (!watermark) {
      return sorted;
    }

    return sorted.filter((event) => {
      const current = eventToMentionWatermark(event);
      return Boolean(current && compareMentionWatermarks(current, watermark) > 0);
    });
  }

  private scheduleMentions(delayMs: number): void {
    this.mentionsTimer = setTimeout(async () => {
      await this.pollMentionsOnce().catch((error) => {
        logger.warn(LogCode.API_NOTIFY_FAILED, '[Farcaster] mention poll failed', {
          error: String((error as any)?.message || error || 'unknown_error'),
        });
      });
      this.scheduleMentions(env.farcasterAgent.pollMentionsMs);
    }, delayMs);
  }

  private scheduleRecovery(delayMs: number): void {
    this.recoveryTimer = setTimeout(async () => {
      await this.recoverPendingEventsOnce().catch((error) => {
        logger.warn(LogCode.API_NOTIFY_FAILED, '[Farcaster] recovery failed', {
          error: String((error as any)?.message || error || 'unknown_error'),
        });
      });
      this.scheduleRecovery(Math.max(10_000, env.farcasterAgent.pollMentionsMs));
    }, delayMs);
  }

  private kickMentionProcessing(mention: FarcasterMentionEvent): void {
    void this.processMentionRecorded(mention).catch((error) => {
      logger.warn(LogCode.API_NOTIFY_FAILED, '[Farcaster] mention processing failed', {
        eventId: mention.eventId,
        castHash: mention.castHash,
        error: String((error as any)?.message || error || 'unknown_error'),
      });
    });
  }

  private async processMentionRecorded(mention: FarcasterMentionEvent): Promise<void> {
    const claimed = await claimInboundEvent(mention.eventId);
    if (!claimed) return;
    try {
      await this.handleMentionBusiness(mention);
      await markFarcasterInboundProcessed(mention.eventId, 'processed');
    } catch (error) {
      await markFarcasterInboundProcessed(mention.eventId, 'failed', error);
      throw error;
    }
  }

  private async handleMentionBusiness(mention: FarcasterMentionEvent): Promise<void> {
    const user = await getUserByFarcasterFid(mention.authorFid);
    if (!user?.privyDid) {
      await farcasterReplyService.replyToMention({
        farcasterFid: mention.authorFid,
        parentHash: mention.castHash,
        parentAuthorFid: mention.authorFid,
        text: trimCastText(publicBindText(mention.authorUsername)),
        idempotencyKey: `farcaster:reply:bind:${mention.castHash}`,
      });
      return;
    }

    const messageQuota = await recordFarcasterQuotaMetric({ userId: user.privyDid, metric: 'messages' });
    const runQuota = await recordFarcasterQuotaMetric({ userId: user.privyDid, metric: 'agent_runs' });
    if (!messageQuota.allowed || !runQuota.allowed) {
      await farcasterReplyService.replyToMention({
        userId: user.privyDid,
        farcasterFid: mention.authorFid,
        parentHash: mention.castHash,
        parentAuthorFid: mention.authorFid,
        text: 'Daily Farcaster usage limit reached. Continue in KIKO tomorrow or raise your plan limit.',
        idempotencyKey: `farcaster:reply:quota:${mention.castHash}`,
      });
      return;
    }

    const preferredModel = normalizeSupportedChatModel(user.settings?.defaultChatModel);
    const mapping = await findOrCreateFarcasterConversation({
      userId: user.privyDid,
      farcasterFid: mention.authorFid,
      farcasterUsername: mention.authorUsername || user.farcasterUsername || null,
      channel: 'mention',
      rootCastHash: mention.rootCastHash || mention.castHash,
      parentCastHash: mention.parentHash || null,
      preferredModel,
    });
    await syncFarcasterConversationModel({
      chatSessionId: mapping.chatSessionId,
      preferredModel,
    });
    await markFarcasterConversationInbound({
      mappingId: mapping.id,
      eventId: mention.eventId,
      castHash: mention.castHash,
      username: mention.authorUsername || user.farcasterUsername || null,
    });

    const inboundPrompt = await buildMentionPromptContent(mention);

    const queued = await enqueueFarcasterAgentMessage({
      userId: user.privyDid,
      sessionId: mapping.chatSessionId,
      content: inboundPrompt.content,
      socialInput: inboundPrompt.socialInput,
      farcasterFid: mention.authorFid,
      farcasterUsername: mention.authorUsername || user.farcasterUsername || null,
      sourceMessageId: mention.castHash,
      rootCastHash: mention.rootCastHash || mention.castHash,
    });

    const assistantText = queued.completedSynchronously
      ? queued.assistantContent
      : await waitForFarcasterTaskAssistantText({
          taskId: queued.task?.id,
          assistantMessageId: queued.assistantMessage.id,
        });

    await farcasterReplyService.replyToMention({
      userId: user.privyDid,
      farcasterFid: mention.authorFid,
      conversationMappingId: mapping.id,
      parentHash: mention.castHash,
      parentAuthorFid: mention.authorFid,
      text: trimCastText(assistantText),
      idempotencyKey: `farcaster:reply:mention:${mention.castHash}`,
    });
  }
}

export const farcasterIngressWorker = new FarcasterIngressWorker();
