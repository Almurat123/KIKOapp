import * as chatRepo from '../../repositories/chatRepository.js';
import { chatWS } from '../../services/chatWebSocket.js';
import { fetchJson } from '../../config/unifiedApiService.js';
import { buildSignedHeaders } from '../../utils/requestSigningClient.js';
import { toolRegistry } from '../../tooling/registry.js';
import type { ChatContextSnapshot, OrchestratorToolResult } from './contracts.js';
import { ChatStreamBroker } from './streamBroker.js';

export async function executeDirectTradeFollowup(params: {
    snapshot: ChatContextSnapshot;
    task: any;
    userId: string | null;
    broker: ChatStreamBroker;
}): Promise<{ handled: boolean; toolResult?: OrchestratorToolResult }> {
    const confirmation = params.snapshot.confirmationState;
    if (!confirmation?.kind) return { handled: false };

    if (confirmation.kind === 'swap_confirmation' && confirmation.swap) {
        const swap = confirmation.swap;
        const quoteExpired = isQuoteExpiredFromTrace(params.snapshot);
        if (quoteExpired) {
            await broadcastTaskStatus(params);
            await refreshQuoteComparisonForConfirmedSwap(params, swap);
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
        });
        return { handled: true, toolResult: result };
    }

    return { handled: false };
}

async function broadcastTaskStatus(params: {
    task: any;
    userId: string | null;
}) {
    if (!params.userId) return;
    chatWS.broadcastToUser(params.userId, {
        type: 'task_status',
        sessionId: params.task.sessionId,
        data: {
            taskId: params.task.id,
            status: 'running',
            message: 'Quote expired, refreshing and comparing providers',
        },
    });
}

async function invokeTool(params: {
    toolName: string;
    args: Record<string, any>;
    task: any;
    userId: string | null;
    broker: ChatStreamBroker;
}): Promise<OrchestratorToolResult> {
    let rawResult: any;
    let ok = true;
    let error: string | undefined;

    try {
        rawResult = await toolRegistry.execute(params.toolName, params.args, {
            ...(params.task.toolContext || {}),
            sessionId: params.task.sessionId,
            messageId: params.task.assistantMessageId,
            userId: params.userId,
        });
    } catch (err: any) {
        ok = false;
        error = err?.message || String(err);
        rawResult = { error };
    }

    const toolResult: OrchestratorToolResult = {
        id: `direct:${params.toolName}:${Date.now()}`,
        name: params.toolName,
        arguments: params.args,
        ok: ok && !rawResult?.error,
        result: rawResult,
        error: !ok || rawResult?.error ? String(error || rawResult?.error || rawResult?.message || 'Tool execution failed') : undefined,
        metadata: { source: 'direct_followup' },
    };
    await params.broker.recordToolResult(toolResult);

    await broadcastClientAction({
        task: params.task,
        userId: params.userId,
        assistantMessageId: params.task.assistantMessageId,
        result: rawResult,
    });

    const txMessageId = rawResult?.messageId;
    const finalText = txMessageId
        ? ''
        : (rawResult?.summary
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
        ['simulate_swap', 'get_cross_chain_quote'].includes(String(entry.tool || '')) &&
        ['success', 'cached'].includes(String(entry.status || ''))
    );
    const finishedAt = (relevant as any)?.finishedAt || (relevant as any)?.simulatedAt || undefined;
    if (!finishedAt) return true;
    const ts = new Date(String(finishedAt)).getTime();
    if (!Number.isFinite(ts)) return true;
    const ttlMs = Math.max(5000, parseInt(process.env.CHAT_SIM_QUOTE_TTL_MS || '45000', 10) || 45000);
    return Date.now() - ts > ttlMs;
}

async function refreshQuoteComparisonForConfirmedSwap(
    params: { task: any; userId: string | null; snapshot: ChatContextSnapshot },
    swap: NonNullable<NonNullable<ChatContextSnapshot['confirmationState']>['swap']>,
): Promise<void> {
    const apiBase = process.env.API_BASE_URL || (process.env.PORT ? `http://127.0.0.1:${process.env.PORT}` : 'http://localhost:3001');
    const accessToken = params.task.toolContext?.accessToken;
    const appKey = process.env.KIKO_WEB_APP_KEY || process.env.KIKO_MOBILE_APP_KEY || '';
    const payload = swap.isCrossChain
        ? {
            fromToken: swap.tokenIn,
            toToken: swap.tokenOut,
            fromAmount: swap.amountIn,
            fromChain: swap.chainId,
            toChain: swap.toChain,
            userAddress: params.task.toolContext?.walletAddress || params.task.toolContext?.userAddress,
        }
        : {
            tokenIn: swap.tokenIn,
            tokenOut: swap.tokenOut,
            amountIn: swap.amountIn,
            chainId: swap.chainId,
            slippageBps: params.task.toolContext?.toolConfig?.customSlippage
                ? Math.round(Number(params.task.toolContext.toolConfig.customSlippage) * 100)
                : 100,
            userAddress: params.task.toolContext?.walletAddress || params.task.toolContext?.userAddress,
        };
    const path = swap.isCrossChain ? '/api/bridge/quote' : '/api/swap/quote';
    const body = JSON.stringify(payload);
    try {
        await fetchJson({
            url: `${apiBase}${path}`,
            method: 'POST',
            endpointName: swap.isCrossChain ? 'bridge-api' : 'swap-api',
            headers: {
                'Content-Type': 'application/json',
                ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                ...(appKey ? { 'X-App-Key': appKey } : {}),
                ...buildSignedHeaders('POST', path, body),
            },
            body,
            suppressError: true,
            retry: { retries: 0 },
        });
    } catch {
        // Best-effort quote refresh only.
    }
}
