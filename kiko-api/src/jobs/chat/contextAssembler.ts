// CONTEXT MEMORY
// Updated: 2026-04-23
// Author: Rowan
// Reason: transport wrappers from Farcaster mention ingress were leaking
//         scaffolding words like "Farcaster" and "Current" into token-symbol
//         extraction and canonical intent routing because this owner used the
//         persisted wrapper text as if it were the literal user query. This
//         owner now passes the active normal-model family as `openai`
//         instead of the retired `deepseek` label when constructing token
//         context blocks.
// Goal: assemble chat snapshots from the effective user query while preserving
//       raw history for audit and still exposing deterministic runtime context
//       to downstream planners. Social-agent turns now also need a separate
//       current-turn multimodal envelope so prompt assembly can add image input
//       without corrupting replayed text history.
// Owns: chat snapshot assembly, requested token extraction inputs, and
//       prefetched context hydration for orchestration.
// Does Not Own: ingress webhook formatting, LLM normalization policy, or tool execution.
// Design Language:
// - snapshot.lastUserMessage should reflect the literal user query, not transport scaffolding
// - requested token extraction must use the same cleaned user text as runtime directives
// - preserve raw message history for audit, but do not let wrapper labels drive routing
// - social multimodal context belongs in runtime metadata, not replayed history
// - active normal-provider context blocks should use the current provider-family label
// - chain-scoped allChainBalances must outrank unscoped nativeBalance when
//   seeding current-chain wallet state
// Document Provenance:
// - Source: Farcaster mention runtime logs for trace dd7b79f7-41fb-4147-8e38-44a3c4bfeff0
// - Kind: runtime observation
// - Retrieved: 2026-04-15
// - Applied To: unwrapping last-user Farcaster mention text before snapshot assembly
// - Verification: verified in runtime and targeted tests
// - Kind: product doc
// - Retrieved: 2026-04-23
// - Applied To: using the OpenAI normal-provider label for Node token context blocks
// - Verification: verified in code
// - Source: X expansions/media docs + Neynar cast lookup docs
// - Kind: official API doc
// - Retrieved: 2026-04-16
// - Applied To: ChatContextSnapshot.runtime.socialInput for current-turn
//   social thread/image context
// - Verification: verified in docs and code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-social-agent-thread-context-and-image-input.md
// - /Users/almurat/KiKo/system-journal/owner-map/farcaster-neynar-webhook-ingress.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-farcaster-query-unwrapping-and-wallet-guard.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
import type { ToolDefinition } from '../../tooling/registry.js';
import { contextBudgetManager } from '../../services/ai/contextBudgetManager.js';
import type { ChatContextSnapshot } from './contracts.js';
import { buildBalanceContextBlock } from './balanceContextBuilder.js';
import { buildLaunchpadContextBlock, buildTokenContextBlock } from './contextBlockBuilder.js';
import {
    extractRecentToolTrace,
    extractRequestedTokenAddresses,
    extractRequestedTokenAddressesFromHistory,
    extractRequestedTokenSymbols,
    extractRequestedTokenSymbolsFromHistory,
    extractEffectiveUserQuery,
    sanitizeHistory,
} from './conversationStateResolver.js';
import { extractRecentPolymarketSelection } from './polymarketSelectionState.js';
import { resolveRuntimeDirectives } from './runtimeDirectiveResolver.js';
import { DEFAULT_CHAT_MODEL } from '../../config/chatModels.js';

const CHAT_CONTEXT_RECENT_WINDOW = Math.max(4, parseInt(process.env.CHAT_CONTEXT_RECENT_WINDOW || '12', 10) || 12);
const CHAT_CONTEXT_MAX_INPUT_TOKENS = Math.max(2048, parseInt(process.env.CHAT_CONTEXT_MAX_INPUT_TOKENS || '16000', 10) || 16000);
const CHAT_CONTEXT_RESERVED_OUTPUT_TOKENS = Math.max(512, parseInt(process.env.CHAT_CONTEXT_RESERVED_OUTPUT_TOKENS || '3500', 10) || 3500);

const CHAIN_NAMES: Record<number, string> = {
    1: 'Ethereum',
    10: 'Optimism',
    56: 'BNB Chain',
    137: 'Polygon',
    42161: 'Arbitrum',
    8453: 'Base',
    900: 'Solana',
};

const CHAIN_BALANCE_KEYS: Record<number, string> = {
    1: 'eth',
    10: 'optimism',
    56: 'bsc',
    137: 'polygon',
    42161: 'arbitrum',
    8453: 'base',
    900: 'solana',
};

export function assembleChatContext(params: {
    task: any;
    session: any;
    messages: any[];
    toolDefinitions: ToolDefinition[];
    userId?: string | null;
}): ChatContextSnapshot {
    const { task, session, messages, toolDefinitions, userId } = params;
    const activeModel = task.model || session?.model || DEFAULT_CHAT_MODEL;
    const sanitizedHistory = sanitizeHistory(messages);
    const budget = contextBudgetManager.applyBudget(
        sanitizedHistory.map((msg) => ({
            role: msg.role,
            content: msg.content,
            reasoning_content: msg.reasoningContent,
            tool_calls: msg.toolCalls,
            tool_call_id: msg.toolCallId,
        })),
        {
            recentWindow: CHAT_CONTEXT_RECENT_WINDOW,
            maxInputTokens: CHAT_CONTEXT_MAX_INPUT_TOKENS,
            reservedOutputTokens: CHAT_CONTEXT_RESERVED_OUTPUT_TOKENS,
        }
    );
    const history = sanitizeHistory(
        ensureCriticalContextPinned(
            budget.messages.map((msg) => ({
                role: msg.role,
                content: msg.content || '',
                reasoning_content: msg.reasoning_content || '',
                tool_calls: msg.tool_calls,
                tool_call_id: msg.tool_call_id,
            })),
            messages,
        ),
    );
    const lastUser = [...history].reverse().find((msg) => msg.role === 'user');
    const lastUserMessage = extractEffectiveUserQuery(lastUser?.content || '');
    const toolContext = task.toolContext || {};
    const chainId = Number(toolContext.chainId || 0) || undefined;
    const chainName = chainId ? CHAIN_NAMES[chainId] || String(chainId) : undefined;
    const currentChainBalance = resolveCurrentChainBalanceSnapshot(toolContext, chainId);
    const toolResultsCache = new Map<string, any>();
    if ((toolContext.walletAddress || toolContext.userAddress) && chainId && currentChainBalance) {
        toolResultsCache.set(stableStringify({
            name: 'wallet_info_seed',
            walletAddress: toolContext.walletAddress || toolContext.userAddress,
            chainId,
        }), true);
        toolResultsCache.set(`get_wallet_info:${stableStringify({
            address: toolContext.walletAddress || toolContext.userAddress,
            chainId,
        })}`, {
            address: toolContext.walletAddress || toolContext.userAddress,
            chain: chainName || chainId,
            ethBalance: currentChainBalance.ethBalance,
            tokens: currentChainBalance.tokens,
        });
    }
    const requestedAddressSet = new Set([
        ...extractRequestedTokenAddressesFromHistory(history),
        ...extractRequestedTokenAddresses(lastUserMessage),
    ]);
    const requestedTokenSymbols = Array.from(new Set([
        ...extractRequestedTokenSymbolsFromHistory(history),
        ...extractRequestedTokenSymbols(lastUserMessage),
    ]));
    const prefetchedToolResults = buildPrefetchedToolResults({
        toolContext,
        chainId,
        chainName,
        lastUserMessage,
        requestedTokenSymbols,
        requestedTokenAddress: requestedAddressSet.values().next().value,
    });
    const tokenBlock = buildTokenContextBlock({
        mode: 'openai',
        tokenInfo: toolContext.tokenSnapshot || toolContext.tokenContext || toolContext.tokenInfo || null,
        contractAddress: requestedAddressSet.values().next().value,
        cacheStatusLabel: 'FROM NODE CONTEXT',
    });
    const launchpadBlock = buildLaunchpadContextBlock({
        launchpadInfo: toolContext.launchpad || toolContext.launchpadInfo || null,
        tokenInfo: toolContext.tokenSnapshot || toolContext.tokenContext || toolContext.tokenInfo || null,
        fallbackAddress: requestedAddressSet.values().next().value,
        fallbackChainId: chainId,
    });
    const balanceContext = buildBalanceContextBlock({
        toolContext,
        toolResultsCache,
        nativeSymbol: resolveNativeSymbol(chainId),
        requestedAddressSet,
        requestedTokens: requestedTokenSymbols,
        includePortfolioBlock: true,
        includeRequestedTokenBlock: true,
        includeExecutionRule: true,
        chainLabel: chainName || String(chainId || 'unknown'),
        isExecutionIntent: true,
        stableStringify,
        filterBalanceEntriesForAi,
        isStableSymbolForChain,
        isNativeSymbol,
        limitLines,
    });
    const clientContext = buildClientContext(toolContext, chainId, chainName);

    const confirmationState = null;
    const systemDirectives = resolveRuntimeDirectives({
        task,
        lastUserMessage,
        confirmationState,
    });

    return {
        sessionId: task.sessionId,
        taskId: task.id,
        userMessageId: task.userMessageId,
        assistantMessageId: task.assistantMessageId,
        model: activeModel,
        history,
        lastUserMessage,
        recentToolTrace: extractRecentToolTrace(messages),
        confirmationState,
        runtime: {
            userId,
            walletAddress: toolContext.walletAddress,
            userAddress: toolContext.userAddress,
            chainId,
            chainName,
            nativeBalance: toolContext.nativeBalance ? String(toolContext.nativeBalance) : undefined,
            balance: toolContext.balance || null,
            currentPage: toolContext.currentPage,
            pageContext: toolContext.pageContext,
            farcaster: toolContext.farcaster || null,
            socialInput: toolContext.socialInput || null,
            userSettings: toolContext.toolConfig || null,
            toolContext,
            tokenSnapshot: toolContext.tokenSnapshot || toolContext.tokenContext || toolContext.tokenInfo || null,
            launchpad: toolContext.launchpad || toolContext.launchpadInfo || null,
            balanceSnapshotAt: toolContext.balanceSnapshotAt || toolContext.balanceFetchedAt || toolContext.balanceUpdatedAt || null,
            allChainBalances: toolContext.allChainBalances || null,
            allChainBalancesSnapshotAt: toolContext.allChainBalancesSnapshotAt || null,
            systemDirectives,
            prefetchedToolResults,
            contextBlocks: {
                clientContext,
                walletState: balanceContext.tokenContextBlock,
                tokenContext: tokenBlock.tokenContextBlock,
                launchpadContext: launchpadBlock.launchpadContextBlock,
            },
        },
        requestedTokenAddresses: Array.from(requestedAddressSet),
        requestedTokenSymbols,
        requestedAddressClassifications: [],
        compactedHistory: budget.compactedSummary || null,
        previousResponseId: null,
        historyBudget: {
            inputTokensEstimated: budget.inputTokensEstimated,
            historyKept: budget.historyKept,
            historyCompacted: budget.historyCompacted,
            compactionHits: budget.compactedSummary ? 1 : 0,
        },
        taskRoute: null,
        taskRouteSelectionState: null,
        normalizedIntent: null,
        normalizationState: null,
        conversationActionState: null,
        polymarketSelection: extractRecentPolymarketSelection(messages),
        toolDefinitions,
        policySnapshot: null,
    };
}

function ensureCriticalContextPinned(compactedMessages: any[], sourceMessages: any[]): any[] {
    const criticalPatterns = ['[USER_BALANCE_CONTEXT]', '[REQUESTED_TOKEN_BALANCE]', '[NATIVE_PRICE_CONTEXT]', '[PRICE_GUARDRAIL]'];
    const hasPattern = (msgs: any[], pattern: string) =>
        msgs.some((msg) => typeof msg?.content === 'string' && msg.content.includes(pattern));

    const next = [...compactedMessages];
    for (const pattern of criticalPatterns) {
        if (hasPattern(next, pattern)) continue;
        const source = [...sourceMessages].reverse().find((msg) => typeof msg?.content === 'string' && msg.content.includes(pattern));
        if (source) next.push(source);
    }
    return next;
}

function stableStringify(value: any): string {
    const seen = new WeakSet<object>();
    const normalize = (input: any): any => {
        if (input === null || input === undefined) return input;
        if (typeof input !== 'object') return input;
        if (seen.has(input)) return '[Circular]';
        seen.add(input);
        if (Array.isArray(input)) return input.map(normalize);
        const out: Record<string, any> = {};
        for (const key of Object.keys(input).sort()) out[key] = normalize(input[key]);
        return out;
    };
    return JSON.stringify(normalize(value));
}

function normalizeBalanceEntries(balance: any): Array<{ symbol: string; balance: string; decimals?: number; contractAddress?: string }> {
    if (!balance || typeof balance !== 'object') return [];
    if (Array.isArray(balance)) {
        return balance.map((item) => ({
            symbol: String(item?.symbol || item?.tokenSymbol || item?.contractAddress || ''),
            balance: String(item?.balance || item?.tokenBalance || item?.amount || item?.formatted || item?.value || '0'),
            decimals: Number.isFinite(item?.decimals) ? Number(item.decimals) : undefined,
            contractAddress: item?.contractAddress || item?.contract,
        })).filter((item) => item.symbol);
    }
    return Object.entries(balance).map(([symbol, raw]) => {
        if (raw && typeof raw === 'object') {
            return {
                symbol,
                balance: String((raw as any).balance || (raw as any).tokenBalance || (raw as any).amount || (raw as any).formatted || (raw as any).value || '0'),
                decimals: Number.isFinite((raw as any).decimals) ? Number((raw as any).decimals) : undefined,
                contractAddress: (raw as any).contractAddress || (raw as any).contract,
            };
        }
        return { symbol, balance: String(raw), contractAddress: isLikelyEvmAddress(symbol) ? symbol : undefined };
    });
}

function isLikelyEvmAddress(value: unknown): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(String(value || '').trim());
}

function mergeScopedBalanceTokens(
    scopedTokens: Array<{ symbol: string; balance: string; decimals?: number; contractAddress?: string }>,
    supplementalTokens: Array<{ symbol: string; balance: string; decimals?: number; contractAddress?: string }>,
): Array<{ symbol: string; balance: string; decimals?: number; contractAddress?: string }> {
    if (supplementalTokens.length === 0) return scopedTokens;
    const merged = [...scopedTokens];
    const knownAddresses = new Set(
        scopedTokens
            .map((token) => String(token.contractAddress || '').toLowerCase())
            .filter(Boolean),
    );
    for (const token of supplementalTokens) {
        const address = String(token.contractAddress || '').toLowerCase();
        if (!address || knownAddresses.has(address)) continue;
        knownAddresses.add(address);
        merged.push(token);
    }
    return merged;
}

function resolveNativeSymbol(chainId?: number): string {
    if (chainId === 56) return 'BNB';
    if (chainId === 137) return 'POL';
    if (chainId === 900) return 'SOL';
    return 'ETH';
}

function isNativeSymbol(symbol: string): boolean {
    return new Set(['ETH', 'MATIC', 'POL', 'BNB', 'AVAX', 'SOL', 'ARB', 'OP']).has(String(symbol || '').toUpperCase());
}

function isStableSymbolForChain(_chainId: number | undefined, symbol: string): boolean {
    return new Set(['USDC', 'USDT', 'DAI', 'FDUSD', 'BUSD', 'USD1']).has(String(symbol || '').toUpperCase());
}

function filterBalanceEntriesForAi(
    entries: Array<{ symbol: string; balance: string; decimals?: number; contractAddress?: string }> | undefined,
    _chainId?: number,
    allowContracts: Set<string> = new Set(),
) {
    if (!entries) return [];
    return entries.filter((token) => {
        const symbol = String(token.symbol || '').toUpperCase();
        const addr = String(token.contractAddress || '').toLowerCase();
        if (!symbol) return false;
        if (isNativeSymbol(symbol) || isStableSymbolForChain(undefined, symbol)) return true;
        if (!token.contractAddress) return true;
        if (allowContracts.size > 0 && !allowContracts.has(addr)) return false;
        return true;
    });
}

function limitLines(lines: string[], limit: number) {
    if (lines.length <= limit) return { lines, hiddenCount: 0 };
    return { lines: lines.slice(0, limit), hiddenCount: lines.length - limit };
}

function buildClientContext(toolContext: any, chainId?: number, chainName?: string): string {
    const payload = {
        walletAddress: toolContext.walletAddress || toolContext.userAddress,
        chainId,
        chainName,
        currentPage: toolContext.currentPage,
        pageContext: toolContext.pageContext,
        nativeBalance: toolContext.nativeBalance,
        balance: toolContext.balance,
        farcaster: toolContext.farcaster,
        toolConfig: toolContext.toolConfig,
        tokenSnapshot: toolContext.tokenSnapshot || toolContext.tokenContext || toolContext.tokenInfo,
        launchpad: toolContext.launchpad || toolContext.launchpadInfo,
        allChainBalances: toolContext.allChainBalances,
        allChainBalancesSnapshotAt: toolContext.allChainBalancesSnapshotAt,
    };
    return `[CLIENT_CONTEXT]\n${JSON.stringify(payload, null, 2)}`;
}

function buildPrefetchedToolResults(params: {
    toolContext: any;
    chainId?: number;
    chainName?: string;
    lastUserMessage?: string;
    requestedTokenSymbols?: string[];
    requestedTokenAddress?: string;
}): Record<string, any> | null {
    const walletAddress = params.toolContext.walletAddress || params.toolContext.userAddress;
    const prefetched: Record<string, any> = {};
    const lower = String(params.lastUserMessage || '').toLowerCase();
    const isTradeLike = /\b(swap|buy|sell|trade|convert|ape|bridge|cross[\s-]?chain)\b/i.test(lower) || /买|卖|换|兑换|跨链/.test(lower);
    const wantsWallet = /\b(balance|portfolio|wallet|holdings|pnl)\b/i.test(lower) || /余额|钱包|持有/.test(lower);
    const wantsLaunchpad = /\b(launchpad|pump|four\.meme|moonshot|letsbonk|bonk|portal|zora)\b/i.test(lower) || /发射台|打新/.test(lower);
    const currentChainBalance = resolveCurrentChainBalanceSnapshot(params.toolContext, params.chainId);

    if (walletAddress && params.chainId && (isTradeLike || wantsWallet || currentChainBalance)) {
        const tokens = currentChainBalance?.tokens || normalizeBalanceEntries(params.toolContext.balance);
        const ethBalance = currentChainBalance?.ethBalance ?? params.toolContext.nativeBalance;
        if (tokens.length > 0 || ethBalance != null) {
            prefetched.get_wallet_info = {
                address: walletAddress,
                chain: params.chainName || String(params.chainId),
                ethBalance: ethBalance != null ? String(ethBalance) : undefined,
                tokens,
            };
        }
    }

    const tokenSnapshot = params.toolContext.tokenSnapshot || params.toolContext.tokenContext || params.toolContext.tokenInfo;
    if (tokenSnapshot && typeof tokenSnapshot === 'object') {
        prefetched.get_token_info = {
            ...tokenSnapshot,
            chainId: tokenSnapshot.chainId || params.chainId,
            chainName: tokenSnapshot.chainName || params.chainName,
            address: tokenSnapshot.address || tokenSnapshot.contractAddress || params.requestedTokenAddress,
        };
    } else if (params.requestedTokenAddress || (params.requestedTokenSymbols || []).length > 0) {
        const symbol = (params.requestedTokenSymbols || []).find((item) => !['BUY', 'SELL', 'SWAP', 'TRADE', 'GET', 'ALL'].includes(String(item || '').toUpperCase()));
        prefetched.token_request = {
            address: params.requestedTokenAddress,
            symbol,
            chainId: params.chainId,
            chainName: params.chainName,
        };
    }

    const launchpad = params.toolContext.launchpad || params.toolContext.launchpadInfo;
    const launchpadPayload = launchpad && typeof launchpad === 'object'
        ? {
            ...launchpad,
            chainId: launchpad.chainId || params.chainId,
            address: launchpad.address || params.requestedTokenAddress || tokenSnapshot?.address,
        }
        : null;
    if (launchpadPayload) {
        prefetched.get_launchpad_info = launchpadPayload;
        prefetched.get_launchpad_stats = launchpadPayload;
    } else if (wantsLaunchpad && (params.requestedTokenAddress || tokenSnapshot?.address)) {
        prefetched.search_launchpad = {
            address: params.requestedTokenAddress || tokenSnapshot?.address,
            symbol: tokenSnapshot?.symbol || (params.requestedTokenSymbols || []).find((item) => !['BUY', 'SELL', 'SWAP', 'TRADE', 'GET', 'ALL'].includes(String(item || '').toUpperCase())),
            chainId: params.chainId,
            chainName: params.chainName,
        };
    }

    return Object.keys(prefetched).length > 0 ? prefetched : null;
}

function resolveCurrentChainBalanceSnapshot(toolContext: any, chainId?: number): { ethBalance?: string | number; tokens: Array<{ symbol: string; balance: string; decimals?: number; contractAddress?: string }> } | null {
    if (!toolContext || !chainId) return null;
    const singleChainTokens = normalizeBalanceEntries(toolContext.balance);
    const singleChainEthBalance = toolContext.nativeBalance;

    const chainKey = CHAIN_BALANCE_KEYS[chainId];
    const allChainBalances = toolContext.allChainBalances;
    if (chainKey && allChainBalances && typeof allChainBalances === 'object') {
        const chainBalance = allChainBalances[chainKey];
        if (chainBalance && typeof chainBalance === 'object') {
            const tokens = mergeScopedBalanceTokens(
                normalizeBalanceEntries(chainBalance.tokens),
                singleChainTokens,
            );
            const ethBalance = chainBalance.ethBalanceFormatted ?? chainBalance.ethBalance ?? chainBalance.nativeBalance;
            if (tokens.length > 0 || ethBalance != null || singleChainTokens.length > 0 || singleChainEthBalance != null) {
                return {
                    ethBalance: ethBalance ?? singleChainEthBalance,
                    tokens,
                };
            }
        }
    }

    if (singleChainTokens.length > 0 || singleChainEthBalance != null) {
        return {
            ethBalance: singleChainEthBalance,
            tokens: singleChainTokens,
        };
    }

    return null;
}
