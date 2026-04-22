// CONTEXT MEMORY
// Updated: 2026-04-18
// Author: Rowan
// Reason: chat runtime contracts now also carry Farcaster-specific reply style
//         directives so public cast responses stay short and natural instead of
//         drifting into report-style answers. Social-agent ingress now also
//         needs a stable structured field for current-turn thread/image context
//         so prompt assembly can create multimodal user messages without
//         overloading plain history strings. The chat v2 rewrite also needs a
//         stable context-contract field so Node and Python can agree on which
//         context slices are required for a turn instead of re-injecting every
//         cached block by default. Product-owner review on 2026-04-18 further
//         clarified that chat v2 still lacked a hard worker-state object, so
//         task carry-forward, evidence gaps, confirmation bindings, and next
//         action semantics were drifting between prompt prose and runtime code.
//         Visible runtime plans later needed an explicit visibility hint, but
//         frontend rendering must still preserve old persisted cards after
//         refresh and should normalize low-quality scaffold copy instead of
//         hiding the card.
//         Follow-up prompt review clarified that worker memory must expose not
//         only the selected/candidate mode, but also the internal progress state
//         and source of scope/context-contract decisions so long conversations
//         do not drift. Chat v2 now also needs one explicit continuation value
//         for tool-owned reply channels, so a tool can finish the user-visible
//         reply without forcing a synthetic text answer back through the worker.
//         Agent-mode execution receipts now preserve returned URLs and ids for
//         transaction, order, deployed-token, and market receipts.
// Goal: keep funds-sensitive confirmation state explicit and serializable while
//       preserving turn-level runtime directives and social-agent multimodal
//       context as stable orchestration contracts. Keep worker-visible task,
//       execution, evidence, and next-action state as first-class contracts
//       instead of hidden ad hoc prompt summaries, including tool-owned
//       terminal reply paths.
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
// - worker state must be object-shaped: task, execution, evidence, and next action
// - quote/confirmation binding metadata is internal state, not user-facing prose
// - quote freshness must be explicit; old timestamps alone are not enough to invalidate a trade
// - runtime plan visibility is a descriptive hint, not a frontend hide switch
// - worker memory must expose mode-internal progress and scope provenance;
//   TASK_MENU alone is not enough to preserve long-running workflow state
// - context-contract mode is a backend safety/read contract with explicit provenance,
//   not a hidden replacement for model-owned task selection
// - execution receipts should preserve concrete returned URLs without fabricating missing links
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
// - Source: product-owner runtime review of KiKo chat architecture
// - Kind: product instruction / runtime observation
// - Retrieved: 2026-04-18
// - Applied To: worker state contracts and execution-binding metadata
// - Verification: verified in code and targeted tests
// - Source: operator runtime transcript showing warmup plan labels rendered as
//           answer-adjacent copy
// - Kind: runtime observation
// - Retrieved: 2026-04-18
// - Applied To: PlanCard.visibility as a non-authoritative hint plus frontend scaffold normalization
// - Verification: verified in code and targeted tests
// - Source: product-owner supplied model review of KiKo TASK_MENU/CONTEXT_CATALOG behavior
// - Kind: product instruction / runtime observation
// - Retrieved: 2026-04-18
// - Applied To: WorkerModeProgressState, WorkerTaskState.scope_source, and ChatContextContract.source
// - Verification: verified in code and targeted tests
// - Source: operator requirement on 2026-04-18 for model-owned image generation inside main chat
// - Kind: product doc
// - Retrieved: 2026-04-18
// - Applied To: ToolContinuationContract.complete_with_side_effect for tool-owned reply channels
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-agent-execution-receipt-links.md
// - Kind: repo doc
// - Retrieved: 2026-04-19
// - Applied To: ExecutionReceiptState URL and order/token/market id fields
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-plan-card-internal-scaffold-filter.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-social-agent-thread-context-and-image-input.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-farcaster-reply-style-directive.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-address-preclassification-for-chat.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-14-copytrade-wallet-audit-provenance.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-work-protocol-refactor.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-v2-model-owned-image-generation-tool.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-agent-execution-receipt-links.md
import type { ToolDefinition } from "../../tooling/registry.js";
import type { ActionClass, ControlPolicySnapshot } from "./controlPolicy.js";
import type {
  CanonicalIntent,
  CanonicalIntentNormalizationState,
} from "./canonicalIntent.js";
import type {
  TaskRoute,
  TaskRouteSelectionState,
} from "./taskRoute.js";

export interface ChatHistoryMessage {
  role: "system" | "user" | "assistant" | "tool";
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
  kind?: "swap_confirmation" | "copy_trade_confirmation" | "order_confirmation";
  sourceTool?: string | null;
  capturedAt?: string | null;
  binding?: ExecutionBindingState | null;
  quote?: TradeQuoteState | null;
  receipt?: ExecutionReceiptState | null;
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

export interface TradeQuoteState {
  quote_id?: string | null;
  tool_name: string;
  token_in?: string | null;
  token_out?: string | null;
  amount_in?: string | null;
  chain_id?: number | null;
  to_chain?: number | null;
  is_cross_chain?: boolean | null;
  expected_out?: string | number | null;
  price_impact?: string | number | null;
  quoted_at?: string | null;
  expires_at?: string | null;
  stale?: boolean;
  stale_reason?: string | null;
}

export interface ExecutionReceiptState {
  tool_name: string;
  tx_hash?: string | null;
  tx_url?: string | null;
  explorer_url?: string | null;
  chain_id?: number | null;
  order_id?: string | null;
  replaced_order_id?: string | null;
  token_address?: string | null;
  token_url?: string | null;
  market_slug?: string | null;
  market_url?: string | null;
  status?: "submitted" | "success" | "failed" | "unknown";
  submitted_at?: string | null;
  completed_at?: string | null;
  raw_status?: string | number | boolean | null;
}

export interface ExecutionBindingState {
  binding_kind:
    | "preflight_quote"
    | "prepared_confirmation"
    | "derived_execute_args";
  binding_key?: string | null;
  tool_name: string;
  action_class?: ActionClass | null;
  source_tool?: string | null;
  captured_at?: string | null;
}

export interface WorkerTaskState {
  scope:
    | "fresh_request"
    | "carry_forward_session"
    | "pending_confirmation"
    | "pending_execution";
  scope_source:
    | "confirmation_state"
    | "carry_forward_entities"
    | "fresh_turn_no_carry_forward";
  current_goal: string;
  completion_rule: string;
}

export interface WorkerModeProgressState {
  mode:
    | "lean_chat"
    | "image_chat"
    | "social_thread"
    | "wallet_read"
    | "token_analysis"
    | "market_research"
    | "swap_quote"
    | "trade_confirmation"
    | "token_deploy"
    | "polymarket"
    | "meta_debug"
    | "unknown";
  internal_state:
    | "fresh_answer"
    | "context_required"
    | "evidence_required"
    | "evidence_gathered"
    | "target_identified"
    | "quote_needed"
    | "quote_ready"
    | "awaiting_confirmation"
    | "ready_to_execute"
    | "executed"
    | "needs_clarification";
  state_source:
    | "confirmation_state"
    | "recent_tool_trace"
    | "polymarket_selection"
    | "task_route"
    | "normalized_intent"
    | "runtime_surface"
    | "latest_user_message"
    | "fresh_turn";
  completed_steps: string[];
  pending_steps: string[];
  missing_fields?: string[];
}

export interface WorkerEvidenceState {
  required: string[];
  gathered: string[];
  missing: string[];
  recent_tools?: string[];
}

export interface WorkerNextActionState {
  kind:
    | "answer"
    | "read_context"
    | "call_tool"
    | "wait_for_user_confirmation"
    | "ask_user_clarification"
    | "execute_confirmed_action";
  reason: string;
  tool_name?: string | null;
}

export interface WorkerExecutionState {
  phase: "idle" | "prepared" | "awaiting_confirmation" | "ready_to_execute";
  pending_action: "none" | "swap" | "order" | "copy_trade";
  pending_confirmation?: string | null;
  confirmation_binding?: ExecutionBindingState | null;
  pending_quote?: TradeQuoteState | null;
  latest_receipt?: ExecutionReceiptState | null;
}

export interface WorkerConversationState {
  carry_forward_rule: string;
  task_state: WorkerTaskState;
  mode_progress_state: WorkerModeProgressState;
  execution_state: WorkerExecutionState;
  evidence_state: WorkerEvidenceState;
  next_action_state: WorkerNextActionState;
  carry_forward_entities?: Record<string, any>;
}

export interface DirectFollowupExecutionPlan {
  action_kind: "swap" | "copy_trade" | "order";
  tool_name: string;
  args: Record<string, any>;
  execution_gate: {
    phase: "execute";
    confirmationToken?: string;
  };
  binding: ExecutionBindingState | null;
  extra_tool_context?: Record<string, any>;
}

export type ChatContextBlockName =
  | "user_settings"
  | "user_context"
  | "workflow_state"
  | "wallet_state"
  | "token_context"
  | "launchpad_context"
  | "social_thread_context"
  | "social_images"
  | "provider_native_evidence"
  | "execution_plan"
  | "skill_prompts";

export interface ChatContextContract {
  mode: "lean" | "analysis" | "image" | "execution" | "social" | "debug";
  source?: "runtime_contract" | "fallback_prompt_contract";
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
  windowRole?: "current" | "next" | "execution" | "watchlist" | "candidate";
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
  pendingAction: "none" | "swap" | "order" | "copy_trade";
  confirmationPayload?: TradeConfirmationState | null;
  canExecute: boolean;
  needsClarification: boolean;
  clarificationQuestion: string | null;
}

export interface RenderContractColumn {
  key: string;
  label: string;
  valueType?: "text" | "wallet_address" | "tx_hash" | "number" | "datetime";
}

export interface RenderContract {
  id?: string;
  renderMode: "narrative" | "table" | "list" | "confirmation";
  title?: string;
  columns?: RenderContractColumn[];
  rows?: Array<Record<string, string | number | null>>;
  rowCount?: number;
  summary?: string;
  markdownFallback?: string | null;
}

export interface RuntimeDirective {
  kind:
    | "chain_context"
    | "swap_confirmation"
    | "copy_trade_confirmation"
    | "amount_semantics"
    | "fast_swap_address_required"
    | "fast_swap_safe_mode"
    | "fast_swap_contract"
    | "quote_before_swap_contract"
    | "balance_auto_resolution_guard"
    | "chain_switch_required"
    | "farcaster_public_reply_style";
  message: string;
  metadata?: Record<string, any>;
}

export interface RequestedAddressClassification {
  address: string;
  kind: "token_contract" | "wallet" | "contract" | "unknown";
  chainId?: number | null;
  chainName?: string | null;
  source: "rpc" | "token_service" | "heuristic";
}

export interface ProviderNativeEvidenceResult {
  sourceType: "x_search" | "web_search";
  title?: string;
  url?: string;
  snippet?: string;
  query?: string;
  retrievedAt: string;
  round: number;
}

export interface ProviderNativeEvidenceSnapshot {
  sourceTypes: Array<"x_search" | "web_search">;
  querySummary: string;
  results: ProviderNativeEvidenceResult[];
  retrievedAt: string;
  round: number;
}

export type PlanStepStatus = "pending" | "in_progress" | "completed" | "failed";
export type PlanRuntimeState =
  | "search_in_progress"
  | "chain_query_in_progress"
  | "blocked_on_missing_evidence"
  | "blocked_on_missing_timestamp";

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
  | "bootstrap"
  | "plan_created"
  | "step_added"
  | "analysis_started"
  | "analysis_completed"
  | "tool_selected"
  | "tool_started"
  | "tool_completed"
  | "tool_failed"
  | "answer_started"
  | "answer_completed"
  | "runtime_note"
  | "runtime_error";

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
  kind: "agent_runtime";
  scope: "chat_task";
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
  visibility?: "internal" | "visible";
  title: string;
  summary: string;
  locale?: string;
  uiText?: PlanCardUiText;
  status: "pending" | "in_progress" | "completed" | "failed";
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
  taskRoute?: TaskRoute | null;
  taskRouteSelectionState?: TaskRouteSelectionState | null;
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
  continuation?: ToolContinuationContract;
}

export interface ToolContinuationContract {
  next_action:
    | "answer_now"
    | "read_more_context"
    | "call_another_tool"
    | "ask_user_confirmation"
    | "ask_user_clarification"
    | "handle_tool_failure"
    | "complete_with_side_effect";
  can_answer_now: boolean;
  reason: string;
  missing_evidence?: string[];
  next_tool?: string | null;
  resolved_state?: string[];
  reusable_for_next_turn?: boolean;
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
