import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ArrowDown, ChevronDown, Settings } from 'lucide-react';
import { LiquidGlassEffect } from '../Effects/LiquidGlassEffect';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate, useLocation } from 'react-router-dom';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import type { WalletWithMetadata } from '@privy-io/react-auth';
import { MessageBubble } from './MessageBubble';
import { toast } from '../Toast';
import { WelcomeScreen } from './WelcomeScreen';
import { CustomAISettingsModal } from './CustomAISettingsModal';
import { ChatInputSuggestions } from './ChatInputSuggestions';
import { ThinkingTimer } from './ThinkingTimer';
import { useSmartSuggestions } from './useSmartSuggestions.tsx';
import { useSidebar } from '../Layout/Layout';
import { useThemeContext } from '../../contexts/ThemeContext';

// Use global ChainContext for app-wide chain state
import { useChain } from '../../contexts/ChainContext';
import { extractStrategiesFromMessages } from '../../utils/strategyExtractor';
import { useStrategies } from '../../hooks/useStrategies';
import { useSafariKeyboardFix } from '../../hooks/useSafariKeyboardFix';
import styles from './Chat.module.css';
import clsx from 'clsx';
import { chatApi } from '../../services/api';
import { getWalletBalance } from '../../services/walletApi';
import { chatWSClient, type ChatEvent } from '../../utils/chatWebSocket';
import { clearActiveTask } from '../../utils/taskLifecycle';
import type { Message } from '../../hooks/useConversations';
import { useConversationContext } from '../../contexts/ConversationContext';
import { moderationService } from '../../services/moderation';
import { logger } from '../../utils/logger';
import { resolveCoreApiBase } from '../../utils/coreApiBase';
import { agentAttrs } from '../../agent/attrs';
import { getStoredSlippageBps } from '@/config/slippageConfig';

// Model options
// DeepSeek models:
// - deepseek-chat: DeepSeek-V3.2 (non-thinking)
// - deepseek-reasoner: DeepSeek-V3.2 (thinking)
// GPT models:
// - gpt-5-mini: ChatGPT-5-mini (thinking)
// X.ai (Grok) models:
// - grok-4-1-fast-reasoning: Grok-4.1 Fast (Reasoning mode) - for complex multi-step workflows
// - grok-4-1-fast-non-reasoning: Grok-4.1 Fast (Non-reasoning mode) - for fast chat, brainstorming
const MODEL_OPTIONS = [
    { id: 'deepseek-chat', name: 'DeepSeek-V3.2', mode: 'fast' },
    { id: 'deepseek-reasoner', name: 'DeepSeek-V3.2', mode: 'thinking' },
    { id: 'gpt-5-mini', name: 'ChatGPT-5-mini', mode: 'thinking' },
    { id: 'grok-4-1-fast-reasoning', name: 'Grok-4.1-Fast', mode: 'thinking' },
    { id: 'grok-4-1-fast-non-reasoning', name: 'Grok-4.1-Fast', mode: 'fast' },
];

const CORE_API_BASE_URL = resolveCoreApiBase();

// Common token addresses by chain with decimals
const COMMON_TOKENS: Record<number, Array<{ address: string; symbol: string; decimals: number }>> = {
    1: [
        { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6 },
        { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', decimals: 6 },
        { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI', decimals: 18 },
    ],
    8453: [
        { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', decimals: 6 },
        { address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', symbol: 'USDbC', decimals: 6 }, // Bridged USDC (common on Base)
        { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', decimals: 18 },
    ],
    56: [
        { address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', symbol: 'BUSD', decimals: 18 },
    ],
};

interface TaskState {
    id: string;
    status: string;
    [key: string]: unknown;
}

type PendingChunk = {
    content: string;
    reasoning: string;
};

interface ChatInterfaceProps {
    // Props are now optional as data comes mostly from Context/Router
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

const ACTION_CARD_TYPE_MAP: Record<string, 'text' | 'strategy-card' | 'chart-card' | 'transaction-status-card'> = {
    show_strategy_card: 'strategy-card',
    show_chart_card: 'chart-card',
    show_transaction_status_card: 'transaction-status-card',
    show_cross_chain_status_card: 'transaction-status-card',
};

// Helper to extract EVM addresses from text
const extractAddresses = (text: string): string[] => {
    // Regex for EVM address (0x followed by 40 hex chars)
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

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
    // Legacy props for backward compatibility or testing
    // conversationId: propId,
    initialMessages = [],
    // onMessagesChange, 
    // onNewConversation: propOnNewConversation,
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
    const { currentChain, switchChain } = useChain();
    const { strategies, refreshUserStrategies, deleteStrategy, toggleStrategyStatus, createStrategy } = useStrategies();
    const sidebar = useSidebar();
    const { resolvedTheme } = useThemeContext();
    const safariKeyboard = useSafariKeyboardFix();

    const chainId = currentChain.id;

    const params = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    // Route is the source of truth for chat context.
    // On "/" we must never inherit a stale activeConversationId (iOS Safari background restore issue).
    const routeConversationId = params.conversationId || null;
    const isChatRoute = location.pathname.startsWith('/chat/');
    const conversationId = isChatRoute ? (routeConversationId || activeConversationId || null) : null;

    // Get current conversation from context
    const currentConv = conversations.find(c => c.id === conversationId);

    // Derived messages state
    const messages = currentConv?.messages || initialMessages;

    // Synchronous ref for any logic that needs it
    const messagesRef = useRef<Message[]>(messages);
    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    // Derived streaming states from message + task state.
    // Do NOT require activeTask for streaming detection, otherwise a premature
    // task_status:done can briefly hide Thinking while chunks are still arriving.
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


    // Get wallet address based on current chain (Solana vs EVM)
    // If on Solana (900), try to find Solana embedded wallet first
    const walletAddress = useMemo(() => {
        if (currentChain.id === 900) {
            // Priority: User's linked Solana embedded wallet
            const solLink = user?.linkedAccounts?.find(
                (acc): acc is WalletWithMetadata => acc.type === 'wallet' && acc.chainType === 'solana' && acc.walletClientType === 'privy'
            );
            if (solLink) return solLink.address;

            // Fallback: any Solana wallet from useWallets()
            const solWallet = wallets.find(w => w.walletClientType === 'solana');
            return solWallet?.address || '';
        }
        // Default to EVM priority
        // Prioritize embedded wallet if possible
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
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [welcomePendingMessages, setWelcomePendingMessages] = useState<Message[]>([]);
    const hasAssistantTextMessage = useMemo(
        () => messages.some(m => m.role === 'assistant' && (!m.type || m.type === 'text')),
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
                const found = MODEL_OPTIONS.find(m => m.id === parsed.id);
                if (found) {
                    return found;
                }
            }
        } catch (e) {
            logger.warn('Failed to load saved model from localStorage:', e);
        }
        return MODEL_OPTIONS[0];
    };

    const [selectedModel, setSelectedModel] = useState(getInitialModel);

    // Suggestions State (Managed by Hook)
    const {
        suggestions,
        showSuggestions,
        detectIntent,
        closeSuggestions
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

    const flushPendingChunks = useCallback(() => {
        // Deprecated: Chunks are now handled globally by RootLayout.
        pendingChunksRef.current.clear();
    }, []);

    const scheduleChunkFlush = useCallback(() => {
        // Deprecated
    }, []);

    const disableChatTransitions = true;

    // Sync Farcaster FID to backend
    useEffect(() => {
        const syncFarcasterProfile = async () => {
            if (!user) return;

            const farcasterAccount = user.linkedAccounts?.find(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (acc: any) => acc.type === 'farcaster' || (acc.type === 'wallet' && acc.chainType === 'farcaster')
            );
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const fid = (farcasterAccount as any)?.fid || (user as any).farcaster?.fid;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const username = (farcasterAccount as any)?.username || (user as any).farcaster?.username;

            if (fid) {
                try {
                    // Check if we already synced (localStorage persists across sessions)
                    const storageKey = `kiko-farcaster-synced-v2-${fid}`;
                    if (localStorage.getItem(storageKey)) return;

                    const authToken = await getAccessToken();
                    const response = await fetch(`${CORE_API_BASE_URL}/api/users/farcaster`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authToken}`
                        },
                        body: JSON.stringify({ fid, username })
                    });

                    if (response.ok) {
                        await response.json(); // Consume body
                        localStorage.setItem(storageKey, 'true'); // Persist across sessions
                        logger.debug('[ChatInterface] Synced Farcaster profile:', { fid, username });
                    } else {
                        const errorText = await response.text();
                        logger.warn('[ChatInterface] Failed to sync Farcaster profile:', { status: response.status, error: errorText });
                    }
                } catch (error) {
                    logger.warn('[ChatInterface] Failed to sync Farcaster profile:', error);
                }
            }
        };

        syncFarcasterProfile();
    }, [user]);

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
                        if (targetChainId) {
                            switchChain(targetChainId);
                            toast.success(`Switching to ${actionData.chainName || 'target chain'}...`);
                        }
                        break;
                    }

                    if (normalizedAction.type === 'execute_swap_instant') {
                        // DIRECT SERVER EXECUTION - NO UI CARD
                        // This bypasses SwapCard completely for instant/allowance trades
                        const actionData = normalizedAction.payload || normalizedAction.data;
                        const targetChainId = actionData.chainId || actionData.chain_id || chainId;

                        // Helper to resolve token address from symbol or object
                        const resolveTokenAddress = (symbolOrObj: string | { address?: string; symbol?: string; name?: string } | null | undefined): string => {
                            if (!symbolOrObj) return '';

                            // If it's an object with address, use that
                            if (typeof symbolOrObj === 'object' && symbolOrObj.address) {
                                return symbolOrObj.address;
                            }

                            const value = typeof symbolOrObj === 'string' ? symbolOrObj : symbolOrObj?.symbol;
                            if (!value) return '';

                            // 1. Check if it's an EVM address
                            if (value.startsWith('0x') && value.length === 42) {
                                return value;
                            }

                            // 2. Check if it's a Solana address (Base58, 32-44 chars)
                            // Basic regex for Base58 (alphanumeric, no 0, O, I, l)
                            if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) {
                                return value;
                            }

                            // 3. Handle native tokens
                            if (['ETH', 'BNB', 'MATIC', 'POL', 'AVAX', 'SOL'].includes(value.toUpperCase())) {
                                // For Solana, use WSOL or native mint depending on implementation
                                // But frontend usually handles 'SOL' specially
                                if (value.toUpperCase() === 'SOL') return 'So11111111111111111111111111111111111111112';
                                return '0x0000000000000000000000000000000000000000';
                            }

                            // 4. Lookup in COMMON_TOKENS
                            const common = COMMON_TOKENS[targetChainId]?.find(t => t.symbol === value);
                            if (common) return common.address;

                            // 5. Fallback: If it looks like it MIGHT be an address (even if regex failed slightly), return it
                            // This prevents "OG92" from being treated as address if it's clearly too short,
                            // but allows potential non-standard addresses through.
                            // However, we must be careful not to return symbols as addresses.
                            if (value.length > 30) {
                                return value;
                            }

                            return '';
                        };

                        const tokenInAddress = resolveTokenAddress(actionData.tokenIn || actionData.token_in);
                        const tokenOutAddress = resolveTokenAddress(actionData.tokenOut || actionData.token_out);
                        const amountIn = actionData.amountIn || actionData.amount_in;
                        const slippageBps = actionData.slippageBps ?? actionData.slippage_bps ??
                            (actionData.slippage ? Math.round(Number(actionData.slippage) * 100) : getStoredSlippageBps());

                        logger.debug('Executing instant swap:', {
                            tokenIn: tokenInAddress,
                            tokenOut: tokenOutAddress,
                            amountIn,
                            chainId: targetChainId,
                            slippageBps
                        });

                        // CREATE NEW MESSAGE for transaction status
                        const getSymbol = (token: string | { symbol?: string; name?: string } | null | undefined): string => {
                            if (typeof token === 'string') {
                                const t = token.trim();
                                if (/^0x[eE]{40}$/.test(t)) return 'ETH';
                                if (/^0x[0-9a-fA-F]{40}$/.test(t)) return `${t.slice(0, 6)}...${t.slice(-4)}`;
                                return t;
                            }
                            return token?.symbol || token?.name || 'Unknown';
                        };

                        const targetMessageId = event.data?.message_id || event.data?.messageId || `tx-${Date.now()}`;
                        const txCardMsg: Message = {
                            id: targetMessageId,
                            role: 'assistant',
                            content: '',
                            reasoning_content: '',
                            status: 'complete',
                            timestamp: new Date().toISOString(),
                            type: 'transaction-status-card',
                            data: {
                                status: 'building',  // Start with building state
                                tokenInSymbol: getSymbol(actionData.tokenIn || actionData.token_in),
                                tokenOutSymbol: getSymbol(actionData.tokenOut || actionData.token_out),
                                amountIn: String(amountIn),
                                chainId: targetChainId,
                                isLoading: true
                            }
                        };

                        if (conversationId) {
                            const currentMessages = messagesRef.current;
                            const idx = currentMessages.findIndex(m => m.id === targetMessageId);
                            let updated: Message[];
                            if (idx >= 0) {
                                updated = currentMessages.map((m, i) => i === idx ? { ...m, ...txCardMsg } : m);
                            } else {
                                updated = [...currentMessages, txCardMsg];
                            }
                            messagesRef.current = updated;
                            // card_displayed: activeTask cleared with messages
                            updateConversation(conversationId, {
                                messages: updated,
                                activeTask: null
                            });
                        }

                        const patchTransactionCard = (patch: Record<string, unknown>) => {
                            if (!conversationId) return;
                            const currentMessages = messagesRef.current;
                            const idx = currentMessages.findIndex(m => m.id === targetMessageId);
                            if (idx === -1) return;
                            const current = currentMessages[idx];
                            const nextMessage: Message = {
                                ...current,
                                type: 'transaction-status-card',
                                data: {
                                    ...(current.data || {}),
                                    ...patch,
                                },
                            };
                            const updated = replaceMessageAtIndex(currentMessages, idx, nextMessage);
                            updateConversation(conversationId, { messages: updated });
                        };

                        // Call executeSwapInstant directly
                        import('../../services/swapService').then(({ executeSwapInstant }) => {
                            // Update to sending state before API call
                            patchTransactionCard({ status: 'sending' });

                            // Start swap execution
                            const swapPromise = executeSwapInstant({
                                tokenIn: tokenInAddress,
                                tokenOut: tokenOutAddress,
                                amountIn: String(amountIn),
                                chainId: targetChainId,
                                slippageBps
                            });

                            // Update to pending immediately - backend is now waiting for on-chain confirmation
                            patchTransactionCard({ status: 'pending' });

                            swapPromise.then(result => {
                                if (result.success && result.txHash) {
                                    // Find the transaction card we created and update it
                                    patchTransactionCard({
                                        status: 'success',
                                        txHash: result.txHash,
                                        isLoading: false,
                                    });
                                } else {
                                    // Update with error
                                    patchTransactionCard({
                                        status: 'failed',
                                        errorMessage: result.error,
                                        isLoading: false,
                                    });
                                }
                            }).catch(err => {
                                // Update with error
                                patchTransactionCard({
                                    status: 'failed',
                                    errorMessage: err.message,
                                    isLoading: false,
                                });
                            });
                        });


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
                    } else if (['show_chart_card', 'show_transaction_status_card', 'show_cross_chain_status_card'].includes(normalizedAction.type)) {
                        const targetMessageId = event.data.targetMessageId || event.data.message_id || event.data.messageId;
                        const actionType = normalizedAction.type;
                        const actionData = normalizedAction.data || normalizedAction.payload || {};
                        const newCardType = ACTION_CARD_TYPE_MAP[actionType] || 'text';

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
                                    data: { ...existingData, ...actionData }
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
                            // card_displayed: activeTask cleared with messages
                            updateConversation(conversationId, {
                                messages: updated,
                                activeTask: null
                            });
                        }
                    }
                    break;
                }
                case 'content_block':
                    if (conversationId) {
                        const blockMessageId = event.data.message_id || event.data.messageId;
                        const freshMsgs = messagesRef.current;
                        const updated = freshMsgs.map(m => m.id === blockMessageId ? {
                            ...m, content: (m.content || '') + (event.data.content || '')
                        } : m);
                        updateConversation(conversationId, {
                            messages: updated,
                            activeTask: event.data.is_final ? null : currentConv?.activeTask
                        });
                    }
                    break;
                case 'transaction_update':
                case 'transaction_confirmed':
                case 'transaction_complete':
                    // Handled by updating context
                    if (conversationId && (event.data.messageId || event.data.message_id)) {
                        const mid = event.data.messageId || event.data.message_id;
                        const freshMsgs = messagesRef.current;
                        const updated = freshMsgs.map(m => {
                            if (m.id === mid && m.type === 'transaction-status-card') {
                                return {
                                    ...m,
                                    data: {
                                        ...m.data,
                                        ...event.data,
                                        isLoading: !['transaction_complete', 'transaction_confirmed'].includes(event.type) && !['success', 'failed'].includes(event.data.status)
                                    }
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
                    const found = MODEL_OPTIONS.find(m => m.id === parsed.id);
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
            const found = MODEL_OPTIONS.find(m => m.id === newModel.id);
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

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const isAtBottomRef = useRef(true);
    const userScrolledUpRef = useRef(false);
    const lastScrollTopRef = useRef<number>(0);
    const justSwitchedConversationRef = useRef(false);
    const isSendingRef = useRef(false); // Flag to prevent stopGeneration during active send

    const scrollToBottom = useCallback((smooth = true) => {
        if (scrollContainerRef.current) {
            const { scrollHeight, clientHeight } = scrollContainerRef.current;
            scrollContainerRef.current.scrollTo({
                top: scrollHeight - clientHeight,
                behavior: smooth ? 'smooth' : 'auto',
            });
        }
    }, []);

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
        setFirstSendPending(false);
        setInput('');
        const hasMessages = (currentConv?.messages?.length ?? initialMessages.length) > 0;
        sidebar?.setChatStarted(!!newId || isLoading || isSendingRef.current || hasMessages);
        processedMessagesRef.current.clear();
        processedStrategyIdsRef.current.clear();
        currentConversationIdRef.current = newId || null;
        if (onTaskUpdate) onTaskUpdate(null);
        initialMessages.forEach(msg => processedMessagesRef.current.add(msg.id));
        justSwitchedConversationRef.current = true;
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
        if (firstSendPending && hasAssistantTextMessage) {
            setFirstSendPending(false);
        }
    }, [firstSendPending, hasAssistantTextMessage]);

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
        // IMPORTANT: If user has scrolled up, NEVER auto-scroll until they scroll back to bottom
        if (userScrolledUpRef.current) {
            return; // Exit early - respect user's scroll position
        }

        // CRITICAL: Don't auto-scroll if user is actively selecting text
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) {
            return; // Exit early - user is selecting text, don't interfere
        }

        if (scrollContainerRef.current && messages.length > 0) {
            // Check if last message is from AI (indicates streaming or recent output)
            const lastMessage = messages[messages.length - 1];
            const isAIMessage = lastMessage?.role === 'assistant';
            const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
            const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
            const isNearBottom = distanceFromBottom < 50;

            // Auto-scroll if: streaming and user at bottom, OR after streaming and user at bottom
            const shouldScroll = isNearBottom || (isStreaming && isAIMessage);

            if (shouldScroll) {
                requestAnimationFrame(() => {
                    // Double-check user hasn't scrolled up or started selecting during the frame
                    const currentSelection = window.getSelection();
                    if (scrollContainerRef.current && !userScrolledUpRef.current &&
                        (!currentSelection || currentSelection.toString().length === 0)) {
                        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
                        isAtBottomRef.current = true;
                        lastScrollTopRef.current = scrollContainerRef.current.scrollTop;
                        // DO NOT reset userScrolledUpRef here - only handleScroll should do that
                    }
                });
            }
        }
    }, [messages, isThinking, isStreaming]);

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
        scrollToBottom();
        // Only trigger suggestions if there is input (user preference: strictly on matching)
        if (input && input.trim().length > 0) {
            detectIntent(input);
        }
    };

    // silentMode: if true, doesn't trigger visual stopping state (for conversation switches)
    const stopGeneration = async (silentMode = false) => {
        if (!isThinking && !isStreaming && !firstSendPending) return;

        if (firstSendPending && !isThinking && !isStreaming) {
            setFirstSendPending(false);
            return;
        }

        if (!silentMode) {
            setIsStopping(true);
        }

        if (conversationId) {
            clearActiveTask(conversationId, updateConversation, 'user_stop');
        }

        if (activeTaskId) {
            try {
                await chatApi.stopTask(activeTaskId);
            } catch (err) {
                logger.error('Failed to stop task:', err);
            }
        }

        setTimeout(() => setIsStopping(false), 300);
    };



    // Flag to prevent double submission (race condition)
    const isSubmittingRef = useRef(false);

    // Always-fresh ref so event listeners can call handleSend without stale closure
    const handleSendRef = useRef<(text: string) => void>(() => { });

    const handleSend = async (text: string = input, existingMessageId?: string) => {
        if (!authenticated) {
            toast.info('Login to KIKO to start chatting.');
            try {
                login();
            } catch (e) {
                logger.warn('Failed to trigger login:', e);
            }
            return;
        }
        if (isSubmittingRef.current) return;
        if (!text.trim()) return;

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
        stopGeneration(true);

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
        if (closeSuggestions) closeSuggestions();

        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }

        // 5. Scroll to bottom
        userScrolledUpRef.current = false;
        isAtBottomRef.current = true;
        setTimeout(() => scrollToBottom(false), 0);

        let currentConvId = conversationId;

        try {
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

            // Get the latest model selection
            let modelToUse = selectedModel;
            try {
                const saved = localStorage.getItem('kiko-selected-model');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    const found = MODEL_OPTIONS.find(m => m.id === parsed.id);
                    if (found) {
                        modelToUse = found;
                        if (found.id !== selectedModel.id) {
                            setSelectedModel(found);
                        }
                    }
                }
            } catch (e) {
                logger.warn('Failed to read model from localStorage:', e);
            }

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
                farcaster: null,
            };
            const resp = await chatApi.sendMessage(currentConvId, text, {
                model: modelToUse.id,
                walletAddress: walletAddress,
                chainId: chainId,
                toolConfig: customSettings,
                allowanceMode: 'instant',
                nativeBalance,
                currentPage: window.location.pathname,
                pageContext: `${document.title || 'KiKo'} | ${window.location.pathname}`,
                balance: userBalances,
                context: contextPayload,
            });

            if (resp.success) {
                const { assistantMessage, task } = resp;

                // Add assistant message placeholder
                const createdAt = (assistantMessage as any).created_at ?? assistantMessage.timestamp ?? Date.now();
                const aiMsg: Message = {
                    id: assistantMessage.id,
                    role: 'assistant',
                    content: '',
                    reasoning_content: '',
                    timestamp: new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    date: new Date(createdAt).toISOString().split('T')[0],
                    type: 'text',
                    status: 'streaming',
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
        // Don't send if user is composing text with IME (input method editor)
        // Check BOTH the state and the native event property for maximum compatibility
        const isCurrentlyComposing = isComposing || (e.nativeEvent as unknown as { isComposing?: boolean }).isComposing;

        if (e.key === 'Enter' && !e.shiftKey) {
            // If composing with IME, completely block Enter key and don't proceed
            if (isCurrentlyComposing) {
                e.preventDefault();
                return;
            }
            // Prevent sending while thinking, streaming, or stopping
            if (isBusy || isStopping) {
                e.preventDefault();
                logger.debug('Blocked Enter - AI is busy');
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
        // Clear composition state immediately when IME composition ends
        // The onKeyDown handler will check the native event's isComposing property anyway
        setIsComposing(false);
    };

    // Auto-resize textarea like ChatGPT/Gemini
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setInput(newValue);
        autoResizeTextarea(e.target);

        // Trigger intent detection
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
            const extraHeight = Math.max(0, newHeight - 24);
            scrollContainerRef.current.style.paddingBottom = `${140 + extraHeight}px`;
        }
    };

    // Auto-resize when input is set programmatically (e.g., from AI analyze or suggestions)
    useEffect(() => {
        if (textareaRef.current && input) {
            autoResizeTextarea(textareaRef.current);
        }
        // Reset padding when input is cleared
        if (!input && scrollContainerRef.current) {
            scrollContainerRef.current.style.paddingBottom = '140px';
        }


        if (input.length > 0) {
            console.log('[ChatInterface] Calling detectIntent with:', input);
            detectIntent(input);
            // Re-focus to ensure next step works
            setTimeout(() => textareaRef.current?.focus(), 0);
        }
    }, [input, detectIntent]);

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

    // const prompts = [ // Unused for now
    //     { label: 'Analyze ETH', desc: 'Price, volume, and risk analysis' },
    //     { label: 'Gas Price', desc: 'Current gas fees on Ethereum' },
    //     { label: 'Top Gainers', desc: 'Tokens with highest 24h change' },
    //     { label: 'DeFi Yields', desc: 'Best stablecoin APYs' },
    // ];


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

            {/* Message List - Always rendered, transitions via CSS classes */}
            <div
                className={clsx(
                    styles.messageList,
                    !(sidebar?.chatStarted ?? false) && styles.messageListHidden, // Hide when welcome screen is active
                    !disableChatTransitions && (sidebar?.chatStarted ?? false) && styles.chatUiEnter // Animate in when started
                )}
                ref={scrollContainerRef}
                onScroll={handleScroll}
            >
                {/* Find the last text-type assistant message for thinking indicator */}
                {(() => {
                    // Find the ID of the last text-type assistant message
                    const lastTextAssistantId = [...enrichedMessages]
                        .reverse()
                        .find(m => m.role === 'assistant' && (!m.type || m.type === 'text'))?.id;

                    return enrichedMessages.map((msg, index, enrichedMessages) => {
                        const isGrouped = index > 0 && enrichedMessages[index - 1].role === msg.role;
                        const prevMsg = index > 0 ? enrichedMessages[index - 1] : null;
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
                                    thinkingText={
                                        // Only show thinking on the LAST text-type assistant message
                                        // AND only when there is actually an active task (isThinking/isStreaming).
                                        // Without the isBusy guard, bypass flows that leave content empty
                                        // show "Thinking" indefinitely after task_status:done clears activeTask.
                                        msg.role === 'assistant' &&
                                            msg.id === lastTextAssistantId &&
                                            (!msg.type || msg.type === 'text') &&
                                            isBusy
                                            ? thinkingText
                                            : undefined
                                    }
                                    thinkingStartTime={thinkingStartTime}
                                    userAddress={walletAddress}
                                    chainId={chainId}
                                    sessionId={conversationId || undefined}
                                    modelId={selectedModel?.id} // Pass current model for pricing calculation
                                    onFeedback={handleMessageFeedback}
                                    onCardAction={(action, data) => {
                                        if (action === 'swap-cancel') {
                                            // Update transaction status to cancelled
                                            const updated = messages.map(m =>
                                                m.id === msg.id ? {
                                                    ...m,
                                                    transactionStatus: 'cancelled' as const
                                                } : m
                                            );
                                            if (conversationId) updateConversation(conversationId, updated);
                                        } else if (action === 'swap-success') {
                                            // Update transaction status to success
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
                                            // Update transaction status to failed
                                            const updated = messages.map(m =>
                                                m.id === msg.id ? {
                                                    ...m,
                                                    transactionStatus: 'failed' as const
                                                } : m
                                            );
                                            if (conversationId) updateConversation(conversationId, updated);
                                        } else if (action === 'strategy-edit') {
                                            // Navigate to trade page or open edit modal
                                        } else if (action === 'strategy-delete') {
                                            const strategyId = data as string;
                                            deleteStrategy(strategyId);
                                            // Remove strategy card from message
                                            const updated = messages.map(m => {
                                                if (m.type === 'strategy-card' && m.data?.id === strategyId) {
                                                    return {
                                                        ...m,
                                                        type: 'text' as const,
                                                        data: undefined
                                                    };
                                                }
                                                return m;
                                            });
                                            if (conversationId) updateConversation(conversationId, updated);
                                        } else if (action === 'strategy-toggle') {
                                            const strategyId = data as string;
                                            toggleStrategyStatus(strategyId);

                                            // Also update the message data locally to reflect the UI change immediately
                                            const updated = messages.map(m => {
                                                if (m.type === 'strategy-card' && m.data?.id === strategyId) {
                                                    const newStatus = m.data.status === 'active' ? 'paused' : 'active';
                                                    return {
                                                        ...m,
                                                        data: { ...m.data, status: newStatus }
                                                    };
                                                }
                                                return m;
                                            });
                                            if (conversationId) updateConversation(conversationId, updated);
                                        } else if (action === 'strategy-details') {
                                            // TODO: Navigate to strategy details
                                        }
                                    }}
                                />

                            </React.Fragment>
                        );
                    });
                })()}

                {firstSendPending && !hasAssistantTextMessage && (
                    <div className={styles.thinkingContainer}>
                        <div className={styles.thinkingContent}>
                            <div className={styles.thinkingSpinner} />
                            <ThinkingTimer
                                startTime={thinkingStartTime || Date.now()}
                                status="thinking"
                                text={thinkingText}
                            />
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Area - Only show when conversation has started */}
            {
                (sidebar?.chatStarted ?? false) && (
                    <div
                        className={clsx(styles.inputArea, styles.inputBottom, !disableChatTransitions && styles.chatUiEnterDelayed)}
                        style={safariKeyboard.isKeyboardVisible && safariKeyboard.inputTop !== null ? {
                            bottom: 'auto',
                            top: `${safariKeyboard.inputTop}px`,
                            transform: 'translateY(-100%)',
                        } : undefined}
                    >
                        {/* DEBUG: Render check */}
                        {/* Jump to Bottom Button - positioned at top edge of input */}
                        {showJumpToBottom && (
                            <button
                                className={styles.jumpToBottom}
                                onClick={() => scrollToBottom()}
                                aria-label="Scroll to bottom"
                            >
                                <ArrowDown size={20} />
                            </button>
                        )}
                        <LiquidGlassEffect
                            className={clsx(styles.inputWrapper, showSuggestions && styles.inputWrapperOpen)}
                            enabled={true}
                        >
                            <ChatInputSuggestions
                                suggestions={suggestions}
                                isVisible={showSuggestions}
                                agentId="chat.suggestions.list"
                                onSelect={(item) => {
                                    item.action();
                                    // DO NOT clear suggestions here. 
                                    // The input change will trigger the hook to either:
                                    // 1. Show new suggestions (next step)
                                    // 2. Clear suggestions (if no matches)
                                    textareaRef.current?.focus();
                                }}
                            />
                            <div className={styles.textareaContainer}>
                                <textarea
                                    ref={textareaRef}
                                    className={styles.textArea}
                                    {...agentAttrs({ id: 'chat.input.textarea', role: 'input', action: 'select', page: 'chat', key: 'message' })}
                                    placeholder="Ask anything..."
                                    rows={1}
                                    value={input}
                                    onChange={handleInputChange}
                                    onKeyDown={handleKeyDown}
                                    onFocus={handleInputFocus}
                                    onBlur={() => {
                                        // No timeout needed - onMouseDown in suggestions prevents blur for clicks
                                        closeSuggestions();
                                    }}
                                    onCompositionStart={handleCompositionStart}
                                    onCompositionEnd={handleCompositionEnd}
                                />

                                <div className={styles.inputActions}>
                                    <div className={styles.modelSelector} ref={modelSelectorRef}>
                                        <button
                                            className={styles.modelButton}
                                            {...agentAttrs({ id: 'chat.model.toggle', role: 'button', action: 'open', page: 'chat' })}
                                            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                                        >
                                            <span className={styles.modelName}>
                                                {MODEL_OPTIONS.find(m => m.id === selectedModel.id)?.name || selectedModel.name}
                                            </span>
                                            <span className={styles.modelMode}>{selectedModel.mode}</span>
                                            <ChevronDown size={12} className={clsx(styles.chevron, isModelDropdownOpen && styles.chevronOpen)} />
                                        </button>

                                        {isModelDropdownOpen && (
                                            <div className={styles.modelDropdown}>
                                                {MODEL_OPTIONS.map((model) => (
                                                    <button
                                                        key={model.id}
                                                        className={clsx(styles.modelOption, selectedModel.id === model.id && styles.modelOptionActive)}
                                                        {...agentAttrs({ id: `chat.model.option.${model.id}`, role: 'button', action: 'select', page: 'chat', key: 'model_id' })}
                                                        onClick={() => {
                                                            setSelectedModel(model);
                                                            setIsModelDropdownOpen(false);
                                                            logger.debug('Model changed to:', model.id);
                                                        }}
                                                    >
                                                        <span className={styles.modelOptionName}>{model.name}</span>
                                                        <span className={styles.modelOptionMode}>{model.mode}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        className={styles.settingsButton}
                                        {...agentAttrs({ id: 'chat.settings.open', role: 'button', action: 'open', page: 'chat' })}
                                        onClick={() => setIsSettingsOpen(true)}
                                        title="Customize AI"
                                    >
                                        <Settings size={18} />
                                    </button>
                                    <button
                                        className={clsx(
                                            styles.sendBtn,
                                            isBusy && styles.stopMode,
                                            !isBusy && input.trim() && styles.activeMode,
                                            isStopping && styles.stoppingMode
                                        )}
                                        onClick={() => isBusy ? stopGeneration() : handleSend()}
                                        disabled={(!input.trim() && !isBusy) || isStopping}
                                        title={isBusy ? "Stop generation" : "Send message"}
                                        {...agentAttrs({ id: 'chat.action.send', role: 'button', action: 'submit', page: 'chat' })}
                                    >
                                        {/* Aurora Background Effect */}
                                        {isBusy && <div className={styles.auroraLayer} />}

                                        <motion.div
                                            className={styles.btnIcon}
                                            animate={{
                                                scale: isBusy ? 1.1 : 1, // Slightly less aggressive scale with aurora
                                                rotate: isBusy ? 0 : 0,
                                            }}
                                            transition={{
                                                type: "spring",
                                                stiffness: 300,
                                                damping: 15
                                            }}
                                        >
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <motion.path
                                                    initial={false}
                                                    animate={{
                                                        d: isBusy
                                                            ? "M6 6h12v12H6z" // Square (Stop)
                                                            : "M12 19V5M5 12l7-7 7 7" // Arrow Up (Send)
                                                    }}
                                                    transition={{
                                                        type: "spring",
                                                        stiffness: 200,
                                                        damping: 20
                                                    }}
                                                />
                                            </svg>
                                        </motion.div>
                                        {isBusy && (
                                            <div className={styles.spinnerRing} />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </LiquidGlassEffect>
                    </div>
                )
            }

            <CustomAISettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />



        </div >
    );
};
