import * as chatRepo from '../../repositories/chatRepository.js';
import { chatWS } from '../../services/chatWebSocket.js';
import type { ChatContextSnapshot, OrchestratorToolResult } from './contracts.js';
import { ChatStreamBroker } from './streamBroker.js';
import type { ToolExecutionEngine } from './toolExecutionEngine.js';
import { computeConfirmationToken } from './executionGate.js';

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
            || (toolResult.ok
                ? buildSuccessSummary(params.snapshot, params.toolName, params.args)
                : buildFailureSummary(params.snapshot, toolResult.error)));
    await params.broker.complete({ content: finalText });
    return toolResult;
}

function buildSuccessSummary(snapshot: ChatContextSnapshot, toolName: string, args: Record<string, any>): string {
    const locale = detectLocale(snapshot);
    if (toolName === 'create_copy_trade_config') {
        return locale === 'zh' ? '已创建跟单配置。' : 'Copy-trade setup created.';
    }
    if (toolName === 'prepare_cross_chain_tx') {
        return locale === 'zh'
            ? `已提交跨链交易：${String(args.fromAmount || '')} ${String(args.fromToken || '')} -> ${String(args.toToken || '')}。`
            : `Cross-chain trade submitted: ${String(args.fromAmount || '')} ${String(args.fromToken || '')} -> ${String(args.toToken || '')}.`;
    }
    return locale === 'zh'
        ? `已提交交易：${String(args.amount_in || '')} ${String(args.token_in || '')} -> ${String(args.token_out || '')}。`
        : `Trade submitted: ${String(args.amount_in || '')} ${String(args.token_in || '')} -> ${String(args.token_out || '')}.`;
}

function buildFailureSummary(snapshot: ChatContextSnapshot, message?: string): string {
    const locale = detectLocale(snapshot);
    return locale === 'zh'
        ? `交易执行失败：${String(message || '未知错误')}`
        : `Execution failed: ${String(message || 'unknown error')}`;
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

function resolveInvalidTradeConfirmation(snapshot: ChatContextSnapshot): {
    code: string;
    error: string;
    userMessage: string;
    toolName: string;
    args: Record<string, any>;
} | null {
    const confirmation = snapshot.confirmationState;
    if (confirmation?.kind) return null;
    const taskMode = snapshot.normalizedIntent?.taskMode;
    if (taskMode !== 'confirm' && taskMode !== 'execute') return null;

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
        userMessage: detectLocale(snapshot) === 'zh'
            ? `本次没有执行交易。之前的预检查未成功完成（${error}）。请先重新获取报价或预检查，然后再确认。`
            : `Nothing was executed. The previous trade preflight did not complete successfully (${error}). Run a fresh quote or preflight first, then confirm again.`,
    };
}

function detectLocale(snapshot: ChatContextSnapshot): 'en' | 'zh' {
    if (snapshot.normalizedIntent?.locale === 'zh') return 'zh';
    return /[\u4e00-\u9fff]/.test(String(snapshot.lastUserMessage || '')) ? 'zh' : 'en';
}
