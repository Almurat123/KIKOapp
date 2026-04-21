// CONTEXT MEMORY
// Updated: 2026-04-21
// Author: Linh Tran / Almurat
// Reason: Farcaster mention automation now consumes normalized events from the
//         webhook ingress when enabled, while webhook-enabled polling falls
//         back to Hub instead of burning Neynar notification quota. Public
//         cast replies also need client-safe formatting: collapsing all
//         whitespace into one long line can make Farcaster clients visually
//         truncate otherwise valid text. Farcaster social-agent replies now
//         also need hydrated cast images so the model can see embedded media
//         instead of only parent-thread text. Follow-up turns on Farcaster should
//         continue when a user directly replies to a bot-authored cast, even if
//         the follow-up does not mention the bot again. Webhook, polling, and
//         recovery ingress must all share one self/bot-loop admission guard so a
//         bot-authored reply cannot recursively trigger more public link replies.
//         Generated-image social turns now return structured image embeds from
//         the chat bridge, so the worker must dispatch both text and media to
//         the Farcaster reply owner. Farcaster image intent selection must stay
//         model-led: ingress may provide image context and saved model
//         preferences, but it must not bypass the ordinary agent by regex-routing
//         user wording directly to generated-image execution.
// Goal: preserve deterministic Farcaster mention handling while keeping polling
//       cheap, idempotent, and aligned with linked-user chat sessions, while
//       handing real thread/media context to the model and preserving direct
//       reply continuation semantics, while fail-closing self/bot loops before
//       durable enqueue.
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
// - Publish generated-image task results as cast embeds when the chat bridge
//   returns hydrated preview URLs.
// - Let the model decide whether to call `generate_image_from_intent`; ingress
//   should not hard-route user wording into image execution.
// - Accept no-mention follow-ups only when they are direct replies to a tracked
//   bot-authored outbound cast; do not watch arbitrary root-thread comments.
// - Reject self-authored and blocked-bot-authored inbound casts before event-log
//   persistence on every ingress path.
// - Treat any recent bind-link attempt as cooldown evidence; do not require a
//   successful send before suppressing another public link reply.
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
// - Source: Farcaster direct-reply runtime policy review
// - Kind: product/runtime observation
// - Retrieved: 2026-04-17
// - Applied To: treating direct replies to tracked bot casts as continuation
//   turns without requiring another @mention
// - Verification: verified in code and tests
// - Source: production runtime logs in
//   /Users/almurat/Downloads/logs.1776362968247.json showing bot-authored bind
//   replies re-entering as `parent_author_fids` webhook replies
// - Kind: runtime observation
// - Retrieved: 2026-04-17
// - Applied To: unified self/bot ingress guard and bind-link anti-spam cooldown
// - Verification: verified in runtime logs, code, and targeted tests
// - Source: operator requirement on 2026-04-19 for Farcaster generated-image replies
// - Kind: product doc
// - Retrieved: 2026-04-19
// - Applied To: passing generated-image reply embeds through outbound mention replies
// - Verification: verified in code and targeted tests
// - Source: operator correction on 2026-04-21 that Farcaster image intent must
//   be model-decided, not regex-decided by ingress
// - Kind: product doc
// - Retrieved: 2026-04-21
// - Applied To: removing direct generated-image routing from mention ingress
//   while preserving user image-model preferences in the model-led tool path
// - Verification: verified in code and targeted tests
// - Source: production runtime log /Users/almurat/Downloads/logs.1776611031853.json
// - Kind: runtime observation
// - Retrieved: 2026-04-19
// - Applied To: removing duplicate publish-time empty-text fallback after the
//   chat bridge already synthesizes generated-image acknowledgements
// - Verification: verified in runtime log and code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-social-agent-thread-context-and-image-input.md
// - /Users/almurat/KiKo/system-journal/owner-map/farcaster-neynar-webhook-ingress.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-farcaster-neynar-webhook-ingress.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-farcaster-neynar-notifications-standdown.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-farcaster-direct-reply-continuation.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-farcaster-self-loop-bind-spam-guard.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-farcaster-inbound-event-idempotence.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-farcaster-polling-agent-ingress.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-farcaster-generated-image-reply-and-watermark.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-21-model-led-picture-generation-tool.md
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
  listFarcasterReplyContinuationTargets,
  markFarcasterConversationInbound,
  syncFarcasterConversationModel,
} from './farcasterConversationService.js';
import {
  enqueueFarcasterAgentMessage,
  waitForFarcasterTaskAssistantReply,
} from './farcasterChatBridge.js';
import { farcasterReplyService } from './farcasterReplyService.js';
import { trimCastText } from './farcasterCastText.js';
import { dedupeSocialImages, type SocialAgentInput } from '../socialAgentInput.js';

const NOTIFICATION_WATERMARK_KEY = 'farcaster:ingress:mentions:last_seen_at';
const RECOVERY_BATCH_SIZE = Math.max(1, Number(process.env.FARCASTER_AGENT_RECOVERY_BATCH_SIZE || '20'));
const REPLY_CONTINUATION_PARENT_BATCH_SIZE = Math.max(0, Number(process.env.FARCASTER_AGENT_REPLY_CONTINUATION_PARENT_BATCH_SIZE || '25'));
const REPLY_CONTINUATION_LOOKBACK_MS = Math.max(
  60_000,
  Number(process.env.FARCASTER_AGENT_REPLY_CONTINUATION_LOOKBACK_MS || String(7 * 24 * 60 * 60 * 1000)),
);

// Maximum round-trips per conversation thread before the bot stops responding.
// Prevents infinite bot-to-bot loops and excessive self-conversation.
const MAX_CONVERSATION_ROUND_TRIPS = Math.max(
  1,
  Number(process.env.FARCASTER_AGENT_MAX_ROUND_TRIPS || '10'),
);
const BIND_REPLY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// Comma-separated list of FIDs that should be treated as bots and ignored.
const BLOCKED_BOT_FIDS: Set<number> = new Set(
  String(process.env.FARCASTER_AGENT_BLOCKED_BOT_FIDS || '')
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isFinite(v) && v > 0),
);

export type FarcasterInboundIgnoreReason = 'self_author' | 'blocked_bot_author';

export function getFarcasterInboundIgnoreReason(
  authorFid: number | null | undefined,
  options?: {
    botFid?: number;
    blockedBotFids?: Set<number> | number[];
  },
): FarcasterInboundIgnoreReason | null {
  const fid = Number(authorFid || 0);
  if (!Number.isFinite(fid) || fid <= 0) return null;

  const botFid = Number(options?.botFid ?? env.farcasterAgent.botFid);
  if (Number.isFinite(botFid) && botFid > 0 && fid === botFid) {
    return 'self_author';
  }

  const blocked = options?.blockedBotFids instanceof Set
    ? options.blockedBotFids
    : Array.isArray(options?.blockedBotFids)
      ? new Set(options.blockedBotFids)
      : BLOCKED_BOT_FIDS;
  if (blocked.has(fid)) {
    return 'blocked_bot_author';
  }

  return null;
}

export function buildBindReplyIdempotencyKey(authorFid: number, occurredAt?: string | null): string {
  const parsed = occurredAt ? Date.parse(occurredAt) : NaN;
  const date = new Date(Number.isFinite(parsed) ? parsed : Date.now()).toISOString().slice(0, 10);
  return `farcaster:reply:bind:${authorFid}:${date}`;
}

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

function dedupeMentionEvents(events: FarcasterMentionEvent[]): FarcasterMentionEvent[] {
  const seen = new Set<string>();
  const deduped: FarcasterMentionEvent[] = [];
  for (const event of events) {
    const key = String(event.eventId || event.castHash || '').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(event);
  }
  return deduped;
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
  // CRITICAL FIX: Always derive eventId from castHash so that the same cast
  // can never be processed twice regardless of source (webhook vs polling vs
  // recovery). External eventId values (e.g. Neynar notification IDs) are
  // intentionally ignored because the same cast produces different Neynar IDs
  // across webhook deliveries and notification page fetches.
  return {
    eventId: `farcaster:mention:${castHash}`,
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
    const ignoreReason = getFarcasterInboundIgnoreReason(mention.authorFid);
    if (ignoreReason) {
      logger.info(LogCode.SYS_INFO, '[Farcaster] dropping ignored inbound mention before enqueue', {
        eventId: mention.eventId,
        castHash: mention.castHash,
        authorFid: mention.authorFid,
        parentAuthorFid: mention.parentAuthorFid || null,
        notificationType: mention.notificationType,
        ignoreReason,
      });
      return false;
    }

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
      const parsed = this.filterAdmissibleFreshEvents(parseHubMentionEvents(page));

      events.push(...parsed);

      pageToken = page?.nextPageToken || null;
      pageCount += 1;
      if (!pageToken) break;
    }

    events.push(...await this.fetchDirectReplyContinuationEvents());

    const sorted = sortByOccurredAt(dedupeMentionEvents(this.filterAdmissibleFreshEvents(events)));
    if (!watermark) {
      return sorted;
    }

    return sorted.filter((event) => {
      const current = eventToMentionWatermark(event);
      return Boolean(current && compareMentionWatermarks(current, watermark) > 0);
    });
  }

  private filterAdmissibleFreshEvents(events: FarcasterMentionEvent[]): FarcasterMentionEvent[] {
    return events
      .filter((event) => !getFarcasterInboundIgnoreReason(event.authorFid))
      .filter((event) => event.castHash && event.text && event.occurredAt);
  }

  private async fetchDirectReplyContinuationEvents(): Promise<FarcasterMentionEvent[]> {
    if (REPLY_CONTINUATION_PARENT_BATCH_SIZE <= 0) {
      return [];
    }

    const since = new Date(Date.now() - REPLY_CONTINUATION_LOOKBACK_MS);
    const targets = await listFarcasterReplyContinuationTargets({
      limit: REPLY_CONTINUATION_PARENT_BATCH_SIZE,
      since,
    });
    const events: FarcasterMentionEvent[] = [];

    for (const target of targets) {
      try {
        const replies = await farcasterApiClient.fetchReplyContinuationEvents({
          parentHash: target.lastOutboundCastHash,
          parentAuthorFid: env.farcasterAgent.botFid,
          rootCastHash: target.rootCastHash,
          pageSize: env.farcasterAgent.pollPageSize,
        });
        events.push(...replies);
      } catch (error) {
        logger.warn(LogCode.API_NOTIFY_FAILED, '[Farcaster] reply continuation poll failed', {
          mappingId: target.id,
          parentHash: target.lastOutboundCastHash,
          error: String((error as any)?.message || error || 'unknown_error'),
        });
      }
    }

    return events;
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
    const ignoreReason = getFarcasterInboundIgnoreReason(mention.authorFid);
    // CRITICAL: Never interact with self or known bot-loop sources. This also
    // protects already-persisted events from before the enqueue guard existed.
    if (ignoreReason) {
      logger.info(LogCode.SYS_INFO, '[Farcaster] skipping ignored inbound mention during processing', {
        eventId: mention.eventId,
        castHash: mention.castHash,
        authorFid: mention.authorFid,
        parentAuthorFid: mention.parentAuthorFid || null,
        notificationType: mention.notificationType,
        ignoreReason,
      });
      return;
    }

    const user = await getUserByFarcasterFid(mention.authorFid);
    if (!user?.privyDid) {
      // Rate-limit bind replies: only reply once per cast (idempotency key
      // ensures this) and skip if this looks like a continuation turn that
      // would just spam more "link your account" messages.
      if (mention.notificationType === 'replies') {
        logger.info(LogCode.SYS_INFO, '[Farcaster] skipping bind reply for continuation turn from unlinked user', {
          castHash: mention.castHash,
          authorFid: mention.authorFid,
        });
        return;
      }

      // Cooldown: only allow one bind-link attempt per authorFid per 24 hours.
      // Any recent attempt counts, including pending/failed deliveries, because
      // anti-spam safety is more important than retrying a public link prompt.
      const recentBind = await prisma.farcasterMessageDelivery.findFirst({
        where: {
          farcasterFid: mention.authorFid,
          messageType: 'reply',
          idempotencyKey: { startsWith: 'farcaster:reply:bind:' },
          createdAt: { gte: new Date(Date.now() - BIND_REPLY_COOLDOWN_MS) },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (recentBind) {
        logger.info(LogCode.SYS_INFO, '[Farcaster] skipping bind reply: cooldown active for authorFid', {
          castHash: mention.castHash,
          authorFid: mention.authorFid,
          lastBindAt: recentBind.createdAt,
          lastBindStatus: recentBind.status,
        });
        return;
      }

      await farcasterReplyService.replyToMention({
        farcasterFid: mention.authorFid,
        parentHash: mention.castHash,
        parentAuthorFid: mention.authorFid,
        text: trimCastText(publicBindText(mention.authorUsername)),
        idempotencyKey: buildBindReplyIdempotencyKey(mention.authorFid, mention.occurredAt),
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
    const preferredGeneratedImageModel = String(user.settings?.defaultGeneratedImageModel || '').trim() || null;
    const preferredGeneratedImageQuality = String(user.settings?.defaultGeneratedImageQuality || '').trim() || null;
    const mapping = await findOrCreateFarcasterConversation({
      userId: user.privyDid,
      farcasterFid: mention.authorFid,
      farcasterUsername: mention.authorUsername || user.farcasterUsername || null,
      channel: 'mention',
      rootCastHash: mention.rootCastHash || mention.castHash,
      parentCastHash: mention.parentHash || null,
      preferredModel,
      initialMessageText: mention.text,
    });

    // Guard: stop responding in conversations that have exceeded the round-trip
    // limit. This prevents infinite loops between the bot and automated accounts
    // that keep replying.
    if ((mapping as any).roundTripCount >= MAX_CONVERSATION_ROUND_TRIPS) {
      logger.info(LogCode.SYS_INFO, '[Farcaster] conversation round-trip limit reached, skipping reply', {
        mappingId: mapping.id,
        roundTripCount: (mapping as any).roundTripCount,
        maxRoundTrips: MAX_CONVERSATION_ROUND_TRIPS,
        castHash: mention.castHash,
        authorFid: mention.authorFid,
      });
      return;
    }

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
      preferredGeneratedImageModel,
      preferredGeneratedImageQuality,
      farcasterFid: mention.authorFid,
      farcasterUsername: mention.authorUsername || user.farcasterUsername || null,
      sourceMessageId: mention.castHash,
      rootCastHash: mention.rootCastHash || mention.castHash,
    });

    const assistantReply = queued.completedSynchronously
      ? { text: queued.assistantContent || '', embeds: [] as string[] }
      : await waitForFarcasterTaskAssistantReply({
          taskId: queued.task?.id,
          assistantMessageId: queued.assistantMessage.id,
        });

    await farcasterReplyService.replyToMention({
      userId: user.privyDid,
      farcasterFid: mention.authorFid,
      conversationMappingId: mapping.id,
      parentHash: mention.castHash,
      parentAuthorFid: mention.authorFid,
      text: trimCastText(assistantReply.text),
      embeds: assistantReply.embeds,
      idempotencyKey: `farcaster:reply:mention:${mention.castHash}`,
    });
  }
}

export const farcasterIngressWorker = new FarcasterIngressWorker();
