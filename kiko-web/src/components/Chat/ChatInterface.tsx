import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate, useLocation } from 'react-router-dom';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import type { WalletWithMetadata } from '@privy-io/react-auth';
import { toast } from '../Toast';
import { WelcomeScreen } from './WelcomeScreen';
import { CustomAISettingsModal } from './CustomAISettingsModal';
import type { SuggestionItem } from './ChatInputSuggestions';
import { useSmartSuggestions } from './useSmartSuggestions.tsx';
import { useSidebar } from '../Layout/Layout';
import { useThemeContext } from '../../contexts/ThemeContext';
import { useChain } from '../../contexts/ChainContext';
import { extractStrategiesFromMessages } from '../../utils/strategyExtractor';
import { useStrategies } from '../../hooks/useStrategies';
import { useSafariKeyboardFix } from '../../hooks/useSafariKeyboardFix';
import styles from './Chat.module.css';
import { chatApi } from '../../services/api';
import { getWalletBalance } from '../../services/walletApi';
import { chatWSClient, type ChatEvent } from '../../utils/chatWebSocket';
import { clearActiveTask } from '../../utils/taskLifecycle';
import type { Conversation, Message } from '../../hooks/useConversations';
import { useConversationContext } from '../../contexts/ConversationContext';
import { useFarcasterContext } from '../../contexts/FarcasterContext';
import { moderationService } from '../../services/moderation';
import { logger } from '../../utils/logger';
import { getStoredSlippageBps } from '@/config/slippageConfig';
import { getUserSettings, saveUserSettings } from '../../services/userSettingsApi';
import { ChatMessageList } from './ChatMessageList';
import { ChatComposer } from './ChatComposer';
import { ACTION_CARD_TYPE_MAP, COMMON_TOKENS, MODEL_OPTIONS, findChatModelOption, getDefaultChatModelOption } from './chatConstants';
import { requiresContractAddressInFastMode, resolveNativeToken, resolveTokenForChat, resolveTokenForFastSwap } from './chatTokenResolution';
import { mergeTransactionCardData } from '../../utils/transactionCardState';

interface TaskState {
    id: string;
    status: string;
    [key: string]: unknown;
}

const normalizeUiTaskStatus = (status: unknown): 'queued' | 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' => {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'queued') return 'queued';
    if (normalized === 'pending') return 'pending';
    if (normalized === 'running') return 'running';
    if (normalized === 'completed' || normalized === 'done') return 'completed';
    if (normalized === 'failed' || normalized === 'error') return 'failed';
    return 'cancelled';
};

type PendingChunk = {
    content: string;
    reasoning: string;
};

interface ChatInterfaceProps {
    conversationId?: string | null;
    initialMessages?: Message[];
    onMessagesChange?: (messages: Message[]) => void;
    onNewConversation?: (title: string) => Promise<string | null>;
    conversationTitle?: string;
    onNewChat?: () => void;
    pendingAIPrompt?: string | null;
    onAIPromptSet?: () => void;
    activeTask?: TaskState | null;
    onTaskUpdate?: (task: TaskState | null) => void;
}

const extractAddresses = (text: string): string[] => {
    const matches = text.match(/0x[a-fA-F0-9]{40}/gi);
    return matches ? Array.from(new Set(matches)) : [];
};

const replaceMessageAtIndex = (messages: Message[], idx: number, nextMessage: Message): Message[] => {
    if (idx < 0 || idx >= messages.length) return messages;
    if (messages[idx] === nextMessage) return messages;
    const updated = [...messages];
    updated[idx] = nextMessage;
    return updated;
};

const mergeRenderContracts = (existing: any, incoming: any): any[] => {
    const current = Array.isArray(existing)
        ? existing
        : existing
            ? [existing]
            : [];
    const next = Array.isArray(incoming)
        ? incoming
        : incoming
            ? [incoming]
            : [];
    const merged = [...current];
    for (const contract of next) {
        if (!contract || typeof contract !== 'object') continue;
        const incomingId = String(contract.id || '').trim();
        const idx = merged.findIndex((item) => String(item?.id || '').trim() === incomingId && incomingId);
        if (idx >= 0) {
            merged[idx] = { ...merged[idx], ...contract };
        } else {
            merged.push(contract);
        }
    }
    return merged;
};

const LOCAL_TX_CARD_TEST_COMMANDS = new Set([
    '/test-tx-card',
    '/tx-card-test',
    'test tx card',
    'tx card test',
]);

const isLocalUiTestEnvironment = () =>
    import.meta.env.DEV ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

const isLocalTxCardTestCommand = (text: string) => LOCAL_TX_CARD_TEST_COMMANDS.has(text.trim().toLowerCase());

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
    initialMessages = [],
    pendingAIPrompt: propPendingPrompt,
    onAIPromptSet,
    activeTask: propActiveTask,
    onTaskUpdate,
}) => {
    const {
        conversations,
        activeConversationId,
        updateConversation,
        createConversation,
        loadConversation,
        isLoading,
        registerPendingLocalUserMessage,
    } = useConversationContext();

    const { user, authenticated, ready, login, getAccessToken } = usePrivy();
    const { wallets } = useWallets();
    const farcasterContext = useFarcasterContext();
    const { currentChain, switchChain } = useChain();
    const { strategies, refreshUserStrategies, deleteStrategy, toggleStrategyStatus, createStrategy } = useStrategies();
    const sidebar = useSidebar();
    const { resolvedTheme } = useThemeContext();
    const safariKeyboard = useSafariKeyboardFix();

    const chainId = currentChain.id;

    const params = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const routeConversationId = params.conversationId || null;
    const isChatRoute = location.pathname.startsWith('/chat/');
    const conversationId = isChatRoute ? (routeConversationId || activeConversationId || null) : null;
    const currentConv = conversations.find(c => c.id === conversationId);
    const messages = currentConv?.messages || initialMessages;
    const messagesRef = useRef<Message[]>(messages);
    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);
    const hasStreamingAssistant = messages.some(
        m => m.role === 'assistant' && (m.status as string) === 'streaming'
    );
    const hasStreamingAssistantContent = messages.some(
        m =>
            m.role === 'assistant' &&
            (m.status as string) === 'streaming' &&
            (((m.content || '').length > 0) || ((m.reasoning_content || '').length > 0))
    );
    const activeTaskStatus = (currentConv?.activeTask?.status as string | undefined) || '';
    const hasActiveTaskInProgress =
        activeTaskStatus === 'queued' ||
        activeTaskStatus === 'pending' ||
        activeTaskStatus === 'running' ||
        activeTaskStatus === 'streaming';
    const isStreaming = hasStreamingAssistantContent || activeTaskStatus === 'streaming';
    const isThinking =
        !isStreaming &&
        (hasActiveTaskInProgress || (hasStreamingAssistant && !hasStreamingAssistantContent));
    const activeTaskId = currentConv?.activeTask?.id || null;
    const activeTaskIdRef = useRef<string | null>(activeTaskId);
    useEffect(() => {
        activeTaskIdRef.current = activeTaskId;
    }, [activeTaskId]);
    const walletAddress = useMemo(() => {
        if (currentChain.id === 900) {
            const solLink = user?.linkedAccounts?.find(
                (acc): acc is WalletWithMetadata => acc.type === 'wallet' && acc.chainType === 'solana' && acc.walletClientType === 'privy'
            );
            if (solLink) return solLink.address;
            const solWallet = wallets.find(w => w.walletClientType === 'solana');
            return solWallet?.address || '';
        }
        const embeddedEVM = user?.linkedAccounts?.find(
            (acc): acc is WalletWithMetadata => acc.type === 'wallet' && acc.chainType === 'ethereum' && acc.walletClientType === 'privy'
        );
        if (embeddedEVM) return embeddedEVM.address;

        const evmWallet = wallets.find(w => w.walletClientType !== 'solana');
        return evmWallet?.address || user?.wallet?.address || '';
    }, [wallets, user, currentChain.id]);



    // const chainName = chainNameMap[chainId] || `Chain ${chainId}`;

    // State for user balances (common tokens)
    const [userBalances, setUserBalances] = useState<Record<string, string>>({});
    const processedStrategyIdsRef = useRef<Set<string>>(new Set());
    const [input, setInput] = useState('');
    const [isStopping, setIsStopping] = useState(false);
    const [isLoadingConversation, setIsLoadingConversation] = useState(false);

    // chatStarted lives in Layout (SidebarContext); we read via sidebar?.chatStarted and write via sidebar?.setChatStarted
    const [thinkingText, setThinkingText] = useState('Thinking');
    const [thinkingStartTime, setThinkingStartTime] = useState<number>(0);
    const [firstSendPending, setFirstSendPending] = useState(false);
    const [showJumpToBottom, setShowJumpToBottom] = useState(false);
    const [isComposing, setIsComposing] = useState(false);
    const isTextSelectionActiveRef = useRef(false);
    const lastCompositionEndRef = useRef<number>(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [welcomePendingMessages, setWelcomePendingMessages] = useState<Message[]>([]);
    const hasVisibleAssistantResponse = useMemo(
        () =>
            messages.some((message) => {
                if (message.role !== 'assistant') return false;
                if (message.type && message.type !== 'text') return true;
                if ((message.content || '').trim().length > 0) return true;
                if ((message.reasoning_content || '').trim().length > 0) return true;
                return false;
            }),
        [messages]
    );
    const hasAnyAssistantMessage = useMemo(
        () => messages.some((message) => message.role === 'assistant'),
        [messages]
    );
    const displayMessages = useMemo(() => {
        if (conversationId || welcomePendingMessages.length === 0) return messages;
        const existingIds = new Set(messages.map(m => m.id));
        const append = welcomePendingMessages.filter(m => !existingIds.has(m.id));
        return append.length > 0 ? [...messages, ...append] : messages;
    }, [conversationId, messages, welcomePendingMessages]);
    const isBusy = isThinking || isStreaming || firstSendPending;


    // Load selected model from localStorage or use default
    const getInitialModel = () => {
        try {
            const saved = localStorage.getItem('kiko-selected-model');
            if (saved) {
                const parsed = JSON.parse(saved);
                const found = findChatModelOption(parsed.id);
                if (found) {
                    return found;
                }
            }
        } catch (e) {
            logger.warn('Failed to load saved model from localStorage:', e);
        }
        return getDefaultChatModelOption();
    };

    const [selectedModel, setSelectedModel] = useState(getInitialModel);
    const setSelectedModelAndPersist = useCallback((nextModel: typeof MODEL_OPTIONS[number]) => {
        setSelectedModel(nextModel);
        try {
            localStorage.setItem('kiko-selected-model', JSON.stringify(nextModel));
        } catch (e) {
            logger.warn('Failed to persist model selection to localStorage:', e);
        }
        if (!authenticated) return;
        void (async () => {
            try {
                const token = await getAccessToken();
                if (!token) return;
                await saveUserSettings(token, { defaultChatModel: nextModel.id });
            } catch (error) {
                logger.warn('Failed to persist default chat model:', error);
            }
        })();
    }, [authenticated, getAccessToken]);

    // Suggestions State (Managed by Hook)
    const {
        suggestions,
        showSuggestions,
        detectIntent,
        closeSuggestions,
        suppressSuggestions,
        resumeSuggestions
    } = useSmartSuggestions(
        () => { }, // onSend is unused in hook now
        (nextInput: string) => {
            setInput(nextInput);
            requestAnimationFrame(() => {
                if (textareaRef.current) {
                    autoResizeTextarea(textareaRef.current);
                }
            });
        }
    );

    const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [customSettings, setCustomSettings] = useState<Record<string, unknown> | null>(null);
    const pendingChunksRef = useRef<Map<string, PendingChunk>>(new Map());
    const chunkFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const syncTextSelectionState = () => {
            const selection = window.getSelection();
            isTextSelectionActiveRef.current = !!selection && !selection.isCollapsed && selection.toString().length > 0;
        };

        const handleSelectionIntent = (event: MouseEvent | PointerEvent | TouchEvent) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest('[data-kiko-message-selection-target="true"]')) {
                isTextSelectionActiveRef.current = true;
            }
        };

        document.addEventListener('mousedown', handleSelectionIntent, true);
        document.addEventListener('pointerdown', handleSelectionIntent, true);
        document.addEventListener('selectionchange', syncTextSelectionState);
        window.addEventListener('mouseup', syncTextSelectionState);
        window.addEventListener('pointerup', syncTextSelectionState);
        window.addEventListener('touchend', syncTextSelectionState);

        return () => {
            document.removeEventListener('mousedown', handleSelectionIntent, true);
            document.removeEventListener('pointerdown', handleSelectionIntent, true);
            document.removeEventListener('selectionchange', syncTextSelectionState);
            window.removeEventListener('mouseup', syncTextSelectionState);
            window.removeEventListener('pointerup', syncTextSelectionState);
            window.removeEventListener('touchend', syncTextSelectionState);
            isTextSelectionActiveRef.current = false;
        };
    }, []);

    const flushPendingChunks = useCallback(() => {
        // Deprecated: Chunks are now handled globally by RootLayout.
        pendingChunksRef.current.clear();
    }, []);

    const scheduleChunkFlush = useCallback(() => {
        // Deprecated
    }, []);

    const disableChatTransitions = true;

    // Load custom settings
    useEffect(() => {
        const loadCustomSettings = () => {
            try {
                const saved = localStorage.getItem('kiko-custom-ai-settings');
                if (saved) {
                    setCustomSettings(JSON.parse(saved));
                }
            } catch (e) {
                logger.warn('Failed to load custom settings:', e);
            }
        };

        loadCustomSettings();

        const handleCustomSettingsChange = (event: CustomEvent) => {
            setCustomSettings(event.detail);
        };

        window.addEventListener('kiko-custom-ai-changed', handleCustomSettingsChange as EventListener);
        return () => {
            window.removeEventListener('kiko-custom-ai-changed', handleCustomSettingsChange as EventListener);
        };
    }, []);

    // WebSocket listener for real-time updates
    // NOTE: We only SUBSCRIBE here - App.tsx controls the WebSocket CONNECTION
    // This ensures generating conversations aren't interrupted when switching conversations
    useEffect(() => {
        if (!conversationId) return;

        // Track mounted state to prevent state updates after unmount
        let isMounted = true;

        logger.debug(`Subscribing to conversation ${conversationId}`);
        // DO NOT call chatWSClient.connect() here - App.tsx manages connections
        // to ensure generating conversation is not overridden

        const unsubscribe = chatWSClient.subscribe((event: ChatEvent) => {
            // CRITICAL: Check if still mounted before any state updates
            // This prevents crashes when quickly switching conversations
            if (!isMounted) return;
            if (event.sessionId !== conversationId) return;

            switch (event.type) {
                // chunk, task_status, usage, citations, message_start, message_complete
                // are now handled by RootLayout.tsx globally

                case 'client_action': {
                    // Backward compatibility: some backends emit {type,payload} directly
                    const normalizedAction = event.data?.action || (
                        event.data?.type
                            ? {
                                type: event.data.type,
                                data: event.data.data ?? event.data.payload,
                                payload: event.data.payload ?? event.data.data,
                            }
                            : null
                    );
                    if (!normalizedAction?.type) {
                        logger.warn('Received malformed client_action event:', event.data);
                        break;
                    }
                    logger.debug('Received client action:', normalizedAction);

                    if (normalizedAction.type === 'switch_chain') {
                        const actionData = normalizedAction.payload || normalizedAction.data;
                        const targetChainId = actionData.chainId || actionData.chain_id;
                        const targetTaskId = actionData.taskId || actionData.task_id || activeTaskIdRef.current;
                        if (targetChainId) {
                            void (async () => {
                                try {
                                    await switchChain(targetChainId);
                                } catch (error: any) {
                                    const switchFailedMessage = error?.message || `Failed to switch to ${actionData.chainName || 'target chain'}.`;
                                    if (targetTaskId) {
                                        try {
                                            await chatApi.reportChainSwitchResult(targetTaskId, {
                                                chainId: targetChainId,
                                                chainName: actionData.chainName,
                                                status: 'failed',
                                                error: switchFailedMessage,
                                            });
                                        } catch (ackError) {
                                            logger.warn('Failed to report chain switch failure to backend:', ackError);
                                        }
                                    }
                                    toast.error(switchFailedMessage);
                                    return;
                                }

                                if (targetTaskId) {
                                    try {
                                        await chatApi.reportChainSwitchResult(targetTaskId, {
                                            chainId: targetChainId,
                                            chainName: actionData.chainName,
                                            status: 'success',
                                        });
                                    } catch (ackError: any) {
                                        const ackMessage = ackError?.message || 'Wallet switched, but KiKo failed to sync the new chain state.';
                                        logger.warn('Failed to report chain switch success to backend:', ackError);
                                        toast.error(ackMessage);
                                        return;
                                    }
                                }

                                toast.success(`Switched to ${actionData.chainName || 'target chain'}.`);
                            })();
                        }
                        break;
                    }

                    if (normalizedAction.type === 'execute_swap_instant') {
                        // DIRECT SERVER EXECUTION - NO UI CARD
                        // This bypasses SwapCard completely for instant/allowance trades
                        const actionData = normalizedAction.payload || normalizedAction.data;
                        const targetChainId = actionData.chainId || actionData.chain_id || chainId;
                        const amountIn = actionData.amountIn || actionData.amount_in;
                        const slippageBps = actionData.slippageBps ?? actionData.slippage_bps ??
                            (actionData.slippage ? Math.round(Number(actionData.slippage) * 100) : getStoredSlippageBps());
                        const targetMessageId = event.data?.message_id || event.data?.messageId || `tx-${Date.now()}`;

                        const patchTransactionCard = (patch: Record<string, unknown>) => {
                            if (!conversationId) return;
                            const currentMessages = messagesRef.current;
                            const idx = currentMessages.findIndex(m => m.id === targetMessageId);
                            if (idx === -1) return;
                            const current = currentMessages[idx];
                            const nextMessage: Message = {
                                ...current,
                                type: 'transaction-status-card',
                                data: mergeTransactionCardData(current.data || {}, patch),
                            };
                            const updated = replaceMessageAtIndex(currentMessages, idx, nextMessage);
                            messagesRef.current = updated;
                            updateConversation(conversationId, { messages: updated });
                        };

                        const getFallbackSymbol = (token: string | { symbol?: string; name?: string } | null | undefined): string => {
                            if (typeof token === 'string') {
                                const t = token.trim();
                                if (/^0x[eE]{40}$/.test(t)) return 'ETH';
                                if (/^0x[0-9a-fA-F]{40}$/.test(t)) return `${t.slice(0, 6)}...${t.slice(-4)}`;
                                return t;
                            }
                            return token?.symbol || token?.name || 'Unknown';
                        };

                        void (async () => {
                            const rawTokenIn = actionData.tokenIn || actionData.token_in;
                            const rawTokenOut = actionData.tokenOut || actionData.token_out;
                            const resolveToken = customSettings?.fastSwapMode ? resolveTokenForFastSwap : resolveTokenForChat;
                            const disallowedAddresses = walletAddress ? [walletAddress] : [];
                            const [resolvedIn, resolvedOut] = await Promise.all([
                                resolveNativeToken(targetChainId, typeof rawTokenIn === 'string' ? rawTokenIn : rawTokenIn?.symbol) ||
                                await resolveToken(rawTokenIn, targetChainId, { disallowedAddresses }),
                                resolveNativeToken(targetChainId, typeof rawTokenOut === 'string' ? rawTokenOut : rawTokenOut?.symbol) ||
                                await resolveToken(rawTokenOut, targetChainId, { disallowedAddresses }),
                            ]);

                            const tokenInAddress = resolvedIn?.address || '';
                            const tokenOutAddress = resolvedOut?.address || '';

                            if (!tokenInAddress || !tokenOutAddress) {
                                const failedTxCardMsg: Message = {
                                    id: targetMessageId,
                                    role: 'assistant',
                                    content: '',
                                    reasoning_content: '',
                                    status: 'complete',
                                    timestamp: new Date().toISOString(),
                                    type: 'transaction-status-card',
                                    data: {
                                        status: 'failed',
                                        tokenInSymbol: resolvedIn?.symbol || getFallbackSymbol(rawTokenIn),
                                        tokenOutSymbol: resolvedOut?.symbol || getFallbackSymbol(rawTokenOut),
                                        tokenInLogoURI: resolvedIn?.logoURI,
                                        tokenOutLogoURI: resolvedOut?.logoURI,
                                        chainId: targetChainId,
                                        amountIn: String(amountIn),
                                        isLoading: false,
                                        errorMessage: customSettings?.fastSwapMode
                                            ? 'Fast Swap Mode requires contract addresses for non-whitelisted tokens.'
                                            : 'Unable to resolve token metadata for this trade.',
                                    }
                                };

                                if (conversationId) {
                                    const currentMessages = messagesRef.current;
                                    const idx = currentMessages.findIndex(m => m.id === targetMessageId);
                                    const updated = idx >= 0
                                        ? currentMessages.map((m, i) => i === idx ? { ...m, ...failedTxCardMsg } : m)
                                        : [...currentMessages, failedTxCardMsg];
                                    messagesRef.current = updated;
                                    updateConversation(conversationId, {
                                        messages: updated,
                                        activeTask: null
                                    });
                                }
                                return;
                            }

                            logger.debug('Executing instant swap:', {
                                tokenIn: tokenInAddress,
                                tokenOut: tokenOutAddress,
                                amountIn,
                                chainId: targetChainId,
                                slippageBps
                            });

                            const txCardMsg: Message = {
                                id: targetMessageId,
                                role: 'assistant',
                                content: '',
                                reasoning_content: '',
                                status: 'complete',
                                timestamp: new Date().toISOString(),
                                type: 'transaction-status-card',
                                data: {
                                    status: 'building',
                                    tokenInSymbol: resolvedIn?.symbol || getFallbackSymbol(rawTokenIn),
                                    tokenOutSymbol: resolvedOut?.symbol || getFallbackSymbol(rawTokenOut),
                                    tokenInLogoURI: resolvedIn?.logoURI,
                                    tokenOutLogoURI: resolvedOut?.logoURI,
                                    tokenInAddress,
                                    tokenOutAddress,
                                    amountIn: String(amountIn),
                                    chainId: targetChainId,
                                    isLoading: true
                                }
                            };

                            if (conversationId) {
                                const currentMessages = messagesRef.current;
                                const idx = currentMessages.findIndex(m => m.id === targetMessageId);
                                const updated = idx >= 0
                                    ? currentMessages.map((m, i) => i === idx ? { ...m, ...txCardMsg } : m)
                                    : [...currentMessages, txCardMsg];
                                messagesRef.current = updated;
                                updateConversation(conversationId, {
                                    messages: updated,
                                    activeTask: null
                                });
                            }

                            const { executeSwapInstant } = await import('../../services/swapService');

                            patchTransactionCard({ status: 'sending' });

                            const swapPromise = executeSwapInstant({
                                tokenIn: tokenInAddress,
                                tokenOut: tokenOutAddress,
                                amountIn: String(amountIn),
                                chainId: targetChainId,
                                slippageBps
                            });

                            patchTransactionCard({ status: 'pending' });

                            swapPromise.then(result => {
                                if (result.success && result.txHash) {
                                    patchTransactionCard({
                                        status: 'success',
                                        txHash: result.txHash,
                                        isLoading: false,
                                    });
                                } else {
                                    patchTransactionCard({
                                        status: 'failed',
                                        errorMessage: result.error,
                                        isLoading: false,
                                    });
                                }
                            }).catch(err => {
                                patchTransactionCard({
                                    status: 'failed',
                                    errorMessage: err.message,
                                    isLoading: false,
                                });
                            });
                        })();


                        // DEPRECATED: show_swap_card removed from chat interface (kept in WalletPage)
                    } else if (normalizedAction.type === 'show_strategy_card') {
                        // Card has arrived: hard-stop any residual thinking/streaming state
                        if (conversationId) {
                            clearActiveTask(conversationId, updateConversation, 'strategy_card');
                        }
                        if (onTaskUpdate) {
                            onTaskUpdate(null);
                        }

                        // For strategy cards, trigger an immediate refresh of the strategies list
                        // This helps avoid the "deleted" race condition
                        if (refreshUserStrategies) {
                            logger.debug('Triggering immediate strategy refresh for new card');
                            refreshUserStrategies();
                        }

                        const targetMessageId = event.data.message_id || event.data.messageId;
                        if (conversationId) {
                            // CRITICAL: use ref snapshot, not stale closure `messages`,
                            // otherwise late card events can overwrite the conversation with old state.
                            let updated = [...messagesRef.current];
                            const targetIdx = targetMessageId ? updated.findIndex(m => m.id === targetMessageId) : -1;
                            if (targetIdx !== -1) {
                                updated = updated.map((m, idx) => idx === targetIdx ? {
                                    ...m,
                                    type: 'strategy-card',
                                    data: event.data.action.data
                                } : m);
                            } else {
                                // Fallback to last assistant message if ID not found
                                const lastAssistantIdx = [...updated].reverse().findIndex(m => m.role === 'assistant');
                                if (lastAssistantIdx !== -1) {
                                    const actualIdx = updated.length - 1 - lastAssistantIdx;
                                    updated = updated.map((m, idx) => idx === actualIdx ? {
                                        ...m,
                                        type: 'strategy-card',
                                        data: event.data.action.data
                                    } : m);
                                }
                            }
                            messagesRef.current = updated;
                            updateConversation(conversationId, { messages: updated });
                        }
                    } else if (['show_chart_card', 'show_transaction_status_card', 'show_cross_chain_status_card', 'show_polymarket_card'].includes(normalizedAction.type)) {
                        const targetMessageId = event.data.targetMessageId || event.data.message_id || event.data.messageId;
                        const actionType = normalizedAction.type;
                        const actionData = normalizedAction.data || normalizedAction.payload || {};
                        const newCardType = ACTION_CARD_TYPE_MAP[actionType] || 'text';
                        const isPolymarketPreview = actionType === 'show_polymarket_card' && Boolean(actionData.preview);

                        if (conversationId) {
                            // CRITICAL: Use messagesRef.current for fresh state, not stale `messages` closure.
                            // The effect closure captures `messages` at creation time. Without the ref,
                            // every card update would push a NEW card because the closure never sees the card we just added.
                            const freshMessages = messagesRef.current;
                            let updated = [...freshMessages];
                            const targetIdx = targetMessageId ? updated.findIndex(m => m.id === targetMessageId) : -1;

                            logger.debug('[Card] show_card received', {
                                type: actionType,
                                conversationId,
                                targetMessageId,
                                messageCount: freshMessages.length,
                                targetIdx,
                                action: targetIdx !== -1 ? 'update_existing' : (targetMessageId ? 'push_new' : 'skip_no_target'),
                                status: actionData?.status,
                            });

                            if (targetIdx !== -1) {
                                // Merge new data into existing card data so we don't lose symbols/amounts from earlier events
                                const existingData = updated[targetIdx].data || {};
                                updated = replaceMessageAtIndex(updated, targetIdx, {
                                    ...updated[targetIdx],
                                    type: newCardType as Message['type'],
                                    data: newCardType === 'transaction-status-card'
                                        ? mergeTransactionCardData(existingData, actionData)
                                        : { ...existingData, ...actionData }
                                });
                                logger.debug('[Card] Replaced message at index', { targetIdx, newCardType });
                            } else if (targetMessageId) {
                                updated.push({
                                    id: targetMessageId, role: 'assistant', content: '', reasoning_content: '',
                                    status: 'complete', timestamp: new Date().toISOString(),
                                    type: newCardType as Message['type'], data: actionData
                                } as Message);
                                logger.debug('[Card] Pushed new card message', { targetMessageId, newCardType, newLength: updated.length });
                            }
                            // CRITICAL: Immediately update messagesRef so the NEXT event in the same tick
                            // sees the card we just added/updated. Without this, rapid-fire events
                            // (e.g., two client_actions in the same microtask) both read stale messagesRef
                            // and push duplicate cards.
                            messagesRef.current = updated;
                            const nextConversationPatch: Partial<Conversation> = { messages: updated };
                            if (!isPolymarketPreview) {
                                nextConversationPatch.activeTask = null;
                            }
                            updateConversation(conversationId, nextConversationPatch);
                        }
                    } else if (normalizedAction.type === 'update_message_data') {
                        const targetMessageId = event.data.targetMessageId || event.data.message_id || event.data.messageId;
                        const actionData = normalizedAction.data || normalizedAction.payload || {};
                        if (conversationId && targetMessageId) {
                            const freshMessages = messagesRef.current;
                            const targetIdx = freshMessages.findIndex(m => m.id === targetMessageId);
                            if (targetIdx !== -1) {
                                const existingData = freshMessages[targetIdx].data || {};
                                const mergedData = {
                                    ...existingData,
                                    ...actionData,
                                    renderContracts: mergeRenderContracts(existingData.renderContracts, actionData.renderContracts),
                                };
                                const updated = replaceMessageAtIndex(freshMessages, targetIdx, {
                                    ...freshMessages[targetIdx],
                                    data: mergedData,
                                });
                                messagesRef.current = updated;
                                updateConversation(conversationId, { messages: updated });
                            }
                        }
                    }
                    break;
                }
                case 'transaction_update':
                case 'transaction_confirmed':
                case 'transaction_complete':
                    // Handled by updating context
                    if (conversationId && (event.data.messageId || event.data.message_id)) {
                        const mid = event.data.messageId || event.data.message_id;
                        const freshMsgs = messagesRef.current;
                        const updated = freshMsgs.map(m => {
                            if (m.id === mid && m.type === 'transaction-status-card') {
                                const mergedData = mergeTransactionCardData(m.data || {}, {
                                    ...event.data,
                                    isLoading: !['transaction_complete', 'transaction_confirmed'].includes(event.type) && !['success', 'failed'].includes(event.data.status)
                                });
                                return {
                                    ...m,
                                    data: mergedData
                                };
                            }
                            return m;
                        });
                        const found = freshMsgs.some(m => m.id === mid && m.type === 'transaction-status-card');
                        logger.debug('[Card] transaction status event', { eventType: event.type, messageId: mid, foundCard: found });
                        messagesRef.current = updated;
                        // card_displayed: activeTask cleared with messages
                        updateConversation(conversationId, {
                            messages: updated,
                            activeTask: null
                        });
                    }
                    break;
            }
        });

        return () => {
            flushPendingChunks();
            isMounted = false;  // Mark as unmounted BEFORE unsubscribe
            unsubscribe();
            // We don't necessarily want to close WS here if it's used elsewhere, 
            // but for simplicity we can
            // chatWSClient.close();
        };
    }, [conversationId, flushPendingChunks, scheduleChunkFlush]);

    // Sync with localStorage on mount and when it changes externally
    useEffect(() => {
        const syncModelFromStorage = () => {
            try {
                const saved = localStorage.getItem('kiko-selected-model');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    const found = findChatModelOption(parsed.id);
                    if (found) {
                        setSelectedModel(current => {
                            if (found.id !== current.id) {
                                logger.debug('Syncing model from localStorage:', found.id);
                                return found;
                            }
                            return current;
                        });
                    }
                }
            } catch (e) {
                logger.warn('Failed to sync model from localStorage:', e);
            }
        };

        // Check on mount
        syncModelFromStorage();

        // Listen for custom event from WelcomeScreen
        const handleModelChange = (event: CustomEvent) => {
            const newModel = event.detail;
            const found = findChatModelOption(newModel.id);
            if (found) {
                setSelectedModel(current => {
                    if (found.id !== current.id) {
                        logger.debug('Model changed via event:', found.id);
                        return found;
                    }
                    return current;
                });
            }
        };

        window.addEventListener('kiko-model-changed', handleModelChange as EventListener);

        // Also listen for storage events (from other tabs)
        window.addEventListener('storage', syncModelFromStorage);

        return () => {
            window.removeEventListener('kiko-model-changed', handleModelChange as EventListener);
            window.removeEventListener('storage', syncModelFromStorage);
        };
    }, []);

    useEffect(() => {
        if (!ready || !authenticated) return;
        let cancelled = false;
        const loadSavedModel = async () => {
            try {
                const token = await getAccessToken();
                if (!token) return;
                const settings = await getUserSettings(token);
                const found = findChatModelOption(settings?.defaultChatModel);
                if (!cancelled && found) {
                    setSelectedModel(current => (current.id === found.id ? current : found));
                    localStorage.setItem('kiko-selected-model', JSON.stringify(found));
                }
            } catch (error) {
                logger.warn('Failed to load saved default chat model:', error);
            }
        };
        void loadSavedModel();
        return () => {
            cancelled = true;
        };
    }, [ready, authenticated, getAccessToken]);

    useEffect(() => {
        if (!conversationId || !currentConv?.model) return;
        const found = MODEL_OPTIONS.find(model => model.id === currentConv.model);
        if (!found) return;
        setSelectedModel(current => {
            if (current.id === found.id) return current;
            logger.debug('Syncing model from current conversation:', found.id);
            return found;
        });
    }, [conversationId, currentConv?.model]);

    useEffect(() => {
        return () => {
            if (chunkFlushTimerRef.current) {
                clearTimeout(chunkFlushTimerRef.current);
                chunkFlushTimerRef.current = null;
            }
        };
    }, []);

    // Save model selection to localStorage whenever it changes
    useEffect(() => {
        try {
            localStorage.setItem('kiko-selected-model', JSON.stringify(selectedModel));
        } catch (e) {
            logger.warn('Failed to save model selection to localStorage:', e);
        }
    }, [selectedModel]);

    // Start from null so first mount on /chat/:id is treated as a switch and triggers loadConversation.
    const currentConversationIdRef = useRef<string | null>(null);
    const processedMessagesRef = useRef<Set<string>>(new Set());
    const modelSelectorRef = useRef<HTMLDivElement>(null);
    const inputAreaRef = useRef<HTMLDivElement>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const isAtBottomRef = useRef(true);
    const userScrolledUpRef = useRef(false);
    const lastScrollTopRef = useRef<number>(0);
    const justSwitchedConversationRef = useRef(false);
    const pendingScrollToLatestRef = useRef(false);
    const isSendingRef = useRef(false); // Flag to prevent stopGeneration during active send
    const sendAbortControllerRef = useRef<AbortController | null>(null);
    const stopRequestedRef = useRef(false);

    const syncScrollPaddingWithComposer = useCallback(() => {
        if (!scrollContainerRef.current) return;
        const scrollEl = scrollContainerRef.current;
        const composerEl = inputAreaRef.current;

        if (!composerEl) {
            scrollEl.style.paddingBottom = '';
            return;
        }

        const scrollRect = scrollEl.getBoundingClientRect();
        const composerRect = composerEl.getBoundingClientRect();
        const overlap = Math.max(0, scrollRect.bottom - composerRect.top);
        const bottomReserve = Math.ceil(overlap + 16);
        scrollEl.style.paddingBottom = `${bottomReserve}px`;
    }, []);

    const scrollToBottom = useCallback((smooth = true) => {
        if (isTextSelectionActiveRef.current) {
            return;
        }
        if (scrollContainerRef.current) {
            const { scrollHeight, clientHeight } = scrollContainerRef.current;
            scrollContainerRef.current.scrollTo({
                top: scrollHeight - clientHeight,
                behavior: smooth ? 'smooth' : 'auto',
            });
        }
    }, []);

    useEffect(() => {
        syncScrollPaddingWithComposer();
        const composerEl = inputAreaRef.current;
        if (!composerEl || typeof ResizeObserver === 'undefined') return;

        const observer = new ResizeObserver(() => {
            syncScrollPaddingWithComposer();
        });
        observer.observe(composerEl);
        window.addEventListener('resize', syncScrollPaddingWithComposer);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', syncScrollPaddingWithComposer);
        };
    }, [syncScrollPaddingWithComposer, showSuggestions, input, safariKeyboard.inputTop, safariKeyboard.isKeyboardVisible]);

    // Sync chatStarted with Layout on mount (single source: Layout's chatStarted)
    useEffect(() => {
        sidebar?.setChatStarted(initialMessages.length > 0 || !!conversationId || isLoading);
    }, []);

    // Close model dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modelSelectorRef.current && !modelSelectorRef.current.contains(event.target as Node)) {
                setIsModelDropdownOpen(false);
            }
        };

        if (isModelDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isModelDropdownOpen]);

    /** Scenario A: Sending first message, URL just navigated to new conversation — no load, no clear. */
    const handleNewConversationNavigation = useCallback((newId: string) => {
        logger.debug('Skipping stopGeneration - active send in progress');
        currentConversationIdRef.current = newId || null;
        setIsLoadingConversation(false);
    }, []);

    /** Scenario B: User switched to another conversation or opened /chat/:id — load if needed, clear prev task, reset UI. */
    const handleConversationSwitch = useCallback(async (prevId: string | null, newId: string | null) => {
        logger.debug('⚠️ CONVERSATION CHANGED:', { prevId, newId });
        if (!newId) {
            if (prevId) {
                const prevConv = conversations.find(c => c.id === prevId);
                if (prevConv?.activeTask) clearActiveTask(prevId, updateConversation, 'conversation_switch_to_welcome');
            }
            setThinkingText('Thinking');
            setThinkingStartTime(0);
            setFirstSendPending(false);
            setInput('');
            processedMessagesRef.current.clear();
            processedStrategyIdsRef.current.clear();
            currentConversationIdRef.current = null;
            if (onTaskUpdate) onTaskUpdate(null);
            sidebar?.setChatStarted(false);
            requestAnimationFrame(() => setIsLoadingConversation(false));
            return;
        }

        setIsLoadingConversation(true);
        let loadPromise: Promise<unknown> | null = null;

        if (prevId) {
            const prevConv = conversations.find(c => c.id === prevId);
            if (prevConv?.activeTask) clearActiveTask(prevId, updateConversation, 'conversation_switch');
        }

        if (newId && (!currentConv || !currentConv.messages || currentConv.messages.length === 0)) {
            loadPromise = loadConversation(newId);
        }

        logger.debug('Resetting UI states (backend continues generating)...');
        const lastAssistantMsg = initialMessages.filter(m => m.role === 'assistant').pop();
        const isTargetStreaming = lastAssistantMsg?.status === 'streaming';

        if (isTargetStreaming && newId) {
            logger.debug('Target conversation has streaming message, ensuring activeTask state');
            if (!currentConv?.activeTask) {
                updateConversation(newId, {
                    activeTask: { id: lastAssistantMsg!.id, status: 'streaming' as any }
                });
            }
        } else if (newId && currentConv?.activeTask) {
            processedMessagesRef.current.clear();
            processedStrategyIdsRef.current.clear();
        }

        setThinkingText('Thinking');
        setThinkingStartTime(0);
        setFirstSendPending(false);
        setInput('');
        userScrolledUpRef.current = false;
        isAtBottomRef.current = true;
        setShowJumpToBottom(false);
        const hasMessages = (currentConv?.messages?.length ?? initialMessages.length) > 0;
        sidebar?.setChatStarted(!!newId || isLoading || isSendingRef.current || hasMessages);
        processedMessagesRef.current.clear();
        processedStrategyIdsRef.current.clear();
        currentConversationIdRef.current = newId || null;
        if (onTaskUpdate) onTaskUpdate(null);
        initialMessages.forEach(msg => processedMessagesRef.current.add(msg.id));
        justSwitchedConversationRef.current = true;
        pendingScrollToLatestRef.current = true;
        try {
            if (loadPromise) {
                await Promise.race([
                    loadPromise,
                    new Promise((_, reject) => setTimeout(() => reject(new Error('load_conversation_timeout')), 8000))
                ]);
            }
        } catch (error) {
            logger.warn('[ChatInterface] conversation switch load failed:', error);
            toast.warning('Loading this chat is taking longer than expected. Please try again.');
        } finally {
            requestAnimationFrame(() => setIsLoadingConversation(false));
            requestAnimationFrame(() => scrollToBottom(false));
            logger.debug('Conversation switch complete. New ID:', newId, 'Marked', initialMessages.length, 'messages as processed');
        }
    }, [conversations, currentConv, initialMessages, updateConversation, loadConversation, sidebar, isLoading, onTaskUpdate]);

    /** Scenario C: Same conversationId, background message sync from loadConversation or streaming. */
    const handleBackgroundMessageSync = useCallback(() => {
        if (initialMessages.length === 0) return;
        if (messages.length === 0 && initialMessages.length > 0) {
            logger.debug('Syncing - local empty but props has messages');
            sidebar?.setChatStarted(true);
            initialMessages.forEach(msg => processedMessagesRef.current.add(msg.id));
            return;
        }
        if (activeTaskId || isStreaming || isThinking) return;
        if (!isStreaming && !isThinking) {
            const lastLocal = messages[messages.length - 1];
            const lastInitial = initialMessages[initialMessages.length - 1];
            const hasSubstantialDiff =
                messages.length !== initialMessages.length ||
                (lastLocal?.id === lastInitial?.id && (
                    lastLocal?.status !== lastInitial?.status ||
                    (lastInitial?.content || '').length > (lastLocal?.content || '').length
                ));
            if (hasSubstantialDiff) {
                logger.debug('Syncing messages from props - background update detected');
                sidebar?.setChatStarted(initialMessages.length > 0);
            }
        }
    }, [initialMessages, messages, activeTaskId, isStreaming, isThinking, sidebar]);

    // Sync messages when conversationId or initialMessages change
    useEffect(() => {
        const prevId = currentConversationIdRef.current;
        const newId = conversationId;

        if (prevId === newId) {
            handleBackgroundMessageSync();
            return;
        }
        if (isSendingRef.current && newId) {
            handleNewConversationNavigation(newId);
            return;
        }
        handleConversationSwitch(prevId, newId || null);
    }, [conversationId, handleNewConversationNavigation, handleConversationSwitch, handleBackgroundMessageSync]);

    // Safety net: if we're on "/", there is no conversation, and nothing is pending, force welcome state.
    useEffect(() => {
        if (conversationId) return;
        if (isThinking || isStreaming || firstSendPending) return;
        if (messages.length > 0 || welcomePendingMessages.length > 0) return;
        sidebar?.setChatStarted(false);
    }, [conversationId, isThinking, isStreaming, firstSendPending, messages.length, welcomePendingMessages.length, sidebar]);

    useEffect(() => {
        if (conversationId) {
            setWelcomePendingMessages([]);
        }
    }, [conversationId]);

    // Reliability: after auth becomes ready, ensure direct /chat/:id refresh always loads history.
    useEffect(() => {
        if (!ready || !authenticated || !conversationId) return;
        const conv = conversations.find(c => c.id === conversationId);
        if ((conv?.messages?.length ?? 0) > 0) return;
        setIsLoadingConversation(true);
        Promise.race([
            loadConversation(conversationId),
            new Promise((_, reject) => setTimeout(() => reject(new Error('load_conversation_timeout')), 8000)),
        ])
            .catch((error) => {
                logger.warn('[ChatInterface] reliability load failed:', error);
            })
            .finally(() => setIsLoadingConversation(false));
    }, [ready, authenticated, conversationId, conversations, loadConversation]);

    // Failsafe: never keep interaction blocked in loading overlay forever.
    useEffect(() => {
        if (!isLoadingConversation) return;
        const timer = setTimeout(() => {
            logger.warn('[ChatInterface] forcing loading overlay reset after timeout');
            setIsLoadingConversation(false);
        }, 12000);
        return () => clearTimeout(timer);
    }, [isLoadingConversation]);

    // Sync thinking text with active task message
    useEffect(() => {
        if (currentConv?.activeTask?.message) {
            setThinkingText(currentConv.activeTask.message);
        } else if (!isBusy) {
            setThinkingText('Thinking');
        }
    }, [currentConv?.activeTask?.message, isBusy]);

    useEffect(() => {
        if (!conversationId) {
            if (onTaskUpdate) {
                onTaskUpdate(null);
            }
            return;
        }

        // Check if we have activeTask from props (loaded by App.tsx)
        if (propActiveTask) {
            const task = propActiveTask;

            // If task is still running, ensure context matches
            if (task.status === 'queued' || task.status === 'pending' || task.status === 'running') {
                if (conversationId && !currentConv?.activeTask) {
                    updateConversation(conversationId, {
                        activeTask: { id: task.id, status: task.status as any }
                    });
                }
            } else {
                // Task is done/failed/cancelled, clear UI state
                if (conversationId && currentConv?.activeTask) {
                    clearActiveTask(conversationId, updateConversation, 'prop_task_done');
                }
                if (onTaskUpdate) {
                    onTaskUpdate(null);
                }
                logger.debug('Task is complete, clearing UI state:', task.id, task.status);
            }
        } else {
            // No active task from props, ensure onTaskUpdate matches context
            if (onTaskUpdate) {
                onTaskUpdate(currentConv?.activeTask || null);
            }
        }
    }, [conversationId, propActiveTask, messages, currentConv?.activeTask, onTaskUpdate, updateConversation]);

    useEffect(() => {
        if (!firstSendPending) return;
        if (!hasAnyAssistantMessage) return;
        setFirstSendPending(false);
    }, [firstSendPending, hasAnyAssistantMessage]);

    useEffect(() => {
        if (isBusy) {
            if (!thinkingStartTime) {
                setThinkingStartTime(Date.now());
            }
            return;
        }
        if (thinkingStartTime !== 0) {
            setThinkingStartTime(0);
        }
    }, [isBusy, thinkingStartTime]);

    useEffect(() => {
        if (!pendingScrollToLatestRef.current) return;
        if (isLoadingConversation) return;
        requestAnimationFrame(() => {
            userScrolledUpRef.current = false;
            isAtBottomRef.current = true;
            setShowJumpToBottom(false);
            scrollToBottom(false);
            pendingScrollToLatestRef.current = false;
        });
    }, [conversationId, isLoadingConversation, messages.length, scrollToBottom]);

    // Fetch user balances for common tokens AND tokens mentioned in chat
    useEffect(() => {
        if (!walletAddress || !authenticated || chainId === 0) return;

        const fetchBalances = async () => {
            // Loading state handled internally
            try {
                // Dynamically import to avoid circular dependencies if any
                const { getWalletPortfolio } = await import('../../services/swapService');
                const balances: Record<string, string> = {};

                // First, get native balance (ETH, BNB, etc.)
                // Chain-specific native token symbols
                const NATIVE_SYMBOLS: Record<number, string> = {
                    1: 'ETH',       // Ethereum
                    8453: 'ETH',    // Base
                    10: 'ETH',      // Optimism
                    42161: 'ETH',   // Arbitrum
                    56: 'BNB',      // BSC
                    137: 'MATIC',   // Polygon
                    900: 'SOL',     // Solana
                };

                const chainNameMap: Record<number, string> = {
                    1: 'eth',
                    8453: 'base',
                    10: 'optimism',
                    42161: 'arbitrum',
                    56: 'bsc',
                    137: 'polygon',
                    900: 'solana',
                };
                const chainName = chainNameMap[chainId] || 'eth';
                const nativeBalance = await getWalletBalance(walletAddress, chainName);
                if (nativeBalance?.ethBalanceFormatted !== undefined) {
                    const nativeSymbol = NATIVE_SYMBOLS[chainId] || 'ETH';
                    // IMPORTANT: Always include native balance (even 0) so AI knows we checked
                    balances[nativeSymbol] = (nativeBalance.ethBalanceFormatted || 0).toFixed(8);
                }

                // Call the unified portfolio API - returns ALL tokens with known metadata/decimals
                // This solves the issue of needing to guess decimals for new tokens
                const portfolio = await getWalletPortfolio(walletAddress, chainId);

                // Map portfolio items to balances
                if (portfolio) {
                    portfolio.forEach(token => {
                        // Prefer formatted balance directly from API as it handles decimals correctly
                        // But API returns string like "123.456"
                        const balanceVal = parseFloat(token.formatted);
                        // IMPORTANT: Include tokens with 0 balance so AI knows we checked and found 0
                        if (balanceVal >= 0 && !isNaN(balanceVal)) {
                            balances[token.symbol] = token.formatted;
                            // Also store by address for context awareness
                            if (token.contractAddress) {
                                balances[token.contractAddress.toLowerCase()] = token.formatted;
                            }
                        }
                    });
                }

                // Ensure Common Tokens and Context Tokens have entries (even if 0)
                // This helps AI know that we CHECKED and found 0, vs unknown
                const commonTokens = COMMON_TOKENS[chainId] || [];
                // Only process last 10 messages for performance
                const recentMessages = messages.slice(-10);
                const contextAddresses = recentMessages.flatMap(msg => extractAddresses(msg.content));

                // Set of addresses to ensure we have coverage for
                const targetAddresses = new Set([
                    ...commonTokens.map(t => t.address.toLowerCase()),
                    ...contextAddresses.map(a => a.toLowerCase())
                ]);

                targetAddresses.forEach(addr => {
                    // Check if we have it by address
                    if (!balances[addr]) {
                        // Check if we have it by symbol (for common tokens)
                        const common = commonTokens.find(t => t.address.toLowerCase() === addr);
                        if (common && balances[common.symbol]) {
                            // We have it by symbol, ensure address key points to same value
                            balances[addr] = balances[common.symbol];
                        } else {
                            // Truly missing/zero
                            balances[addr] = "0";
                            if (common) {
                                balances[common.symbol] = "0";
                            }
                        }
                    }
                });

                setUserBalances(balances);
            } catch (error) {
                logger.error('Error fetching balances:', error);
            }
        };

        fetchBalances();
    }, [walletAddress, authenticated, chainId, messages.length]); // Re-run when new messages arrive

    // Extract strategies from messages
    useEffect(() => {
        if (messages.length === 0 || !conversationId) return;

        // Extract strategies from current messages
        const extractedStrategies = extractStrategiesFromMessages(messages, conversationId);

        // Create strategies that don't already exist
        extractedStrategies.forEach((strategy) => {
            // Use a combination of conversationId and strategy name as a unique key
            const strategyKey = `${conversationId}-${strategy.name}-${strategy.type}`;

            // Check if we've already processed this strategy
            if (!processedStrategyIdsRef.current.has(strategyKey)) {
                // Check if strategy already exists in storage (by name and type)
                const exists = strategies.some(
                    s => s.name === strategy.name &&
                        s.type === strategy.type &&
                        s.conversationId === conversationId
                );

                if (!exists) {
                    createStrategy(strategy);
                    processedStrategyIdsRef.current.add(strategyKey);
                }
            }
        });
    }, [messages, conversationId, createStrategy, strategies]);

    // Auto-send for pending user messages (e.g., from AI report button)
    useEffect(() => {
        // Skip if just switched conversation - prevents firing API calls for loaded history
        if (justSwitchedConversationRef.current) {
            logger.debug('Skipping auto-send - just switched conversation');
            justSwitchedConversationRef.current = false;
            return;
        }

        if (isBusy || messages.length === 0) return;

        // Only check if we have messages and conversation is active
        if (!conversationId) return;

        // Check if the last message is a user message that hasn't been processed yet
        const lastMessage = messages[messages.length - 1];
        if (lastMessage &&
            lastMessage.role === 'user' &&
            !processedMessagesRef.current.has(lastMessage.id)) {
            // Check if there's already an AI response (if so, don't auto-send)
            // This handles the case where messages were loaded from storage
            const hasAIResponse = messages.some((msg, idx) =>
                idx > messages.indexOf(lastMessage) && msg.role === 'assistant'
            );

            if (!hasAIResponse) {
                // Mark as processed to avoid duplicate sends
                processedMessagesRef.current.add(lastMessage.id);

                // Auto-send after a short delay to ensure state is updated
                // Use requestAnimationFrame to ensure we're not in render phase
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        handleSend(lastMessage.content, lastMessage.id);
                    }, 100);
                });
            }
        }
    }, [messages, conversationId, isBusy]);

    // Auto-save messages removed - handled by updateConversation in event handlers

    // Sync on unmount only
    useEffect(() => {
        return () => {
            if (messagesRef.current.length > 0 && currentConversationIdRef.current) {
                // Determine if we need to sync on unmount.
                // Usually context handles this live, but strict safeguard:
                if (activeConversationId && activeConversationId === currentConversationIdRef.current) {
                    updateConversation(activeConversationId, { messages: messagesRef.current });
                }
            }
        };
    }, []); // Empty dependency array = runs only on mount/unmount

    // Safety timeout removed: No timeouts during AI response to ensure uninterrupted flow

    // Smart scroll on new messages - follow output if user is at bottom
    useEffect(() => {
        if (userScrolledUpRef.current) {
            return;
        }
        if (isTextSelectionActiveRef.current) {
            return;
        }
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) {
            return;
        }

        if (scrollContainerRef.current && (messages.length > 0 || firstSendPending)) {
            const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
            const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
            const isNearBottom = distanceFromBottom < 100; // Increased threshold for stability
            
            // Only auto-scroll if we are sending, thinking, or streaming AND near bottom
            const shouldScroll = (firstSendPending || isThinking || isStreaming) && isNearBottom;

            if (shouldScroll) {
                requestAnimationFrame(() => {
                    if (scrollContainerRef.current && !userScrolledUpRef.current) {
                        const currentSelection = window.getSelection();
                        if (!currentSelection || currentSelection.toString().length === 0) {
                            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
                            isAtBottomRef.current = true;
                            lastScrollTopRef.current = scrollContainerRef.current.scrollTop;
                        }
                    }
                });
            }
        }
    }, [messages.length, isThinking, isStreaming, firstSendPending, scrollToBottom]);

    const handleScroll = () => {
        if (scrollContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
            const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
            const isAtBottom = distanceFromBottom < 50; // Match threshold used in auto-scroll

            // IMPORTANT: During streaming, don't interfere with auto-scroll
            // Only detect user scroll when NOT streaming to avoid false positives
            if (!isStreaming) {
                // Detect scroll direction - if scrollTop increased, user scrolled up
                const scrollDelta = scrollTop - lastScrollTopRef.current;
                const isScrollingUp = scrollDelta > 0; // Positive delta means scrolling up

                // If user scrolled up (even slightly), immediately stop auto-scrolling
                if (isScrollingUp && scrollDelta > 1) { // Threshold of 1px to catch any upward movement
                    userScrolledUpRef.current = true;
                }

                // Track if user manually scrolled up (away from bottom)
                const wasAtBottom = isAtBottomRef.current;

                if (!isAtBottom && wasAtBottom) {
                    // User was at bottom but scrolled up - stop auto-scrolling
                    userScrolledUpRef.current = true;
                } else if (isAtBottom && !isScrollingUp) {
                    // User scrolled DOWN to bottom - resume auto-scrolling
                    userScrolledUpRef.current = false;
                }
            } else {
                // During streaming: detect user scrolling UP (scrollDelta < 0 means scrollTop decreased)
                // Auto-scroll causes scrollTop to increase (scrollDelta > 0), so we only stop on negative delta
                const scrollDelta = scrollTop - lastScrollTopRef.current;

                // User scrolled UP (scrollTop decreased) - stop auto-scrolling immediately
                if (scrollDelta < 0) {
                    userScrolledUpRef.current = true;
                } else if (scrollDelta > 0 && isAtBottom) {
                    // User scrolled DOWN and reached bottom - resume auto-scrolling
                    userScrolledUpRef.current = false;
                }
            }

            // Update last scroll position
            lastScrollTopRef.current = scrollTop;
            isAtBottomRef.current = isAtBottom;
            setShowJumpToBottom(!isAtBottom);
        }
    };

    const handleInputFocus = () => {
        // Only auto-scroll if user is already at bottom or near bottom
        // This prevents the "jump to bottom" when clicking to copy text or reading history
        const selection = window.getSelection();
        const hasSelection = selection && selection.toString().length > 0;

        if (scrollContainerRef.current && !userScrolledUpRef.current && !hasSelection) {
            const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
            const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
            if (distanceFromBottom < 100) {
                scrollToBottom();
            }
        }

        // Only trigger suggestions if there is input (user preference: strictly on matching)
        if (input && input.trim().length > 0) {
            detectIntent(input);
        }
    };

    // silentMode: if true, doesn't trigger visual stopping state (for conversation switches)
    const stopGeneration = async (silentMode = false) => {
        logger.debug('Stop requested', {
            conversationId,
            activeTaskId,
            activeTaskStatus: currentConv?.activeTask?.status,
            firstSendPending,
            isThinking,
            isStreaming,
        });

        if (!isThinking && !isStreaming && !firstSendPending) return;

        if (firstSendPending && !isThinking && !isStreaming) {
            setFirstSendPending(false);
            return;
        }

        stopRequestedRef.current = true;

        if (!silentMode) {
            setIsStopping(true);
        }

        if (conversationId && currentConv?.activeTask) {
            updateConversation(conversationId, {
                activeTask: {
                    ...currentConv.activeTask,
                    stopRequested: true,
                },
            });
        }

        if (sendAbortControllerRef.current) {
            sendAbortControllerRef.current.abort();
            sendAbortControllerRef.current = null;
        }

        let realTaskId = activeTaskId && !activeTaskId.startsWith('task-') ? activeTaskId : null;

        if (!realTaskId && conversationId) {
            try {
                logger.debug('No real task id in UI state, fetching session to resolve activeTask', { conversationId });
                const sessionResp = await chatApi.getSession(conversationId);
                const resolvedTaskId = sessionResp.activeTask?.id;
                if (resolvedTaskId && !String(resolvedTaskId).startsWith('task-')) {
                    realTaskId = resolvedTaskId;
                    updateConversation(conversationId, {
                        activeTask: {
                            ...(currentConv?.activeTask || {}),
                            ...(sessionResp.activeTask || {}),
                            id: resolvedTaskId,
                            status: normalizeUiTaskStatus(sessionResp.activeTask?.status),
                            stopRequested: true,
                        },
                    });
                }
            } catch (err) {
                logger.warn('Failed to resolve active task before stopping', err);
            }
        }

        if (realTaskId) {
            try {
                logger.debug('Stopping real task:', realTaskId);
                await chatApi.stopTask(realTaskId);
            } catch (err) {
                logger.error('Failed to stop task:', err);
            }
        } else if (conversationId && currentConv?.activeTask) {
            clearActiveTask(conversationId, updateConversation, 'user_stop_without_task_id');
        }

        setTimeout(() => {
            stopRequestedRef.current = false;
            setIsStopping(false);
        }, 300);
    };



    // Flag to prevent double submission (race condition)
    const isSubmittingRef = useRef(false);

    // Always-fresh ref so event listeners can call handleSend without stale closure
    const handleSendRef = useRef<(text: string) => void>(() => { });

    const injectLocalTransactionCardTest = useCallback(async (rawText: string, existingMessageId?: string) => {
        const now = new Date();
        const userMsg: Message = {
            id: existingMessageId || `local-test-user-${Date.now()}`,
            role: 'user',
            content: rawText,
            clientCreatedAt: now.toISOString(),
            timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            date: now.toISOString().split('T')[0],
            type: 'text',
        };

        const txCardMsg: Message = {
            id: `local-test-tx-${Date.now()}`,
            role: 'assistant',
            content: '',
            reasoning_content: '',
            timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            date: now.toISOString().split('T')[0],
            status: 'complete',
            type: 'transaction-status-card',
            data: {
                status: 'success',
                tokenInSymbol: 'USDC',
                tokenOutSymbol: 'WETH',
                amountIn: '5',
                amountOut: '0.002517491981002632',
                chainId,
                isLoading: false,
                txHash: '0xf0905b7c6df0b3ed9328',
            }
        };

        processedMessagesRef.current.add(userMsg.id);
        sidebar?.setChatStarted(true);
        suppressSuggestions();
        setInput('');
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
        await stopGeneration(true);
        setFirstSendPending(false);

        let targetConversationId = conversationId;
        if (!targetConversationId) {
            targetConversationId = await createConversation('Local UI Test', selectedModel.id);
            if (!targetConversationId) {
                toast.error('Unable to create a chat for the local transaction card test.');
                return;
            }
            currentConversationIdRef.current = targetConversationId;
            navigate(`/chat/${targetConversationId}`);
        }

        const nextMessages = [...messagesRef.current.filter(m => m.id !== userMsg.id), userMsg, txCardMsg];
        messagesRef.current = nextMessages;
        registerPendingLocalUserMessage(targetConversationId, userMsg);
        updateConversation(targetConversationId, {
            messages: nextMessages,
            activeTask: null,
        });

        userScrolledUpRef.current = false;
        isAtBottomRef.current = true;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => scrollToBottom(false));
        });
        toast.success('Local transaction card test injected.');
    }, [
        chainId,
        conversationId,
        createConversation,
        navigate,
        registerPendingLocalUserMessage,
        scrollToBottom,
        selectedModel.id,
        sidebar,
        suppressSuggestions,
        updateConversation,
    ]);

    const handleSend = async (text: string = input, existingMessageId?: string) => {
        if (isLocalUiTestEnvironment() && isLocalTxCardTestCommand(text)) {
            await injectLocalTransactionCardTest(text, existingMessageId);
            return;
        }
        if (!authenticated) {
            try {
                login();
            } catch (e) {
                logger.warn('Failed to trigger login:', e);
            }
            return;
        }
        if (isSubmittingRef.current) return;
        if (!text.trim()) return;
        if (customSettings?.fastSwapMode && requiresContractAddressInFastMode(text, chainId)) {
            toast.error('Fast Swap Mode requires a contract address for non-whitelisted tokens.');
            return;
        }

        isSubmittingRef.current = true;
        if (!conversationId) {
            setFirstSendPending(true);
        }

        // ============================================
        // OPTIMISTIC UI: Update visual state IMMEDIATELY before any API calls
        // This eliminates perceived delay when sending first message from WelcomeScreen
        // ============================================

        // 1. Switch to chat view immediately
        sidebar?.setChatStarted(true);

        // 2. Prepare and show user message immediately
        const now = new Date();
        const userMsg: Message = {
            id: existingMessageId || Date.now().toString(),
            role: 'user',
            content: text,
            clientCreatedAt: now.toISOString(),
            timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            date: now.toISOString().split('T')[0],
            type: 'text',
        };

        // CRITICAL: Immediately mark this message ID as processed to block the auto-send useEffect
        processedMessagesRef.current.add(userMsg.id);

        if (!existingMessageId && conversationId) {
            // Replace placeholder message (from pendingAIPrompt) if it exists, otherwise append
            const placeholderIdx = messages.findIndex(m => m.id.startsWith('pending-user-'));
            let updated: Message[];
            if (placeholderIdx >= 0) {
                updated = messages.map((m, idx) => idx === placeholderIdx ? userMsg : m);
            } else {
                updated = [...messages, userMsg];
            }
            messagesRef.current = updated;
            updateConversation(conversationId, {
                messages: updated,
                activeTask: { id: `task-${Date.now()}`, status: 'pending' }
            });
            registerPendingLocalUserMessage(conversationId, userMsg);
        } else if (!existingMessageId && !conversationId) {
            setWelcomePendingMessages(prev => [...prev.filter(m => m.id !== userMsg.id), userMsg]);
        }

        // 4. Clear input immediately
        setInput('');

        // CRITICAL: Stop any previous generation BEFORE showing new thinking
        if (isThinking || isStreaming || !!currentConv?.activeTask || !!sendAbortControllerRef.current) {
            await stopGeneration(true);
        }

        // Context handles thinking state based on activeTask
        setThinkingText('Thinking');
        setThinkingStartTime(Date.now());

        // 5. Optimistically set activeTask IMMEDIATELY for existing conversations
        if (conversationId) {
            updateConversation(conversationId, {
                activeTask: { id: `task-${Date.now()}`, status: 'pending' }
            });
        }
        // [Logic]: Explicitly close suggestions to prevent the box from persisting after message is sent.
        // [Ref]: useSmartSuggestions defines closeSuggestions to set showSuggestions to false.
        // [Risk]: If closeSuggestions is not available due to hook initialization race, this might fail silently.
        suppressSuggestions();

        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }

        // Scroll after the optimistic UI and thinking placeholder have painted.
        userScrolledUpRef.current = false;
        isAtBottomRef.current = true;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => scrollToBottom(false));
        });

        let currentConvId = conversationId;

        try {
            const sendAbortController = new AbortController();
            sendAbortControllerRef.current = sendAbortController;
            stopRequestedRef.current = false;

            // Perform client-side moderation check
            const moderationResult = await moderationService.checkInput(text, conversationId, selectedModel?.id);
            if (!moderationResult.safe) {
                toast.error(moderationResult.reason || 'Message blocked by safety policy');
                // Revert optimistic UI on moderation failure
                if (conversationId) {
                    updateConversation(conversationId, {
                        messages: messages.filter(m => m.id !== userMsg.id),
                        activeTask: null
                    });
                }
                if (!conversationId) sidebar?.setChatStarted(false);
                if (!conversationId) setWelcomePendingMessages(prev => prev.filter(m => m.id !== userMsg.id));
                setFirstSendPending(false);
                return;
            }

            // Set flag to prevent conversation-change useEffect from interrupting
            isSendingRef.current = true;

            // LOGGING: Log the chain context before sending
            logger.debug(`Sending message on chain: ${currentChain.name} (${currentChain.id})`);

            // Prevent sending new messages while stopping
            if (isStopping) {
                logger.debug('Blocked send - currently stopping');
                if (conversationId) clearActiveTask(conversationId, updateConversation, 'user_stop');
                // If stopping a new conversation (no ID yet), just reset local state
                if (!conversationId) sidebar?.setChatStarted(false);
                if (!conversationId) setWelcomePendingMessages(prev => prev.filter(m => m.id !== userMsg.id));
                setFirstSendPending(false);
                return;
            }

            // Use the live UI selection as the send source of truth.
            const modelToUse = selectedModel;

            // Create conversation in background (after UI is already updated)
            if (!currentConvId) {
                const newId = await createConversation(text, modelToUse.id);
                if (newId) {
                    currentConvId = newId;
                    // Update ref immediately
                    currentConversationIdRef.current = newId;

                    // CRITICAL: Persist user message to the new conversation immediately
                    messagesRef.current = [userMsg];
                    updateConversation(newId, { messages: [userMsg] });
                    registerPendingLocalUserMessage(newId, userMsg);
                    setWelcomePendingMessages([]);

                    // Navigate to new URL
                    navigate(`/chat/${newId}`);
                }
            }

            if (!currentConvId) {
                // Revert optimistic UI on session creation failure
                // Use conversationId if available (existing chat), otherwise just reset local state
                if (conversationId) {
                    updateConversation(conversationId, {
                        messages: messages.filter(m => m.id !== userMsg.id),
                        activeTask: null
                    });
                } else {
                    sidebar?.setChatStarted(false);
                    setWelcomePendingMessages(prev => prev.filter(m => m.id !== userMsg.id));
                }
                if (conversationId && messages.length > 0) {
                    updateConversation(conversationId, { messages: [] });
                    sidebar?.setChatStarted(false);
                }
                if (!authenticated) {
                    toast.error('Session expired. Login to KIKO to create chat session.');
                } else {
                    toast.error('Unable to create chat session. Please refresh and try again.');
                }
                setFirstSendPending(false);
                return;
            }

            if (currentConvId && currentConvId !== conversationId) {
                // Set optimistic activeTask to show "Thinking" immediately for NEW conversations
                updateConversation(currentConvId, {
                    activeTask: { id: `task-${Date.now()}`, status: 'pending' },
                    pendingAIPrompt: undefined
                });
            }

            // 3. WebSocket is already connected globally in App.tsx
            // checks are handled by handleGlobalChatEvent

            // 4. Call backend API
            logger.debug('Sending message with walletAddress:', walletAddress, 'chainId:', chainId);
            const nativeSymbolMap: Record<number, string> = {
                1: 'ETH',
                8453: 'ETH',
                10: 'ETH',
                42161: 'ETH',
                56: 'BNB',
                137: 'MATIC',
                900: 'SOL',
            };
            const nativeSymbol = nativeSymbolMap[chainId] || 'ETH';
            const nativeBalance = userBalances[nativeSymbol];
            const contextPayload = {
                walletAddress,
                chainId,
                chainName: currentChain.name,
                isWalletConnected: !!walletAddress,
                balance: userBalances,
                nativeBalance,
                currentPage: window.location.pathname,
                pageContext: `${document.title || 'KiKo'} | ${window.location.pathname}`,
                farcaster: {
                    followsKiko: farcasterContext.followsKiko,
                    followStatus: farcasterContext.followStatus,
                    checkedAt: farcasterContext.checkedAt,
                    kikoHandle: 'kikoapp',
                    profileUrl: farcasterContext.profileUrl,
                },
            };
            const resp = await chatApi.sendMessage(currentConvId, text, {
                model: modelToUse.id,
                walletAddress: walletAddress,
                chainId: chainId,
                toolConfig: customSettings,
                allowanceMode: customSettings?.fastSwapMode ? 'instant' : 'confirm',
                nativeBalance,
                currentPage: window.location.pathname,
                pageContext: `${document.title || 'KiKo'} | ${window.location.pathname}`,
                balance: userBalances,
                farcaster: contextPayload.farcaster,
                context: contextPayload,
                signal: sendAbortController.signal,
            });

            if (resp.success) {
                const { assistantMessage, task } = resp;
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('kiko-usage-refresh'));
                }

                // Add assistant message placeholder
                const createdAt = (assistantMessage as any).created_at ?? assistantMessage.timestamp ?? Date.now();
                const aiMsg: Message = {
                    id: assistantMessage.id,
                    role: 'assistant',
                    content: assistantMessage.content || '',
                    reasoning_content: assistantMessage.reasoning_content || '',
                    timestamp: new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    date: new Date(createdAt).toISOString().split('T')[0],
                    type: (assistantMessage.type as any) || 'text',
                    data: assistantMessage.data,
                    status: (assistantMessage.status as any) || 'streaming',
                };

                const currentMessages = messagesRef.current;
                const exists = currentMessages.some(m => m.id === assistantMessage.id);
                const nextMessages = exists ? currentMessages : [...currentMessages, aiMsg];

                updateConversation(currentConvId, {
                    messages: nextMessages,
                    activeTask: { id: task.id, status: task.status as any }
                });

                // Update task state in parent component
                if (onTaskUpdate) {
                    onTaskUpdate({ id: task.id, status: task.status as any });
                }
                // WebSocket will handle the chunks and status updates
            } else {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const errorMessage = (resp as any).error || (resp as any).message || 'Failed to send message';
                throw new Error(errorMessage);
            }
        } catch (error: unknown) {
            const err = error as Error;
            logger.error('Error sending message:', err);
            setFirstSendPending(false);

            const wasStoppedByUser = err.name === 'AbortError' || stopRequestedRef.current;
            if (wasStoppedByUser) {
                if (currentConvId) {
                    clearActiveTask(currentConvId, updateConversation, 'send_aborted');
                } else if (conversationId) {
                    clearActiveTask(conversationId, updateConversation, 'send_aborted');
                }
                return;
            }

            const errorMsg: Message = {
                id: Date.now().toString(),
                role: 'assistant',
                content: `Error: ${err.message || 'Failed to connect to backend'}`,
                status: 'error',
                type: 'text',
                timestamp: new Date().toLocaleTimeString(),
            };
            if (currentConvId) {
                updateConversation(currentConvId, {
                    messages: [...messages, errorMsg],
                    activeTask: null
                });
            } else if (conversationId) {
                updateConversation(conversationId, {
                    messages: [...messages, errorMsg],
                    activeTask: null
                });
            }
        } finally {
            sendAbortControllerRef.current = null;
            // Clear sending flag
            isSendingRef.current = false;
            // Clear submission lock
            isSubmittingRef.current = false;
        }
    };

    // Keep handleSendRef always pointing at the latest handleSend
    useEffect(() => { handleSendRef.current = (text: string) => handleSend(text); });

    // Listen for cross-page input prefill events (e.g. Buy/Sell from TokenDetailPage)
    // Does NOT auto-send — user reviews and sends manually
    // Strategy: sessionStorage (for lazy-mount case) + window event (for already-mounted case)
    useEffect(() => {
        // 1. On mount: check if there's a queued prefill from sessionStorage
        const stored = sessionStorage.getItem('kiko-prefill-prompt');
        if (stored) {
            sessionStorage.removeItem('kiko-prefill-prompt');
            setInput(stored);
            setTimeout(() => textareaRef.current?.focus(), 80);
        }

        // 2. Also listen via event for when component is already mounted
        const handler = (e: Event) => {
            const prompt = (e as CustomEvent<{ prompt: string }>).detail?.prompt;
            if (prompt) {
                setInput(prompt);
                setTimeout(() => textareaRef.current?.focus(), 50);
            }
        };
        window.addEventListener('kiko-prefill-input', handler);
        return () => window.removeEventListener('kiko-prefill-input', handler);
    }, []);

    // Context Gathering (Handled by Hook now)

    // Intent Detection (Handled by Hook)

    const handleKeyDown = (e: React.KeyboardEvent) => {
        const isCurrentlyComposing = isComposing || (e.nativeEvent as unknown as { isComposing?: boolean }).isComposing;

        if (e.key === 'Enter' && !e.shiftKey) {
            // 1. Check if we're currently in IME composition
            if (isCurrentlyComposing) {
                return; // Let IME handle it
            }

            // 2. Check if composition JUST ended (within 100ms)
            // Some browsers (like Safari) might fire a KeyDown for Enter immediately after compositionEnd
            if (Date.now() - lastCompositionEndRef.current < 100) {
                e.preventDefault();
                return;
            }

            if (isBusy || isStopping) {
                e.preventDefault();
                return;
            }

            e.preventDefault();
            handleSend();
        }
    };

    const handleCompositionStart = () => {
        setIsComposing(true);
    };

    const handleCompositionEnd = () => {
        // Track the exact time composition ended
        lastCompositionEndRef.current = Date.now();
        // Delay clearing the state slightly to ensure any trailing KeyDown events are caught
        setTimeout(() => {
            setIsComposing(false);
        }, 50);
    };

    // Auto-resize textarea like ChatGPT/Gemini
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        resumeSuggestions();
        setInput(newValue);
        autoResizeTextarea(e.target);
        detectIntent(newValue);
    };

    const autoResizeTextarea = (textarea: HTMLTextAreaElement) => {
        // Reset height to auto to get the correct scrollHeight
        textarea.style.height = 'auto';
        // Set new height based on content, with min and max limits (5 lines max = ~120px)
        const newHeight = Math.min(Math.max(textarea.scrollHeight, 24), 120);
        textarea.style.height = `${newHeight}px`;

        // Update message list padding to ensure content is not hidden behind input
        // Base padding needs to account for: input area + action buttons (~40px extra)
        if (scrollContainerRef.current) {
            requestAnimationFrame(() => {
                syncScrollPaddingWithComposer();
            });
        }
    };

    // Auto-resize when input is set programmatically (e.g., from AI analyze or suggestions)
    useEffect(() => {
        if (textareaRef.current && input) {
            autoResizeTextarea(textareaRef.current);
        }
        if (!input) {
            requestAnimationFrame(() => syncScrollPaddingWithComposer());
        }
    }, [input, syncScrollPaddingWithComposer]);

    // Use propPendingPrompt or local state logic
    useEffect(() => {
        if (propPendingPrompt) {
            setInput(propPendingPrompt);
            if (onAIPromptSet) onAIPromptSet();
        }
    }, [propPendingPrompt]);

    // Handle pending AI prompt from other pages (legacy prop cleanup)
    useEffect(() => {
        // Handled via kiko-auto-send window event now (see above)
    }, []);

    // Feedback handler lifted to parent to persist state across remounts
    const handleMessageFeedback = useCallback((messageId: string, feedback: 'like' | 'dislike' | null) => {
        const updated = messages.map(msg =>
            msg.id === messageId ? { ...msg, feedback } : msg
        );
        if (conversationId) updateConversation(conversationId, updated);
    }, [messages, conversationId, updateConversation]);

    // Process messages with strategy data - MOVED to top level to avoid conditional hook call
    const enrichedMessages = useMemo(() => {
        return displayMessages.map(msg => {
            if (msg.type === 'strategy-card' && msg.data?.id) {
                const liveStrat = strategies.find(s => s.id === msg.data.id);
                if (liveStrat) {
                    return { ...msg, data: liveStrat };
                } else {
                    // IMPORTANT: Don't mark as deleted if it was just created (< 30s ago)
                    // This prevents the race condition where the card shows up before the poll returns it
                    const isNew = msg.timestamp && (Date.now() - new Date(msg.timestamp).getTime() < 30000);
                    if (isNew) {
                        return msg;
                    }
                    // Strategy was actually deleted (or didn't load after 30s)
                    return { ...msg, data: { ...msg.data, status: 'deleted' } };
                }
            }
            return msg;
        });
    }, [displayMessages, strategies]);

    return (
        <div className={`${styles.chatContainer} ${styles[resolvedTheme]}`}>


            {/* Hero / Welcome Content with Exit Animation */}
            {/* Hero / Welcome Content with Jelly Exit Animation */}
            {/* Remove mode="wait" to allow overlapping animations (Jelly effect) */}
            <AnimatePresence initial={false}>
                {!(sidebar?.chatStarted ?? false) && (
                    <motion.div
                        key="welcome-screen"
                        initial={{ opacity: 1, y: 0, scale: 1 }}
                        exit={disableChatTransitions ? {
                            opacity: 0,
                            transition: { duration: 0.01 }
                        } : {
                            opacity: 0,
                            y: -120,    // Move up significantly
                            scale: 0.95, // Slight shrink
                            filter: "blur(10px)", // Blur effect for smooth exit
                            pointerEvents: 'none', // Prevent interaction during exit
                            transition: {
                                duration: 0.5,
                                ease: [0.32, 0.72, 0, 1] // Custom ease for "Jelly" feel
                            }
                        }}
                        style={{
                            position: 'absolute', // Absolute position to overlap with chat
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            zIndex: 10 // Above chat until gone
                        }}
                    >
                        <WelcomeScreen onSuggestionClick={handleSend} />
                    </motion.div>
                )}
            </AnimatePresence>

            <ChatMessageList
                chatStarted={sidebar?.chatStarted ?? false}
                disableChatTransitions={disableChatTransitions}
                scrollContainerRef={scrollContainerRef}
                messagesEndRef={messagesEndRef}
                enrichedMessages={enrichedMessages}
                handleScroll={handleScroll}
                thinkingText={thinkingText}
                thinkingStartTime={thinkingStartTime}
                isBusy={isBusy}
                firstSendPending={firstSendPending}
                hasAnyAssistantMessage={hasAnyAssistantMessage}
                hasVisibleAssistantResponse={hasVisibleAssistantResponse}
                walletAddress={walletAddress}
                chainId={chainId}
                conversationId={conversationId}
                selectedModelId={selectedModel?.id}
                onFeedback={handleMessageFeedback}
                onCardAction={(action, data, msg) => {
                    if (action === 'swap-cancel') {
                        const updated = messages.map(m =>
                            m.id === msg.id ? { ...m, transactionStatus: 'cancelled' as const } : m
                        );
                        if (conversationId) updateConversation(conversationId, updated);
                    } else if (action === 'swap-success') {
                        const txHash = (data as { txHash: string }).txHash;
                        const updated = messages.map(m =>
                            m.id === msg.id ? {
                                ...m,
                                transactionStatus: 'success' as const,
                                transactionHash: txHash
                            } : m
                        );
                        if (conversationId) updateConversation(conversationId, updated);
                    } else if (action === 'swap-error') {
                        const updated = messages.map(m =>
                            m.id === msg.id ? { ...m, transactionStatus: 'failed' as const } : m
                        );
                        if (conversationId) updateConversation(conversationId, updated);
                    } else if (action === 'strategy-delete') {
                        const strategyId = data as string;
                        deleteStrategy(strategyId);
                        const updated = messages.map(m =>
                            m.type === 'strategy-card' && m.data?.id === strategyId
                                ? { ...m, type: 'text' as const, data: undefined }
                                : m
                        );
                        if (conversationId) updateConversation(conversationId, updated);
                    } else if (action === 'strategy-toggle') {
                        const strategyId = data as string;
                        toggleStrategyStatus(strategyId);
                        const updated = messages.map(m => {
                            if (m.type === 'strategy-card' && m.data?.id === strategyId) {
                                const newStatus = m.data.status === 'active' ? 'paused' : 'active';
                                return { ...m, data: { ...m.data, status: newStatus } };
                            }
                            return m;
                        });
                        if (conversationId) updateConversation(conversationId, updated);
                    }
                }}
            />

            <ChatComposer
                chatStarted={sidebar?.chatStarted ?? false}
                disableChatTransitions={disableChatTransitions}
                showJumpToBottom={showJumpToBottom}
                showSuggestions={showSuggestions}
                suggestions={suggestions}
                input={input}
                selectedModel={selectedModel}
                isModelDropdownOpen={isModelDropdownOpen}
                isBusy={isBusy}
                isStopping={isStopping}
                inputTop={safariKeyboard.inputTop}
                isKeyboardVisible={safariKeyboard.isKeyboardVisible}
                textareaRef={textareaRef}
                inputAreaRef={inputAreaRef}
                modelSelectorRef={modelSelectorRef}
                closeSuggestions={closeSuggestions}
                onScrollToBottom={() => scrollToBottom()}
                onSelectSuggestion={(item: SuggestionItem) => {
                    item.action();
                    textareaRef.current?.focus();
                }}
                onInputChange={handleInputChange}
                onInputKeyDown={handleKeyDown}
                onInputFocus={handleInputFocus}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
                onToggleModelDropdown={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                onSelectModel={(model) => {
                    setSelectedModelAndPersist(model);
                    setIsModelDropdownOpen(false);
                    logger.debug('Model changed to:', model.id);
                }}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onPrimaryAction={() => isBusy ? stopGeneration() : handleSend()}
            />

            <CustomAISettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />



        </div >
    );
};
