export type FarcasterChannel = 'mention';

export interface FarcasterMentionEvent {
  eventId: string;
  notificationType: 'mentions' | 'replies';
  castHash: string;
  text: string;
  authorFid: number;
  authorUsername?: string | null;
  parentHash?: string | null;
  parentAuthorFid?: number | null;
  rootCastHash?: string | null;
  occurredAt?: string | null;
}

export interface FarcasterCastContext {
  hash: string;
  text: string;
  authorFid: number | null;
  authorUsername?: string | null;
  parentHash?: string | null;
  parentAuthorFid?: number | null;
  timestamp?: string | null;
}

export interface FarcasterSendResult {
  hash: string | null;
  raw: unknown;
}
