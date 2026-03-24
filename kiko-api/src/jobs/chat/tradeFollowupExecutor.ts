import * as chatRepo from '../../repositories/chatRepository.js';
import { chatWS } from '../../services/chatWebSocket.js';
import type { ChatContextSnapshot, OrchestratorToolResult } from './contracts.js';
import { ChatStreamBroker } from './streamBroker.js';
import type { ToolExecutionEngine } from './toolExecutionEngine.js';
import { computeConfirmationToken } from './executionGate.js';
import { createPolicyError } from './controlPolicy.js';
import { isConfirmationMessage } from './conversationStateResolver.js';

export async function executeDirectTradeFollowup(params: {
    snapshot: ChatContextSnapshot;
    task: any;
    userId: string | null;
    broker: ChatStreamBroker;
    toolExecutionEngine: ToolExecutionEngine;
}): Promise<{ handled: boolean; toolResult?: OrchestratorToolResult }> {
    const confirmation = params.snapshot.confirmationState;
    const invalidConfirmation = resolveInvalidTradeConfirmation(params.snapshot);
    if (invalidConfirmation) {
        await params.broker.complete({ content: invalidConfirmation.userMessage });
        return {
            handled: true,
            toolResult: {
                id: `direct:${invalidConfirmation.code.toLowerCase()}:${Date.now()}`,
                name: invalidConfirmation.toolName,
                arguments: invalidConfirmation.args,
                ok: false,
                error: invalidConfirmation.error,
                reasonCode: invalidConfirmation.code,
                result: {
                    error: invalidConfirmation.error,
                    reason_code: invalidConfirmation.code,
                },
                metadata: { source: 'direct_followup_guard' },
            },
        };
    }
    if (!confirmation?.kind) return { handled: false };

    if (confirmation.kind === 'swap_confirmation' && confirmation.swap) {
        const swap = confirmation.swap;
        const quoteExpired = isQuoteExpiredFromTrace(params.snapshot);
        if (quoteExpired) {
            const policyError = createPolicyError(
                'CONFIRMATION_STALE_OR_MISMATCH',
                'Confirmation is stale. Please run preflight again and then confirm.',
                params.snapshot.policySnapshot || null,
            );
            await params.broker.complete({
                content: `Proceed confirmed, but execution failed: ${policyError.code}`,
            });
            return {
                handled: true,
                toolResult: {
                    id: `direct:swap_confirmation_stale:${Date.now()}`,
                    name: 'swap_confirmation_guard',
                    arguments: {},
                    ok: false,
                    error: policyError.message,
                    reasonCode: policyError.code,
                    policyDecisionId: policyError.policyDecisionId,
                    result: {
                        error: policyError.message,
                        reason_code: policyError.code,
                        policy_decision_id: policyError.policyDecisionId,
                    },
                    metadata: { source: 'direct_followup_guard' },
                },
            };
        }

        const toolName = swap.isCrossChain ? 'prepare_cross_chain_tx' : 'prepare_swap_transaction';
        const args = swap.isCrossChain
            ? {
                fromToken: swap.tokenIn,
                toToken: swap.tokenOut,
                fromAmount: swap.amountIn,
                fromChain: swap.chainId,
                toChain: swap.toChain,
            }
            : {
                token_in: swap.tokenIn,
                token_out: swap.tokenOut,
                amount_in: swap.amountIn,
                chain_id: swap.chainId,
                slippage: params.task.toolContext?.toolConfig?.customSlippage
                    ? Number(params.task.toolContext.toolConfig.customSlippage)
                    : 1.0,
                execute: true,
            };
        const result = await invokeTool({
            toolName,
            args,
            task: params.task,
            userId: params.userId,
            broker: params.broker,
            toolExecutionEngine: params.toolExecutionEngine,
            snapshot: params.snapshot,
            executionGate: {
                phase: 'execute',
                confirmationToken: computeConfirmationToken(
                    toolName,
                    args,
                    params.snapshot.policySnapshot?.policyDecisionId,
                ),
            },
        });
        return { handled: true, toolResult: result };
    }

    if (confirmation.kind === 'copy_trade_confirmation' && confirmation.copyTrade) {
        const copy = confirmation.copyTrade;
        const args = {
            target_wallet: copy.targetWallet,
            buy_amount_usd: copy.buyAmountUsd,
            ...(copy.chainId ? { chain_id: copy.chainId } : {}),
            ...(typeof copy.mirrorSell === 'boolean' ? { mirror_sell: copy.mirrorSell } : {}),
            ...(Number.isFinite(Number(copy.takeProfitPct)) ? { take_profit_pct: copy.takeProfitPct } : {}),
            ...(Number.isFinite(Number(copy.stopLossPct)) ? { stop_loss_pct: copy.stopLossPct } : {}),
        };
        const result = await invokeTool({
            toolName: 'create_copy_trade_config',
            args,
            task: params.task,
            userId: params.userId,
            broker: params.broker,
            toolExecutionEngine: params.toolExecutionEngine,
            snapshot: params.snapshot,
            executionGate: {
                phase: 'execute',
                confirmationToken: computeConfirmationToken(
                    'create_copy_trade_config',
                    args,
                    params.snapshot.policySnapshot?.policyDecisionId,
                ),
            },
        });
        return { handled: true, toolResult: result };
    }

    if (confirmation.kind === 'order_confirmation' && confirmation.order) {
        const order = confirmation.order;
        const result = await invokeTool({
            toolName: order.toolName,
            args: order.args || {},
            task: params.task,
            userId: params.userId,
            broker: params.broker,
            toolExecutionEngine: params.toolExecutionEngine,
            snapshot: params.snapshot,
            executionGate: {
                phase: 'execute',
                confirmationToken: order.confirmationToken,
            },
        });
        return { handled: true, toolResult: result };
    }

    return { handled: false };
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
}): Promise<OrchestratorToolResult> {
    const toolResult = await params.toolExecutionEngine.execute({
        id: `direct:${params.toolName}:${Date.now()}`,
        name: params.toolName,
        arguments: params.args,
    }, {
        ...(params.task.toolContext || {}),
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
        result: toolResult.result,
    });

    const txMessageId = toolResult.result?.messageId;
    const finalText = txMessageId
        ? ''
        : (toolResult.result?.summary
            || (toolResult.ok ? buildSuccessSummary(params.toolName, params.args) : buildFailureSummary(toolResult.error)));
    await params.broker.complete({ content: finalText });
    return toolResult;
}

function buildSuccessSummary(toolName: string, args: Record<string, any>): string {
    if (toolName === 'create_copy_trade_config') return 'Copy trade setup created.';
    if (toolName === 'prepare_cross_chain_tx') {
        return `Proceed confirmed. Executed cross-chain trade ${String(args.fromAmount || '')} ${String(args.fromToken || '')} -> ${String(args.toToken || '')}.`;
    }
    return `Proceed confirmed. Executed ${String(args.amount_in || '')} ${String(args.token_in || '')} -> ${String(args.token_out || '')}.`;
}

function buildFailureSummary(message?: string): string {
    return `Proceed confirmed, but execution failed: ${String(message || 'unknown error')}`;
}

async function broadcastClientAction(params: {
    task: any;
    userId: string | null;
    assistantMessageId: string;
    result: any;
}) {
    if (!params.userId) return;
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

function isQuoteExpiredFromTrace(snapshot: ChatContextSnapshot): boolean {
    const toolCalls = snapshot.recentToolTrace?.toolCalls || [];
    const relevant = [...toolCalls].reverse().find((entry) =>
        ['simulate_swap', 'prepare_swap_transaction', 'get_cross_chain_quote', 'prepare_cross_chain_tx'].includes(String(entry.tool || '')) &&
        ['success', 'cached'].includes(String(entry.status || ''))
    );
    const finishedAt = extractTradeTraceTimestamp(relevant);
    if (!finishedAt) return true;
    const ts = new Date(String(finishedAt)).getTime();
    if (!Number.isFinite(ts)) return true;
    const ttlMs = Math.max(5000, parseInt(process.env.CHAT_SIM_QUOTE_TTL_MS || '45000', 10) || 45000);
    return Date.now() - ts > ttlMs;
}

function extractTradeTraceTimestamp(entry: any): string | undefined {
    if (!entry || typeof entry !== 'object') return undefined;
    return entry.finishedAt
        || entry.completedAt
        || entry.simulatedAt
        || entry.createdAt
        || entry.result?.finishedAt
        || entry.result?.completedAt
        || entry.result?.simulatedAt
        || entry.result?.createdAt
        || entry.result?.timestamp
        || undefined;
}

function resolveInvalidTradeConfirmation(snapshot: ChatContextSnapshot): {
    code: string;
    error: string;
    userMessage: string;
    toolName: string;
    args: Record<string, any>;
} | null {
    if (snapshot.confirmationState?.kind) return null;
    if (!isConfirmationMessage(snapshot.lastUserMessage)) return null;

    const toolCalls = snapshot.recentToolTrace?.toolCalls || [];
    const recentTradeCall = [...toolCalls].reverse().find((entry) =>
        ['simulate_swap', 'prepare_swap_transaction', 'get_cross_chain_quote', 'prepare_cross_chain_tx'].includes(String(entry.tool || ''))
    );
    if (!recentTradeCall) return null;

    const status = String(recentTradeCall.status || '').toLowerCase();
    const result = recentTradeCall.result && typeof recentTradeCall.result === 'object'
        ? recentTradeCall.result
        : {};
    const args = (recentTradeCall.args && typeof recentTradeCall.args === 'object')
        ? recentTradeCall.args
        : {};
    const toolName = String(recentTradeCall.tool || 'trade_followup_guard');
    const explicitError = typeof result.error === 'string' ? result.error.trim() : '';

    if (['success', 'cached'].includes(status)) {
        return null;
    }

    const error = explicitError
        || (status === 'aborted'
            ? 'Previous trade preflight was aborted.'
            : status === 'failed' || status === 'error'
                ? 'Previous trade preflight failed.'
                : 'No valid preflight quote is available for execution.');

    return {
        code: 'PRECHECK_REQUIRED',
        error,
        toolName,
        args,
        userMessage:
            `Nothing was executed. The previous trade preflight did not complete successfully (${error}). ` +
            `Run a fresh simulation/quote first, then confirm again.`,
    };
}
