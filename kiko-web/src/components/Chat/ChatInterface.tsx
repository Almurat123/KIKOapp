import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ArrowDown, ChevronDown, Settings, ArrowUp } from 'lucide-react';
import { LiquidGlassEffect } from '../Effects/LiquidGlassEffect';
import { motion, AnimatePresence } from 'framer-motion';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import type { WalletWithMetadata } from '@privy-io/react-auth';
import { DelegatedActionRequest } from '../Privy/DelegatedActionRequest';
import { MessageBubble } from './MessageBubble';
import { toast } from '../Toast';
import { WelcomeScreen } from './WelcomeScreen';
import { CustomAISettingsModal } from './CustomAISettingsModal';
import { ChatInputSuggestions } from './ChatInputSuggestions';
import { useSmartSuggestions } from './useSmartSuggestions.tsx';
import { useSidebar } from '../Layout/Layout';
import { useThemeContext } from '../../contexts/ThemeContext';
import { FarcasterFollowModal } from './FarcasterFollowModal';
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
import type { Message } from '../../hooks/useConversations';
import { moderationService } from '../../services/moderation';
import { logger } from '../../utils/logger';
import { resolveCoreApiBase } from '../../utils/coreApiBase';

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

interface SwapActionData {
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    chainId: number;
    slippage?: number;
}

type PendingChunk = {
    content: string;
    reasoning: string;
};

interface ChatInterfaceProps {
    conversationId?: string | null;
    initialMessages?: Message[];
    onMessagesChange?: (messages: Message[]) => void;
    onNewConversation?: (title: string) => Promise<string | null>; // Returns new conversation ID
    conversationTitle?: string;
    onNewChat?: () => void;
    pendingAIPrompt?: string | null;
    onAIPromptSet?: () => void;
    activeTask?: TaskState | null; // Active task from backend
    onTaskUpdate?: (task: TaskState | null) => void; // Callback to update task state
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

const findLastAssistantIndex = (messages: Message[]): number => {
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'assistant') return i;
    }
    return -1;
};

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
    conversationId,
    initialMessages = [],
    onMessagesChange,
    onNewConversation,
    pendingAIPrompt,
    onAIPromptSet,
    activeTask: propActiveTask,
    onTaskUpdate,
}) => {

    const sidebar = useSidebar();
    const { resolvedTheme } = useThemeContext();
    const { createStrategy, strategies, toggleStrategyStatus, deleteStrategy, refreshUserStrategies: refreshStrategies } = useStrategies();

    // Safari iOS 26 keyboard fix - provides inputTop when keyboard is open
    const safariKeyboard = useSafariKeyboardFix();

    const { user, authenticated, login, getAccessToken } = usePrivy();
    const { wallets } = useWallets();
    // Use global chain context instead of Wagmi's useChainId
    // this ensures AI knows about selected chain even if wallet is on different chain
    const { currentChain } = useChain();
    const chainId = currentChain.id;
    const [messages, setMessages] = useState<Message[]>(initialMessages);

    // CRITICAL: Keep messagesRef in sync with messages state at all times.
    // This ensures the unmount save (line ~1046) has the latest data when user navigates away.
    const messagesRef = useRef<Message[]>(initialMessages);
    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);


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
    const [isThinking, setIsThinking] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isStopping, setIsStopping] = useState(false);
    const [isLoadingConversation, setIsLoadingConversation] = useState(false);

    const [hasStarted, setHasStartedLocal] = useState(initialMessages.length > 0);
    // showChatUI removed - entirely driven by hasStarted now

    // Wrapper to sync hasStarted with Layout's chatStarted
    const setHasStarted = (value: boolean) => {
        setHasStartedLocal(value);
        sidebar?.setChatStarted(value);
    };
    const [thinkingText, setThinkingText] = useState('Thinking');
    const [showJumpToBottom, setShowJumpToBottom] = useState(false);
    const [isComposing, setIsComposing] = useState(false);
    const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

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
        setInput
    );

    // Delegation state for instant trades (delegation is handled by DelegatedActionRequest component)
    const [showDelegationModal, setShowDelegationModal] = useState(false);
    const [pendingSwapAction, setPendingSwapAction] = useState<SwapActionData | null>(null);

    const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [customSettings, setCustomSettings] = useState<Record<string, unknown> | null>(null);
    const pendingChunksRef = useRef<Map<string, PendingChunk>>(new Map());
    const chunkFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const CHUNK_FLUSH_INTERVAL_MS = 33; // ~30fps, smoother on mobile

    const flushPendingChunks = useCallback(() => {
        if (chunkFlushTimerRef.current) {
            clearTimeout(chunkFlushTimerRef.current);
            chunkFlushTimerRef.current = null;
        }
        const pending = pendingChunksRef.current;
        if (pending.size === 0) return;
        const entries = Array.from(pending.entries());
        pending.clear();

        setMessages(prev => {
            let next = prev;
            for (const [chunkMessageId, payload] of entries) {
                const idx = next.findIndex(m => m.id === chunkMessageId);
                if (idx === -1) {
                    next = [
                        ...next,
                        {
                            id: chunkMessageId,
                            role: 'assistant',
                            content: payload.content,
                            reasoning_content: payload.reasoning,
                            status: 'streaming',
                            timestamp: new Date().toISOString(),
                            type: 'text',
                        } as Message,
                    ];
                    continue;
                }
                const existing = next[idx];
                const updated: Message = {
                    ...existing,
                    content: (existing.content || '') + payload.content,
                    reasoning_content: (existing.reasoning_content || '') + payload.reasoning,
                };
                next = replaceMessageAtIndex(next, idx, updated);
            }
            return next;
        });
    }, []);

    const scheduleChunkFlush = useCallback(() => {
        if (chunkFlushTimerRef.current) return;
        chunkFlushTimerRef.current = setTimeout(() => {
            flushPendingChunks();
        }, CHUNK_FLUSH_INTERVAL_MS);
    }, [flushPendingChunks]);

    // Farcaster Follow Modal state
    const [showFollowModal, setShowFollowModal] = useState(false);

    // showChatUI effect removed as state is gone. Logic is now direct via hasStarted.
    // The previous buffering logic is replaced by CSS animations (messageListHidden/chatUiEnter)

    const handleDismissFollow = () => {
        localStorage.setItem('kiko-farcaster-follow-dismissed', 'true');
        setShowFollowModal(false);
    };

    // Check Farcaster follow status on mount or when user changes
    useEffect(() => {
        const checkFollowStatus = async () => {
            // 1. If already dismissed, don't show
            if (localStorage.getItem('kiko-farcaster-follow-dismissed') === 'true') {
                return;
            }

            // 2. Only show for authenticated users
            if (!authenticated || !user) {
                return;
            }

            // 3. Try to get Farcaster FID from Privy
            const farcasterAccount = user.linkedAccounts?.find(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (acc: any) => acc.type === 'farcaster' || (acc.type === 'wallet' && acc.chainType === 'farcaster')
            );

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const fid = (farcasterAccount as any)?.fid || (user as any).farcaster?.fid;

            if (fid) {
                try {
                    const response = await fetch(`${CORE_API_BASE_URL}/api/social/is-following/${fid}`);
                    const data = await response.json();
                    if (data.success && data.data.isFollowing) {
                        // Already following, mark as dismissed and don't show
                        localStorage.setItem('kiko-farcaster-follow-dismissed', 'true');
                        return;
                    }
                } catch (error) {
                    logger.warn('[ChatInterface] Failed to check Farcaster follow status:', error);
                }
            }

            // 4. If we reached here, they are not following and haven't dismissed
            setShowFollowModal(true);
        };

        checkFollowStatus();
    }, [authenticated, user]);

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
                case 'chunk':
                    // Defensive check against malformed payloads
                    if (!event.data) {
                        logger.warn('Received chunk without data:', event);
                        break;
                    }
                    {
                        // Database returns snake_case field names
                        const chunkMessageId = event.data.message_id || event.data.messageId;
                        if (!chunkMessageId) break;

                        const deltaContent = event.data.content || '';
                        const deltaReasoning = event.data.reasoning_content || '';
                        const existing = pendingChunksRef.current.get(chunkMessageId) || { content: '', reasoning: '' };
                        existing.content += deltaContent;
                        existing.reasoning += deltaReasoning;
                        pendingChunksRef.current.set(chunkMessageId, existing);
                        const pendingChars = (existing.content?.length || 0) + (existing.reasoning?.length || 0);
                        if (pendingChars >= 160) {
                            flushPendingChunks();
                        } else {
                            scheduleChunkFlush();
                        }

                        if (deltaContent.length > 0) {
                            setIsThinking(false);
                            setIsStreaming(true);
                        } else if (deltaReasoning.length > 0) {
                            setThinkingText('Thinking');
                        }
                    }
                    break;
                case 'task_status': {
                    // CRITICAL: Only trigger thinking for text-type tasks, not card/swap tasks
                    // taskType defaults to 'text' for backward compatibility
                    const taskType = event.data.taskType || 'text';

                    if ((event.data.status === 'running' || event.data.status === 'pending') && taskType === 'text') {
                        setIsThinking(true);
                        setThinkingText(event.data.message || 'Thinking');
                        setActiveTaskId(event.data.taskId || null);
                        // CRITICAL: Only update task if we have a valid taskId
                        // This prevents setting propActiveTask to { id: undefined, status: 'running' }
                        // which would cause the UI state restoration to keep resetting isThinking
                        if (onTaskUpdate && event.data.taskId) {
                            onTaskUpdate({ id: event.data.taskId, status: event.data.status });
                        }
                        if (sidebar?.setGeneratingConversationId) {
                            sidebar.setGeneratingConversationId(conversationId || null);
                        }
                    } else if (event.data.status === 'done') {
                        setIsThinking(false);
                        setIsStreaming(false);
                        setActiveTaskId(null);
                        if (onTaskUpdate) {
                            onTaskUpdate(null);
                        }
                        if (sidebar?.setGeneratingConversationId) {
                            sidebar.setGeneratingConversationId(null);
                        }
                        // Mark current message as complete
                        setMessages(prev => {
                            const lastMsg = prev[prev.length - 1];
                            if (lastMsg && lastMsg.role === 'assistant') {
                                return prev.map(m => m.id === lastMsg.id ? { ...m, status: 'complete' } : m);
                            }
                            return prev;
                        });
                    } else if (event.data.status === 'failed' || event.data.status === 'error') {
                        setIsThinking(false);
                        setIsStreaming(false);
                        setActiveTaskId(null);
                        if (onTaskUpdate) {
                            onTaskUpdate(null);
                        }
                        setMessages(prev => {
                            const lastMsg = prev[prev.length - 1];
                            if (lastMsg && lastMsg.role === 'assistant') {
                                return prev.map(m => m.id === lastMsg.id ? { ...m, status: 'error' } : m);
                            }
                            return prev;
                        });
                        if (sidebar?.setGeneratingConversationId) {
                            sidebar.setGeneratingConversationId(null);
                        }
                        toast.error('AI Task failed: ' + (event.data.error || 'Unknown error'));
                    }
                    break;
                }
                case 'usage':
                    logger.debug('Received usage event:', event.data);
                    // Update message with token usage data
                    setMessages(prev => prev.map(m =>
                        m.id === event.data.message_id
                            ? { ...m, usage: event.data.usage }
                            : m
                    ));
                    break;
                case 'citations':
                    logger.debug('Received citations event:', event.data);
                    // Update message with citation data
                    setMessages(prev => prev.map(m =>
                        m.id === event.data.message_id
                            ? { ...m, citations: event.data.citations }
                            : m
                    ));
                    break;
                case 'message_start':
                    // CRITICAL: Create the assistant message placeholder BEFORE chunks arrive
                    // This fixes the race condition where chunks are dropped because the message doesn't exist yet
                    {
                        const msgId = event.data.messageId || event.data.message_id;
                        logger.debug('message_start received, creating placeholder for:', msgId);
                        setMessages(prev => {
                            // Check if message already exists (e.g., from initial load)
                            const exists = prev.some(m => m.id === msgId);
                            if (exists) {
                                logger.debug('Message already exists, skipping placeholder creation');
                                return prev;
                            }
                            // Create new placeholder message
                            return [...prev, {
                                id: msgId,
                                role: 'assistant' as const,
                                content: '',
                                reasoning_content: '',
                                status: 'streaming',
                                timestamp: new Date().toISOString(),
                                type: 'text'
                            } as Message];
                        });
                    }
                    break;
                case 'message_complete':
                    flushPendingChunks();
                    // CRITICAL: Reset ALL streaming states to prevent stuck UI
                    setIsThinking(false);
                    setIsStreaming(false);
                    setActiveTaskId(null);
                    // Mark the message as complete if we have a messageId
                    if (event.data.messageId || event.data.message_id) {
                        const msgId = event.data.messageId || event.data.message_id;
                        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'complete' } : m));
                    }
                    if (sidebar?.refreshUsageSummary) {
                        sidebar.refreshUsageSummary();
                    }
                    break;
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
                        const slippageBps = actionData.slippageBps || actionData.slippage_bps ||
                            (actionData.slippage ? Math.round(actionData.slippage * 100) : 50);

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

                        setIsThinking(false);
                        setIsStreaming(false);
                        setActiveTaskId(null);
                        setMessages(prev => {
                            const idx = prev.findIndex(m => m.id === targetMessageId);
                            let updated: Message[];
                            if (idx >= 0) {
                                updated = prev.map((m, i) => i === idx ? { ...m, ...txCardMsg } : m);
                            } else {
                                updated = [...prev, txCardMsg];
                            }
                            messagesRef.current = updated;
                            if (onMessagesChange && currentConversationIdRef.current) {
                                setTimeout(() => onMessagesChange(updated), 0);
                            }
                            return updated;
                        });

                        const patchTransactionCard = (patch: Record<string, unknown>) => {
                            setMessages(prev => {
                                const idx = prev.findIndex(m => m.id === targetMessageId);
                                if (idx === -1) return prev;
                                const current = prev[idx];
                                const nextMessage: Message = {
                                    ...current,
                                    type: 'transaction-status-card',
                                    data: {
                                        ...(current.data || {}),
                                        ...patch,
                                    },
                                };
                                const updated = replaceMessageAtIndex(prev, idx, nextMessage);
                                messagesRef.current = updated;
                                if (onMessagesChange && currentConversationIdRef.current) {
                                    setTimeout(() => onMessagesChange(updated), 0);
                                }
                                return updated;
                            });
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
                        setIsThinking(false);
                        setIsStreaming(false);
                        setActiveTaskId(null);
                        if (sidebar?.setGeneratingConversationId) {
                            sidebar.setGeneratingConversationId(null);
                        }
                        if (onTaskUpdate) {
                            onTaskUpdate(null);
                        }

                        // For strategy cards, trigger an immediate refresh of the strategies list
                        // This helps avoid the "deleted" race condition
                        if (refreshStrategies) {
                            logger.debug('Triggering immediate strategy refresh for new card');
                            refreshStrategies();
                        }

                        const targetMessageId = event.data.message_id || event.data.messageId;
                        setMessages(prev => {
                            const targetIdx = targetMessageId ? prev.findIndex(m => m.id === targetMessageId) : -1;
                            if (targetIdx !== -1) {
                                return prev.map((m, idx) => idx === targetIdx ? {
                                    ...m,
                                    type: 'strategy-card',
                                    data: event.data.action.data
                                } : m);
                            }
                            const lastMsgIdx = [...prev].reverse().findIndex(m => m.role === 'assistant');
                            if (lastMsgIdx !== -1) {
                                const actualIdx = prev.length - 1 - lastMsgIdx;
                                return prev.map((m, idx) => idx === actualIdx ? {
                                    ...m,
                                    type: 'strategy-card',
                                    data: event.data.action.data
                                } : m);
                            }
                            return prev;
                        });
                    } else if (['show_chart_card', 'show_transaction_status_card', 'show_cross_chain_status_card'].includes(normalizedAction.type)) {
                        const targetMessageId = event.data.targetMessageId || event.data.message_id || event.data.messageId;
                        const actionType = normalizedAction.type;
                        const actionData = normalizedAction.data || normalizedAction.payload || {};
                        const normalizedData = actionType === 'show_cross_chain_status_card'
                            ? {
                                status: actionData.status === 'submitted' || actionData.status === 'pending_bridge'
                                    ? 'pending'
                                    : actionData.status,
                                tokenInSymbol: actionData.tokenInSymbol || actionData.fromToken,
                                tokenOutSymbol: actionData.tokenOutSymbol || actionData.toToken,
                                amountIn: actionData.amountIn || actionData.amount,
                                amountOut: actionData.amountOut,
                                chainId: actionData.chainId || actionData.fromChain || chainId,
                                txHash: actionData.txHash,
                                message: actionData.message,
                                errorMessage: actionData.errorMessage || actionData.error,
                                isLoading: actionData.isLoading ?? !['success', 'failed', 'cancelled'].includes(actionData.status),
                            }
                            : actionData;
                        logger.debug('Handling card action:', { type: actionType, targetMsgId: targetMessageId });

                        // Card has arrived: hard-stop any residual thinking/streaming state
                        // to avoid ghost timers in chat UI.
                        setIsThinking(false);
                        setIsStreaming(false);
                        setActiveTaskId(null);
                        if (sidebar?.setGeneratingConversationId) {
                            sidebar.setGeneratingConversationId(null);
                        }
                        if (onTaskUpdate) {
                            onTaskUpdate(null);
                        }

                        setMessages(prev => {
                            // First, try to find by ID
                            const targetIdx = targetMessageId ? prev.findIndex(m => m.id === targetMessageId) : -1;
                            const newCardType = ACTION_CARD_TYPE_MAP[actionType] || 'text';

                            if (targetIdx !== -1) {
                                logger.debug('✅ Found target message, updating card:', targetMessageId);
                                const targetMessage = prev[targetIdx];
                                const nextMessage: Message = {
                                    ...targetMessage,
                                    type: newCardType as Message['type'],
                                    data: normalizedData
                                };
                                return replaceMessageAtIndex(prev, targetIdx, nextMessage);
                            }

                            // Race condition fix: If message ID provided but not found, CREATE IT
                            // This handles cases where client_action arrives before message_start processed
                            if (targetMessageId) {
                                logger.warn('Target message not found for action, creating new message:', targetMessageId);
                                return [...prev, {
                                    id: targetMessageId,
                                    role: 'assistant',
                                    content: '',
                                    reasoning_content: '',
                                    status: 'complete', // Mark complete since we have the final card
                                    timestamp: new Date().toISOString(),
                                    type: newCardType as Message['type'],
                                    data: normalizedData
                                } as Message];
                            }

                            // CRITICAL FIX: For transaction/swap cards with no targetMessageId,
                            // prefer updating the existing card by txHash; otherwise create a new message
                            if (['transaction-status-card', 'swap-card'].includes(newCardType)) {
                                const incomingTxHash = normalizedData?.txHash;
                                if (incomingTxHash) {
                                    const existingTxIdx = prev.findIndex(m =>
                                        m.type === 'transaction-status-card' &&
                                        m.data?.txHash &&
                                        String(m.data.txHash).toLowerCase() === String(incomingTxHash).toLowerCase()
                                    );
                                    if (existingTxIdx !== -1) {
                                        const targetMessage = prev[existingTxIdx];
                                        const nextMessage: Message = {
                                            ...targetMessage,
                                            type: newCardType as Message['type'],
                                            data: {
                                                ...(targetMessage.data || {}),
                                                ...normalizedData,
                                            },
                                        };
                                        return replaceMessageAtIndex(prev, existingTxIdx, nextMessage);
                                    }
                                }
                                logger.debug('No targetMessageId for transaction/swap card, creating new message');
                                return [...prev, {
                                    id: `assistant-${Date.now()}`,
                                    role: 'assistant',
                                    content: '',
                                    reasoning_content: '',
                                    status: 'complete',
                                    timestamp: new Date().toISOString(),
                                    type: newCardType as Message['type'],
                                    data: normalizedData
                                } as Message];
                            }

                            // For other safe card types, find or create
                            const lastMsgIdx = findLastAssistantIndex(prev);
                            if (lastMsgIdx !== -1) {
                                const targetMessage = prev[lastMsgIdx];
                                const nextMessage: Message = {
                                    ...targetMessage,
                                    type: newCardType as Message['type'],
                                    data: normalizedData
                                };
                                return replaceMessageAtIndex(prev, lastMsgIdx, nextMessage);
                            }

                            return prev;
                        });

                    }
                    break;
                }
                case 'content_block':
                    // Handle atomic content blocks (e.g. from AI analysis)
                    // Treat similar to chunk but usually larger/complete blocks
                    setMessages(prev => {
                        const lastMsg = prev[prev.length - 1];
                        const blockMessageId = event.data.message_id || event.data.messageId;

                        if (lastMsg && lastMsg.role === 'assistant' && lastMsg.id === blockMessageId) {
                            return prev.map(m => m.id === blockMessageId ? {
                                ...m,
                                content: (m.content || '') + (event.data.content || '')
                            } : m);
                        } else {
                            // If message doesn't exist, create it (rare case for async push)
                            return [...prev, {
                                id: blockMessageId,
                                role: 'assistant',
                                content: event.data.content || '',
                                timestamp: new Date().toLocaleTimeString(),
                                type: 'text'
                            } as Message];
                        }
                    });

                    // If this block signifies completion of a task/step, we might want to ensure streaming matches
                    if (event.data.is_final) {
                        setIsThinking(false);
                        setIsStreaming(false);
                    }
                    break;
                case 'transaction_update':
                case 'transaction_confirmed':
                case 'transaction_complete':
                    // CRITICAL: Stop thinking/streaming when transaction status arrives
                    setIsThinking(false);
                    setIsStreaming(false);
                    setActiveTaskId(null);

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    if (event.data.messageId || event.data.message_id || (event as any).messageId || (event as any).message_id) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const mid = event.data.messageId || event.data.message_id || (event as any).messageId || (event as any).message_id;
                        setMessages(prev => {
                            const exists = prev.some(m => m.id === mid);
                            if (exists) {
                                return prev.map(m => {
                                    if (m.id === mid && m.type === 'transaction-status-card') {
                                        return {
                                            ...m,
                                            data: {
                                                ...m.data,
                                                ...event.data,
                                                isLoading: event.type !== 'transaction_complete' && event.type !== 'transaction_confirmed' && event.data.status !== 'success' && event.data.status !== 'failed'
                                            }
                                        };
                                    }
                                    return m;
                                });
                            }
                            return prev;
                        });
                    }
                    if (sidebar?.setGeneratingConversationId) {
                        sidebar.setGeneratingConversationId(null);
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

    const currentConversationIdRef = useRef<string | null>(conversationId || null);
    const processedMessagesRef = useRef<Set<string>>(new Set());
    const modelSelectorRef = useRef<HTMLDivElement>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
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

    // Sync chatStarted state with Layout on mount
    useEffect(() => {
        sidebar?.setChatStarted(hasStarted);
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


    // Sync messages when conversationId or initialMessages change
    useEffect(() => {
        const prevId = currentConversationIdRef.current;
        const newId = conversationId;
        const conversationIdChanged = prevId !== newId;

        // Case 1: Conversation ID changed
        if (conversationIdChanged) {
            logger.debug('⚠️ CONVERSATION CHANGED:', { prevId, newId });

            // Show loading state during conversation switch
            setIsLoadingConversation(true);

            // If we're actively sending a message (creating new conversation), don't interrupt
            if (isSendingRef.current) {
                logger.debug('Skipping stopGeneration - active send in progress');
                currentConversationIdRef.current = newId || null;
                setIsLoadingConversation(false);
                return;
            }

            // IMPORTANT: Do NOT cancel backend task when switching conversations!
            // The generation should continue in the background.
            // We only reset local UI state here.
            logger.debug('Resetting UI states (backend continues generating)...');

            // Check if target conversation has streaming messages
            const lastAssistantMsg = initialMessages.filter(m => m.role === 'assistant').pop();
            const isTargetStreaming = lastAssistantMsg?.status === 'streaming';

            // CRITICAL: If target conversation has streaming message, restore streaming state
            // Otherwise reset UI states
            if (isTargetStreaming) {
                logger.debug('Target conversation has streaming message, restoring streaming state');
                setIsThinking(false);  // Not thinking, already streaming
                setIsStreaming(true);  // Restore streaming state!
            } else {
                setIsThinking(false);
                setIsStreaming(false);
            }
            setThinkingText('Thinking');
            setInput('');
            logger.debug('UI states reset, loading new messages:', initialMessages.length);

            // Always load the new conversation's messages when ID changes
            setMessages(initialMessages);
            messagesRef.current = initialMessages;
            setHasStarted(initialMessages.length > 0);
            processedMessagesRef.current.clear();
            processedStrategyIdsRef.current.clear();
            currentConversationIdRef.current = newId || null;

            // Clear active task when switching conversations
            setActiveTaskId(null);
            if (onTaskUpdate) {
                onTaskUpdate(null);
            }

            // CRITICAL: Mark all initial messages as processed to prevent auto-send
            initialMessages.forEach(msg => {
                processedMessagesRef.current.add(msg.id);
            });

            // Set flag to skip auto-send on next render cycle
            justSwitchedConversationRef.current = true;

            // Use requestAnimationFrame to ensure UI has rendered before hiding loading
            requestAnimationFrame(() => {
                setIsLoadingConversation(false);
            });

            logger.debug('Conversation switch complete. New ID:', newId, 'Marked', initialMessages.length, 'messages as processed');
        } else if (initialMessages.length > 0) {
            // Case 2: Conversation ID is same, check for background updates from App.tsx
            // This can happen when:
            // a) loadConversation completes and updates initialMessages (async loading)
            // b) Background streaming accumulated messages

            // CRITICAL: If our local messages are empty but initialMessages arrived, always sync
            // This fixes the "welcome screen appears instead of conversation" bug
            if (messages.length === 0 && initialMessages.length > 0) {
                logger.debug('Syncing - local empty but props has messages');
                setMessages(initialMessages);
                messagesRef.current = initialMessages;
                setHasStarted(true);
                // Mark as processed to prevent auto-send
                initialMessages.forEach(msg => processedMessagesRef.current.add(msg.id));
                return;
            }

            // CRITICAL FIX: Do NOT sync during active AI tasks to prevent race conditions
            // If there's an active task, our local WebSocket state is the source of truth
            if (activeTaskId || isStreaming || isThinking) {
                return;
            }

            // Only sync background updates if we are NOT currently streaming
            // (If we ARE streaming, our local state is more up-to-date)
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
                    setMessages(initialMessages);
                    messagesRef.current = initialMessages;
                    setHasStarted(initialMessages.length > 0);
                }
            }
        }
    }, [conversationId, initialMessages, isStreaming, isThinking, setHasStarted, messages.length, activeTaskId]);

    // Check active task and restore UI state when conversationId changes or component mounts
    useEffect(() => {
        if (!conversationId) {
            // Clear task state when no conversation
            if (activeTaskId) {
                setActiveTaskId(null);
                setIsThinking(false);
                setIsStreaming(false);
            }
            return;
        }

        // Check if we have activeTask from props (loaded by App.tsx)
        if (propActiveTask) {
            const task = propActiveTask;

            // If task is still running, restore UI state
            if (task.status === 'queued' || task.status === 'pending' || task.status === 'running') {
                // logger.debug('Restoring UI state for active task:', task.id, task.status);

                // Set active task ID
                setActiveTaskId(task.id);

                // Check last message to determine if streaming or thinking
                // CRITICAL: Use `messages` state (updated by WebSocket), NOT `initialMessages` props (stale)
                const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

                if (lastMessage && lastMessage.role === 'assistant') {
                    // If message is explicitly streaming, set isStreaming
                    if (lastMessage.status === 'streaming') {
                        setIsThinking(false);
                        setIsStreaming(true);
                        // logger.debug('Task is streaming (message status is streaming)');
                    } else if (lastMessage.status === 'complete') {
                        // If message is complete but task is running, AI is likely between turns (e.g. tool calling)
                        // so we should be in thinking state, not streaming
                        setIsThinking(true);
                        setIsStreaming(false);
                        logger.debug('Task is thinking (last message complete, but task running)');
                    } else {
                        // Fallback: if message has NO status but has content, assume it finished if we don't know otherwise
                        // BUT since task is running, we assume it's still doing something
                        setIsThinking(true);
                        setIsStreaming(false);
                    }
                } else {
                    // No assistant message yet, assume thinking
                    setIsThinking(true);
                    setIsStreaming(false);
                    logger.debug('Task is thinking (no assistant message yet)');
                }
            } else {
                // Task is done/failed/cancelled, clear UI state
                // REMOVED: activeTaskId === task.id check to ensure cleanup on refresh/mount
                setActiveTaskId(null);
                setIsThinking(false);
                setIsStreaming(false);
                logger.debug('Task is complete, clearing UI state:', task.id, task.status);
            }
        } else {
            // No active task, ensure UI state is cleared
            if (activeTaskId) {
                setActiveTaskId(null);
                setIsThinking(false);
                setIsStreaming(false);
            }
        }
    }, [conversationId, propActiveTask, messages, activeTaskId]);

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

        if (isThinking || isStreaming || messages.length === 0) return;

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
    }, [messages, conversationId, isThinking, isStreaming]);

    // Auto-save messages whenever they change (debounced)
    useEffect(() => {
        if (onMessagesChange && messages.length > 0 && currentConversationIdRef.current) {
            const timeoutId = setTimeout(() => {
                onMessagesChange(messages);
            }, 500);
            return () => {
                clearTimeout(timeoutId);
                // DO NOT sync immediately here to prevent render loop
            };
        }
    }, [messages, onMessagesChange]);

    // Sync on unmount only
    useEffect(() => {
        return () => {
            if (onMessagesChange && messagesRef.current.length > 0 && currentConversationIdRef.current) {
                logger.debug('Saving messages on unmount');
                onMessagesChange(messagesRef.current);
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
        if (!isThinking && !isStreaming) return;

        if (!silentMode) {
            setIsStopping(true);
        }

        setIsThinking(false);
        setIsStreaming(false);

        if (activeTaskId) {
            try {
                await chatApi.stopTask(activeTaskId);
                setActiveTaskId(null);
            } catch (err) {
                logger.error('Failed to stop task:', err);
            }
        }

        setTimeout(() => setIsStopping(false), 300);
    };



    // Flag to prevent double submission (race condition)
    const isSubmittingRef = useRef(false);

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

        // ============================================
        // OPTIMISTIC UI: Update visual state IMMEDIATELY before any API calls
        // This eliminates perceived delay when sending first message from WelcomeScreen
        // ============================================

        // 1. Switch to chat view immediately
        setHasStarted(true);

        // 2. Prepare and show user message immediately
        const now = new Date();
        const userMsg: Message = {
            id: existingMessageId || Date.now().toString(),
            role: 'user',
            content: text,
            timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            date: now.toISOString().split('T')[0],
            type: 'text',
        };

        // CRITICAL: Immediately mark this message ID as processed to block the auto-send useEffect
        processedMessagesRef.current.add(userMsg.id);

        if (!existingMessageId) {
            // Replace placeholder message (from pendingAIPrompt) if it exists, otherwise append
            setMessages(prev => {
                const placeholderIdx = prev.findIndex(m => m.id.startsWith('pending-user-'));
                if (placeholderIdx >= 0) {
                    // Replace the placeholder with the real user message
                    return prev.map((m, idx) => idx === placeholderIdx ? userMsg : m);
                }
                return [...prev, userMsg];
            });
        }

        // Stop any previous generation BEFORE showing new thinking
        stopGeneration(true);

        // 3. Show thinking state immediately
        setIsThinking(true);
        setThinkingText('Thinking');

        // 4. Clear input immediately
        setInput('');
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

        try {
            // Perform client-side moderation check
            const moderationResult = await moderationService.checkInput(text, conversationId, selectedModel?.id);
            if (!moderationResult.safe) {
                toast.error(moderationResult.reason || 'Message blocked by safety policy');
                // Revert optimistic UI on moderation failure
                setIsThinking(false);
                setMessages(prev => prev.filter(m => m.id !== userMsg.id));
                if (!conversationId) setHasStarted(false);
                return;
            }

            // Set flag to prevent conversation-change useEffect from interrupting
            isSendingRef.current = true;

            // LOGGING: Log the chain context before sending
            logger.debug(`Sending message on chain: ${currentChain.name} (${currentChain.id})`);

            // Prevent sending new messages while stopping
            if (isStopping) {
                logger.debug('Blocked send - currently stopping');
                setIsThinking(false);
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
            let currentConvId = conversationId;
            if (!currentConvId && onNewConversation) {
                currentConvId = await onNewConversation(text);
            }
            if (!currentConvId) {
                // Revert optimistic UI on session creation failure
                setIsThinking(false);
                setMessages(prev => prev.filter(m => m.id !== userMsg.id));
                setHasStarted(false);
                if (!authenticated) {
                    toast.error('Session expired. Login to KIKO to create chat session.');
                } else {
                    toast.error('Unable to create chat session. Please refresh and try again.');
                }
                return;
            }

            logger.debug('Setting isThinking=true');

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

                // CRITICAL: Immediately set generating conversation ID so WebSocket stays connected
                // This must happen before any async operations or user interactions
                if (sidebar?.setGeneratingConversationId) {
                    sidebar.setGeneratingConversationId(currentConvId);
                }

                // Add assistant message placeholder (WebSocket will stream content to this ID)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const createdAt = (assistantMessage as any).created_at ?? assistantMessage.timestamp ?? Date.now();
                setMessages(prev => {
                    const exists = prev.some(m => m.id === assistantMessage.id);
                    if (exists) return prev;
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
                    logger.debug('Added AI message placeholder, id:', aiMsg.id);
                    return [...prev, aiMsg];
                });
                setActiveTaskId(task.id);

                // Update task state in parent component
                if (onTaskUpdate) {
                    onTaskUpdate({ id: task.id, status: task.status });
                }
                if (sidebar?.refreshUsageSummary) {
                    sidebar.refreshUsageSummary();
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
            setIsThinking(false);
            const errorMsg: Message = {
                id: Date.now().toString(),
                role: 'assistant',
                content: `Error: ${err.message || 'Failed to connect to backend'}`,
                status: 'error',
                type: 'text',
                timestamp: new Date().toLocaleTimeString(),
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            // Clear sending flag
            isSendingRef.current = false;
            // Clear submission lock
            isSubmittingRef.current = false;
        }
    };

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
            if (isThinking || isStreaming || isStopping) {
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


        // TRIGGER SUGGESTIONS on input change (removed focus check for progressive suggestions)
        if (input.length > 0) {
            console.log('[ChatInterface] Calling detectIntent with:', input);
            detectIntent(input);
            // Re-focus to ensure next step works
            setTimeout(() => textareaRef.current?.focus(), 0);
        }
    }, [input, detectIntent]);

    // Handle pending AI prompt from other pages
    useEffect(() => {
        if (pendingAIPrompt && onAIPromptSet) {
            setInput(pendingAIPrompt);
            setHasStarted(true);

            // If it's a new chat (no messages), send it automatically
            if (messagesRef.current.length === 0) {
                // IMMEDIATELY show thinking state so user doesn't see a blank screen
                // This provides instant feedback that the AI is processing
                setIsThinking(true);
                setThinkingText('Thinking');

                // Also add a placeholder user message immediately for better UX
                const placeholderUserMsg: Message = {
                    id: `pending-user-${Date.now()}`,
                    role: 'user',
                    content: pendingAIPrompt,
                    status: 'complete',
                    timestamp: new Date().toISOString(),
                    type: 'text'
                };
                setMessages([placeholderUserMsg]);

                // We need to wait a tiny bit for the component to be fully ready
                setTimeout(() => {
                    handleSend(pendingAIPrompt);
                }, 500);
            } else {
                // Otherwise just pre-fill and focus
                setTimeout(() => {
                    if (textareaRef.current) {
                        autoResizeTextarea(textareaRef.current);
                    }
                    scrollToBottom();
                    textareaRef.current?.focus();
                }, 100);
            }

            // Clear the pending prompt
            onAIPromptSet();
        }
    }, [pendingAIPrompt, onAIPromptSet, handleSend]);

    // Feedback handler lifted to parent to persist state across remounts
    const handleMessageFeedback = useCallback((messageId: string, feedback: 'like' | 'dislike' | null) => {
        setMessages(prev => prev.map(msg =>
            msg.id === messageId ? { ...msg, feedback } : msg
        ));
        // Sync to ref immediately for useConversations or other syncs
        const updated = messagesRef.current.map(msg =>
            msg.id === messageId ? { ...msg, feedback } : msg
        );
        messagesRef.current = updated;
    }, []);

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
        return messages.map(msg => {
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
    }, [messages, strategies]);

    return (
        <div className={`${styles.chatContainer} ${styles[resolvedTheme]}`}>


            {/* Hero / Welcome Content with Exit Animation */}
            {/* Hero / Welcome Content with Jelly Exit Animation */}
            {/* Remove mode="wait" to allow overlapping animations (Jelly effect) */}
            <AnimatePresence initial={false}>
                {!hasStarted && (
                    <motion.div
                        key="welcome-screen"
                        initial={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{
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
                    !hasStarted && styles.messageListHidden, // Hide when welcome screen is active
                    hasStarted && styles.chatUiEnter         // Animate in when started
                )}
                ref={scrollContainerRef}
                onScroll={handleScroll}
            >
                {/* Loading overlay for conversation switching */}
                {isLoadingConversation && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(0, 0, 0, 0.3)',
                        backdropFilter: 'blur(4px)',
                        zIndex: 100,
                        borderRadius: 'inherit'
                    }}>
                        <div style={{
                            width: '32px',
                            height: '32px',
                            border: '3px solid rgba(255, 255, 255, 0.2)',
                            borderTopColor: 'var(--color-accent, #7c3aed)',
                            borderRadius: '50%',
                            animation: 'spin 0.8s linear infinite'
                        }} />
                    </div>
                )}
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
                                        // Never show on special cards (transaction-status-card, etc.)
                                        msg.role === 'assistant' &&
                                            msg.id === lastTextAssistantId &&
                                            (!msg.type || msg.type === 'text')
                                            ? thinkingText
                                            : undefined
                                    }
                                    userAddress={walletAddress}
                                    chainId={chainId}
                                    sessionId={conversationId || undefined}
                                    modelId={selectedModel?.id} // Pass current model for pricing calculation
                                    onFeedback={handleMessageFeedback}
                                    onCardAction={(action, data) => {
                                        if (action === 'swap-cancel') {
                                            // Update transaction status to cancelled
                                            setMessages(prev => {
                                                const updated = prev.map(m =>
                                                    m.id === msg.id ? {
                                                        ...m,
                                                        transactionStatus: 'cancelled' as const
                                                    } : m
                                                );
                                                messagesRef.current = updated;
                                                if (onMessagesChange && currentConversationIdRef.current) {
                                                    setTimeout(() => onMessagesChange(updated), 0);
                                                }
                                                return updated;
                                            });
                                        } else if (action === 'swap-success') {
                                            // Update transaction status to success
                                            const txHash = (data as { txHash: string }).txHash;
                                            setMessages(prev => {
                                                const updated = prev.map(m =>
                                                    m.id === msg.id ? {
                                                        ...m,
                                                        transactionStatus: 'success' as const,
                                                        transactionHash: txHash
                                                    } : m
                                                );
                                                messagesRef.current = updated;
                                                if (onMessagesChange && currentConversationIdRef.current) {
                                                    setTimeout(() => onMessagesChange(updated), 0);
                                                }
                                                return updated;
                                            });
                                        } else if (action === 'swap-error') {
                                            // Update transaction status to failed
                                            setMessages(prev => {
                                                const updated = prev.map(m =>
                                                    m.id === msg.id ? {
                                                        ...m,
                                                        transactionStatus: 'failed' as const
                                                    } : m
                                                );
                                                messagesRef.current = updated;
                                                if (onMessagesChange && currentConversationIdRef.current) {
                                                    setTimeout(() => onMessagesChange(updated), 0);
                                                }
                                                return updated;
                                            });
                                        } else if (action === 'strategy-edit') {
                                            // Navigate to trade page or open edit modal
                                        } else if (action === 'strategy-delete') {
                                            const strategyId = data;
                                            deleteStrategy(strategyId);
                                            // Remove strategy card from message
                                            setMessages(prev => {
                                                const updated = prev.map(m => {
                                                    if (m.type === 'strategy-card' && m.data?.id === strategyId) {
                                                        return {
                                                            ...m,
                                                            type: 'text' as const,
                                                            data: undefined
                                                        };
                                                    }
                                                    return m;
                                                });
                                                messagesRef.current = updated;
                                                if (onMessagesChange && currentConversationIdRef.current) {
                                                    setTimeout(() => onMessagesChange(updated), 0);
                                                }
                                                return updated;
                                            });
                                        } else if (action === 'strategy-toggle') {
                                            const strategyId = data;
                                            toggleStrategyStatus(strategyId);

                                            // Also update the message data locally to reflect the UI change immediately
                                            setMessages(prev => {
                                                const updated = prev.map(m => {
                                                    if (m.type === 'strategy-card' && m.data?.id === strategyId) {
                                                        const newStatus = m.data.status === 'active' ? 'paused' : 'active';
                                                        return {
                                                            ...m,
                                                            data: { ...m.data, status: newStatus }
                                                        };
                                                    }
                                                    return m;
                                                });
                                                messagesRef.current = updated;
                                                return updated;
                                            });
                                        } else if (action === 'strategy-details') {
                                            // TODO: Navigate to strategy details
                                        }
                                    }}
                                />

                            </React.Fragment>
                        );
                    });
                })()}

                {/* Thinking State indicator is now part of the message itself, no separate bubble needed */}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Area - Only show when conversation has started */}
            {
                hasStarted && (
                    <div
                        className={clsx(styles.inputArea, styles.inputBottom, styles.chatUiEnterDelayed)}
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
                                        onClick={() => setIsSettingsOpen(true)}
                                        title="Customize AI"
                                    >
                                        <Settings size={18} />
                                    </button>
                                    <button
                                        className={clsx(
                                            styles.sendBtn,
                                            (isThinking || isStreaming) && styles.stopMode,
                                            !isThinking && !isStreaming && input.trim() && styles.activeMode,
                                            isStopping && styles.stoppingMode
                                        )}
                                        onClick={() => (isThinking || isStreaming) ? stopGeneration() : handleSend()}
                                        disabled={(!input.trim() && !isThinking && !isStreaming) || isStopping}
                                        title={(isThinking || isStreaming) ? "Stop generation" : "Send message"}
                                    >
                                        <div className={clsx(styles.btnIcon, (isThinking || isStreaming) ? styles.iconHidden : styles.iconVisible)}>
                                            <ArrowUp size={20} strokeWidth={2.5} />
                                        </div>
                                        <div className={clsx(styles.btnIcon, (isThinking || isStreaming) ? styles.iconVisible : styles.iconHidden)}>
                                            <div className={styles.stopIconSquare} />
                                        </div>
                                        {(isThinking || isStreaming) && (
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

            {
                showFollowModal && authenticated && (
                    <FarcasterFollowModal onDismiss={handleDismissFollow} />
                )
            }

            {
                showDelegationModal && (
                    <DelegatedActionRequest
                        onSuccess={() => {
                            setShowDelegationModal(false);
                            if (pendingSwapAction) {
                                // Re-import and execute
                                import('../../services/swapService').then(({ executeSwapInstant }) => {
                                    const toastId = toast.loading('Executing instant swap...');

                                    // Set local storage flag
                                    if (user?.wallet?.address) {
                                        localStorage.setItem(`kiko_delegated_${user.wallet.address.toLowerCase()}`, 'true');
                                    }

                                    executeSwapInstant({
                                        tokenIn: pendingSwapAction.tokenIn,
                                        tokenOut: pendingSwapAction.tokenOut,
                                        amountIn: pendingSwapAction.amountIn,
                                        chainId: pendingSwapAction.chainId,
                                        slippageBps: Math.round((pendingSwapAction.slippage || 0.5) * 100),
                                    })
                                        .then((result) => {
                                            if (result.success && result.txHash) {
                                                toast.success('Swap executed successfully!', { id: toastId });
                                            } else {
                                                toast.error(`Swap failed: ${result.error}`, { id: toastId });
                                            }
                                        });
                                });
                                setPendingSwapAction(null);
                            }
                        }}
                        onCancel={() => {
                            setShowDelegationModal(false);
                            setPendingSwapAction(null);
                            toast.error("Delegation cancelled");
                        }}
                    />
                )
            }

        </div >
    );
};
