import prisma from '../../db/prisma.js';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import { markXConversationOutbound } from './xConversationService.js';
import { xApiClient } from './xApiClient.js';
import sharp from 'sharp';

type DeliveryChannel = 'mention' | 'dm';
type DeliveryType = 'reply' | 'dm' | 'notification';

const MAX_PUBLIC_X_REPLY_CHARS = 280;
const MAX_X_TWEET_IMAGE_COUNT = 4;
const MAX_X_TWEET_IMAGE_BYTES = 5 * 1024 * 1024;
const FALLBACK_PUBLIC_X_REPLY_TEXT = 'I processed this in KIKO, but the reply contained media or links that I cannot post on X.';
const GENERATED_IMAGE_READY_REPLY_TEXT = 'Generated.';

// CONTEXT MEMORY
// Updated: 2026-04-24
// Status: verified
// Why: Public X mention replies must never send private KIKO share/OGP/image
//      links. Public deployment receipts are different: Clanker/Four.meme and
//      explorer URLs are the product result and must remain visible on X.
// Debug Goal: keep private/app-generated URLs out of automated public replies,
//             while allowing public token/result links and generated image
//             media upload by media_id.
// Search Tags: x mention no ogp links, x public reply strip urls, x generated image media upload
// Invariants:
// - Mention replies sent through the X API must not contain KIKO share, app, or
//   generated-image URLs.
// - Public token deployment and explorer URLs are allowed because they are the
//   durable receipt users need on social surfaces.
// - Generated images attach as uploaded media IDs, never as public image URLs.
// - The delivery payload persisted for mention replies must match sanitized text.
// Failure Modes:
// - Reintroducing KIKO share URLs creates OGP cards on X.
// - Letting generated-image public URLs through exposes link-card replies instead of media attachments.
// - Stripping deployment URLs makes successful deploy replies look broken.
const PUBLIC_X_ALLOWED_LINK_HOSTS = new Set([
  'clanker.world',
  'www.clanker.world',
  'four.meme',
  'www.four.meme',
  'basescan.org',
  'www.basescan.org',
  'bscscan.com',
  'www.bscscan.com',
]);

function isAllowedPublicXReplyUrl(rawUrl: string): boolean {
  try {
    const normalized = /^(?:https?:\/\/|www\.)/i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    const parsed = new URL(normalized.startsWith('www.') ? `https://${normalized}` : normalized);
    return PUBLIC_X_ALLOWED_LINK_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function markdownLinkToPublicXText(label: string, url: string): string {
  const normalizedLabel = String(label || '').trim();
  const normalizedUrl = String(url || '').trim();
  if (!normalizedUrl) return normalizedLabel;
  if (!isAllowedPublicXReplyUrl(normalizedUrl)) return normalizedLabel;
  if (!normalizedLabel || /^open link$/i.test(normalizedLabel) || normalizedLabel === '打开链接') {
    return normalizedUrl;
  }
  return `${normalizedLabel}: ${normalizedUrl}`;
}

export function sanitizePublicXReplyText(input: string): string {
  const withoutMarkdownLinks = String(input || '').replace(
    /\[([^\]]+)\]\(((?:https?:\/\/|www\.)[^)\s]+[^)]*)\)/gi,
    (_match, label, url) => markdownLinkToPublicXText(label, url),
  );
  const withoutUrls = withoutMarkdownLinks
    .replace(/https?:\/\/\S+/gi, (url) => (isAllowedPublicXReplyUrl(url) ? url : ' '))
    .replace(/\bwww\.\S+/gi, (url) => (isAllowedPublicXReplyUrl(url) ? url : ' '))
    .replace(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?/gi, (url) => (isAllowedPublicXReplyUrl(url) ? url : ' '))
    .replace(/\b\S+\.(?:png|jpe?g|gif|webp)(?:\?\S*)?/gi, ' ');
  const withoutMarkdown = withoutUrls
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^>\s+/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1');
  const normalized = withoutMarkdown
    .split(/\n+/)
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n')
    .trim();
  const text = normalized || FALLBACK_PUBLIC_X_REPLY_TEXT;
  if (text.length <= MAX_PUBLIC_X_REPLY_CHARS) return text;
  return `${text.slice(0, MAX_PUBLIC_X_REPLY_CHARS - 3).trimEnd()}...`;
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
  return Array.from(deduped).slice(0, MAX_X_TWEET_IMAGE_COUNT);
}

async function downloadImageForXUpload(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const response = await fetch(url, {
    headers: {
      Accept: 'image/png,image/jpeg,image/webp;q=0.9,*/*;q=0.1',
      'User-Agent': 'KiKo-X-Media-Uploader/1.0',
    },
  });
  if (!response.ok) {
    throw new Error(`Generated image fetch failed before X upload (${response.status})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const input = Buffer.from(arrayBuffer);
  const metadata = await sharp(input).metadata();
  const format = String(metadata.format || '').toLowerCase();
  if (!['png', 'jpeg', 'jpg', 'webp'].includes(format)) {
    throw new Error(`Generated image has unsupported X upload format: ${format || 'unknown'}`);
  }
  const normalizedType = format === 'png'
    ? 'image/png'
    : (format === 'webp' ? 'image/webp' : 'image/jpeg');
  if (input.length <= MAX_X_TWEET_IMAGE_BYTES) {
    return { buffer: input, contentType: normalizedType };
  }

  const jpeg = await sharp(input)
    .rotate()
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
  if (jpeg.length <= MAX_X_TWEET_IMAGE_BYTES) {
    return { buffer: jpeg, contentType: 'image/jpeg' };
  }

  const compact = await sharp(input)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  if (compact.length > MAX_X_TWEET_IMAGE_BYTES) {
    throw new Error('Generated image remains larger than X tweet image limit after compression');
  }
  return { buffer: compact, contentType: 'image/jpeg' };
}

async function uploadXReplyMediaUrls(mediaUrls: string[]): Promise<string[]> {
  const mediaIds: string[] = [];
  const normalizedMediaUrls = normalizeXReplyMediaUrls(mediaUrls);
  if (normalizedMediaUrls.length === 0) return mediaIds;
  for (const mediaUrl of normalizedMediaUrls) {
    try {
      const image = await downloadImageForXUpload(mediaUrl);
      const mediaId = await xApiClient.uploadTweetImage({
        buffer: image.buffer,
        contentType: image.contentType,
        fileName: `kiko-generated-image.${image.contentType === 'image/png' ? 'png' : image.contentType === 'image/webp' ? 'webp' : 'jpg'}`,
      });
      mediaIds.push(mediaId);
    } catch (error) {
      logger.warn(LogCode.API_NOTIFY_FAILED, '[X] Failed to upload generated image for reply', {
        error: String((error as any)?.message || error || 'unknown_error'),
      });
    }
  }
  return mediaIds;
}

function shouldRequireUploadedMedia(params: { originalText: string; mediaUrls: string[] }): boolean {
  if (params.mediaUrls.length === 0) return false;
  const normalizedText = sanitizePublicXReplyText(params.originalText).trim().toLowerCase();
  return normalizedText === GENERATED_IMAGE_READY_REPLY_TEXT.toLowerCase();
}

export const __xReplyServiceTest = {
  shouldRequireUploadedMedia,
};

async function createOrReuseDelivery(params: {
  userId?: string | null;
  xUserId: string;
  conversationMappingId?: string | null;
  channel: DeliveryChannel;
  messageType: DeliveryType;
  sourceMessageId?: string | null;
  idempotencyKey: string;
  payload: unknown;
}) {
  const existing = await prisma.xMessageDelivery.findUnique({
    where: { idempotencyKey: params.idempotencyKey },
  });
  if (existing && existing.status === 'sent') {
    return { record: existing, alreadySent: true };
  }
  // Block concurrent processing: treat recent pending records as already-sent.
  // But if the record has been pending for more than 5 minutes, it is likely
  // orphaned from a process crash — allow retry by falling through.
  const STALE_PENDING_MS = 5 * 60 * 1000;
  if (existing && existing.status === 'pending') {
    const age = Date.now() - existing.updatedAt.getTime();
    if (age < STALE_PENDING_MS) {
      return { record: existing, alreadySent: true };
    }
    // Stale pending — fall through to the retry path below.
  }
  if (existing) {
    const record = await prisma.xMessageDelivery.update({
      where: { id: existing.id },
      data: {
        attemptCount: { increment: 1 },
        payload: params.payload as any,
        errorMessage: null,
        status: 'pending',
      },
    });
    return { record, alreadySent: false };
  }
  const record = await prisma.xMessageDelivery.create({
    data: {
      userId: params.userId || null,
      xUserId: params.xUserId,
      conversationMappingId: params.conversationMappingId || null,
      channel: params.channel,
      direction: 'outbound',
      messageType: params.messageType,
      sourceMessageId: params.sourceMessageId || null,
      idempotencyKey: params.idempotencyKey,
      payload: params.payload as any,
      attemptCount: 1,
      status: 'pending',
    },
  });
  return { record, alreadySent: false };
}

async function markDeliveryFailed(id: string, error: unknown) {
  await prisma.xMessageDelivery.update({
    where: { id },
    data: {
      status: 'failed',
      errorMessage: String((error as any)?.message || error || 'unknown_error').slice(0, 500),
    },
  }).catch(() => {});
}

export class XReplyService {
  isConfigured(): boolean {
    return xApiClient.isConfigured();
  }

  async replyToMention(params: {
    xUserId: string;
    text: string;
    tweetId: string;
    userId?: string | null;
    conversationMappingId?: string | null;
    idempotencyKey: string;
    mediaUrls?: string[] | null;
  }): Promise<boolean> {
    if (!this.isConfigured()) return false;
    const text = sanitizePublicXReplyText(params.text);
    const mediaUrls = normalizeXReplyMediaUrls(params.mediaUrls);
    const { record, alreadySent } = await createOrReuseDelivery({
      userId: params.userId,
      xUserId: params.xUserId,
      conversationMappingId: params.conversationMappingId,
      channel: 'mention',
      messageType: 'reply',
      sourceMessageId: params.tweetId,
      idempotencyKey: params.idempotencyKey,
      payload: { tweetId: params.tweetId, text, mediaUrls },
    });
    if (alreadySent) return true;

    try {
      const mediaIds = await uploadXReplyMediaUrls(mediaUrls);
      if (shouldRequireUploadedMedia({ originalText: params.text, mediaUrls }) && mediaIds.length === 0) {
        throw new Error('x_generated_image_media_upload_failed');
      }
      const sent = await xApiClient.replyToMention({
        tweetId: params.tweetId,
        text,
        mediaIds,
      });
      await prisma.xMessageDelivery.update({
        where: { id: record.id },
        data: {
          status: 'sent',
          providerMessageId: sent.id || null,
        },
      });
      if (params.conversationMappingId) {
        await markXConversationOutbound({
          mappingId: params.conversationMappingId,
          messageId: sent.id,
          incrementRoundTrip: false,
        }).catch(() => {});
      }
      return true;
    } catch (error) {
      logger.warn(LogCode.API_NOTIFY_FAILED, '[X] Failed to reply to mention', {
        xUserId: params.xUserId,
        error: String((error as any)?.message || error || 'unknown_error'),
      });
      await markDeliveryFailed(record.id, error);
      return false;
    }
  }

  async sendDirectMessage(params: {
    xUserId: string;
    text: string;
    userId?: string | null;
    conversationMappingId?: string | null;
    idempotencyKey: string;
    sourceMessageId?: string | null;
    messageType?: DeliveryType;
    incrementRoundTrip?: boolean;
  }): Promise<boolean> {
    if (!this.isConfigured()) return false;
    const { record, alreadySent } = await createOrReuseDelivery({
      userId: params.userId,
      xUserId: params.xUserId,
      conversationMappingId: params.conversationMappingId,
      channel: 'dm',
      messageType: params.messageType || 'dm',
      sourceMessageId: params.sourceMessageId || null,
      idempotencyKey: params.idempotencyKey,
      payload: { text: params.text },
    });
    if (alreadySent) return true;

    try {
      const sent = await xApiClient.sendDirectMessage({
        recipientId: params.xUserId,
        text: params.text,
      });
      await prisma.xMessageDelivery.update({
        where: { id: record.id },
        data: {
          status: 'sent',
          providerMessageId: sent.id || null,
        },
      });
      if (params.conversationMappingId) {
        await markXConversationOutbound({
          mappingId: params.conversationMappingId,
          messageId: sent.id,
          incrementRoundTrip: Boolean(params.incrementRoundTrip),
        }).catch(() => {});
      }
      return true;
    } catch (error) {
      logger.warn(LogCode.API_NOTIFY_FAILED, '[X] Failed to send DM', {
        xUserId: params.xUserId,
        error: String((error as any)?.message || error || 'unknown_error'),
      });
      await markDeliveryFailed(record.id, error);
      return false;
    }
  }
}

export const xReplyService = new XReplyService();
