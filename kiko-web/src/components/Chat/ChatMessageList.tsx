import React from 'react';
import clsx from 'clsx';
import styles from './Chat.module.css';
import { MessageBubble } from './MessageBubble';
import { ThinkingTimer } from './ThinkingTimer';
import type { Message } from '../../hooks/useConversations';
import { formatChatDateSeparator } from './chatConstants';

interface ChatMessageListProps {
    chatStarted: boolean;
    disableChatTransitions: boolean;
    scrollContainerRef: React.RefObject<HTMLDivElement | null>;
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    enrichedMessages: Message[];
    handleScroll: () => void;
    thinkingText: string;
    thinkingStartTime: number | null;
    isBusy: boolean;
    firstSendPending: boolean;
    hasAnyAssistantMessage: boolean;
    hasVisibleAssistantResponse: boolean;
    walletAddress: string;
    chainId: number;
    conversationId: string | null;
    selectedModelId?: string;
    onFeedback: (messageId: string, feedback: 'like' | 'dislike' | null) => void;
    onCardAction: (action: string, data: unknown, message: Message) => void;
}

export const ChatMessageList: React.FC<ChatMessageListProps> = ({
    chatStarted,
    disableChatTransitions,
    scrollContainerRef,
    messagesEndRef,
    enrichedMessages,
    handleScroll,
    thinkingText,
    thinkingStartTime,
    isBusy,
    firstSendPending,
    hasAnyAssistantMessage,
    hasVisibleAssistantResponse,
    walletAddress,
    chainId,
    conversationId,
    selectedModelId,
    onFeedback,
    onCardAction,
}) => {
    const lastTextAssistantId = [...enrichedMessages]
        .reverse()
        .find(message => message.role === 'assistant' && (!message.type || message.type === 'text'))?.id;

    return (
        <div
            className={clsx(
                styles.messageList,
                !chatStarted && styles.messageListHidden,
                !disableChatTransitions && chatStarted && styles.chatUiEnter,
            )}
            ref={scrollContainerRef}
            onScroll={handleScroll}
        >
            {enrichedMessages.map((message, index) => {
                const isGrouped = index > 0 && enrichedMessages[index - 1].role === message.role;
                const previousMessage = index > 0 ? enrichedMessages[index - 1] : null;
                const showDateSeparator =
                    previousMessage && previousMessage.date && message.date && previousMessage.date !== message.date;

                return (
                    <React.Fragment key={message.id}>
                        {showDateSeparator && (
                            <div className={styles.dateSeparator}>
                                <span>{formatChatDateSeparator(message.date!)}</span>
                            </div>
                        )}
                        <MessageBubble
                            message={message}
                            isGrouped={isGrouped}
                            thinkingText={
                                message.role === 'assistant' &&
                                message.id === lastTextAssistantId &&
                                (!message.type || message.type === 'text') &&
                                isBusy
                                    ? thinkingText
                                    : undefined
                            }
                            thinkingStartTime={thinkingStartTime ?? undefined}
                            userAddress={walletAddress}
                            chainId={chainId}
                            sessionId={conversationId || undefined}
                            modelId={selectedModelId}
                            onFeedback={onFeedback}
                            onCardAction={(action, data) => onCardAction(action, data, message)}
                        />
                    </React.Fragment>
                );
            })}

            {firstSendPending && !hasAnyAssistantMessage && !hasVisibleAssistantResponse && (
                <div className={styles.thinkingContainer}>
                    <div className={styles.thinkingContent}>
                        <div className={styles.thinkingSpinner} />
                        <ThinkingTimer
                            startTime={thinkingStartTime ?? Date.now()}
                            status="thinking"
                            text={thinkingText}
                        />
                    </div>
                </div>
            )}

            <div ref={messagesEndRef} />
        </div>
    );
};
