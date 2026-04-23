import type { CanonicalIntentNormalizationState } from './canonicalIntent.js';
import type { ChatContextSnapshot, OrchestratorToolCall, OrchestratorToolResult } from './contracts.js';
import type { ToolExecutionEngine } from './toolExecutionEngine.js';
import type { ChatStreamBroker } from './streamBroker.js';
import { normalizeChainAlias, resolveCanonicalChainRef } from './chainIntent.js';
import { resolveBinaryLocale } from './runtimeLocale.js';
import { applyTaskRouteToSnapshot, type TaskRoute } from './taskRoute.js';

function detectLocale(snapshot: ChatContextSnapshot): 'en' | 'zh' {
    return snapshot.taskRoute?.locale
        || resolveBinaryLocale(String(snapshot.lastUserMessage || ''), snapshot.normalizedIntent?.locale);
}

// CONTEXT MEMORY
// Updated: 2026-04-23
// Status: verified
// Why: explicit first-turn swap requests in quote-before-swap mode must hit the
// fast quote lane instead of letting the model ask whether it should quote.
// Debug Goal: phrases like "swap 0.001 ETH to USDC" should directly run a quote
// on the active chain and return a confirmation-ready quote response.
// Search Tags: swap 0.001 ETH to USDC fast lane direct quote first turn
// Invariants:
// - explicit swap requests with amount/token pair should parse without an extra confirmation turn
// - omitted chain names fall back to the active/requested chain in snapshot context
// Failure Modes:
// - parser only recognizes "buy X for Y on chain" and misses "swap A to B"
// - missing chain clause blocks a valid quote on the current connected chain
function parseStructuredSwapRequest(snapshot: ChatContextSnapshot): {
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    chainId: number;
    chainName: string;
} | null {
    const raw = String(snapshot.lastUserMessage || '').trim();
    const resolveTargetChain = (chainRaw?: string | null) => {
        const explicitChain = chainRaw ? normalizeChainAlias(chainRaw) : null;
        return explicitChain || resolveCanonicalChainRef({
            taskRoute: snapshot.taskRoute || null,
            requestedTokenAddresses: snapshot.requestedTokenAddresses,
            requestedTokenSymbols: snapshot.requestedTokenSymbols,
            runtimeChainId: snapshot.runtime.chainId,
            runtimeChainName: snapshot.runtime.chainName,
        });
    };

    const buildParsed = (params: {
        tokenInRaw: string;
        tokenOutRaw: string;
        amountIn: string;
        chainRaw?: string | null;
    }) => {
        const targetChain = resolveTargetChain(params.chainRaw);
        if (!targetChain?.chainId || !targetChain.chainName) return null;

        const runtimeChainId = Number(snapshot.runtime.chainId || 0) || undefined;
        if (params.chainRaw && runtimeChainId && runtimeChainId !== targetChain.chainId) {
            return null;
        }

        const tokenOut = (snapshot.requestedTokenAddresses?.[0]
            || params.tokenOutRaw.trim());
        const tokenIn = params.tokenInRaw.trim().toUpperCase();
        const amountIn = params.amountIn.trim();
        if (!tokenOut || !amountIn || !tokenIn) return null;

        return {
            tokenIn,
            tokenOut,
            amountIn,
            chainId: targetChain.chainId,
            chainName: targetChain.chainName,
        };
    };

    const buyForMatch = raw.match(/^\s*buy\s+(.+?)\s+for\s+(\d+(?:\.\d+)?)\s+([A-Za-z0-9$._-]+|0x[a-fA-F0-9]{40})\s+(?:(?:on|in)\s+(.+?))?\s*$/i);
    if (buyForMatch) {
        const [, tokenOutRaw, amountIn, tokenInRaw, chainRaw] = buyForMatch;
        return buildParsed({
            tokenInRaw,
            tokenOutRaw,
            amountIn,
            chainRaw,
        });
    }

    const swapMatch = raw.match(/^\s*swap\s+(\d+(?:\.\d+)?)\s+([A-Za-z0-9$._-]+|0x[a-fA-F0-9]{40})\s+(?:to|for)\s+([A-Za-z0-9$._-]+|0x[a-fA-F0-9]{40})\s*(?:(?:on|in)\s+(.+?))?\s*$/i);
    if (swapMatch) {
        const [, amountIn, tokenInRaw, tokenOutRaw, chainRaw] = swapMatch;
        return buildParsed({
            tokenInRaw,
            tokenOutRaw,
            amountIn,
            chainRaw,
        });
    }

    return null;
}

export function tryBuildFastLaneSwapIntent(snapshot: ChatContextSnapshot): {
    snapshot: ChatContextSnapshot;
    matched: boolean;
} {
    if (snapshot.taskRoute || snapshot.normalizedIntent) {
        return { snapshot, matched: false };
    }

    const parsed = parseStructuredSwapRequest(snapshot);
    if (!parsed) {
        return { snapshot, matched: false };
    }

    const locale = detectLocale(snapshot);
    const taskRoute: TaskRoute = {
        owner: 'swap',
        phase: 'execute',
        facets: [],
        entities: {
            tokenAddresses: snapshot.requestedTokenAddresses?.length ? snapshot.requestedTokenAddresses : [parsed.tokenOut],
            tokenSymbols: Array.from(new Set([...(snapshot.requestedTokenSymbols || []), parsed.tokenIn])),
            walletAddresses: [],
            marketIdentifiers: [],
            imageRefs: [],
        },
        requestedChain: {
            chainId: parsed.chainId,
            chainName: parsed.chainName,
            source: 'llm',
        },
        timeContext: null,
        rowCount: null,
        inheritEntitiesFromContext: false,
        locale,
        needsClarification: false,
        clarificationQuestion: null,
        explanation: 'Structured explicit swap request detected via fast lane parser.',
        confidence: 0.99,
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
            ...applyTaskRouteToSnapshot(snapshot, taskRoute),
            normalizationState,
            taskRouteSelectionState: {
                status: 'ok',
                source: 'deterministic',
                rawText: '{"source":"fast_lane_structured_swap"}',
            },
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
    const routeOwner = params.snapshot.taskRoute?.owner || null;
    if (routeOwner !== 'swap' && (!normalizedIntent || normalizedIntent.intent !== 'swap')) return false;

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
