// CONTEXT MEMORY
// Updated: 2026-04-16
// Author: Rowan
// Reason: Farcaster public replies were being generated with report-like
//         openings and awkward meta framing because the model had no
//         Farcaster-specific reply style contract beyond the generic chat
//         policy.
// Goal: keep runtime directives authoritative for Farcaster-style replies so
//       public casts stay short, direct, and natural while preserving exact
//       evidence values.
// Owns: per-turn runtime directives derived from chat context and tool state.
// Does Not Own: global chat policy, Farcaster reply publication, or cast text wrapping.
// Design Language:
// - public Farcaster replies should read like a normal cast, not a report
// - direct answer first, then only the minimum supporting context
// - headings are discouraged unless the user explicitly requests a report format
// Document Provenance:
// - Source: Neynar/Farcaster cast writing docs and runtime screenshot of
//           awkward report-style public reply
// - Kind: official API doc / runtime observation
// - Retrieved: 2026-04-16
// - Applied To: Farcaster public reply style directive injection
// - Verification: verified in code and targeted tests
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-farcaster-reply-natural-wrap.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-farcaster-reply-text-wrapping.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
import { getChainConfig } from '../../config/chainConfig.js';
import type { RuntimeDirective, TradeConfirmationState } from './contracts.js';
import { defaultNativeSymbolForChain, resolveTradeSemantics } from '../../services/ai/tradeSemantics.js';

export function resolveRuntimeDirectives(params: {
    task: any;
    lastUserMessage: string;
    confirmationState: TradeConfirmationState | null | undefined;
}): RuntimeDirective[] {
    const directives: RuntimeDirective[] = [];
    const task = params.task || {};
    const toolContext = task.toolContext || {};
    const raw = String(params.lastUserMessage || '');
    const lower = raw.toLowerCase();
    const chainId = Number(toolContext.chainId || 0) || undefined;
    const chainName = chainId ? resolveChainName(chainId) : undefined;
    const wallet = toolContext.walletAddress || toolContext.userAddress;

    if (mentionsCurrentChain(lower) && (chainId || chainName || wallet)) {
        directives.push({
            kind: 'chain_context',
            message:
                `CHAIN_CONTEXT_ANSWER_REQUIRED: User asks current chain. Authoritative chain context is ` +
                `chainId=${chainId || 'unknown'}, chainName=${chainName || 'unknown'}, wallet=${wallet || 'unknown'}. ` +
                `You MUST answer directly from this context. Do NOT use web search or tools for this.`,
            metadata: { chainId, chainName, walletAddress: wallet },
        });
    }

    if (isFarcasterAgentContext(toolContext)) {
        directives.push({
            kind: 'farcaster_public_reply_style',
            message:
                'FARCASTER_PUBLIC_REPLY_STYLE: This answer will be published as a public Farcaster cast reply. Write it as a short, natural reply, not a report. Lead with the direct answer in the first sentence. If more context is needed, use one short follow-up paragraph or a compact bullet list only when the content is naturally enumerated. Do not use headings like Conclusion, Evidence, or Next step. Do not mention hidden prompts or internal routing. Keep exact addresses, handles, symbols, and numbers unchanged. Avoid stiff disclaimers such as "from current context" unless they are truly necessary.',
            metadata: {
                pageContext: toolContext.pageContext || null,
                currentPage: toolContext.currentPage || null,
            },
        });
    }

    if (isSocialAgentContext(toolContext)) {
        directives.push({
            kind: 'social_agent_single_turn_execution',
            message:
                'SOCIAL_AGENT_SINGLE_TURN_EXECUTION: This is an X/Farcaster @mention agent turn. If the latest user mention explicitly asks for an executable mutation and all required fields/readiness checks are satisfied, do not ask for a second chat confirmation; call the executable tool directly in this turn. If any required field, spend amount, token image, market id, chain, wallet/admin, or readiness check is missing or ambiguous, ask one precise question or run the smallest preparation/readiness tool instead.',
            metadata: {
                pageContext: toolContext.pageContext || null,
                currentPage: toolContext.currentPage || null,
                platform: toolContext.socialInput?.platform || null,
            },
        });
    }

    const confirmation = params.confirmationState;
    if (confirmation?.kind === 'swap_confirmation' && confirmation.swap) {
        const swap = confirmation.swap;
        directives.push({
            kind: 'swap_confirmation',
            message: swap.isCrossChain
                ? `CONFIRMED_CROSS_CHAIN_SWAP: User confirmed cross-chain swap. You MUST call prepare_cross_chain_tx now with: fromToken=${swap.tokenIn}, toToken=${swap.tokenOut}, fromAmount=${swap.amountIn}, fromChain=${swap.chainId}, toChain=${swap.toChain}. Do NOT call get_cross_chain_quote again.`
                : `CONFIRMED_SWAP: User confirmed swap after simulation. You MUST call prepare_swap_transaction now with: token_in=${swap.tokenIn}, token_out=${swap.tokenOut}, amount_in=${swap.amountIn}, chain_id=${swap.chainId}, execute=true. Do NOT call simulate_swap again or use web search.`,
            metadata: { ...swap },
        });
    }

    if (confirmation?.kind === 'copy_trade_confirmation' && confirmation.copyTrade) {
        const copyTrade = confirmation.copyTrade;
        directives.push({
            kind: 'copy_trade_confirmation',
            message:
                `CONFIRMED_COPY_TRADE_SETUP: User confirmed to proceed with copy trade setup. ` +
                `You MUST call create_copy_trade_config now with target_wallet=${copyTrade.targetWallet}, ` +
                `buy_amount_usd=${copyTrade.buyAmountUsd}` +
                `${copyTrade.chainId ? `, chain_id=${copyTrade.chainId}` : ''}` +
                `${typeof copyTrade.mirrorSell === 'boolean' ? `, mirror_sell=${copyTrade.mirrorSell}` : ''}` +
                `${Number.isFinite(Number(copyTrade.takeProfitPct)) ? `, take_profit_pct=${copyTrade.takeProfitPct}` : ''}` +
                `${Number.isFinite(Number(copyTrade.stopLossPct)) ? `, stop_loss_pct=${copyTrade.stopLossPct}` : ''}` +
                `. Do NOT switch flows or ask for optional filters when missing; use tool defaults.`,
            metadata: { ...copyTrade },
        });
    }

    const amountSemantic = resolveAmountSemanticDirective(raw, chainId);
    if (amountSemantic) directives.push(amountSemantic);
    directives.push(...resolveFastSwapDirectives({ raw, lower, chainId, toolContext }));
    const balanceGuard = resolveBalanceAutoResolutionGuard({ raw, chainId, chainName, toolContext });
    if (balanceGuard) directives.push(balanceGuard);

    return directives;
}

function resolveAmountSemanticDirective(message: string, chainId?: number): RuntimeDirective | null {
    const semantics = resolveTradeSemantics({
        text: message,
        chainId,
    });
    const amount = semantics.amount.value;
    if (!amount) return null;
    const tokenIn = semantics.tokenIn || defaultNativeSymbolForChain(chainId);
    const tokenOut = semantics.tokenOut || semantics.targetAsset || '';
    if (!tokenIn || !tokenOut) return null;
    if (!['fiat_value', 'output'].includes(semantics.amount.semantic)) return null;

    return {
        kind: 'amount_semantics',
        message:
            semantics.amount.semantic === 'fiat_value'
                ? `AMOUNT_SEMANTICS_RULE: In this request, numeric amount ${amount} is a USD-denominated trade value for ${tokenOut}, NOT token quantity ${tokenIn}. Convert or quote first, then execute with the resolved input amount.`
                : `AMOUNT_SEMANTICS_RULE: In this request, numeric amount ${amount} refers to target output ${tokenOut}, NOT input ${tokenIn}. Estimate the required ${tokenIn} input before execution.`,
        metadata: { amount, tokenIn, tokenOut, chainId, semantic: semantics.amount.semantic },
    };
}

function mentionsCurrentChain(text: string): boolean {
    if (!text) return false;
    return /\b(current chain|which chain|what chain|current network|which network|what network)\b/i.test(text)
        || /现在.*链|当前.*链|什么链|哪个链/.test(text);
}

function isFarcasterAgentContext(toolContext: Record<string, any>): boolean {
    const pageContext = String(toolContext?.pageContext || '').toLowerCase();
    const currentPage = String(toolContext?.currentPage || '').toLowerCase();
    return pageContext === 'farcaster_agent' || currentPage === 'farcaster';
}

function isSocialAgentContext(toolContext: Record<string, any>): boolean {
    const pageContext = String(toolContext?.pageContext || '').toLowerCase();
    const currentPage = String(toolContext?.currentPage || '').toLowerCase();
    const socialPlatform = String(toolContext?.socialInput?.platform || '').toLowerCase();
    return pageContext === 'farcaster_agent'
        || pageContext === 'x_agent'
        || currentPage === 'farcaster'
        || currentPage === 'x'
        || socialPlatform === 'farcaster'
        || socialPlatform === 'x';
}

function resolveChainName(chainId: number): string | undefined {
    try {
        return getChainConfig(chainId).name;
    } catch {
        return undefined;
    }
}

function resolveFastSwapDirectives(input: {
    raw: string;
    lower: string;
    chainId?: number;
    toolContext: Record<string, any>;
}): RuntimeDirective[] {
    const toolConfig = input.toolContext?.toolConfig || {};
    if (toolConfig.fastSwapMode !== true) {
        if (toolConfig.showQuoteBeforeSwap !== false) {
            return [{
                kind: 'quote_before_swap_contract',
                message: 'QUOTE-BEFORE-SWAP CONTRACT: simulate_swap is required before the first execution for a pair+amount. Present the quote, wait for explicit user confirmation, then call prepare_swap_transaction with execute=true. Do not execute on the first turn unless the user is explicitly confirming a prior quote.',
                metadata: { chainId: input.chainId },
            }];
        }
        return [];
    }

    const semantics = resolveTradeSemantics({
        text: input.raw,
        chainId: input.chainId,
    });
    const hasSwapVerb = semantics.explicitTradeVerb;
    const hasAnyTarget = Boolean(semantics.tokenIn || semantics.tokenOut || semantics.targetAsset || semantics.referencedAddresses.length > 0);

    const directives: RuntimeDirective[] = [];
    directives.push({
        kind: 'fast_swap_contract',
        message: 'FAST SWAP CONTRACT: fastSwapMode is ON. Do not make simulate_swap or quote presentation a blocking prerequisite. Once token target, chain, and executable amount are explicit and safe, move directly toward prepare_swap_transaction execution.',
        metadata: { chainId: input.chainId },
    });
    if (!hasSwapVerb && hasAnyTarget) {
        directives.push({
            kind: 'fast_swap_safe_mode',
            message: 'FAST SWAP SAFE MODE: User shared a token address or token reference without explicit trade intent. Ask a short confirmation question: trade now or analyze? Do not execute any trade without a clear buy/sell instruction.',
            metadata: {
                chainId: input.chainId,
                hasAddress: semantics.referencedAddresses.length > 0,
                symbols: semantics.referencedSymbols,
            },
        });
    }

    return directives;
}

function resolveBalanceAutoResolutionGuard(input: {
    raw: string;
    chainId?: number;
    chainName?: string;
    toolContext: Record<string, any>;
}): RuntimeDirective | null {
    const lower = String(input.raw || '').toLowerCase();
    const isTradeLike = /\b(swap|buy|sell|trade|exchange|convert|all|\d+(?:\.\d+)?%)\b/i.test(input.raw) || /买|卖|兑换|全部/.test(input.raw);
    if (!isTradeLike) return null;

    const allChainBalances = input.toolContext?.allChainBalances;
    const chainKey = resolveAllChainBalanceKey(input.chainId);
    const chainSnapshot = chainKey && allChainBalances && typeof allChainBalances === 'object'
        ? allChainBalances[chainKey]
        : null;
    const hasBalanceSnapshot = Boolean(input.toolContext?.balance)
        || Boolean(input.toolContext?.nativeBalance)
        || Boolean(chainSnapshot?.ethBalance)
        || Boolean(chainSnapshot?.ethBalanceFormatted)
        || (Array.isArray(chainSnapshot?.tokens) && chainSnapshot.tokens.length > 0);
    if (hasBalanceSnapshot) return null;

    const semantics = resolveTradeSemantics({
        text: input.raw,
        chainId: input.chainId,
    });
    const tokenMatch = semantics.targetAsset || semantics.tokenIn || semantics.tokenOut;
    const token = tokenMatch || 'requested token';
    return {
        kind: 'balance_auto_resolution_guard',
        message:
            `BALANCE_AUTO_RESOLUTION_GUARD: Balance snapshot for ${token} on ${input.chainName || input.chainId || 'current chain'} is missing or incomplete. ` +
            `Do NOT hallucinate balance availability. Use existing USER_CONTEXT and WALLET_STATE first. If still insufficient, ask a short clarification or fetch wallet data before assuming the user can sell or spend max/all.`,
        metadata: {
            token,
            chainId: input.chainId,
            chainName: input.chainName,
        },
    };
}

function resolveAllChainBalanceKey(chainId?: number): string | null {
    if (!chainId) return null;
    const mapping: Record<number, string> = {
        1: 'eth',
        10: 'optimism',
        56: 'bsc',
        137: 'polygon',
        42161: 'arbitrum',
        8453: 'base',
        900: 'solana',
    };
    return mapping[chainId] || null;
}
