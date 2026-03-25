import { Tool, ToolContext } from '../../../tooling/registry.js';
import { TradeContext, getTradeContext } from '../../../services/TradeContext.js';
import { getTokenData } from '../../../services/UnifiedDataLayer.js';
import { buildSignedHeaders } from '../../../utils/requestSigningClient.js';
import { getChainConfig } from '../../../config/chainConfig.js';
import { resolveTokenDisplayMetadata } from '../../../services/tokens.js';
import { validateSwapExecutionChain } from './chainExecutionGuard.js';
// Note: swapAggregator import removed - using internal API call instead

interface SwapArgs {
    token_in: string; // Symbol or address
    token_out: string; // Symbol or address
    amount_in: string; // Amount in human readable format (e.g. "1.5")
    chain_id: number;
    slippage?: number; // percentage, e.g. 0.5
    execute?: boolean; // If true, execute the swap directly (instant trading)
}

const NATIVE_PLACEHOLDER = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

const SAFE_TOKEN_SYMBOLS = new Set([
    'ETH', 'WETH', 'USDC', 'USDT', 'DAI', 'SOL', 'BTC', 'WBTC', 'BNB', 'WBNB', 'POL', 'MATIC',
]);

const SAFE_TOKEN_ADDRESSES_BY_CHAIN: Record<number, Set<string>> = {
    1: new Set([
        '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
        '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
        '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
        '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI
        '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', // WBTC
    ]),
    8453: new Set([
        '0x4200000000000000000000000000000000000006', // WETH
        '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC (Base)
    ]),
    56: new Set([
        '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', // WBNB
        '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', // USDC
        '0x55d398326f99059ff775485246999027b3197955', // USDT
    ]),
    137: new Set([
        '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', // USDC (native)
        '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', // USDC.e
        '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619', // WETH
        '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270', // WMATIC
    ]),
    42161: new Set([
        '0x82af49447d8a07e3bd95bd0d56f35241523fbab1', // WETH
        '0xaf88d065e77c8cc2239327c5edb3a432268e5831', // USDC
        '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8', // USDC.e
    ]),
    10: new Set([
        '0x4200000000000000000000000000000000000006', // WETH
        '0x0b2c639c533813f4aa9d7837caf62653d097ff85', // USDC
        '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58', // USDT
    ]),
};

const TOKEN_MATCH_ALIASES_BY_CHAIN: Record<number, Record<string, string>> = {
    1: {
        usdc: 'usdc:1',
        usdt: 'usdt:1',
        dai: 'dai:1',
        wbtc: 'wbtc:1',
        '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 'usdc:1',
        '0xdac17f958d2ee523a2206206994597c13d831ec7': 'usdt:1',
        '0x6b175474e89094c44da98b954eedeac495271d0f': 'dai:1',
        '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 'wbtc:1',
    },
    10: {
        usdc: 'usdc:10',
        usdt: 'usdt:10',
        '0x0b2c639c533813f4aa9d7837caf62653d097ff85': 'usdc:10',
        '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58': 'usdt:10',
    },
    56: {
        usdc: 'usdc:56',
        usdt: 'usdt:56',
        '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d': 'usdc:56',
        '0x55d398326f99059ff775485246999027b3197955': 'usdt:56',
    },
    137: {
        usdc: 'usdc:137',
        'usdc.e': 'usdce:137',
        dai: 'dai:137',
        '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359': 'usdc:137',
        '0x2791bca1f2de4661ed88a30c99a7a9449aa84174': 'usdce:137',
        '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063': 'dai:137',
    },
    42161: {
        usdc: 'usdc:42161',
        'usdc.e': 'usdce:42161',
        '0xaf88d065e77c8cc2239327c5edb3a432268e5831': 'usdc:42161',
        '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8': 'usdce:42161',
    },
    8453: {
        usdc: 'usdc:8453',
        '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': 'usdc:8453',
    },
};

function isAddressLike(token: string): boolean {
    return /^0x[0-9a-fA-F]{40}$/.test(token);
}

function isSafeTokenForChain(token: string, chainId: number): boolean {
    const raw = String(token || '').trim();
    if (!raw) return false;
    if (!isAddressLike(raw)) {
        return SAFE_TOKEN_SYMBOLS.has(raw.toUpperCase());
    }
    const addr = raw.toLowerCase();
    return Boolean(SAFE_TOKEN_ADDRESSES_BY_CHAIN[Number(chainId)]?.has(addr));
}

function hasExecutableQuoteEvidence(quotePayload: any): boolean {
    const quote = quotePayload?.data || quotePayload?.quote || null;
    if (!quote || typeof quote !== 'object') return false;
    const numericCandidates = [
        quote.amountOutHuman,
        quote.amountOut,
        quote.buyAmount,
        quote.toAmount,
    ];
    const hasPositiveAmount = numericCandidates.some((value) => {
        const n = Number(value);
        return Number.isFinite(n) && n > 0;
    });
    const hasRouteHint = Boolean(
        quote.dexName
        || quote.path
        || quote.routeSummary
        || quote.swapData
        || quote.calldata
    );
    return hasPositiveAmount || hasRouteHint;
}

function normalizeTokenForMatch(token: string, chainId: number): string {
    const raw = String(token || '').trim().toLowerCase();
    if (!raw) return '';
    const nativeSymbol = getChainConfig(chainId).nativeCurrency.symbol.toLowerCase();
    if (raw === NATIVE_PLACEHOLDER || raw === nativeSymbol || raw === 'eth') return `native:${chainId}`;
    const aliases = TOKEN_MATCH_ALIASES_BY_CHAIN[Number(chainId)] || {};
    if (aliases[raw]) return aliases[raw];
    return raw;
}

function parseSimulateSwapArgs(argsKey: string): SwapArgs | null {
    const idx = argsKey.indexOf(':');
    if (idx <= 0) return null;
    try {
        const parsed = JSON.parse(argsKey.slice(idx + 1));
        return {
            token_in: parsed?.token_in,
            token_out: parsed?.token_out,
            amount_in: parsed?.amount_in,
            chain_id: parsed?.chain_id,
        };
    } catch {
        return null;
    }
}

function parseSimulateSwapTraceArgs(rawArgs: any): SwapArgs | null {
    if (!rawArgs || typeof rawArgs !== 'object' || Array.isArray(rawArgs)) return null;
    const chainId = Number(rawArgs.chain_id);
    const tokenIn = rawArgs.token_in;
    const tokenOut = rawArgs.token_out;
    const amountIn = rawArgs.amount_in;
    if (!tokenIn || !tokenOut || !amountIn || !Number.isFinite(chainId) || chainId <= 0) {
        return null;
    }
    return {
        token_in: String(tokenIn),
        token_out: String(tokenOut),
        amount_in: String(amountIn),
        chain_id: chainId,
    };
}

function findRecentSimulatedSwap(messages: any[], windowMs: number): SwapArgs | null {
    const now = Date.now();
    const sorted = [...messages].sort((a, b) => (a.messageIndex || 0) - (b.messageIndex || 0));
    for (let i = sorted.length - 1; i >= 0; i -= 1) {
        const msg = sorted[i];
        if (msg.role !== 'assistant') continue;
        const createdAt = msg.created_at || msg.createdAt;
        const createdMs = createdAt ? new Date(createdAt).getTime() : 0;
        if (createdMs && now - createdMs > windowMs) continue;
        const toolCalls = msg.data?.toolTrace?.toolCalls || [];
        for (let j = toolCalls.length - 1; j >= 0; j -= 1) {
            const call = toolCalls[j];
            if (call?.tool !== 'simulate_swap' || call?.status !== 'success') continue;
            const parsed = parseSimulateSwapArgs(call?.argsKey || '') || parseSimulateSwapTraceArgs(call?.args);
            if (!parsed?.token_in || !parsed?.token_out || !parsed?.amount_in || !parsed?.chain_id) continue;
            return parsed;
        }
    }
    return null;
}

function matchesSimulatedSwap(simulated: SwapArgs | null, args: SwapArgs): boolean {
    if (!simulated) return false;
    const sameChain = Number(simulated.chain_id) === Number(args.chain_id);
    if (!sameChain) return false;
    const sameTokenIn = normalizeTokenForMatch(simulated.token_in, args.chain_id) === normalizeTokenForMatch(args.token_in, args.chain_id);
    const sameTokenOut = normalizeTokenForMatch(simulated.token_out, args.chain_id) === normalizeTokenForMatch(args.token_out, args.chain_id);
    return sameTokenIn && sameTokenOut;
}

function hasQuoteModeExecutionAuthorization(context: ToolContext | undefined, args: SwapArgs): boolean {
    const gatePhase = String((context as any)?.__executionGate?.phase || '');
    if (gatePhase === 'execute') return true;

    const confirmation = (context as any)?.__snapshot?.confirmationState;
    if (confirmation?.kind !== 'swap_confirmation' || !confirmation?.swap) return false;

    const swap = confirmation.swap;
    const sameChain = Number(swap.chainId || 0) === Number(args.chain_id || 0);
    if (!sameChain) return false;

    const sameTokenIn = normalizeTokenForMatch(String(swap.tokenIn || ''), args.chain_id)
        === normalizeTokenForMatch(args.token_in, args.chain_id);
    const sameTokenOut = normalizeTokenForMatch(String(swap.tokenOut || ''), args.chain_id)
        === normalizeTokenForMatch(args.token_out, args.chain_id);

    return sameTokenIn && sameTokenOut;
}

function shouldAttachTradeDebug(context: ToolContext | undefined): boolean {
    return (context?.toolConfig as any)?.tradeDebugMode === true;
}

function buildTradeDebug(context: ToolContext | undefined, details: Record<string, any>) {
    if (!shouldAttachTradeDebug(context)) return undefined;
    return {
        ts: new Date().toISOString(),
        ...details,
    };
}

type SocketRecoveryTradeRecord = {
    id?: string;
    txHash?: string | null;
    status?: string | null;
    tokenOutAmount?: string | null;
    tokenInSymbol?: string | null;
    tokenOutSymbol?: string | null;
};

function resolveSocketRecoverySearchStartMs(params: {
    requestStartedAt?: unknown;
    recoveryStartedAt: number;
    lookbackMs?: number;
}): number {
    const lookbackMs = Math.max(0, Number(params.lookbackMs ?? 5000));
    const recoveryStartedAt = Number(params.recoveryStartedAt || Date.now());
    const requestStartedAt = Number(params.requestStartedAt);
    const anchor = Number.isFinite(requestStartedAt) && requestStartedAt > 0
        ? Math.min(requestStartedAt, recoveryStartedAt)
        : recoveryStartedAt;
    return Math.max(0, anchor - lookbackMs);
}

function buildSocketRecoveryResult(params: {
    currentData: Record<string, any>;
    recentSwap: SocketRecoveryTradeRecord;
    args: Pick<SwapArgs, 'amount_in' | 'token_in' | 'token_out'>;
}) {
    const recoveredStatus = String(params.recentSwap.status || '').toLowerCase() === 'success'
        ? 'success'
        : 'pending';
    const txHash = params.recentSwap.txHash || undefined;
    const completionData = {
        ...params.currentData,
        status: recoveredStatus,
        txHash,
        amountOut: params.recentSwap.tokenOutAmount || params.currentData.amountOut,
        tokenInSymbol: params.recentSwap.tokenInSymbol || params.currentData.tokenInSymbol,
        tokenOutSymbol: params.recentSwap.tokenOutSymbol || params.currentData.tokenOutSymbol,
        completedAt: Date.now(),
        message: recoveredStatus === 'success'
            ? `✅ Swap completed! Transaction: ${txHash?.slice(0, 10)}...`
            : `⏳ Transaction submitted. Waiting for confirmation: ${txHash?.slice(0, 10)}...`,
        isLoading: recoveredStatus === 'pending'
    };

    return {
        completionData,
        toolResult: {
            success: true,
            mode: recoveredStatus === 'success' ? 'executed' : 'pending',
            txHash,
            summary: recoveredStatus === 'success'
                ? `✅ Swap executed successfully! ${params.args.amount_in} ${params.args.token_in} → ${params.args.token_out}. Transaction: ${txHash?.slice(0, 10)}...`
                : `⏳ Swap submitted: ${params.args.amount_in} ${params.args.token_in} → ${params.args.token_out}. Waiting for confirmation on-chain.`,
            data: {
                txHash,
                status: params.recentSwap.status,
                tradeId: params.recentSwap.id
            },
            _final: true,
            recovered_from_socket_error: true
        }
    };
}

export const PrepareSwapTransactionTool: Tool<SwapArgs> = {
    definition: {
        name: 'prepare_swap_transaction',
        description: `Prepare and optionally execute a token swap transaction. Use this when the user explicitly wants to swap, trade, or buy/sell tokens. Set execute=true for instant trading.

EXECUTION ROUTE POLICY:
- Chat-triggered EVM swaps execute through the external aggregator path only.
- If the external aggregator cannot quote or execute the trade, stop and explain the failure.
- Do NOT assume the system will silently fall back to internal direct-swap or launchpad executors.

CRITICAL ERROR HANDLING:
- If this tool returns an "error" field, YOU MUST STOP IMMEDIATELY and respond to the user with the error message.
- DO NOT retry or call other tools after receiving an error.
- DO NOT continue iterating - respond directly to the user explaining what went wrong.
- Errors indicate unrecoverable failures (insufficient liquidity, transaction reverted, etc.)

BALANCE CONTEXT USAGE:
- If [USER_BALANCE_CONTEXT] is provided, it shows tokens with their contract addresses in format: "SYMBOL: balance (0x...)"
- When user says "swap ETH to USDC", look up USDC's contract address from the balance context
- Use the contract address (from parentheses) as token_out parameter
- For native tokens (ETH, SOL, etc.), use the symbol directly

IMPORTANT: If user says 'all', 'max', or 'full balance':
1. First call get_wallet_info to get their current balance for the source token
2. Then use the EXACT balance amount (e.g. '0.622398') as amount_in - NOT 'all'
3. This ensures the swap uses the correct amount

POLYMARKET-SPECIFIC RULE:
- When an upstream Polymarket readiness/tool result says the user must convert Polygon native USDC to Polymarket collateral, use the EXACT addresses from that tool result.
- On Polygon, Polymarket collateral is USDC.e at 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174.
- Polygon native USDC is 0x3c499c542cef5e3811e1192ce70d8cc03d5c3359.
- Do NOT silently replace that conversion with ETH -> USDC or any other asset pair.

The amount_in parameter MUST be a numeric string like '0.1' or '100'. Never pass 'all' or 'max' as amount_in.`,
        parameters: {
            type: 'object',
            properties: {
                token_in: {
                    type: 'string',
                    description: 'The source token symbol (e.g. ETH, USDC) or contract address (0x...). Use contract address from [USER_BALANCE_CONTEXT] if available.'
                },
                token_out: {
                    type: 'string',
                    description: 'The destination token symbol or contract address (0x...). IMPORTANT: Use contract address from [USER_BALANCE_CONTEXT] if token is in user portfolio.'
                },
                amount_in: {
                    type: 'string',
                    description: 'NUMERIC amount to swap (e.g. "0.1"). Must be a number, not "all" or "max". Get actual balance from get_wallet_info or [USER_BALANCE_CONTEXT] first.'
                },
                chain_id: {
                    type: 'number',
                    description: 'The chain ID (e.g. 1 for ETH, 8453 for Base)'
                },
                slippage: {
                    type: 'number',
                    description: 'Slippage tolerance in percentage. Use value from user settings if available.',
                    default: 0.5
                },
                execute: {
                    type: 'boolean',
                    description: `CRITICAL: Controls whether the swap executes automatically.
- Set to FALSE (default): Returns simulation/quote info, waits for user text confirmation.
- Set to TRUE: Executes the swap automatically and shows transaction-status-card.

When show-quote-before-swap is enabled (default), execution must follow:
1) simulate_swap
2) user confirmation
3) execute=true on the confirmed swap`,
                    default: false
                }
            },
            required: ['token_in', 'token_out', 'amount_in', 'chain_id']
        }
    },
    handler: async (args, context) => {
        try {
            console.log('[PrepareSwapTransaction] Preparing swap:', args);
            let recentSimulatedSwap: SwapArgs | null = null;

            // Guard confirmation flow: load latest successful simulate_swap for the same pair/chain.
            if (context?.sessionId && (args.execute === true || context?.allowanceMode === 'instant')) {
                try {
                    const { getSessionMessages } = await import('../../../repositories/chatRepository.js');
                    const sessionMessages = await getSessionMessages(context.sessionId);
                    const simulated = findRecentSimulatedSwap(sessionMessages, 2 * 60 * 1000);
                    recentSimulatedSwap = simulated;
                    if (simulated && args.execute === true) {
                        if (matchesSimulatedSwap(simulated, args) && simulated.amount_in !== args.amount_in) {
                            console.log('[PrepareSwapTransaction] Using pinned amount from latest simulation', {
                                requestedAmount: args.amount_in,
                                pinnedAmount: simulated.amount_in,
                                chainId: args.chain_id,
                            });
                            args.amount_in = String(simulated.amount_in);
                        }
                    }
                } catch (pinErr: any) {
                    console.warn('[PrepareSwapTransaction] Failed to pin amount from simulation:', pinErr?.message || pinErr);
                }
            }

            // ========== ⚡ TRADE CONTEXT OPTIMIZATION ⚡ ==========
            // Get or create TradeContext for caching token data across the swap flow
            const tradeCtx = getTradeContext(context);
            console.log(`[PrepareSwapTransaction] Using TradeContext: ${tradeCtx.id}`);

            const chainGuard = await validateSwapExecutionChain(args, context);
            if (!chainGuard.ok) {
                return { error: chainGuard.error, code: chainGuard.code, mode: 'error' };
            }

            // ========== ⚡ INSTANT PRE-WARMING OPTIMIZATION ⚡ ==========
            // Start quote fetch IMMEDIATELY before any checks
            // This overlaps network I/O with validation logic
            const API_BASE = process.env.API_BASE_URL ||
                (process.env.PORT ? `http://127.0.0.1:${process.env.PORT}` : 'http://localhost:3001');
            const accessToken = context?.accessToken;
            const appKey = process.env.KIKO_WEB_APP_KEY || process.env.KIKO_MOBILE_APP_KEY || '';

            // Get user's wallet address for quote (required by 0x API)
            let userWalletAddress: string | undefined = context?.walletAddress || context?.userAddress;
            try {
                const userId = context?.userId;
                if (userId && accessToken) {
                    const { getEmbeddedWalletAddress } = await import('../../../services/privyWallet.js');
                    userWalletAddress = (await getEmbeddedWalletAddress(userId)) || userWalletAddress;
                    console.log('[PrepareSwapTransaction] User wallet address:', userWalletAddress?.slice(0, 10) + '...');
                }
            } catch (err) {
                console.debug('[PrepareSwapTransaction] Could not get wallet address, proceeding without it');
            }

            // Launch quote fetch in background (don't await yet)
            const preWarmQuotePromise = (async () => {
                try {
                    console.log('[PrepareSwapTransaction] ⚡ PRE-WARMING: Quote fetch started (performance optimization, non-critical)');
                    const startTime = Date.now();

                    const response = await fetch(`${API_BASE}/api/swap/quote`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${accessToken}`,
                            ...(appKey ? { 'X-App-Key': appKey } : {}),
                            ...buildSignedHeaders('POST', '/api/swap/quote', JSON.stringify({
                                tokenIn: args.token_in,
                                tokenOut: args.token_out,
                                amountIn: args.amount_in,
                                chainId: args.chain_id,
                                slippageBps: Math.round((args.slippage || 10) * 100),
                                userAddress: userWalletAddress
                            }))
                        },
                        body: JSON.stringify({
                            tokenIn: args.token_in,
                            tokenOut: args.token_out,
                            amountIn: args.amount_in,
                            chainId: args.chain_id,
                            slippageBps: Math.round((args.slippage || 10) * 100),
                            userAddress: userWalletAddress // CRITICAL: Include user address for 0x API taker parameter
                        })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        const duration = Date.now() - startTime;
                        console.log(`[PrepareSwapTransaction] ⚡ PRE-WARMED quote ready (${duration}ms):`, {
                            dex: data.data?.dexName,
                            priceImpact: data.data?.priceImpact
                        });
                        return data;
                    }
                    return null;
                } catch (err: any) {
                    console.debug('[PrepareSwapTransaction] Pre-warm failed (expected for new/illiquid tokens, will retry):', err.message);
                    return null;
                }
            })();
            // ========== END PRE-WARMING ==========

            // 1. Validate inputs (basic)
            if (isNaN(parseFloat(args.amount_in)) || parseFloat(args.amount_in) <= 0) {
                return { error: 'Invalid amount. Please provide a positive number.', mode: 'error' };
            }

            // 2. CODE-LEVEL SAFETY GATE (MANDATORY - Cannot be bypassed by LLM)
            // Check if token_out is a known safe token (whitelist)
            const isSafeToken = isSafeTokenForChain(args.token_out, args.chain_id);

            if (!isSafeToken) {
                console.log('[PrepareSwapTransaction] Non-safe token detected, running MANDATORY Market Structure check...');

                try {
                    // 1. FAST MARKET STRUCTURE CHECK (Liquidity / FDV)
                    // ⚡ Use TradeContext-aware data fetching (auto-caches)
                    const tokenData = await getTokenData(args.token_out, args.chain_id, tradeCtx);

                    // Prefer concrete quote evidence when liquidity feed is unreliable (e.g., temporary 0-liquidity fallback).
                    const preWarmedQuote = await preWarmQuotePromise;
                    const hasQuoteEvidence = hasExecutableQuoteEvidence(preWarmedQuote);

                    if (tokenData) {
                        const liquidity = tokenData.liquidity || 0;
                        const fdv = tokenData.marketCap || 0;

                        // Rule: Block if Liquidity is extremely low compared to trade size or absolute minimum
                        if (liquidity < 1000) {
                            if (liquidity <= 0 && hasQuoteEvidence) {
                                console.warn('[PrepareSwapTransaction] Liquidity feed returned 0, but executable quote exists. Skipping hard liquidity block.', {
                                    tokenOut: args.token_out,
                                    chainId: args.chain_id,
                                });
                            } else {
                                return {
                                    error: `🚨 SECURITY BLOCK: Extremely low liquidity ($${liquidity.toFixed(0)}). Buying this token would likely result in 100% loss.`,
                                    riskDetails: { liquidity, fdv, status: 'Extremely Illiquid' }
                                };
                            }
                        }
                    }

                    // 2. SIMULATION CHECK (Price Impact)
                    // OPTIMIZATION: Use pre-warmed quote if available
                    if (preWarmedQuote && preWarmedQuote.data) {
                        console.log('[PrepareSwapTransaction] ✅ Using pre-warmed quote for safety check');
                        const impact = parseFloat(preWarmedQuote.data.priceImpact || '0');

                        if (impact > 20) {
                            return {
                                error: `🚨 SECURITY BLOCK: Price Impact is too high (${impact}%). You would lose significantly on this trade.`,
                                riskDetails: { priceImpact: impact, status: 'High Slippage' }
                            };
                        }
                    } else {
                        // Fallback: fetch quote if pre-warm failed
                        console.log('[PrepareSwapTransaction] Pre-warm unavailable (trying fresh quote for safety check)');
                        const quoteResponse = await fetch(`${API_BASE}/api/swap/quote`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${accessToken}`,
                                ...(appKey ? { 'X-App-Key': appKey } : {}),
                                ...buildSignedHeaders('POST', '/api/swap/quote', JSON.stringify({
                                    tokenIn: args.token_in,
                                    tokenOut: args.token_out,
                                    amountIn: args.amount_in,
                                    chainId: args.chain_id,
                                    slippageBps: 100
                                }))
                            },
                            body: JSON.stringify({
                                tokenIn: args.token_in,
                                tokenOut: args.token_out,
                                amountIn: args.amount_in,
                                chainId: args.chain_id,
                                slippageBps: 100 // 1% for simulation
                            })
                        });

                        if (quoteResponse.ok) {
                            const quoteData = await quoteResponse.json() as any;
                            const impact = parseFloat(quoteData.quote?.priceImpact || '0');

                            if (impact > 20) {
                                return {
                                    error: `🚨 SECURITY BLOCK: Price Impact is too high (${impact}%). You would lose significantly on this trade.`,
                                    riskDetails: { priceImpact: impact, status: 'High Slippage' }
                                };
                            }
                        }
                    }
                } catch (safetyError: any) {
                    console.error('[PrepareSwapTransaction] Safety check error:', safetyError.message);
                    // Fallback to allowing preparation if safety check fails (avoid blocking valid trades due to API issues)
                }
            }



            // FORCED: All users use allowance_trade mode (swap_card removed from UI)
            // Ignore any old database values for swapMethod
            const config = context?.toolConfig as any;
            const swapMethod = 'allowance_trade'; // FORCED: Always use allowance_trade
            const fastSwapMode = config?.fastSwapMode === true;
            const quoteBeforeSwapEnabled = !fastSwapMode && config?.showQuoteBeforeSwap !== false;
            const requireSimulationBeforeExecute = quoteBeforeSwapEnabled;
            const hasExplicitExecutionAuthorization = hasQuoteModeExecutionAuthorization(context, args);

            // Execute instantly ONLY if:
            // 1. args.execute is explicitly true (AI decision), OR
            // 2. fastSwapMode is enabled (for Zora fast swap)
            // CRITICAL: Respect args.execute=false for simulation/quote mode
            const executionRequested =
                args.execute === true ||
                context?.allowanceMode === 'instant' ||
                fastSwapMode;
            const shouldExecute = executionRequested && (!quoteBeforeSwapEnabled || hasExplicitExecutionAuthorization);

            console.log('[PrepareSwapTransaction] Execution Decision:', {
                argsExecute: args.execute,
                swapMethod,
                fastSwapMode,
                quoteBeforeSwapEnabled,
                requireSimulationBeforeExecute,
                executionRequested,
                hasExplicitExecutionAuthorization,
                finalDecision: shouldExecute
            });
            const executionDebug = buildTradeDebug(context, {
                mode: fastSwapMode ? 'fast_swap' : 'quote_confirm',
                executionRequested,
                finalDecision: shouldExecute,
                quoteBeforeSwapEnabled,
                hasExplicitExecutionAuthorization,
                matchedRecentSimulation: matchesSimulatedSwap(recentSimulatedSwap, args),
            });

            if (executionRequested && quoteBeforeSwapEnabled && !hasExplicitExecutionAuthorization) {
                console.warn('[PrepareSwapTransaction] Quote-before-swap gate downgraded execution attempt to simulation-only', {
                    tokenIn: args.token_in,
                    tokenOut: args.token_out,
                    amountIn: args.amount_in,
                    chainId: args.chain_id,
                });
            }

            if (shouldExecute && requireSimulationBeforeExecute && !matchesSimulatedSwap(recentSimulatedSwap, args)) {
                return {
                    error: 'SIMULATION_REQUIRED_BEFORE_EXECUTION',
                    code: 'SIMULATION_REQUIRED_BEFORE_EXECUTION',
                    mode: 'error',
                    requires_simulation: true,
                    requires_user_confirmation: true,
                    _final: true,
                    _user_message: `This trade needs a fresh simulation before execution.\n\nPlease run a quote/simulation for ${args.amount_in} ${args.token_in} -> ${args.token_out} on chain ${args.chain_id}, then confirm again.`
                };
            }


            if (shouldExecute) {
                console.log('[PrepareSwapTransaction] Executing backend swap via internal API...');

                // Get user ID and access token from context
                const userId = context?.userId;
                const accessToken = context?.accessToken;
                const sessionId = context?.sessionId;

                if (!userId || !accessToken || !sessionId) {
                    console.warn('[PrepareSwapTransaction] Missing userId/accessToken/sessionId, falling back to client action');
                    const [tokenInDisplay, tokenOutDisplay] = await Promise.all([
                        resolveTokenDisplayMetadata(args.token_in, args.chain_id),
                        resolveTokenDisplayMetadata(args.token_out, args.chain_id),
                    ]);
                    // Fallback to client action if no auth context
                    return {
                        __client_action: {
                            type: 'execute_swap_instant',
                            payload: {
                                tokenIn: args.token_in,
                                tokenOut: args.token_out,
                                amountIn: args.amount_in,
                                chainId: args.chain_id,
                                slippage: args.slippage || 0.5
                            }
                        },
                        mode: 'execute_client',
                        requires_user_confirmation: false,
                        summary: `Executing instant swap: ${args.amount_in} ${tokenInDisplay.symbol} → ${tokenOutDisplay.symbol} on chain ${args.chain_id}. Transaction will be submitted automatically.`
                    };
                }

                // ⚡ STEP 1: Create persistent transaction card message IMMEDIATELY
                const { createMessage, updateMessage } = await import('../../../repositories/chatRepository.js');
                const { chatWS } = await import('../../../services/chatWebSocket.js');
                const [tokenInDisplay, tokenOutDisplay] = await Promise.all([
                    resolveTokenDisplayMetadata(args.token_in, args.chain_id),
                    resolveTokenDisplayMetadata(args.token_out, args.chain_id),
                ]);

                const transactionMessage = await createMessage(
                    sessionId,
                    'assistant',
                    '',
                    {
                        type: 'transaction-status-card',
                        data: {
                            status: 'sending',
                            swapType: 'buy',
                            tokenIn: args.token_in,
                            tokenOut: args.token_out,
                            tokenInSymbol: tokenInDisplay.symbol,
                            tokenOutSymbol: tokenOutDisplay.symbol,
                            tokenInLogoURI: tokenInDisplay.logoURI,
                            tokenOutLogoURI: tokenOutDisplay.logoURI,
                            amountIn: args.amount_in,
                            chainId: args.chain_id,
                            slippage: args.slippage || 0.5,
                            startedAt: Date.now(),
                            message: '⏳ Sending transaction...',
                            isLoading: true,
                            ...(executionDebug ? { debug: executionDebug } : {}),
                        },
                        status: 'streaming'
                    }
                );

                console.log(`[PrepareSwapTransaction] Created transaction message: ${transactionMessage.id}`);

                // Push pending card to frontend via WebSocket
                chatWS.broadcast(userId, {
                    type: 'client_action',
                    sessionId,
                    data: {
                        targetMessageId: transactionMessage.id,
                        action: {
                            type: 'show_transaction_status_card',
                            data: {
                                status: 'sending',
                                tokenIn: args.token_in,
                                tokenOut: args.token_out,
                                tokenInSymbol: tokenInDisplay.symbol,
                                tokenOutSymbol: tokenOutDisplay.symbol,
                                tokenInLogoURI: tokenInDisplay.logoURI,
                                tokenOutLogoURI: tokenOutDisplay.logoURI,
                                amountIn: args.amount_in,
                                chainId: args.chain_id,
                                slippage: args.slippage || 0.5,
                                isLoading: true
                            }
                        }
                    }
                });

                let isFinalized = false;
                let pendingTimer: NodeJS.Timeout | null = setTimeout(async () => {
                    if (isFinalized) return;
                    const currentData = transactionMessage.data || {};
                    const updatedData = {
                        ...currentData,
                        status: 'pending',
                        message: '⏳ Waiting for confirmation...',
                        isLoading: currentData.isLoading ?? true
                    };
                    try {
                        await updateMessage(transactionMessage.id, {
                            data: updatedData
                        });
                        chatWS.broadcast(userId, {
                            type: 'client_action',
                            sessionId,
                            data: {
                                targetMessageId: transactionMessage.id,
                                action: {
                                    type: 'show_transaction_status_card',
                                    data: updatedData
                                }
                            }
                        });
                    } catch (err) {
                        console.warn('[PrepareSwapTransaction] Failed to update pending status:', (err as Error).message);
                    }
                }, 1200);

                // Update card with pre-warmed estimate (if available) without blocking execution
                preWarmQuotePromise.then(async preWarmedQuote => {
                    const estimatedOut = preWarmedQuote?.data?.amountOut || preWarmedQuote?.data?.amountOutHuman;
                    if (!estimatedOut) return;
                    const currentData = transactionMessage.data || {};
                    const updatedData = {
                        ...currentData,
                        amountOut: estimatedOut,
                        isLoading: false
                    };
                    try {
                        await updateMessage(transactionMessage.id, {
                            data: updatedData
                        });
                        chatWS.broadcast(userId, {
                            type: 'client_action',
                            sessionId,
                            data: {
                                targetMessageId: transactionMessage.id,
                                action: {
                                    type: 'show_transaction_status_card',
                                    data: updatedData
                                }
                            }
                        });
                    } catch (err) {
                        console.warn('[PrepareSwapTransaction] Failed to update estimated receive:', (err as Error).message);
                    }
                }).catch(() => { });

                // ⚡ STEP 2: Execute swap (blocking - wait for result)
                const API_BASE = process.env.API_BASE_URL ||
                    (process.env.PORT ? `http://127.0.0.1:${process.env.PORT}` : 'http://localhost:3001');

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 150000);

                try {
                    const response = await fetch(`${API_BASE}/api/swap/execute-instant`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${accessToken}`,
                            ...(appKey ? { 'X-App-Key': appKey } : {}),
                            ...buildSignedHeaders('POST', '/api/swap/execute-instant', JSON.stringify({
                                tokenIn: args.token_in,
                                tokenOut: args.token_out,
                                amountIn: args.amount_in,
                                chainId: args.chain_id,
                                slippageBps: Math.round((args.slippage || 10) * 100),
                                messageId: transactionMessage.id
                            })),
                            'X-Transaction-Message-Id': transactionMessage.id // Pass message ID for updates
                        },
                        body: JSON.stringify({
                            tokenIn: args.token_in,
                            tokenOut: args.token_out,
                            amountIn: args.amount_in,
                            chainId: args.chain_id,
                            slippageBps: Math.round((args.slippage || 10) * 100),
                            messageId: transactionMessage.id // For backend to update progress
                        }),
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);
                    const result = await response.json() as {
                        success?: boolean;
                        error?: string;
                        message?: string;
                        data?: { txHash?: string; amountOut?: string; tradeId?: string; status?: 'PENDING' | 'SUCCESS' | 'FAILED' };
                    };

                    let swapRecord: any = null;
                    if (response.ok && result.success && (result.data?.tradeId || result.data?.txHash)) {
                        try {
                            const { prisma } = await import('../../../db/prisma.js');
                            swapRecord = await prisma.swapHistory.findFirst({
                                where: result.data?.tradeId
                                    ? { id: result.data.tradeId }
                                    : { txHash: result.data?.txHash },
                                orderBy: { createdAt: 'desc' }
                            });
                        } catch (dbError) {
                            console.warn('[PrepareSwapTransaction] Failed to load swap record:', (dbError as Error).message);
                        }
                    }

                    // ⚡ STEP 3: Update transaction message with final result
                    const backendStatus = String(result.data?.status || '').toUpperCase();
                    const finalStatus = !response.ok || !result.success
                        ? 'failed'
                        : backendStatus === 'PENDING'
                            ? 'pending'
                            : 'success';
                    const messageData = transactionMessage.data || {};
                    const completionData = {
                        ...messageData,
                        status: finalStatus,
                        txHash: result.data?.txHash,
                        amountOut: result.data?.amountOut || swapRecord?.tokenOutAmount || messageData.amountOut,
                        tokenInSymbol: swapRecord?.tokenInSymbol || messageData.tokenInSymbol,
                        tokenOutSymbol: swapRecord?.tokenOutSymbol || messageData.tokenOutSymbol,
                        error: result.error,
                        errorMessage: result.error,
                        completedAt: Date.now(),
                        duration: messageData.startedAt ? Date.now() - messageData.startedAt : undefined,
                        message: finalStatus === 'success'
                            ? `✅ Swap completed! Transaction: ${result.data?.txHash?.slice(0, 10)}...`
                            : finalStatus === 'pending'
                                ? `⏳ Transaction submitted. Waiting for confirmation: ${result.data?.txHash?.slice(0, 10)}...`
                                : `❌ Swap failed: ${result.error || 'Unknown error'}`,
                        isLoading: finalStatus === 'pending',
                        ...(executionDebug ? {
                            debug: {
                                ...(messageData.debug || {}),
                                ...executionDebug,
                                backendStatus: backendStatus || null,
                            }
                        } : {}),
                    };
                    isFinalized = true;
                    if (pendingTimer) {
                        clearTimeout(pendingTimer);
                        pendingTimer = null;
                    }
                    await updateMessage(transactionMessage.id, {
                        data: completionData,
                        status: 'complete'
                    });

                    // Push final status to frontend
                    chatWS.broadcast(userId, {
                        type: 'client_action',
                        sessionId,
                        data: {
                            targetMessageId: transactionMessage.id,
                            action: {
                                type: 'show_transaction_status_card',
                                data: completionData
                            }
                        }
                    });

                    if (!response.ok || !result.success) {
                        const errorMsg = result.error || result.message || 'Swap execution failed';
                        console.error('[PrepareSwapTransaction] Backend swap failed:', errorMsg);

                        return {
                            error: `Swap failed: ${errorMsg}`,
                            mode: 'error',
                            messageId: transactionMessage.id,
                            details: result,
                            _final: true,
                            _user_message: `❌ Transaction failed: ${errorMsg}\n\nThis token may have restrictions or insufficient liquidity. Please try a different token or smaller amount.`
                        };
                    }

                    console.log('[PrepareSwapTransaction] Backend swap successful:', result);

                    if (finalStatus === 'pending') {
                        return {
                            success: true,
                            mode: 'pending',
                            txHash: result.data?.txHash,
                            messageId: transactionMessage.id,
                            summary: `⏳ Swap submitted: ${args.amount_in} ${args.token_in} → ${args.token_out}. Waiting for confirmation on-chain.`,
                            data: result.data,
                            _final: true
                        };
                    }

                    // ⚡ Return success with messageId (card already saved and displayed)
                    return {
                        success: true,
                        mode: 'executed',
                        txHash: result.data?.txHash,
                        messageId: transactionMessage.id,
                        summary: `✅ Swap executed successfully! ${args.amount_in} ${args.token_in} → ${args.token_out}. Transaction: ${result.data?.txHash?.slice(0, 10)}...`,
                        data: result.data,
                        _final: true // Force AI to stop iterating
                    };

                } catch (innerError: any) {
                    clearTimeout(timeoutId);

                    // Check if it's a timeout error
                    if (innerError.name === 'AbortError') {
                        console.error('[PrepareSwapTransaction] Request timeout after 150s');

                        // Update message to timeout status
                        const messageContent = transactionMessage.data || {};
                        isFinalized = true;
                        if (pendingTimer) {
                            clearTimeout(pendingTimer);
                            pendingTimer = null;
                        }
                        await updateMessage(transactionMessage.id, {
                            data: {
                                ...messageContent,
                                status: 'failed',
                                error: 'Transaction timeout',
                                errorMessage: 'Transaction timeout',
                                completedAt: Date.now(),
                                isLoading: false
                            },
                            status: 'complete'
                        });

                        chatWS.broadcast(userId, {
                            type: 'client_action',
                            sessionId,
                            data: {
                                targetMessageId: transactionMessage.id,
                                action: {
                                    type: 'show_transaction_status_card',
                                    data: {
                                        ...messageContent,
                                        status: 'failed',
                                        error: 'Transaction timeout',
                                        errorMessage: 'Transaction timeout',
                                        completedAt: Date.now(),
                                        isLoading: false
                                    }
                                }
                            }
                        });

                        return {
                            error: 'Swap request timed out after 150 seconds. Please try again.',
                            mode: 'error',
                            messageId: transactionMessage.id,
                            timeout: true,
                            _final: true,
                            _user_message: `⏱️ Transaction timed out after 150 seconds.\n\nThe network may be congested. Please try again in a moment.`
                        };
                    }

                    // Handle socket/network errors
                    const errorCode = innerError.code || innerError.cause?.code || '';
                    const isSocketError = errorCode === 'UND_ERR_SOCKET' || innerError.message?.includes('other side closed');

                    if (isSocketError) {
                        // CRITICAL FIX: Socket error means connection lost DURING transaction
                        // The backend may still be processing (approval + swap + retry)
                        // OPTIMIZED: Faster polling with exponential backoff
                        console.warn('[PrepareSwapTransaction] Socket error - waiting for backend to complete transaction...');

                        try {
                            const { prisma } = await import('../../../db/prisma.js');

                            // Optimized polling: Start fast, slow down if no result
                            const maxWaitTime = 60000; // 60 seconds total (reduced from 90s)
                            const startTime = Date.now();
                            const searchStartMs = resolveSocketRecoverySearchStartMs({
                                requestStartedAt: transactionMessage.data?.startedAt,
                                recoveryStartedAt: startTime,
                                lookbackMs: 5000
                            });
                            let pollInterval = 500; // Start with 500ms (reduced from 1s)
                            const maxPollInterval = 3000; // Max 3s (reduced from 5s)

                            let recentSwap = null;
                            let pollCount = 0;

                            while (Date.now() - startTime < maxWaitTime) {
                                pollCount++;

                                // Query most recent swap for this user
                                recentSwap = await prisma.swapHistory.findFirst({
                                    where: {
                                        userId: context?.userId,
                                        chainId: args.chain_id,
                                        createdAt: {
                                            gte: new Date(searchStartMs)
                                        },
                                        status: {
                                            in: ['pending', 'success']
                                        },
                                        tokenInAddress: {
                                            contains: args.token_in,
                                            mode: 'insensitive'
                                        },
                                        tokenOutAddress: {
                                            contains: args.token_out,
                                            mode: 'insensitive'
                                        }
                                    },
                                    orderBy: {
                                        createdAt: 'desc'
                                    }
                                });

                                if (recentSwap && recentSwap.txHash) {
                                    // Transaction was recorded! Update card and return success
                                    console.log(`[PrepareSwapTransaction] ✅ Found transaction after ${Math.round((Date.now() - startTime) / 1000)}s (${pollCount} polls):`, recentSwap.txHash);
                                    const currentData = transactionMessage.data || {};
                                    const recoveryResult = buildSocketRecoveryResult({
                                        currentData,
                                        recentSwap,
                                        args: {
                                            amount_in: args.amount_in,
                                            token_in: args.token_in,
                                            token_out: args.token_out
                                        }
                                    });
                                    const { completionData } = recoveryResult;
                                    isFinalized = true;
                                    if (pendingTimer) {
                                        clearTimeout(pendingTimer);
                                        pendingTimer = null;
                                    }
                                    await updateMessage(transactionMessage.id, {
                                        data: completionData,
                                        status: 'complete'
                                    });
                                    chatWS.broadcast(userId, {
                                        type: 'client_action',
                                        sessionId,
                                        data: {
                                            targetMessageId: transactionMessage.id,
                                            action: {
                                                type: 'show_transaction_status_card',
                                                data: completionData
                                            }
                                        }
                                    });
                                    return recoveryResult.toolResult;
                                }

                                // Log only every 5 polls to reduce noise
                                if (pollCount % 5 === 0) {
                                    console.log(`[PrepareSwapTransaction] Polling... ${Math.round((Date.now() - startTime) / 1000)}s elapsed (${pollCount} attempts)`);
                                }

                                // Wait before next poll (exponential backoff)
                                await new Promise(resolve => setTimeout(resolve, pollInterval));
                                pollInterval = Math.min(pollInterval * 1.2, maxPollInterval);
                            }

                            // Timeout - no transaction found
                            console.warn(`[PrepareSwapTransaction] Timeout after ${Math.round((Date.now() - startTime) / 1000)}s (${pollCount} polls) - no transaction found`);
                        } catch (dbError: any) {
                            console.error('[PrepareSwapTransaction] Database query failed:', dbError.message);
                        }

                        // If no transaction found in DB, ask user to verify manually
                        await updateMessage(transactionMessage.id, {
                            data: {
                                ...transactionMessage.data,
                                status: 'pending_verification',
                                error: 'Connection lost during transaction',
                                errorMessage: 'Connection lost during transaction',
                                completedAt: Date.now(),
                                isLoading: false
                            },
                            status: 'complete'
                        });
                        isFinalized = true;
                        if (pendingTimer) {
                            clearTimeout(pendingTimer);
                            pendingTimer = null;
                        }

                        chatWS.broadcast(userId, {
                            type: 'client_action',
                            sessionId,
                            data: {
                                targetMessageId: transactionMessage.id,
                                action: {
                                    type: 'show_transaction_status_card',
                                    data: {
                                        ...transactionMessage.data,
                                        status: 'pending_verification',
                                        error: 'Connection lost during transaction',
                                        errorMessage: 'Connection lost during transaction',
                                        completedAt: Date.now(),
                                        isLoading: false
                                    }
                                }
                            }
                        });

                        return {
                            error: 'Connection lost - transaction status unclear',
                            mode: 'pending_verification',
                            messageId: transactionMessage.id,
                            _final: true,
                            _user_message: `⚠️ Connection lost while submitting transaction.\n\n**Please check your wallet:**\n- Look for pending/recent transactions\n- The swap may have been submitted to the blockchain\n- Do NOT retry if transaction is already pending\n\nIf you see the transaction, it will be confirmed shortly. Otherwise, you can try again.`
                        };
                    }

                    // Other network error
                    console.error('[PrepareSwapTransaction] Network error:', innerError.message);

                    isFinalized = true;
                    if (pendingTimer) {
                        clearTimeout(pendingTimer);
                        pendingTimer = null;
                    }
                    await updateMessage(transactionMessage.id, {
                        data: {
                            ...transactionMessage.data,
                            status: 'failed',
                            error: innerError.message,
                            errorMessage: innerError.message,
                            completedAt: Date.now(),
                            isLoading: false
                        },
                        status: 'complete'
                    });

                    chatWS.broadcast(userId, {
                        type: 'client_action',
                        sessionId,
                        data: {
                            targetMessageId: transactionMessage.id,
                            action: {
                                type: 'show_transaction_status_card',
                                data: {
                                    ...transactionMessage.data,
                                    status: 'failed',
                                    error: innerError.message,
                                    errorMessage: innerError.message,
                                    completedAt: Date.now(),
                                    isLoading: false
                                }
                            }
                        }
                    });

                    return {
                        error: `Network error: ${innerError.message}`,
                        mode: 'error',
                        messageId: transactionMessage.id,
                        _final: true,
                        _user_message: `❌ Network error occurred: ${innerError.message}\n\nPlease try again.`
                    };
                }
            }

            // DEPRECATED: Swap cards removed from chat interface
            // Return simulation-only response, user must explicitly confirm via text
            const [tokenInSummaryDisplay, tokenOutSummaryDisplay] = await Promise.all([
                resolveTokenDisplayMetadata(args.token_in, args.chain_id),
                resolveTokenDisplayMetadata(args.token_out, args.chain_id),
            ]);
            const preWarmedQuote = await preWarmQuotePromise.catch(() => null);
            const quoteDetails = preWarmedQuote?.data
                ? {
                    amountOut: preWarmedQuote.data.amountOutHuman || preWarmedQuote.data.amountOut || null,
                    priceImpact: preWarmedQuote.data.priceImpact ?? null,
                    dex: preWarmedQuote.data.dexName || preWarmedQuote.data.dex || null,
                }
                : null;
            return {
                mode: 'simulation_only',
                success: true,
                summary: quoteDetails?.amountOut
                    ? `Quote ready: ${args.amount_in} ${tokenInSummaryDisplay.symbol} → about ${quoteDetails.amountOut} ${tokenOutSummaryDisplay.symbol}. Please reply "confirm" or "execute" to complete the trade.`
                    : `Swap prepared: ${args.amount_in} ${tokenInSummaryDisplay.symbol} → ${tokenOutSummaryDisplay.symbol}. Please reply "confirm" or "execute" to complete the trade.`,
                requires_confirmation: true,
                quote: quoteDetails,
                swapDetails: {
                    tokenIn: args.token_in,
                    tokenOut: args.token_out,
                    amountIn: args.amount_in,
                    chainId: args.chain_id,
                    slippage: args.slippage || 0.5
                },
                ...(executionDebug ? { debug: executionDebug } : {})
            };


        } catch (error: any) {
            console.error('[PrepareSwapTransaction] Error:', error);
            return { error: `Failed to prepare swap: ${error.message}`, mode: 'error' };
        }
    }
};

export const __prepareSwapTest = {
    resolveSocketRecoverySearchStartMs,
    buildSocketRecoveryResult,
    hasQuoteModeExecutionAuthorization,
};
