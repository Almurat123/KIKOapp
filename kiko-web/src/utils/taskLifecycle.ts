import type { Conversation } from '../hooks/useConversations';

/**
 * Clear activeTask for a conversation.
 * All "task ended" semantics (WS events, user stop, card display) should go through this
 * for consistent logging and future onTaskEnd hooks.
 */
export function clearActiveTask(
    conversationId: string,
    updateConversation: (id: string, updates: Partial<Conversation>) => void,
    reason: string
) {
    console.log(`[TaskLifecycle] clearActiveTask: ${conversationId} reason=${reason}`);
    updateConversation(conversationId, { activeTask: null });
}
