import type { ToolDefinition } from '../../tooling/registry.js';
import type { ActionClass, ControlPolicySnapshot } from './controlPolicy.js';
import type { CanonicalIntent, CanonicalIntentNormalizationState } from './canonicalIntent.js';

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
    kind?: 'swap_confirmation' | 'copy_trade_confirmation' | 'order_confirmation';
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
    order?: {
        toolName: string;
        args: Record<string, any>;
        confirmationToken: string;
        actionClass: ActionClass;
    };
}

export interface RuntimeDirective {
    kind: 'chain_context' | 'swap_confirmation' | 'copy_trade_confirmation' | 'amount_semantics' | 'fast_swap_address_required' | 'fast_swap_safe_mode' | 'fast_swap_contract' | 'quote_before_swap_contract' | 'balance_auto_resolution_guard' | 'chain_switch_required';
    message: string;
    metadata?: Record<string, any>;
}

export interface ProviderNativeEvidenceResult {
    sourceType: 'x_search' | 'web_search';
    title?: string;
    url?: string;
    snippet?: string;
    query?: string;
    retrievedAt: string;
    round: number;
}

export interface ProviderNativeEvidenceSnapshot {
    sourceTypes: Array<'x_search' | 'web_search'>;
    querySummary: string;
    results: ProviderNativeEvidenceResult[];
    retrievedAt: string;
    round: number;
}

export type PlanStepStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
export type PlanRuntimeState =
    | 'search_in_progress'
    | 'chain_query_in_progress'
    | 'blocked_on_missing_evidence'
    | 'blocked_on_missing_timestamp';

export interface PlanStepExecution {
    id: string;
    toolName?: string;
    status: PlanStepStatus;
    summary: string;
    detail?: any;
    startedAt?: string;
    completedAt?: string;
}

export interface PlanStep {
    id: string;
    title: string;
    description?: string;
    status: PlanStepStatus;
    preferredTools?: string[];
    startedAt?: string;
    completedAt?: string;
    feedback?: string;
    executions?: PlanStepExecution[];
}

export type AgentRuntimeEventType =
    | 'bootstrap'
    | 'plan_created'
    | 'step_added'
    | 'analysis_started'
    | 'analysis_completed'
    | 'tool_selected'
    | 'tool_started'
    | 'tool_completed'
    | 'tool_failed'
    | 'answer_started'
    | 'answer_completed'
    | 'runtime_note'
    | 'runtime_error';

export interface AgentRuntimeEvent {
    id: string;
    type: AgentRuntimeEventType;
    summary: string;
    detail?: any;
    stepId?: string;
    toolName?: string;
    status?: PlanStepStatus;
    createdAt: string;
}

export interface AgentRuntimeSnapshot {
    plan: PlanCard;
    providerNativeEvidence?: ProviderNativeEvidenceSnapshot[];
}

export interface AgentRuntimeEnvelope {
    kind: 'agent_runtime';
    scope: 'chat_task';
    messageId: string;
    planId: string;
    snapshot: AgentRuntimeSnapshot;
    event: AgentRuntimeEvent | null;
}

export interface PlanCard {
    planId: string;
    title: string;
    summary: string;
    locale?: 'en' | 'zh';
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    runtimeState?: PlanRuntimeState;
    currentStepId?: string;
    steps: PlanStep[];
    activity?: AgentRuntimeEvent[];
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
        allChainBalances?: Record<string, any> | null;
        allChainBalancesSnapshotAt?: string | null;
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
    normalizedIntent?: CanonicalIntent | null;
    normalizationState?: CanonicalIntentNormalizationState | null;
    toolDefinitions: ToolDefinition[];
    policySnapshot?: ControlPolicySnapshot | null;
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
    reasonCode?: string;
    policyDecisionId?: string;
}

export interface OrchestratorUsage {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    reasoning_tokens?: number;
    cost_in_usd_ticks?: number;
    prompt_cache_hit_tokens?: number;
    prompt_cache_miss_tokens?: number;
    prompt_tokens_details?: {
        text_tokens?: number;
        audio_tokens?: number;
        image_tokens?: number;
        cached_tokens?: number;
    } | null;
    completion_tokens_details?: {
        reasoning_tokens?: number;
        audio_tokens?: number;
        accepted_prediction_tokens?: number;
        rejected_prediction_tokens?: number;
    } | null;
}
