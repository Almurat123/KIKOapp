// CONTEXT MEMORY
// Updated: 2026-04-16
// Author: Rowan
// Reason: chat runtime contracts now also carry Farcaster-specific reply style
//         directives so public cast responses stay short and natural instead of
//         drifting into report-style answers. Social-agent ingress now also
//         needs a stable structured field for current-turn thread/image context
//         so prompt assembly can create multimodal user messages without
//         overloading plain history strings. The chat v2 rewrite also needs a
//         stable context-contract field so Node and Python can agree on which
//         context slices are required for a turn instead of re-injecting every
//         cached block by default.
// Goal: keep funds-sensitive confirmation state explicit and serializable while
//       preserving turn-level runtime directives and social-agent multimodal
//       context as stable orchestration contracts.
// Owns: TypeScript contracts shared across chat orchestration owners.
// Does Not Own: wallet extraction, confirmation policy, or persistence writes.
// Design Language:
// - exact wallet provenance is metadata, not a replacement for strict validation
// - confirmation state must preserve enough evidence for audit after user confirm
// - public executable args and audit metadata remain separate concepts
// - runtime directives are part of the orchestration contract and may carry
//   public-reply style rules for specific surfaces like Farcaster
// - current-turn social multimodal context is runtime metadata, not replayed
//   history
// - literal address classification should be explicit context, not hidden model inference
// - chat v2 must carry an explicit context contract so prompt assembly can
//   expose only the slices that the current task actually needs
// Document Provenance:
// - Source: runtime screenshot of awkward Farcaster public reply formatting
// - Kind: runtime observation
// - Retrieved: 2026-04-16
// - Applied To: RuntimeDirective extension for Farcaster reply style
// - Verification: verified in code and targeted tests
// - Source: X expansions/media docs + Neynar cast lookup docs
// - Kind: official API doc
// - Retrieved: 2026-04-16
// - Applied To: ChatContextSnapshot.runtime.socialInput for current-turn
//   thread/image context
// - Verification: verified in docs and code
// - Source: /Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: explicit context-contract storage in runtime snapshot
// - Verification: inferred from code and planned architecture
// - Source: Farcaster/runtime address-routing incidents where token contracts
//           were interpreted as wallet-analysis targets
// - Kind: runtime observation
// - Retrieved: 2026-04-16
// - Applied To: ChatContextSnapshot.requestedAddressClassifications
// - Verification: verified in code and targeted tests
// - Source: production incident analysis of malformed BSC copy-trade target wallets
// - Kind: runtime observation
// - Retrieved: 2026-04-14
// - Applied To: TradeConfirmationState.copyTrade.walletBinding
// - Verification: verified in TypeScript and targeted tests
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-social-agent-thread-context-and-image-input.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-farcaster-reply-style-directive.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-address-preclassification-for-chat.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-14-copytrade-wallet-audit-provenance.md
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
        walletBinding?: Record<string, any>;
    };
    order?: {
        toolName: string;
        args: Record<string, any>;
        confirmationToken: string;
        actionClass: ActionClass;
    };
}

export type ChatContextBlockName =
    | 'user_settings'
    | 'user_context'
    | 'workflow_state'
    | 'wallet_state'
    | 'token_context'
    | 'launchpad_context'
    | 'social_thread_context'
    | 'social_images'
    | 'provider_native_evidence'
    | 'execution_plan'
    | 'skill_prompts';

export interface ChatContextContract {
    mode: 'lean' | 'analysis' | 'execution' | 'social' | 'debug';
    requiredContexts: ChatContextBlockName[];
    optionalContexts: ChatContextBlockName[];
    reason?: string | null;
}

export interface PolymarketSelectionOutcomeState {
    name: string;
    tokenId: string | null;
    probability?: string | null;
    price?: number | null;
}

export interface PolymarketSelectionCandidateState {
    title: string;
    question: string;
    marketId: string | null;
    marketSlug: string | null;
    conditionId: string | null;
    windowRole?: 'current' | 'next' | 'execution' | 'watchlist' | 'candidate';
    orderable?: boolean;
    live?: boolean;
    orderableDetail?: string | null;
    windowStartEt?: string | null;
    windowEndEt?: string | null;
    outcomes: PolymarketSelectionOutcomeState[];
}

export interface PolymarketPreparedSelectionState {
    question: string;
    outcome: string;
    tokenId: string;
    resolvedTokenId?: string | null;
    marketId?: string | null;
    marketSlug?: string | null;
    conditionId?: string | null;
    amountUsd?: number | null;
}

export interface PolymarketSelectionState {
    sourceTool: string;
    capturedAt: string;
    currentTimeEtStrict?: string | null;
    primaryCandidate?: PolymarketSelectionCandidateState | null;
    currentCandidate?: PolymarketSelectionCandidateState | null;
    executionCandidate?: PolymarketSelectionCandidateState | null;
    preparedSelection?: PolymarketPreparedSelectionState | null;
    candidates: PolymarketSelectionCandidateState[];
}

export interface ConversationActionState {
    pendingAction: 'none' | 'swap' | 'order' | 'copy_trade';
    confirmationPayload?: TradeConfirmationState | null;
    canExecute: boolean;
    needsClarification: boolean;
    clarificationQuestion: string | null;
}

export interface RenderContractColumn {
    key: string;
    label: string;
    valueType?: 'text' | 'wallet_address' | 'tx_hash' | 'number' | 'datetime';
}

export interface RenderContract {
    id?: string;
    renderMode: 'narrative' | 'table' | 'list' | 'confirmation';
    title?: string;
    columns?: RenderContractColumn[];
    rows?: Array<Record<string, string | number | null>>;
    rowCount?: number;
    summary?: string;
    markdownFallback?: string | null;
}

export interface RuntimeDirective {
    kind: 'chain_context' | 'swap_confirmation' | 'copy_trade_confirmation' | 'amount_semantics' | 'fast_swap_address_required' | 'fast_swap_safe_mode' | 'fast_swap_contract' | 'quote_before_swap_contract' | 'balance_auto_resolution_guard' | 'chain_switch_required' | 'farcaster_public_reply_style';
    message: string;
    metadata?: Record<string, any>;
}

export interface RequestedAddressClassification {
    address: string;
    kind: 'token_contract' | 'wallet' | 'contract' | 'unknown';
    chainId?: number | null;
    chainName?: string | null;
    source: 'rpc' | 'token_service' | 'heuristic';
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

export interface PlanCardUiText {
    eyebrow?: string;
    reasoningLabel?: string;
    statusLabels?: Partial<Record<PlanStepStatus, string>>;
    completedStepFeedback?: string;
    stoppedStepFeedback?: string;
}

export interface PlanCard {
    planId: string;
    title: string;
    summary: string;
    locale?: string;
    uiText?: PlanCardUiText;
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
        socialInput?: Record<string, any> | null;
        userSettings?: Record<string, any> | null;
        toolContext?: Record<string, any> | null;
        tokenSnapshot?: Record<string, any> | null;
        launchpad?: Record<string, any> | null;
        balanceSnapshotAt?: string | null;
        allChainBalances?: Record<string, any> | null;
        allChainBalancesSnapshotAt?: string | null;
        systemDirectives?: RuntimeDirective[];
        prefetchedToolResults?: Record<string, any> | null;
        contextContract?: ChatContextContract | null;
        contextBlocks?: {
            clientContext?: string;
            walletState?: string;
            tokenContext?: string;
            launchpadContext?: string;
        };
    };
    requestedTokenAddresses: string[];
    requestedTokenSymbols: string[];
    requestedAddressClassifications?: RequestedAddressClassification[];
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
    conversationActionState?: ConversationActionState | null;
    polymarketSelection?: PolymarketSelectionState | null;
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
