import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, StopCircle, ArrowDown, Square, ChevronDown, Sparkles } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { TokenCard } from './TokenCard';
import styles from './Chat.module.css';
import clsx from 'clsx';
import type { Message } from '../../hooks/useConversations';

interface ChatInterfaceProps {
    conversationId?: string | null;
    initialMessages?: Message[];
    onMessagesChange?: (messages: Message[]) => void;
    onNewConversation?: (title: string) => string; // Returns new conversation ID
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
    conversationId,
    initialMessages = [],
    onMessagesChange,
    onNewConversation,
}) => {
    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);
    const [thinkingText, setThinkingText] = useState('Thinking');
    const [showJumpToBottom, setShowJumpToBottom] = useState(false);
    const [showStrategies, setShowStrategies] = useState(false);
    const [isComposing, setIsComposing] = useState(false);
    const [stoppedMessageId, setStoppedMessageId] = useState<string | null>(null);
    const [stoppedMessageContent, setStoppedMessageContent] = useState<string>('');
    const currentConversationIdRef = useRef<string | null>(conversationId || null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const isAtBottomRef = useRef(true);
    const abortControllerRef = useRef<AbortController | null>(null);
    const streamIntervalRef = useRef<number | null>(null);

    const scrollToBottom = useCallback((smooth = true) => {
        if (scrollContainerRef.current) {
            const { scrollHeight, clientHeight } = scrollContainerRef.current;
            scrollContainerRef.current.scrollTo({
                top: scrollHeight - clientHeight,
                behavior: smooth ? 'smooth' : 'auto',
            });
        }
    }, []);

    // Sync messages when conversationId or initialMessages change
    useEffect(() => {
        // Only sync if conversationId actually changed, not on every render
        if (currentConversationIdRef.current !== conversationId) {
            const prevId = currentConversationIdRef.current;
            const newId = conversationId;
            
            // Case 1: Creating new conversation (null -> new ID) - don't reset if we have messages
            if (!prevId && newId && messages.length > 0) {
                // We're creating a new conversation and already have messages (user just sent)
                // Don't reset, just update the ref
                currentConversationIdRef.current = newId;
                setHasStarted(true);
                return;
            }
            
            // Case 2: Switching to existing conversation - load its messages
            if (newId && messages.length === 0) {
                setMessages(initialMessages);
                setHasStarted(initialMessages.length > 0);
            }
            // Case 3: Switching away from conversation - clear messages
            else if (!newId && prevId) {
                setMessages([]);
                setHasStarted(false);
            }
            // Case 4: Switching between different conversations - load new messages
            else if (newId && prevId && newId !== prevId) {
                setMessages(initialMessages);
                setHasStarted(initialMessages.length > 0);
            }
            
            currentConversationIdRef.current = newId || null;
        }
    }, [conversationId, initialMessages, messages.length]);

    // Auto-save messages whenever they change (debounced)
    useEffect(() => {
        if (onMessagesChange && messages.length > 0 && currentConversationIdRef.current) {
            const timeoutId = setTimeout(() => {
                onMessagesChange(messages);
            }, 500);
            return () => clearTimeout(timeoutId);
        }
    }, [messages, onMessagesChange]);

    // Smart scroll on new messages (only when not streaming to avoid animation)
    useEffect(() => {
        if (isAtBottomRef.current && !isStreaming) {
            scrollToBottom(false); // Instant scroll, no animation
        }
    }, [messages, isThinking, scrollToBottom, isStreaming]);

    const handleScroll = () => {
        if (scrollContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
            const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
            isAtBottomRef.current = isAtBottom;
            setShowJumpToBottom(!isAtBottom);
        }
    };

    const handleInputFocus = () => {
        scrollToBottom();
    };

    const stopGeneration = () => {
        if (streamIntervalRef.current) {
            window.clearInterval(streamIntervalRef.current);
            streamIntervalRef.current = null;
        }
        const wasStreaming = isStreaming;
        setIsStreaming(false);
        setIsThinking(false);
        
        // Store the message ID and full content for continue generation
        if (wasStreaming && messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            if (lastMessage.role === 'ai') {
                setStoppedMessageId(lastMessage.id);
                // Keep the stoppedMessageContent that was set when streaming started
            }
        }
        
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
    };

    const continueGeneration = (messageId: string, fullText: string, currentContent: string) => {
        const remainingText = fullText.slice(currentContent.length);
        if (remainingText.length > 0) {
            setStoppedMessageId(null);
            setStoppedMessageContent('');
            simulateStreaming(remainingText, messageId, currentContent);
        }
    };

    const simulateStreaming = (fullText: string, messageId: string, existingContent: string = '') => {
        let currentIndex = existingContent.length;
        const totalText = existingContent + fullText;
        setIsStreaming(true);
        setStoppedMessageId(null);

        streamIntervalRef.current = window.setInterval(() => {
            setMessages(prevMessages => {
                if (currentIndex >= totalText.length) {
                    stopGeneration();
                    // Clear stopped state when complete
                    setStoppedMessageId(null);
                    setStoppedMessageContent('');
                    // Final save after streaming completes
                    const finalMessages = prevMessages.map(msg =>
                        msg.id === messageId ? { ...msg, content: totalText } : msg
                    );
                    if (onMessagesChange && currentConversationIdRef.current) {
                        // Use setTimeout to ensure state is updated
                        setTimeout(() => {
                            onMessagesChange(finalMessages);
                        }, 0);
                    }
                    return finalMessages;
                }

                const nextChunk = totalText.slice(0, currentIndex + 1);
                const updatedMessages = prevMessages.map(msg =>
                    msg.id === messageId ? { ...msg, content: nextChunk } : msg
                );
                
                currentIndex++;

                // Force instant scroll if we are at the bottom (no animation during streaming)
                if (isAtBottomRef.current && scrollContainerRef.current) {
                    const { scrollHeight, clientHeight } = scrollContainerRef.current;
                    scrollContainerRef.current.scrollTop = scrollHeight - clientHeight;
                }

                return updatedMessages;
            });
        }, 15); // 15ms per character (~66 FPS - faster like ChatGPT)
    };

    const handleSend = async (text: string = input) => {
        if (!text.trim()) return;

        // Create new conversation if this is the first message and no conversation exists
        let currentConvId = currentConversationIdRef.current;
        if (!currentConvId && onNewConversation) {
            // Only create conversation when actually sending a message
            currentConvId = onNewConversation(text);
            currentConversationIdRef.current = currentConvId;
        }

        setHasStarted(true);

        // Stop any current generation
        stopGeneration();

        const now = new Date();
        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: text,
            timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            date: now.toISOString().split('T')[0], // YYYY-MM-DD format
        };

        const updatedMessages = [...messages, userMsg];
        setMessages(updatedMessages);
        setInput('');
        setIsThinking(true);
        setThinkingText('Thinking');
        isAtBottomRef.current = true;
        
        // Save user message immediately if conversation exists
        if (currentConvId && onMessagesChange) {
            onMessagesChange(updatedMessages);
        }
        
        // Scroll after state update
        setTimeout(() => scrollToBottom(false), 0); // Instant scroll, no animation

        // Thinking Timeout Logic
        const thinkingTimeout = setTimeout(() => {
            setThinkingText('Waiting for Data Source...');
        }, 3000);

        // Use AI service to generate response
        try {
            const { streamAIResponse } = await import('../../services/aiService');
            
            // Build conversation history for context
            const conversationHistory = updatedMessages.map(msg => ({
                role: msg.role,
                content: msg.content,
            }));

            // Don't create AI message yet - we'll create it when we receive first content
            // This prevents showing an empty message bubble with a separate thinking indicator

            // Stream AI response
            let fullResponse = '';
            let detectedIntent: any = null;
            let hasReceivedContent = false;
            let aiMsgId: string | null = null;
            
            for await (const chunk of streamAIResponse(text, conversationHistory, currentConvId || undefined)) {
                if (chunk.content) {
                    // Create AI message when we receive first content
                    if (!hasReceivedContent) {
                        clearTimeout(thinkingTimeout);
                        setIsThinking(false);
                        hasReceivedContent = true;
                        
                        // Create the AI message now with first chunk
                        aiMsgId = (Date.now() + 1).toString();
                        const aiNow = new Date();
                        const aiMsg: Message = {
                            id: aiMsgId,
                            role: 'ai',
                            content: chunk.content,
                            timestamp: aiNow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            date: aiNow.toISOString().split('T')[0],
                            type: 'text',
                        };
                        
                        fullResponse = chunk.content;
                        setMessages(prev => [...prev, aiMsg]);
                        
                        // Save immediately
                        if (currentConvId && onMessagesChange) {
                            onMessagesChange([...updatedMessages, aiMsg]);
                        }
                    } else {
                        // Continue appending to existing message
                        fullResponse += chunk.content;
                        setMessages(prev => prev.map(msg => 
                            msg.id === aiMsgId ? { ...msg, content: fullResponse } : msg
                        ));
                    }
                    
                    // Force instant scroll during streaming
                    if (isAtBottomRef.current && scrollContainerRef.current) {
                        const { scrollHeight, clientHeight } = scrollContainerRef.current;
                        scrollContainerRef.current.scrollTop = scrollHeight - clientHeight;
                    }
                }
                if (chunk.intent) {
                    detectedIntent = chunk.intent;
                }
            }
            
            // If no content was received, clear thinking state anyway
            if (!hasReceivedContent) {
                clearTimeout(thinkingTimeout);
                setIsThinking(false);
            }

            // Check if we should show a token card based on intent
            if (aiMsgId && detectedIntent?.action === 'token_info' && detectedIntent?.token_symbol) {
                // Update message to include token card
                const tokenSymbol = detectedIntent.token_symbol.toUpperCase();
                const isTokenQuery = tokenSymbol === 'ETH' || tokenSymbol === 'EThereum';
                
                setMessages(prev => prev.map(msg => 
                    msg.id === aiMsgId ? {
                        ...msg,
                        type: 'token-card',
                        data: isTokenQuery ? {
                            symbol: tokenSymbol,
                            name: tokenSymbol === 'ETH' ? 'Ethereum' : tokenSymbol,
                            price: 3450.25,
                            change24h: 5.2,
                            riskScore: 85,
                            liquidity: '$2.5B',
                            volume24h: '$1.2B',
                            recentTransactions: [
                                { type: 'buy', amount: '100 ETH', price: '3450', time: '2m ago' },
                                { type: 'sell', amount: '50 ETH', price: '3448', time: '5m ago' },
                                { type: 'buy', amount: '200 ETH', price: '3452', time: '8m ago' }
                            ],
                            chartData: [3200, 3250, 3180, 3300, 3350, 3400, 3450]
                        } : undefined
                    } : msg
                ));
            }

            // Store full response for continue generation
            setStoppedMessageContent(fullResponse);
            
            // Final save after streaming completes
            if (currentConvId && onMessagesChange && aiMsgId) {
                setTimeout(() => {
                    setMessages(prev => {
                        const finalMessages = prev.map(msg =>
                            msg.id === aiMsgId ? { ...msg, content: fullResponse } : msg
                        );
                        onMessagesChange(finalMessages);
                        return finalMessages;
                    });
                }, 0);
            }

        } catch (error) {
            console.error('AI service error:', error);
            clearTimeout(thinkingTimeout);
            setIsThinking(false);
            
            // Fallback response
            const aiMsgId = (Date.now() + 1).toString();
            const aiNow = new Date();
            const errorMsg: Message = {
                id: aiMsgId,
                role: 'ai',
                content: 'I apologize, but I encountered an error processing your request. Please try again.',
                timestamp: aiNow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                date: aiNow.toISOString().split('T')[0],
                type: 'text',
            };

            const messagesWithError = [...updatedMessages, errorMsg];
            setMessages(messagesWithError);
            
            if (currentConvId && onMessagesChange) {
                onMessagesChange(messagesWithError);
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Don't send if user is composing text with IME (input method editor)
        if (e.key === 'Enter' && !e.shiftKey && !isComposing && !(e.nativeEvent as any).isComposing) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleCompositionStart = () => {
        setIsComposing(true);
    };

    const handleCompositionEnd = () => {
        setIsComposing(false);
    };

    const formatDateSeparator = (dateStr: string): string => {
        const date = new Date(dateStr);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const dateStrToday = today.toISOString().split('T')[0];
        const dateStrYesterday = yesterday.toISOString().split('T')[0];
        
        if (dateStr === dateStrToday) {
            return 'Today';
        } else if (dateStr === dateStrYesterday) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
        }
    };

    const prompts = [
        { label: 'Analyze ETH', desc: 'Price, volume, and risk analysis' },
        { label: 'Gas Price', desc: 'Current gas fees on Ethereum' },
        { label: 'Top Gainers', desc: 'Tokens with highest 24h change' },
        { label: 'DeFi Yields', desc: 'Best stablecoin APYs' },
    ];

    return (
        <div className={styles.chatContainer}>
            {/* Hero / Welcome Content */}
            <div className={clsx(styles.heroContent, hasStarted && styles.heroContentHidden)}>
                <div className={styles.welcomeLogo}>K</div>
                <div className={styles.welcomeTitle}>How can I help you today?</div>
            </div>

            {/* Message List */}
            <div
                className={clsx(styles.messageList, !hasStarted && styles.messageListHidden)}
                ref={scrollContainerRef}
                onScroll={handleScroll}
            >
                {messages.map((msg, index) => {
                    const isGrouped = index > 0 && messages[index - 1].role === msg.role;
                    const prevMsg = index > 0 ? messages[index - 1] : null;
                    const showDateSeparator = prevMsg && prevMsg.date && msg.date && prevMsg.date !== msg.date;
                    
                    return (
                        <React.Fragment key={msg.id}>
                            {showDateSeparator && (
                                <div className={styles.dateSeparator}>
                                    <span>{formatDateSeparator(msg.date!)}</span>
                                </div>
                            )}
                            <MessageBubble 
                                message={msg} 
                                isGrouped={isGrouped}
                                onContinue={stoppedMessageId === msg.id ? () => {
                                    const fullText = stoppedMessageContent || msg.content;
                                    continueGeneration(msg.id, fullText, msg.content);
                                } : undefined}
                                canContinue={stoppedMessageId === msg.id && !isStreaming}
                            />
                            {msg.type === 'token-card' && msg.data && !isStreaming && (
                                <div className={styles.aiRow}>
                                    <div className={styles.avatarPlaceholder} />
                                    <div className={styles.messageContentWrapper}>
                                        <TokenCard {...msg.data} />
                                    </div>
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}
                {isThinking && (
                    <div className={styles.aiRow}>
                        <div className={styles.avatar}>
                            <div className={styles.aiAvatarIcon} />
                        </div>
                        <div className={styles.messageContentWrapper}>
                            <div className={styles.senderName}>KIKO AI <span className={styles.timestamp}>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
                            <div className={clsx(styles.bubble, styles.aiBubble)}>
                                <div className={styles.thinkingBubble}>
                                    <div className={styles.dot} />
                                    <div className={styles.dot} />
                                    <div className={styles.dot} />
                                    <span className={styles.thinkingText}>{thinkingText}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Jump to Bottom Button */}
            {showJumpToBottom && (
                <button
                    className={styles.jumpToBottom}
                    onClick={() => scrollToBottom()}
                >
                    <ArrowDown size={16} />
                    <span>Jump to Bottom</span>
                </button>
            )}

            {/* Input Area */}
            <div className={clsx(styles.inputArea, hasStarted ? styles.inputBottom : styles.inputCenter)}>
                <div className={styles.inputWrapper}>
                    <div className={styles.strategiesContainer}>
                        <button
                            className={clsx(styles.strategyToggle, showStrategies && styles.strategyToggleActive)}
                            onClick={() => setShowStrategies(!showStrategies)}
                        >
                            <Sparkles size={12} />
                            <span>Strategies</span>
                            <ChevronDown size={12} className={clsx(styles.chevron, showStrategies && styles.chevronRotated)} />
                        </button>

                        {showStrategies && (
                            <div className={styles.strategyDropdown}>
                                {prompts.map((p, i) => (
                                    <button
                                        key={i}
                                        className={styles.strategyItem}
                                        onClick={() => {
                                            handleSend(p.label);
                                            setShowStrategies(false);
                                        }}
                                    >
                                        <span className={styles.strategyLabel}>{p.label}</span>
                                        <span className={styles.strategyDesc}>{p.desc}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className={styles.inputRow}>
                        <button className={styles.attachBtn}>
                            <Paperclip size={18} />
                        </button>
                        <textarea
                            className={styles.textArea}
                            placeholder="Ask anything..."
                            rows={1}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onFocus={handleInputFocus}
                            onCompositionStart={handleCompositionStart}
                            onCompositionEnd={handleCompositionEnd}
                        />
                        <button
                            className={clsx(styles.sendBtn, (isThinking || isStreaming) && styles.stopBtn)}
                            onClick={() => (isThinking || isStreaming) ? stopGeneration() : handleSend()}
                            disabled={!input.trim() && !isThinking && !isStreaming}
                        >
                            {(isThinking || isStreaming) ? <Square size={14} fill="currentColor" /> : <Send size={18} />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
