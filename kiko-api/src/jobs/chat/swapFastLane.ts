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

const CHAIN_BALANCE_KEYS: Record<number, string> = {
    1: 'eth',
    10: 'optimism',
    56: 'bsc',
    137: 'polygon',
    42161: 'arbitrum',
    8453: 'base',
    900: 'solana',
};

const CHAIN_NATIVE_SYMBOLS: Record<number, Set<string>> = {
    1: new Set(['ETH', 'WETH']),
    10: new Set(['ETH', 'WETH']),
    56: new Set(['BNB', 'WBNB']),
    137: new Set(['POL', 'MATIC', 'WMATIC']),
    42161: new Set(['ETH', 'WETH']),
    8453: new Set(['ETH', 'WETH']),
    900: new Set(['SOL', 'WSOL']),
};

type StructuredSwapRequest = {
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    chainId: number;
    chainName: string;
    amountKind: 'direct' | 'balance_all' | 'balance_percent';
};

type NormalizedBalanceEntry = {
    symbol: string;
    balance: string;
    decimals?: number;
    contractAddress?: string;
};

function isNormalizedBalanceEntry(entry: NormalizedBalanceEntry | null): entry is NormalizedBalanceEntry {
    return Boolean(entry);
}

function normalizeBalanceEntries(entries: any): NormalizedBalanceEntry[] {
    if (!Array.isArray(entries)) return [];
    return entries
        .map((entry): NormalizedBalanceEntry | null => {
            if (!entry || typeof entry !== 'object') return null;
            const symbol = String(entry.symbol || entry.tokenSymbol || '').trim();
            const balance = entry.balance ?? entry.tokenBalance ?? entry.amount;
            if (!symbol || balance == null) return null;
            return {
                symbol,
                balance: String(balance),
                decimals: typeof entry.decimals === 'number' ? entry.decimals : undefined,
                contractAddress: entry.contractAddress || entry.contract || entry.address || undefined,
            };
        })
        .filter(isNormalizedBalanceEntry);
}

function resolveCurrentChainBalanceSnapshot(snapshot: ChatContextSnapshot, chainId: number): { ethBalance?: string; tokens: NormalizedBalanceEntry[] } | null {
    const toolContext = snapshot.runtime?.toolContext || {};
    const directTokens = normalizeBalanceEntries(toolContext.balance);
    const directNativeBalance = toolContext.nativeBalance ?? snapshot.runtime?.nativeBalance;
    if (directTokens.length > 0 || directNativeBalance != null) {
        return {
            ethBalance: directNativeBalance != null ? String(directNativeBalance) : undefined,
            tokens: directTokens,
        };
    }

    const chainKey = CHAIN_BALANCE_KEYS[chainId];
    const chainSnapshot = chainKey && toolContext.allChainBalances && typeof toolContext.allChainBalances === 'object'
        ? toolContext.allChainBalances[chainKey]
        : null;
    if (!chainSnapshot || typeof chainSnapshot !== 'object') return null;

    const tokens = normalizeBalanceEntries(chainSnapshot.tokens);
    const ethBalance = chainSnapshot.ethBalanceFormatted ?? chainSnapshot.ethBalance ?? chainSnapshot.nativeBalance;
    if (tokens.length === 0 && ethBalance == null) return null;

    return {
        ethBalance: ethBalance != null ? String(ethBalance) : undefined,
        tokens,
    };
}

function resolveStructuredAmountIn(snapshot: ChatContextSnapshot, parsed: StructuredSwapRequest): string | null {
    if (parsed.amountKind === 'direct') return parsed.amountIn;

    const chainSnapshot = resolveCurrentChainBalanceSnapshot(snapshot, parsed.chainId);
    if (!chainSnapshot) return null;

    const tokenInUpper = String(parsed.tokenIn || '').trim().toUpperCase();
    const isNative = Boolean(CHAIN_NATIVE_SYMBOLS[parsed.chainId]?.has(tokenInUpper));
    const rawBalance = isNative
        ? chainSnapshot.ethBalance
        : chainSnapshot.tokens.find((token) => String(token.symbol || '').trim().toUpperCase() === tokenInUpper)?.balance;
    if (!rawBalance) return null;

    if (parsed.amountKind === 'balance_all') {
        return String(rawBalance);
    }

    const percent = parseFloat(parsed.amountIn);
    const balanceNum = Number(rawBalance);
    if (!Number.isFinite(percent) || percent <= 0 || !Number.isFinite(balanceNum) || balanceNum <= 0) {
        return null;
    }

    return String(balanceNum * (percent / 100));
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
function parseStructuredSwapRequest(snapshot: ChatContextSnapshot): StructuredSwapRequest | null {
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
        amountKind?: 'direct' | 'balance_all' | 'balance_percent';
        chainRaw?: string | null;
    }) => {
        const targetChain = resolveTargetChain(params.chainRaw);
        if (!targetChain?.chainId || !targetChain.chainName) return null;

        const runtimeChainId = Number(snapshot.runtime.chainId || 0) || undefined;
        if (params.chainRaw && runtimeChainId && runtimeChainId !== targetChain.chainId) {
            return null;
        }

        const tokenOutSource = snapshot.requestedTokenAddresses?.[0]
            || params.tokenOutRaw.trim();
        const tokenIn = params.tokenInRaw.trim().toUpperCase();
        const tokenOut = /^0x[a-fA-F0-9]{40}$/.test(tokenOutSource)
            ? tokenOutSource
            : tokenOutSource.toUpperCase();
        const amountIn = params.amountIn.trim();
        if (!tokenOut || !amountIn || !tokenIn) return null;

        return {
            tokenIn,
            tokenOut,
            amountIn,
            chainId: targetChain.chainId,
            chainName: targetChain.chainName,
            amountKind: params.amountKind || 'direct',
        };
    };

    const buyForMatch = raw.match(/^\s*buy\s+(.+?)\s+for\s+(\d+(?:\.\d+)?)\s+([A-Za-z0-9$._-]+|0x[a-fA-F0-9]{40})\s+(?:(?:on|in)\s+(.+?))?\s*$/i);
    if (buyForMatch) {
        const [, tokenOutRaw, amountIn, tokenInRaw, chainRaw] = buyForMatch;
        return buildParsed({
            tokenInRaw,
            tokenOutRaw,
            amountIn,
            amountKind: 'direct',
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
            amountKind: 'direct',
            chainRaw,
        });
    }

    const sellMatch = raw.match(/^\s*sell\s+(all|\d+(?:\.\d+)?%?|\d+(?:\.\d+)?)\s+([A-Za-z0-9$._-]+|0x[a-fA-F0-9]{40})\s+(?:to|for)\s+([A-Za-z0-9$._-]+|0x[a-fA-F0-9]{40})\s*(?:(?:on|in)\s+(.+?))?\s*$/i);
    if (sellMatch) {
        const [, amountRaw, tokenInRaw, tokenOutRaw, chainRaw] = sellMatch;
        const normalizedAmount = String(amountRaw || '').trim();
        const amountKind = normalizedAmount.toLowerCase() === 'all'
            ? 'balance_all'
            : normalizedAmount.endsWith('%')
                ? 'balance_percent'
                : 'direct';
        return buildParsed({
            tokenInRaw,
            tokenOutRaw,
            amountIn: amountKind === 'balance_percent' ? normalizedAmount.slice(0, -1) : normalizedAmount,
            amountKind,
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
    const inheritedPolicy = params.snapshot.policySnapshot || null;
    const controlPolicy = inheritedPolicy?.allowedTools?.includes(params.call.name)
        ? inheritedPolicy
        : null;
    const result = await params.toolExecutionEngine.execute(params.call, {
        ...(params.task.toolContext || {}),
        sessionId: params.task.sessionId,
        messageId: params.task.assistantMessageId,
        userId: params.userId,
        recentToolTrace: params.snapshot.recentToolTrace,
        __controlPolicy: controlPolicy,
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
    const amountIn = resolveStructuredAmountIn(params.snapshot, parsed);
    if (!amountIn || !Number.isFinite(Number(amountIn)) || Number(amountIn) <= 0) {
        return false;
    }

    const locale = detectLocale(params.snapshot);
    const simulateCall: OrchestratorToolCall = {
        id: `fast:simulate_swap:${Date.now()}`,
        name: 'simulate_swap',
        arguments: {
            token_in: parsed.tokenIn,
            token_out: parsed.tokenOut,
            amount_in: amountIn,
            chain_id: parsed.chainId,
            slippage: params.task.toolContext?.toolConfig?.customSlippage
                ? Number(params.task.toolContext.toolConfig.customSlippage)
                : 1.0,
        },
    };

    const simulateResult = await executeReadOnlyTool({
        call: simulateCall,
        task: params.task,
        snapshot: params.snapshot,
        userId: params.userId,
        broker: params.broker,
        toolExecutionEngine: params.toolExecutionEngine,
    });

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
            amountIn,
            nativeBalance: params.snapshot.runtime?.nativeBalance,
            tokenInfo: null,
            quote: simulateResult.result,
        }),
    });
    return true;
}
