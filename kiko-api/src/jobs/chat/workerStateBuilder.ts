// CONTEXT MEMORY
// Updated: 2026-04-19
// Author: Rowan
// Reason: chat v2 previously spread durable worker state across prompt prose,
//         confirmation payloads, and ad hoc follow-up branches. That made
//         carry-forward behavior implicit and left the worker to guess the
//         current goal, missing evidence, and next executable step.
//         Follow-up architecture review showed TASK_MENU still did not expose
//         the current step inside each specialist mode, so this owner now
//         derives mode progress and scope provenance explicitly. Agent-mode
//         execution replies now also need durable receipt links for hashes,
//         orders, deployed tokens, and Polymarket markets. Clanker launch
//         previews also need to carry the exact prepared deploy payload into
//         the confirm turn so the model can help confirm the same launch and
//         the execution handoff can flip `confirmDeploy` only at execution
//         time.
// Goal: centralize worker-visible task, execution, evidence, and next-action
//       state so prompt assembly, read_workflow_state, and direct follow-up
//       execution all consume the same object contract.
// Owns: derived worker state contracts and direct follow-up execution-plan derivation.
// Does Not Own: tool HTTP behavior, canonical intent normalization, or websocket rendering.
// Design Language:
// - worker state is one object, not scattered prompt lore
// - pending confirmation must carry explicit binding metadata when available
// - evidence gaps are derived from runtime state and recent tool traces, not guessed in prose
// - direct follow-up execution must consume a deterministic plan object
// - internal binding keys are execution safety state, not user-facing approval UX
// - quote freshness is explicit; only tool-marked or expiry-marked stale quotes should block continuation
// - mode progress is explicit; each long-running task must show completed and pending steps
// - scope provenance is explicit; fresh_request/carry_forward/pending states must say why they were chosen
// - latest_receipt must preserve concrete user-facing URLs returned by mutation tools
// - Clanker deploy confirmation state must preserve the prepared launch payload
//   and only flip `confirmDeploy` on the execute handoff
// Document Provenance:
// - Source: product-owner runtime review of KiKo chat architecture
// - Kind: product instruction / runtime observation
// - Retrieved: 2026-04-18
// - Applied To: unified worker state contract and direct follow-up execution plan
// - Verification: verified in code and targeted tests
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-work-protocol-refactor.md
// - Kind: repo doc
// - Retrieved: 2026-04-18
// - Applied To: worker task/evidence/action object model
// - Verification: verified in code and targeted tests
// - Source: product-owner supplied model review of remaining KiKo state-machine gaps
// - Kind: product instruction / runtime observation
// - Retrieved: 2026-04-18
// - Applied To: mode_progress_state and task_state.scope_source derivation
// - Verification: verified in code and targeted tests
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-agent-execution-receipt-links.md
// - Kind: repo doc
// - Retrieved: 2026-04-19
// - Applied To: preserving tool-returned receipt URLs in workflow state
// - Verification: verified in code
// - Source: local runtime observation of Clanker dry-run preview / confirm
//           mismatch in the current KiKo thread
// - Kind: runtime observation
// - Retrieved: 2026-04-19
// - Applied To: replaying Clanker deploy previews as confirmable launch state
//   and replaying them with `confirmDeploy=true` only on the execute handoff
// - Verification: verified in code and targeted tests
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/owner-map/chat-runtime-planning.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-work-protocol-refactor.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-agent-execution-receipt-links.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-clanker-dry-run-confirmation-continuity.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

import { resolveCanonicalChainRef } from "./chainIntent.js";
import type {
  ChatContextSnapshot,
  DirectFollowupExecutionPlan,
  ExecutionBindingState,
  ExecutionReceiptState,
  TradeQuoteState,
  TradeConfirmationState,
  WorkerConversationState,
  WorkerModeProgressState,
} from "./contracts.js";
import { computeConfirmationToken } from "./executionGate.js";

const SEARCH_EVIDENCE_TOOLS = new Set([
  "external_web_search",
  "x_search",
  "web_search",
  "open_web_page",
]);

const TOKEN_EVIDENCE_TOOLS = new Set([
  "get_token_info",
  "get_early_buyers",
  "get_top_holders",
  "analyze_creator",
  "analyze_token_holders",
  "get_trending_tokens",
]);

const WALLET_EVIDENCE_TOOLS = new Set([
  "get_wallet_info",
  "analyze_wallet_pnl",
  "analyze_wallet_pnl_batch",
  "get_wallet_pnl",
]);

export function buildWorkerConversationState(
  snapshot: ChatContextSnapshot,
): WorkerConversationState {
  const actionState = snapshot.conversationActionState || null;
  const confirmation = snapshot.confirmationState || null;
  const requiredEvidence = Array.isArray(
    snapshot.normalizedIntent?.evidenceRequirements,
  )
    ? snapshot.normalizedIntent!.evidenceRequirements
    : [];
  const gatheredEvidence = deriveGatheredEvidence(snapshot);
  const missingEvidence = requiredEvidence.filter(
    (item) => !gatheredEvidence.includes(item),
  );
  const confirmationBinding = buildExecutionBinding(confirmation);
  const pendingQuote = confirmation?.quote || extractLatestTradeQuote(snapshot);
  const latestReceipt =
    confirmation?.receipt || extractLatestExecutionReceipt(snapshot);
  const taskScope = resolveTaskScope(snapshot);

  return stripEmptyEntries({
    carry_forward_rule:
      "Reuse confirmed state from this object unless the latest user turn explicitly overrides it.",
    task_state: {
      scope: taskScope.scope,
      scope_source: taskScope.source,
      current_goal: buildCurrentGoal(snapshot),
      completion_rule: buildCompletionRule(snapshot, missingEvidence),
    },
    mode_progress_state: buildModeProgressState({
      snapshot,
      pendingQuote,
      latestReceipt,
      missingEvidence,
    }),
    execution_state: stripEmptyEntries({
      phase: resolveExecutionPhase(snapshot),
      pending_action: actionState?.pendingAction || "none",
      pending_confirmation: confirmation?.kind || null,
      confirmation_binding: confirmationBinding,
      pending_quote: pendingQuote,
      latest_receipt: latestReceipt,
    }),
    evidence_state: stripEmptyEntries({
      required: requiredEvidence,
      gathered: gatheredEvidence,
      missing: missingEvidence,
      recent_tools: recentToolNames(snapshot),
    }),
    next_action_state: buildNextActionState(snapshot, missingEvidence),
    carry_forward_entities: buildCarryForwardEntities(snapshot),
  });
}

export function buildDirectFollowupExecutionPlan(params: {
  snapshot: ChatContextSnapshot;
  taskToolContext?: Record<string, any> | null | undefined;
}): DirectFollowupExecutionPlan | null {
  const confirmation = params.snapshot.confirmationState;
  if (!confirmation?.kind) return null;

  if (confirmation.kind === "swap_confirmation" && confirmation.swap) {
    const swap = confirmation.swap;
    const toolName = swap.isCrossChain
      ? "prepare_cross_chain_tx"
      : "prepare_swap_transaction";
    const args = swap.isCrossChain
      ? stripEmptyEntries({
          fromToken: swap.tokenIn,
          toToken: swap.tokenOut,
          fromAmount: swap.amountIn,
          fromChain: swap.chainId,
          toChain: swap.toChain,
        })
      : stripEmptyEntries({
          token_in: swap.tokenIn,
          token_out: swap.tokenOut,
          amount_in: swap.amountIn,
          chain_id: swap.chainId,
          slippage: params.taskToolContext?.toolConfig?.customSlippage
            ? Number(params.taskToolContext.toolConfig.customSlippage)
            : 1.0,
          execute: true,
        });
    const bindingKey = computeConfirmationToken(
      toolName,
      args,
      params.snapshot.policySnapshot?.policyDecisionId,
    );
    return {
      action_kind: "swap",
      tool_name: toolName,
      args,
      execution_gate: {
        phase: "execute",
        confirmationToken: bindingKey,
      },
      binding: {
        binding_kind: "derived_execute_args",
        binding_key: bindingKey,
        tool_name: toolName,
        action_class: "TRADE_MUTATION",
        source_tool:
          confirmation.sourceTool || confirmation.binding?.tool_name || null,
        captured_at:
          confirmation.capturedAt || confirmation.binding?.captured_at || null,
      },
    };
  }

  if (
    confirmation.kind === "copy_trade_confirmation" &&
    confirmation.copyTrade
  ) {
    const copy = confirmation.copyTrade;
    const args = stripEmptyEntries({
      target_wallet: copy.targetWallet,
      buy_amount_usd: copy.buyAmountUsd,
      chain_id: copy.chainId,
      mirror_sell: copy.mirrorSell,
      take_profit_pct: copy.takeProfitPct,
      stop_loss_pct: copy.stopLossPct,
    });
    const bindingKey = computeConfirmationToken(
      "create_copy_trade_config",
      args,
      params.snapshot.policySnapshot?.policyDecisionId,
    );
    return {
      action_kind: "copy_trade",
      tool_name: "create_copy_trade_config",
      args,
      execution_gate: {
        phase: "execute",
        confirmationToken: bindingKey,
      },
      binding: {
        binding_kind: "derived_execute_args",
        binding_key: bindingKey,
        tool_name: "create_copy_trade_config",
        action_class: "ORDER_MUTATION",
        source_tool:
          confirmation.sourceTool || confirmation.binding?.tool_name || null,
        captured_at:
          confirmation.capturedAt || confirmation.binding?.captured_at || null,
      },
      extra_tool_context: copy.walletBinding
        ? { __copyTradeWalletBindingAudit: copy.walletBinding }
        : undefined,
    };
  }

  if (confirmation.kind === "order_confirmation" && confirmation.order) {
    const args = normalizeOrderExecutionArgs(confirmation.order);
    const bindingKey = resolveOrderConfirmationToken(confirmation.order, args);
    if (!bindingKey) return null;
    return {
      action_kind: "order",
      tool_name: confirmation.order.toolName,
      args,
      execution_gate: {
        phase: "execute",
        confirmationToken: bindingKey,
      },
      binding: buildExecutionBinding({
        ...confirmation,
        order: {
          ...confirmation.order,
          args,
          confirmationToken: bindingKey,
        },
      }),
    };
  }

  return null;
}

function resolveTaskScope(snapshot: ChatContextSnapshot): {
  scope: WorkerConversationState["task_state"]["scope"];
  source: WorkerConversationState["task_state"]["scope_source"];
} {
  const actionState = snapshot.conversationActionState || null;
  if (snapshot.confirmationState?.kind) {
    return {
      scope: actionState?.canExecute
        ? "pending_execution"
        : "pending_confirmation",
      source: "confirmation_state",
    };
  }
  if (looksLikeTokenTurn(snapshot) || snapshot.polymarketSelection) {
    return {
      scope: "carry_forward_session",
      source: "carry_forward_entities",
    };
  }
  return {
    scope: "fresh_request",
    source: "fresh_turn_no_carry_forward",
  };
}

function buildCurrentGoal(snapshot: ChatContextSnapshot): string {
  const confirmation = snapshot.confirmationState || null;
  if (confirmation?.kind === "swap_confirmation") {
    return "Continue the prepared swap flow with the existing pair and amount instead of restarting discovery.";
  }
  if (confirmation?.kind === "copy_trade_confirmation") {
    return "Continue the prepared copy-trade configuration with the same target wallet and sizing.";
  }
  if (
    confirmation?.kind === "order_confirmation" &&
    confirmation.order?.toolName
  ) {
    return `Continue the prepared ${confirmation.order.toolName} action without changing its bound arguments.`;
  }
  if (snapshot.polymarketSelection?.preparedSelection?.tokenId) {
    return "Continue from the prepared Polymarket selection instead of rediscovering the market.";
  }
  return "Answer the current user request from carry-forward state plus only the missing evidence needed for this turn.";
}

function buildCompletionRule(
  snapshot: ChatContextSnapshot,
  missingEvidence: string[],
): string {
  const actionState = snapshot.conversationActionState || null;
  if (snapshot.confirmationState?.kind && actionState?.canExecute) {
    return "Execute only the already prepared action that matches the stored binding and then report the real result.";
  }
  if (snapshot.confirmationState?.kind) {
    return "Do not restart discovery; wait for the user to confirm or clarify the prepared action.";
  }
  if (missingEvidence.length > 0) {
    return `Gather only the missing evidence types before concluding: ${missingEvidence.join(", ")}.`;
  }
  return "Answer directly from the currently confirmed state and evidence.";
}

function resolveExecutionPhase(
  snapshot: ChatContextSnapshot,
): WorkerConversationState["execution_state"]["phase"] {
  const actionState = snapshot.conversationActionState || null;
  if (snapshot.confirmationState?.kind) {
    return actionState?.canExecute
      ? "ready_to_execute"
      : "awaiting_confirmation";
  }
  if (actionState?.pendingAction && actionState.pendingAction !== "none") {
    return "prepared";
  }
  return "idle";
}

function resolveConfirmationProgressMode(
  confirmation: TradeConfirmationState | null | undefined,
): WorkerModeProgressState["mode"] {
  if (
    confirmation?.kind === "order_confirmation" &&
    confirmation.order?.toolName === "deploy_clanker_token"
  ) {
    return "token_deploy";
  }
  if (confirmation?.kind === "order_confirmation") {
    return "polymarket";
  }
  return "trade_confirmation";
}

function buildModeProgressState(params: {
  snapshot: ChatContextSnapshot;
  pendingQuote: TradeQuoteState | null;
  latestReceipt: ExecutionReceiptState | null;
  missingEvidence: string[];
}): WorkerModeProgressState {
  const { snapshot, pendingQuote, latestReceipt, missingEvidence } = params;
  const actionState = snapshot.conversationActionState || null;
  const confirmation = snapshot.confirmationState || null;
  const completed = new Set<string>();
  const pending = new Set<string>();
  const missing = new Set<string>();
  const toolNames = recentToolNames(snapshot) || [];
  const query = String(snapshot.lastUserMessage || "").toLowerCase();

  if (latestReceipt) {
    return {
      mode:
        latestReceipt.tool_name === "deploy_clanker_token"
          ? "token_deploy"
          : "trade_confirmation",
      internal_state: "executed",
      state_source: "recent_tool_trace",
      completed_steps: [
        "identify_intent",
        "identify_target",
        "identify_chain",
        "quote_or_prepare",
        "user_confirmed",
        "execute",
      ],
      pending_steps: ["report_result"],
    };
  }

  if (confirmation?.kind && actionState?.canExecute) {
    return {
      mode: resolveConfirmationProgressMode(confirmation),
      internal_state: "ready_to_execute",
      state_source: "confirmation_state",
      completed_steps: [
        "identify_intent",
        "identify_target",
        "identify_chain",
        "quote_or_prepare",
        "user_confirmed",
      ],
      pending_steps: ["execute", "report_result"],
    };
  }

  if (confirmation?.kind) {
    return {
      mode: resolveConfirmationProgressMode(confirmation),
      internal_state: "awaiting_confirmation",
      state_source: "confirmation_state",
      completed_steps: [
        "identify_intent",
        "identify_target",
        "identify_chain",
        "quote_or_prepare",
      ],
      pending_steps: [
        "wait_for_user_confirmation",
        "execute_after_confirmation",
      ],
    };
  }

  if (pendingQuote) {
    completed.add("identify_intent");
    completed.add("identify_target");
    if (pendingQuote.chain_id || pendingQuote.to_chain)
      completed.add("identify_chain");
    completed.add("quote_or_prepare");
    if (pendingQuote.stale) {
      pending.add("refresh_quote");
      missing.add("fresh_quote");
    } else {
      pending.add("ask_user_confirmation");
    }
    return normalizeModeProgress({
      mode: "swap_quote",
      internal_state: pendingQuote.stale ? "quote_needed" : "quote_ready",
      state_source: "recent_tool_trace",
      completed,
      pending,
      missing,
    });
  }

  if (snapshot.polymarketSelection?.preparedSelection?.tokenId) {
    return {
      mode: "polymarket",
      internal_state: "target_identified",
      state_source: "polymarket_selection",
      completed_steps: [
        "identify_market",
        "identify_outcome",
        "resolve_token_id",
      ],
      pending_steps: [
        "quote_or_check_readiness",
        "ask_user_confirmation_or_amount",
      ],
      missing_fields: snapshot.polymarketSelection.preparedSelection.amountUsd
        ? undefined
        : ["amount_usd"],
    };
  }

  if (snapshot.polymarketSelection) {
    return {
      mode: "polymarket",
      internal_state: "evidence_gathered",
      state_source: "polymarket_selection",
      completed_steps: ["discover_market_candidates"],
      pending_steps: ["select_exact_market_and_outcome"],
    };
  }

  if (actionState?.needsClarification) {
    return {
      mode: inferModeFromSnapshot(snapshot),
      internal_state: "needs_clarification",
      state_source: inferModeStateSource(snapshot),
      completed_steps: [],
      pending_steps: ["ask_one_precise_clarification"],
      missing_fields: [actionState.clarificationQuestion || "required_field"],
    };
  }

  if (actionState?.pendingAction && actionState.pendingAction !== "none") {
    completed.add("identify_intent");
    if (
      (snapshot.requestedTokenAddresses || []).length > 0 ||
      (snapshot.requestedTokenSymbols || []).length > 0
    ) {
      completed.add("identify_target");
    } else {
      pending.add("identify_target");
      missing.add("target");
    }
    if (
      resolveCanonicalChainRef({
        canonicalIntent: snapshot.normalizedIntent || null,
        requestedTokenAddresses: snapshot.requestedTokenAddresses,
        requestedTokenSymbols: snapshot.requestedTokenSymbols,
        runtimeChainId: snapshot.runtime.chainId,
        runtimeChainName: snapshot.runtime.chainName,
      })
    ) {
      completed.add("identify_chain");
    } else {
      pending.add("identify_chain");
      missing.add("chain");
    }
    pending.add("quote_or_prepare");
    return normalizeModeProgress({
      mode: actionState.pendingAction === "order" ? "polymarket" : "swap_quote",
      internal_state: "quote_needed",
      state_source: "normalized_intent",
      completed,
      pending,
      missing,
    });
  }

  if (toolNames.some((tool) => SEARCH_EVIDENCE_TOOLS.has(tool))) {
    return {
      mode: "market_research",
      internal_state:
        missingEvidence.length > 0 ? "evidence_required" : "evidence_gathered",
      state_source: "recent_tool_trace",
      completed_steps: ["identify_research_question", "gather_search_evidence"],
      pending_steps:
        missingEvidence.length > 0
          ? ["gather_missing_evidence", "synthesize_answer"]
          : ["synthesize_answer"],
      missing_fields: missingEvidence.length > 0 ? missingEvidence : undefined,
    };
  }

  if (
    toolNames.some((tool) => TOKEN_EVIDENCE_TOOLS.has(tool)) ||
    looksLikeTokenTurn(snapshot)
  ) {
    return {
      mode: "token_analysis",
      internal_state: toolNames.some((tool) => TOKEN_EVIDENCE_TOOLS.has(tool))
        ? "evidence_gathered"
        : "context_required",
      state_source: toolNames.some((tool) => TOKEN_EVIDENCE_TOOLS.has(tool))
        ? "recent_tool_trace"
        : "latest_user_message",
      completed_steps: toolNames.some((tool) => TOKEN_EVIDENCE_TOOLS.has(tool))
        ? ["identify_token", "gather_token_evidence"]
        : ["identify_token_or_hint"],
      pending_steps: toolNames.some((tool) => TOKEN_EVIDENCE_TOOLS.has(tool))
        ? ["synthesize_answer"]
        : ["read_token_context", "gather_required_evidence"],
    };
  }

  if (
    toolNames.some((tool) => WALLET_EVIDENCE_TOOLS.has(tool)) ||
    looksLikeWalletTurn(query)
  ) {
    return {
      mode: "wallet_read",
      internal_state: toolNames.some((tool) => WALLET_EVIDENCE_TOOLS.has(tool))
        ? "evidence_gathered"
        : "context_required",
      state_source: toolNames.some((tool) => WALLET_EVIDENCE_TOOLS.has(tool))
        ? "recent_tool_trace"
        : "latest_user_message",
      completed_steps: toolNames.some((tool) => WALLET_EVIDENCE_TOOLS.has(tool))
        ? ["identify_wallet_scope", "read_wallet_evidence"]
        : ["identify_wallet_scope"],
      pending_steps: toolNames.some((tool) => WALLET_EVIDENCE_TOOLS.has(tool))
        ? ["synthesize_answer"]
        : ["read_user_context", "read_wallet_state"],
    };
  }

  if (looksLikeMetaDebugTurn(query)) {
    return {
      mode: "meta_debug",
      internal_state: "context_required",
      state_source: "latest_user_message",
      completed_steps: ["identify_debug_question"],
      pending_steps: ["read_workflow_state", "explain_root_cause"],
    };
  }

  if (snapshot.runtime?.socialInput) {
    return {
      mode:
        Array.isArray(snapshot.runtime.socialInput.images) &&
        snapshot.runtime.socialInput.images.length > 0
          ? "image_chat"
          : "social_thread",
      internal_state: "context_required",
      state_source: "runtime_surface",
      completed_steps: ["identify_social_surface"],
      pending_steps: [
        "read_relevant_social_context",
        "answer_in_surface_style",
      ],
    };
  }

  return {
    mode: "lean_chat",
    internal_state: "fresh_answer",
    state_source: "fresh_turn",
    completed_steps: ["understand_request"],
    pending_steps: ["answer_directly"],
  };
}

function normalizeModeProgress(params: {
  mode: WorkerModeProgressState["mode"];
  internal_state: WorkerModeProgressState["internal_state"];
  state_source: WorkerModeProgressState["state_source"];
  completed: Set<string>;
  pending: Set<string>;
  missing: Set<string>;
}): WorkerModeProgressState {
  return stripEmptyEntries({
    mode: params.mode,
    internal_state: params.internal_state,
    state_source: params.state_source,
    completed_steps: Array.from(params.completed),
    pending_steps: Array.from(params.pending),
    missing_fields: Array.from(params.missing),
  }) as WorkerModeProgressState;
}

function buildExecutionBinding(
  confirmation: TradeConfirmationState | null | undefined,
): ExecutionBindingState | null {
  if (!confirmation?.kind) return null;
  if (confirmation.binding && confirmation.kind !== "order_confirmation") return confirmation.binding;
  if (confirmation.order?.toolName) {
    const args = normalizeOrderExecutionArgs(confirmation.order);
    const binding: ExecutionBindingState = {
      binding_kind: "prepared_confirmation",
      binding_key: resolveOrderConfirmationToken(confirmation.order, args) || undefined,
      tool_name: confirmation.order.toolName,
      action_class: confirmation.order.actionClass,
      source_tool: confirmation.sourceTool || confirmation.order.toolName,
      captured_at: confirmation.capturedAt,
    };
    return stripEmptyEntries(binding) as ExecutionBindingState;
  }
  if (confirmation.sourceTool) {
    const binding: ExecutionBindingState = {
      binding_kind: "preflight_quote",
      tool_name: confirmation.sourceTool,
      action_class:
        confirmation.kind === "swap_confirmation" ? "TRADE_MUTATION" : null,
      source_tool: confirmation.sourceTool,
      captured_at: confirmation.capturedAt,
    };
    return stripEmptyEntries(binding) as ExecutionBindingState;
  }
  return null;
}

function normalizeOrderExecutionArgs(
  order: TradeConfirmationState["order"] | null | undefined,
): Record<string, any> {
  const args = {
    ...((order?.args && typeof order.args === "object") ? order.args : {}),
  };
  if (String(order?.toolName || "") === "deploy_clanker_token") {
    return {
      ...args,
      confirmDeploy: true,
    };
  }
  return args;
}

function resolveOrderConfirmationToken(
  order: TradeConfirmationState["order"] | null | undefined,
  args: Record<string, any>,
): string | null {
  if (!order?.toolName) return null;
  return computeConfirmationToken(order.toolName, args, undefined);
}

function deriveGatheredEvidence(snapshot: ChatContextSnapshot): string[] {
  const gathered = new Set<string>();
  const tools = snapshot.recentToolTrace?.toolCalls || [];
  for (const call of tools) {
    const toolName = String(call?.tool || "").trim();
    if (!toolName) continue;
    if (SEARCH_EVIDENCE_TOOLS.has(toolName))
      gathered.add("native_search_results");
    if (TOKEN_EVIDENCE_TOOLS.has(toolName))
      gathered.add("onchain_token_evidence");
    if (WALLET_EVIDENCE_TOOLS.has(toolName))
      gathered.add("onchain_wallet_evidence");
    if (["simulate_swap", "get_cross_chain_quote"].includes(toolName))
      gathered.add("execution_quote");
    if (
      [
        "simulate_swap",
        "prepare_swap_transaction",
        "get_cross_chain_quote",
        "prepare_cross_chain_tx",
      ].includes(toolName)
    ) {
      gathered.add("connected_chain_evidence");
      gathered.add("execution_preflight");
    }
    if (
      ["prepare_swap_transaction", "prepare_cross_chain_tx"].includes(
        toolName,
      ) &&
      extractExecutionReceiptFromCall(call)
    ) {
      gathered.add("execution_receipt");
    }
  }
  const effectiveChain = resolveCanonicalChainRef({
    canonicalIntent: snapshot.normalizedIntent || null,
    requestedTokenAddresses: snapshot.requestedTokenAddresses,
    requestedTokenSymbols: snapshot.requestedTokenSymbols,
    runtimeChainId: snapshot.runtime.chainId,
    runtimeChainName: snapshot.runtime.chainName,
  });
  if (effectiveChain?.chainId || effectiveChain?.chainName) {
    gathered.add("connected_chain_evidence");
  }
  if (snapshot.polymarketSelection?.preparedSelection?.tokenId) {
    gathered.add("verified_polymarket_token_id");
  }
  return Array.from(gathered);
}

function extractLatestTradeQuote(
  snapshot: ChatContextSnapshot,
): TradeQuoteState | null {
  const calls = snapshot.recentToolTrace?.toolCalls || [];
  for (let idx = calls.length - 1; idx >= 0; idx -= 1) {
    const call = calls[idx];
    if (!["success", "cached"].includes(String(call?.status || ""))) continue;
    const toolName = String(call?.tool || "").trim();
    if (
      ![
        "simulate_swap",
        "prepare_swap_transaction",
        "get_cross_chain_quote",
        "prepare_cross_chain_tx",
      ].includes(toolName)
    )
      continue;
    const args =
      call?.args && typeof call.args === "object"
        ? (call.args as Record<string, any>)
        : {};
    const result =
      call?.result && typeof call.result === "object"
        ? (call.result as Record<string, any>)
        : {};
    const isCrossChain =
      toolName === "get_cross_chain_quote" ||
      toolName === "prepare_cross_chain_tx";
    const tokenIn = isCrossChain ? args.fromToken : args.token_in;
    const tokenOut = isCrossChain ? args.toToken : args.token_out;
    const amountIn = isCrossChain ? args.fromAmount : args.amount_in;
    if (!tokenIn || !tokenOut || !amountIn) continue;
    if (
      !hasQuotePayload(result) &&
      !["simulate_swap", "get_cross_chain_quote"].includes(toolName)
    )
      continue;
    const expiresAt = normalizeTimestamp(
      result.expiresAt ||
        result.expires_at ||
        result.quoteExpiresAt ||
        result.validUntil,
    );
    const staleState = resolveQuoteStaleState(expiresAt, result);
    return stripEmptyEntries({
      quote_id: normalizeString(result.quoteId || result.quote_id || result.id),
      tool_name: toolName,
      token_in: normalizeString(tokenIn),
      token_out: normalizeString(tokenOut),
      amount_in: normalizeString(amountIn),
      chain_id: normalizeNumber(isCrossChain ? args.fromChain : args.chain_id),
      to_chain: isCrossChain ? normalizeNumber(args.toChain) : undefined,
      is_cross_chain: isCrossChain,
      expected_out:
        result.expected_out_human ??
        result.expected_out ??
        result.amountOut ??
        result.amount_out ??
        result.outputAmount ??
        null,
      price_impact: result.price_impact ?? result.priceImpact ?? null,
      quoted_at:
        normalizeTimestamp(
          result.quotedAt || result.quoted_at || result.timestamp,
        ) || extractCallTimestamp(call),
      expires_at: expiresAt,
      stale: staleState.stale,
      stale_reason: staleState.reason,
    }) as TradeQuoteState;
  }
  return null;
}

function hasQuotePayload(result: Record<string, any>): boolean {
  return (
    result.expected_out_human !== undefined ||
    result.expected_out !== undefined ||
    result.amountOut !== undefined ||
    result.amount_out !== undefined ||
    result.outputAmount !== undefined ||
    result.price_impact !== undefined ||
    result.priceImpact !== undefined ||
    result.quoteId !== undefined ||
    result.quote_id !== undefined ||
    result.expiresAt !== undefined ||
    result.expires_at !== undefined ||
    result.quoteExpiresAt !== undefined ||
    result.validUntil !== undefined
  );
}

function extractLatestExecutionReceipt(
  snapshot: ChatContextSnapshot,
): ExecutionReceiptState | null {
  const calls = snapshot.recentToolTrace?.toolCalls || [];
  for (let idx = calls.length - 1; idx >= 0; idx -= 1) {
    const receipt = extractExecutionReceiptFromCall(calls[idx]);
    if (receipt) return receipt;
  }
  return null;
}

function extractExecutionReceiptFromCall(
  call: any,
): ExecutionReceiptState | null {
  const toolName = String(call?.tool || "").trim();
  if (
    ![
      "prepare_swap_transaction",
      "prepare_cross_chain_tx",
      "place_polymarket_order",
      "deploy_clanker_token",
    ].includes(toolName)
  ) {
    return null;
  }
  const result =
    call?.result && typeof call.result === "object"
      ? (call.result as Record<string, any>)
      : {};
  const txHash = normalizeString(
    result.txHash || result.transactionHash || result.hash,
  );
  const txUrl = normalizeString(
    result.txUrl ||
      result.tx_url ||
      result.sourceExplorerUrl ||
      result.lifiExplorerUrl ||
      result.explorerLink,
  );
  const explorerUrl = normalizeString(
    result.explorerUrl || result.explorer_url || txUrl,
  );
  const orderId = normalizeString(result.order_id || result.orderId);
  const replacedOrderId = normalizeString(
    result.replaced_order_id || result.replacedOrderId,
  );
  const tokenAddress = normalizeString(
    result.tokenAddress || result.token_address,
  );
  const tokenUrl = normalizeString(result.tokenUrl || result.token_url);
  const marketSlug = normalizeString(result.market_slug || result.marketSlug);
  const marketUrl = normalizeString(result.market_url || result.marketUrl);
  const rawStatus =
    result.status ?? result.txStatus ?? result.receipt?.status ?? null;
  if (
    !txHash &&
    !txUrl &&
    !explorerUrl &&
    !orderId &&
    !replacedOrderId &&
    !tokenAddress &&
    !tokenUrl &&
    !marketSlug &&
    !marketUrl &&
    rawStatus === null &&
    rawStatus === undefined
  ) {
    return null;
  }
  return stripEmptyEntries({
    tool_name: toolName,
    tx_hash: txHash,
    tx_url: txUrl,
    explorer_url: explorerUrl,
    chain_id: normalizeNumber(
      result.chainId ||
        result.chain_id ||
        call?.args?.chain_id ||
        call?.args?.fromChain,
    ),
    order_id: orderId,
    replaced_order_id: replacedOrderId,
    token_address: tokenAddress,
    token_url: tokenUrl,
    market_slug: marketSlug,
    market_url: marketUrl,
    status: normalizeReceiptStatus(rawStatus, Boolean(txHash)),
    submitted_at:
      normalizeTimestamp(result.submittedAt || result.submitted_at) ||
      extractCallTimestamp(call),
    completed_at: normalizeTimestamp(
      result.completedAt || result.completed_at || result.finishedAt,
    ),
    raw_status: rawStatus,
  }) as ExecutionReceiptState;
}

function resolveQuoteStaleState(
  expiresAt: string | null,
  result: Record<string, any>,
): { stale: boolean; reason: string | null } {
  if (result.expired === true || result.stale === true)
    return { stale: true, reason: "quote_marked_stale_by_tool" };
  if (!expiresAt) return { stale: false, reason: null };
  const expiresMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresMs)) return { stale: false, reason: null };
  return expiresMs <= Date.now()
    ? { stale: true, reason: "quote_expired" }
    : { stale: false, reason: null };
}

function normalizeReceiptStatus(
  value: unknown,
  hasTxHash: boolean,
): ExecutionReceiptState["status"] {
  if (
    value === true ||
    value === "success" ||
    value === "submitted" ||
    value === "0x1" ||
    value === 1
  ) {
    return value === "submitted" ? "submitted" : "success";
  }
  if (
    value === false ||
    value === "failed" ||
    value === "reverted" ||
    value === "0x0" ||
    value === 0
  ) {
    return "failed";
  }
  return hasTxHash ? "submitted" : "unknown";
}

function buildNextActionState(
  snapshot: ChatContextSnapshot,
  missingEvidence: string[],
) {
  const actionState = snapshot.conversationActionState || null;
  if (actionState?.needsClarification) {
    return {
      kind: "ask_user_clarification",
      reason:
        actionState.clarificationQuestion ||
        "A required field is still ambiguous.",
    } as const;
  }
  if (snapshot.confirmationState?.kind && actionState?.canExecute) {
    return {
      kind: "execute_confirmed_action",
      reason:
        "The user is on a confirmation turn and the prepared action can be executed if the binding still matches.",
      tool_name:
        snapshot.confirmationState.binding?.tool_name ||
        snapshot.confirmationState.order?.toolName ||
        snapshot.confirmationState.sourceTool ||
        null,
    } as const;
  }
  if (snapshot.confirmationState?.kind) {
    return {
      kind: "wait_for_user_confirmation",
      reason:
        "A prepared action already exists and should not be rediscovered before the user confirms it.",
      tool_name:
        snapshot.confirmationState.binding?.tool_name ||
        snapshot.confirmationState.order?.toolName ||
        null,
    } as const;
  }
  if (missingEvidence.length > 0) {
    return {
      kind: "call_tool",
      reason: `Missing required evidence: ${missingEvidence.join(", ")}.`,
    } as const;
  }
  return {
    kind: "answer",
    reason:
      "Current state and evidence are sufficient to answer the user directly.",
  } as const;
}

function buildCarryForwardEntities(
  snapshot: ChatContextSnapshot,
): Record<string, any> | undefined {
  const runtime = snapshot.runtime || {};
  const effectiveChain = resolveCanonicalChainRef({
    canonicalIntent: snapshot.normalizedIntent || null,
    requestedTokenAddresses: snapshot.requestedTokenAddresses,
    requestedTokenSymbols: snapshot.requestedTokenSymbols,
    runtimeChainId: runtime.chainId,
    runtimeChainName: runtime.chainName,
  });
  return stripEmptyEntries({
    connected_wallet: runtime.walletAddress || runtime.userAddress,
    effective_chain: effectiveChain
      ? stripEmptyEntries({
          chain_id: effectiveChain.chainId,
          chain_name: effectiveChain.chainName,
          source: effectiveChain.source,
        })
      : undefined,
    token_symbols: (snapshot.requestedTokenSymbols || []).slice(0, 6),
    token_addresses: (snapshot.requestedTokenAddresses || []).slice(0, 4),
    prepared_polymarket_selection: snapshot.polymarketSelection
      ?.preparedSelection
      ? stripEmptyEntries({
          question: snapshot.polymarketSelection.preparedSelection.question,
          outcome: snapshot.polymarketSelection.preparedSelection.outcome,
          token_id: snapshot.polymarketSelection.preparedSelection.tokenId,
          amount_usd: snapshot.polymarketSelection.preparedSelection.amountUsd,
          market_slug:
            snapshot.polymarketSelection.preparedSelection.marketSlug,
        })
      : undefined,
    social_thread_context_available:
      Boolean(String(runtime.socialInput?.threadContextText || "").trim()) ||
      undefined,
    images_in_scope:
      Array.isArray(runtime.socialInput?.images) &&
      runtime.socialInput.images.length > 0
        ? runtime.socialInput.images.length
        : undefined,
  });
}

function inferModeFromSnapshot(
  snapshot: ChatContextSnapshot,
): WorkerModeProgressState["mode"] {
  const actionState = snapshot.conversationActionState || null;
  const query = String(snapshot.lastUserMessage || "").toLowerCase();
  if (snapshot.confirmationState?.kind) {
    return resolveConfirmationProgressMode(snapshot.confirmationState);
  }
  if (
    actionState?.pendingAction === "swap" ||
    /(\b(buy|sell|swap|bridge|quote)\b|买|卖|换|交换|跨链|报价)/i.test(query)
  ) {
    return "swap_quote";
  }
  if (actionState?.pendingAction === "order" || snapshot.polymarketSelection)
    return "polymarket";
  if (looksLikeMetaDebugTurn(query)) return "meta_debug";
  if (looksLikeWalletTurn(query)) return "wallet_read";
  if (looksLikeTokenTurn(snapshot)) return "token_analysis";
  if (
    /(\b(latest|today|hot|trending|discover|news|shortlist)\b|最新|今天|热门|趋势|发现|新闻|名单)/i.test(
      query,
    )
  ) {
    return "market_research";
  }
  if (snapshot.runtime?.socialInput) return "social_thread";
  return "unknown";
}

function inferModeStateSource(
  snapshot: ChatContextSnapshot,
): WorkerModeProgressState["state_source"] {
  if (snapshot.confirmationState?.kind) return "confirmation_state";
  if (snapshot.polymarketSelection) return "polymarket_selection";
  if ((recentToolNames(snapshot) || []).length > 0) return "recent_tool_trace";
  if (snapshot.normalizedIntent?.intent) return "normalized_intent";
  if (snapshot.runtime?.socialInput) return "runtime_surface";
  return "latest_user_message";
}

function looksLikeWalletTurn(query: string): boolean {
  return /(\b(wallet|balance|holdings|portfolio|pnl|profit|loss|position|afford)\b|钱包|余额|持仓|资产|收益|利润|亏损|仓位)/i.test(
    query,
  );
}

function looksLikeMetaDebugTurn(query: string): boolean {
  return /(\b(why did|why was|debug|log|logs|routing|architecture|prompt|tool|terminated|fallback|hardcoded)\b|为什么|日志|架构|提示词|工具|路由|硬编码|终止|报错|错误原因)/i.test(
    query,
  );
}

function looksLikeTokenTurn(snapshot: ChatContextSnapshot): boolean {
  const query = String(snapshot.lastUserMessage || "");
  return (
    tokenEntityMentionedInQuery(snapshot, query) ||
    (hasRequestedTokenEntity(snapshot) && looksLikeContinuationTurn(query)) ||
    String(snapshot.normalizedIntent?.domain || "").toLowerCase() === "token" ||
    String(snapshot.normalizedIntent?.intent || "")
      .toLowerCase()
      .includes("token") ||
    /(\b(token|contract|holder|holders|risk|creator|early buyer|early buyers|fdv|liquidity)\b|代币|合约|持有人|风险|创建者|早期购买者|流动性)/i.test(
      query,
    )
  );
}

function hasRequestedTokenEntity(snapshot: ChatContextSnapshot): boolean {
  return (
    (snapshot.requestedTokenAddresses || []).length > 0 ||
    (snapshot.requestedTokenSymbols || []).length > 0
  );
}

function tokenEntityMentionedInQuery(
  snapshot: ChatContextSnapshot,
  query: string,
): boolean {
  const lower = query.toLowerCase();
  return (
    (snapshot.requestedTokenAddresses || []).some((address) => {
      const value = String(address || "")
        .trim()
        .toLowerCase();
      return value.length > 0 && lower.includes(value);
    }) ||
    (snapshot.requestedTokenSymbols || []).some((symbol) => {
      const value = String(symbol || "").trim();
      if (!value) return false;
      return new RegExp(
        `(^|[^a-z0-9])${escapeRegExp(value)}([^a-z0-9]|$)`,
        "i",
      ).test(query);
    })
  );
}

function looksLikeContinuationTurn(query: string): boolean {
  return /(^|\b)(this|that|it|them|those|continue|yes|ok|okay|confirm|go ahead|same one|sell it|buy it)(\b|$)|这个|那个|它|他们|这些|继续|确认|同意|可以|就这个|卖它|买它/i.test(
    query,
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractCallTimestamp(call: any): string | null {
  const value = String(
    call?.finishedAt ||
      call?.result?.finishedAt ||
      call?.result?.timestamp ||
      call?.result?.quotedAt ||
      "",
  ).trim();
  return value || null;
}

function normalizeTimestamp(value: unknown): string | null {
  const text = normalizeString(value);
  if (!text) return null;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : text;
}

function normalizeString(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : null;
}

function recentToolNames(snapshot: ChatContextSnapshot): string[] | undefined {
  const tools = (snapshot.recentToolTrace?.toolCalls || [])
    .slice(-6)
    .map((call) => String(call?.tool || "").trim())
    .filter(Boolean);
  return tools.length > 0 ? tools : undefined;
}

function stripEmptyEntries<T extends Record<string, any>>(value: T): T {
  const entries = Object.entries(value).filter(([, item]) => {
    if (item === null || item === undefined) return false;
    if (Array.isArray(item) && item.length === 0) return false;
    if (
      typeof item === "object" &&
      !Array.isArray(item) &&
      Object.keys(item).length === 0
    )
      return false;
    return true;
  });
  return Object.fromEntries(entries) as T;
}
