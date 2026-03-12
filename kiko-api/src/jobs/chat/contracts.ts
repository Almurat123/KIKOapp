import type { ToolDefinition } from '../../tooling/registry.js';

export interface ChatHistoryMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    reasoningContent?: string;
    toolCalls?: any[];
    toolCallId?: string;
    data?: any;
    messageId?: string;
}

export interface RecentToolTrace {
    messageId?: string;
    toolCalls: Array<{
        tool: string;
        args?: Record<string, any>;
        status?: string;
        result?: any;
    }>;
}

export interface TradeConfirmationState {
    kind?: 'swap_confirmation' | 'copy_trade_confirmation';
    swap?: {
        tokenIn: string;
        tokenOut: string;
        amountIn: string;
        chainId?: number;
        toChain?: number;
        isCrossChain?: boolean;
    };
    copyTrade?: {
        targetWallet: string;
        buyAmountUsd: number;
        chainId?: number;
        mirrorSell?: boolean;
        takeProfitPct?: number;
        stopLossPct?: number;
    };
}

export interface RuntimeDirective {
    kind: 'chain_context' | 'swap_confirmation' | 'copy_trade_confirmation' | 'amount_semantics' | 'fast_swap_address_required' | 'fast_swap_safe_mode' | 'balance_auto_resolution_guard';
    message: string;
    metadata?: Record<string, any>;
}

export interface ChatContextSnapshot {
    sessionId: string;
    taskId: string;
    userMessageId?: string;
    assistantMessageId?: string;
    model: string;
    history: ChatHistoryMessage[];
    lastUserMessage: string;
    recentToolTrace?: RecentToolTrace | null;
    confirmationState?: TradeConfirmationState | null;
    runtime: {
        userId?: string | null;
        walletAddress?: string;
        userAddress?: string;
        chainId?: number;
        chainName?: string;
        nativeBalance?: string;
        balance?: Record<string, any> | null;
        currentPage?: string;
        pageContext?: string;
        farcaster?: Record<string, any> | null;
        userSettings?: Record<string, any> | null;
        toolContext?: Record<string, any> | null;
        tokenSnapshot?: Record<string, any> | null;
        launchpad?: Record<string, any> | null;
        balanceSnapshotAt?: string | null;
        systemDirectives?: RuntimeDirective[];
        prefetchedToolResults?: Record<string, any> | null;
        contextBlocks?: {
            clientContext?: string;
            walletState?: string;
            tokenContext?: string;
            launchpadContext?: string;
        };
    };
    requestedTokenAddresses: string[];
    requestedTokenSymbols: string[];
    compactedHistory?: string | null;
    historyBudget?: {
        inputTokensEstimated: number;
        historyKept: number;
        historyCompacted: number;
        compactionHits: number;
    } | null;
    previousResponseId?: string | null;
    toolDefinitions: ToolDefinition[];
}

export interface OrchestratorToolCall {
    id: string;
    name: string;
    arguments: Record<string, any>;
}

export interface OrchestratorToolResult {
    id: string;
    name: string;
    arguments: Record<string, any>;
    ok: boolean;
    result?: any;
    error?: string;
    metadata?: Record<string, any>;
}

export interface OrchestratorUsage {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
}
