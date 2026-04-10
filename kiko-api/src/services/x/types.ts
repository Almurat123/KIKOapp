export type XChannel = 'mention' | 'dm';

export interface XIdentitySnapshot {
  xUserId: string | null;
  username: string | null;
  profileUrl: string | null;
  linkedAt: string | null;
  dmOptInAt: string | null;
  notificationsMuted: boolean;
  linkUrl: string;
}

export interface XMentionEvent {
  id: string;
  text: string;
  authorId: string;
  authorUsername?: string | null;
  conversationId?: string | null;
  createdAt?: string | null;
}

export interface XDirectMessageEvent {
  id: string;
  text?: string | null;
  senderId: string;
  senderUsername?: string | null;
  dmConversationId?: string | null;
  createdAt?: string | null;
  sourceEventType?: string | null;
  requiresLookup?: boolean;
  lookupCreatedAtMs?: string | null;
}

export interface XSendResult {
  id: string | null;
  raw: unknown;
}
