// CONTEXT MEMORY
// Updated: 2026-04-18
// Author: Rowan
// Reason: copy-trade creation executes on a later confirmation turn where the
//         latest user message is often just "confirm", so wallet provenance from
//         the original request must be carried explicitly and the confirmed
//         strategy card must still appear even if the generic broker-side effect
//         path does not emit a live client action. Product correction on
//         2026-04-18 removed backend-authored trade outcome summaries so this
//         layer only emits tool-authored text and client actions. Execution
//         receipt review on 2026-04-19 moved hash/order/token URL replies into
//         the shared post-tool receipt formatter so confirmation follow-ups and
//         normal tool rounds produce the same receipt answer.
// Goal: execute confirmed copy-trade tools with the same wallet-binding audit
//       evidence captured during preflight and preserve immediate in-chat card
//       rendering for direct follow-up confirmations, without inventing
//       user-facing reply text in the worker.
// Owns: direct follow-up execution for confirmed trade/order actions.
// Does Not Own: extracting wallets, validating copy-trade config payloads, or
//               writing wallet audit records.
// Design Language:
// - confirmation tokens bind public tool args
// - audit provenance rides in tool context, not public args
// - confirmation follow-up must not re-derive target wallets from "confirm"
// - direct follow-up must rescue critical live cards when generic broker side
//   effects lag or silently miss websocket emission
// - direct follow-up may surface tool-authored summaries or raw tool errors, but must not synthesize trade outcome prose
// - direct follow-up should execute from one deterministic plan object, not kind-specific branches spread across this file
// - direct follow-up receipt text must come from the shared tool-result hook
//   before falling back to legacy tool-authored summaries
// Document Provenance:
// - Source: production incident analysis of malformed BSC copy-trade target wallets
// - Kind: runtime observation
// - Retrieved: 2026-04-14
// - Applied To: passing copy-trade walletBinding through execute follow-up context
// - Verification: verified in TypeScript and targeted tests
// - Source: /Users/almurat/Downloads/logs.1776097267399.json
// - Kind: runtime observation
// - Retrieved: 2026-04-14
// - Applied To: confirming confirmed copy-trade execution without any emitted
//   `show_strategy_card` / `client_action` trace in the live follow-up path
// - Verification: partially verified
// - Source: /Users/almurat/Downloads/logs.1776445174160.json
// - Kind: runtime observation
// - Retrieved: 2026-04-18
// - Applied To: removing direct follow-up fixed summaries and precheck prose
// - Verification: verified in runtime and then removed in code
// - Source: product-owner runtime review of KiKo chat architecture
// - Kind: product instruction / runtime observation
// - Retrieved: 2026-04-18
// - Applied To: central direct-followup execution plan object
// - Verification: verified in code and targeted tests
// - Source: operator correction in local runtime thread about receipt prompt token waste
// - Kind: product instruction / runtime observation
// - Retrieved: 2026-04-19
// - Applied To: shared execution receipt formatter for confirmed follow-up tools
// - Verification: verified in code and targeted tests
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-14-copytrade-wallet-audit-provenance.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-14-copytrade-direct-followup-card-rescue.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-hardcoded-reply-path-removal.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-agent-execution-receipt-links.md
import * as chatRepo from '../../repositories/chatRepository.js';
import { chatWS } from '../../services/chatWebSocket.js';
import type { ChatContextSnapshot, OrchestratorToolResult } from './contracts.js';
import { ChatStreamBroker } from './streamBroker.js';
import type { ToolExecutionEngine } from './toolExecutionEngine.js';
import { buildDirectFollowupExecutionPlan } from './workerStateBuilder.js';
import { buildExecutionReceiptAnswer } from './executionReceiptAnswer.js';

export async function executeDirectTradeFollowup(params: {
    snapshot: ChatContextSnapshot;
    task: any;
    userId: string | null;
    broker: ChatStreamBroker;
    toolExecutionEngine: ToolExecutionEngine;
}): Promise<{ handled: boolean; toolResult?: OrchestratorToolResult }> {
    const taskMode = params.snapshot.normalizedIntent?.taskMode;
    if (taskMode !== 'confirm' && taskMode !== 'execute') {
        return { handled: false };
    }

    const confirmation = params.snapshot.confirmationState;
    if (!confirmation?.kind) return { handled: false };
    const plan = buildDirectFollowupExecutionPlan({
        snapshot: params.snapshot,
        taskToolContext: params.task.toolContext || null,
    });
    if (!plan) return { handled: false };

    const result = await invokeTool({
        toolName: plan.tool_name,
        args: plan.args,
        task: params.task,
        userId: params.userId,
        broker: params.broker,
        toolExecutionEngine: params.toolExecutionEngine,
        snapshot: params.snapshot,
        extraToolContext: plan.extra_tool_context,
        executionGate: plan.execution_gate,
    });
    return { handled: true, toolResult: result };
}

async function invokeTool(params: {
    toolName: string;
    args: Record<string, any>;
    task: any;
    userId: string | null;
    broker: ChatStreamBroker;
    toolExecutionEngine: ToolExecutionEngine;
    snapshot: ChatContextSnapshot;
    executionGate?: {
        phase: 'execute';
        confirmationToken?: string;
    };
    extraToolContext?: Record<string, any>;
}): Promise<OrchestratorToolResult> {
    const toolResult = await params.toolExecutionEngine.execute({
        id: `direct:${params.toolName}:${Date.now()}`,
        name: params.toolName,
        arguments: params.args,
    }, {
        ...(params.task.toolContext || {}),
        ...(params.extraToolContext || {}),
        sessionId: params.task.sessionId,
        messageId: params.task.assistantMessageId,
        userId: params.userId,
        recentToolTrace: params.snapshot.recentToolTrace,
        __controlPolicy: params.snapshot.policySnapshot || null,
        __snapshot: params.snapshot,
        __executionGate: params.executionGate,
    });
    toolResult.metadata = { ...(toolResult.metadata || {}), source: 'direct_followup' };
    await params.broker.recordToolResult(toolResult);

    await broadcastClientAction({
        task: params.task,
        userId: params.userId,
        assistantMessageId: params.task.assistantMessageId,
        toolName: params.toolName,
        result: toolResult.result,
    });

    const txMessageId = toolResult.result?.messageId;
    const locale = params.snapshot.normalizedIntent?.locale === 'en' ? 'en' : 'zh';
    const finalText = txMessageId
        ? ''
        : buildExecutionReceiptAnswer(toolResult, locale)
        || extractVisibleFollowupText(toolResult.result?.summary)
        || extractVisibleFollowupText(toolResult.error);
    await params.broker.complete({ content: finalText });
    return toolResult;
}

function extractVisibleFollowupText(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

async function broadcastClientAction(params: {
    task: any;
    userId: string | null;
    assistantMessageId: string;
    toolName: string;
    result: any;
}) {
    if (!params.userId) return;
    if (params.toolName === 'create_copy_trade_config' && params.result) {
        const strategyData = params.result;
        try {
            const existingMessage = await chatRepo.getMessage(params.assistantMessageId);
            await chatRepo.updateMessage(params.assistantMessageId, {
                type: 'strategy-card',
                data: {
                    ...(existingMessage?.data || {}),
                    ...(strategyData || {}),
                },
            });
        } catch {
            // Best-effort persistence rescue for the live assistant card.
        }
        chatWS.broadcastToUser(params.userId, {
            type: 'client_action',
            sessionId: params.task.sessionId,
            data: {
                message_id: params.assistantMessageId,
                targetMessageId: params.assistantMessageId,
                action: {
                    type: 'show_strategy_card',
                    data: strategyData,
                },
            },
        });
    }
    if (params.result?.__client_action) {
        chatWS.broadcastToUser(params.userId, {
            type: 'client_action',
            sessionId: params.task.sessionId,
            data: {
                message_id: params.assistantMessageId,
                targetMessageId: params.assistantMessageId,
                action: params.result.__client_action,
            },
        });
    }

    const txMessageId = params.result?.messageId;
    if (!txMessageId) return;
    try {
        const txMessage = await chatRepo.getMessage(txMessageId);
        const txData = txMessage?.data || {};
        chatWS.broadcastToUser(params.userId, {
            type: 'client_action',
            sessionId: params.task.sessionId,
            data: {
                message_id: params.assistantMessageId,
                targetMessageId: txMessageId,
                action: {
                    type: 'show_transaction_status_card',
                    data: txData,
                },
            },
        });
    } catch {
        // Best-effort compatibility broadcast.
    }
}
