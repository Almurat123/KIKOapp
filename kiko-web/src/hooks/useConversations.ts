import { useState, useEffect, useCallback, useRef } from 'react';
import { chatApi } from '../services/api';
import { usePrivy } from '@privy-io/react-auth';
import { mergeTransactionCardData } from '../utils/transactionCardState';
import { chatWSClient } from '../utils/chatWebSocket';
import { findChatModelOption, hydrateChatModelOption } from '../components/Chat/chatConstants';

// CONTEXT MEMORY
// Updated: 2026-04-20
// Author: Rowan Hale
// Reason: Conversation hydration must not erase live-rendered assistant cards
//         while the database row is still catching up. The chat-image upload
//         path now persists private message attachment references, but hydration
//         can still race the backend update, so DB hydration must merge local
//         previews into matching user rows only when the DB row has not yet
//         received signed preview attachments. Generated-image assistant replies
//         now also persist private image asset references, so hydration must
//         preserve that structured message type instead of collapsing it into
//         empty text rows during eventual consistency. Session hydration now
//         also needs to preserve the saved reasoning level so split-effort
//         model families reopen with the same effort state rather than the
//         default fallback. A 2026-04-20 streaming regression showed an
//         in-flight `loadConversation()` could capture an old local snapshot,
//         then overwrite later WebSocket chunks with a shorter DB row.
// Goal: Preserve richer local chat rendering during websocket -> DB eventual
//       consistency, including copy-trade cards, transaction confirmations,
//       generated-image replies, current-turn user image previews, and the
//       saved session reasoning level while the durable signed attachment row
//       is catching up.
// Owns: Merging local conversation state with freshly loaded session messages from the backend.
// Does Not Own: Emitting websocket client actions, card component rendering, or backend message persistence order.
// Design Language:
// - Prefer the richer local assistant presentation when the database row is temporarily behind.
// - Prefer local user attachment previews only when the matching DB user row has no attachments yet.
// - Only merge by message ID inside this owner; transport/runtime event ordering belongs elsewhere.
// - Forbidden local patch pattern: replacing live non-text assistant cards with stale plain-text DB rows.
// - Forbidden local patch pattern: dropping image preview attachments during the send-time DB update race.
// - Forbidden local patch pattern: replacing a generated-image assistant row with an empty text placeholder during hydration.
// - Forbidden local patch pattern: letting a stale local generated-image
//   placeholder overwrite a newer DB-backed terminal image payload.
// - Forbidden local patch pattern: preserving a route-local conversation and
//   active task after the backend has already returned a hard session-not-found.
// - Forbidden local patch pattern: letting an older session hydration response
//   replace a same-id assistant message with shorter same-prefix content while
//   the live stream has already advanced.
// Document Provenance:
// - Source: Copy-trade live card regression logs (`/Users/almurat/Downloads/logs.1775995828927.json`) and runtime screenshot (`/Users/almurat/Downloads/IMG_4739.PNG`)
// - Kind: runtime observation
// - Retrieved: 2026-04-12
// - Applied To: Preserving `strategy-card` and other non-text assistant cards across `loadConversation` hydration.
// - Verification: verified in code
// - Source: `kiko-web/src/components/Chat/ChatInterface.tsx`
// - Kind: repo doc
// - Retrieved: 2026-04-12
// - Applied To: Confirming the live websocket path already mutates messages to `strategy-card` on `show_strategy_card`.
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/test.txt
// - Kind: runtime observation
// - Retrieved: 2026-04-16
// - Applied To: preserving local chat-image attachments across `loadConversation` hydration.
// - Verification: verified in runtime log and code
// - Source: operator correction that refreshed chat history must preserve image bubbles
// - Kind: product doc
// - Retrieved: 2026-04-16
// - Applied To: local attachment merge remains only a race fallback for durable backend attachments
// - Verification: verified in code
// - Source: operator request on 2026-04-18 to execute generated-image replies inside chat
// - Kind: product doc
// - Retrieved: 2026-04-18
// - Applied To: preserving `generated-image` assistant message type in hydrated conversation state
// - Verification: verified in code
// - Source: operator bug report on 2026-04-19 that model selection and thinking
//   strength reset after refresh
// - Kind: product doc
// - Retrieved: 2026-04-19
// - Applied To: preserving session reasoning level during conversation hydration
// - Verification: inferred from code
// - Source: operator report on 2026-04-19 that a Farcaster-triggered chat route
//   stayed loading after the backing session disappeared
// - Kind: runtime observation
// - Retrieved: 2026-04-19
// - Applied To: clearing orphan local conversation state when the backend
//   returns a hard session-not-found
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/test.txt
// - Kind: runtime observation
// - Retrieved: 2026-04-20
// - Applied To: preserving latest same-id assistant stream content across
//   concurrent `loadConversation()` hydration responses
// - Verification: verified in code
// - Source: operator screenshots on 2026-04-20 showing a generated-image
//   message still rendering a stale local placeholder after the backend had
//   already stored the final image asset
// - Kind: runtime observation
// - Retrieved: 2026-04-20
// - Applied To: preferring richer terminal generated-image payloads during
//   message hydration instead of blindly spreading local state over DB state
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-12-copytrade-card-live-hydration.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-12-first-send-no-loading-chat-entry.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-image-upload-r2-and-model-input.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-generated-image-chat-execution-and-ui.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-chat-model-reasoning-database-persistence.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-chat-orphan-session-loading-state.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-chat-stream-hydration-stale-overwrite.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-generated-image-public-proxy-and-task-hydration.md

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp?: string;
  clientCreatedAt?: string;
  date?: string;
  type?:
    | 'text'
    | 'swap-card'
    | 'token-card'
    | 'strategy-card'
    | 'chart-card'
    | 'transaction-status-card'
    | 'plan-card'
    | 'polymarket-embed'
    | 'generated-image';
  data?: any;
  citations?: Array<string | { url: string; avatar_url?: string }>;
  reasoning_content?: string;
  transactionStatus?: 'waiting' | 'success' | 'failed' | 'cancelled';
  transactionHash?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  tool_calls?: any[];
  tool_call_id?: string;
  status?: 'streaming' | 'complete' | 'error';
  message_index?: number;
  feedback?: 'like' | 'dislike' | null;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  model?: string;
  reasoningLevel?: string;
  activeTask?: {
    id: string;
    status: 'queued' | 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    [key: string]: any;
  } | null;
  pendingAIPrompt?: string;
}

function toMillis(value: unknown): number | null {
  if (!value) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = new Date(value as string).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

type ConversationActiveTaskStatus = 'queued' | 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

function normalizeActiveTaskStatus(status: unknown): ConversationActiveTaskStatus {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'queued') return 'queued';
  if (normalized === 'pending') return 'pending';
  if (normalized === 'running') return 'running';
  if (normalized === 'completed' || normalized === 'done') return 'completed';
  if (normalized === 'failed' || normalized === 'error') return 'failed';
  return 'cancelled';
}

function isHardSessionMissingError(error: unknown): boolean {
  const message = String((error as { message?: unknown })?.message || '')
    .trim()
    .toLowerCase();
  return message === 'session not found' || message.includes('http 404');
}

function getPlanActivityLength(data: any): number {
  const activity = data?.agentRuntime?.plan?.activity;
  return Array.isArray(activity) ? activity.length : 0;
}

function mergeAgentRuntimeData(dbData: any, localData: any) {
  const dbRuntime = dbData?.agentRuntime;
  const localRuntime = localData?.agentRuntime;
  if (!localRuntime) return dbData;
  if (!dbRuntime) {
    return {
      ...(dbData || {}),
      ...(localData || {}),
      agentRuntime: localRuntime,
    };
  }

  const dbPlanId = dbRuntime?.plan?.planId;
  const localPlanId = localRuntime?.plan?.planId;
  const samePlan = dbPlanId && localPlanId && dbPlanId === localPlanId;
  const localHasMoreActivity = getPlanActivityLength(localData) > getPlanActivityLength(dbData);

  if (samePlan && localHasMoreActivity) {
    return {
      ...(dbData || {}),
      ...(localData || {}),
      agentRuntime: localRuntime,
    };
  }

  return dbData;
}

function isRichAssistantMessageType(type: Message['type'] | undefined): boolean {
  return Boolean(type && type !== 'text');
}

function getGeneratedImageState(data: any): any | null {
  const state = data?.generatedImage;
  return state && typeof state === 'object' ? state : null;
}

function getGeneratedImageStateScore(state: any): number {
  if (!state || typeof state !== 'object') return 0;
  const status = String(state.status || '').trim().toLowerCase();
  const imageCount = Array.isArray(state.images) ? state.images.length : 0;
  if (status === 'complete' && imageCount > 0) return 4;
  if (status === 'complete' || status === 'failed') return 3;
  if (status === 'saving' || status === 'moderating') return 2;
  if (status === 'generating' || status === 'queued') return 1;
  return imageCount > 0 ? 1 : 0;
}

function mergeAssistantStructuredData(dbData: any, localData: any) {
  const baseMerged = {
    ...(dbData ?? {}),
    ...(localData ?? {}),
  };

  const dbGeneratedImage = getGeneratedImageState(dbData);
  const localGeneratedImage = getGeneratedImageState(localData);
  if (!dbGeneratedImage || !localGeneratedImage) {
    return baseMerged;
  }

  const dbScore = getGeneratedImageStateScore(dbGeneratedImage);
  const localScore = getGeneratedImageStateScore(localGeneratedImage);
  const preferDbGeneratedImage = dbScore >= localScore;

  return {
    ...baseMerged,
    generatedImage: preferDbGeneratedImage
      ? {
          ...localGeneratedImage,
          ...dbGeneratedImage,
        }
      : {
          ...dbGeneratedImage,
          ...localGeneratedImage,
        },
  };
}

function shouldPreferLongerLocalText(dbTextRaw: unknown, localTextRaw: unknown): boolean {
  const dbText = String(dbTextRaw || '');
  const localText = String(localTextRaw || '');
  if (!localText || localText.length <= dbText.length) return false;
  return !dbText || localText.startsWith(dbText);
}

function mergeAssistantMessageFromLocal(dbMessage: any, localMessage: any) {
  const dbType = dbMessage?.type || 'text';
  const localType = localMessage?.type || 'text';
  const localIsRich = isRichAssistantMessageType(localType);
  const dbIsPlainText = dbType === 'text';
  const preferLocalContent = shouldPreferLongerLocalText(dbMessage?.content, localMessage?.content);
  const preferLocalReasoning = shouldPreferLongerLocalText(dbMessage?.reasoning_content, localMessage?.reasoning_content);
  if (preferLocalContent || preferLocalReasoning) {
    console.log('[useConversations] Preserving newer local assistant stream over stale DB hydration:', {
      messageId: dbMessage?.id || localMessage?.id,
      dbContentLength: String(dbMessage?.content || '').length,
      localContentLength: String(localMessage?.content || '').length,
      dbReasoningLength: String(dbMessage?.reasoning_content || '').length,
      localReasoningLength: String(localMessage?.reasoning_content || '').length,
      dbStatus: dbMessage?.status,
      localStatus: localMessage?.status,
    });
  }
  const baseMessage = (preferLocalContent || preferLocalReasoning)
    ? {
        ...dbMessage,
        content: preferLocalContent ? localMessage.content : dbMessage.content,
        reasoning_content: preferLocalReasoning ? localMessage.reasoning_content : dbMessage.reasoning_content,
        status: localMessage.status || dbMessage.status,
        data: mergeAgentRuntimeData(dbMessage.data, localMessage.data),
      }
    : dbMessage;

  if (!localIsRich) {
    return baseMessage;
  }

  if (localType === 'transaction-status-card') {
    if (dbIsPlainText) {
      return {
        ...baseMessage,
        type: localType,
        data: mergeAgentRuntimeData(localMessage.data ?? baseMessage.data, localMessage.data),
      };
    }

    if (dbType === 'transaction-status-card') {
      return {
        ...baseMessage,
        type: localType,
        data: mergeAgentRuntimeData(
          mergeTransactionCardData(baseMessage.data ?? {}, localMessage.data ?? {}),
          localMessage.data,
        ),
      };
    }
  }

  if (dbIsPlainText || dbType === localType) {
    return {
      ...baseMessage,
      type: localType,
      data: mergeAgentRuntimeData(
        mergeAssistantStructuredData(baseMessage.data, localMessage.data),
        localMessage.data,
      ),
    };
  }

  return baseMessage;
}

function getLocalAttachmentPreviews(message: any): any[] {
  const attachments = message?.data?.attachments;
  return Array.isArray(attachments) ? attachments : [];
}

function mergeUserMessageFromLocal(dbMessage: any, localMessage: any) {
  if (dbMessage?.role !== 'user' || localMessage?.role !== 'user') {
    return dbMessage;
  }

  const localAttachments = getLocalAttachmentPreviews(localMessage);
  const dbAttachments = getLocalAttachmentPreviews(dbMessage);
  if (localAttachments.length === 0 || dbAttachments.length > 0) {
    return dbMessage;
  }

  return {
    ...dbMessage,
    data: {
      ...(localMessage.data ?? {}),
      ...(dbMessage.data ?? {}),
      attachments: localAttachments,
    },
  };
}

function findMatchingUserMessageIndex(dbMessages: any[], localMessage: Message): number {
  const localContent = (localMessage.content || '').trim();
  const localTime = toMillis(localMessage.clientCreatedAt || localMessage.timestamp);
  let fallbackIndex = -1;
  let bestIndex = -1;
  let bestDelta = Number.POSITIVE_INFINITY;

  for (let index = 0; index < dbMessages.length; index += 1) {
    const dbMessage = dbMessages[index];
    if (dbMessage?.role !== 'user') continue;
    if ((dbMessage.content || '').trim() !== localContent) continue;
    if (fallbackIndex < 0) fallbackIndex = index;

    const dbTime = toMillis(dbMessage.timestamp);
    if (localTime === null || dbTime === null) continue;

    const delta = Math.abs(dbTime - localTime);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestIndex = index;
    }
  }

  return bestIndex >= 0 ? bestIndex : fallbackIndex;
}

export const useConversations = () => {
  const { authenticated, ready, getAccessToken } = usePrivy();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // CRITICAL: Keep a ref in sync with conversations state for synchronous access.
  // This fixes the race condition where ChatInterface unmount saves messages,
  // but state update is async and remount reads stale data.
  const conversationsRef = useRef<Conversation[]>([]);
  const pendingLocalUserMessagesRef = useRef<Map<string, Array<{ id: string; content: string; createdAt: number }>>>(new Map());
  const inFlightConversationLoadsRef = useRef<Map<string, Promise<any>>>(new Map());
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  // Load user sessions from backend
  useEffect(() => {
    if (ready && authenticated) {
      const loadSessions = async () => {
        setIsLoading(true);
        try {
          // Wait for token to be available
          const token = await getAccessToken();
          if (!token) {
            console.warn('[useConversations] No auth token available, skipping session load');
            return;
          }
          const sessions = await chatApi.getSessions();
          const newConversations = sessions.map((s: any) => ({
            id: s.id,
            title: s.title,
            messages: [],
            createdAt: new Date(s.createdAt || s.created_at).getTime(),
            updatedAt: new Date(s.updatedAt || s.updated_at).getTime(),
            model: s.model,
            reasoningLevel: s.reasoningLevel || s.reasoning_level,
          }));
          setConversations(newConversations);
          conversationsRef.current = newConversations; // Sync ref immediately
        } catch (error) {
          console.error('[useConversations] Failed to load sessions:', error);
        } finally {
          setIsLoading(false);
        }
      };
      loadSessions();
    }
  }, [ready, authenticated, getAccessToken]);

  const createConversation = useCallback(async (title?: string, model?: string, reasoningLevel?: string) => {
    if (!authenticated) {
      console.warn('[useConversations] Cannot create conversation: not authenticated');
      return null;
    }
    try {
      const resp = await chatApi.createSession(title, model, reasoningLevel);
      if (resp && resp.success) {
        const s = resp.session;
        const newConv: Conversation = {
          id: s.id,
          title: s.title,
          messages: [],
          createdAt: new Date((s as any).createdAt || (s as any).created_at).getTime(),
          updatedAt: new Date((s as any).updatedAt || (s as any).updated_at).getTime(),
          model: s.model,
          reasoningLevel: s.reasoningLevel || (s as any).reasoning_level,
        };
        // Sync ref synchronously before returning so immediate follow-up updates
        // (e.g. updateConversation(newId, { messages: [...] })) don't race and get dropped.
        const updated = [newConv, ...conversationsRef.current.filter(c => c.id !== newConv.id)];
        conversationsRef.current = updated;
        setConversations(updated);
        setActiveConversationId(newConv.id);
        return newConv.id;
      }
    } catch (error) {
      console.error('[useConversations] Failed to create session:', error);
    }
    return null;
  }, [authenticated]);

  const registerPendingLocalUserMessage = useCallback((conversationId: string, message: Pick<Message, 'id' | 'content' | 'clientCreatedAt' | 'timestamp'>) => {
    const createdAt = Date.parse(message.clientCreatedAt || message.timestamp || '') || Date.now();
    const current = pendingLocalUserMessagesRef.current.get(conversationId) || [];
    const next = [...current.filter(m => m.id !== message.id), { id: message.id, content: message.content, createdAt }];
    pendingLocalUserMessagesRef.current.set(conversationId, next.slice(-10));
  }, []);

  const updateConversation = useCallback((id: string, updates: Message[] | Partial<Conversation>) => {
    // Handle both legacy (Message[]) and new (Partial<Conversation>) signatures
    const partialUpdates = Array.isArray(updates) ? { messages: updates } : updates;

    // CRITICAL: Synchronously update ref FIRST for immediate access
    conversationsRef.current = conversationsRef.current.map(conv =>
      conv.id === id ? { ...conv, ...partialUpdates, updatedAt: Date.now() } : conv
    );
    // Then update React state (async)
    setConversations(prev =>
      prev.map(conv =>
        conv.id === id ? { ...conv, ...partialUpdates, updatedAt: Date.now() } : conv
      )
    );
  }, []);

  const updateConversationTitle = useCallback(async (id: string, title: string) => {
    setConversations(prev =>
      prev.map(conv =>
        conv.id === id ? { ...conv, title, updatedAt: Date.now() } : conv
      )
    );
    try {
      await chatApi.updateSession(id, { title });
    } catch (error) {
      console.error('[useConversations] Failed to update title on backend:', error);
    }
  }, []);

  const loadConversation = useCallback(async (id: string | null) => {
    if (!id) {
      setActiveConversationId(null);
      return null;
    }

    chatWSClient.trackSession(id);
    setActiveConversationId(id);

    const inFlight = inFlightConversationLoadsRef.current.get(id);
    if (inFlight) {
      return inFlight;
    }

    const loadPromise = (async () => {

    // Fallback snapshot only. The merge below re-reads the latest local state
    // after the network response so an old hydration request cannot erase
    // WebSocket chunks that arrived while the request was in flight.
    const requestStartConv = conversationsRef.current.find(c => c.id === id);
    const requestStartLocalMessages = requestStartConv?.messages || [];

    // Fetch full session with messages
    try {
      let resp;
      try {
        resp = await chatApi.getSession(id);
      } catch (firstError) {
        // Retry once for transient auth/network races on route refresh.
        await new Promise(resolve => setTimeout(resolve, 250));
        resp = await chatApi.getSession(id);
      }
      console.log('[useConversations] loadConversation response:', {
        success: resp.success,
        messageCount: resp.messages?.length,
        messages: resp.messages?.map((m: any) => ({
          id: m.id,
          role: m.role,
          type: m.type,
          hasData: !!m.data,
          content: m.content?.substring(0, 50)
        })),
      });
      if (resp.success) {
        const mergeTimeConv = conversationsRef.current.find(c => c.id === id);
        const localMessages = mergeTimeConv?.messages || requestStartLocalMessages;

        // Map backend messages to frontend format
        const dbMessages = resp.messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          reasoning_content: m.reasoning_content,
          citations: m.citations,
          usage: m.usage,
          tool_calls: m.tool_calls,
          tool_call_id: m.tool_call_id,
          status: m.status,
          message_index: m.message_index,
          timestamp: m.created_at,
          type: m.type || 'text',
          data: m.data,
          transactionStatus: m.transactionStatus,
          transactionHash: m.transactionHash,
          feedback: m.feedback,
        }));

        // Preserve richer local card rendering when DB row is temporarily stale.
        const localById = new Map(localMessages.map(msg => [msg.id, msg]));
        for (let i = 0; i < dbMessages.length; i += 1) {
          const dbMsg = dbMessages[i] as any;
          const localMsg = localById.get(dbMsg.id) as any;
          if (!localMsg) continue;
          const mergedLocalPresentation = dbMsg.role === 'user'
            ? mergeUserMessageFromLocal(dbMsg, localMsg)
            : mergeAssistantMessageFromLocal(dbMsg, localMsg);
          if (mergedLocalPresentation !== dbMsg) {
            dbMessages[i] = mergedLocalPresentation;
            continue;
          }

          const mergedRuntimeData = mergeAgentRuntimeData(dbMsg.data, localMsg.data);
          if (mergedRuntimeData !== dbMsg.data) {
            dbMessages[i] = {
              ...dbMsg,
              data: mergedRuntimeData,
            };
          }
        }

        // MERGE: Start with db messages, then add any local messages not in db
        // This preserves user messages and AI placeholders that haven't been saved yet
        // IMPORTANT: Check by content+role too, not just ID, because local temp IDs differ from DB IDs
        const mergedMessages = [...dbMessages];
        const pendingLocalUsers = pendingLocalUserMessagesRef.current.get(id) || [];

        // Check if DB has any assistant message (to know if processing is complete)
        const hasAssistantInDb = dbMessages.some((m: any) => m.role === 'assistant');

        for (const localMsg of localMessages) {
          // Check if exists by ID
          const existsById = dbMessages.find((m: any) => m.id === localMsg.id);
          if (existsById) continue; // Already in DB

          // Check if same content exists (for user messages with different IDs)
          // This prevents duplicates when local temp ID differs from DB ID
          const existsByContentIndex = localMsg.role === 'user'
            ? findMatchingUserMessageIndex(dbMessages, localMsg)
            : -1;
          if (existsByContentIndex >= 0) {
            const existingByContent = dbMessages[existsByContentIndex];
            const mergedLocalPresentation = mergeUserMessageFromLocal(existingByContent, localMsg);
            if (mergedLocalPresentation !== existingByContent) {
              dbMessages[existsByContentIndex] = mergedLocalPresentation;
              mergedMessages[existsByContentIndex] = mergedLocalPresentation;
            }
            console.log('[useConversations] Skipping duplicate user message (content match):', localMsg.id);
            continue;
          }

          // For assistant messages: 
          // - If DB has an assistant message with content, skip empty local placeholder
          // - If DB has NO assistant message, preserve local placeholder for streaming
          if (localMsg.role === 'assistant') {
            const hasContent = localMsg.content && localMsg.content.length > 0;
            const hasLocalRuntime = !!localMsg.data?.agentRuntime?.plan;
            // If DB has the real message (any assistant message), and local is empty/placeholder, skip it
            if (!hasContent && !hasLocalRuntime && hasAssistantInDb) {
              console.log('[useConversations] Skipping empty assistant placeholder (DB has msg):', localMsg.id);
              continue;
            }

            // If DB matches content (partial or full), skip local
            const existsByContent = dbMessages.find(
              (m: any) => m.role === 'assistant' && (m.content || '').includes(localMsg.content || '')
            );
            if (existsByContent) {
              console.log('[useConversations] Skipping duplicate assistant message (content subset):', localMsg.id);
              continue;
            }
          }

          // Local message not in DB yet - preserve it, but with strict checks

          // 1. Timestamp check: If local message is older than the last DB message, it's likely stale/orphaned
          const lastDbMsg = dbMessages[dbMessages.length - 1];
          if (lastDbMsg && lastDbMsg.timestamp) {
            const localTime = new Date(localMsg.clientCreatedAt || localMsg.timestamp || 0).getTime();
            const dbTime = new Date(lastDbMsg.timestamp).getTime();
            // Allow 5s buffer for clock skew, but if local is >5s older than latest DB msg, drop it
            const isPendingLocalUser = localMsg.role === 'user' && pendingLocalUsers.some(
              p => p.id === localMsg.id || (p.content || '').trim() === (localMsg.content || '').trim()
            );
            if (!isPendingLocalUser && localTime < dbTime - 5000) {
              console.log('[useConversations] Dropping stale local message:', localMsg.id, localMsg.role);
              continue;
            }
          }

          console.log('[useConversations] Preserving local message not in DB:', localMsg.id, localMsg.role);
          mergedMessages.push(localMsg as typeof dbMessages[number]);
        }

        const activeTask = resp.activeTask
          ? {
            ...resp.activeTask,
            status: normalizeActiveTaskStatus((resp.activeTask as any).status),
          }
          : null;

        const existing = conversationsRef.current.find(c => c.id === id);
        const session: any = resp.session || {};
        const sessionModel = findChatModelOption(session.model || existing?.model);
        const hydratedSessionModel =
          sessionModel?.kind === 'text'
            ? hydrateChatModelOption({
                id: session.model || existing?.model,
                reasoningLevel: session.reasoningLevel || session.reasoning_level || existing?.reasoningLevel,
              }) || sessionModel
            : sessionModel;
        const nextConversation: Conversation = {
          id,
          title: session.title || existing?.title || 'New Chat',
          messages: mergedMessages,
          createdAt: existing?.createdAt ?? toMillis(session.createdAt || session.created_at) ?? Date.now(),
          updatedAt: toMillis(session.updatedAt || session.updated_at) ?? Date.now(),
          model: hydratedSessionModel?.id || session.model || existing?.model,
          reasoningLevel: hydratedSessionModel?.reasoningLevel || session.reasoningLevel || session.reasoning_level || existing?.reasoningLevel,
          activeTask,
          pendingAIPrompt: existing?.pendingAIPrompt,
        };

        if (existing) {
          updateConversation(id, {
            title: nextConversation.title,
            messages: nextConversation.messages,
            model: nextConversation.model,
            reasoningLevel: nextConversation.reasoningLevel,
            activeTask: nextConversation.activeTask,
            pendingAIPrompt: nextConversation.pendingAIPrompt,
          });
        } else {
          const nextConversations = [
            nextConversation,
            ...conversationsRef.current.filter(c => c.id !== id),
          ];
          conversationsRef.current = nextConversations;
          setConversations(nextConversations);
        }

        if (pendingLocalUsers.length > 0) {
          const dbUserContents = new Set(
            dbMessages
              .filter((m: any) => m.role === 'user')
              .map((m: any) => (m.content || '').trim())
          );
          const remaining = pendingLocalUsers.filter(p => !dbUserContents.has((p.content || '').trim()));
          if (remaining.length > 0) {
            pendingLocalUserMessagesRef.current.set(id, remaining);
          } else {
            pendingLocalUserMessagesRef.current.delete(id);
          }
        }

        chatWSClient.requestSync(id);

        // Return activeTask if exists for UI state restoration
        return resp.activeTask || null;
      }
    } catch (error) {
      if (isHardSessionMissingError(error)) {
        pendingLocalUserMessagesRef.current.delete(id);
        const nextConversations = conversationsRef.current.filter((conversation) => conversation.id !== id);
        conversationsRef.current = nextConversations;
        setConversations(nextConversations);
        setActiveConversationId((current) => (current === id ? null : current));
        console.warn('[useConversations] Removed orphan local conversation after session 404:', id);
        return null;
      }
      console.error('[useConversations] Failed to load session messages:', error);
    }
    return null;
    })();

    inFlightConversationLoadsRef.current.set(id, loadPromise);
    try {
      return await loadPromise;
    } finally {
      inFlightConversationLoadsRef.current.delete(id);
    }
  }, [updateConversation]);

  const getActiveConversation = useCallback(() => {
    // Use ref for synchronous access to the latest data
    // This ensures we get the most up-to-date conversations even during React's async state updates
    return conversationsRef.current.find(c => c.id === activeConversationId);
  }, [activeConversationId]);

  const deleteConversation = useCallback(async (id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConversationId === id) {
      setActiveConversationId(null);
    }
    try {
      await chatApi.deleteSession(id);
    } catch (error) {
      console.error('[useConversations] Failed to delete session on backend:', error);
    }
  }, [activeConversationId]);

  const clearAllConversations = useCallback(() => {
    // We don't want to delete ALL backend sessions at once usually, 
    // but we can clear the local state
    setConversations([]);
    setActiveConversationId(null);
  }, []);

  return {
    conversations,
    activeConversationId,
    isLoading,
    createConversation,
    updateConversation,
    updateConversationTitle,
    loadConversation,
    getActiveConversation,
    deleteConversation,
    clearAllConversations,
    conversationsRef,
    registerPendingLocalUserMessage,
  };
};
