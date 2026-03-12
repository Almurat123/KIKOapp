import { getChainConfig } from '../../config/chainConfig.js';
import type { RuntimeDirective, TradeConfirmationState } from './contracts.js';

const STABLE_SYMBOLS = new Set(['USDC', 'USDT', 'DAI', 'FDUSD', 'BUSD', 'USD1']);
const NATIVE_SYMBOLS = new Set(['ETH', 'BNB', 'SOL', 'POL', 'MATIC']);

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
    const raw = String(message || '');
    const lower = raw.toLowerCase();
    const amountMatch = raw.match(/\b(\d+(?:\.\d+)?)\b/);
    if (!amountMatch) return null;
    const amount = amountMatch[1];

    let tokenOut = '';
    for (const match of raw.matchAll(/\b[A-Z]{2,10}\b/g)) {
        const symbol = String(match[0] || '').toUpperCase();
        if (STABLE_SYMBOLS.has(symbol)) {
            tokenOut = symbol;
            break;
        }
    }
    if (!tokenOut) return null;

    const hasBuySemantics = /\b(buy|get|receive)\b/i.test(raw) || /购买|买/.test(raw);
    if (!hasBuySemantics || !lower.includes(tokenOut.toLowerCase())) return null;

    let tokenIn = '';
    if (chainId) {
        try {
            tokenIn = String(getChainConfig(chainId).nativeCurrency.symbol || '').toUpperCase();
        } catch {
            tokenIn = '';
        }
    }
    if (!tokenIn || !NATIVE_SYMBOLS.has(tokenIn)) return null;

    return {
        kind: 'amount_semantics',
        message:
            `AMOUNT_SEMANTICS_RULE: In this request, numeric amount ${amount} refers to target output ${tokenOut}, NOT input ${tokenIn}. ` +
            `Do NOT treat ${amount} as amount_in ${tokenIn}. You MUST first estimate the required ${tokenIn} input for receiving approximately ${amount} ${tokenOut}, then call simulate_swap with that estimated amount_in. NEVER use the user's full balance when a specific target output amount is requested.`,
        metadata: { amount, tokenIn, tokenOut, chainId },
    };
}

function mentionsCurrentChain(text: string): boolean {
    if (!text) return false;
    return /\b(current chain|which chain|what chain|current network|which network|what network)\b/i.test(text)
        || /现在.*链|当前.*链|什么链|哪个链/.test(text);
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
    if (toolConfig.fastSwapMode !== true) return [];

    const requestedSymbols = Array.from(input.raw.matchAll(/\b[A-Z]{2,10}\b/g)).map((match) => String(match[0] || '').toUpperCase());
    const requestedAddresses = Array.from(input.raw.matchAll(/\b0x[a-fA-F0-9]{40}\b/g)).map((match) => String(match[0] || '').toLowerCase());
    const hasSwapVerb = /\b(swap|buy|sell|trade|exchange|convert)\b/i.test(input.raw) || /买|卖|兑换/.test(input.raw);
    const hasAnyTarget = requestedSymbols.length > 0 || requestedAddresses.length > 0;
    const firstSymbol = requestedSymbols.find((symbol) => !NATIVE_SYMBOLS.has(symbol) && !STABLE_SYMBOLS.has(symbol));

    const directives: RuntimeDirective[] = [];
    if (hasSwapVerb && hasAnyTarget && requestedAddresses.length === 0 && firstSymbol && !isFastSwapWhitelisted(firstSymbol, input.chainId)) {
        directives.push({
            kind: 'fast_swap_address_required',
            message: 'FAST SWAP ADDRESS REQUIRED: Fast Swap Mode is ON. Native whitelist tokens may proceed without address, but any other token requires the exact contract address from the user before continuing. Do NOT resolve non-whitelisted token names via cache, search, or inference. Ask a short follow-up for the contract address.',
            metadata: { chainId: input.chainId, tokenOut: firstSymbol },
        });
    }

    if (!hasSwapVerb && hasAnyTarget) {
        directives.push({
            kind: 'fast_swap_safe_mode',
            message: 'FAST SWAP SAFE MODE: User shared a token address or token reference without explicit trade intent. Ask a short confirmation question: trade now or analyze? Do not execute any trade without a clear buy/sell instruction.',
            metadata: { chainId: input.chainId, hasAddress: requestedAddresses.length > 0, symbols: requestedSymbols },
        });
    }

    return directives;
}

function isFastSwapWhitelisted(symbol: string, chainId?: number): boolean {
    const normalized = String(symbol || '').trim().toUpperCase();
    if (!normalized) return false;
    const perChain: Record<number, Set<string>> = {
        1: new Set(['ETH', 'WETH']),
        10: new Set(['ETH', 'WETH']),
        56: new Set(['BNB', 'WBNB']),
        137: new Set(['POL', 'MATIC', 'WMATIC']),
        42161: new Set(['ETH', 'WETH']),
        8453: new Set(['ETH', 'WETH']),
        900: new Set(['SOL', 'WSOL']),
    };
    const scoped = chainId ? perChain[chainId] : undefined;
    if (scoped?.has(normalized)) return true;
    return Object.values(perChain).some((set) => set.has(normalized));
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

    const hasBalanceSnapshot = Boolean(input.toolContext?.balance) || Boolean(input.toolContext?.nativeBalance);
    if (hasBalanceSnapshot) return null;

    const tokenMatch = Array.from(input.raw.matchAll(/\b[A-Z]{2,10}\b/g))
        .map((match) => String(match[0] || '').toUpperCase())
        .find((symbol) => !STABLE_SYMBOLS.has(symbol) && !NATIVE_SYMBOLS.has(symbol));
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
