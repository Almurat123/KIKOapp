// CONTEXT MEMORY
// Updated: 2026-04-10
// Author: Linh Tran
// Reason: low-cost Farcaster agent ingress now relies on Neynar polling instead
//         of webhooks, and outbound replies must publish through the same app-
//         paired signer. The API layer needs one canonical place for parsing
//         notification payloads and posting cast replies.
// Goal: keep Neynar API URL construction, auth headers, notification parsing,
//       and cast publication centralized for Farcaster mention automation.
// Owns: authenticated Neynar REST access for notifications, cast lookup, and
//       outbound cast replies.
// Does Not Own: quota policy, chat orchestration, or DB persistence.
// Design Language:
// - Keep Neynar auth and URL construction centralized here.
// - Parse notifications into stable internal events before the worker sees them.
// - Use the signer paired with the same API key for writes.
// Document Provenance:
// - Source: Neynar Notifications API docs
// - Kind: official API doc
// - Retrieved: 2026-04-10
// - Applied To: polling `mentions,replies` notifications by bot FID with cursor pagination
// - Verification: inferred
// - Source: Neynar Post a cast API docs
// - Kind: official API doc
// - Retrieved: 2026-04-10
// - Applied To: publishing reply casts with `parent`, `parent_author_fid`, and `idem`
// - Verification: inferred
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-farcaster-polling-agent-ingress.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
import { env } from '../../config/env.js';
import { fetchJson } from '../../config/unifiedApiService.js';
import type { FarcasterCastContext, FarcasterMentionEvent, FarcasterSendResult } from './types.js';

interface NeynarNotificationPage {
  notifications?: any[];
  next?: {
    cursor?: string | null;
  };
}

function baseUrl(path: string): string {
  const base = String(env.farcasterAgent.apiBaseUrl || 'https://api.neynar.com/v2').replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

function authHeaders() {
  const apiKey = env.apiKeys.neynar || process.env.NEYNAR_API_KEY || '';
  if (!apiKey) {
    throw new Error('NEYNAR_API_KEY is not configured');
  }
  return {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
  };
}

function toIsoTimestamp(value: unknown): string | null {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeNotificationType(value: unknown): 'mentions' | 'replies' | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'mentions' || normalized === 'replies') {
    return normalized;
  }
  return null;
}

function extractEntries(notification: any): any[] {
  const type = normalizeNotificationType(notification?.type);
  if (!type) return [];
  const direct = notification?.[type];
  if (Array.isArray(direct) && direct.length > 0) {
    return direct;
  }
  if (notification?.cast) {
    return [notification];
  }
  return [];
}

function extractCast(entry: any, notification: any): any | null {
  return entry?.cast || entry?.reply?.cast || entry?.reply || notification?.cast || null;
}

function extractAuthor(entry: any, cast: any): { fid: number | null; username: string | null } {
  const user = entry?.user || cast?.author || null;
  return {
    fid: toInt(user?.fid),
    username: String(user?.username || cast?.author?.username || '').trim() || null,
  };
}

export function parseNotificationEvents(payload: NeynarNotificationPage): FarcasterMentionEvent[] {
  const events: FarcasterMentionEvent[] = [];

  for (const notification of payload.notifications || []) {
    const notificationType = normalizeNotificationType(notification?.type);
    if (!notificationType) continue;
    const entries = extractEntries(notification);

    for (const entry of entries) {
      const cast = extractCast(entry, notification);
      const castHash = String(cast?.hash || '').trim();
      const text = String(cast?.text || '').trim();
      const author = extractAuthor(entry, cast);

      if (!castHash || !text || !author.fid) {
        continue;
      }

      const occurredAt =
        toIsoTimestamp(cast?.timestamp)
        || toIsoTimestamp(entry?.timestamp)
        || toIsoTimestamp(notification?.most_recent_timestamp);

      events.push({
        eventId: `farcaster:${notificationType}:${castHash}`,
        notificationType,
        castHash,
        text,
        authorFid: author.fid,
        authorUsername: author.username,
        parentHash: String(cast?.parent_hash || '').trim() || null,
        parentAuthorFid: toInt(cast?.parent_author?.fid || cast?.parent_author_fid),
        rootCastHash: String(cast?.thread_hash || cast?.root_parent_hash || cast?.parent_hash || castHash).trim() || castHash,
        occurredAt,
      });
    }
  }

  return events;
}

export class FarcasterApiClient {
  isConfigured(): boolean {
    return Boolean(
      env.farcasterAgent.enabled
      && (env.apiKeys.neynar || process.env.NEYNAR_API_KEY)
      && env.farcasterAgent.signerUuid
      && Number(env.farcasterAgent.botFid) > 0,
    );
  }

  async fetchNotificationPage(params?: { cursor?: string | null }): Promise<NeynarNotificationPage> {
    const url = new URL(baseUrl('/farcaster/notifications/'));
    url.searchParams.set('fid', String(env.farcasterAgent.botFid));
    url.searchParams.set('type', 'mentions,replies');
    url.searchParams.set('limit', String(Math.min(Math.max(env.farcasterAgent.pollPageSize || 15, 1), 25)));
    if (params?.cursor) {
      url.searchParams.set('cursor', params.cursor);
    }

    return fetchJson<NeynarNotificationPage>({
      url: url.toString(),
      method: 'GET',
      headers: authHeaders(),
      requestTimeout: 10000,
      endpointName: 'api.neynar.com',
    });
  }

  async fetchCastByHash(hash: string): Promise<FarcasterCastContext | null> {
    const normalizedHash = String(hash || '').trim();
    if (!normalizedHash) return null;
    const url = new URL(baseUrl('/farcaster/cast'));
    url.searchParams.set('identifier', normalizedHash);
    url.searchParams.set('type', 'hash');

    const payload = await fetchJson<any>({
      url: url.toString(),
      method: 'GET',
      headers: authHeaders(),
      requestTimeout: 10000,
      endpointName: 'api.neynar.com',
      suppressError: true,
    }).catch(() => null);

    const cast = payload?.cast;
    if (!cast?.hash || !cast?.text) return null;

    return {
      hash: String(cast.hash),
      text: String(cast.text || '').trim(),
      authorFid: toInt(cast?.author?.fid),
      authorUsername: String(cast?.author?.username || '').trim() || null,
      parentHash: String(cast?.parent_hash || '').trim() || null,
      parentAuthorFid: toInt(cast?.parent_author?.fid || cast?.parent_author_fid),
      timestamp: toIsoTimestamp(cast?.timestamp),
    };
  }

  async publishCastReply(params: {
    text: string;
    parentHash: string;
    parentAuthorFid: number;
    idem: string;
  }): Promise<FarcasterSendResult> {
    const payload = await fetchJson<any>({
      url: baseUrl('/farcaster/cast/'),
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        signer_uuid: env.farcasterAgent.signerUuid,
        text: params.text,
        parent: params.parentHash,
        parent_author_fid: params.parentAuthorFid,
        idem: params.idem,
      }),
      requestTimeout: 15000,
      endpointName: 'api.neynar.com',
    });

    return {
      hash: payload?.cast?.hash ? String(payload.cast.hash) : null,
      raw: payload,
    };
  }
}

export const farcasterApiClient = new FarcasterApiClient();
