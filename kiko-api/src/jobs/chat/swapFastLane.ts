import type { CanonicalIntent, CanonicalIntentNormalizationState } from './canonicalIntent.js';
import type { ChatContextSnapshot, OrchestratorToolCall, OrchestratorToolResult } from './contracts.js';
import type { ToolExecutionEngine } from './toolExecutionEngine.js';
import type { ChatStreamBroker } from './streamBroker.js';
import { normalizeChainAlias, resolveCanonicalChainRef } from './chainIntent.js';

function detectLocale(snapshot: ChatContextSnapshot): 'en' | 'zh' {
    if (snapshot.normalizedIntent?.locale === 'zh') return 'zh';
    return /[\u4e00-\u9fff]/.test(String(snapshot.lastUserMessage || '')) ? 'zh' : 'en';
}

function parseStructuredSwapRequest(snapshot: ChatContextSnapshot): {
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    chainId: number;
    chainName: string;
} | null {
    const raw = String(snapshot.lastUserMessage || '').trim();
    const buyForMatch = raw.match(/^\s*buy\s+(.+?)\s+for\s+(\d+(?:\.\d+)?)\s+([A-Za-z0-9$._-]+|0x[a-fA-F0-9]{40})\s+(?:on|in)\s+(.+?)\s*$/i);
    if (!buyForMatch) return null;

    const [, targetRaw, amountIn, tokenInRaw, chainRaw] = buyForMatch;
    const targetChain = normalizeChainAlias(chainRaw) || resolveCanonicalChainRef({
        requestedTokenAddresses: snapshot.requestedTokenAddresses,
        requestedTokenSymbols: snapshot.requestedTokenSymbols,
        runtimeChainId: snapshot.runtime.chainId,
        runtimeChainName: snapshot.runtime.chainName,
    });
    if (!targetChain?.chainId || !targetChain.chainName) return null;

    const runtimeChainId = Number(snapshot.runtime.chainId || 0) || undefined;
    if (runtimeChainId && runtimeChainId !== targetChain.chainId) {
        return null;
    }

    const tokenOut = (snapshot.requestedTokenAddresses?.[0]
        || targetRaw
            .trim());
    const tokenIn = tokenInRaw.trim().toUpperCase();
    if (!tokenOut || !amountIn || !tokenIn) return null;

    return {
        tokenIn,
        tokenOut,
        amountIn,
        chainId: targetChain.chainId,
        chainName: targetChain.chainName,
    };
}

export function tryBuildFastLaneSwapIntent(snapshot: ChatContextSnapshot): {
    snapshot: ChatContextSnapshot;
    matched: boolean;
} {
    if (snapshot.normalizedIntent) {
        return { snapshot, matched: false };
    }

    const parsed = parseStructuredSwapRequest(snapshot);
    if (!parsed) {
        return { snapshot, matched: false };
    }

    const locale = detectLocale(snapshot);
    const intent: CanonicalIntent = {
        domain: 'token',
        intent: 'swap',
        taskMode: 'execute',
        outputMode: 'execution_ready',
        searchMode: 'forbidden',
        searchTarget: 'none',
        confidence: 0.99,
        explanation: 'Structured explicit swap request detected via fast lane parser.',
        entities: {
            tokenAddresses: snapshot.requestedTokenAddresses?.length ? snapshot.requestedTokenAddresses : [parsed.tokenOut],
            tokenSymbols: Array.from(new Set([...(snapshot.requestedTokenSymbols || []), parsed.tokenIn])),
            walletAddresses: [],
            marketIdentifiers: [],
        },
        requestedChain: {
            chainId: parsed.chainId,
            chainName: parsed.chainName,
            source: 'llm',
        },
        timeContext: null,
        evidenceRequirements: [],
        requiresRealtime: false,
        requiresOnchainEvidence: false,
        executionCandidate: true,
        rowCount: null,
        locale,
        needsClarification: false,
        clarificationQuestion: null,
        source: 'llm',
    };

    const normalizationState: CanonicalIntentNormalizationState = {
        status: 'ok',
        source: 'llm',
        rawText: '{"source":"fast_lane_structured_swap"}',
    };

    return {
        matched: true,
        snapshot: {
            ...snapshot,
            normalizedIntent: intent,
            normalizationState,
        },
    };
}

function formatFastLaneSwapAnswer(params: {
    locale: 'en' | 'zh';
    chainName: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    nativeBalance?: string;
    tokenInfo?: any;
    quote: any;
}): string {
    const tokenLabel = params.tokenInfo?.symbol || params.tokenInfo?.tokenSymbol || params.tokenInfo?.name || params.tokenOut;
    const expectedOut = params.quote?.expected_out_human || params.quote?.expected_out || '0';
    const priceImpact = params.quote?.price_impact || '0%';
    if (params.locale === 'zh') {
        return [
            `已获取快速报价：`,
            ``,
            `输入：${params.amountIn} ${params.tokenIn}`,
            `预计收到：约 ${expectedOut} ${tokenLabel}`,
            `价格影响：${priceImpact}`,
            `网络：${params.chainName}`,
            ...(params.nativeBalance ? [`可用余额：${params.nativeBalance} ${params.tokenIn}`] : []),
            ``,
            `请直接回复“确认”或“继续”执行。`,
        ].join('\n');
    }
    return [
        `Fast quote ready:`,
        ``,
        `Input: ${params.amountIn} ${params.tokenIn}`,
        `Expected output: ~${expectedOut} ${tokenLabel}`,
        `Price impact: ${priceImpact}`,
        `Chain: ${params.chainName}`,
        ...(params.nativeBalance ? [`Available balance: ${params.nativeBalance} ${params.tokenIn}`] : []),
        ``,
        `Reply with "confirm" or "proceed" to execute.`,
    ].join('\n');
}

async function executeReadOnlyTool(params: {
    call: OrchestratorToolCall;
    task: any;
    snapshot: ChatContextSnapshot;
    userId: string | null;
    broker: ChatStreamBroker;
    toolExecutionEngine: ToolExecutionEngine;
}) {
    const result = await params.toolExecutionEngine.execute(params.call, {
        ...(params.task.toolContext || {}),
        sessionId: params.task.sessionId,
        messageId: params.task.assistantMessageId,
        userId: params.userId,
        recentToolTrace: params.snapshot.recentToolTrace,
        __controlPolicy: params.snapshot.policySnapshot || null,
        __snapshot: params.snapshot,
    });
    await params.broker.recordToolResult({
        ...result,
        metadata: { ...(result.metadata || {}), source: 'fast_swap_lane' },
    });
    return result;
}

export async function tryRunFastSwapLane(params: {
    snapshot: ChatContextSnapshot;
    tradingIntent: any;
    broker: ChatStreamBroker;
    task: any;
    userId: string | null;
    toolExecutionEngine: ToolExecutionEngine;
}): Promise<boolean> {
    const normalizedIntent = params.snapshot.normalizedIntent;
    if (!normalizedIntent || normalizedIntent.intent !== 'swap') return false;

    const parsed = parseStructuredSwapRequest(params.snapshot);
    if (!parsed) return false;
    if (params.snapshot.confirmationState?.kind) return false;

    const locale = detectLocale(params.snapshot);
    const tokenInfoCall: OrchestratorToolCall = {
        id: `fast:get_token_info:${Date.now()}`,
        name: 'get_token_info',
        arguments: {
            address: parsed.tokenOut,
            chain_id: parsed.chainId,
        },
    };
    const simulateCall: OrchestratorToolCall = {
        id: `fast:simulate_swap:${Date.now()}`,
        name: 'simulate_swap',
        arguments: {
            token_in: parsed.tokenIn,
            token_out: parsed.tokenOut,
            amount_in: parsed.amountIn,
            chain_id: parsed.chainId,
            slippage: params.task.toolContext?.toolConfig?.customSlippage
                ? Number(params.task.toolContext.toolConfig.customSlippage)
                : 1.0,
        },
    };

    const [tokenInfoResult, simulateResult] = await Promise.all([
        executeReadOnlyTool({
            call: tokenInfoCall,
            task: params.task,
            snapshot: params.snapshot,
            userId: params.userId,
            broker: params.broker,
            toolExecutionEngine: params.toolExecutionEngine,
        }),
        executeReadOnlyTool({
            call: simulateCall,
            task: params.task,
            snapshot: params.snapshot,
            userId: params.userId,
            broker: params.broker,
            toolExecutionEngine: params.toolExecutionEngine,
        }),
    ]);

    if (!simulateResult.ok) {
        return false;
    }

    await params.broker.markAnswerStarted();
    await params.broker.complete({
        content: formatFastLaneSwapAnswer({
            locale,
            chainName: parsed.chainName,
            tokenIn: parsed.tokenIn,
            tokenOut: parsed.tokenOut,
            amountIn: parsed.amountIn,
            nativeBalance: params.snapshot.runtime?.nativeBalance,
            tokenInfo: tokenInfoResult.ok ? tokenInfoResult.result : null,
            quote: simulateResult.result,
        }),
    });
    return true;
}
